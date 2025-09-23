const browser = typeof globalThis.browser !== 'undefined' ? globalThis.browser : globalThis.chrome;

// Minimal debug logging - only for critical errors
function debugLog(message) {
  try {
    console.log(`[OnlyLikes] ${message}`);
  } catch {}
}

// Only log startup if there's an issue
const chromeVersion = parseInt(navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || '0');
if (chromeVersion < 138 && chromeVersion > 0) {
  debugLog(`Warning: Chrome version ${chromeVersion} may not support all features`);
}

if (navigator.userAgent.toLowerCase().includes('firefox')){
  browser.webRequest.onBeforeRequest.addListener(
    handleRequest,
    {urls: ["<all_urls>"]},
    ["blocking"]
  );
}

function handleRequest(details) {
  const supportedPlatforms = [
    "facebook.com",    
    "instagram.com",
    "news.ycombinator.com",
    "reddit.com",
    "tiktok.com",
    "x.com",
    "youtube.com"
  ];

  const url = new URL(details.url);
  const domain = url.hostname.replace('www.', '');

  if (supportedPlatforms.some(platform => domain.includes(platform))) {
    return { cancel: false };
  }

  return { cancel: false };
}

// Handle messages from content script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "analyzeComment") {
    // For Firefox, we need to return a Promise
    if (navigator.userAgent.toLowerCase().includes('firefox')) {
      return analyzeSentiment(message.comment)
        .then(sentiment => ({ sentiment, hash: message.hash }))
        .catch(error => ({ error: error.message, hash: message.hash }));
    }
    
    // For Chrome, use the callback pattern
    analyzeSentiment(message.comment)
      .then(sentiment => {
        sendResponse({sentiment, hash: message.hash});
      })
      .catch(error => {
        sendResponse({error: error.message, hash: message.hash});
      });
    return true; // Indicates we'll send a response asynchronously
  }
});

async function analyzeSentiment(comment) {
  try {
    if (navigator.userAgent.toLowerCase().includes('firefox')) { // Firefox
      browser.trial.ml.onProgress.addListener(progress => {
        // Silent progress tracking
      });
      const engine = await browser.trial.ml.createEngine({
        modelHub: "huggingface",
        modelHubId: "Xenova/distilbert-base-uncased-mnli",
        taskName: "zero-shot-classification"
      });
      const zslResult = await browser.trial.ml.runEngine({
        args: [comment, ["positive", "negative"]]
      });
      const { labels, scores } = zslResult || {};
      const iPos = labels ? labels.indexOf("positive") : -1;
      const iNeg = labels ? labels.indexOf("negative") : -1;
      let positiveScore = iPos >= 0 ? scores[iPos] : 0;
      let negativeScore = iNeg >= 0 ? scores[iNeg] : 0;
      let finalValue = 0.5;
      const total = positiveScore + negativeScore;
      if (total > 0) {
        finalValue = positiveScore / total;
      }
      return finalValue;
    } else { // Chrome
      // Check if LanguageModel API is available
      if (typeof globalThis.LanguageModel === 'undefined') {
        return analyzeWithHeuristics(comment);
      }

      try {
        // Check availability first
        const availability = await LanguageModel.availability();
        
        if (availability === 'unavailable') {
          return analyzeWithHeuristics(comment);
        }

        // Create session
        const session = await LanguageModel.create({
          monitor(m) {
            m.addEventListener('downloadprogress', (e) => {
              // Silent download progress
            });
          }
        });
        
        try {
          const prompt = `Analyze the sentiment of this comment and rate it from 0.0 (very negative) to 1.0 (very positive). Respond with only the number.

Comment: "${comment}"`;
          
          const response = await session.prompt(prompt);
          
          // Parse the response
          const cleanResponse = response.trim();
          
          // Try to extract a number between 0 and 1
          const numberMatch = cleanResponse.match(/\b(0(?:\.\d+)?|1(?:\.0+)?)\b/);
          
          if (numberMatch) {
            const value = parseFloat(numberMatch[0]);
            if (!isNaN(value) && value >= 0 && value <= 1) {
              return value;
            }
          }
          
          // Try parsing any decimal number
          const anyNumberMatch = cleanResponse.match(/(\d+\.?\d*)/);
          if (anyNumberMatch) {
            let value = parseFloat(anyNumberMatch[0]);
            
            // If it's a percentage, convert to decimal
            if (value > 1 && value <= 100) {
              value = value / 100;
            }
            
            if (!isNaN(value) && value >= 0 && value <= 1) {
              return value;
            }
          }
          
          return 0.5;
          
        } finally {
          session.destroy();
        }
        
      } catch (error) {
        return analyzeWithHeuristics(comment);
      }
    }
  } catch (error) {
    return analyzeWithHeuristics(comment);
  }
}

// Enhanced heuristic sentiment analysis as fallback
function analyzeWithHeuristics(comment) {
  const text = comment.toLowerCase().trim();
  
  // Positive indicators
  const positiveWords = [
    'good', 'great', 'awesome', 'excellent', 'amazing', 'wonderful', 'fantastic',
    'love', 'like', 'enjoy', 'appreciate', 'thank', 'thanks', 'helpful',
    'beautiful', 'brilliant', 'perfect', 'impressive', 'outstanding', 'superb',
    'nice', 'cool', 'sweet', 'congratulations', 'congrats', 'well done',
    'agree', 'exactly', 'yes', 'correct', 'right', 'true', 'absolutely',
    'interesting', 'fascinating', 'inspiring', 'motivating', 'encouraging'
  ];
  
  // Negative indicators
  const negativeWords = [
    'bad', 'terrible', 'awful', 'horrible', 'disgusting', 'hate', 'stupid',
    'idiot', 'moron', 'dumb', 'pathetic', 'useless', 'worthless', 'garbage',
    'trash', 'crap', 'sucks', 'fail', 'failure', 'loser', 'lame', 'boring',
    'wrong', 'false', 'lie', 'lying', 'fake', 'fraud', 'scam', 'terrible',
    'ridiculous', 'absurd', 'nonsense', 'bullshit', 'damn', 'fuck', 'shit'
  ];
  
  // Toxic patterns
  const toxicPatterns = [
    /you\s+(are|re)\s+(stupid|dumb|idiot|moron)/,
    /shut\s+up/,
    /go\s+(away|home|back)/,
    /kill\s+yourself/,
    /kys/,
    /delete\s+this/,
    /nobody\s+(asked|cares)/,
    /cringe/
  ];
  
  let score = 0.5; // neutral baseline
  let positiveCount = 0;
  let negativeCount = 0;
  
  // Count positive words
  positiveWords.forEach(word => {
    if (text.includes(word)) {
      positiveCount++;
    }
  });
  
  // Count negative words
  negativeWords.forEach(word => {
    if (text.includes(word)) {
      negativeCount++;
    }
  });
  
  // Check for toxic patterns
  let toxicFound = false;
  toxicPatterns.forEach(pattern => {
    if (pattern.test(text)) {
      toxicFound = true;
      negativeCount += 3; // heavily weight toxic patterns
    }
  });
  
  // Calculate score based on word counts
  const totalWords = text.split(/\s+/).length;
  const positiveRatio = positiveCount / Math.max(totalWords, 1);
  const negativeRatio = negativeCount / Math.max(totalWords, 1);
  
  if (toxicFound) {
    score = 0.1; // Very negative for toxic content
  } else if (positiveCount > negativeCount) {
    score = 0.5 + (positiveRatio * 0.4); // 0.5 to 0.9
  } else if (negativeCount > positiveCount) {
    score = 0.5 - (negativeRatio * 0.4); // 0.1 to 0.5
  }
  
  // Additional context clues
  if (text.includes('?')) score += 0.05; // Questions are often neutral/positive
  if (text.includes('!') && negativeCount === 0) score += 0.1; // Excitement
  if (text.length < 10) score += 0.1; // Short comments often less negative
  if (text.length > 200) score -= 0.05; // Long rants often more negative
  
  // Clamp score between 0 and 1
  score = Math.max(0, Math.min(1, score));
  
  return score;
}
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
    if (navigator.userAgent.toLowerCase().includes('firefox')) {
      return analyzeSentiment(message.comment)
        .then(result => {
          debugLog(`Sentiment completed for hash ${message.hash} via ${result?.source || 'unknown'} (${result?.sentiment ?? 'n/a'})`);
          return { ...result, hash: message.hash };
        })
        .catch(error => {
          debugLog(`Sentiment failed for hash ${message.hash}: ${error?.message || error}`);
          return { error: error.message, hash: message.hash };
        });
    }

    analyzeSentiment(message.comment)
      .then(result => {
        debugLog(`Sentiment completed for hash ${message.hash} via ${result?.source || 'unknown'} (${result?.sentiment ?? 'n/a'})`);
        sendResponse({ ...result, hash: message.hash });
      })
      .catch(error => {
        debugLog(`Sentiment failed for hash ${message.hash}: ${error?.message || error}`);
        sendResponse({ error: error.message, hash: message.hash });
      });
    return true;
  }
});

function normalizeSentiment(value) {
  if (!Number.isFinite(value)) return 0.5;
  const clamped = Math.min(0.99, Math.max(0.01, value));
  return Math.round(clamped * 1000) / 1000;
}

function wrapSentiment(value, source) {
  return {
    sentiment: normalizeSentiment(typeof value === 'number' ? value : 0.5),
    source
  };
}

function extractSentimentValue(text) {
  if (!text) return null;
  const strictMatch = text.match(/\b(?:0(?:\.\d+)?|1(?:\.0+)?)\b/);
  if (strictMatch) {
    const numeric = parseFloat(strictMatch[0]);
    if (!Number.isNaN(numeric)) return numeric;
  }
  const looseMatch = text.match(/(\d+\.?\d*)/);
  if (looseMatch) {
    let numeric = parseFloat(looseMatch[0]);
    if (numeric > 1 && numeric <= 100) numeric /= 100;
    if (!Number.isNaN(numeric)) return numeric;
  }
  return null;
}

async function analyzeSentiment(comment) {
  const fallback = () => wrapSentiment(analyzeWithHeuristics(comment), 'heuristics');

  try {
    if (navigator.userAgent.toLowerCase().includes('firefox')) {
      browser.trial.ml.onProgress.addListener(() => {
        // Silent progress tracking
      });
      const engine = await browser.trial.ml.createEngine({
        modelHub: "huggingface",        
        taskName: "text-classification"
      });
      const zslResult = await browser.trial.ml.runEngine({ args: [comment] });
      const { score } = zslResult || {};
      return wrapSentiment(score, 'firefox-ml');
    } else {
      if (typeof globalThis.LanguageModel === 'undefined') {
        return fallback();
      }

      try {
        const availability = await LanguageModel.availability();
        if (availability === 'unavailable') {
          return fallback();
        }

        const session = await LanguageModel.create({
          monitor(m) {
            m.addEventListener('downloadprogress', () => {
              // Silent download progress
            });
          }
        });
        
        try {
          const prompt = `Analyze the sentiment of this comment and rate it from 0.0 (very negative) to 1.0 (very positive). Respond with only the number.

Comment: "${comment}"`;
          
          const response = await session.prompt(prompt, { outputLanguage: 'en' });
          const numericValue = extractSentimentValue(response.trim());
          
          if (numericValue !== null && numericValue >= 0 && numericValue <= 1.01) {
            return wrapSentiment(numericValue, 'language-model');
          }
          
          return fallback();
          
        } finally {
          session.destroy();
        }
        
      } catch (error) {
        return fallback();
      }
    }
  } catch (error) {
    return fallback();
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
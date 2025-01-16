// Add this function for logging
function debugLog(message) {
  if (typeof browser !== 'undefined') { // Firefox
    browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0].id) {
        browser.tabs.sendMessage(tabs[0].id, { type: 'ONLYLIKES_LOG', message: message });
      }
    });
  } else { // Chrome
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'ONLYLIKES_LOG', message: message });
      }
    });
  }
}


if (typeof browser !== 'undefined'){
  browser.webRequest.onBeforeRequest.addListener(
    handleRequest,
    {urls: ["<all_urls>"]},
    ["blocking"]
  );
}

function handleRequest(details) {
  const supportedPlatforms = [
    "youtube.com",
    "twitter.com",
    "facebook.com",
    "instagram.com",
    "tiktok.com",
    "reddit.com"
  ];

  const url = new URL(details.url);
  const domain = url.hostname.replace('www.', '');

  if (supportedPlatforms.some(platform => domain.includes(platform))) {
    return { cancel: false };
  }

  return { cancel: false };
}

// Handle messages from content script
if (typeof browser !== 'undefined') { // Firefox
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "analyzeComments") {
      analyzeSentiment(message.comments)
        .then(sentiments => {
          sendResponse({sentiments});
        })
        .catch(error => {
          debugLog(`Error in sentiment analysis: ${error}`);
          sendResponse({error: error.message});
        });
      return true; // Indicates we'll send a response asynchronously
    }
  });
} else { // Chrome
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "analyzeComments") {
      analyzeSentiment(message.comments)
        .then(sentiments => {
          sendResponse({sentiments});
        })
        .catch(error => {
          debugLog(`Error in sentiment analysis: ${error}`);
          sendResponse({error: error.message});
        });
      return true; // Indicates we'll send a response asynchronously
    }
  });
}

async function analyzeSentiment(comments) {
  try {
    if (typeof browser !== 'undefined') { // Firefox
      browser.trial.ml.onProgress.addListener(progress => {
        debugLog(`ML progress: ${JSON.stringify(progress)}`);
      });
      const engine = await browser.trial.ml.createEngine({
        modelHub: "huggingface",
        modelHubId: "Xenova/distilbert-base-uncased-mnli",
        taskName: "zero-shot-classification"
      });
      const sentiments = [];
      for (const text of comments) {
        const zslResult = await browser.trial.ml.runEngine({
          args: [text, ["positive", "negative"]]
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
        sentiments.push(finalValue);
      }
      return sentiments;
    } else { // Chrome
      if (!chrome.aiOriginTrial || !chrome.aiOriginTrial.languageModel) {
        debugLog("On-device AI unavailable");
        return comments.map(c => c.length % 2 === 0 ? 0.7 : 0.3);
      }
      const session = await chrome.aiOriginTrial.languageModel.create();
      const sentiments = [];
      for (const text of comments) {
        try {
          const prompt = `Provide only the sentiment score as a JSON object with a single key "score" between 0 and 1 for the following text:\n"${text}"\n\nExample Response:\n{ "score": 0.75 }`;
          const response = await session.prompt(prompt);
          debugLog(`Received response: ${response}`);
          let parsedResponse = JSON.parse(response);
          let value = parseFloat(parsedResponse.score);
          if (isNaN(value) || value < 0 || value > 1) {
            value = 0.5;
          }
          sentiments.push(value);
        } catch {
          sentiments.push(0.5);
        }
      }
      return sentiments;
    }
  } catch (error) {
    debugLog(`Error accessing storage or analyzing sentiment: ${error.message}`);
    return comments.map(comment => comment.length % 2 === 0 ? 0.7 : 0.3);
  }
}

if (typeof browser !== 'undefined') { // Firefox
  // Cleanup when extension is unloaded
  browser.runtime.onSuspend.addListener(() => {
    if (mlEngine) {
      mlEngine.dispose();
      mlEngine = null;
    }
  });
}
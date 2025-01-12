// Add this function for logging
function debugLog(message) {
  browser.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (tabs[0]) {
      browser.tabs.executeScript(tabs[0].id, {
        code: `window.postMessage({ type: 'ONLYLIKES_LOG', message: '${message}' }, '*');`
      });
    }
  });
}

// Listen for web requests
browser.webRequest.onBeforeRequest.addListener(
  handleRequest,
  {urls: ["<all_urls>"]},
  ["blocking"]
);

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

async function analyzeSentiment(comments) {
  try {
    
  } catch (error) {
    debugLog(`Error accessing storage or analyzing sentiment: ${error.message}`);
    return comments.map(comment => comment.length % 2 === 0 ? 0.7 : 0.3);
  }
}


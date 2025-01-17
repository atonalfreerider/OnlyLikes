const browser = typeof globalThis.browser !== 'undefined' ? globalThis.browser : globalThis.chrome;

// Common functions
function debugLog(message) {
  console.log(`[OnlyLikes Debug] ${message}`);
}

// Listen for log messages from the background script
window.addEventListener('message', function(event) {
  if (event.source != window) return;

  if (event.data.type === 'ONLYLIKES_LOG') {
    debugLog(event.data.message);
  }
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'ONLYLIKES_LOG') {
    debugLog(request.message);
  }
});

let commentSentimentMap = {};

function filterComments(comments, batchSize = 10) {
  debugLog(`Filtering ${comments.length} comments`);
  const batches = [];
  for (let i = 0; i < comments.length; i += batchSize) {
    batches.push(comments.slice(i, i + batchSize));
  }

  return new Promise((resolve) => {
    const processedComments = [];
    const processBatch = (batch) => {
      batch.forEach(comment => {
        hideComment(document.getElementById(comment.id));
      });
      const commentTexts = batch.map(comment => comment.text);
      debugLog(`Sending ${commentTexts.length} comments for analysis`);
      browser.runtime.sendMessage({action: "analyzeComments", comments: commentTexts})
        .then(response => {
          debugLog(`Received response from background script: ${JSON.stringify(response)}`);
          if (response && Array.isArray(response.sentiments) && response.sentiments.length === batch.length) {
            batch.forEach((comment, index) => {
              const sentiment = response.sentiments[index];              
              processedComments.push({...comment, sentiment});
              commentSentimentMap[comment.id] = sentiment;
            });

            if (batches.length > 0) {
              processBatch(batches.shift());
            } else {
              resolve(processedComments);
            }
          } else {
            debugLog("Mismatched or missing sentiments array from background script.");
          }
        })
        .catch(error => {
          debugLog(`Error in sending message to background script: ${error}`);
        });
    };

    if (batches.length > 0) {
      processBatch(batches.shift());
    } else {
      resolve(processedComments);
    }
  });
}

async function getUserThreshold() {
  try {
    let result;
    result = await browser.storage.sync.get('threshold');
    switch(result.threshold) {
      case 'aggressive': return 0.85;
      case 'cautious': return 0.7;
      default: return 0.5;
    }
  } catch (error) {
    debugLog(`Error getting user threshold: ${error.message}`);
    return 0.5; // Default to neutral if there's an error
  }
}

function hideComment(element) {
  if (element) {
    element.classList.add('onlylikes-hidden-comment');
  }
}

function showComment(id) {
  const element = document.getElementById(id);
  if (element) {
    element.classList.remove('onlylikes-hidden-comment');
  }
}

// Inject CSS to hide comments
function injectHideCommentsCSS() {
  const style = document.createElement('style');
  style.textContent = `
    .onlylikes-hidden-comment {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

// Expose common functions to global scope
window.onlyLikes = {
  debugLog: debugLog,
  filterComments: filterComments,
  getUserThreshold: getUserThreshold,
  hideComment: hideComment,
  showComment: showComment
};

// Determine current platform
function getCurrentPlatform() {
  if (window.location.hostname.includes('reddit.com')) return 'reddit';
  if (window.location.hostname.includes('youtube.com')) return 'youtube';
  if (window.location.hostname.includes('twitter.com') || window.location.hostname.includes('x.com')) return 'twitter';
  if (window.location.hostname.includes('facebook.com')) return 'facebook';
  if (window.location.hostname.includes('instagram.com')) return 'instagram';
  return null;
}

// Load platform script
function loadPlatformScript(platformName) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = browser.runtime.getURL(`platform/${platformName}.js`);
    script.onload = () => {      
      resolve();
    };
    script.onerror = (error) => {
      debugLog(`Failed to load ${platformName}.js: ${error}`);
      reject(error);
    };
    (document.head || document.documentElement).appendChild(script);
  });
}

// Main execution
async function main() {
  const platformName = getCurrentPlatform();
  if (!platformName) {
    return;
  }

  injectHideCommentsCSS();

  try {
    await loadPlatformScript(platformName);
    
    // Send initialization message
    window.postMessage({ type: 'ONLYLIKES_INIT', platform: platformName }, '*');
    
  } catch (error) {
    debugLog(`Error in main execution: ${error.message}`);
    debugLog(`Error stack: ${error.stack}`);
  }
}

// Run main function when the page loads
window.addEventListener('load', main);

// Fallback for platforms that require explicit call to main
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  main();
} else {
  window.addEventListener('DOMContentLoaded', main);
}

// Add a message listener to handle requests from the injected script
window.addEventListener('message', function(event) {
  if (event.source != window) return;
  
  if (event.data.type && event.data.type === 'ONLYLIKES_REQUEST') {
    switch (event.data.action) {
      case 'debugLog':
        debugLog(event.data.message);
        break;
      case 'filterComments':
        filterComments(event.data.comments).then(result => {
          window.postMessage({ type: 'ONLYLIKES_RESPONSE', id: event.data.id, result: result }, '*');
        });
        break;
      case 'getUserThreshold':
        getUserThreshold().then(result => {
          window.postMessage({ type: 'ONLYLIKES_RESPONSE', id: event.data.id, result: result }, '*');
        });
        break;
      case 'hideComment':
        hideComment(document.getElementById(event.data.id));
        break;
      case 'showComment':
        getUserThreshold().then(threshold => {
          const sentiment = commentSentimentMap[event.data.id];
          if (sentiment !== undefined && sentiment > threshold) {
            showComment(event.data.id);
          } else {
            debugLog(`Blocking comment ${event.data.id} with sentiment ${sentiment} (< ${threshold})`);
          }
        });
        break;
    }
  }
});

// Expose necessary functions to the global scope
window.hideComment = hideComment;
window.showComment = showComment;
window.getCurrentPlatform = getCurrentPlatform;
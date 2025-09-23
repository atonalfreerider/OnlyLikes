const browser = typeof globalThis.browser !== 'undefined' ? globalThis.browser : globalThis.chrome;

// Minimal logging - only for errors
function debugLog(message) {
  // Only log in development - comment out for production
  // console.log(`[OnlyLikes] ${message}`);
}

// Cross-browser runtime.sendMessage wrapper
function sendMessageToBackground(message) {
  const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
  
  if (isFirefox) {
    return browser.runtime.sendMessage(message)
      .catch(error => {
        debugLog(`Message send error: ${error.message}`);
        throw error;
      });
  }
  
  // Chrome: bridge to Promise using callback
  return new Promise((resolve, reject) => {
    try {
      browser.runtime.sendMessage(message, (response) => {
        if (globalThis.chrome && chrome.runtime && chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    } catch (e) {
      reject(e);
    }
  });
}

// Update the commentSentimentMap structure
let commentSentimentMap = new Map();

function filterComments(comments) {  
  return new Promise((resolve) => {
    const processedComments = [];
    let remainingComments = comments.length;

    if (remainingComments === 0) {
      resolve(processedComments);
      return;
    }

    comments.forEach((comment) => {
      hideComment(document.getElementById(comment.id));
      const commentHash = hashComment(comment);
      commentSentimentMap.set(comment.id, { hash: commentHash });

      const sendMessagePromise = sendMessageToBackground({
        action: "analyzeComment",
        comment: comment.text,
        hash: commentHash
      });

      sendMessagePromise
        .then(async (response) => {
          if (response && typeof response.sentiment === 'number') {
            const commentData = {
              hash: commentHash,
              sentiment: response.sentiment
            };
            commentSentimentMap.set(comment.id, commentData);
            processedComments.push({...comment, sentiment: response.sentiment});
            await showComment(comment.id);
          } else if (response && response.error) {
            // For errors, show the comment (fail open)
            const element = document.getElementById(comment.id);
            if (element) {
              element.classList.remove('onlylikes-hidden-comment');
            }
          } else {
            // For invalid responses, show the comment (fail open)
            const element = document.getElementById(comment.id);
            if (element) {
              element.classList.remove('onlylikes-hidden-comment');
            }
          }
        })
        .catch(error => {
          // On error, show the comment (fail open)
          const element = document.getElementById(comment.id);
          if (element) {
            element.classList.remove('onlylikes-hidden-comment');
          }
        })
        .finally(() => {
          remainingComments--;
          if (remainingComments === 0) {
            resolve(processedComments);
          }
        });
    });
  });
}

function hashComment(comment) {
  return `hash_${comment.id}`;
}

async function showComment(id) {
  const element = document.getElementById(id);
  if (element) {
    const commentData = commentSentimentMap.get(id);
    if (commentData && typeof commentData.sentiment === 'number') {
      const threshold = await getUserThreshold();
      if (commentData.sentiment >= threshold) {
        element.classList.remove('onlylikes-hidden-comment');
      }
    }
  }
}

async function getUserThreshold() {
  return new Promise((resolve) => {
    browser.storage.sync.get('threshold', (result) => {
      const thresholdType = result.threshold || 'aggressive';
      
      const thresholdMap = {
        'aggressive': 0.85,
        'cautious': 0.7,
        'neutral': 0.5
      };
      
      const value = thresholdMap[thresholdType] || 0.85;
      resolve(value);
    });
  });
}

function hideComment(element) {
  if (element) {
    element.classList.add('onlylikes-hidden-comment');
  }
}

// Inject CSS to hide comments
function injectHideCommentsCSS() {
  try {
    const style = document.createElement('style');
    style.textContent = `
      .onlylikes-hidden-comment {
        display: none !important;
      }
    `;
    document.documentElement.appendChild(style);
  } catch (e) {
    debugLog('Error injecting CSS: ' + e.message);
  }
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
  if (window.location.hostname.includes('facebook.com')) return 'facebook';
  if (window.location.hostname.includes('instagram.com')) return 'instagram';
  if (window.location.hostname.includes('news.ycombinator.com')) return 'hn';
  if (window.location.hostname.includes('reddit.com')) return 'reddit';  
  if (window.location.hostname.includes('x.com') || window.location.hostname.includes('twitter.com')) return 'x';
  if (window.location.hostname.includes('youtube.com')) return 'youtube';  
  return null;
}

// Load platform script
function loadPlatformScript(platformName) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = browser.runtime.getURL(`platform/${platformName}.js`);
    script.onload = () => resolve();
    script.onerror = (error) => {
      debugLog(`Failed to load ${platformName}.js: ${error}`);
      reject(error);
    };
    (document.head || document.documentElement).appendChild(script);
  });
}

// Add error handling wrapper
async function safeExecute(fn, ...args) {
  try {
    return await fn.apply(this, args);
  } catch (e) {
    if (!e.message.includes('Permissions-Policy')) {
      debugLog(`Error in execution: ${e.message}`);
    }
    return null;
  }
}

// Main execution
async function main() {
  const platformName = getCurrentPlatform();
  if (!platformName) return;

  await safeExecute(injectHideCommentsCSS);

  try {
    await loadPlatformScript(platformName);
    window.postMessage({ type: 'ONLYLIKES_INIT', platform: platformName }, '*');
  } catch (error) {
    debugLog(`Error in main execution: ${error.message}`);
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
        showComment(event.data.id);
        window.postMessage({ type: 'ONLYLIKES_RESPONSE', id: event.data.id, result: true }, '*');
        break;
    }
  }
});

// Expose necessary functions to the global scope
window.hideComment = hideComment;
window.showComment = showComment;
window.getCurrentPlatform = getCurrentPlatform;

// Consolidated runtime message listener: handle logs and threshold changes
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'ONLYLIKES_LOG') {
    debugLog(request.message);
    return false;
  }
  if (request.type === 'THRESHOLD_CHANGED') {
    // Clear the sentiment map to force re-evaluation
    commentSentimentMap.clear();
    // Re-process all comments
    const comments = document.querySelectorAll('[id^="x-comment-"]');
    comments.forEach(comment => {
      if (comment.id) {
        showComment(comment.id);
      }
    });
    return true;
  }
  return false;
});
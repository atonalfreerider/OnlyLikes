// Common functions
function debugLog(message) {
  console.log(`[OnlyLikes Debug] ${message}`);
}

async function filterComments(comments) {
  // Implement or inject this function
  // For now, let's return a mock result
  return comments.map(comment => ({ ...comment, sentiment: Math.random() }));
}

async function getUserThreshold() {
  // Implement or inject this function
  // For now, let's return a default value
  return 0.5;
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
    script.src = browser.runtime.getURL(`${platformName}.js`);
    script.onload = () => {
      debugLog(`${platformName}.js loaded successfully`);
      resolve();
    };
    script.onerror = () => {
      debugLog(`Failed to load ${platformName}.js`);
      reject();
    };
    (document.head || document.documentElement).appendChild(script);
  });
}

// Main execution
async function main() {
  debugLog('Main function called');
  const platformName = getCurrentPlatform();
  if (!platformName) {
    debugLog('No supported platform detected');
    return;
  }

  debugLog(`Detected platform: ${platformName}`);
  injectHideCommentsCSS();

  try {
    await loadPlatformScript(platformName);
    if (window[platformName] && typeof window[platformName].main === 'function') {
      debugLog(`Executing ${platformName}.main()`);
      await window[platformName].main();
    } else {
      debugLog(`${platformName}.main() not found or not a function`);
    }
  } catch (error) {
    debugLog(`Error in main execution: ${error.message}`);
  }
}

// Run main function when the page loads
window.addEventListener('load', main);

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
        break;
    }
  }
});

// Expose necessary functions to the global scope
window.hideComment = hideComment;
window.showComment = showComment;
window.getCurrentPlatform = getCurrentPlatform;
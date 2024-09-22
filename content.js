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
  hideComment: hideComment
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

// Main execution
function main() {
  console.log('Main function called');
  const platformName = getCurrentPlatform();
  if (!platformName) {
    console.log('No supported platform detected');
    return;
  }

  // Inject the platform-specific script
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL(`${platformName}.js`);
  script.onload = function() {
    // Once the script is loaded, send a message to initialize it
    window.postMessage({ type: 'ONLYLIKES_INIT', platform: platformName }, '*');
  };
  (document.head || document.documentElement).appendChild(script);
}

// Run initial hide and inject CSS
injectHideCommentsCSS();

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
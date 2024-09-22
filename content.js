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
  element.classList.add('onlylikes-hidden-comment');
}

// Expose common functions to global scope
window.debugLog = debugLog;
window.filterComments = filterComments;
window.getUserThreshold = getUserThreshold;
window.hideComment = hideComment;

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

  // Load the platform-specific script
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL(`${platformName}.js`);
  script.onload = function() {
    // Once the script is loaded, call its main function
    if (window[platformName] && typeof window[platformName].main === 'function') {
      window[platformName].main();
    } else {
      console.error(`Main function not found for ${platformName}`);
    }
  };
  (document.head || document.documentElement).appendChild(script);
}

// Run the main function when the page loads and whenever the URL changes
window.addEventListener('load', main);
window.addEventListener('locationchange', main);

// Observe DOM changes for dynamically loaded comments
const observer = new MutationObserver((mutations) => {
  console.log('DOM mutation detected');
  const platformName = getCurrentPlatform();
  if (!platformName) return;

  if (window[platformName] && typeof window[platformName].isNewCommentNode === 'function' && typeof window[platformName].processNewComment === 'function') {
    for (let mutation of mutations) {
      if (mutation.type === 'childList') {
        const addedNodes = mutation.addedNodes;
        for (let node of addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE && window[platformName].isNewCommentNode(node)) {
            console.log('New comment detected');
            window[platformName].processNewComment(node);
          }
        }
      }
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Initial hide of all comments
function initialHideComments() {
  const platformName = getCurrentPlatform();
  if (!platformName) return;

  const script = document.createElement('script');
  script.src = chrome.runtime.getURL(`${platformName}.js`);
  script.onload = function() {
    if (window[platformName] && typeof window[platformName].scrapeComments === 'function') {
      const comments = window[platformName].scrapeComments();
      comments.forEach(comment => {
        hideComment(comment.element);
      });
    }
  };
  (document.head || document.documentElement).appendChild(script);
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

// Run initial hide, inject CSS, and main function
injectHideCommentsCSS();
initialHideComments();
main();

// Expose necessary functions to the global scope
window.hideComment = hideComment;
window.getCurrentPlatform = getCurrentPlatform;
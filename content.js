// Platform-specific implementations
const platforms = {
  reddit: {
    getUserName: () => {
      const userElement = document.querySelector('span[class*="AccountSwitcher"]');
      return userElement ? userElement.textContent.trim() : null;
    },
    isUserPost: (userName) => {
      const authorElement = document.querySelector('a[data-testid="post_author_link"]');
      return authorElement && authorElement.textContent.trim() === userName;
    },
    scrapeComments: () => {
      const commentElements = document.querySelectorAll('div[data-testid="comment"]');
      return Array.from(commentElements).map(comment => ({
        text: comment.querySelector('div[data-testid="comment"] > div:nth-child(2)').textContent,
        element: comment
      }));
    },
    waitForComments: () => Promise.resolve() // Reddit comments are usually loaded with the page
  },
  youtube: {
    getUserName: () => {
      const userElement = document.querySelector('#account-name');
      return userElement ? userElement.textContent.trim() : null;
    },
    isUserPost: (userName) => {
      const authorElement = document.querySelector('#owner-name a');
      return authorElement && authorElement.textContent.trim() === userName;
    },
    scrapeComments: () => {
      const commentElements = document.querySelectorAll('ytd-comment-thread-renderer');
      return Array.from(commentElements).map(comment => ({
        text: comment.querySelector('#content-text').textContent,
        element: comment
      }));
    },
    waitForComments: () => {
      return new Promise((resolve) => {
        const checkComments = setInterval(() => {
          if (document.querySelector('ytd-comment-thread-renderer')) {
            clearInterval(checkComments);
            resolve();
          }
        }, 1000);
      });
    }
  },
  twitter: {
    getUserName: () => {
      const userElement = document.querySelector('a[data-testid="AppTabBar_Profile_Link"] div[dir="ltr"]');
      return userElement ? userElement.textContent.trim() : null;
    },
    isUserPost: (userName) => {
      const authorElement = document.querySelector('div[data-testid="User-Name"] div[dir="ltr"]');
      return authorElement && authorElement.textContent.trim().includes(userName);
    },
    scrapeComments: () => {
      const commentElements = document.querySelectorAll('article[data-testid="tweet"]');
      return Array.from(commentElements).map(comment => ({
        text: comment.querySelector('div[data-testid="tweetText"]').textContent,
        element: comment
      }));
    },
    waitForComments: () => {
      return new Promise((resolve) => {
        const checkComments = setInterval(() => {
          if (document.querySelector('article[data-testid="tweet"]')) {
            clearInterval(checkComments);
            resolve();
          }
        }, 1000);
      });
    }
  }
};

// Determine current platform
function getCurrentPlatform() {
  if (window.location.hostname.includes('reddit.com')) return platforms.reddit;
  if (window.location.hostname.includes('youtube.com')) return platforms.youtube;
  if (window.location.hostname.includes('twitter.com')) return platforms.twitter;
  return null;
}

// Common functions
function filterComments(comments) {
  comments.forEach(comment => {
    browser.runtime.sendMessage({action: "analyzeComment", comment: comment.text})
      .then(response => {
        if (response.sentiment < getUserThreshold()) {
          hideComment(comment.element);
        }
      });
  });
}

function getUserThreshold() {
  return browser.storage.sync.get('threshold').then(result => {
    switch(result.threshold) {
      case 'aggressive': return 0.7;
      case 'cautious': return 0.3;
      default: return 0.5;
    }
  });
}

function hideComment(commentElement) {
  commentElement.style.display = 'none';
}

// Main execution
async function main() {
  const platform = getCurrentPlatform();
  if (!platform) return;

  const userName = platform.getUserName();
  if (platform.isUserPost(userName)) {
    await platform.waitForComments();
    const comments = platform.scrapeComments();
    filterComments(comments);
  }
}

// Run the main function when the page loads and whenever the URL changes
main();

// Platform-specific event listeners
if (window.location.hostname.includes('youtube.com')) {
  window.addEventListener('yt-navigate-finish', main);
} else {
  // For Reddit, Twitter, and other platforms
  window.addEventListener('locationchange', main);
  
  // Custom event for single-page apps
  let oldPushState = history.pushState;
  history.pushState = function pushState() {
    let ret = oldPushState.apply(this, arguments);
    window.dispatchEvent(new Event('locationchange'));
    return ret;
  };
}

// Observe DOM changes for dynamically loaded comments
const observer = new MutationObserver((mutations) => {
  const platform = getCurrentPlatform();
  if (!platform) return;

  for (let mutation of mutations) {
    if (mutation.type === 'childList') {
      const addedNodes = mutation.addedNodes;
      for (let node of addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if ((platform === platforms.reddit && node.matches('div[data-testid="comment"]')) ||
              (platform === platforms.youtube && node.matches('ytd-comment-thread-renderer')) ||
              (platform === platforms.twitter && node.matches('article[data-testid="tweet"]'))) {
            filterComments([{
              text: platform === platforms.reddit 
                ? node.querySelector('div[data-testid="comment"] > div:nth-child(2)').textContent
                : platform === platforms.youtube
                ? node.querySelector('#content-text').textContent
                : node.querySelector('div[data-testid="tweetText"]').textContent,
              element: node
            }]);
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
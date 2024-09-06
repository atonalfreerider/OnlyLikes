// Platform-specific implementations
const platforms = {
  reddit: {
    getUserName: () => {
      debugLog('Getting Reddit username');
      // Try multiple selectors to find the username
      const selectors = [
        'span[class*="AccountSwitcher"]',
        'a[href^="/user/"]',
        '#header-bottom-right .user a',
        'div[data-testid="reddit-header"] a[href^="/user/"]'
      ];
      let username = null;
      for (let selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          // Extract username from the text content
          const match = element.textContent.match(/u\/(\w+)/);
          if (match) {
            username = match[1];
            break;
          }
        }
      }
      debugLog(`Reddit username: ${username}`);
      return username;
    },
    isUserPost: (userName) => {
      debugLog('Checking if this is a user post on Reddit');
      const selectors = [
        'a[data-testid="post_author_link"]',
        'a[data-click-id="user"]',
        'div[data-testid="post-author-header"] a',
        '.top-matter .author',
        'span[class*="AuthorFlair"]',
        'a[href^="/user/"]'
      ];
      let authorElement = null;
      for (let selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (let element of elements) {
          if (element.textContent.includes(userName)) {
            authorElement = element;
            break;
          }
        }
        if (authorElement) break;
      }
      let authorName = authorElement ? authorElement.textContent.trim() : null;
      // Extract username from the text content
      if (authorName) {
        const match = authorName.match(/u\/(\w+)/);
        if (match) {
          authorName = match[1];
        }
      }
      const isUserPost = authorName === userName;
      debugLog(`Author name: ${authorName}, User name: ${userName}, Is user post: ${isUserPost}`);
      return isUserPost;
    },
    waitForComments: () => {
      debugLog('Waiting for Reddit comments to load');
      return new Promise((resolve) => {
        const checkComments = setInterval(() => {
          const commentArea = document.querySelector('div[id^="t3_"]');
          const noComments = document.querySelector('div[id^="t3_"] span');
          if (commentArea || (noComments && noComments.textContent.includes("No Comments Yet"))) {
            clearInterval(checkComments);
            debugLog('Reddit comments loaded or no comments found');
            resolve();
          }
        }, 1000);

        // Set a timeout to resolve after 15 seconds if comments haven't loaded
        setTimeout(() => {
          clearInterval(checkComments);
          debugLog('Timed out waiting for Reddit comments');
          resolve();
        }, 15000);
      });
    },
    scrapeComments: () => {
      debugLog('Scraping Reddit comments');
      const commentSelectors = [
        '.Comment', 
        '[data-testid="comment"]', 
        '.sitetable.nestedlisting > .thing.comment',
        'div[id^="t1_"]'
      ];
      let commentElements = [];
      for (let selector of commentSelectors) {
        commentElements = document.querySelectorAll(selector);
        if (commentElements.length > 0) {
          debugLog(`Found comments using selector: ${selector}`);
          break;
        }
      }
      const comments = Array.from(commentElements).map(comment => {
        const textElement = 
          comment.querySelector('[data-testid="comment-top-meta"]') || 
          comment.querySelector('.RichTextJSON-root') || 
          comment.querySelector('.usertext-body') ||
          comment.querySelector('.md') ||
          comment.querySelector('p');
        const text = textElement ? textElement.textContent : '';
        debugLog(`Extracted comment text: "${text.substring(0, 50)}..."`);
        return {
          text: text,
          element: comment
        };
      }).filter(comment => comment.text.trim() !== '');
      debugLog(`Scraped ${comments.length} Reddit comments`);
      return comments;
    }
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
      const title = document.title;
      if (title.includes(userName)) return true;
      const authorElement = document.querySelector('div[data-testid="User-Name"] div[dir="ltr"]');
      return authorElement && authorElement.textContent.trim().includes(userName);
    },
    scrapeComments: () => {
      const commentElements = document.querySelectorAll('article[data-testid="tweet"]');
      return Array.from(commentElements).map(comment => {
        const textElement = comment.querySelector('div[data-testid="tweetText"]');
        return {
          text: textElement ? textElement.textContent : '',
          element: comment
        };
      }).filter(comment => comment.text.trim() !== '');
    },
    waitForComments: () => {
      return new Promise((resolve) => {
        const checkComments = setInterval(() => {
          if (document.querySelector('article[data-testid="tweet"]')) {
            clearInterval(checkComments);
            resolve();
          }
        }, 1000);

        // Set a timeout to resolve after 15 seconds if comments haven't loaded
        setTimeout(() => {
          clearInterval(checkComments);
          resolve();
        }, 15000);
      });
    }
  },
  facebook: {
    getUserName: () => {
      const userElement = document.querySelector('div[role="navigation"] span[dir="auto"]');
      return userElement ? userElement.textContent.trim() : null;
    },
    isUserPost: (userName) => {
      const authorElement = document.querySelector('h2[id^="mount_0_0_"] a');
      return authorElement && authorElement.textContent.trim() === userName;
    },
    scrapeComments: () => {
      const commentElements = document.querySelectorAll('div[aria-label="Comment"]');
      return Array.from(commentElements).map(comment => ({
        text: comment.querySelector('div[dir="auto"]').textContent,
        element: comment
      }));
    },
    waitForComments: () => {
      return new Promise((resolve) => {
        const checkComments = setInterval(() => {
          if (document.querySelector('div[aria-label="Comment"]')) {
            clearInterval(checkComments);
            resolve();
          }
        }, 1000);
      });
    }
  },
  instagram: {
    getUserName: () => {
      const userElement = document.querySelector('header section > div:nth-child(3) span');
      return userElement ? userElement.textContent.trim() : null;
    },
    isUserPost: (userName) => {
      const authorElement = document.querySelector('article header a');
      return authorElement && authorElement.textContent.trim() === userName;
    },
    scrapeComments: () => {
      const commentElements = document.querySelectorAll('ul > li:not(:first-child)');
      return Array.from(commentElements).map(comment => ({
        text: comment.querySelector('span').textContent,
        element: comment
      }));
    },
    waitForComments: () => {
      return new Promise((resolve) => {
        const checkComments = setInterval(() => {
          if (document.querySelector('ul > li:not(:first-child)')) {
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
  if (window.location.hostname.includes('twitter.com') || window.location.hostname.includes('x.com')) return platforms.twitter;
  if (window.location.hostname.includes('facebook.com')) return platforms.facebook;
  if (window.location.hostname.includes('instagram.com')) return platforms.instagram;
  return null;
}

// Common functions
function filterComments(comments) {
  debugLog(`Filtering ${comments.length} comments`);
  comments.forEach(comment => {
    debugLog(`Analyzing comment: "${comment.text.substring(0, 50)}..."`);
    browser.runtime.sendMessage({action: "analyzeComment", comment: comment.text})
      .then(response => {
        debugLog(`Received sentiment score: ${response.sentiment}`);
        if (response.sentiment < getUserThreshold()) {
          debugLog('Comment hidden due to low sentiment score');
          hideComment(comment.element);
        } else {
          debugLog('Comment passed sentiment threshold');
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
  debugLog('Main function called');
  const platform = getCurrentPlatform();
  if (!platform) {
    debugLog('No supported platform detected');
    return;
  }

  let retries = 3;
  let userName = null;
  while (retries > 0 && userName === null) {
    userName = platform.getUserName();
    debugLog(`Detected user name: ${userName}`);
    if (userName === null) {
      debugLog(`Failed to detect username, retrying... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retrying
      retries--;
    }
  }

  if (userName === null) {
    debugLog('Failed to detect username after all retries');
    return;
  }

  debugLog(`Final detected user name: ${userName}`);
  debugLog('Checking if this is a user post');
  const isUserPost = platform.isUserPost(userName);
  debugLog(`Is user post (returned from isUserPost): ${isUserPost}`);

  if (isUserPost) {
    debugLog('Current post is by the user');
    debugLog('Waiting for comments to load...');
    await platform.waitForComments();
    debugLog('Comments loaded or timed out');
    debugLog('Scraping comments...');
    const comments = platform.scrapeComments();
    debugLog(`Scraped ${comments.length} comments`);
    if (comments.length > 0) {
      debugLog('Comment preview:');
      comments.slice(0, 3).forEach((comment, index) => {
        debugLog(`Comment ${index + 1}: "${comment.text.substring(0, 50)}..."`);
      });
      debugLog('Filtering comments...');
      filterComments(comments);
    } else {
      debugLog('No comments found to filter');
    }
  } else {
    debugLog('Current post is not by the user');
  }
}

// Run the main function when the page loads and whenever the URL changes
main();

// Platform-specific event listeners
if (window.location.hostname.includes('youtube.com')) {
  window.addEventListener('yt-navigate-finish', main);
} else {
  // For Reddit, Twitter, Facebook, Instagram, and other platforms
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
  debugLog('DOM mutation detected');
  const platform = getCurrentPlatform();
  if (!platform) return;

  for (let mutation of mutations) {
    if (mutation.type === 'childList') {
      const addedNodes = mutation.addedNodes;
      for (let node of addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if ((platform === platforms.reddit && node.matches('div[data-testid="comment"]')) ||
              (platform === platforms.youtube && node.matches('ytd-comment-thread-renderer')) ||
              (platform === platforms.twitter && node.matches('article[data-testid="tweet"]')) ||
              (platform === platforms.facebook && node.matches('div[aria-label="Comment"]')) ||
              (platform === platforms.instagram && node.matches('ul > li:not(:first-child)'))) {
            debugLog('New comment detected');
            filterComments([{
              text: platform === platforms.reddit 
                ? node.querySelector('div[data-testid="comment"] > div:nth-child(2)').textContent
                : platform === platforms.youtube
                ? node.querySelector('#content-text').textContent
                : platform === platforms.twitter
                ? node.querySelector('div[data-testid="tweetText"]').textContent
                : platform === platforms.facebook
                ? node.querySelector('div[dir="auto"]').textContent
                : node.querySelector('span').textContent,
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

// Add this function for logging
function debugLog(message) {
  console.log(`[OnlyLikes Debug] ${message}`);
}
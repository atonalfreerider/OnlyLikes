import { debugLog, filterComments, getUserThreshold, hideComment } from './common.js';

export const youtube = {
  getUserName: () => {
    debugLog('Getting YouTube username');
    
    // Method 1: Try to get the username from the specific div
    const displayNameElement = document.querySelector('div#display-name.style-scope.yt-clip-creation-renderer');
    if (displayNameElement) {
      const username = displayNameElement.textContent.trim();
      debugLog(`YouTube username found in display-name div: ${username}`);
      return username;
    }
    
    // Method 2: Try to get the username from the DOM (fallback)
    const selectors = [
      'yt-formatted-string#account-name',
      '#account-name',
      '#masthead #avatar-btn',
      'ytd-topbar-menu-button-renderer #avatar-btn'
    ];
    
    for (let selector of selectors) {
      const userElement = document.querySelector(selector);
      if (userElement) {
        let username;
        if (userElement.tagName.toLowerCase() === 'img') {
          username = userElement.getAttribute('alt');
        } else {
          username = userElement.getAttribute('aria-label') || userElement.textContent.trim();
        }
        if (username && !['Avatar image', 'Account menu'].includes(username)) {
          // Remove "Avatar for " prefix if present
          username = username.replace(/^Avatar for /, '');
          debugLog(`YouTube username found using selector '${selector}': ${username}`);
          return username;
        }
      }
    }
    
    debugLog('Failed to find YouTube username');
    return null;
  },
  getPostAuthor: () => {
    debugLog('Getting YouTube post author');
    const authorElement = document.querySelector('yt-formatted-string#text.ytd-channel-name a');
    const author = authorElement ? authorElement.textContent.trim() : null;
    debugLog(`YouTube post author: ${author}`);
    return author;
  },
  isUserPost: (userName) => {
    const postAuthor = youtube.getPostAuthor();
    // Remove special characters and convert to lowercase for comparison
    const normalizedUserName = userName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const normalizedPostAuthor = postAuthor.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const isUserPost = normalizedUserName.includes(normalizedPostAuthor) || normalizedPostAuthor.includes(normalizedUserName);
    debugLog(`User name: ${userName}, Post author: ${postAuthor}, Is user post: ${isUserPost}`);
    return isUserPost;
  },
  waitForComments: () => {
    debugLog('Waiting for YouTube comments to load');
    return new Promise((resolve) => {
      const checkComments = setInterval(() => {
        if (document.querySelector('#comments #contents')) {
          clearInterval(checkComments);
          debugLog('YouTube comments section found');
          resolve();
        }
      }, 1000);

      setTimeout(() => {
        clearInterval(checkComments);
        debugLog('Timed out waiting for YouTube comments section');
        resolve();
      }, 15000);
    });
  },
  scrapeComments: () => {
    debugLog('Scraping YouTube comments');
    const commentElements = document.querySelectorAll('ytd-comment-thread-renderer:not([data-onlylikes-processed])');
    const comments = Array.from(commentElements).map(comment => {
      const contentElement = comment.querySelector('#content-text');
      const text = contentElement ? contentElement.textContent.trim() : '';
      debugLog(`Extracted comment text: "${text.substring(0, 50)}..."`);
      comment.setAttribute('data-onlylikes-processed', 'true');
      return {
        text: text,
        element: comment
      };
    }).filter(comment => comment.text !== '');
    debugLog(`Scraped ${comments.length} new YouTube comments`);
    return comments;
  },
  observeComments: (callback) => {
    const commentsSection = document.querySelector('#comments #contents');
    if (!commentsSection) {
      debugLog('Comments section not found for observation');
      return;
    }

    const observer = new MutationObserver((mutations) => {
      let newCommentsAdded = false;
      for (let mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          newCommentsAdded = true;
          break;
        }
      }
      if (newCommentsAdded) {
        debugLog('New comments detected, re-scraping');
        const newComments = youtube.scrapeComments();
        if (newComments.length > 0) {
          callback(newComments);
        }
      }
    });

    observer.observe(commentsSection, { childList: true, subtree: true });
    debugLog('Comment observer started');
  }
};

export async function main() {
  debugLog('YouTube main function called');
  debugLog(`Current URL: ${window.location.href}`);
  debugLog(`Document readyState: ${document.readyState}`);
  
  let retries = 3;
  let userName = null;
  while (retries > 0 && userName === null) {
    userName = youtube.getUserName();
    if (userName === null) {
      debugLog(`Failed to detect username, retrying... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      retries--;
    }
  }

  if (userName === null) {
    debugLog('Failed to detect username after all retries');
    debugLog(`Page title: ${document.title}`);
    debugLog(`Body classes: ${document.body.className}`);
    return;
  }

  debugLog(`Final detected user name: ${userName}`);
  debugLog('Checking if this is a user post');
  const isUserPost = youtube.isUserPost(userName);

  if (isUserPost) {
    debugLog('Current post is by the user');
    debugLog('Waiting for comments to load...');
    await youtube.waitForComments();
    debugLog('Comments section found or timed out');

    const processNewComments = async (comments) => {
      debugLog(`Processing ${comments.length} new comments`);
      const processedComments = await filterComments(comments);
      const threshold = await getUserThreshold();
      processedComments.forEach(comment => {
        if (comment.sentiment < threshold) {
          hideComment(comment.element);
        }
      });
    };

    // Initial scrape and process
    const initialComments = youtube.scrapeComments();
    await processNewComments(initialComments);

    // Start observing for new comments
    youtube.observeComments(processNewComments);
  } else {
    debugLog('Current post is not by the user');
  }
}
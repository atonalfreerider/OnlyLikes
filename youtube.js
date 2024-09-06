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
          debugLog('YouTube comments loaded');
          resolve();
        }
      }, 1000);

      setTimeout(() => {
        clearInterval(checkComments);
        debugLog('Timed out waiting for YouTube comments');
        resolve();
      }, 15000);
    });
  },
  scrapeComments: () => {
    debugLog('Scraping YouTube comments');
    const commentElements = document.querySelectorAll('ytd-comment-thread-renderer');
    const comments = Array.from(commentElements).map(comment => {
      const contentElement = comment.querySelector('#content-text');
      const text = contentElement ? contentElement.textContent.trim() : '';
      debugLog(`Extracted comment text: "${text.substring(0, 50)}..."`);
      return {
        text: text,
        element: comment
      };
    }).filter(comment => comment.text !== '');
    debugLog(`Scraped ${comments.length} YouTube comments`);
    return comments;
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
      await new Promise(resolve => setTimeout(resolve, 2000)); // Increased wait time
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
    debugLog('Comments loaded or timed out');
    debugLog('Scraping comments...');
    const comments = youtube.scrapeComments();
    debugLog(`Scraped ${comments.length} comments`);
    if (comments.length > 0) {
      debugLog('Comment preview:');
      comments.slice(0, 3).forEach((comment, index) => {
        debugLog(`Comment ${index + 1}: "${comment.text.substring(0, 50)}..."`);
      });
      debugLog('Filtering comments...');
      const processedComments = await filterComments(comments);
      const threshold = await getUserThreshold();
      processedComments.forEach(comment => {
        if (comment.sentiment < threshold) {
          hideComment(comment.element);
        }
      });
    } else {
      debugLog('No comments found to filter');
    }
  } else {
    debugLog('Current post is not by the user');
  }
}
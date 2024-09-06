import { debugLog, filterComments, getUserThreshold, hideComment } from './common.js';

export const youtube = {
  getUserName: () => {
    debugLog('Getting YouTube username');
    
    // Method 1: Try to get the username from the ytInitialData
    if (typeof ytInitialData !== 'undefined') {
      const ytInitialDataString = JSON.stringify(ytInitialData);
      debugLog(`ytInitialData available: ${ytInitialDataString.substring(0, 100)}...`);
      const userNameMatch = ytInitialDataString.match(/"text":"([^"]+)","bold":true/);
      if (userNameMatch && userNameMatch[1]) {
        const username = userNameMatch[1];
        debugLog(`YouTube username found in ytInitialData: ${username}`);
        return username;
      }
    } else {
      debugLog('ytInitialData is undefined');
    }
    
    // Method 2: Try to get the username from the DOM
    const selectors = [
      '#account-name',
      'yt-formatted-string#account-name',
      '#masthead #avatar-btn',
      'ytd-topbar-menu-button-renderer #avatar-btn'
    ];
    
    for (let selector of selectors) {
      const userElement = document.querySelector(selector);
      if (userElement) {
        const username = userElement.textContent.trim() || userElement.getAttribute('aria-label');
        if (username) {
          debugLog(`YouTube username found using selector '${selector}': ${username}`);
          return username;
        }
      }
    }
    
    // Method 3: Try to get the username from the page source
    const pageSource = document.documentElement.outerHTML;
    const channelNameMatch = pageSource.match(/"channelName":"([^"]+)"/);
    if (channelNameMatch && channelNameMatch[1]) {
      const username = channelNameMatch[1];
      debugLog(`YouTube username found in page source: ${username}`);
      return username;
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
    const isUserPost = postAuthor === userName;
    debugLog(`Is user post: ${isUserPost}`);
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
import { debugLog, filterComments, getUserThreshold, hideComment } from './common.js';

const twitter = {
  getUserName: () => {
    debugLog('Getting Twitter/X username');
    // Try to get username from the profile avatar
    const avatarContainer = document.querySelector('div[data-testid="UserAvatar-Container-"]');
    if (avatarContainer) {
      const dataTestId = avatarContainer.getAttribute('data-testid');
      const username = dataTestId.split('-').pop();
      debugLog(`Twitter/X username from avatar: ${username}`);
      return username;
    }
    
    // Fallback to previous method if avatar method fails
    const userElement = document.querySelector('a[data-testid="AppTabBar_Profile_Link"] div[dir="ltr"]');
    let username = userElement ? userElement.textContent.trim() : null;
    
    if (!username) {
      // Try to get username from the profile link
      const profileLink = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
      if (profileLink) {
        const href = profileLink.getAttribute('href');
        username = href ? href.split('/').pop() : null;
      }
    }
    
    debugLog(`Twitter/X username: ${username}`);
    return username;
  },
  isUserPost: (userName) => {
    debugLog('Checking if this is a user post on Twitter');
    // Check in the title
    const title = document.title;
    const titleMatch = title.match(/(.*?) on X:/);
    if (titleMatch) {
      const authorFromTitle = titleMatch[1];
      debugLog(`Author from title: ${authorFromTitle}`);
      return authorFromTitle.toLowerCase() === userName.toLowerCase();
    }
    
    // Fallback to previous methods if title check fails
    if (title.toLowerCase().includes(userName.toLowerCase())) {
      debugLog(`User post confirmed from title: ${userName}`);
      return true;
    }
    
    // Check in meta tags
    const metaTags = document.getElementsByTagName('meta');
    for (let i = 0; i < metaTags.length; i++) {
      if (metaTags[i].getAttribute('content') && metaTags[i].getAttribute('content').toLowerCase().includes(userName.toLowerCase())) {
        debugLog(`User post confirmed from meta tag: ${userName}`);
        return true;
      }
    }
    
    // Check in the DOM
    const authorElement = document.querySelector('div[data-testid="User-Name"] div[dir="ltr"]');
    const isUserPost = authorElement && authorElement.textContent.trim().toLowerCase().includes(userName.toLowerCase());
    debugLog(`Author element found: ${!!authorElement}, Is user post: ${isUserPost}`);
    return isUserPost;
  },
  scrapeComments: () => {
    debugLog('Scraping Twitter comments');
    const commentElements = document.querySelectorAll('article[data-testid="tweet"]');
    const comments = Array.from(commentElements).map(comment => {
      const textElement = comment.querySelector('div[data-testid="tweetText"]');
      const text = textElement ? textElement.textContent : '';
      debugLog(`Extracted comment text: "${text.substring(0, 50)}..."`);
      return {
        text: text,
        element: comment
      };
    }).filter(comment => comment.text.trim() !== '');
    debugLog(`Scraped ${comments.length} Twitter comments`);
    return comments;
  },
  waitForComments: () => {
    debugLog('Waiting for Twitter comments to load');
    return new Promise((resolve) => {
      const checkComments = setInterval(() => {
        if (document.querySelector('article[data-testid="tweet"]')) {
          clearInterval(checkComments);
          debugLog('Twitter comments loaded');
          resolve();
        }
      }, 1000);

      // Set a timeout to resolve after 15 seconds if comments haven't loaded
      setTimeout(() => {
        clearInterval(checkComments);
        debugLog('Timed out waiting for Twitter comments');
        resolve();
      }, 15000);
    });
  }
};

async function main() {
  debugLog('Twitter/X main function called');
  const userName = twitter.getUserName();
  if (!userName) {
    debugLog('Failed to detect Twitter/X username');
    return;
  }

  debugLog(`Detected Twitter/X user name: ${userName}`);
  const isUserPost = twitter.isUserPost(userName);
  debugLog(`Is user post: ${isUserPost}`);

  if (isUserPost) {
    debugLog('Current Twitter/X post is by the user');
    await twitter.waitForComments();
    const comments = twitter.scrapeComments();
    if (comments.length > 0) {
      debugLog('Filtering Twitter/X comments...');
      await filterComments(comments);
    } else {
      debugLog('No Twitter/X comments found to filter');
    }
  } else {
    debugLog('Current Twitter/X post is not by the user');
  }
}

export { twitter, main };
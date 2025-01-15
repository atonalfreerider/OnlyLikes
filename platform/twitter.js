import { debugLog, filterComments, getUserThreshold, hideComment } from './common.js';

export const getUserName = () => {
  debugLog('Getting Twitter/X username');
  
  // Try to get username from the profile avatar
  const avatarContainer = document.querySelector('div[data-testid="UserAvatar-Container-"]');
  if (avatarContainer) {
    const dataTestId = avatarContainer.getAttribute('data-testid');
    debugLog(`Avatar container data-testid: ${dataTestId}`);
    const username = dataTestId.split('-').pop();
    debugLog(`Twitter/X username from avatar: ${username}`);
    return username;
  } else {
    debugLog('Avatar container not found');
  }
  
  // Try to get username from the sidebar profile section
  const sidebarProfileButton = document.querySelector('div[data-testid="SideNav_AccountSwitcher_Button"]');
  if (sidebarProfileButton) {
    const usernameElement = sidebarProfileButton.querySelector('div[dir="ltr"] span');
    if (usernameElement) {
      const username = usernameElement.textContent.trim().replace('@', '');
      debugLog(`Twitter/X username from sidebar: ${username}`);
      return username;
    } else {
      debugLog('Username element not found in sidebar profile button');
    }
  } else {
    debugLog('Sidebar profile button not found');
  }
  
  // Try to get username from the profile link
  const profileLink = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
  if (profileLink) {
    const href = profileLink.getAttribute('href');
    debugLog(`Profile link href: ${href}`);
    if (href) {
      const username = href.split('/').pop();
      debugLog(`Twitter/X username from profile link: ${username}`);
      return username;
    }
  } else {
    debugLog('Profile link not found');
  }
  
  // If all methods fail, return null
  debugLog('Failed to detect Twitter/X username');
  return null;
};

export const isUserPost = (userName) => {
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
};

export const scrapeComments = () => {
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
};

export const waitForComments = () => {
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
};

export const isNewCommentNode = (node) => {
  return node.matches('article[data-testid="tweet"]');
};

export const processNewComment = async (node) => {
  const textElement = node.querySelector('div[data-testid="tweetText"]');
  const text = textElement ? textElement.textContent : '';
  if (text.trim() !== '') {
    const processedComments = await filterComments([{ text, element: node }]);
    const threshold = await getUserThreshold();
    if (processedComments[0].sentiment < threshold) {
      hideComment(node);
    }
  }
};

export async function main() {
  debugLog('Twitter main function called');
  let retries = 3;
  let userName = null;
  while (retries > 0 && userName === null) {
    userName = getUserName();
    debugLog(`Detected user name: ${userName}`);
    if (userName === null) {
      debugLog(`Failed to detect username, retrying... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      retries--;
    }
  }

  if (userName === null) {
    debugLog('Failed to detect username after all retries');
    return;
  }

  debugLog(`Final detected user name: ${userName}`);
  debugLog('Checking if this is a user post');
  const userPost = isUserPost(userName);
  debugLog(`Is user post: ${userPost}`);

  if (userPost) {
    debugLog('Current post is by the user');
    debugLog('Waiting for comments to load...');
    await waitForComments();
    debugLog('Comments loaded or timed out');
    debugLog('Scraping comments...');
    const comments = scrapeComments();
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

// Platform-specific event listener
window.addEventListener('locationchange', main);

// Custom event for single-page app
let oldPushState = history.pushState;
history.pushState = function pushState() {
  let ret = oldPushState.apply(this, arguments);
  window.dispatchEvent(new Event('locationchange'));
  return ret;
};
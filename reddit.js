import { debugLog, filterComments, getUserThreshold, hideComment } from './common.js';

export const reddit = {
  getUserName: () => {
    debugLog('Getting Reddit username');
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
    const authorElement = document.querySelector('a.author-name[href^="/user/"]');
    if (authorElement) {
      const authorName = authorElement.textContent.trim();
      const isUserPost = authorName === userName;
      debugLog(`Author name: ${authorName}, User name: ${userName}, Is user post: ${isUserPost}`);
      return isUserPost;
    }
    debugLog('Author element not found');
    return false;
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
};

export async function main() {
  debugLog('Reddit main function called');
  let retries = 3;
  let userName = null;
  while (retries > 0 && userName === null) {
    userName = reddit.getUserName();
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
  const isUserPost = reddit.isUserPost(userName);
  debugLog(`Is user post: ${isUserPost}`);

  if (isUserPost) {
    debugLog('Current post is by the user');
    debugLog('Waiting for comments to load...');
    await reddit.waitForComments();
    debugLog('Comments loaded or timed out');
    debugLog('Scraping comments...');
    const comments = reddit.scrapeComments();
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
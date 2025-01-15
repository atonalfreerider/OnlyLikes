import { debugLog, filterComments, getUserThreshold, hideComment } from './common.js';

export const getUserName = () => {
  const userElement = document.querySelector('div[role="navigation"] span[dir="auto"]');
  return userElement ? userElement.textContent.trim() : null;
};

export const isUserPost = (userName) => {
  const authorElement = document.querySelector('h2[id^="mount_0_0_"] a');
  return authorElement && authorElement.textContent.trim() === userName;
};

export const scrapeComments = () => {
  const commentElements = document.querySelectorAll('div[aria-label="Comment"]');
  return Array.from(commentElements).map(comment => ({
    text: comment.querySelector('div[dir="auto"]').textContent,
    element: comment
  }));
};

export const waitForComments = () => {
  return new Promise((resolve) => {
    const checkComments = setInterval(() => {
      if (document.querySelector('div[aria-label="Comment"]')) {
        clearInterval(checkComments);
        resolve();
      }
    }, 1000);
  });
};

export const isNewCommentNode = (node) => {
  return node.matches('div[aria-label="Comment"]');
};

export const processNewComment = async (node) => {
  const textElement = node.querySelector('div[dir="auto"]');
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
  debugLog('Facebook main function called');
  const userName = getUserName();
  if (!userName) {
    debugLog('Failed to detect Facebook username');
    return;
  }

  debugLog(`Detected Facebook user name: ${userName}`);
  const userPost = isUserPost(userName);
  debugLog(`Is user post: ${userPost}`);

  if (userPost) {
    debugLog('Current Facebook post is by the user');
    await waitForComments();
    const comments = scrapeComments();
    if (comments.length > 0) {
      debugLog('Filtering Facebook comments...');
      const processedComments = await filterComments(comments);
      const threshold = await getUserThreshold();
      processedComments.forEach(comment => {
        if (comment.sentiment < threshold) {
          hideComment(comment.element);
        }
      });
    } else {
      debugLog('No Facebook comments found to filter');
    }
  } else {
    debugLog('Current Facebook post is not by the user');
  }
}

// Facebook-specific event listener
window.addEventListener('locationchange', main);
import { debugLog, filterComments, getUserThreshold, hideComment } from './common.js';

export const getUserName = () => {
  const userElement = document.querySelector('header section > div:nth-child(3) span');
  return userElement ? userElement.textContent.trim() : null;
};

export const isUserPost = (userName) => {
  const authorElement = document.querySelector('article header a');
  return authorElement && authorElement.textContent.trim() === userName;
};

export const scrapeComments = () => {
  const commentElements = document.querySelectorAll('ul > li:not(:first-child)');
  return Array.from(commentElements).map(comment => ({
    text: comment.querySelector('span').textContent,
    element: comment
  }));
};

export const waitForComments = () => {
  return new Promise((resolve) => {
    const checkComments = setInterval(() => {
      if (document.querySelector('ul > li:not(:first-child)')) {
        clearInterval(checkComments);
        resolve();
      }
    }, 1000);
  });
};

export const isNewCommentNode = (node) => {
  return node.matches('ul > li:not(:first-child)');
};

export const processNewComment = async (node) => {
  const textElement = node.querySelector('span');
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
  debugLog('Instagram main function called');
  const userName = getUserName();
  if (!userName) {
    debugLog('Failed to detect Instagram username');
    return;
  }

  debugLog(`Detected Instagram user name: ${userName}`);
  const userPost = isUserPost(userName);
  debugLog(`Is user post: ${userPost}`);

  if (userPost) {
    debugLog('Current Instagram post is by the user');
    await waitForComments();
    const comments = scrapeComments();
    if (comments.length > 0) {
      debugLog('Filtering Instagram comments...');
      const processedComments = await filterComments(comments);
      const threshold = await getUserThreshold();
      processedComments.forEach(comment => {
        if (comment.sentiment < threshold) {
          hideComment(comment.element);
        }
      });
    } else {
      debugLog('No Instagram comments found to filter');
    }
  } else {
    debugLog('Current Instagram post is not by the user');
  }
}

// Instagram-specific event listener
window.addEventListener('locationchange', main);
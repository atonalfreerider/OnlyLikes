import { debugLog, filterComments, getUserThreshold, hideComment } from './common.js';

export const getUserName = () => {
  const userElement = document.querySelector('#account-name');
  return userElement ? userElement.textContent.trim() : null;
};

export const isUserPost = (userName) => {
  const authorElement = document.querySelector('#owner-name a');
  return authorElement && authorElement.textContent.trim() === userName;
};

export const scrapeComments = () => {
  const commentElements = document.querySelectorAll('ytd-comment-thread-renderer');
  return Array.from(commentElements).map(comment => ({
    text: comment.querySelector('#content-text').textContent,
    element: comment
  }));
};

export const waitForComments = () => {
  return new Promise((resolve) => {
    const checkComments = setInterval(() => {
      if (document.querySelector('ytd-comment-thread-renderer')) {
        clearInterval(checkComments);
        resolve();
      }
    }, 1000);
  });
};

export const isNewCommentNode = (node) => {
  return node.matches('ytd-comment-thread-renderer');
};

export const processNewComment = async (node) => {
  const textElement = node.querySelector('#content-text');
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
  debugLog('YouTube main function called');
  const userName = getUserName();
  if (!userName) {
    debugLog('Failed to detect YouTube username');
    return;
  }

  debugLog(`Detected YouTube user name: ${userName}`);
  const userPost = isUserPost(userName);
  debugLog(`Is user post: ${userPost}`);

  if (userPost) {
    debugLog('Current YouTube post is by the user');
    await waitForComments();
    const comments = scrapeComments();
    if (comments.length > 0) {
      debugLog('Filtering YouTube comments...');
      const processedComments = await filterComments(comments);
      const threshold = await getUserThreshold();
      processedComments.forEach(comment => {
        if (comment.sentiment < threshold) {
          hideComment(comment.element);
        }
      });
    } else {
      debugLog('No YouTube comments found to filter');
    }
  } else {
    debugLog('Current YouTube post is not by the user');
  }
}

// YouTube-specific event listener
window.addEventListener('yt-navigate-finish', main);
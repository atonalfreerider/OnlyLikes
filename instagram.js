import { debugLog, filterComments, getUserThreshold, hideComment } from './common.js';

const instagram = {
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
};

async function main() {
  // Similar structure to reddit.js main function
}

export { instagram, main };
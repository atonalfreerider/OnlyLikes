(function(window) {
  const reddit = {
    getUserName: () => {
      window.debugLog('Getting Reddit username');
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
      window.debugLog(`Reddit username: ${username}`);
      return username;
    },

    isUserPost: (userName) => {
      window.debugLog('Checking if this is a user post on Reddit');
      const selectors = [
        'a[data-testid="post_author_link"]',
        'a[data-click-id="user"]',
        'div[data-testid="post-author-header"] a',
        '.top-matter .author',
        'span[class*="AuthorFlair"]',
        'a[href^="/user/"]'
      ];
      let authorElement = null;
      for (let selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (let element of elements) {
          if (element.textContent.includes(userName)) {
            authorElement = element;
            break;
          }
        }
        if (authorElement) break;
      }
      let authorName = authorElement ? authorElement.textContent.trim() : null;
      if (authorName) {
        const match = authorName.match(/u\/(\w+)/);
        if (match) {
          authorName = match[1];
        }
      }
      const isUserPost = authorName === userName;
      window.debugLog(`Author name: ${authorName}, User name: ${userName}, Is user post: ${isUserPost}`);
      return isUserPost;
    },

    waitForComments: () => {
      window.debugLog('Waiting for Reddit comments to load');
      return new Promise((resolve) => {
        const checkComments = setInterval(() => {
          const commentArea = document.querySelector('div[id^="t3_"]');
          const noComments = document.querySelector('div[id^="t3_"] span');
          if (commentArea || (noComments && noComments.textContent.includes("No Comments Yet"))) {
            clearInterval(checkComments);
            window.debugLog('Reddit comments loaded or no comments found');
            resolve();
          }
        }, 1000);

        setTimeout(() => {
          clearInterval(checkComments);
          window.debugLog('Timed out waiting for Reddit comments');
          resolve();
        }, 15000);
      });
    },

    scrapeComments: () => {
      window.debugLog('Scraping Reddit comments');
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
          window.debugLog(`Found comments using selector: ${selector}`);
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
        window.debugLog(`Extracted comment text: "${text.substring(0, 50)}..."`);
        return {
          text: text,
          element: comment
        };
      }).filter(comment => comment.text.trim() !== '');
      window.debugLog(`Scraped ${comments.length} Reddit comments`);
      return comments;
    },

    isNewCommentNode: (node) => {
      return node.matches('.Comment') || node.matches('[data-testid="comment"]') || 
             node.matches('.thing.comment') || node.matches('div[id^="t1_"]');
    },

    processNewComment: async (node) => {
      const textElement = node.querySelector('[data-testid="comment-top-meta"]') || 
                          node.querySelector('.RichTextJSON-root') || 
                          node.querySelector('.usertext-body') ||
                          node.querySelector('.md') ||
                          node.querySelector('p');
      const text = textElement ? textElement.textContent : '';
      if (text.trim() !== '') {
        const processedComments = await window.filterComments([{ text, element: node }]);
        const threshold = await window.getUserThreshold();
        if (processedComments[0].sentiment < threshold) {
          window.hideComment(node);
        }
      }
    },

    main: async function() {
      window.debugLog('Reddit main function called');
      let retries = 3;
      let userName = null;
      while (retries > 0 && userName === null) {
        userName = this.getUserName();
        window.debugLog(`Detected user name: ${userName}`);
        if (userName === null) {
          window.debugLog(`Failed to detect username, retrying... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          retries--;
        }
      }

      if (userName === null) {
        window.debugLog('Failed to detect username after all retries');
        return;
      }

      window.debugLog(`Final detected user name: ${userName}`);
      window.debugLog('Checking if this is a user post');
      const userPost = this.isUserPost(userName);
      window.debugLog(`Is user post: ${userPost}`);

      if (userPost) {
        window.debugLog('Current post is by the user');
        window.debugLog('Waiting for comments to load...');
        await this.waitForComments();
        window.debugLog('Comments loaded or timed out');
        window.debugLog('Scraping comments...');
        const comments = this.scrapeComments();
        window.debugLog(`Scraped ${comments.length} comments`);
        if (comments.length > 0) {
          window.debugLog('Comment preview:');
          comments.slice(0, 3).forEach((comment, index) => {
            window.debugLog(`Comment ${index + 1}: "${comment.text.substring(0, 50)}..."`);
          });
          window.debugLog('Filtering comments...');
          const processedComments = await window.filterComments(comments);
          const threshold = await window.getUserThreshold();
          processedComments.forEach(comment => {
            if (comment.sentiment < threshold) {
              window.hideComment(comment.element);
            }
          });
        } else {
          window.debugLog('No comments found to filter');
        }
      } else {
        window.debugLog('Current post is not by the user');
      }
    }
  };

  // Expose the reddit object to the global scope
  window.reddit = reddit;

})(window);

// Platform-specific event listener
window.addEventListener('locationchange', () => {
  if (window.reddit && typeof window.reddit.main === 'function') {
    window.reddit.main();
  }
});

// Custom event for single-page app
if (!window.pushStateListenerAdded) {
  let oldPushState = history.pushState;
  history.pushState = function pushState() {
    let ret = oldPushState.apply(this, arguments);
    window.dispatchEvent(new Event('locationchange'));
    return ret;
  };
  window.pushStateListenerAdded = true;
}

// Call main function when the script loads
if (window.reddit && typeof window.reddit.main === 'function') {
  window.reddit.main();
}
(function(window) {
  let messageId = 0;
  const pendingRequests = new Map();

  function sendRequest(action, data) {
    return new Promise((resolve, reject) => {
      const id = messageId++;
      pendingRequests.set(id, { resolve, reject });
      window.postMessage({ type: 'ONLYLIKES_REQUEST', id, action, ...data }, '*');
    });
  }

  const onlyLikes = {
    debugLog: (message) => sendRequest('debugLog', { message }),
    filterComments: (comments) => sendRequest('filterComments', { comments }),
    getUserThreshold: () => sendRequest('getUserThreshold'),
    hideComment: (id) => sendRequest('hideComment', { id }),
    showComment: (id) => sendRequest('showComment', { id })
  };

  const reddit = {
    getUserName: () => {
      onlyLikes.debugLog('Getting Reddit username');
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
      onlyLikes.debugLog(`Reddit username: ${username}`);
      return username;
    },

    isUserPost: (userName) => {
      onlyLikes.debugLog('Checking if this is a user post on Reddit');
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
      onlyLikes.debugLog(`Author name: ${authorName}, User name: ${userName}, Is user post: ${isUserPost}`);
      return isUserPost;
    },

    waitForComments: () => {
      onlyLikes.debugLog('Waiting for Reddit comments to load');
      return new Promise((resolve) => {
        const checkComments = setInterval(() => {
          const commentArea = document.querySelector('div[id^="t3_"]');
          const noComments = document.querySelector('div[id^="t3_"] span');
          if (commentArea || (noComments && noComments.textContent.includes("No Comments Yet"))) {
            clearInterval(checkComments);
            onlyLikes.debugLog('Reddit comments loaded or no comments found');
            resolve();
          }
        }, 1000);

        setTimeout(() => {
          clearInterval(checkComments);
          onlyLikes.debugLog('Timed out waiting for Reddit comments');
          resolve();
        }, 15000);
      });
    },

    hideAllComments: () => {
      onlyLikes.debugLog('Hiding all comments');
      const commentSelectors = [
        '.Comment', 
        '[data-testid="comment"]', 
        '.sitetable.nestedlisting > .thing.comment',
        'div[id^="t1_"]'
      ];
      commentSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(comment => {
          onlyLikes.hideComment(comment.id);
        });
      });
    },

    scrapeComments: () => {
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
        return {
          text: text,
          id: comment.id
        };
      }).filter(comment => comment.text.trim() !== '');      
      return comments;
    },

    main: async function() {
      try {        
        // Hide all comments immediately
        this.hideAllComments();

        let retries = 3;
        let userName = null;
        while (retries > 0 && userName === null) {
          userName = this.getUserName();
          onlyLikes.debugLog(`Detected user name: ${userName}`);
          if (userName === null) {
            onlyLikes.debugLog(`Failed to detect username, retrying... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            retries--;
          }
        }

        if (userName === null) {
          onlyLikes.debugLog('Failed to detect username after all retries');
          return;
        }

        onlyLikes.debugLog(`Final detected user name: ${userName}`);
        onlyLikes.debugLog('Checking if this is a user post');
        const userPost = this.isUserPost(userName);
        onlyLikes.debugLog(`Is user post: ${userPost}`);

        if (userPost) {
          onlyLikes.debugLog('Current post is by the user');
          await this.waitForComments();
          
          // Hide all comments again to catch any that loaded after the initial hide
          this.hideAllComments();
          
          const comments = this.scrapeComments();
          if (comments.length > 0) {
            const processedComments = await onlyLikes.filterComments(comments);
            const threshold = await onlyLikes.getUserThreshold();
            processedComments.forEach(comment => {
              if (comment.sentiment >= threshold) {
                onlyLikes.showComment(comment.id);
              }
            });
          } else {
            onlyLikes.debugLog('No comments found to filter');
          }
        } else {
          onlyLikes.debugLog('Current post is not by the user');
        }
      } catch (error) {
        console.error('Error in reddit.main():', error);
      }
    }
  };

  // Expose the reddit object to the global scope
  window.reddit = reddit;

  // Listen for messages from the content script
  window.addEventListener('message', function(event) {
    if (event.source != window) return;

    if (event.data.type === 'ONLYLIKES_INIT' && event.data.platform === 'reddit') {
      reddit.hideAllComments(); // Hide all comments immediately when the script initializes
      reddit.main().catch(error => {
        console.error('Error in reddit.main():', error);
      });
    } else if (event.data.type === 'ONLYLIKES_RESPONSE') {
      const request = pendingRequests.get(event.data.id);
      if (request) {
        request.resolve(event.data.result);
        pendingRequests.delete(event.data.id);
      }
    }
  });

  // Immediately hide all comments when the script loads
  reddit.hideAllComments();

})(window);
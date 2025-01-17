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

  const facebook = {
    getUserName: () => {
      const userElement = document.querySelector('div[role="navigation"] span[dir="auto"]');
      return userElement ? userElement.textContent.trim() : null;
    },

    isUserPost: (userName) => {
      const authorElement = document.querySelector('h2[id^="mount_0_0_"] a');
      return authorElement && authorElement.textContent.trim() === userName;
    },

    waitForComments: () => {
      return new Promise((resolve) => {
        const checkComments = setInterval(() => {
          if (document.querySelector('div[aria-label="Comment"]')) {
            clearInterval(checkComments);
            resolve();
          }
        }, 1000);

        setTimeout(() => {
          clearInterval(checkComments);
          resolve();
        }, 15000);
      });
    },

    hideAllComments: () => {
      onlyLikes.debugLog('Hiding all comments');
      const commentElements = document.querySelectorAll('div[aria-label="Comment"]');
      commentElements.forEach(comment => {
        if (!comment.id) {
          comment.id = `facebook-comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
        onlyLikes.hideComment(comment.id);
      });
    },

    scrapeComments: () => {
      const commentElements = document.querySelectorAll('div[aria-label="Comment"]');
      return Array.from(commentElements).map(comment => {
        const textElement = comment.querySelector('div[dir="auto"]');
        const text = textElement ? textElement.textContent.trim() : '';
        if (!comment.id) {
          comment.id = `facebook-comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
        return {
          text: text,
          id: comment.id
        };
      }).filter(comment => comment.text !== '');
    },

    main: async function() {
      try {
        // Hide all comments immediately
        this.hideAllComments();

        let retries = 3;
        let userName = null;
        while (retries > 0 && userName === null) {
          userName = this.getUserName();
          if (userName === null) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            retries--;
          }
        }

        if (userName === null) {
          onlyLikes.debugLog('Failed to detect Facebook username');
          return;
        }

        const userPost = this.isUserPost(userName);

        if (userPost) {
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
          }
        }
      } catch (error) {
        console.error('Error in facebook.main():', error);
      }
    }
  };

  // Expose the facebook object to the global scope
  window.facebook = facebook;

  // Listen for messages from the content script
  window.addEventListener('message', function(event) {
    if (event.source != window) return;

    if (event.data.type === 'ONLYLIKES_INIT' && event.data.platform === 'facebook') {
      facebook.main().catch(error => {
        onlyLikes.debugLog(`Error in facebook.main(): ${error.message}`);
        onlyLikes.debugLog(`Error stack: ${error.stack}`);
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
  facebook.hideAllComments();

})(window);
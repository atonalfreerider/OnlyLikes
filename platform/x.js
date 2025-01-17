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

  const x = {
    getUserName: () => {      
      const methods = [      
        // Get username from profile link
        () => {
          const profileLink = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
          if (profileLink) {
            const href = profileLink.getAttribute('href');
            return href ? href.split('/').pop() : null;
          }
          return null;
        }
      ];

      for (let method of methods) {
        const username = method();
        if (username) {
          return username;
        }
      }

      onlyLikes.debugLog('Failed to detect X username');
      return null;
    },

    isUserPost: (userName) => {
      const methods = [
        // Check URL path
        () => {
          const path = window.location.pathname;
          const match = path.match(/^\/([^/]+)\/status\//);
          if (match) {
            const authorFromPath = match[1];
            return authorFromPath.toLowerCase() === userName.toLowerCase();
          }
          return false;
        }
      ];

      for (let method of methods) {
        const isMatch = method();
        if (isMatch) {
          onlyLikes.debugLog(`User post confirmed for: ${userName}`);
          return true;
        }
      }

      onlyLikes.debugLog(`Not a user post for: ${userName}`);
      return false;
    },

    waitForComments: () => {
      return new Promise((resolve) => {
        const checkComments = setInterval(() => {
          if (document.querySelector('article[data-testid="tweet"]')) {
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
      const comments = document.querySelectorAll('article[data-testid="tweet"]:not([tabindex="-1"])');
      comments.forEach(comment => {
        if (!comment.id) {
          comment.id = `x-comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
        onlyLikes.hideComment(comment.id);
      });
    },

    showComment: (commentElement, sentiment, threshold) => {
      if (commentElement) {
        if (sentiment >= threshold) {
          onlyLikes.debugLog(`Showing X comment with sentiment ${sentiment} (threshold: ${threshold})`);
          commentElement.setAttribute('data-onlylikes-shown', 'true');
        } else {
          onlyLikes.debugLog(`Hiding X comment with sentiment ${sentiment} (threshold: ${threshold})`);
          commentElement.removeAttribute('data-onlylikes-shown');
        }
      }
    },

    scrapeComments: () => {
      const commentElements = document.querySelectorAll('article[data-testid="tweet"]:not([tabindex="-1"])');
      const comments = Array.from(commentElements).map(comment => {
        const textElement = comment.querySelector('div[data-testid="tweetText"]');
        const text = textElement ? textElement.textContent.trim() : '';
        if (!comment.id) {
          comment.id = `x-comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
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
        console.error('Error in x.main():', error);
      }
    }
  };

  // Expose the x object to the global scope
  window.x = x;

  // Listen for messages from the content script
  window.addEventListener('message', function(event) {
    if (event.source != window) return;

    if (event.data.type === 'ONLYLIKES_INIT' && event.data.platform === 'x') {
      x.main().catch(error => {
        onlyLikes.debugLog(`Error in x.main(): ${error.message}`);
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
  x.hideAllComments();

})(window);
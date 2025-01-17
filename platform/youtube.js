(function (window) {
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

  const youtube = {
    getUserName: () => {
      const methods = [
        // Method 1: Parse from script tag (as seen in the example)
        () => {
          const scripts = document.getElementsByTagName('script');
          for (let script of scripts) {
            if (script.textContent.includes('INNERTUBE_CONTEXT')) {
              const match = script.textContent.match(/"username":"([^"]+)"/);
              return match ? match[1] : null;
            }
          }
          return null;
        },
        // Method 2: Scrape from the DOM and read the alt text
        () => {
          const authorThumbnail = document.querySelector('#author-thumbnail img');
          return authorThumbnail ? authorThumbnail.alt : null;
        }
      ];

      for (let method of methods) {
        const username = method();
        if (username) {
          return username;
        }
      }

      onlyLikes.debugLog('Failed to find YouTube username');
      return null;
    },
    getPostAuthor: () => {
      const methods = [
        // Method 1: Check for the span with itemprop="author"
        () => {
          const authorSpan = document.querySelector('span[itemprop="author"]');
          if (authorSpan) {
            const nameLink = authorSpan.querySelector('link[itemprop="name"]');
            return nameLink ? nameLink.getAttribute('content') : null;
          }
          return null;
        },
        // Method 2: Check for channel name in the page
        () => {
          const channelNameElement = document.querySelector('#text-container.ytd-channel-name yt-formatted-string');
          return channelNameElement ? channelNameElement.textContent.trim() : null;
        }
      ];
      for (let method of methods) {
        const username = method();
        if (username) {
          return username;
        }
      }

      onlyLikes.debugLog('Failed to find YouTube post author');
      return author;
    },
    isUserPost: (userName) => {
      const postAuthor = youtube.getPostAuthor();
      if (!userName || !postAuthor) return false;
      const normalizedUserName = userName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const normalizedPostAuthor = postAuthor.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const isUserPost = normalizedUserName.includes(normalizedPostAuthor) || normalizedPostAuthor.includes(normalizedUserName);
      onlyLikes.debugLog(`User name: ${userName}, Post author: ${postAuthor}, Is user post: ${isUserPost}`);
      return isUserPost;
    },
    waitForComments: () => {
      return new Promise((resolve) => {
        if (document.querySelector('#comments #contents')) {
          resolve();
          return;
        }

        const observer = new MutationObserver((mutations, obs) => {
          if (document.querySelector('#comments #contents')) {
            obs.disconnect();
            resolve();
          }
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true,
        });
      });
    },
    hideAllComments: () => {
      const existingStyle = document.querySelector('style[data-onlylikes]');
      if (existingStyle) existingStyle.remove();
      
      const style = document.createElement('style');
      style.setAttribute('data-onlylikes', 'true');
      style.textContent = `
        ytd-comment-thread-renderer {
          display: none;
        }
      `;
      document.head.appendChild(style);
    },
    showComment: (commentElement, sentiment, threshold) => {
      if (commentElement) {
        if (sentiment >= threshold) {
          onlyLikes.debugLog(`Showing comment ${commentElement.id} with sentiment ${sentiment} (threshold: ${threshold})`);
          commentElement.style.setProperty('display', 'block', 'important');
        } else {
          onlyLikes.debugLog(`Hiding comment ${commentElement.id} with sentiment ${sentiment} (threshold: ${threshold})`);
          commentElement.style.setProperty('display', 'none', 'important');
        }
      }
    },
    showAllComments: () => {
      const style = document.querySelector('style[data-onlylikes]');
      if (style) style.remove();
    },
    scrapeComments: () => {
      const commentElements = document.querySelectorAll('ytd-comment-thread-renderer:not([data-onlylikes-processed])');
      const comments = Array.from(commentElements).map(comment => {
        const contentElement = comment.querySelector('#content-text');
        const text = contentElement ? contentElement.textContent.trim() : '';
        comment.setAttribute('data-onlylikes-processed', 'true');
        comment.id = comment.id || `youtube-comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        return {
          text: text,
          id: comment.id
        };
      }).filter(comment => comment.text !== '');
      return comments;
    },
    main: async function () {
      try {

        // Hide all comments immediately
        this.hideAllComments();

        let retries = 10;
        let userName = null;
        while (retries > 0 && userName === null) {
          userName = this.getUserName();
          if (userName === null) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            retries--;
          }
        }

        if (userName === null) {
          this.showAllComments();
          return;
        }

        const userPost = this.isUserPost(userName);

        if (userPost) {
          await this.waitForComments();
          
          // Process comments only once
          const comments = this.scrapeComments();
          if (comments.length > 0) {
            const processedComments = await onlyLikes.filterComments(comments);
            const threshold = await onlyLikes.getUserThreshold();
            
            processedComments.forEach(comment => {
              const commentElement = document.getElementById(comment.id);
              if (commentElement && !commentElement.hasAttribute('data-onlylikes-handled')) {
                this.showComment(commentElement, comment.sentiment, threshold);
                commentElement.setAttribute('data-onlylikes-handled', 'true');
              }
            });
          }
        } else {
          this.showAllComments();
        }
      } catch (error) {
        onlyLikes.debugLog(`Error in youtube.main(): ${error.message}`);
        onlyLikes.debugLog(`Error stack: ${error.stack}`);
        this.showAllComments();
      }
    }
  };

  // Expose the youtube object to the global scope
  window.youtube = youtube;

  // Listen for messages from the content script
  window.addEventListener('message', function (event) {
    if (event.source != window) return;

    if (event.data.type === 'ONLYLIKES_INIT' && event.data.platform === 'youtube') {      
      youtube.main().catch(error => {
        onlyLikes.debugLog(`Error in youtube.main(): ${error.message}`);
        onlyLikes.debugLog(`Error stack: ${error.stack}`);
        youtube.showAllComments();
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
  youtube.hideAllComments();

})(window);
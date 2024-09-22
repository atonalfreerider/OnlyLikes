(function(window) {
  console.log('YouTube script starting execution');
  
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
      onlyLikes.debugLog('Getting YouTube username');
      
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
        },
        // Method 3: Check for account name in the top bar
        () => {
          const accountNameElement = document.querySelector('yt-formatted-string#account-name');
          return accountNameElement ? accountNameElement.textContent.trim() : null;
        },
        // Method 4: Check for avatar button title
        () => {
          const avatarButton = document.querySelector('#avatar-btn');
          return avatarButton ? avatarButton.getAttribute('aria-label').replace('Avatar for ', '') : null;
        },
        // Method 5: Parse from script tag (as seen in the example)
        () => {
          const scripts = document.getElementsByTagName('script');
          for (let script of scripts) {
            if (script.textContent.includes('INNERTUBE_CONTEXT')) {
              const match = script.textContent.match(/"username":"([^"]+)"/);
              return match ? match[1] : null;
            }
          }
          return null;
        }
      ];

      for (let method of methods) {
        const username = method();
        if (username) {
          onlyLikes.debugLog(`YouTube username found: ${username}`);
          return username;
        }
      }
      
      onlyLikes.debugLog('Failed to find YouTube username');
      return null;
    },
    getPostAuthor: () => {
      onlyLikes.debugLog('Getting YouTube post author');
      const authorElement = document.querySelector('#text-container.ytd-channel-name a');
      const author = authorElement ? authorElement.textContent.trim() : null;
      onlyLikes.debugLog(`YouTube post author: ${author}`);
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
      onlyLikes.debugLog('Waiting for YouTube comments to load');
      return new Promise((resolve) => {
        const checkComments = setInterval(() => {
          if (document.querySelector('#comments #contents')) {
            clearInterval(checkComments);
            onlyLikes.debugLog('YouTube comments section found');
            resolve();
          }
        }, 1000);

        setTimeout(() => {
          clearInterval(checkComments);
          onlyLikes.debugLog('Timed out waiting for YouTube comments section');
          resolve();
        }, 15000);
      });
    },
    hideAllComments: () => {
      onlyLikes.debugLog('Hiding all YouTube comments');
      const style = document.createElement('style');
      style.textContent = `
        ytd-comment-thread-renderer {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
    },
    showAllComments: () => {
      onlyLikes.debugLog('Showing all YouTube comments');
      const style = document.querySelector('style[data-onlylikes]');
      if (style) style.remove();
    },
    scrapeComments: () => {
      onlyLikes.debugLog('Scraping YouTube comments');
      const commentElements = document.querySelectorAll('ytd-comment-thread-renderer:not([data-onlylikes-processed])');
      const comments = Array.from(commentElements).map(comment => {
        const contentElement = comment.querySelector('#content-text');
        const text = contentElement ? contentElement.textContent.trim() : '';
        onlyLikes.debugLog(`Extracted comment text: "${text.substring(0, 50)}..."`);
        comment.setAttribute('data-onlylikes-processed', 'true');
        return {
          text: text,
          id: comment.id || `youtube-comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };
      }).filter(comment => comment.text !== '');
      onlyLikes.debugLog(`Scraped ${comments.length} new YouTube comments`);
      return comments;
    },
    observeComments: (callback) => {
      const commentsSection = document.querySelector('#comments #contents');
      if (!commentsSection) {
        onlyLikes.debugLog('Comments section not found for observation');
        return;
      }

      const observer = new MutationObserver((mutations) => {
        let newCommentsAdded = false;
        for (let mutation of mutations) {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            newCommentsAdded = true;
            break;
          }
        }
        if (newCommentsAdded) {
          onlyLikes.debugLog('New comments detected, re-scraping');
          const newComments = youtube.scrapeComments();
          if (newComments.length > 0) {
            callback(newComments);
          }
        }
      });

      observer.observe(commentsSection, { childList: true, subtree: true });
      onlyLikes.debugLog('Comment observer started');
    },
    main: async function() {
      try {
        console.log('YouTube main function called');
        onlyLikes.debugLog('YouTube main function called');
        
        // Hide all comments immediately
        this.hideAllComments();

        let retries = 10;
        let userName = null;
        while (retries > 0 && userName === null) {
          userName = this.getUserName();
          onlyLikes.debugLog(`Detected user name: ${userName}`);
          if (userName === null) {
            onlyLikes.debugLog(`Failed to detect username, retrying... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            retries--;
          }
        }

        if (userName === null) {
          onlyLikes.debugLog('Failed to detect username after all retries');
          this.showAllComments();
          return;
        }

        onlyLikes.debugLog(`Final detected user name: ${userName}`);
        onlyLikes.debugLog('Checking if this is a user post');
        const userPost = this.isUserPost(userName);
        onlyLikes.debugLog(`Is user post: ${userPost}`);

        if (userPost) {
          onlyLikes.debugLog('Current post is by the user');
          onlyLikes.debugLog('Waiting for comments to load...');
          await this.waitForComments();
          onlyLikes.debugLog('Comments loaded or timed out');
          
          onlyLikes.debugLog('Scraping comments...');
          const comments = this.scrapeComments();
          onlyLikes.debugLog(`Scraped ${comments.length} comments`);
          if (comments.length > 0) {
            onlyLikes.debugLog('Comment preview:');
            comments.slice(0, 3).forEach((comment, index) => {
              onlyLikes.debugLog(`Comment ${index + 1}: "${comment.text.substring(0, 50)}..."`);
            });
            onlyLikes.debugLog('Filtering comments...');
            const processedComments = await onlyLikes.filterComments(comments);
            const threshold = await onlyLikes.getUserThreshold();
            processedComments.forEach(comment => {
              const commentElement = document.getElementById(comment.id);
              if (commentElement) {
                if (comment.sentiment >= threshold) {
                  commentElement.style.display = ''; // Show the comment
                } else {
                  commentElement.style.display = 'none'; // Keep the comment hidden
                }
              }
            });
          } else {
            onlyLikes.debugLog('No comments found to filter');
          }
        } else {
          onlyLikes.debugLog('Current post is not by the user');
          this.showAllComments();
        }
      } catch (error) {
        console.error('Error in youtube.main():', error);
        onlyLikes.debugLog(`Error in youtube.main(): ${error.message}`);
        onlyLikes.debugLog(`Error stack: ${error.stack}`);
        this.showAllComments();
      }
    }
  };

  // Expose the youtube object to the global scope
  window.youtube = youtube;

  // Listen for messages from the content script
  window.addEventListener('message', function(event) {
    if (event.source != window) return;

    console.log('YouTube script received message:', event.data);

    if (event.data.type === 'ONLYLIKES_INIT' && event.data.platform === 'youtube') {
      console.log('Initializing YouTube script');
      onlyLikes.debugLog('Initializing YouTube script');
      youtube.main().catch(error => {
        console.error('Error in youtube.main():', error);
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

  console.log('YouTube script finished loading');

})(window);
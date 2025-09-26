(function(window) {
  let messageId = 0;
  const pendingRequests = new Map();

  function sendRequest(action, data = {}) {
    return new Promise((resolve, reject) => {
      const id = messageId++;
      pendingRequests.set(id, { resolve, reject });
      const payload = { type: 'ONLYLIKES_REQUEST', id, action };
      Object.entries(data).forEach(([key, value]) => {
        payload[key === 'id' ? 'targetId' : key] = value;
      });
      window.postMessage(payload, '*');
    });
  }

  function ensureCommentId(element) {
    if (!element) return null;
    if (element.id) return element.id;
    const generatedId = `onlylikes-comment-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
    element.id = generatedId;
    return generatedId;
  }

  const COMMENT_SELECTORS = [
    '.Comment',
    '[data-testid="comment"]',
    '.sitetable.nestedlisting > .thing.comment',
    'div[id^="t1_"]'
  ];

  function normalizeCommentId(rawId) {
    return rawId ? rawId.replace(/-(comment|post)-rtjson-content$/, '') : null;
  }

  function collectCommentElements() {
    const seen = new Set();
    const elements = [];
    COMMENT_SELECTORS.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        const id = ensureCommentId(element);
        const normalized = normalizeCommentId(id);
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        elements.push(element);
      });
    });
    return elements;
  }

  function extractCommentText(comment) {
    const textElement =
      comment.querySelector('[data-testid="comment-top-meta"]') ||
      comment.querySelector('.RichTextJSON-root') ||
      comment.querySelector('.usertext-body') ||
      comment.querySelector('.md') ||
      comment.querySelector('p');
    return textElement ? textElement.textContent : '';
  }

  const onlyLikes = {
    debugLog: (message) => sendRequest('debugLog', { message }),
    filterComments: (comments) => sendRequest('filterComments', { comments }),
    getUserThreshold: () => sendRequest('getUserThreshold'),
    hideComment: (id) => sendRequest('hideComment', { targetId: id }),
    showComment: (id) => sendRequest('showComment', { targetId: id })
  };

  const reddit = {
    getUserName: () => {
      const selectors = [
        'span[class*="AccountSwitcher"]',
        'a[href^="/user/"]',
        '#header-bottom-right .user a',
        'div[data-testid="reddit-header"] a[href^="/user/"]',
        'rs-current-user', // Existing selector
        '[username]',      // New selector for username attribute
        '[display-name]'   // New selector for display-name attribute
      ];
      let username = null;
      for (let selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          if (selector === 'rs-current-user') {
            username = element.getAttribute('display-name');
          } else if (selector === '[username]' || selector === '[display-name]') {
            username = element.getAttribute(selector.replace('[', '').replace(']', ''));
          } else {
            const match = element.textContent.match(/u\/(\w+)/);
            if (match) {
              username = match[1];
            }
          }
          if (username) break;
        }
      }
      
      // Additional fallback: Check global variables or scripts
      if (!username) {
        const scriptTags = document.querySelectorAll('script');
        scriptTags.forEach(script => {
          const match = script.textContent.match(/"username":"(\w+)"/);
          if (match) {
            username = match[1];
          }
        });
      }

      return username;
    },

    isUserPost: (userName) => {
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
      return new Promise((resolve) => {
        const checkComments = setInterval(() => {
          const commentArea = document.querySelector('div[id^="t3_"]');
          const noComments = document.querySelector('div[id^="t3_"] span');
          if (commentArea || (noComments && noComments.textContent.includes("No Comments Yet"))) {
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
      collectCommentElements().forEach(comment => {
        const targetId = ensureCommentId(comment);
        if (targetId) {
          onlyLikes.hideComment(targetId);
        }
      });
    },

    scrapeComments: () => {
      const comments = collectCommentElements().map(comment => {
        const rawId = ensureCommentId(comment);
        const text = extractCommentText(comment);
        return { text, id: rawId };
      }).filter(comment => comment.id && comment.text.trim() !== '');
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

      // Handle sentiment response
      if (event.data.hash) {
        window.onlyLikes.showCommentByHash(event.data.hash);
      }
    }
  });

  // Immediately hide all comments when the script loads
  reddit.hideAllComments();

})(window);
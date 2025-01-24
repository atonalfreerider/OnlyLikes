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

  const instagram = {
    mutationObserver: null,
    
    setupMutationObserver: function() {
      if (this.mutationObserver) {
        this.mutationObserver.disconnect();
      }
      
      this.mutationObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            this.handleNewContent(mutation.addedNodes);
          }
        }
      });

      const config = { 
        childList: true, 
        subtree: true,
        attributes: true,
        characterData: true
      };
      
      const observeTargets = [
        document.body,
        document.querySelector('main'),
        document.querySelector('article')
      ].filter(Boolean);
      
      observeTargets.forEach(target => {
        if (target) this.mutationObserver.observe(target, config);
      });
    },

    handleNewContent: function(nodes) {
      nodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const comments = node.querySelectorAll('ul > li:not(:first-child), ul[role="list"] > li');
          if (comments.length > 0) {
            this.hideAllComments();
            if (this.isUserPost(this.lastUserName)) {
              this.processNewComments(Array.from(comments));
            }
          }
        }
      });
    },

    processNewComments: async function(comments) {
      const processedComments = await onlyLikes.filterComments(
        comments.map(comment => {
          if (!comment.id) {
            comment.id = `instagram-comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          }
          return {
            text: comment.querySelector('span[role="text"], span:not([role])')?.textContent?.trim() || '',
            id: comment.id
          };
        }).filter(c => c.text !== '')
      );

      const threshold = await onlyLikes.getUserThreshold();
      processedComments.forEach(comment => {
        if (comment.sentiment >= threshold) {
          onlyLikes.showComment(comment.id);
        }
      });
    },

    getUserName: async () => {
      const selectors = [
        // Direct handle containers
        'div._aa_c',
        'h2._aacl._aacs._aact._aacx._aada',
        // Link-based handles
        'a[href^="/"]:not([href*="direct"]):not([href*="explore"])',
        // Meta tags
        'meta[property="og:title"]',
        'meta[name="twitter:title"]'
      ];

      const cleanUsername = (text) => {
        if (!text) return '';
        
        // Try to extract handle from URL first
        if (text.startsWith('/')) {
          const handle = text.split('/')[1];
          if (handle && !/^(p|direct|explore)$/.test(handle)) {
            return handle;
          }
        }

        // Clean up various formats
        text = text
          .replace(/^@/, '')
          .replace(/ on Instagram.*$/, '')
          .replace(/•.*$/, '')
          .replace(/'s profile picture$/, '')
          .replace(/ \(.*?\)$/, '')
          .trim();

        // If there's a space, take the part that looks most like a handle
        if (text.includes(' ')) {
          const parts = text.split(' ');
          const possibleHandle = parts.find(part => 
            /^[a-zA-Z0-9._]{3,30}$/.test(part) && 
            !/^(the|and|or|profile|photo|post)$/i.test(part)
          );
          if (possibleHandle) return possibleHandle;
        }

        return text;
      };
      
      for (let attempt = 0; attempt < 3; attempt++) {
        for (const selector of selectors) {
          try {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
              let text;
              if (element.tagName === 'META') {
                text = element.getAttribute('content');
              } else if (element.tagName === 'A') {
                text = element.getAttribute('href');
              } else {
                text = element.textContent;
              }
              
              const username = cleanUsername(text);
              if (username && /^[a-zA-Z0-9._]{3,30}$/.test(username)) {
                onlyLikes.debugLog(`Found handle via ${selector}: ${username}`);
                return username;
              }
            }
          } catch (e) {
            onlyLikes.debugLog(`Error with selector ${selector}: ${e.message}`);
          }
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      return null;
    },

    isUserPost: (userName) => {
      if (!userName) {
        onlyLikes.debugLog('No username provided to isUserPost');
        return false;
      }
      
      const selectors = [
        // New specific class selectors
        'h2.x1lliihq span.x1lliihq',
        'h2[class*="x1lliihq"] span[class*="x1lliihq"]',
        // Image alt text containing username
        'img[alt*="profile picture"]',
        // Classic selectors
        'article header a[role="link"]',
        'header a[role="link"][tabindex="0"]',
        'h2 a[role="link"]'
      ];
      
      for (const selector of selectors) {
        try {
          const authorElements = document.querySelectorAll(selector);
          for (const element of authorElements) {
            let authorName = '';
            if (element.tagName.toLowerCase() === 'img') {
              // Extract username from alt text like "username's profile picture"
              authorName = element.alt.split("'")[0].trim();
            } else {
              authorName = element.textContent.trim();
            }
            
            // Clean up the username
            authorName = authorName
              .replace(/^@/, '')
              .split('•')[0]
              .split(' ')[0]
              .replace(/^\(|\)$/g, '')
              .trim();

            if (authorName === userName) {
              onlyLikes.debugLog(`Found matching post author: ${authorName} (selector: ${selector})`);
              return true;
            }
          }
        } catch (e) {
          onlyLikes.debugLog(`Error in isUserPost with selector ${selector}: ${e.message}`);
        }
      }
      onlyLikes.debugLog(`No matching post author found for username: ${userName}`);
      return false;
    },

    waitForComments: () => {
      return new Promise((resolve) => {
        const selectors = [
          'ul > li:not(:first-child)',
          'ul[role="list"] > li',
          'div[role="dialog"] ul > li'
        ];
        
        const checkComments = setInterval(() => {
          for (const selector of selectors) {
            if (document.querySelector(selector)) {
              clearInterval(checkComments);
              resolve();
              return;
            }
          }
        }, 500);

        setTimeout(() => {
          clearInterval(checkComments);
          resolve();
        }, 15000);
      });
    },

    hideAllComments: () => {
      onlyLikes.debugLog('Attempting to hide comments');
      
      // First try to find the main comments container
      const mainContainers = [
        'div[class*="x78zum5"][class*="xdt5ytf"][class*="x1iyjqo2"]',
        'div[class*="x9f619"][class*="x78zum5"]',
        'ul[class*="x78zum5"]'
      ];

      // Create style element for enforced hiding
      const style = document.createElement('style');
      style.id = 'onlylikes-hide-comments';
      style.textContent = `
        /* Hide comment containers */
        div[class*="x78zum5"][class*="xdt5ytf"] > div:not(:first-child),
        div[class*="x9f619"] > div[class*="x78zum5"]:not(:first-child),
        ul[class*="x78zum5"] > li:not(:first-child) {
          display: none !important;
          visibility: hidden !important;
          height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          opacity: 0 !important;
          pointer-events: none !important;
          position: absolute !important;
          overflow: hidden !important;
        }
      `;
      
      // Remove existing style if present
      const existingStyle = document.getElementById('onlylikes-hide-comments');
      if (existingStyle) {
        existingStyle.remove();
      }
      document.head.appendChild(style);

      let hiddenCount = 0;
      mainContainers.forEach(selector => {
        const containers = document.querySelectorAll(selector);
        containers.forEach(container => {
          try {
            // Hide all child elements except the first one (usually post content)
            const comments = container.querySelectorAll(':scope > div:not(:first-child), :scope > li:not(:first-child)');
            comments.forEach(comment => {
              if (!comment.id) {
                comment.id = `instagram-comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              }
              comment.style.setProperty('display', 'none', 'important');
              comment.style.setProperty('visibility', 'hidden', 'important');
              comment.style.setProperty('height', '0', 'important');
              comment.style.setProperty('opacity', '0', 'important');
              onlyLikes.hideComment(comment.id);
              hiddenCount++;
            });
          } catch (e) {
            onlyLikes.debugLog(`Error hiding comments in container: ${e.message}`);
          }
        });
      });

      onlyLikes.debugLog(`Hidden ${hiddenCount} comments using new selectors`);
    },

    scrapeComments: () => {
      const commentSelectors = [
        // Comment containers
        'div[class*="x9f619"] div[class*="x78zum5"] div[class*="xdt5ytf"] div[class*="x1iyjqo2"]',
        // Individual comments
        'div[class*="x1lliihq"] span[class*="x193iq5w"]',
        // Comment text spans
        'span._ap3a._aaco._aacw._aacx._aad7._aade',
        // Legacy selectors as fallback
        'ul > li div[role="menuitem"]',
        'ul[role="list"] > li'
      ];
      
      let comments = [];
      commentSelectors.forEach(selector => {
        const commentElements = document.querySelectorAll(selector);
        comments = comments.concat(Array.from(commentElements).map(comment => {
          // Get the comment text from the specific span structure
          const textElement = comment.querySelector('span[class*="x193iq5w"], span._ap3a._aaco._aacw._aacx._aad7._aade');
          const text = textElement ? textElement.textContent.trim() : '';
          
          // Generate a unique ID if none exists
          if (!comment.id) {
            comment.id = `instagram-comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          }
          
          return {
            text: text,
            id: comment.id
          };
        }).filter(comment => comment.text !== ''));
      });
      
      onlyLikes.debugLog(`Found ${comments.length} comments to process`);
      return comments;
    },

    main: async function() {
      try {
        // Remove scroll handlers and error handlers
        window.onbeforeunload = null;
        window.onunload = null;
        window.onerror = null;
        
        // Initial setup
        this.setupMutationObserver();
        this.hideAllComments();
        
        // Wait for page load
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get username with retries
        let userName = null;
        for (let i = 0; i < 3; i++) {
          userName = await this.getUserName();
          if (userName) break;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (!userName) {
          onlyLikes.debugLog('Username detection failed - retrying with forced scroll');
          // One last attempt with minimal scroll
          window.scrollTo(0, 50);
          await new Promise(resolve => setTimeout(resolve, 500));
          window.scrollTo(0, 0);
          userName = await this.getUserName();
        }

        if (!userName) {
          onlyLikes.debugLog('Failed to detect username - giving up');
          return;
        }

        onlyLikes.debugLog(`Successfully found username: ${userName}`);
        this.lastUserName = userName;
        
        // Process post if it belongs to user
        if (this.isUserPost(userName)) {
          onlyLikes.debugLog('Processing user post');
          await this.waitForComments();
          this.hideAllComments();
          
          const comments = this.scrapeComments();
          if (comments.length > 0) {
            onlyLikes.debugLog(`Processing ${comments.length} comments`);
            await this.processNewComments(comments);
          }
        } else {
          onlyLikes.debugLog('Not a user post - hiding all comments');
          this.hideAllComments();
        }
      } catch (error) {
        onlyLikes.debugLog(`Main error: ${error.message}`);
        // Retry with delay
        setTimeout(() => this.main(), 3000);
      }
    }
  };

  window.instagram = instagram;

  window.addEventListener('message', function(event) {
    if (event.source != window) return;

    if (event.data.type === 'ONLYLIKES_INIT' && event.data.platform === 'instagram') {
      instagram.main().catch(error => {
        onlyLikes.debugLog(`Error in instagram.main(): ${error.message}`);
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

  instagram.hideAllComments();

})(window);
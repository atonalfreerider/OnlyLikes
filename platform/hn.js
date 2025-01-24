
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

  const hn = {
    getUserName: () => {
      const meLink = document.getElementById('me');
      return meLink ? meLink.textContent.trim() : null;
    },
    isUserPost: (userName) => {
      const authorLink = document.querySelector('.subtext .hnuser');
      const postAuthor = authorLink ? authorLink.textContent.trim() : null;
      return postAuthor && userName && postAuthor.toLowerCase() === userName.toLowerCase();
    },
    waitForComments: () => {
      return new Promise((resolve) => {
        const check = setInterval(() => {
          const commentTree = document.querySelector('.comment-tree');
          if (commentTree) {
            clearInterval(check);
            resolve();
          }
        }, 1000);
        setTimeout(() => { clearInterval(check); resolve(); }, 15000);
      });
    },
    hideAllComments: () => {
      const comments = document.querySelectorAll('.comment-tree .athing.comtr');
      comments.forEach(c => {
        if (!c.id) {
          c.id = `hn-comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
        onlyLikes.hideComment(c.id);
      });
    },
    scrapeComments: () => {
      const comments = Array.from(document.querySelectorAll('.comment-tree .athing.comtr')).map(c => {
        const textEle = c.querySelector('.commtext');
        const text = textEle ? textEle.textContent.trim() : '';
        return { text, id: c.id };
      }).filter(item => item.text);
      return comments;
    },
    main: async function() {
      try {
        let userName = this.getUserName();
        if (!userName) {
          onlyLikes.debugLog('No HN user detected');
          return;
        }

        if (this.isUserPost(userName)) {
          await this.waitForComments();
          this.hideAllComments();

          const comments = this.scrapeComments();
          if (comments.length) {
            const processed = await onlyLikes.filterComments(comments);
            const threshold = await onlyLikes.getUserThreshold();
            processed.forEach(({ id, sentiment }) => {
              if (sentiment >= threshold) {
                onlyLikes.showComment(id);
              }
            });
          }
        }
      } catch (err) {
        onlyLikes.debugLog(`Error in hn.main(): ${err.message}`);
      }
    }
  };

  window.hn = hn;

  window.addEventListener('message', (event) => {
    if (event.source != window) return;

    if (event.data.type === 'ONLYLIKES_INIT' && event.data.platform === 'hn') {
      hn.main().catch(error => onlyLikes.debugLog(`Error in hn.main(): ${error.message}`));
    } else if (event.data.type === 'ONLYLIKES_RESPONSE') {
      const request = pendingRequests.get(event.data.id);
      if (request) {
        request.resolve(event.data.result);
        pendingRequests.delete(event.data.id);
      }
    }
  });

})(window);
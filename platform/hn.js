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
        // Extract the userName from the comment element
        const userEle = c.querySelector('.hnuser');
        const commentUserName = userEle ? userEle.textContent.trim() : null;
        
        // Prevent hiding comments authored by the user
        if (commentUserName && commentUserName.toLowerCase() === userName.toLowerCase()) {
          return;
        }
        
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

        const userEle = c.querySelector('.hnuser');
        const userName = userEle ? userEle.textContent.trim() : null;

        let parentId = null;
        const parentLink = c.querySelector('.navs a[href^="#"]');
        if (parentLink && parentLink.textContent === 'parent') {
          parentId = parentLink.getAttribute('href').replace('#', '');
        }

        return {
          text: textEle ? textEle.textContent.trim() : '',
          id: c.id,
          userName,
          parentId
        };
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

        await this.waitForComments();
        const comments = this.scrapeComments();

        // Build comment map (commentId -> { ...comment data..., children: [] })
        const commentMap = {};
        comments.forEach(c => {
          commentMap[c.id] = { ...c, children: [] };
        });
        comments.forEach(c => {
          if (c.parentId && commentMap[c.parentId]) {
            commentMap[c.parentId].children.push(c.id);
          }
        });

        // Identify root comment(s)
        // 1) If user is post author, treat EVERY top-level comment as “user’s post subtree”
        // 2) Otherwise, only gather user-authored comments
        let rootCommentIds = [];
        if (this.isUserPost(userName)) {
          rootCommentIds = comments.map(c => c.id);
        } else {
          rootCommentIds = comments
            .filter(c => c.userName && c.userName.toLowerCase() === userName.toLowerCase())
            .map(c => c.id);
        }

        // Hide the subtree under each root
        const hiddenList = new Set();
        function hideSubtree(cid) {
          const comment = commentMap[cid];
          if (!comment) return;
          
          // Check if the current comment is authored by the user
          const isUserComment = comment.userName && comment.userName.toLowerCase() === userName.toLowerCase();
          
          if (!isUserComment) {
            if (hiddenList.has(cid)) return;
            hiddenList.add(cid);
            onlyLikes.hideComment(cid);
          }
          
          // Always process child comments
          comment.children.forEach(childId => hideSubtree(childId));
        }
        
        rootCommentIds.forEach(rid => hideSubtree(rid));

        // Perform sentiment analysis on everything hidden
        const toAnalyze = [...hiddenList].map(id => ({
          text: commentMap[id].text,
          id: id
        }));

        if (toAnalyze.length) {
          const processed = await onlyLikes.filterComments(toAnalyze);
          const threshold = await onlyLikes.getUserThreshold();
          processed.forEach(({ id, sentiment }) => {
            if (sentiment >= threshold) {
              onlyLikes.showComment(id);
            }
          });
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
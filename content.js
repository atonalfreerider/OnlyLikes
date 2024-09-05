// Content script to interact with the page

function getUserName() {
  const userElement = document.querySelector('span[class*="AccountSwitcher"]');
  return userElement ? userElement.textContent.trim() : null;
}

function isUserPost() {
  const userName = getUserName();
  const authorElement = document.querySelector('a[data-testid="post_author_link"]');
  return authorElement && authorElement.textContent.trim() === userName;
}

function scrapeComments() {
  const commentElements = document.querySelectorAll('div[data-testid="comment"]');
  return Array.from(commentElements).map(comment => ({
    text: comment.querySelector('div[data-testid="comment"] > div:nth-child(2)').textContent,
    element: comment
  }));
}

function filterComments(comments) {
  comments.forEach(comment => {
    browser.runtime.sendMessage({action: "analyzeComment", comment: comment.text})
      .then(response => {
        if (response.sentiment < getUserThreshold()) {
          hideComment(comment.element);
        }
      });
  });
}

function getUserThreshold() {
  return browser.storage.sync.get('threshold').then(result => {
    switch(result.threshold) {
      case 'aggressive': return 0.7;
      case 'cautious': return 0.3;
      default: return 0.5;
    }
  });
}

function hideComment(commentElement) {
  commentElement.style.display = 'none';
}

// Main execution
function main() {
  if (isUserPost()) {
    const comments = scrapeComments();
    filterComments(comments);
  }
}

// Run the main function when the page loads and whenever the URL changes
main();
window.addEventListener('locationchange', main);

// Custom event for single-page apps
let oldPushState = history.pushState;
history.pushState = function pushState() {
  let ret = oldPushState.apply(this, arguments);
  window.dispatchEvent(new Event('locationchange'));
  return ret;
};
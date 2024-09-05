// Common functions shared across all platforms

function debugLog(message) {
  console.log(`[OnlyLikes Debug] ${message}`);
}

function filterComments(comments, batchSize = 10) {
  debugLog(`Filtering ${comments.length} comments`);
  const batches = [];
  for (let i = 0; i < comments.length; i += batchSize) {
    batches.push(comments.slice(i, i + batchSize));
  }

  return new Promise((resolve) => {
    const processedComments = [];
    const processBatch = (batch) => {
      const commentTexts = batch.map(comment => comment.text);
      debugLog(`Sending ${commentTexts.length} comments for analysis`);
      browser.runtime.sendMessage({action: "analyzeComments", comments: commentTexts})
        .then(response => {
          debugLog(`Received response from background script: ${JSON.stringify(response)}`);
          if (response && response.sentiments) {
            batch.forEach((comment, index) => {
              const sentiment = response.sentiments[index];
              debugLog(`Received sentiment score for comment: ${sentiment}`);
              processedComments.push({...comment, sentiment});
            });

            if (batches.length > 0) {
              processBatch(batches.shift());
            } else {
              resolve(processedComments);
            }
          } else if (response && response.error) {
            debugLog(`Error from background script: ${response.error}`);
            resolve(processedComments);
          } else {
            debugLog('Unexpected response format from background script');
            resolve(processedComments);
          }
        })
        .catch(error => {
          debugLog(`Error in sending message to background script: ${error}`);
          resolve(processedComments);
        });
    };

    if (batches.length > 0) {
      processBatch(batches.shift());
    } else {
      resolve(processedComments);
    }
  });
}

async function getUserThreshold() {
  try {
    const result = await browser.storage.sync.get('threshold');
    switch(result.threshold) {
      case 'aggressive': return 0.7;
      case 'cautious': return 0.3;
      default: return 0.5;
    }
  } catch (error) {
    debugLog(`Error getting user threshold: ${error.message}`);
    return 0.5; // Default to neutral if there's an error
  }
}

function hideComment(commentElement) {
  commentElement.style.display = 'none';
}

export { debugLog, filterComments, getUserThreshold, hideComment };
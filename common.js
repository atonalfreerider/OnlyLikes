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
      browser.runtime.sendMessage({action: "analyzeComments", comments: commentTexts})
        .then(response => {
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
  const result = await browser.storage.sync.get('threshold');
  switch(result.threshold) {
    case 'aggressive': return 0.7;
    case 'cautious': return 0.3;
    default: return 0.5;
  }
}

function hideComment(commentElement) {
  commentElement.style.display = 'none';
}

export { debugLog, filterComments, getUserThreshold, hideComment };
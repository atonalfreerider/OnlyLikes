document.getElementById('save').addEventListener('click', () => {
  const threshold = document.getElementById('threshold').value;

  browser.storage.sync.set({
    threshold
  }).then(() => {
    console.log('[OnlyLikes Debug] Settings saved:', threshold);
  }).catch(error => {
    console.error('[OnlyLikes Debug] Error saving settings:', error);
  });
});

// Load saved settings when popup opens
browser.storage.sync.get(['threshold']).then(result => {
  if (result.threshold) document.getElementById('threshold').value = result.threshold;
  console.log('[OnlyLikes Debug] Settings loaded:', result.threshold);
}).catch(error => {
  console.error('[OnlyLikes Debug] Error loading settings:', error);
});
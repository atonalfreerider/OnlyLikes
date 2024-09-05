document.getElementById('save').addEventListener('click', () => {
  const apiChoice = document.getElementById('api-choice').value;
  const apiKey = document.getElementById('api-key').value;
  const threshold = document.getElementById('threshold').value;

  browser.storage.sync.set({
    apiChoice,
    apiKey,
    threshold
  }).then(() => {
    console.log('[OnlyLikes Debug] Settings saved. API Choice:', apiChoice, 'API Key available:', !!apiKey);
  });
});

// Load saved settings when popup opens
browser.storage.sync.get(['apiChoice', 'apiKey', 'threshold'], (result) => {
  if (result.apiChoice) document.getElementById('api-choice').value = result.apiChoice;
  if (result.apiKey) document.getElementById('api-key').value = result.apiKey;
  if (result.threshold) document.getElementById('threshold').value = result.threshold;
  console.log('[OnlyLikes Debug] Settings loaded. API Choice:', result.apiChoice, 'API Key available:', !!result.apiKey);
});
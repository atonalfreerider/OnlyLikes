const browser = typeof globalThis.browser !== 'undefined' ? globalThis.browser : globalThis.chrome;

function debugLog(msg) {
  console.log(`[OnlyLikes Popup] ${msg}`);
}

// Simplified storage handling
async function saveThreshold(value) {
  return new Promise((resolve, reject) => {
    browser.storage.sync.set({ threshold: value }, () => {
      if (browser.runtime.lastError) {
        reject(browser.runtime.lastError);
      } else {
        resolve(true);
      }
    });
  });
}

async function loadThreshold() {
  return new Promise((resolve) => {
    browser.storage.sync.get('threshold', (result) => {
      resolve(result.threshold || 'aggressive');
    });
  });
}

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  const select = document.getElementById('threshold');
  
  try {
    const value = await loadThreshold();
    select.value = value;
  } catch (err) {
    debugLog(`Error loading threshold: ${err}`);
    select.value = 'aggressive';
  }
});

// Handle save
document.getElementById('save').addEventListener('click', async () => {
  const select = document.getElementById('threshold');
  const newValue = select.value;
  
  try {
    await saveThreshold(newValue);
    
    // Visual feedback
    select.style.backgroundColor = '#e8ffe8';
    
    // Notify tabs
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      try {
        browser.tabs.sendMessage(tab.id, {
          type: 'THRESHOLD_CHANGED',
          threshold: newValue
        });
      } catch (e) {
        // Ignore errors for inactive tabs
      }
    }
    
    // Reload active tab
    const activeTabs = await browser.tabs.query({active: true, currentWindow: true});
    if (activeTabs[0]) {
      browser.tabs.reload(activeTabs[0].id);
    }
    
    setTimeout(() => select.style.backgroundColor = '', 1000);
  } catch (err) {
    debugLog(`Error saving: ${err}`);
    select.style.backgroundColor = '#ffe8e8';
    setTimeout(() => select.style.backgroundColor = '', 1000);
  }
});
(function() {
  function debugLog(message) {
    console.log(`[OnlyLikes Debug] ${message}`);
  }

  function getCurrentSite() {
    if (window.location.hostname.includes('reddit.com')) return 'reddit';
    if (window.location.hostname.includes('youtube.com')) return 'youtube';
    if (window.location.hostname.includes('twitter.com')) return 'twitter';
    if (window.location.hostname.includes('facebook.com')) return 'facebook';
    if (window.location.hostname.includes('instagram.com')) return 'instagram';
    return null;
  }

  async function loadScript(scriptName) {
    const script = document.createElement('script');
    script.src = browser.runtime.getURL(scriptName);
    script.type = 'module';
    return new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function initializeExtension() {
    const currentSite = getCurrentSite();
    if (currentSite) {
      debugLog(`Loading script for ${currentSite}`);
      try {
        await loadScript('common.js');
        const { main } = await import(browser.runtime.getURL(`${currentSite}.js`));
        debugLog(`Scripts loaded for ${currentSite}`);
        
        // Send a test message to the background script
        browser.runtime.sendMessage({action: "test", message: "Hello from content script!"})
          .then(response => {
            debugLog(`Received response from background script: ${JSON.stringify(response)}`);
          })
          .catch(error => {
            debugLog(`Error sending message to background script: ${error}`);
          });

        // Call the main function
        debugLog('Calling main function');
        await main();
      } catch (error) {
        debugLog(`Error initializing extension: ${error}`);
      }
    }
  }

  // Run initializeExtension when the page is fully loaded
  if (document.readyState === 'complete') {
    initializeExtension();
  } else {
    window.addEventListener('load', initializeExtension);
  }
})();
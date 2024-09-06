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

  function loadScript(scriptName) {
    const script = document.createElement('script');
    script.src = browser.runtime.getURL(scriptName);
    script.onload = function() {
      this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  }

  function loadPlatformScript() {
    const hostname = window.location.hostname;
    if (hostname.includes('reddit.com')) {
      loadScript('reddit.js');
    } else if (hostname.includes('youtube.com')) {
      loadScript('youtube.js');
    } else if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      loadScript('twitter.js');
    } else if (hostname.includes('facebook.com')) {
      loadScript('facebook.js');
    } else if (hostname.includes('instagram.com')) {
      loadScript('instagram.js');
    }
    loadScript('common.js');
  }

  loadPlatformScript();
})();
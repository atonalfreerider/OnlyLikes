(function() {
  let originalCreateElement = document.createElement;
  document.createElement = function(...args) {
    const element = originalCreateElement.apply(this, args);
    if (args[0].toLowerCase() === 'body') {
      element.style.display = 'none';
    }
    return element;
  };

  window.addEventListener('DOMContentLoaded', async (event) => {
    const currentSite = getCurrentSite();
    if (currentSite) {
      const module = await import(chrome.runtime.getURL(`${currentSite}.js`));
      await module.main();
      document.body.style.display = '';
    }
  });

  function getCurrentSite() {
    if (window.location.hostname.includes('reddit.com')) return 'reddit';
    if (window.location.hostname.includes('youtube.com')) return 'youtube';
    if (window.location.hostname.includes('twitter.com')) return 'twitter';
    if (window.location.hostname.includes('facebook.com')) return 'facebook';
    if (window.location.hostname.includes('instagram.com')) return 'instagram';
    return null;
  }
})();
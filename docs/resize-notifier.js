(function () {
  // Only relevant when embedded in an iframe -- lets the parent page (e.g. a
  // Shopify Custom Liquid embed) resize the iframe to match our real content
  // height instead of using a fixed height (which clips) or internal scroll
  // (which causes double scrollbars).
  if (window.self === window.top) return;

  function sendHeight() {
    window.parent.postMessage(
      { source: 'hdc-font-tester', height: document.documentElement.scrollHeight },
      '*'
    );
  }

  window.addEventListener('load', sendHeight);
  new ResizeObserver(sendHeight).observe(document.documentElement);
})();

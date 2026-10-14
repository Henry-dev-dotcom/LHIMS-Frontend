/*
  Tells someone on a browser that is too old for CurataMed, instead of showing a broken page.

  The styles need the colour features of Chrome and Edge 111, Safari 16.4 or Firefox 128 (all
  2023). A browser without them would draw the app with most of its colours missing. This file is
  deliberately old-fashioned JavaScript so that even those browsers can run it, and it is a file
  rather than an inline script because the security policy allows no inline script.
*/
(function () {
  var supported = false;
  try {
    supported = !!(window.CSS && CSS.supports &&
      CSS.supports('color', 'oklch(0.5 0.1 200)') &&
      CSS.supports('color', 'color-mix(in srgb, red, blue)'));
  } catch (e) {
    supported = false;
  }
  if (supported) return;

  function show() {
    if (document.getElementById('browser-too-old')) return;
    var box = document.createElement('div');
    box.id = 'browser-too-old';
    box.setAttribute('role', 'alert');
    box.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;padding:16px 20px;' +
      'background:#7c2d12;color:#ffffff;font:16px/1.5 Arial,Helvetica,sans-serif;text-align:center;';
    box.innerHTML = '<strong>This browser is too old for CurataMed.</strong> ' +
      'Please update to the latest Chrome, Edge or Firefox (or Safari 16.4 or newer), then open this page again. ' +
      'On Windows 7 or 8 no current browser installs any more, so the computer needs Windows 10 or 11.';
    document.body.insertBefore(box, document.body.firstChild);
  }
  if (document.body) show();
  else document.addEventListener('DOMContentLoaded', show);
})();

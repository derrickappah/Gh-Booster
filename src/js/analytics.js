/**
 * GhBooster Analytics & Conversion Tracking Module
 * Handles Meta Pixel integration, UTM parameter capture, and conversion logging.
 */
(function () {
  'use strict';

  // 1. Capture UTM Parameters from URL query string and persist in localStorage
  function captureUtmParameters() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
      const utmData = {};
      let hasUtm = false;

      utmKeys.forEach(function (key) {
        const val = urlParams.get(key);
        if (val) {
          utmData[key] = val;
          hasUtm = true;
        }
      });

      if (hasUtm) {
        localStorage.setItem('ghb_utm_params', JSON.stringify(utmData));
      }
    } catch (e) {
      console.warn('Analytics: Could not capture UTM params:', e);
    }
  }

  // 2. Retrieve saved UTM parameters
  window.getStoredUtmParams = function () {
    try {
      const stored = localStorage.getItem('ghb_utm_params');
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  };

  // 3. Meta Pixel Initializer
  function initMetaPixel() {
    const metaPixelMeta = document.querySelector('meta[name="meta-pixel-id"]');
    const pixelId = window.META_PIXEL_ID || (metaPixelMeta ? metaPixelMeta.getAttribute('content') : null);

    if (!pixelId || pixelId === 'YOUR_PIXEL_ID') return;

    if (!window.fbq) {
      !(function (f, b, e, v, n, t, s) {
        if (f.fbq) return;
        n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = !0;
        n.version = '2.0';
        n.queue = [];
        t = b.createElement(e);
        t.async = !0;
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

      window.fbq('init', pixelId);
      window.fbq('track', 'PageView');
    }
  }

  // 4. Track Conversion Event helper
  window.trackConversionEvent = function (eventName, eventData) {
    if (window.fbq) {
      window.fbq('track', eventName, eventData || {});
    }
  };

  // Run on load
  captureUtmParameters();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMetaPixel);
  } else {
    initMetaPixel();
  }
})();

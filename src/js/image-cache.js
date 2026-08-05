/**
 * GhBooster Image Local Storage Cache Utility
 * Caches all web page images (static assets, platform icons, dynamic images)
 * to localStorage as Base64 Data URLs for instantaneous offline/fast loading.
 */

(function (global) {
  'use strict';

  const STORAGE_PREFIX = 'ghb_img_';
  const METADATA_KEY = 'ghb_img_meta';

  // List of static application images to automatically pre-cache
  const PRECACHE_ASSETS = [
    'src/img/logo.png',
    'src/img/credit-card.svg',
    'src/img/spent.svg',
    'src/img/orders.svg',
    'src/img/account.svg',
    'src/img/favicon.ico',
    'src/img/favicon.png',
    'src/img/platforms/facebook.png',
    'src/img/platforms/instagram.png',
    'src/img/platforms/snapchat.png',
    'src/img/platforms/spotify.png',
    'src/img/platforms/telegram.png',
    'src/img/platforms/tiktok.png',
    'src/img/platforms/twitter.png',
    'src/img/platforms/whatsapp.png',
    'src/img/platforms/youtube.png'
  ];

  /**
   * Helper to normalize a URL to an absolute URL key for consistent lookup
   */
  function normalizeUrl(url) {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    try {
      return new URL(url, window.location.origin).href;
    } catch (e) {
      return url;
    }
  }

  /**
   * Safe check for localStorage availability
   */
  function isLocalStorageAvailable() {
    try {
      const testKey = '__ghb_img_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  const storageAvailable = isLocalStorageAvailable();

  /**
   * Evict older image entries if quota limit is exceeded
   */
  function evictOldCache() {
    if (!storageAvailable) return;
    try {
      const items = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX) && key !== METADATA_KEY) {
          try {
            const raw = localStorage.getItem(key);
            const parsed = JSON.parse(raw);
            items.push({ key: key, ts: parsed.ts || 0, size: raw.length });
          } catch (_) {
            items.push({ key: key, ts: 0, size: 0 });
          }
        }
      }
      // Sort by timestamp ascending (oldest first)
      items.sort(function (a, b) { return a.ts - b.ts; });
      // Remove oldest 35% of entries
      const toRemoveCount = Math.max(1, Math.ceil(items.length * 0.35));
      for (let i = 0; i < toRemoveCount && i < items.length; i++) {
        localStorage.removeItem(items[i].key);
      }
    } catch (e) {
      console.warn('[ImageCache] Error during cache eviction:', e);
    }
  }

  const ImageCache = {
    /**
     * Get cached base64 data URL for a given image URL
     */
    get: function (url) {
      if (!storageAvailable || !url) return null;
      const key = STORAGE_PREFIX + normalizeUrl(url);
      try {
        const item = localStorage.getItem(key);
        if (!item) return null;
        const parsed = JSON.parse(item);
        return parsed.data || null;
      } catch (e) {
        return null;
      }
    },

    /**
     * Store base64 data URL for a given image URL into localStorage
     */
    set: function (url, dataUrl) {
      if (!storageAvailable || !url || !dataUrl) return false;
      if (dataUrl.length > 2 * 1024 * 1024) {
        // Skip caching images larger than 2MB to preserve localStorage space
        return false;
      }
      const key = STORAGE_PREFIX + normalizeUrl(url);
      const payload = JSON.stringify({
        data: dataUrl,
        ts: Date.now(),
        size: dataUrl.length
      });

      try {
        localStorage.setItem(key, payload);
        return true;
      } catch (e) {
        // Quota exceeded: try evicting old cache entries and retry
        evictOldCache();
        try {
          localStorage.setItem(key, payload);
          return true;
        } catch (err) {
          console.warn('[ImageCache] Unable to store image due to storage quota:', url);
          return false;
        }
      }
    },

    /**
     * Convert an image URL to Base64 via Fetch API or Canvas
     */
    fetchAndCache: function (url) {
      const self = this;
      const normalized = normalizeUrl(url);
      if (!normalized || normalized.startsWith('data:')) {
        return Promise.resolve(normalized);
      }

      const cached = self.get(normalized);
      if (cached) {
        return Promise.resolve(cached);
      }

      return fetch(normalized, { mode: 'cors' })
        .then(function (response) {
          if (!response.ok) throw new Error('Network response not ok');
          return response.blob();
        })
        .then(function (blob) {
          return new Promise(function (resolve, reject) {
            const reader = new FileReader();
            reader.onloadend = function () {
              const dataUrl = reader.result;
              self.set(normalized, dataUrl);
              resolve(dataUrl);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        })
        .catch(function (err) {
          // If fetch fails (e.g. CORS), return original URL gracefully
          return normalized;
        });
    },

    /**
     * Apply cached image or fetch & cache for an <img> element
     */
    applyToElement: function (imgEl) {
      if (!imgEl || imgEl.nodeName !== 'IMG') return;
      const originalSrc = imgEl.getAttribute('data-src') || imgEl.getAttribute('src');
      if (!originalSrc || originalSrc.startsWith('data:')) return;

      const normalized = normalizeUrl(originalSrc);
      const cachedData = this.get(normalized);

      if (cachedData) {
        if (imgEl.src !== cachedData) {
          imgEl.setAttribute('data-original-src', originalSrc);
          imgEl.src = cachedData;
        }
      } else {
        this.fetchAndCache(originalSrc).then(function (dataUrl) {
          if (dataUrl && dataUrl.startsWith('data:') && imgEl.src !== dataUrl) {
            imgEl.setAttribute('data-original-src', originalSrc);
            imgEl.src = dataUrl;
          }
        });
      }
    },

    /**
     * Scan page and cache all <img> elements and CSS background images
     */
    cacheAllImages: function () {
      const self = this;
      // 1. Process all <img> elements
      const images = document.querySelectorAll('img');
      images.forEach(function (img) {
        self.applyToElement(img);
      });

      // 2. Process elements with background-image inline style
      const bgElements = document.querySelectorAll('[style*="background-image"]');
      bgElements.forEach(function (el) {
        const style = el.style.backgroundImage;
        const match = style.match(/url\(['"]?(.*?)['"]?\)/);
        if (match && match[1] && !match[1].startsWith('data:')) {
          const bgUrl = match[1];
          const cached = self.get(bgUrl);
          if (cached) {
            el.style.backgroundImage = 'url("' + cached + '")';
          } else {
            self.fetchAndCache(bgUrl).then(function (dataUrl) {
              if (dataUrl && dataUrl.startsWith('data:')) {
                el.style.backgroundImage = 'url("' + dataUrl + '")';
              }
            });
          }
        }
      });
    },

    /**
     * Pre-cache all core static image assets
     */
    precacheStaticAssets: function () {
      const self = this;
      PRECACHE_ASSETS.forEach(function (assetPath) {
        self.fetchAndCache(assetPath);
      });
    },

    /**
     * Clear all cached images from localStorage
     */
    clear: function () {
      if (!storageAvailable) return;
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(STORAGE_PREFIX)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(function (k) {
          localStorage.removeItem(k);
        });
        console.log('[ImageCache] Cleared ' + keysToRemove.length + ' cached images from local storage.');
      } catch (e) {
        console.error('[ImageCache] Error clearing image cache:', e);
      }
    },

    /**
     * Return cache statistics (count and total size)
     */
    stats: function () {
      if (!storageAvailable) return { count: 0, sizeKB: '0.00', sizeMB: '0.00' };
      let count = 0;
      let totalBytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX) && key !== METADATA_KEY) {
          count++;
          const val = localStorage.getItem(key);
          if (val) totalBytes += val.length;
        }
      }
      return {
        count: count,
        sizeKB: (totalBytes / 1024).toFixed(2),
        sizeMB: (totalBytes / (1024 * 1024)).toFixed(2)
      };
    },

    /**
     * Observe DOM changes to automatically cache dynamic images
     */
    initMutationObserver: function () {
      const self = this;
      if (typeof MutationObserver === 'undefined') return;

      const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(function (node) {
              if (node.nodeType === 1) { // ELEMENT_NODE
                if (node.nodeName === 'IMG') {
                  self.applyToElement(node);
                } else if (node.querySelectorAll) {
                  const imgs = node.querySelectorAll('img');
                  imgs.forEach(function (img) {
                    self.applyToElement(img);
                  });
                }
              }
            });
          } else if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
            if (mutation.target && mutation.target.nodeName === 'IMG') {
              const src = mutation.target.getAttribute('src');
              if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
                self.applyToElement(mutation.target);
              }
            }
          }
        });
      });

      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src']
      });
    },

    /**
     * Initialize image caching system
     */
    init: function () {
      const self = this;
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
          self.cacheAllImages();
          self.precacheStaticAssets();
          self.initMutationObserver();
        });
      } else {
        self.cacheAllImages();
        self.precacheStaticAssets();
        self.initMutationObserver();
      }
    }
  };

  // Expose to global window scope
  global.ImageCache = ImageCache;

  // Auto initialize
  ImageCache.init();

})(typeof window !== 'undefined' ? window : this);

(function () {
  "use strict";

  /**
   * ------------------------------------------------------------------------
   * Functions
   * ------------------------------------------------------------------------
   */
  
  // Back to top button
  const myBacktotop = function () {
    var offset = 300,
      offset_opacity = 1200,
      back_to_top = document.querySelector(".back-top"),
      scrollpos = window.scrollY;

    if (!back_to_top) return;

    var add_class_back_scroll = function add_class_back_scroll() {
      back_to_top.classList.add("block");
      back_to_top.classList.remove("hidden");
    };

    var add_class_offset_scroll = function add_class_offset_scroll() {
      back_to_top.classList.add("opacity-90");
    };

    var remove_class_back_scroll = function remove_class_back_scroll() {
      back_to_top.classList.remove("block","opacity-90");
      back_to_top.classList.add("hidden");
    };

    var defaults = {
      duration: 400,
      easing: function easing(t, b, c, d) {
        return -c * (t /= d) * (t - 2) + b;
      },
      to: 0
    };
    var animatedScrollTo = function animatedScrollTo(args) {
      if (isInteger(args)) {
        args = {
          to: args
        };
      }
      var options = extend(defaults, args);
      options.startingYOffset = window.pageYOffset;
      options.distanceYOffset = parseInt(options.to, 10) - options.startingYOffset;
      window.requestAnimationFrame(function (timestamp) {
        return animateScroll(options, timestamp);
      });
    };
    var animateScroll = function animateScroll(options, now) {
      if (!options.startTime) {
        options.startTime = now;
      }
      var currentTime = now - options.startTime;
      var newYOffset = Math.round(options.easing(currentTime, options.startingYOffset, options.distanceYOffset, options.duration));
      if (currentTime < options.duration) {
        window.requestAnimationFrame(function (timestamp) {
          return animateScroll(options, timestamp);
        });
      } else {
        newYOffset = options.to;
      }
      setScrollTopPosition(newYOffset);
    };
    var setScrollTopPosition = function setScrollTopPosition(newYOffset) {
      document.documentElement.scrollTop = newYOffset;
      document.body.scrollTop = newYOffset;
    };
    var isInteger = function isInteger(value) {
      if (Number.isInteger) {
        return Number.isInteger(value);
      } else {
        return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
      }
    };
    var extend = function extend(defaults, options) {
      var extendedOptions = {};
      for (var key in defaults) {
        extendedOptions[key] = options[key] || defaults[key];
      }
      return extendedOptions;
    };
    var easeInQuint = function easeInQuint(t, b, c, d) {
      return c * (t /= d) * t * t * t * t + b;
    };

    const scroll_a = document.querySelectorAll('.back-top');
    if (scroll_a != null) {
      for (var i = 0; i < scroll_a.length; i++) {
        scroll_a[i].addEventListener("click", function(){
          animatedScrollTo({
            easing: easeInQuint,
            duration: 800
          });
        });
      }
    }

    window.addEventListener('scroll', function () {
      scrollpos = window.scrollY;
      if (scrollpos > offset) {
        add_class_back_scroll();
      } else {
        remove_class_back_scroll();
      }
      if (scrollpos > offset_opacity) {
        add_class_offset_scroll();
      }
    });
  };

  // Preloader
  const myPreloader = function () {
    var xpre = document.querySelector(".preloader");
    if (xpre != null) {
      window.addEventListener('load', function () {
        if (document.body) document.body.classList.add("loaded-success");
      });
    }
  };

  // Lightbox
  const myLightbox = function () {
    const lightbox_class = document.querySelector(".glightbox3");
    if (lightbox_class != null && typeof GLightbox !== 'undefined') {
      GLightbox({
        selector: '.glightbox3',
        touchNavigation: true,
        loop: true,
        autoplayVideos: true
      });
    }
  };

  // splidejs (lazy-initialized on viewport intersection)
  const mySplidejs = function () {
    const postslider_class = document.querySelector("#post-carousel");
    if (postslider_class != null && typeof Splide !== 'undefined') {
      const initSplide = function () {
        if (postslider_class.dataset.splideInit) return;
        postslider_class.dataset.splideInit = "true";
        new Splide(postslider_class, {
          rewind: true,
          pagination: true,
          arrows: true,
          type: 'loop',
          drag: 'free',
          autoplay: true,
          interval: 2500,
          pauseOnHover: true,
          perPage: 8,
          perMove: 1,
          gap: 16,
          breakpoints: {
            1200: { perPage: 7, gap: 12 },
            992: { perPage: 6, gap: 12 },
            768: { perPage: 5, gap: 8 },
            500: { perPage: 4, gap: 6 },
            380: { perPage: 4, gap: 4 }
          }
        }).mount();
      };

      if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
        const observer = new IntersectionObserver(function (entries) {
          if (entries[0] && entries[0].isIntersecting) {
            initSplide();
            observer.disconnect();
          }
        }, { rootMargin: '200px' });
        observer.observe(postslider_class);
      } else {
        initSplide();
      }
    }
  };

  // Typed Js
  const myTyped = function () {
    var x = document.querySelectorAll('[data-toggle="typed"]');
    if (typeof Typed !== 'undefined' && x && x.length > 0) {
      x.forEach(function (el) {
        var typo = el.dataset.options;
        typo = typo ? JSON.parse(typo) : {};
        var object = Object.assign({
          typeSpeed: 100,
          backSpeed: 100,
          backDelay: 1000,
          loop: true
        }, typo);
        new Typed(el, object);
      });
    }
  };

  // WOW animate
  const myWow = function () {
    if (typeof WOW !== 'undefined') {
      new WOW().init();
    }
  };

  // Smooth Scroll Anchor
  const mySmooth = function () {
    if (typeof SmoothScroll !== 'undefined') {
      new SmoothScroll('a[href*="#"]', {
        offset: 80,
        speed: 1200,
        speedAsDuration: true
      });
    }
  };
  
  // Scrollspy & Navbar on Scroll
  const myScrollspy = function () {
    var scrollpos = document.body.scrollTop || document.documentElement.scrollTop;
    var nav_height = 80;
    var main_nav = document.querySelector(".main-nav");

    var add_class_on_scroll = function add_class_on_scroll() {
      if (main_nav) main_nav.classList.add("navbar-scrolled");
    };
    var remove_class_on_scroll = function remove_class_on_scroll() {
      if (main_nav) main_nav.classList.remove("navbar-scrolled");
    };

    var navCustom = function navCustom() {
      scrollpos = document.body.scrollTop || document.documentElement.scrollTop;
      if (scrollpos >= nav_height) {
        add_class_on_scroll();
      } else {
        remove_class_on_scroll();
      }
    };
    
    var navCustomone = function navCustomone() {
      var section = document.querySelectorAll(".section");
      if (section && section.length > 0) {
        var sections = {};
        Array.prototype.forEach.call(section, function(e) {
          if (e.id) sections[e.id] = e.offsetTop;
        });

        var scrollPosition = document.documentElement.scrollTop || document.body.scrollTop;
        for (var i in sections) {
          if (sections[i] <= scrollPosition + nav_height) {
            var activeItem = document.querySelector('.navbar>li>.active');
            if (activeItem) activeItem.classList.remove('active');
            var newActive = document.querySelector('a[href*=' + i + ']');
            if (newActive) newActive.classList.add('active');
          }
        }
      }
    };

    window.addEventListener('load', function () {
      navCustom();
      navCustomone();
    });

    window.addEventListener('scroll', function () {
      navCustom();
      navCustomone();
    });
  };

  // Menu mobile
  const menu_Mobile = function menu_Mobile() {
    var menu_dropa = document.querySelectorAll(".menu-mobile");
    var menu_menu_x = document.querySelectorAll(".navbar");

    if (!menu_dropa || !menu_menu_x) return;

    var _loop = function _loop(i) {
      if (menu_dropa[i] && menu_menu_x[i]) {
        menu_dropa[i].addEventListener("click", function () {
          menu_dropa[i].classList.toggle("show");
          menu_menu_x[i].classList.toggle("hidden");
        });
        menu_menu_x[i].addEventListener("click", function () {
          menu_dropa[i].classList.toggle("show");
          menu_menu_x[i].classList.toggle("hidden");
        });
      }
    };

    for (var i = 0; i < menu_dropa.length; i++) {
      _loop(i);
    }
  };

  // Custom JS
  const myCustom = function () {
    // Custom logic
  };

  // Register Service Worker for PWA installability
  const registerServiceWorker = function () {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('./service-worker.js')
          .then(function (registration) {
            console.log('[PWA] ServiceWorker registration successful with scope: ', registration.scope);
          })
          .catch(function (err) {
            console.error('[PWA] ServiceWorker registration failed: ', err);
          });
      });
    }
  };

  // Sidebar Toggle Logic — with localStorage persistence and mobile auto-expand
  let expandSidebarGlobal = null;
  const initSidebarToggle = function () {
    var toggleBtn = document.getElementById('toggle-sidebar');
    var sidebar = document.getElementById('sidebar');
    var brandHeader = document.getElementById('brand-header');
    var sidebarNav = document.getElementById('sidebar-nav');
    var sidebarFooter = document.getElementById('sidebar-footer');
    var sidebarTexts = document.querySelectorAll('.sidebar-text');
    var sidebarLinks = document.querySelectorAll('.sidebar-link');
    var sidebarIcons = document.querySelectorAll('.sidebar-icon');
    var brandFull = document.getElementById('brand-full');
    var iconCollapse = document.getElementById('icon-collapse');
    var iconExpand = document.getElementById('icon-expand');

    var STORAGE_KEY = 'ghb_sidebar_collapsed';

    function collapseSidebar() {
      if (!sidebar) return;
      sidebar.classList.add('is-collapsed');
      sidebar.style.width = '4.5rem';
      if (sidebarNav) {
        sidebarNav.classList.remove('px-4');
        sidebarNav.classList.add('px-2');
      }
      if (sidebarFooter) {
        sidebarFooter.classList.remove('p-4');
        sidebarFooter.classList.add('px-2', 'py-4');
      }
      document.querySelectorAll('.sidebar-link').forEach(function (el) {
        el.classList.remove('px-4');
        el.classList.add('justify-center', 'px-0');
      });
      document.querySelectorAll('.sidebar-icon').forEach(function (el) {
        el.classList.remove('mr-3');
      });
      // Text and logo are hidden via CSS transition (opacity/width)
      if (iconCollapse) iconCollapse.classList.add('hidden');
      if (iconExpand) iconExpand.classList.remove('hidden');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
      try { localStorage.setItem(STORAGE_KEY, '1'); } catch (_) {}
    }

    function expandSidebar() {
      if (!sidebar) return;
      sidebar.classList.remove('is-collapsed');
      sidebar.style.width = '16rem';
      if (sidebarNav) {
        sidebarNav.classList.remove('px-2');
        sidebarNav.classList.add('px-4');
      }
      if (sidebarFooter) {
        sidebarFooter.classList.remove('px-2');
        sidebarFooter.classList.add('p-4');
      }
      document.querySelectorAll('.sidebar-link').forEach(function (el) {
        el.classList.remove('justify-center', 'px-0');
        el.classList.add('px-4');
      });
      document.querySelectorAll('.sidebar-icon').forEach(function (el) {
        el.classList.add('mr-3');
      });
      // Text and logo are shown via CSS transition (opacity/width)
      if (iconCollapse) iconCollapse.classList.remove('hidden');
      if (iconExpand) iconExpand.classList.add('hidden');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    }

    expandSidebarGlobal = expandSidebar;

    if (sidebar) {
      // Restore state based on screen size: mobile is ALWAYS expanded
      try {
        if (window.innerWidth < 768) {
          expandSidebar();
        } else if (localStorage.getItem(STORAGE_KEY) === '1') {
          collapseSidebar();
        } else {
          expandSidebar();
        }
      } catch (_) {}

      if (toggleBtn) {
        toggleBtn.addEventListener('click', function (e) {
          if (e) e.preventDefault();
          // Desktop collapse/expand toggle
          if (window.innerWidth >= 768) {
            if (sidebar.classList.contains('is-collapsed')) {
              expandSidebar();
            } else {
              collapseSidebar();
            }
          }
        });
      }
    }
  };

  // Mobile Sidebar Off-Canvas Toggle Logic (Completely hidden on mobile when closed, always expanded when opened)
  const initMobileSidebar = function () {
    var mobileBtn = document.getElementById('mobile-hamburger-btn');
    var sidebar = document.getElementById('sidebar');
    var backdrop = document.getElementById('mobile-sidebar-backdrop');
    var closeTimeout = null;

    var iconHamburger = document.getElementById('mobile-icon-hamburger');
    var iconClose = document.getElementById('mobile-icon-close');

    // Single source of truth for sidebar state — never rely on DOM classes for this
    var isMobileOpen = false;
    var isAnimating = false;  // debounce lock

    if (!backdrop && sidebar) {
      backdrop = document.createElement('div');
      backdrop.id = 'mobile-sidebar-backdrop';
      backdrop.className = 'fixed inset-0 bg-gray-900/60 z-40 hidden md:hidden';
      backdrop.style.cssText += ';transition:opacity 0.3s ease;opacity:0;';
      document.body.appendChild(backdrop);
    }

    function showCloseIcon() {
      if (iconHamburger) iconHamburger.classList.add('hidden');
      if (iconClose) iconClose.classList.remove('hidden');
      if (mobileBtn) mobileBtn.setAttribute('aria-expanded', 'true');
    }

    function showHamburgerIcon() {
      if (iconClose) iconClose.classList.add('hidden');
      if (iconHamburger) iconHamburger.classList.remove('hidden');
      if (mobileBtn) mobileBtn.setAttribute('aria-expanded', 'false');
    }

    // Handle initial state on load
    if (sidebar) {
      if (window.innerWidth < 768) {
        if (expandSidebarGlobal) expandSidebarGlobal();
        sidebar.classList.add('-translate-x-full', 'hidden');
        sidebar.classList.remove('translate-x-0');
        isMobileOpen = false;
        showHamburgerIcon();
      } else {
        sidebar.classList.remove('hidden', '-translate-x-full', 'translate-x-0');
      }
    }

    function openMobileSidebar() {
      if (window.innerWidth >= 768 || isMobileOpen || isAnimating) return;
      isAnimating = true;
      isMobileOpen = true;

      if (closeTimeout) { clearTimeout(closeTimeout); closeTimeout = null; }

      if (sidebar) {
        if (expandSidebarGlobal) expandSidebarGlobal();
        // Make visible but keep off-screen first
        sidebar.classList.remove('hidden');
        sidebar.classList.add('-translate-x-full');
        sidebar.classList.remove('translate-x-0');
        // Double rAF ensures the browser has rendered the off-screen state before animating
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            sidebar.classList.remove('-translate-x-full');
            sidebar.classList.add('translate-x-0');
          });
        });
      }

      if (backdrop) {
        backdrop.classList.remove('hidden');
        requestAnimationFrame(function () { backdrop.style.opacity = '1'; });
      }

      showCloseIcon();
      document.body.classList.add('overflow-hidden');

      // Release debounce lock after animation completes
      setTimeout(function () { isAnimating = false; }, 380);
    }

    function closeMobileSidebar() {
      if (window.innerWidth >= 768 || !isMobileOpen || isAnimating) return;
      isAnimating = true;
      isMobileOpen = false;

      if (closeTimeout) clearTimeout(closeTimeout);

      if (sidebar) {
        sidebar.classList.add('-translate-x-full');
        sidebar.classList.remove('translate-x-0');
        closeTimeout = setTimeout(function () {
          if (sidebar && window.innerWidth < 768) {
            sidebar.classList.add('hidden');
          }
        }, 360);
      }

      if (backdrop) {
        backdrop.style.opacity = '0';
        setTimeout(function () {
          backdrop.classList.add('hidden');
        }, 320);
      }

      showHamburgerIcon();
      document.body.classList.remove('overflow-hidden');

      setTimeout(function () { isAnimating = false; }, 380);
    }

    function toggleMobileSidebar(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      if (window.innerWidth >= 768) return;
      if (isMobileOpen) {
        closeMobileSidebar();
      } else {
        openMobileSidebar();
      }
    }

    if (mobileBtn) {
      // Use touchend for instant response on mobile (no 300ms click delay)
      mobileBtn.addEventListener('touchend', function (e) {
        e.preventDefault(); // prevent the subsequent click event from firing too
        toggleMobileSidebar(e);
      }, { passive: false });

      // Fallback for non-touch devices (desktop testing)
      mobileBtn.addEventListener('click', function (e) {
        // Only handle if not already handled by touchend
        if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
        toggleMobileSidebar(e);
      });
    }

    if (backdrop) {
      backdrop.addEventListener('touchend', function (e) {
        e.preventDefault();
        closeMobileSidebar();
      }, { passive: false });
      backdrop.addEventListener('click', closeMobileSidebar);
    }

    // Automatically adjust sidebar display on window resize
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 768) {
        if (closeTimeout) clearTimeout(closeTimeout);
        if (sidebar) {
          sidebar.classList.remove('hidden', '-translate-x-full', 'translate-x-0');
        }
        if (backdrop) {
          backdrop.style.opacity = '0';
          backdrop.classList.add('hidden');
        }
        isMobileOpen = false;
        isAnimating = false;
        showHamburgerIcon();
        document.body.classList.remove('overflow-hidden');
      } else {
        if (expandSidebarGlobal) expandSidebarGlobal();
        if (sidebar && !isMobileOpen) {
          sidebar.classList.add('-translate-x-full', 'hidden');
        }
      }
    });

    // Close mobile sidebar when clicking any navigation link on mobile
    var links = document.querySelectorAll('#sidebar a');
    links.forEach(function (link) {
      link.addEventListener('click', function () {
        if (window.innerWidth < 768) {
          closeMobileSidebar();
        }
      });
    });
  };

  var myImageCache = function () {
    if (!window.ImageCache) {
      var STORAGE_PREFIX = 'ghb_img_';
      var METADATA_KEY = 'ghb_img_meta';

      var PRECACHE_ASSETS = [
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

      function normalizeUrl(url) {
        if (!url) return '';
        if (url.startsWith('data:') || url.startsWith('blob:')) return url;
        try {
          return new URL(url, window.location.origin).href;
        } catch (e) {
          return url;
        }
      }

      function isLocalStorageAvailable() {
        try {
          var testKey = '__ghb_img_test__';
          localStorage.setItem(testKey, '1');
          localStorage.removeItem(testKey);
          return true;
        } catch (e) {
          return false;
        }
      }

      var storageAvailable = isLocalStorageAvailable();

      function evictOldCache() {
        if (!storageAvailable) return;
        try {
          var items = [];
          for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key && key.startsWith(STORAGE_PREFIX) && key !== METADATA_KEY) {
              try {
                var raw = localStorage.getItem(key);
                var parsed = JSON.parse(raw);
                items.push({ key: key, ts: parsed.ts || 0, size: raw.length });
              } catch (_) {
                items.push({ key: key, ts: 0, size: 0 });
              }
            }
          }
          items.sort(function (a, b) { return a.ts - b.ts; });
          var toRemoveCount = Math.max(1, Math.ceil(items.length * 0.35));
          for (var j = 0; j < toRemoveCount && j < items.length; j++) {
            localStorage.removeItem(items[j].key);
          }
        } catch (e) {
          console.warn('[ImageCache] Error during cache eviction:', e);
        }
      }

      window.ImageCache = {
        get: function (url) {
          if (!storageAvailable || !url) return null;
          var key = STORAGE_PREFIX + normalizeUrl(url);
          try {
            var item = localStorage.getItem(key);
            if (!item) return null;
            var parsed = JSON.parse(item);
            return parsed.data || null;
          } catch (e) {
            return null;
          }
        },

        set: function (url, dataUrl) {
          if (!storageAvailable || !url || !dataUrl) return false;
          if (dataUrl.length > 2 * 1024 * 1024) return false;
          var key = STORAGE_PREFIX + normalizeUrl(url);
          var payload = JSON.stringify({
            data: dataUrl,
            ts: Date.now(),
            size: dataUrl.length
          });

          try {
            localStorage.setItem(key, payload);
            return true;
          } catch (e) {
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

        fetchAndCache: function (url) {
          var self = this;
          var normalized = normalizeUrl(url);
          if (!normalized || normalized.startsWith('data:')) {
            return Promise.resolve(normalized);
          }

          var cached = self.get(normalized);
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
                var reader = new FileReader();
                reader.onloadend = function () {
                  var dataUrl = reader.result;
                  self.set(normalized, dataUrl);
                  resolve(dataUrl);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
            })
            .catch(function (err) {
              return normalized;
            });
        },

        applyToElement: function (imgEl) {
          if (!imgEl || imgEl.nodeName !== 'IMG') return;
          var originalSrc = imgEl.getAttribute('data-src') || imgEl.getAttribute('src');
          if (!originalSrc || originalSrc.startsWith('data:')) return;

          var normalized = normalizeUrl(originalSrc);
          var cachedData = this.get(normalized);

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

        cacheAllImages: function () {
          var self = this;
          var images = document.querySelectorAll('img');
          images.forEach(function (img) {
            self.applyToElement(img);
          });

          var bgElements = document.querySelectorAll('[style*="background-image"]');
          bgElements.forEach(function (el) {
            var style = el.style.backgroundImage;
            var match = style.match(/url\(['"]?(.*?)['"]?\)/);
            if (match && match[1] && !match[1].startsWith('data:')) {
              var bgUrl = match[1];
              var cached = self.get(bgUrl);
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

        precacheStaticAssets: function () {
          var self = this;
          PRECACHE_ASSETS.forEach(function (assetPath) {
            self.fetchAndCache(assetPath);
          });
        },

        clear: function () {
          if (!storageAvailable) return;
          try {
            var keysToRemove = [];
            for (var i = 0; i < localStorage.length; i++) {
              var key = localStorage.key(i);
              if (key && key.startsWith(STORAGE_PREFIX)) {
                keysToRemove.push(key);
              }
            }
            keysToRemove.forEach(function (k) {
              localStorage.removeItem(k);
            });
            console.log('[ImageCache] Cleared ' + keysToRemove.length + ' cached images.');
          } catch (e) {
            console.error('[ImageCache] Error clearing image cache:', e);
          }
        },

        stats: function () {
          if (!storageAvailable) return { count: 0, sizeKB: '0.00', sizeMB: '0.00' };
          var count = 0;
          var totalBytes = 0;
          for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key && key.startsWith(STORAGE_PREFIX) && key !== METADATA_KEY) {
              count++;
              var val = localStorage.getItem(key);
              if (val) totalBytes += val.length;
            }
          }
          return {
            count: count,
            sizeKB: (totalBytes / 1024).toFixed(2),
            sizeMB: (totalBytes / (1024 * 1024)).toFixed(2)
          };
        },

        initMutationObserver: function () {
          var self = this;
          if (typeof MutationObserver === 'undefined') return;

          var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
              if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(function (node) {
                  if (node.nodeType === 1) {
                    if (node.nodeName === 'IMG') {
                      self.applyToElement(node);
                    } else if (node.querySelectorAll) {
                      var imgs = node.querySelectorAll('img');
                      imgs.forEach(function (img) {
                        self.applyToElement(img);
                      });
                    }
                  }
                });
              } else if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
                if (mutation.target && mutation.target.nodeName === 'IMG') {
                  var src = mutation.target.getAttribute('src');
                  if (src && !src.startsWith('data:')) {
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

        init: function () {
          var self = this;
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
    }

    if (window.ImageCache) {
      window.ImageCache.init();
    }
  };

  const initWhatsAppSupport = function () {
    const cacheKey = 'ghb_public_settings';
    const cacheTimeKey = 'ghb_public_settings_time';
    const cacheDuration = 5 * 60 * 1000; // 5 minutes cache

    const renderWhatsAppIcon = function (settings) {
      if (!settings || !settings.whatsapp_enabled || !settings.whatsapp_number) {
        return;
      }

      if (document.getElementById('whatsapp-support-floating')) {
        return;
      }

      const cleanNumber = settings.whatsapp_number.replace(/[^0-9]/g, '');
      const waButton = document.createElement('a');
      waButton.id = 'whatsapp-support-floating';
      waButton.href = `https://wa.me/${cleanNumber}`;
      waButton.target = '_blank';
      waButton.rel = 'noopener noreferrer';
      waButton.setAttribute('aria-label', 'Contact WhatsApp Support');
      waButton.setAttribute('title', 'Chat with Support');
      
      waButton.style.cssText = `
        position: fixed;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 56px;
        height: 56px;
        background: transparent;
        border-radius: 50%;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        cursor: pointer;
        outline: none;
      `;

      const savedLeft = localStorage.getItem('ghb_wa_pos_left');
      const savedTop = localStorage.getItem('ghb_wa_pos_top');

      if (savedLeft && savedTop) {
        let leftVal = parseFloat(savedLeft);
        let topVal = parseFloat(savedTop);
        const padding = 10;
        const maxLeft = window.innerWidth - 56 - padding;
        const maxTop = window.innerHeight - 56 - padding;
        
        leftVal = Math.max(padding, Math.min(leftVal, maxLeft));
        topVal = Math.max(padding, Math.min(topVal, maxTop));
        
        waButton.style.left = leftVal + 'px';
        waButton.style.top = topVal + 'px';
      } else {
        waButton.style.right = '24px';
        waButton.style.bottom = '80px';
      }

      let imgPath = '/src/img/platforms/whatsapp.webp';
      const scripts = document.getElementsByTagName('script');
      for (let i = 0; i < scripts.length; i++) {
        const srcAttr = scripts[i].getAttribute('src');
        if (srcAttr && (srcAttr.indexOf('theme.js') !== -1 || srcAttr.indexOf('theme.min.js') !== -1)) {
          const parts = srcAttr.split('/');
          parts.pop(); // remove theme.js
          parts.pop(); // remove js
          imgPath = parts.join('/') + '/img/platforms/whatsapp.webp';
          break;
        }
      }

      waButton.innerHTML = `
        <img src="${imgPath}" alt="WhatsApp" style="width: 100%; height: 100%; object-fit: contain;" />
        <span style="
          position: absolute;
          top: -2px;
          right: -2px;
          display: flex;
          width: 14px;
          height: 14px;
        ">
          <span style="
            position: absolute;
            display: inline-flex;
            width: 100%;
            height: 100%;
            background-color: #25D366;
            opacity: 0.75;
            border-radius: 50%;
            animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></span>
          <span style="
            position: relative;
            display: inline-flex;
            border-radius: 50%;
            width: 14px;
            height: 14px;
            background-color: #25D366;
            border: 2px solid white;
          "></span>
        </span>
      `;

      if (!document.getElementById('whatsapp-animations-style')) {
        const style = document.createElement('style');
        style.id = 'whatsapp-animations-style';
        style.innerHTML = `
          @keyframes ping {
            75%, 100% {
              transform: scale(2.2);
              opacity: 0;
            }
          }
          #whatsapp-support-floating:hover {
            transform: scale(1.1) translateY(-4px);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
          }
          #whatsapp-support-floating:active {
            transform: scale(0.95) translateY(0);
          }
        `;
        document.head.appendChild(style);
      }

      // Make it draggable
      let isDragging = false;
      let startX, startY;
      let initialLeft, initialTop;

      const onStart = function (e) {
        isDragging = false;
        const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
        
        startX = clientX;
        startY = clientY;
        
        const rect = waButton.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        
        waButton.style.transition = 'none';
        
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);
      };

      const onMove = function (e) {
        const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
        
        const deltaX = clientX - startX;
        const deltaY = clientY - startY;
        
        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
          isDragging = true;
        }
        
        if (isDragging) {
          e.preventDefault(); // Prevent scrolling on mobile while dragging
          
          let newLeft = initialLeft + deltaX;
          let newTop = initialTop + deltaY;
          
          const rect = waButton.getBoundingClientRect();
          const padding = 10;
          const maxLeft = window.innerWidth - rect.width - padding;
          const maxTop = window.innerHeight - rect.height - padding;
          
          newLeft = Math.max(padding, Math.min(newLeft, maxLeft));
          newTop = Math.max(padding, Math.min(newTop, maxTop));
          
          waButton.style.left = newLeft + 'px';
          waButton.style.top = newTop + 'px';
          waButton.style.right = 'auto';
          waButton.style.bottom = 'auto';
        }
      };

      const onEnd = function (e) {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
        
        waButton.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        
        if (isDragging) {
          const rect = waButton.getBoundingClientRect();
          localStorage.setItem('ghb_wa_pos_left', rect.left + 'px');
          localStorage.setItem('ghb_wa_pos_top', rect.top + 'px');
        }
      };

      waButton.addEventListener('mousedown', onStart);
      waButton.addEventListener('touchstart', onStart, { passive: true });

      // Click handler to prevent redirect if dragged
      waButton.addEventListener('click', function (e) {
        if (isDragging) {
          e.preventDefault();
        }
      });

      document.body.appendChild(waButton);
    };

    const loadSettings = function () {
      const cached = sessionStorage.getItem(cacheKey);
      const cachedTime = sessionStorage.getItem(cacheTimeKey);
      const now = Date.now();

      if (cached && cachedTime && (now - parseInt(cachedTime, 10) < cacheDuration)) {
        try {
          const settings = JSON.parse(cached);
          renderWhatsAppIcon(settings);
          return;
        } catch (e) {}
      }

      fetch('/api/settings/public')
        .then(function (response) {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.json();
        })
        .then(function (res) {
          if (res.success && res.settings) {
            sessionStorage.setItem(cacheKey, JSON.stringify(res.settings));
            sessionStorage.setItem(cacheTimeKey, now.toString());
            renderWhatsAppIcon(res.settings);
          }
        })
        .catch(function (err) {
          console.warn('Could not load WhatsApp support settings:', err.message);
        });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadSettings);
    } else {
      loadSettings();
    }
  };

  /**
   * ------------------------------------------------------------------------
   * Launch Functions
   * ------------------------------------------------------------------------
   */
   
  // Immediate handlers for critical interactive UI elements
  myBacktotop();
  menu_Mobile();
  myTyped();
  initSidebarToggle();
  initMobileSidebar();
  myCustom();
  registerServiceWorker();
  initWhatsAppSupport();

  // Defer non-critical vendor initializations out of the main-thread critical window
  var deferLaunch = function () {
    myPreloader();
    myLightbox();
    mySplidejs();
    myWow();
    mySmooth();
    myScrollspy();
    myImageCache();
  };

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(deferLaunch, { timeout: 1000 });
  } else {
    setTimeout(deferLaunch, 100);
  }

})();
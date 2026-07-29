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

  // splidejs
  const mySplidejs = function () {
    const postslider_class = document.querySelector("#post-carousel");
    if (postslider_class != null && typeof Splide !== 'undefined') {
      const postslider = new Splide(postslider_class, {
        rewind: true,
        pagination: true,
        arrows: true,
        type: 'loop',
        drag: 'free',
        autoplay: true,
        interval: 2500,
        pauseOnHover: true,
        perPage: 6,
        perMove: 1,
        gap: 24,
        breakpoints: {
          1200: { perPage: 4 },
          768: { perPage: 3 },
          500: { perPage: 2 }
        }
      });
      postslider.mount();
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
      if (brandHeader) {
        brandHeader.classList.remove('justify-between', 'px-4');
        brandHeader.classList.add('justify-center', 'px-0');
      }
      if (sidebarNav) {
        sidebarNav.classList.remove('px-4');
        sidebarNav.classList.add('px-2');
      }
      if (sidebarFooter) {
        sidebarFooter.classList.remove('p-4');
        sidebarFooter.classList.add('px-2', 'py-4');
      }
      sidebarLinks.forEach(function (el) {
        el.classList.remove('px-4');
        el.classList.add('justify-center', 'px-0');
      });
      sidebarIcons.forEach(function (el) {
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
      if (brandHeader) {
        brandHeader.classList.remove('justify-center', 'px-0');
        brandHeader.classList.add('justify-between', 'px-4');
      }
      if (sidebarNav) {
        sidebarNav.classList.remove('px-2');
        sidebarNav.classList.add('px-4');
      }
      if (sidebarFooter) {
        sidebarFooter.classList.remove('px-2');
        sidebarFooter.classList.add('p-4');
      }
      sidebarLinks.forEach(function (el) {
        el.classList.remove('justify-center', 'px-0');
        el.classList.add('px-4');
      });
      sidebarIcons.forEach(function (el) {
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

    if (!backdrop && sidebar) {
      backdrop = document.createElement('div');
      backdrop.id = 'mobile-sidebar-backdrop';
      backdrop.className = 'fixed inset-0 bg-gray-900/60 z-40 hidden md:hidden transition-opacity duration-300';
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
        showHamburgerIcon();
      } else {
        sidebar.classList.remove('hidden', '-translate-x-full', 'translate-x-0');
      }
    }

    function openMobileSidebar() {
      if (window.innerWidth >= 768) return;
      if (closeTimeout) {
        clearTimeout(closeTimeout);
        closeTimeout = null;
      }
      if (sidebar) {
        if (expandSidebarGlobal) expandSidebarGlobal();
        sidebar.classList.remove('hidden', '-translate-x-full');
        void sidebar.offsetWidth; // Force layout reflow for CSS transition
        sidebar.classList.add('translate-x-0');
      }
      if (backdrop) {
        backdrop.classList.remove('hidden');
      }
      showCloseIcon();
      document.body.classList.add('overflow-hidden', 'md:overflow-auto');
    }

    function closeMobileSidebar() {
      if (window.innerWidth >= 768) return;
      if (closeTimeout) clearTimeout(closeTimeout);
      if (sidebar) {
        sidebar.classList.add('-translate-x-full');
        sidebar.classList.remove('translate-x-0');
        closeTimeout = setTimeout(function () {
          if (sidebar && sidebar.classList.contains('-translate-x-full') && window.innerWidth < 768) {
            sidebar.classList.add('hidden');
          }
        }, 300);
      }
      if (backdrop) {
        backdrop.classList.add('hidden');
      }
      showHamburgerIcon();
      document.body.classList.remove('overflow-hidden', 'md:overflow-auto');
    }

    if (mobileBtn) {
      mobileBtn.addEventListener('click', function (e) {
        if (e) e.preventDefault();
        if (window.innerWidth >= 768) return;
        if (sidebar && (sidebar.classList.contains('-translate-x-full') || sidebar.classList.contains('hidden'))) {
          openMobileSidebar();
        } else {
          closeMobileSidebar();
        }
      });
    }

    if (backdrop) {
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
          backdrop.classList.add('hidden');
        }
        showHamburgerIcon();
        document.body.classList.remove('overflow-hidden');
      } else {
        if (expandSidebarGlobal) expandSidebarGlobal();
        if (sidebar && !sidebar.classList.contains('translate-x-0')) {
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

  /**
   * ------------------------------------------------------------------------
   * Launch Functions
   * ------------------------------------------------------------------------
   */
   
  myBacktotop();
  myPreloader();
  menu_Mobile();
  myLightbox();
  mySplidejs();
  myTyped();
  myWow();
  mySmooth();
  myScrollspy();
  initSidebarToggle();
  initMobileSidebar();
  myCustom();

})();
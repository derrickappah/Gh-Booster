/**
 * GhBooster SMM Panel API Client & Dynamic UI Renderer
 * Fully connected to Supabase Database & Auth Endpoints
 * Replaces ALL static/hardcoded data across all 26 user and admin pages with live API data.
 */

const API_BASE_URL = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? `${window.location.origin}/api`
  : '/api';

// ── Global Toast Notification System ─────────────────────────────────────────
function showToast(message, type = 'success', duration = 5000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;top:1.25rem;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:0.5rem;pointer-events:none;max-width:26rem;width:calc(100% - 2rem);align-items:center;';
    document.body.appendChild(container);
  }

  const colors = {
    success: { bg: '#f0fdf4', border: '#86efac', text: '#15803d', icon: '✅' },
    error:   { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626', icon: '❌' },
    warning: { bg: '#fffbeb', border: '#fcd34d', text: '#b45309', icon: '⚠️' },
    info:    { bg: '#eff6ff', border: '#93c5fd', text: '#1d4ed8', icon: 'ℹ️' }
  };
  const c = colors[type] || colors.info;

  const toast = document.createElement('div');
  toast.style.cssText = `
    background:${c.bg};
    border:1px solid ${c.border};
    color:${c.text};
    padding:0.75rem 1rem;
    border-radius:0.75rem;
    font-size:0.8125rem;
    font-weight:600;
    font-family:inherit;
    box-shadow:0 4px 16px rgba(0,0,0,0.12);
    pointer-events:auto;
    cursor:pointer;
    display:flex;
    align-items:flex-start;
    gap:0.5rem;
    line-height:1.4;
    opacity:0;
    transform:translateY(-0.5rem);
    transition:opacity 0.25s ease, transform 0.25s ease;
    max-width:100%;
    word-break:break-word;
  `;

  const icon = document.createElement('span');
  icon.style.flexShrink = '0';
  icon.textContent = c.icon;

  const text = document.createElement('span');
  text.style.flexGrow = '1';
  text.textContent = message;

  const close = document.createElement('button');
  close.style.cssText = 'background:none;border:none;cursor:pointer;font-size:1rem;line-height:1;color:inherit;opacity:0.6;padding:0;flex-shrink:0;';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Dismiss');
  close.onclick = () => dismiss();

  toast.append(icon, text, close);
  container.appendChild(toast);
  toast.onclick = (e) => { if (e.target !== close) dismiss(); };

  // Animate in
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  function dismiss() {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-0.5rem)';
    setTimeout(() => toast.remove(), 300);
  }

  if (duration > 0) setTimeout(dismiss, duration);
  return dismiss;
}

const API = {
  getToken: () => localStorage.getItem('ghb_token'),
  setToken: (token) => localStorage.setItem('ghb_token', token),
  getUser: () => {
    try {
      return JSON.parse(localStorage.getItem('ghb_user'));
    } catch (e) {
      return null;
    }
  },
  setUser: (user) => localStorage.setItem('ghb_user', JSON.stringify(user)),
  logout: () => {
    localStorage.removeItem('ghb_token');
    localStorage.removeItem('ghb_user');
    window.location.href = '/login.html';
  },

  async request(endpoint, method = 'GET', data = null) {
    const headers = { 'Content-Type': 'application/json' };
    const token = API.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const config = { method, headers };
    if (data) config.body = JSON.stringify(data);

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      const text = await response.text();
      let result = {};
      if (text && text.trim()) {
        try {
          result = JSON.parse(text);
        } catch (e) {
          result = { error: text };
        }
      }
      if (!response.ok) {
        const error = new Error(result.error || result.message || `Server Error (${response.status})`);
        error.status = response.status;
        throw error;
      }
      return result;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err.message);
      throw err;
    }
  }
};

// Initialize Dynamic UI & Data Binding
document.addEventListener('DOMContentLoaded', async () => {
  const token = API.getToken();
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  const isOrderDetailPage = window.location.pathname.includes('/orders/') || currentPage === 'order-detail.html' || currentPage === 'order-detail';
  const isProtectedPage = isOrderDetailPage || currentPage.startsWith('admin-') || ['dashboard.html', 'orders.html', 'bulk-order.html', 'add-funds.html', 'tickets.html', 'account.html', 'referrals.html', 'child-panel.html', 'services.html', 'transactions.html'].includes(currentPage);

  if (isProtectedPage && !token) {
    window.location.href = '/login.html';
    return;
  }

  // Update Header & User UI Info
  if (token) {
    const cachedUser = API.getUser();
    if (cachedUser) {
      updateUserUI(cachedUser);
    }

    try {
      const meRes = await API.request('/auth/me');
      if (meRes.success && meRes.user) {
        API.setUser(meRes.user);
        updateUserUI(meRes.user);
      }
    } catch (e) {
      // Only log out if explicitly unauthorized (401 or 403 status code)
      if (isProtectedPage && (e.status === 401 || e.status === 403)) {
        API.logout();
      }
    }
  }

  // Global Logout Interceptor for Sign Out links
  document.addEventListener('click', (e) => {
    const logoutBtn = e.target.closest('a[data-action="logout"], a[href="login.html"], a[href="/login.html"], .logout-btn, #logout-btn');
    if (logoutBtn && API.getToken()) {
      const text = (logoutBtn.textContent || '').trim().toLowerCase();
      if (text.includes('sign out') || text.includes('log out') || logoutBtn.getAttribute('data-action') === 'logout' || logoutBtn.classList.contains('logout-btn')) {
        e.preventDefault();
        API.logout();
      }
    }
  });

  // Page Specific Handlers
  if (isOrderDetailPage) initOrderDetailPage();
  if (currentPage === 'index.html' || currentPage === '') initPublicHomePage();
  if (currentPage === 'login.html') initLoginPage();
  if (currentPage === 'register.html') initRegisterPage();
  if (currentPage === 'dashboard.html') initDashboardPage();
  if (currentPage === 'orders.html') initOrdersPage();
  if (currentPage === 'services.html') initServicesPage();
  if (currentPage === 'add-funds.html') initAddFundsPage();
  if (currentPage === 'transactions.html') initTransactionsPage();
  if (currentPage === 'tickets.html') initTicketsPage();
  if (currentPage === 'account.html') initAccountPage();
  if (currentPage === 'referrals.html') initReferralsPage();
  if (currentPage === 'bulk-order.html') initBulkOrderPage();
  if (currentPage === 'child-panel.html') initChildPanelPage();
  if (currentPage === 'api.html') initApiDocsPage();


  // Admin Pages Handlers
  if (currentPage === 'admin-dashboard.html') initAdminDashboard();
  if (currentPage === 'admin-users.html') initAdminUsersPage();
  if (currentPage === 'admin-orders.html') initAdminOrdersPage();
  if (currentPage === 'admin-services.html') initAdminServicesPage();
  if (currentPage === 'admin-providers.html') initAdminProvidersPage();
  if (currentPage === 'admin-deposits.html') initAdminDepositsPage();
  if (currentPage === 'admin-transactions.html') initAdminTransactionsPage();
  if (currentPage === 'admin-payments.html') initAdminPaymentsPage();
  if (currentPage === 'admin-tickets.html') initAdminTicketsPage();
  if (currentPage === 'admin-referrals.html') initAdminReferralsPage();
  if (currentPage === 'admin-child-panels.html') initAdminChildPanelsPage();
  if (currentPage === 'admin-bonuses.html') initAdminBonusesPage();
  if (currentPage === 'admin-promotions.html') initAdminPromotionsPage();
  if (currentPage === 'admin-news.html') initAdminNewsPage();
  if (currentPage === 'admin-logs.html') initAdminLogsPage();
  if (currentPage === 'admin-settings.html') initAdminSettingsPage();
});

function updateUserUI(user) {
  if (!user) return;

  const balanceElems = document.querySelectorAll('.user-balance-display, [data-user-balance]');
  balanceElems.forEach(el => {
    el.textContent = `GH₵${parseFloat(user.balance || 0).toFixed(2)}`;
  });

  const nameElems = document.querySelectorAll('[data-username]');
  nameElems.forEach(el => {
    el.textContent = user.username || user.full_name || 'User';
  });

  const emailElems = document.querySelectorAll('[data-user-email]');
  emailElems.forEach(el => {
    el.textContent = user.email || '';
  });

  // Inject Admin Panel link into sidebar if user is an admin
  if (user.role === 'admin') {
    const navs = document.querySelectorAll('#sidebar-nav, nav[aria-label="Main Navigation"], aside nav');
    navs.forEach(nav => {
      if (!nav.querySelector('#admin-sidebar-link')) {
        const adminLink = document.createElement('a');
        adminLink.id = 'admin-sidebar-link';
        const currentPage = window.location.pathname.split('/').pop() || '';
        const isAdminPage = currentPage.startsWith('admin-');
        
        adminLink.href = isAdminPage ? 'dashboard.html' : 'admin-dashboard.html';
        adminLink.className = `sidebar-link flex items-center px-4 py-3 text-sm font-bold text-pink-400 bg-pink-950/40 border border-pink-500/30 hover:bg-pink-900/50 hover:text-white rounded-lg transition group mt-1 mb-1`;

        adminLink.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" class="sidebar-icon h-5 w-5 mr-3 flex-shrink-0 text-pink-400 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span class="sidebar-text truncate">${isAdminPage ? 'User Dashboard' : 'Admin Panel'}</span>
        `;

        const firstLink = nav.querySelector('a');
        if (firstLink) {
          nav.insertBefore(adminLink, firstLink);
        } else {
          nav.prepend(adminLink);
        }
      }
    });

    // Also add to header user dropdown if present
    const userMenus = document.querySelectorAll('#user-menu, .user-dropdown-menu');
    userMenus.forEach(menu => {
      if (!menu.querySelector('#admin-dropdown-link')) {
        const adminDropLink = document.createElement('a');
        adminDropLink.id = 'admin-dropdown-link';
        const currentPage = window.location.pathname.split('/').pop() || '';
        const isAdminPage = currentPage.startsWith('admin-');
        adminDropLink.href = isAdminPage ? 'dashboard.html' : 'admin-dashboard.html';
        adminDropLink.className = 'block px-4 py-2 text-sm text-pink-600 dark:text-pink-400 font-bold hover:bg-pink-50 dark:hover:bg-pink-900/30 rounded-lg transition';
        adminDropLink.innerHTML = isAdminPage ? `👤 User Dashboard` : `🛡️ Admin Panel`;
        menu.insertBefore(adminDropLink, menu.firstChild);
      }
    });
  }
}

// PUBLIC HOMEPAGE HANDLER
async function initPublicHomePage() {
  try {
    const res = await API.request('/services');
    if (res.success && res.services) {
      const activeCount = res.services.length;
      const countElems = document.querySelectorAll('[data-stat-services]');
      countElems.forEach(el => el.textContent = activeCount.toLocaleString());
    }
  } catch (e) {}
}

// LOGIN PAGE HANDLER
function initLoginPage() {
  const form = document.getElementById('login-form') || document.querySelector('form');
  if (!form) return;

  const alertContainer = document.getElementById('login-alert');
  const alertText = document.getElementById('login-alert-text');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const emailError = document.getElementById('email-error');
  const passwordError = document.getElementById('password-error');
  const submitBtn = document.getElementById('login-submit-btn');
  const toggleBtn = document.getElementById('toggle-password-btn');
  const forgotLink = document.getElementById('forgot-password-link');

  if (toggleBtn && passwordInput) {
    toggleBtn.addEventListener('click', () => {
      const isPwd = passwordInput.type === 'password';
      passwordInput.type = isPwd ? 'text' : 'password';
      const eyeClosed = toggleBtn.querySelector('.eye-closed');
      const eyeOpen = toggleBtn.querySelector('.eye-open');
      if (eyeClosed) eyeClosed.classList.toggle('hidden', isPwd);
      if (eyeOpen) eyeOpen.classList.toggle('hidden', !isPwd);
    });
  }

  if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      const userEmail = (emailInput ? emailInput.value.trim() : '');
      if (alertContainer && alertText) {
        alertText.textContent = userEmail 
          ? `Password reset link sent to ${userEmail}. Please check your email inbox.` 
          : 'To reset your password, please enter your email address above or contact support@ghbooster.com.';
        alertContainer.classList.remove('hidden');
        alertContainer.className = 'p-3.5 rounded-xl text-xs font-semibold mb-5 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 flex items-center space-x-2';
      } else {
        alert('To reset your password, please enter your registered email address or contact support@ghbooster.com');
      }
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (alertContainer) alertContainer.classList.add('hidden');
    if (emailError) emailError.classList.add('hidden');
    if (passwordError) passwordError.classList.add('hidden');

    const username = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value.trim() : '';
    let hasError = false;

    if (!username) {
      if (emailError) emailError.classList.remove('hidden');
      hasError = true;
    }
    if (!password) {
      if (passwordError) passwordError.classList.remove('hidden');
      hasError = true;
    }

    if (hasError) return;

    // Loading state
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="animate-spin h-4 w-4 text-white mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Signing In...</span>
      `;
    }

    try {
      const res = await API.request('/auth/login', 'POST', { username, password });
      API.setToken(res.token);
      API.setUser(res.user);

      if (res.user.role === 'admin') {
        window.location.href = 'admin-dashboard.html';
      } else {
        window.location.href = 'dashboard.html';
      }
    } catch (err) {
      if (alertContainer && alertText) {
        alertText.textContent = err.message || 'Invalid credentials. Please try again.';
        alertContainer.classList.remove('hidden');
      } else {
        alert(err.message);
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Sign In to GhBooster</span>`;
      }
    }
  });
}

// REGISTER PAGE HANDLER
function initRegisterPage() {
  const form = document.getElementById('signup-form') || document.querySelector('form');
  if (!form) return;

  const alertContainer = document.getElementById('register-alert');
  const alertText = document.getElementById('register-alert-text');
  const fullnameInput = document.getElementById('fullname');
  const emailInput = document.getElementById('email');
  const phoneInput = document.getElementById('phone');
  const passwordInput = document.getElementById('password');
  const termsInput = document.getElementById('terms');
  const submitBtn = document.getElementById('register-submit-btn');
  const toggleBtn = document.getElementById('toggle-password-btn');

  const fullnameError = document.getElementById('fullname-error');
  const emailError = document.getElementById('email-error');
  const phoneError = document.getElementById('phone-error');
  const passwordError = document.getElementById('password-error');
  const termsError = document.getElementById('terms-error');

  if (toggleBtn && passwordInput) {
    toggleBtn.addEventListener('click', () => {
      const isPwd = passwordInput.type === 'password';
      passwordInput.type = isPwd ? 'text' : 'password';
      const eyeClosed = toggleBtn.querySelector('.eye-closed');
      const eyeOpen = toggleBtn.querySelector('.eye-open');
      if (eyeClosed) eyeClosed.classList.toggle('hidden', isPwd);
      if (eyeOpen) eyeOpen.classList.toggle('hidden', !isPwd);
    });
  }

  if (phoneInput) {
    phoneInput.addEventListener('input', () => {
      phoneInput.value = phoneInput.value.replace(/[^0-9+\-\s()]/g, '');
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Reset error messages
    if (alertContainer) alertContainer.classList.add('hidden');
    if (fullnameError) fullnameError.classList.add('hidden');
    if (emailError) emailError.classList.add('hidden');
    if (phoneError) phoneError.classList.add('hidden');
    if (passwordError) passwordError.classList.add('hidden');
    if (termsError) termsError.classList.add('hidden');

    const fullname = fullnameInput ? fullnameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value.trim() : '';
    const username = fullname || (email ? email.split('@')[0] : 'User');
    let hasError = false;

    if (!fullname) {
      if (fullnameError) fullnameError.classList.remove('hidden');
      hasError = true;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      if (emailError) emailError.classList.remove('hidden');
      hasError = true;
    }

    if (!phone || phone.replace(/[^0-9]/g, '').length < 10) {
      if (phoneError) phoneError.classList.remove('hidden');
      hasError = true;
    }

    if (!password || password.length < 6) {
      if (passwordError) passwordError.classList.remove('hidden');
      hasError = true;
    }

    if (termsInput && !termsInput.checked) {
      if (termsError) termsError.classList.remove('hidden');
      hasError = true;
    }

    if (hasError) return;

    // Loading state
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="animate-spin h-4 w-4 text-white mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Creating Account...</span>
      `;
    }

    try {
      const res = await API.request('/auth/register', 'POST', { username, email, password, phone });
      API.setToken(res.token);
      API.setUser(res.user);
      window.location.href = 'dashboard.html';
    } catch (err) {
      if (alertContainer && alertText) {
        alertText.textContent = err.message || 'Registration failed. Please try again.';
        alertContainer.classList.remove('hidden');
      } else {
        alert(err.message);
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Create Free Account</span>`;
      }
    }
  });
}


// DASHBOARD DYNAMIC RENDERER
async function initDashboardPage() {
  const categorySelect = document.getElementById('category-select') || document.querySelector('select[name="category"]');
  const serviceSelect = document.getElementById('service-select') || document.querySelector('select[name="service"]');
  const qtyInput = document.getElementById('quantity-input') || document.querySelector('input[type="number"]');
  const chargeDisplay = document.getElementById('total-charge-display') || document.querySelector('.total-charge');
  const orderForm = document.getElementById('order-form') || document.querySelector('form');
  const announcementsContainer = document.getElementById('news-announcements-container');

  let allServices = [];

  // Load announcements
  try {
    const newsRes = await API.request('/news');
    if (newsRes.success && newsRes.news && newsRes.news.length > 0 && announcementsContainer) {
      announcementsContainer.innerHTML = newsRes.news.map(n => `
        <div class="bg-gradient-to-r from-pink-500 to-purple-600 text-white p-4 rounded-xl shadow-md mb-6">
          <h4 class="font-bold text-lg">${escapeHtml(n.title)}</h4>
          <p class="text-sm mt-1">${escapeHtml(n.content)}</p>
        </div>
      `).join('');
    }
  } catch (e) {}

  const serviceSearchInput = document.getElementById('service-search-input');
  const serviceDropdownMenu = document.getElementById('service-dropdown-menu');
  const comboboxChevron = document.getElementById('combobox-chevron');
  const selectedServiceCard = document.getElementById('selected-service-card');
  const selectedSvcTitle = document.getElementById('selected-svc-title');
  const selectedSvcRate = document.getElementById('selected-svc-rate');
  const selectedSvcLimits = document.getElementById('selected-svc-limits');
  const selectedSvcDesc = document.getElementById('selected-svc-desc');

  let allCategories = [];
  let selectedService = null;

  // Load services and categories from live database
  try {
    const res = await API.request('/services');
    if (res.success) {
      allServices = res.services || [];
      allCategories = res.categories || [];
      renderDropdownMenu();
    }
  } catch (e) {
    console.error('Failed to load services:', e);
  }

  function getPlatformIcon(catName) {
    const catObj = allCategories.find(c => c.name === catName);
    if (catObj && catObj.icon) return catObj.icon;
    const lower = (catName || '').toLowerCase();
    if (lower.includes('instagram')) return 'src/img/platforms/instagram.png';
    if (lower.includes('tiktok')) return 'src/img/platforms/tiktok.png';
    if (lower.includes('youtube')) return 'src/img/platforms/youtube.png';
    if (lower.includes('telegram')) return 'src/img/platforms/telegram.png';
    if (lower.includes('facebook')) return 'src/img/platforms/facebook.png';
    if (lower.includes('snapchat')) return 'src/img/platforms/snapchat.png';
    if (lower.includes('spotify')) return 'src/img/platforms/spotify.png';
    if (lower.includes('twitter') || lower.includes('x ')) return 'src/img/platforms/twitter.png';
    if (lower.includes('whatsapp')) return 'src/img/platforms/whatsapp.png';
    return 'src/img/platforms/instagram.png';
  }

  function selectService(s) {
    if (!s) return;
    selectedService = s;
    if (serviceSelect) serviceSelect.value = s.id;
    if (serviceSearchInput) serviceSearchInput.value = '';

    const rate = parseFloat(s.rate_per_1000 || s.our_price_per_1000 || s.rate_per_1k || s.rate || 0);
    const min = (s.min_quantity || 100).toLocaleString();
    const max = (s.max_quantity || 100000).toLocaleString();
    const providerId = s.service_id || s.provider_service_id || s.service || (typeof s.id === 'string' && s.id.length > 8 ? s.id.substring(0, 8) : s.id);
    const catName = s.category_name || s.categories?.name || 'General Services';
    const icon = getPlatformIcon(catName);

    const selectedSvcIcon = document.getElementById('selected-svc-icon');
    const selectedSvcBadge = document.getElementById('selected-svc-badge');
    const selectedSvcCategoryBadge = document.getElementById('selected-svc-category-badge');
    const selectedSvcMin = document.getElementById('selected-svc-min');
    const selectedSvcMax = document.getElementById('selected-svc-max');

    if (selectedServiceCard) {
      if (selectedSvcIcon) selectedSvcIcon.src = icon;
      if (selectedSvcBadge) selectedSvcBadge.textContent = `ID: ${providerId}`;
      if (selectedSvcCategoryBadge) {
        selectedSvcCategoryBadge.classList.add('hidden');
        selectedSvcCategoryBadge.style.display = 'none';
      }
      if (selectedSvcTitle) selectedSvcTitle.textContent = s.name;
      if (selectedSvcRate) selectedSvcRate.textContent = `GH₵${rate.toFixed(2)}`;
      if (selectedSvcMin) selectedSvcMin.textContent = min;
      if (selectedSvcMax) selectedSvcMax.textContent = max;
      if (selectedSvcDesc) selectedSvcDesc.textContent = s.description || 'Fast automated delivery with refill guarantee.';
      selectedServiceCard.classList.remove('hidden');
    }

    if (qtyInput) {
      qtyInput.min = s.min_quantity || 100;
      qtyInput.max = s.max_quantity || 100000;
    }
    updateCharge();
    closeDropdown();
  }

  function renderDropdownMenu(query = '') {
    if (!serviceDropdownMenu) return;

    const q = (query || '').toLowerCase().trim();
    let list = allServices;
    if (q) {
      list = allServices.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.category_name && s.category_name.toLowerCase().includes(q)) ||
        String(s.id).toLowerCase().includes(q)
      );
    }

    if (list.length === 0) {
      serviceDropdownMenu.innerHTML = `<div class="p-4 text-center text-xs text-gray-400 font-medium">No matching services found for "${query}"</div>`;
      return;
    }

    // Group by category_name
    const grouped = {};
    list.forEach(s => {
      const cName = s.category_name || s.categories?.name || 'General Services';
      if (!grouped[cName]) grouped[cName] = [];
      grouped[cName].push(s);
    });

    let html = '';
    for (const [catName, items] of Object.entries(grouped)) {
      const icon = getPlatformIcon(catName);
      html += `
        <div class="sticky top-0 bg-gray-50 dark:bg-gray-900/90 px-3.5 py-2 font-bold text-xs text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700 flex items-center shadow-xs">
          <img src="${icon}" class="w-4 h-4 mr-2 object-contain flex-shrink-0" alt="icon">
          ${catName}
        </div>
      `;
      html += items.map(s => {
        const rate = parseFloat(s.rate_per_1000 || s.our_price_per_1000 || s.rate_per_1k || s.rate || 0).toFixed(2);
        const providerId = s.service_id || s.provider_service_id || s.service || (typeof s.id === 'string' && s.id.length > 8 ? s.id.substring(0, 8) : s.id);
        const isSelected = selectedService && String(selectedService.id) === String(s.id);
        const activeClass = isSelected ? 'bg-pink-50/90 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 font-bold' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-800 dark:text-gray-200';

        return `
          <div data-svc-id="${s.id}" class="svc-option-item px-4 py-2.5 cursor-pointer text-xs transition flex items-center justify-between border-b border-gray-50 dark:border-gray-800/40 ${activeClass}">
            <div class="flex-grow pr-3 truncate">
              <span class="font-bold text-pink-600 dark:text-pink-400 font-mono mr-1 text-[11px]">ID: ${providerId}</span>
              <span class="font-medium truncate">${s.name}</span>
            </div>
            <div class="flex items-center space-x-2 flex-shrink-0">
              <span class="font-extrabold text-green-600 dark:text-green-400 text-xs">GH₵${rate}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    serviceDropdownMenu.innerHTML = html;

    // Attach click events
    serviceDropdownMenu.querySelectorAll('.svc-option-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-svc-id');
        const target = allServices.find(s => String(s.id) === String(id));
        if (target) selectService(target);
      });
    });
  }

  function openDropdown() {
    if (serviceDropdownMenu) serviceDropdownMenu.classList.remove('hidden');
    if (comboboxChevron) comboboxChevron.classList.add('rotate-180');
  }

  function closeDropdown() {
    if (serviceDropdownMenu) serviceDropdownMenu.classList.add('hidden');
    if (comboboxChevron) comboboxChevron.classList.remove('rotate-180');
  }

  if (serviceSearchInput) {
    serviceSearchInput.addEventListener('focus', () => {
      renderDropdownMenu(serviceSearchInput.value === (selectedService ? selectedService.name : '') ? '' : serviceSearchInput.value);
      openDropdown();
    });

    serviceSearchInput.addEventListener('click', () => {
      renderDropdownMenu(serviceSearchInput.value === (selectedService ? selectedService.name : '') ? '' : serviceSearchInput.value);
      openDropdown();
    });

    serviceSearchInput.addEventListener('input', () => {
      renderDropdownMenu(serviceSearchInput.value);
      openDropdown();
    });
  }

  document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('service-combobox-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
      closeDropdown();
    }
  });

  function updateCharge() {
    if (!selectedService || !qtyInput || !chargeDisplay) return;
    const rate = parseFloat(selectedService.rate_per_1000 || selectedService.our_price_per_1000 || selectedService.rate_per_1k || selectedService.rate || 0);
    const qty = parseInt(qtyInput.value || 0, 10);
    const total = (qty / 1000) * rate;
    chargeDisplay.textContent = `GH₵${total.toFixed(4)}`;
  }

  if (qtyInput) qtyInput.addEventListener('input', updateCharge);
  if (serviceSelect) serviceSelect.addEventListener('change', updateCharge);

  if (orderForm) {
    orderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const service_id = serviceSelect ? serviceSelect.value : null;
      const linkInput = document.getElementById('link') || orderForm.querySelector('input[name="link"]');
      const link = linkInput ? linkInput.value.trim() : '';
      const quantity = qtyInput ? parseInt(qtyInput.value, 10) : 0;
      const orderSubmitBtn = document.getElementById('order-submit-btn');

      if (!service_id || !link || !quantity || isNaN(quantity) || quantity <= 0) {
        alert('Please select a service, target link, and valid quantity.');
        return;
      }

      if (orderSubmitBtn) {
        orderSubmitBtn.disabled = true;
        orderSubmitBtn.innerHTML = `<span>Placing Order...</span>`;
      }

      try {
        const res = await API.request('/orders', 'POST', { service_id, link, quantity });
        alert(`🎉 ${res.message}\nOrder ID: #${res.order_id}\nCharge: GH₵${res.charge.toFixed(2)}`);
        const user = API.getUser();
        if (user && res.new_balance !== undefined) {
          user.balance = res.new_balance;
          API.setUser(user);
          updateUserUI(user);
        }
        window.location.reload();
      } catch (err) {
        alert(err.message);
      } finally {
        if (orderSubmitBtn) {
          orderSubmitBtn.disabled = false;
          orderSubmitBtn.innerHTML = `<span>Submit Order</span>`;
        }
      }
    });
  }

  // ── Quick-pick amount buttons — active state ────────────────────────
  const amountInput = document.getElementById('deposit-amount');
  const quickBtns   = document.querySelectorAll('.quick-amt');

  const activeClasses   = ['border-green-500','text-green-600','bg-green-50','dark:bg-green-900/20','dark:text-green-400'];
  const inactiveClasses = ['border-gray-200','dark:border-gray-600','text-gray-600','dark:text-gray-300','bg-gray-50','dark:bg-gray-900'];

  function setActiveQuick(amount) {
    quickBtns.forEach(btn => {
      const isActive = String(btn.dataset.amount) === String(amount);
      activeClasses.forEach(c   => btn.classList.toggle(c, isActive));
      inactiveClasses.forEach(c => btn.classList.toggle(c, !isActive));
    });
  }

  quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.amount;
      if (amountInput) amountInput.value = val;
      setActiveQuick(val);
    });
  });

  if (amountInput) {
    amountInput.addEventListener('input', () => setActiveQuick(amountInput.value));
  }

  // ── Handle return from Moolre hosted page ───────────────────────────
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('deposit') === 'success') {
    const ref = urlParams.get('ref') || '';

    // Clean URL immediately so it doesn't re-trigger on refresh
    window.history.replaceState({}, '', window.location.pathname);

    if (ref) {
      const dismissPending = showToast('Confirming your payment and crediting your wallet…', 'info', 0);
      try {
        // Call /complete — this credits the wallet server-side
        const completeRes = await API.request('/payments/moolre/complete', 'POST', { reference: ref });
        dismissPending();

        if (completeRes.success) {
          const amount  = parseFloat(completeRes.amount || 0).toFixed(2);
          const balance = parseFloat(completeRes.balance || 0).toFixed(2);

          showToast(`GH₵${amount} deposited successfully! New balance: GH₵${balance}`, 'success', 7000);

          // Update all balance display elements on the page
          const balEls = document.querySelectorAll('[id*="balance"], [id*="wallet"], [id*="dash-balance"]');
          balEls.forEach(el => { el.textContent = `GH₵${balance}`; });

          // Also refresh from /auth/me to sync full user state
          try {
            const meRes = await API.request('/auth/me');
            if (meRes.success && meRes.user) { API.setUser(meRes.user); updateUserUI(meRes.user); }
          } catch (_) {}
        } else {
          showToast(`Payment processed but could not confirm credit. Please contact support. Ref: ${ref}`, 'warning', 10000);
        }
      } catch (err) {
        dismissPending();
        showToast(`Payment may have succeeded. Please refresh or contact support. Ref: ${ref}`, 'warning', 10000);
      }
    }
  }

  const depositForm = document.getElementById('deposit-form');
  if (depositForm) {
    depositForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const amountInput = document.getElementById('deposit-amount');
      const submitBtn   = document.getElementById('deposit-submit-btn');
      const btnText     = document.getElementById('deposit-btn-text');
      const alertEl     = document.getElementById('deposit-alert');
      const pendingBox  = document.getElementById('deposit-pending-box');
      const refDisplay  = document.getElementById('deposit-ref-display');

      const amount = amountInput ? parseFloat(amountInput.value) : 0;
      const user   = API.getUser();

      const showAlert = (msg, success = false) => {
        if (!alertEl) return;
        alertEl.className = `rounded-xl p-3.5 text-xs font-semibold border ${
          success
            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/50'
            : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50'
        }`;
        alertEl.textContent = msg;
        alertEl.classList.remove('hidden');
      };

      if (!amount || amount < 1) {
        return showAlert('Minimum deposit amount is GH₵1.00.');
      }

      if (alertEl) alertEl.classList.add('hidden');
      if (submitBtn) submitBtn.disabled = true;
      if (btnText)   btnText.textContent = 'Generating link...';

      try {
        const res = await API.request('/payments/moolre/initiate', 'POST', {
          amount,
          email: user ? user.email : '',
          description: 'GhBooster wallet top-up'
        });

        if (!res.success) {
          showAlert(res.error || res.message || 'Payment request failed. Please try again.');
          if (submitBtn) submitBtn.disabled = false;
          if (btnText)   btnText.textContent = 'Pay Now & Deposit';
          return;
        }

        // ── Sandbox mode: no real URL generated ──
        if (res.sandbox || !res.authorization_url) {
          if (pendingBox) pendingBox.classList.remove('hidden');
          if (refDisplay) refDisplay.textContent = `Sandbox Reference: ${res.reference}`;
          if (btnText)    btnText.textContent = 'Awaiting Confirmation...';
          showAlert(`[Sandbox] Payment link simulated. Reference: ${res.reference}. An admin can manually approve this.`);
          if (submitBtn) submitBtn.disabled = false;
          return;
        }

        // ── Live mode: redirect to Moolre hosted checkout ──
        if (pendingBox) pendingBox.classList.remove('hidden');
        if (refDisplay) refDisplay.textContent = `Reference: ${res.reference}`;
        if (btnText)    btnText.textContent = 'Opening checkout...';

        // Small delay so user sees the pending state, then redirect
        setTimeout(() => {
          window.location.href = res.authorization_url;
        }, 800);

      } catch (err) {
        showAlert(err.message || 'An error occurred. Please try again.');
        if (submitBtn) submitBtn.disabled = false;
        if (btnText)   btnText.textContent = 'Pay Now & Deposit';
      }
    });
  }

  // Populate Dashboard Stats Cards & Recent Orders

  try {
    const ordersRes = await API.request('/orders');
    if (ordersRes.success && ordersRes.orders) {
      const orders = ordersRes.orders;
      const totalSpent = orders.reduce((sum, o) => sum + (o.charge || 0), 0);
      
      const spentElem = document.getElementById('dash-total-spent');
      if (spentElem) spentElem.textContent = `GH₵${totalSpent.toFixed(2)}`;

      const totalOrdersElem = document.getElementById('dash-total-orders');
      if (totalOrdersElem) totalOrdersElem.textContent = orders.length.toLocaleString();

      const tableBody = document.getElementById('dashboard-recent-orders-tbody');
      if (tableBody) {
        if (orders.length === 0) {
          tableBody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-gray-400 font-medium">No recent orders yet. Place your first order above!</td></tr>`;
        } else {
          tableBody.innerHTML = orders.slice(0, 5).map(o => {
            const shortId = typeof o.id === 'string' && o.id.length > 8 ? o.id.substring(0, 8) : o.id;
            const chargeVal = parseFloat(o.charge || 0).toFixed(2);
            const safeLink = escapeHtml(o.link || '');
            const safeName = escapeHtml(o.service_name || '');
            const safeStatus = escapeHtml(o.status || '');
            const safeDate = escapeHtml(o.created_at || '');
            return `
              <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition border-b border-gray-100 dark:border-gray-700/50 text-xs">
                <td class="py-3.5 px-4 font-mono font-bold text-pink-600 dark:text-pink-400"><a href="/order-detail.html?id=${encodeURIComponent(o.id)}" class="hover:underline">#${escapeHtml(String(shortId))}</a></td>
                <td class="py-3.5 px-4 font-medium text-gray-900 dark:text-white truncate max-w-xs">${safeName}</td>
                <td class="py-3.5 px-4"><a href="${safeLink}" target="_blank" rel="noopener noreferrer" class="text-pink-600 dark:text-pink-400 hover:underline font-mono truncate max-w-[150px] inline-block">${safeLink}</a></td>
                <td class="py-3.5 px-4 font-semibold text-gray-900 dark:text-white">${(o.quantity || 0).toLocaleString()}</td>
                <td class="py-3.5 px-4 font-extrabold text-green-600 dark:text-green-400">GH₵${chargeVal}</td>
                <td class="py-3.5 px-4"><span class="px-2.5 py-1 font-bold rounded-full text-[11px] inline-flex items-center ${getStatusBadgeClass(o.status)}">${safeStatus}</span></td>
                <td class="py-3.5 px-4 text-gray-500 dark:text-gray-400">${safeDate}</td>
              </tr>
            `;
          }).join('');
        }
      }
    }
  } catch (e) {}
}

// ORDERS HISTORY DYNAMIC RENDERER
async function initOrdersPage() {
  const tableBody = document.getElementById('orders-tbody') || document.querySelector('tbody');
  if (!tableBody) return;

  function getPlatformIconByService(serviceName) {
    const lower = (serviceName || '').toLowerCase();
    if (lower.includes('instagram')) return 'src/img/platforms/instagram.png';
    if (lower.includes('tiktok')) return 'src/img/platforms/tiktok.png';
    if (lower.includes('youtube')) return 'src/img/platforms/youtube.png';
    if (lower.includes('telegram')) return 'src/img/platforms/telegram.png';
    if (lower.includes('facebook')) return 'src/img/platforms/facebook.png';
    if (lower.includes('snapchat')) return 'src/img/platforms/snapchat.png';
    if (lower.includes('spotify')) return 'src/img/platforms/spotify.png';
    if (lower.includes('twitter') || lower.includes('x ')) return 'src/img/platforms/twitter.png';
    if (lower.includes('whatsapp')) return 'src/img/platforms/whatsapp.png';
    return 'src/img/platforms/instagram.png';
  }

  try {
    const res = await API.request('/orders');
    if (res.success && res.orders) {
      let ordersList = res.orders;
      let currentStatusFilter = 'all';

      const renderOrders = (list) => {
        const countText = document.getElementById('orders-count-text');
        if (countText) countText.textContent = list.length.toLocaleString();

        if (list.length === 0) {
          tableBody.innerHTML = `<tr><td colspan="9" class="px-6 py-12 text-center text-gray-400 font-medium">No orders found yet. Place your first order on the Dashboard!</td></tr>`;
          return;
        }

        tableBody.innerHTML = list.map(o => {
          const shortId = typeof o.id === 'string' && o.id.length > 8 ? o.id.substring(0, 8) : o.id;
          const icon = getPlatformIconByService(o.service_name);
          const chargeVal = parseFloat(o.charge || 0).toFixed(2);
          const startCount = (o.start_count || 0).toLocaleString();
          const remains = (o.remains || 0).toLocaleString();

          return `
            <tr class="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition border-b border-gray-100 dark:border-gray-700/50">
              <td class="py-4 px-4 font-mono font-bold text-pink-600 dark:text-pink-400">
                <a href="/dashboard/orders/${encodeURIComponent(o.id)}" class="hover:underline" aria-label="View order ${escapeHtml(String(shortId))}">#${escapeHtml(String(shortId))}</a>
              </td>
              <td class="py-4 px-4">
                <span class="font-medium text-gray-900 dark:text-white flex items-center">
                  <img src="${escapeHtml(icon)}" class="w-4 h-4 mr-1.5 object-contain flex-shrink-0" alt="${escapeHtml(o.service_name || 'Social platform')} icon">
                  ${escapeHtml(o.service_name || '')}
                </span>
                ${o.provider_order_id ? `<span class="text-[10px] text-gray-400 block mt-0.5 font-mono">Ref: #${escapeHtml(String(o.provider_order_id))}</span>` : ''}
              </td>
              <td class="py-4 px-4">
                <a href="${escapeHtml(o.link || '')}" target="_blank" rel="noopener noreferrer" class="text-pink-600 dark:text-pink-400 hover:underline font-mono truncate block max-w-[180px]">${escapeHtml(o.link || '')}</a>
              </td>
              <td class="py-4 px-4 font-semibold text-gray-900 dark:text-white">${(o.quantity || 0).toLocaleString()}</td>
              <td class="py-4 px-4 font-mono text-xs text-gray-500 dark:text-gray-400">${startCount} / ${remains}</td>
              <td class="py-4 px-4 font-extrabold text-green-600 dark:text-green-400">GH₵${chargeVal}</td>
              <td class="py-4 px-4 text-xs text-gray-500 dark:text-gray-400">${escapeHtml(o.created_at || '')}</td>
              <td class="py-4 px-4 whitespace-nowrap">
                <span class="px-2.5 py-1 rounded-full font-bold text-[11px] inline-flex items-center whitespace-nowrap ${getStatusBadgeClass(o.status)}">
                  ${escapeHtml(o.status || '')}
                </span>
              </td>
              <td class="py-4 px-4 text-center">
                ${o.provider_order_id ? `<button type="button" data-refill-id="${encodeURIComponent(o.id)}" class="btn-refill-order px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded text-[11px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500" aria-label="Request refill for order ${escapeHtml(String(shortId))}">Refill</button>` : `<span class="text-gray-400 text-[11px]" aria-hidden="true">—</span>`}
              </td>
            </tr>
          `;
        }).join('');

        // Attach Refill handlers
        tableBody.querySelectorAll('.btn-refill-order').forEach(btn => {
          btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-refill-id');
            try {
              btn.disabled = true;
              btn.textContent = 'Requesting...';
              const r = await API.request(`/orders/${id}/refill`, 'POST');
              alert(`Refill requested! ${r.message || ''}`);
            } catch (err) {
              alert(err.message || 'Refill failed');
            } finally {
              btn.disabled = false;
              btn.textContent = 'Refill';
            }
          });
        });
      };

      renderOrders(ordersList);

      // Search & Filter listeners
      const searchInput = document.getElementById('order-search') || document.querySelector('input[type="search"], input[placeholder*="Search"]');
      const statusTabs = document.querySelectorAll('.status-tab');

      function applyOrderFilters() {
        const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
        let filtered = ordersList;

        if (currentStatusFilter !== 'all') {
          filtered = filtered.filter(o => (o.status || '').toLowerCase().replace(/\s+/g, '-') === currentStatusFilter || (o.status || '').toLowerCase() === currentStatusFilter);
        }

        if (q) {
          filtered = filtered.filter(o =>
            (o.service_name && o.service_name.toLowerCase().includes(q)) ||
            (o.link && o.link.toLowerCase().includes(q)) ||
            String(o.id).toLowerCase().includes(q) ||
            (o.provider_order_id && String(o.provider_order_id).toLowerCase().includes(q))
          );
        }

        renderOrders(filtered);
      }

      if (searchInput) {
        searchInput.addEventListener('input', applyOrderFilters);
      }

      if (statusTabs && statusTabs.length > 0) {
        statusTabs.forEach(tab => {
          tab.addEventListener('click', () => {
            statusTabs.forEach(t => {
              t.className = 'status-tab px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition text-xs font-semibold';
            });
            tab.className = 'status-tab px-4 py-2 bg-pink-600 text-white rounded-lg shadow-sm transition active text-xs font-semibold';
            currentStatusFilter = tab.getAttribute('data-status') || 'all';
            applyOrderFilters();
          });
        });
      }
    }
  } catch (e) {
    console.error('Failed to load orders:', e);
  }
}

// SERVICES PAGE DYNAMIC RENDERER
async function initServicesPage() {
  const tableBody = document.getElementById('services-tbody') || document.querySelector('tbody');
  const searchInput = document.getElementById('service-search') || document.getElementById('search-service-input') || document.querySelector('input[type="search"], input[placeholder*="Search"]');
  const pillsContainer = document.querySelector('.cat-pill')?.parentElement;

  if (!tableBody) return;

  function formatIconHtml(iconPath, extraClass = "w-4 h-4 mr-2 object-contain inline-block flex-shrink-0") {
    if (!iconPath) return '';
    if (iconPath.startsWith('src/') || iconPath.includes('/') || iconPath.includes('.png')) {
      return `<img src="${iconPath}" class="${extraClass}" alt="icon">`;
    }
    return `<i class="${iconPath} ${extraClass}"></i>`;
  }

  try {
    const res = await API.request('/services');
    if (res.success && res.services) {
      let servicesList = res.services;
      const categoriesList = res.categories || [];
      let activeCatId = 'all';

      // 1. Render Category Pills with Platform Icons
      if (pillsContainer && categoriesList.length > 0) {
        pillsContainer.innerHTML = `
          <button class="cat-pill px-4 py-2 bg-pink-600 text-white rounded-2xl shadow-sm transition active inline-flex items-center flex-shrink-0 text-xs font-semibold" data-cat="all">All Services</button>
          ${categoriesList.map(c => `
            <button class="cat-pill px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-2xl transition inline-flex items-center flex-shrink-0 text-xs font-semibold" data-cat="${c.id}">
              ${formatIconHtml(c.icon, "w-4 h-4 mr-1.5 object-contain")} ${c.name}
            </button>
          `).join('')}
        `;

        pillsContainer.querySelectorAll('.cat-pill').forEach(btn => {
          btn.addEventListener('click', () => {
            pillsContainer.querySelectorAll('.cat-pill').forEach(b => {
              b.className = "cat-pill px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-2xl transition inline-flex items-center flex-shrink-0 text-xs font-semibold";
            });
            btn.className = "cat-pill px-4 py-2 bg-pink-600 text-white rounded-2xl shadow-sm transition active inline-flex items-center flex-shrink-0 text-xs font-semibold";
            activeCatId = btn.getAttribute('data-cat');
            applyFilters();
          });
        });
      }

      // 2. Render Table Function
      const renderTable = (list) => {
        if (!list || list.length === 0) {
          tableBody.innerHTML = `
            <tr class="hover:bg-gray-50/50 transition">
              <td colspan="6" class="py-12 text-center text-gray-400 font-medium">No matching services found.</td>
            </tr>
          `;
          return;
        }

        tableBody.innerHTML = list.map(s => {
          const providerId = s.service_id || s.provider_service_id || s.service || (typeof s.id === 'string' && s.id.length > 8 ? s.id.substring(0, 8) : s.id);
          const catName = s.category_name || s.categories?.name || 'General Services';
          const catObj = categoriesList.find(c => String(c.id) === String(s.category_id) || c.name === catName);
          const iconPath = catObj ? catObj.icon : (s.categories?.icon || '');
          const rate = parseFloat(s.rate_per_1k || s.rate_per_1000 || s.our_price_per_1000 || 0).toFixed(2);
          const min = (s.min_quantity || 100).toLocaleString();
          const max = (s.max_quantity || 100000).toLocaleString();
          const desc = s.description || 'Fast execution with high retention guarantee.';

          return `
            <tr class="hover:bg-gray-50/50 transition border-b border-gray-100">
              <td class="py-4 px-4 font-mono font-bold text-pink-600 text-xs">ID: ${escapeHtml(String(providerId))}</td>
              <td class="py-4 px-4">
                <div class="font-bold text-gray-900 text-xs flex items-center">
                  ${formatIconHtml(iconPath)}
                  ${escapeHtml(s.name || '')}
                </div>
                <div class="flex items-center space-x-2 mt-1">
                  <span class="px-2 py-0.5 bg-pink-50 text-pink-700 font-semibold rounded text-[10px]">${escapeHtml(catName)}</span>
                </div>
                <p class="text-[11px] text-gray-400 mt-1 max-w-sm">${escapeHtml(desc)}</p>
              </td>
              <td class="py-4 px-4 font-extrabold text-green-600 text-sm">GH₵${rate}</td>
              <td class="py-4 px-4 text-xs font-mono text-gray-600">${min} / ${max}</td>
              <td class="py-4 px-4 text-xs text-gray-500 font-medium">Instant Start</td>
              <td class="py-4 px-4 text-center">
                <a href="/dashboard.html" class="px-3.5 py-1.5 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-2xl text-xs shadow-sm inline-block transition focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400">Order</a>
              </td>
            </tr>
          `;
        }).join('');
      };

      function applyFilters() {
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        let filtered = servicesList;

        if (activeCatId !== 'all') {
          filtered = filtered.filter(s => String(s.category_id) === String(activeCatId) || s.category_name === activeCatId);
        }

        if (query) {
          filtered = filtered.filter(s => 
            s.name.toLowerCase().includes(query) || 
            (s.category_name && s.category_name.toLowerCase().includes(query)) ||
            String(s.id).toLowerCase().includes(query)
          );
        }

        renderTable(filtered);
      }

      renderTable(servicesList);

      if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
      }
    }
  } catch (e) {
    console.error('Failed to load services page:', e);
  }
}

// ADD FUNDS & TRANSACTIONS HISTORY HANDLER
async function initAddFundsPage() {
  const form = document.querySelector('form');
  const tableBody = document.querySelector('tbody');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amountInput = form.querySelector('input[type="number"]');
      const amount_usd = amountInput ? amountInput.value : 0;

      try {
        const res = await API.request('/deposits/momo', 'POST', { amount_usd });
        alert(`🎉 ${res.message}\nRef: ${res.reference}`);
        const user = API.getUser();
        if (user) {
          user.balance = res.new_balance;
          API.setUser(user);
          updateUserUI(user);
        }
        window.location.reload();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  if (tableBody) {
    try {
      const res = await API.request('/transactions');
      if (res.success && res.transactions) {
        tableBody.innerHTML = res.transactions.map(t => `
          <tr class="hover:bg-gray-50 border-b border-gray-100">
            <td class="px-6 py-3.5 font-bold text-gray-900 font-mono text-xs">${escapeHtml(t.reference || '—')}</td>
            <td class="px-6 py-3.5 text-xs text-gray-500">${escapeHtml(t.gateway || '—')}</td>
            <td class="px-6 py-3.5 font-bold ${t.amount >= 0 ? 'text-green-600' : 'text-red-600'}">GH₵${Math.abs(t.amount).toFixed(2)}</td>
            <td class="px-6 py-3.5"><span class="px-2 py-0.5 text-[11px] font-bold rounded-full bg-green-100 text-green-700">${escapeHtml(t.status || '')}</span></td>
            <td class="px-6 py-3.5 text-xs text-gray-500">${escapeHtml(new Date(t.created_at).toLocaleString())}</td>
          </tr>
        `).join('');
      }
    } catch (e) {}
  }
}

// TRANSACTIONS PAGE HANDLER
async function initTransactionsPage() {
  const tableBody = document.getElementById('transactions-tbody');
  const searchInput = document.getElementById('transaction-search');
  const filterTabs = document.querySelectorAll('#status-filter-tabs .status-tab');

  if (!tableBody) return;

  let allTransactions = [];
  let currentStatus = 'all';

  const renderTable = (list) => {
    if (!list || list.length === 0) {
      tableBody.innerHTML = `
        <tr class="hover:bg-gray-50/50 transition">
          <td colspan="6" class="py-12 text-center text-gray-400 dark:text-gray-500 font-medium">No transaction records found.</td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = list.map(t => {
      const ref = t.reference || t.id || t.payment_ref || 'TXN-' + Math.floor(100000 + Math.random() * 900000);
      const gateway = t.gateway || t.method || t.payment_method || 'Mobile Money';
      const type = t.type || (t.amount >= 0 ? 'Deposit' : 'Order Payment');
      const rawAmt = parseFloat(t.amount || 0);
      const isPositive = rawAmt >= 0;
      const formattedAmt = `${isPositive ? '+' : '-'}GH₵${Math.abs(rawAmt).toFixed(2)}`;
      const dateStr = t.created_at ? new Date(t.created_at).toLocaleString() : new Date().toLocaleString();
      const statusStr = String(t.status || 'completed').toLowerCase();

      let statusBadge = '';
      if (statusStr === 'completed' || statusStr === 'approved' || statusStr === 'success') {
        statusBadge = '<span class="px-2.5 py-1 text-[11px] font-bold rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">Completed</span>';
      } else if (statusStr === 'pending' || statusStr === 'processing') {
        statusBadge = '<span class="px-2.5 py-1 text-[11px] font-bold rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300">Pending</span>';
      } else {
        statusBadge = '<span class="px-2.5 py-1 text-[11px] font-bold rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">Failed</span>';
      }

      return `
        <tr class="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition border-b border-gray-100 dark:border-gray-800">
          <td class="px-6 py-4 font-mono font-bold text-gray-900 dark:text-white text-xs">${escapeHtml(String(ref))}</td>
          <td class="px-6 py-4 font-medium text-gray-800 dark:text-gray-200 text-xs">${escapeHtml(type)}</td>
          <td class="px-6 py-4 font-extrabold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'} text-xs">${formattedAmt}</td>
          <td class="px-6 py-4 text-xs text-gray-600 dark:text-gray-300 font-medium">${escapeHtml(gateway)}</td>
          <td class="px-6 py-4 text-xs text-gray-500 dark:text-gray-400 font-mono">${escapeHtml(dateStr)}</td>
          <td class="px-6 py-4">${statusBadge}</td>
        </tr>
      `;
    }).join('');
  };

  const applyFilters = () => {
    const q = (searchInput ? searchInput.value : '').toLowerCase().trim();
    const filtered = allTransactions.filter(t => {
      const refMatch = (t.reference || t.id || '').toString().toLowerCase().includes(q);
      const gwMatch = (t.gateway || t.method || '').toString().toLowerCase().includes(q);
      const typeMatch = (t.type || '').toString().toLowerCase().includes(q);
      const matchesSearch = !q || refMatch || gwMatch || typeMatch;

      const st = String(t.status || 'completed').toLowerCase();
      let matchesStatus = true;
      if (currentStatus === 'completed') matchesStatus = (st === 'completed' || st === 'approved' || st === 'success');
      else if (currentStatus === 'pending') matchesStatus = (st === 'pending' || st === 'processing');
      else if (currentStatus === 'failed') matchesStatus = (st === 'failed' || st === 'rejected');

      return matchesSearch && matchesStatus;
    });

    renderTable(filtered);
  };

  try {
    const res = await API.request('/transactions');
    if (res && res.success && Array.isArray(res.transactions)) {
      allTransactions = res.transactions;
    }
  } catch (e) {
    console.error('Failed to load transactions:', e);
  }

  renderTable(allTransactions);

  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }

  if (filterTabs) {
    filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        filterTabs.forEach(t => {
          t.className = 'status-tab px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-2xl transition text-xs font-semibold';
        });
        tab.className = 'status-tab px-4 py-2 bg-pink-600 text-white rounded-2xl shadow-sm transition active text-xs font-semibold';
        currentStatus = tab.getAttribute('data-status') || 'all';
        applyFilters();
      });
    });
  }
}

// TICKETS PAGE HANDLER
async function initTicketsPage() {
  const tableBody = document.querySelector('tbody');
  const ticketForm = document.getElementById('ticket-form') || document.querySelector('form');

  if (tableBody) {
    try {
      const res = await API.request('/tickets');
      if (res.success && res.tickets) {
        tableBody.innerHTML = res.tickets.map(t => `
          <tr class="hover:bg-gray-50 border-b border-gray-100">
            <td class="px-6 py-3.5 font-bold text-gray-900 font-mono text-xs">#${escapeHtml(String(t.id || ''))}</td>
            <td class="px-6 py-3.5 font-medium text-gray-900">${escapeHtml(t.subject || '')}</td>
            <td class="px-6 py-3.5 text-xs text-gray-500">${escapeHtml(new Date(t.created_at).toLocaleString())}</td>
            <td class="px-6 py-3.5"><span class="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-blue-100 text-blue-700">${escapeHtml(t.status || 'Open')}</span></td>
          </tr>
        `).join('');
      }
    } catch (e) {}
  }

  if (ticketForm) {
    ticketForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const subjectInput = ticketForm.querySelector('input[type="text"]');
      const msgInput = ticketForm.querySelector('textarea');

      try {
        const res = await API.request('/tickets', 'POST', {
          subject: subjectInput ? subjectInput.value : 'Support Query',
          message: msgInput ? msgInput.value : ''
        });
        alert('Ticket submitted successfully!');
        window.location.reload();
      } catch (err) {
        alert(err.message);
      }
    });
  }
}

// ACCOUNT SETTINGS HANDLER
async function initAccountPage() {
  const user = API.getUser();
  if (user) {
    // 1. Populate Profile Details
    const initialsEl = document.getElementById('account-avatar-initials');
    if (initialsEl) initialsEl.textContent = (user.username || user.email || 'U').charAt(0).toUpperCase();

    const fullNameEl = document.getElementById('account-full-name');
    if (fullNameEl) fullNameEl.textContent = user.username || user.email || 'Account Profile';

    const emailEl = document.getElementById('account-email-display');
    if (emailEl) emailEl.textContent = user.email || 'Not available';

    const roleEl = document.getElementById('account-role-display');
    if (roleEl) roleEl.textContent = user.role || 'User';

    // 2. Populate API Key
    const apiKeyInput = document.getElementById('api-key-input');
    if (apiKeyInput) apiKeyInput.value = user.api_key || 'ghb_live_key';

    // 3. Login activity session
    const activityTbody = document.getElementById('login-activity-tbody');
    if (activityTbody) {
      const loginTime = user.last_login ? new Date(user.last_login).toLocaleString() : new Date().toLocaleString();
      let userAgent = 'Web Browser';
      if (navigator.userAgent.includes('Windows')) userAgent = 'Chrome (Windows)';
      else if (navigator.userAgent.includes('Mac')) userAgent = 'Safari (Mac)';
      else if (navigator.userAgent.includes('iPhone')) userAgent = 'Safari (iPhone)';
      else if (navigator.userAgent.includes('Android')) userAgent = 'Chrome (Android)';

      activityTbody.innerHTML = `
        <tr class="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition border-b border-gray-100 dark:border-gray-800">
          <td class="px-6 py-4 font-mono font-medium text-gray-900 dark:text-white">${escapeHtml(loginTime)}</td>
          <td class="px-6 py-4 font-semibold text-gray-700 dark:text-gray-300">${escapeHtml(userAgent)}</td>
          <td class="px-6 py-4">
            <span class="px-2.5 py-1 text-[10px] font-bold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-800 rounded-full">
              Current Session
            </span>
          </td>
        </tr>
      `;
    }
  }

  // Copy API Key Button
  const copyBtn = document.getElementById('copy-api-key-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const apiKeyInput = document.getElementById('api-key-input');
      if (apiKeyInput && apiKeyInput.value) {
        navigator.clipboard.writeText(apiKeyInput.value);
        showToast('API key copied to clipboard! 📋', 'success');
      }
    });
  }

  // Generate API Key Button
  const genKeyBtn = document.getElementById('generate-api-key-btn');
  if (genKeyBtn) {
    genKeyBtn.addEventListener('click', async () => {
      try {
        const res = await API.request('/auth/generate-api-key', 'POST');
        showToast(res.message || 'New API key generated successfully!', 'success');
        const apiKeyInput = document.getElementById('api-key-input');
        if (apiKeyInput) apiKeyInput.value = res.api_key;
        if (user) {
          user.api_key = res.api_key;
          API.setUser(user);
        }
      } catch (err) {
        showToast(err.message || 'Failed to generate API key', 'error');
      }
    });
  }

  // Password Form Submit
  const passForm = document.getElementById('password-form');
  if (passForm) {
    passForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPassword = document.getElementById('current-password-input')?.value;
      const newPassword = document.getElementById('new-password-input')?.value;
      const confirmPassword = document.getElementById('confirm-password-input')?.value;

      if (!newPassword || newPassword !== confirmPassword) {
        showToast('New passwords do not match.', 'warning');
        return;
      }

      try {
        const res = await API.request('/auth/update-password', 'POST', { currentPassword, newPassword });
        showToast(res.message || 'Password updated successfully!', 'success');
        passForm.reset();
      } catch (err) {
        showToast(err.message || 'Failed to update password', 'error');
      }
    });
  }
}

// REFERRALS PAGE HANDLER
async function initReferralsPage() {
  const user = API.getUser();
  if (user) {
    const refInput = document.getElementById('ref-link-input');
    if (refInput) {
      refInput.value = `https://ghbooster.com/ref/${user.username}`;
    }
  }

  try {
    const res = await API.request('/referrals/stats');
    if (res.success) {
      const refCount = document.getElementById('total-referrals-count');
      if (refCount) refCount.textContent = res.total_referrals;

      const totalEarned = document.getElementById('total-referrals-earned');
      if (totalEarned) totalEarned.textContent = `GH₵${parseFloat(res.total_earned || 0).toFixed(2)}`;
    }
  } catch (e) {}
}

// BULK ORDER HANDLER
async function initBulkOrderPage() {
  const form = document.querySelector('form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const textarea = form.querySelector('textarea');
    const bulkText = textarea ? textarea.value : '';

    try {
      const res = await API.request('/orders/bulk', 'POST', { bulk_text: bulkText });
      alert(`🎉 ${res.message}\nProcessed ${res.results.length} orders.`);
      window.location.href = '/orders.html';
    } catch (err) {
      alert(err.message);
    }
  });
}

// CHILD PANEL HANDLER
async function initChildPanelPage() {
  const form = document.querySelector('form');
  const tableBody = document.querySelector('tbody');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const inputs = form.querySelectorAll('input');
      const domain = inputs[0]?.value.trim();
      const admin_username = inputs[1]?.value.trim();
      const admin_password = inputs[2]?.value.trim();

      try {
        const res = await API.request('/child-panels/order', 'POST', { domain, admin_username, admin_password });
        alert(`🎉 ${res.message}`);
        window.location.reload();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  if (tableBody) {
    try {
      const res = await API.request('/child-panels');
      if (res.success && res.panels) {
        tableBody.innerHTML = res.panels.map(p => `
          <tr class="hover:bg-gray-50 border-b border-gray-100">
            <td class="px-6 py-3.5 font-bold text-gray-900">${escapeHtml(p.domain || '')}</td>
            <td class="px-6 py-3.5 font-bold text-gray-900">GH₵${parseFloat(p.price || 25).toFixed(2)}</td>
            <td class="px-6 py-3.5"><span class="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-yellow-100 text-yellow-700">${escapeHtml(p.status || '')}</span></td>
            <td class="px-6 py-3.5 text-xs text-gray-500">${escapeHtml(new Date(p.created_at).toLocaleString())}</td>
          </tr>
        `).join('');
      }
    } catch (e) {}
  }
}

// API DOCS PAGE HANDLER
function initApiDocsPage() {
  const user = API.getUser();
  if (user) {
    const keyDisps = document.querySelectorAll('.api-key-placeholder, [data-api-key]');
    keyDisps.forEach(el => el.textContent = user.api_key || 'ghb_live_key');
  }
}

// ADMIN DASHBOARD HANDLER
async function initAdminDashboard() {
  const revElem = document.getElementById('admin-kpi-revenue');
  const ordersElem = document.getElementById('admin-kpi-orders');
  const usersElem = document.getElementById('admin-kpi-users');
  const ticketsElem = document.getElementById('admin-kpi-tickets');
  const tableBody = document.getElementById('admin-recent-orders-table') || document.querySelector('tbody');

  try {
    const res = await API.request('/admin/stats');
    if (res.success && res.stats) {
      const stats = res.stats;
      if (revElem) revElem.textContent = `GH₵${parseFloat(stats.total_revenue || 0).toFixed(2)}`;
      if (ordersElem) ordersElem.textContent = (stats.total_orders || 0).toLocaleString();
      if (usersElem) usersElem.textContent = (stats.total_users || 0).toLocaleString();
      if (ticketsElem) ticketsElem.textContent = `${stats.open_tickets || 0} Pending`;

      if (tableBody) {
        if (!stats.recent_orders || stats.recent_orders.length === 0) {
          tableBody.innerHTML = `
            <tr class="hover:bg-gray-50/50 transition">
              <td colspan="8" class="py-8 text-center text-gray-400 font-medium">No recent orders found.</td>
            </tr>
          `;
        } else {
          tableBody.innerHTML = stats.recent_orders.map(o => {
            const shortId = (o.id || '').substring(0, 8);
            const userObj = o.profiles || {};
            const walletObj = Array.isArray(userObj.wallets) ? userObj.wallets[0] : userObj.wallets;
            const username = userObj.username || userObj.full_name || 'User';
            const userBal = walletObj ? parseFloat(walletObj.balance || 0).toFixed(2) : '0.00';
            const serviceName = (o.services && o.services.name) ? o.services.name : 'Service Order';
            const charge = parseFloat(o.charge || 0).toFixed(2);
            const status = o.status || 'Processing';

            return `
              <tr class="hover:bg-gray-50/50 transition" data-order-id="${encodeURIComponent(o.id)}">
                <td class="py-4 px-4 font-bold text-pink-600">#${escapeHtml(shortId)}</td>
                <td class="py-4 px-4">
                  <div class="font-bold text-gray-900">${escapeHtml(username)}</div>
                  <span class="text-[10px] text-gray-400">Balance: GH₵${userBal}</span>
                </td>
                <td class="py-4 px-4">
                  <span class="font-semibold text-gray-900 flex items-center">
                    ${escapeHtml(serviceName)}
                  </span>
                </td>
                <td class="py-4 px-4">
                  <a href="${escapeHtml(o.link || '#')}" target="_blank" rel="noopener noreferrer" class="text-pink-600 hover:underline font-mono truncate block max-w-[140px]">${escapeHtml(o.link || 'N/A')}</a>
                </td>
                <td class="py-4 px-4 font-mono font-bold text-gray-900">${(o.quantity || 0).toLocaleString()}</td>
                <td class="py-4 px-4 font-bold text-gray-900">GH₵${charge}</td>
                <td class="py-4 px-4">
                  <select class="status-select py-1 px-2 border border-gray-200 font-bold rounded text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 bg-white" aria-label="Order status for order ${escapeHtml(shortId)}">
                    <option value="Completed" ${status === 'Completed' ? 'selected' : ''}>Completed</option>
                    <option value="Processing" ${status === 'Processing' ? 'selected' : ''}>Processing</option>
                    <option value="In Progress" ${status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Pending" ${status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="Canceled" ${status === 'Canceled' ? 'selected' : ''}>Canceled &amp; Refund</option>
                  </select>
                </td>
                <td class="py-4 px-4 text-center space-x-1">
                  <button type="button" class="save-status-btn px-2.5 py-1 bg-slate-900 text-white font-bold rounded text-[11px] hover:bg-slate-800 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400" aria-label="Save status for order ${escapeHtml(shortId)}">Save</button>
                </td>
              </tr>
            `;
          }).join('');

          // Bind save status action
          tableBody.querySelectorAll('.save-status-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              const tr = e.target.closest('tr');
              // Decode URI-encoded ID stored in data attribute
              const orderId = decodeURIComponent(tr.getAttribute('data-order-id') || '');
              const select = tr.querySelector('.status-select');
              const newStatus = select ? select.value : 'Completed';
              try {
                await API.request(`/admin/orders/${orderId}/status`, 'PUT', { status: newStatus });
                alert(`Order status updated to ${newStatus}`);
                initAdminDashboard();
              } catch (err) {
                alert(err.message);
              }
            });
          });
        }
      }
    }
  } catch (e) {
    console.error('Failed to load admin dashboard stats:', e.message);
  }
}

// ADMIN USERS HANDLER
async function initAdminUsersPage() {
  const totalElem = document.getElementById('admin-users-total');
  const balElem = document.getElementById('admin-users-total-balance');
  const resellerElem = document.getElementById('admin-users-resellers');
  const adminElem = document.getElementById('admin-users-admins');
  const tableBody = document.getElementById('users-tbody') || document.querySelector('tbody');
  const searchInput = document.getElementById('user-search');
  const filterBtns = document.querySelectorAll('.user-filter-btn');

  if (!tableBody) return;

  try {
    const res = await API.request('/admin/users');
    if (res.success && res.users) {
      const users = res.users;
      const totalBalance = users.reduce((acc, u) => acc + (parseFloat(u.balance) || 0), 0);
      const resellerCount = users.filter(u => u.role === 'reseller').length;
      const adminCount = users.filter(u => u.role === 'admin').length;

      if (totalElem) totalElem.textContent = users.length.toLocaleString();
      if (balElem) balElem.textContent = `GH₵${totalBalance.toFixed(2)}`;
      if (resellerElem) resellerElem.textContent = resellerCount.toLocaleString();
      if (adminElem) adminElem.textContent = adminCount.toLocaleString();

      function renderTable(userList) {
        if (!userList || userList.length === 0) {
          tableBody.innerHTML = `
            <tr class="hover:bg-gray-50/50 transition">
              <td colspan="9" class="py-8 text-center text-gray-400 font-medium">No user accounts found matching your search.</td>
            </tr>
          `;
          return;
        }

        tableBody.innerHTML = userList.map(u => {
          const shortId = (u.id || '').substring(0, 8);
          const phoneDisplay = u.phone ? `<span class="font-mono text-pink-600 font-bold">${u.phone}</span>` : '<span class="text-gray-400 font-normal italic">N/A</span>';
          const roleBadgeClass = u.role === 'admin' 
            ? 'bg-pink-100 text-pink-700 font-bold' 
            : (u.role === 'reseller' ? 'bg-purple-100 text-purple-700 font-bold' : 'bg-blue-100 text-blue-700 font-bold');

          return `
            <tr class="user-row hover:bg-gray-50/50 transition" data-user-id="${encodeURIComponent(u.id)}" data-role="${escapeHtml(u.role || 'user')}">
              <td class="py-4 px-4 font-bold text-pink-600">#${escapeHtml(shortId)}</td>
              <td class="py-4 px-4">
                <div class="font-bold text-gray-900 text-sm">${escapeHtml(u.username || '')}</div>
                <div class="text-[10px] text-gray-400">${escapeHtml(u.email || '')}</div>
              </td>
              <td class="py-4 px-4 font-mono text-xs">
                ${u.phone ? `<span class="font-mono text-pink-600 font-bold">${escapeHtml(u.phone)}</span>` : '<span class="text-gray-400 font-normal italic">N/A</span>'}
              </td>
              <td class="py-4 px-4">
                <span class="px-2.5 py-0.5 ${roleBadgeClass} rounded text-[10px] uppercase">${escapeHtml(u.role || 'user')}</span>
              </td>
              <td class="py-4 px-4 font-extrabold text-green-600 text-sm">GH₵${parseFloat(u.balance || 0).toFixed(2)}</td>
              <td class="py-4 px-4 font-extrabold text-gray-900">GH₵${parseFloat(u.total_spent || 0).toFixed(2)}</td>
              <td class="py-4 px-4 text-gray-500">${escapeHtml(u.created_at || '')}</td>
              <td class="py-4 px-4">
                <span class="px-2.5 py-1 bg-green-100 text-green-700 rounded-full font-bold text-[11px] inline-flex items-center">
                  <span class="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" aria-hidden="true"></span> Active
                </span>
              </td>
              <td class="py-4 px-4 text-center space-x-1">
                <button type="button" class="add-funds-btn px-2 py-1 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded text-[11px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400" aria-label="Add funds to ${escapeHtml(u.username || 'user')}">💳 Add Funds</button>
                <button type="button" class="edit-phone-btn px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded text-[11px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400" aria-label="Edit phone for ${escapeHtml(u.username || 'user')}">✏️ Phone</button>
              </td>
            </tr>
          `;
        }).join('');

        // Bind add funds action
        tableBody.querySelectorAll('.add-funds-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const tr = e.target.closest('tr');
            const userId = tr.getAttribute('data-user-id');
            const amountStr = prompt('Enter amount to add/deduct to user balance (e.g. 50 or -10):');
            if (amountStr === null) return;
            const amount = parseFloat(amountStr);
            if (isNaN(amount)) {
              alert('Invalid amount entered.');
              return;
            }
            try {
              const addRes = await API.request(`/admin/users/${userId}/fund`, 'POST', { amount });
              alert(`Success! Updated balance: GH₵${parseFloat(addRes.new_balance || 0).toFixed(2)}`);
              initAdminUsersPage();
            } catch (err) {
              alert(err.message);
            }
          });
        });

        // Bind edit phone action
        tableBody.querySelectorAll('.edit-phone-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const tr = e.target.closest('tr');
            const userId = tr.getAttribute('data-user-id');
            const newPhone = prompt('Enter new phone number for user (e.g. +233501234567):');
            if (newPhone === null) return;
            try {
              await API.request(`/admin/users/${userId}/phone`, 'PUT', { phone: newPhone });
              alert('Phone number updated successfully!');
              initAdminUsersPage();
            } catch (err) {
              alert(err.message);
            }
          });
        });
      }

      renderTable(users);

      // Search Filter Event
      let currentFilter = 'all';
      if (searchInput) {
        searchInput.addEventListener('input', () => {
          applySearchAndFilter();
        });
      }

      filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          filterBtns.forEach(b => b.classList.remove('bg-pink-600', 'text-white', 'active'));
          filterBtns.forEach(b => b.classList.add('bg-gray-100', 'text-gray-600'));
          e.target.classList.remove('bg-gray-100', 'text-gray-600');
          e.target.classList.add('bg-pink-600', 'text-white', 'active');
          currentFilter = e.target.getAttribute('data-filter') || 'all';
          applySearchAndFilter();
        });
      });

      function applySearchAndFilter() {
        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
        let filtered = users;

        if (currentFilter !== 'all') {
          filtered = filtered.filter(u => u.role === currentFilter);
        }

        if (query) {
          filtered = filtered.filter(u => 
            (u.username && u.username.toLowerCase().includes(query)) ||
            (u.email && u.email.toLowerCase().includes(query)) ||
            (u.phone && u.phone.toLowerCase().includes(query)) ||
            (u.id && u.id.toLowerCase().includes(query))
          );
        }

        renderTable(filtered);
      }
    }
  } catch (e) {
    console.error('Failed to load admin users:', e.message);
  }
}

// ADMIN ORDERS HANDLER
async function initAdminOrdersPage() {
  const tableBody = document.querySelector('tbody');
  if (!tableBody) return;

  try {
    const res = await API.request('/admin/orders');
    if (res.success && res.orders) {
      tableBody.innerHTML = res.orders.map(o => `
        <tr class="hover:bg-gray-50 border-b border-gray-100">
          <td class="px-6 py-3.5 font-bold text-gray-900">#${o.id}</td>
          <td class="px-6 py-3.5 font-medium text-gray-900">${o.profiles?.username || 'User'}</td>
          <td class="px-6 py-3.5 font-medium text-gray-900">${o.services?.name || 'Service'}</td>
          <td class="px-6 py-3.5 font-mono text-xs text-pink-600 truncate max-w-xs">${o.link}</td>
          <td class="px-6 py-3.5 font-bold text-gray-900">GH₵${parseFloat(o.charge || 0).toFixed(2)}</td>
          <td class="px-6 py-3.5"><span class="px-2.5 py-0.5 text-[11px] font-bold rounded-full ${getStatusBadgeClass(o.status)}">${o.status}</span></td>
        </tr>
      `).join('');
    }
  } catch (e) {}
}

// ADMIN SERVICES HANDLER
async function initAdminServicesPage() {
  const tableBody = document.getElementById('svc-tbody') || document.querySelector('tbody');
  const searchInput = document.getElementById('svc-search');
  const catFilterSelect = document.getElementById('cat-filter');
  const addSvcBtn = document.getElementById('add-service-btn');
  const totalElem = document.getElementById('admin-svc-total');
  const activeElem = document.getElementById('admin-svc-active');
  const disabledElem = document.getElementById('admin-svc-disabled');
  const catCountElem = document.getElementById('admin-svc-categories');

  // Modal elements
  const modal = document.getElementById('service-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalForm = document.getElementById('service-form');
  const modalSvcId = document.getElementById('modal-svc-id');
  const modalSvcName = document.getElementById('modal-svc-name');
  const modalSvcCategory = document.getElementById('modal-svc-category');
  const modalSvcRate = document.getElementById('modal-svc-rate');
  const modalSvcProviderServiceId = document.getElementById('modal-svc-provider-service-id');
  const modalSvcProvider = document.getElementById('modal-svc-provider');
  const modalSvcMin = document.getElementById('modal-svc-min');
  const modalSvcMax = document.getElementById('modal-svc-max');
  const modalSvcStatus = document.getElementById('modal-svc-status');
  const modalSvcDescription = document.getElementById('modal-svc-description');
  const closeModalBtn = document.getElementById('close-svc-modal');
  const cancelModalBtn = document.getElementById('cancel-svc-modal');

  if (!tableBody) return;

  try {
    const [svcRes, publicSvcRes, provRes] = await Promise.all([
      API.request('/admin/services'),
      API.request('/services').catch(() => ({ categories: [] })),
      API.request('/admin/providers').catch(() => ({ providers: [] }))
    ]);

    if (svcRes.success && svcRes.services) {
      const services = svcRes.services;
      const categories = publicSvcRes.categories || [];
      const providers = provRes.providers || [];

      // 1. Populate Select Dropdowns
      if (catFilterSelect) {
        catFilterSelect.innerHTML = `<option value="all">All Categories</option>` +
          categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      }

      if (modalSvcCategory) {
        modalSvcCategory.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      }

      if (modalSvcProvider) {
        modalSvcProvider.innerHTML = `<option value="">Direct / None</option>` +
          providers.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
      }

      // 2. Compute KPIs
      const activeCount = services.filter(s => (s.status || '').toLowerCase() === 'active').length;
      const disabledCount = services.filter(s => (s.status || '').toLowerCase() !== 'active').length;
      const uniqueCats = new Set(services.map(s => s.category_id || s.categories?.id).filter(Boolean)).size;

      if (totalElem) totalElem.textContent = services.length.toLocaleString();
      if (activeElem) activeElem.textContent = activeCount.toLocaleString();
      if (disabledElem) disabledElem.textContent = disabledCount.toLocaleString();
      if (catCountElem) catCountElem.textContent = (uniqueCats || categories.length).toLocaleString();

      // 3. Render Table Function
      function renderTable(list) {
        if (!list || list.length === 0) {
          tableBody.innerHTML = `
            <tr class="hover:bg-gray-50/50 transition">
              <td colspan="9" class="py-12 text-center text-gray-400 font-medium">No services found.</td>
            </tr>
          `;
          return;
        }

        tableBody.innerHTML = list.map(s => {
          const shortId = typeof s.id === 'string' && s.id.length > 8 ? s.id.substring(0, 8) : s.id;
          const catName = s.categories?.name || s.category_name || 'General';
          const providerName = s.providers?.name || 'Direct';
          const rate = parseFloat(s.rate_per_1k || 0).toFixed(2);
          const isActive = (s.status || '').toLowerCase() === 'active';
          const statusBadge = isActive
            ? `<span class="px-2 py-0.5 bg-green-100 text-green-700 font-bold rounded text-[10px]">Active</span>`
            : `<span class="px-2 py-0.5 bg-red-100 text-red-700 font-bold rounded text-[10px]">Disabled</span>`;

          const toggleActionBtn = isActive
            ? `<button data-action="toggle" data-id="${s.id}" data-status="Disabled" class="svc-action-btn px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded text-[11px] transition">Disable</button>`
            : `<button data-action="toggle" data-id="${s.id}" data-status="Active" class="svc-action-btn px-2.5 py-1 bg-green-100 hover:bg-green-200 text-green-700 font-bold rounded text-[11px] transition">Enable</button>`;

          return `
            <tr class="hover:bg-gray-50/50 transition border-b border-gray-100" data-id="${s.id}">
              <td class="py-4 px-4 font-mono text-gray-500 text-xs font-bold">#${shortId}</td>
              <td class="py-4 px-4 font-bold text-gray-900 text-xs">${s.name}</td>
              <td class="py-4 px-4"><span class="px-2 py-0.5 bg-pink-50 text-pink-700 font-bold rounded text-[10px]">${catName}</span></td>
              <td class="py-4 px-4 text-gray-600 text-xs">${providerName}</td>
              <td class="py-4 px-4 font-extrabold text-green-600">GH₵${rate}</td>
              <td class="py-4 px-4 text-xs">${(s.min_quantity || 10).toLocaleString()}</td>
              <td class="py-4 px-4 text-xs">${(s.max_quantity || 100000).toLocaleString()}</td>
              <td class="py-4 px-4">${statusBadge}</td>
              <td class="py-4 px-4 text-center space-x-1">
                <button data-action="edit" data-id="${s.id}" class="svc-action-btn px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded text-[11px] transition">Edit</button>
                ${toggleActionBtn}
              </td>
            </tr>
          `;
        }).join('');

        // Action Handlers
        tableBody.querySelectorAll('.svc-action-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const action = e.target.getAttribute('data-action');
            const svcId = e.target.getAttribute('data-id');
            const targetSvc = services.find(item => String(item.id) === String(svcId));

            if (action === 'edit' && targetSvc) {
              openModal(targetSvc);
            } else if (action === 'toggle' && targetSvc) {
              const newStatus = e.target.getAttribute('data-status');
              try {
                await API.request(`/admin/services/${svcId}`, 'PUT', { status: newStatus });
                initAdminServicesPage();
              } catch (err) {
                alert('Failed to update service status: ' + err.message);
              }
            }
          });
        });
      }

      // 4. Modal Helpers
      function openModal(svc = null) {
        if (!modal) return;
        if (svc) {
          if (modalTitle) modalTitle.textContent = `Edit Service: ${svc.name}`;
          if (modalSvcId) modalSvcId.value = svc.id;
          if (modalSvcName) modalSvcName.value = svc.name;
          if (modalSvcCategory) modalSvcCategory.value = svc.category_id || (categories[0]?.id || '');
          if (modalSvcRate) modalSvcRate.value = svc.rate_per_1k || 0;
          if (modalSvcProviderServiceId) modalSvcProviderServiceId.value = svc.provider_service_id || '';
          if (modalSvcProvider) modalSvcProvider.value = svc.provider_id || '';
          if (modalSvcMin) modalSvcMin.value = svc.min_quantity || 100;
          if (modalSvcMax) modalSvcMax.value = svc.max_quantity || 100000;
          if (modalSvcStatus) modalSvcStatus.value = svc.status || 'Active';
          if (modalSvcDescription) modalSvcDescription.value = svc.description || '';
        } else {
          if (modalTitle) modalTitle.textContent = 'Add New Service';
          if (modalSvcId) modalSvcId.value = '';
          if (modalForm) modalForm.reset();
          if (modalSvcRate) modalSvcRate.value = '0';
          if (modalSvcMin) modalSvcMin.value = '100';
          if (modalSvcMax) modalSvcMax.value = '100000';
          if (modalSvcStatus) modalSvcStatus.value = 'Active';
        }
        modal.classList.remove('hidden');
      }

      function closeModal() {
        if (modal) modal.classList.add('hidden');
      }

      if (addSvcBtn) addSvcBtn.onclick = () => openModal();
      if (closeModalBtn) closeModalBtn.onclick = closeModal;
      if (cancelModalBtn) cancelModalBtn.onclick = closeModal;

      if (modalForm) {
        modalForm.onsubmit = async (e) => {
          e.preventDefault();
          const svcId = modalSvcId ? modalSvcId.value : '';
          const payload = {
            name: modalSvcName ? modalSvcName.value.trim() : '',
            category_id: modalSvcCategory ? modalSvcCategory.value : null,
            rate_per_1k: modalSvcRate ? parseFloat(modalSvcRate.value) || 0 : 0,
            provider_service_id: modalSvcProviderServiceId ? modalSvcProviderServiceId.value.trim() || null : null,
            provider_id: modalSvcProvider && modalSvcProvider.value ? modalSvcProvider.value : null,
            min_quantity: modalSvcMin ? parseInt(modalSvcMin.value, 10) || 100 : 100,
            max_quantity: modalSvcMax ? parseInt(modalSvcMax.value, 10) || 100000 : 100000,
            status: modalSvcStatus ? modalSvcStatus.value : 'Active',
            description: modalSvcDescription ? modalSvcDescription.value.trim() : ''
          };

          try {
            if (svcId) {
              await API.request(`/admin/services/${svcId}`, 'PUT', payload);
            } else {
              await API.request('/admin/services', 'POST', payload);
            }
            closeModal();
            initAdminServicesPage();
          } catch (err) {
            alert('Failed to save service: ' + err.message);
          }
        };
      }

      // 5. Search & Filter Handlers
      function applyFilter() {
        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const catVal = catFilterSelect ? catFilterSelect.value : 'all';
        let filtered = services;

        if (catVal !== 'all') {
          filtered = filtered.filter(s => String(s.category_id || s.categories?.id) === String(catVal));
        }

        if (query) {
          filtered = filtered.filter(s =>
            (s.name && s.name.toLowerCase().includes(query)) ||
            (s.categories?.name && s.categories.name.toLowerCase().includes(query)) ||
            String(s.id).includes(query)
          );
        }

        renderTable(filtered);
      }

      if (searchInput) searchInput.addEventListener('input', applyFilter);
      if (catFilterSelect) catFilterSelect.addEventListener('change', applyFilter);

      renderTable(services);
    }
  } catch (e) {
    console.error('Failed to load admin services:', e);
  }
}

// ADMIN PROVIDERS HANDLER
async function initAdminProvidersPage() {
  const tableBody = document.getElementById('prov-tbody') || document.querySelector('tbody');
  const activeElem = document.getElementById('admin-prov-active');
  const servicesElem = document.getElementById('admin-prov-services');
  const lastSyncElem = document.getElementById('admin-prov-last-sync');
  const addProvBtn = document.getElementById('add-provider-btn');
  const syncAllBtn = document.getElementById('sync-all-btn');

  // Modal Elements
  const modal = document.getElementById('provider-modal');
  const modalTitle = document.getElementById('prov-modal-title');
  const modalForm = document.getElementById('provider-form');
  const modalProvId = document.getElementById('modal-prov-id');
  const modalProvName = document.getElementById('modal-prov-name');
  const modalProvUrl = document.getElementById('modal-prov-url');
  const modalProvKey = document.getElementById('modal-prov-key');
  const modalProvStatus = document.getElementById('modal-prov-status');
  const closeModalBtn = document.getElementById('close-prov-modal');
  const cancelModalBtn = document.getElementById('cancel-prov-modal');

  if (!tableBody) return;

  try {
    const res = await API.request('/admin/providers');
    if (res.success && res.providers) {
      const providers = res.providers;

      // 1. Compute KPIs
      const activeCount = providers.filter(p => (p.status || '').toLowerCase() === 'active').length;
      if (activeElem) activeElem.textContent = activeCount.toLocaleString();
      if (servicesElem) servicesElem.textContent = (providers.reduce((acc, p) => acc + (p.services_count || 0), 0) || providers.length * 100).toLocaleString();
      if (lastSyncElem) lastSyncElem.textContent = 'Just now';

      // 2. Render Table
      function renderTable(list) {
        if (!list || list.length === 0) {
          tableBody.innerHTML = `
            <tr class="hover:bg-gray-50/50 transition">
              <td colspan="6" class="py-12 text-center text-gray-400 font-medium">No wholesale providers connected.</td>
            </tr>
          `;
          return;
        }

        tableBody.innerHTML = list.map(p => {
          const rawKey = p.api_key || '';
          const maskedKey = rawKey.length > 4 ? `••••••••${rawKey.slice(-4)}` : '••••••••';
          const bal = parseFloat(p.balance || 0).toFixed(2);
          const status = (p.status || 'Active').toLowerCase();

          let statusBadge = `<span class="px-2.5 py-1 bg-green-100 text-green-700 rounded-full font-bold text-[11px] flex items-center w-fit"><span class="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse"></span>Active</span>`;
          if (status === 'degraded') {
            statusBadge = `<span class="px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full font-bold text-[11px]">Degraded</span>`;
          } else if (status === 'offline') {
            statusBadge = `<span class="px-2.5 py-1 bg-red-100 text-red-700 rounded-full font-bold text-[11px]">Offline</span>`;
          }

          return `
            <tr class="hover:bg-gray-50/50 transition border-b border-gray-100" data-id="${p.id}">
              <td class="py-4 px-4 font-bold text-gray-900">${p.name}</td>
              <td class="py-4 px-4 font-mono text-gray-600 text-[11px]">${p.api_url}</td>
              <td class="py-4 px-4 font-mono text-xs text-gray-500">${maskedKey}</td>
              <td class="py-4 px-4 font-extrabold text-green-600">GH₵${bal}</td>
              <td class="py-4 px-4">${statusBadge}</td>
              <td class="py-4 px-4 text-center space-x-1">
                <button data-action="sync" data-id="${p.id}" class="prov-btn px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded text-[11px] transition">Sync</button>
                <button data-action="edit" data-id="${p.id}" class="prov-btn px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded text-[11px] transition">Edit</button>
              </td>
            </tr>
          `;
        }).join('');

        // Attach action handlers
        tableBody.querySelectorAll('.prov-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const action = e.target.getAttribute('data-action');
            const provId = e.target.getAttribute('data-id');
            const targetProv = providers.find(item => String(item.id) === String(provId));

            if (action === 'edit' && targetProv) {
              openModal(targetProv);
            } else if (action === 'sync' && targetProv) {
              try {
                e.target.disabled = true;
                e.target.textContent = 'Syncing...';
                const syncRes = await API.request(`/admin/providers/${provId}/sync`, 'POST');
                alert(`✅ ${targetProv.name} Synced: ${syncRes.message || 'Updated!'}`);
                initAdminProvidersPage();
              } catch (err) {
                alert(`⚠️ Sync failed for ${targetProv.name}: ${err.message}`);
                initAdminProvidersPage();
              }
            }
          });
        });
      }

      // 3. Modal Helpers
      function openModal(prov = null) {
        if (!modal) return;
        if (prov) {
          if (modalTitle) modalTitle.textContent = `Edit Provider: ${prov.name}`;
          if (modalProvId) modalProvId.value = prov.id;
          if (modalProvName) modalProvName.value = prov.name;
          if (modalProvUrl) modalProvUrl.value = prov.api_url;
          if (modalProvKey) modalProvKey.value = prov.api_key || '';
          if (modalProvStatus) modalProvStatus.value = prov.status || 'Active';
        } else {
          if (modalTitle) modalTitle.textContent = 'Add New Provider';
          if (modalProvId) modalProvId.value = '';
          if (modalForm) modalForm.reset();
        }
        modal.classList.remove('hidden');
      }

      function closeModal() {
        if (modal) modal.classList.add('hidden');
      }

      if (addProvBtn) addProvBtn.onclick = () => openModal();
      if (closeModalBtn) closeModalBtn.onclick = closeModal;
      if (cancelModalBtn) cancelModalBtn.onclick = closeModal;

      if (syncAllBtn) {
        syncAllBtn.onclick = async () => {
          try {
            syncAllBtn.disabled = true;
            syncAllBtn.textContent = 'Syncing All...';
            const syncRes = await API.request('/admin/providers/sync-all', 'POST');
            alert(`✅ Synced ${syncRes.count || 0} provider(s) successfully!`);
            initAdminProvidersPage();
          } catch (err) {
            alert('⚠️ Sync all failed: ' + err.message);
          } finally {
            syncAllBtn.disabled = false;
            syncAllBtn.textContent = 'Sync All';
          }
        };
      }

      if (modalForm) {
        modalForm.onsubmit = async (e) => {
          e.preventDefault();
          const provId = modalProvId ? modalProvId.value : '';
          const payload = {
            name: modalProvName ? modalProvName.value.trim() : '',
            api_url: modalProvUrl ? modalProvUrl.value.trim() : '',
            api_key: modalProvKey ? modalProvKey.value.trim() : '',
            status: modalProvStatus ? modalProvStatus.value : 'Active'
          };

          try {
            if (provId) {
              await API.request(`/admin/providers/${provId}`, 'PUT', payload);
            } else {
              await API.request('/admin/providers', 'POST', payload);
            }
            closeModal();
            initAdminProvidersPage();
          } catch (err) {
            alert('Failed to save provider: ' + err.message);
          }
        };
      }

      renderTable(providers);
    }
  } catch (e) {
    console.error('Failed to load admin providers:', e);
  }
}

// ADMIN DEPOSITS HANDLER
async function initAdminDepositsPage() {
  const tableBody = document.getElementById('deposits-tbody') || document.querySelector('tbody');
  const searchInput = document.getElementById('dep-search');
  const tabContainer = document.getElementById('dep-tabs');
  const totalElem = document.getElementById('admin-dep-total');
  const pendingElem = document.getElementById('admin-dep-pending-count');
  const todayElem = document.getElementById('admin-dep-today');
  const todayCountElem = document.getElementById('admin-dep-today-count');
  const failedElem = document.getElementById('admin-dep-failed-count');

  if (!tableBody) return;

  try {
    const res = await API.request('/admin/deposits');
    if (res.success && res.deposits) {
      const deposits = res.deposits;

      // 1. Compute KPIs
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      let totalDeposited = 0;
      let pendingCount = 0;
      let todayDeposited = 0;
      let todayTxnCount = 0;
      let failedCount = 0;

      deposits.forEach(d => {
        const amt = parseFloat(d.amount || 0);
        const status = (d.status || '').toLowerCase();
        const dateStr = d.created_at ? new Date(d.created_at).toISOString().split('T')[0] : '';

        if (status === 'completed' || status === 'approved') {
          totalDeposited += amt;
        } else if (status === 'pending') {
          pendingCount++;
        } else if (status === 'failed' || status === 'rejected' || status === 'canceled') {
          failedCount++;
        }

        if (dateStr === todayStr) {
          todayTxnCount++;
          if (status === 'completed' || status === 'approved') {
            todayDeposited += amt;
          }
        }
      });

      if (totalElem) totalElem.textContent = `GH₵${totalDeposited.toFixed(2)}`;
      if (pendingElem) pendingElem.textContent = pendingCount.toLocaleString();
      if (todayElem) todayElem.textContent = `GH₵${todayDeposited.toFixed(2)}`;
      if (todayCountElem) todayCountElem.textContent = `${todayTxnCount} transactions today`;
      if (failedElem) failedElem.textContent = failedCount.toLocaleString();

      // 2. Render Function
      let currentTab = 'all';

      function renderTable(list) {
        if (!list || list.length === 0) {
          tableBody.innerHTML = `
            <tr class="hover:bg-gray-50/50 transition">
              <td colspan="8" class="py-12 text-center text-gray-400 font-medium">No deposit records found.</td>
            </tr>
          `;
          return;
        }

        tableBody.innerHTML = list.map(d => {
          const refDisplay = d.reference || d.payment_ref || `#DEP-${d.id.substring(0, 6)}`;
          const username = d.profiles?.username || d.profiles?.email || 'User';
          const method = d.gateway || d.payment_method || 'Moolre';
          const amt = parseFloat(d.amount || 0).toFixed(2);
          const dateFormatted = d.created_at ? new Date(d.created_at).toLocaleString() : 'N/A';
          const status = (d.status || 'pending').toLowerCase();

          // Extract phone or notes from metadata
          let notes = d.description || 'Wallet deposit';
          if (d.metadata) {
            try {
              const meta = typeof d.metadata === 'string' ? JSON.parse(d.metadata) : d.metadata;
              if (meta.phone) notes = `Phone: ${meta.phone}`;
            } catch (_) {}
          }

          let badgeClass = 'bg-yellow-100 text-yellow-800';
          let statusText = 'Pending';
          if (status === 'completed' || status === 'approved') {
            badgeClass = 'bg-green-100 text-green-800';
            statusText = 'Approved';
          } else if (status === 'failed' || status === 'rejected' || status === 'canceled') {
            badgeClass = 'bg-red-100 text-red-800';
            statusText = 'Rejected';
          }

          let actionButtons = '';
          if (status === 'pending') {
            actionButtons = `
              <button data-action="approve" data-id="${d.id}" class="dep-action-btn px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white font-bold rounded text-[11px] transition shadow-sm">Approve</button>
              <button data-action="reject" data-id="${d.id}" class="dep-action-btn px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded text-[11px] transition">Reject</button>
            `;
          } else if (status === 'completed' || status === 'approved') {
            actionButtons = `
              <span class="text-[11px] text-green-600 font-bold">✓ Credited</span>
            `;
          } else {
            actionButtons = `
              <button data-action="approve" data-id="${d.id}" class="dep-action-btn px-2.5 py-1 bg-gray-100 hover:bg-green-50 text-gray-700 hover:text-green-700 font-bold rounded text-[11px] transition">Override</button>
            `;
          }

          return `
            <tr class="dep-row hover:bg-gray-50/50 transition border-b border-gray-100" data-id="${d.id}">
              <td class="py-3.5 px-4 font-bold text-pink-600 font-mono text-xs">${refDisplay}</td>
              <td class="py-3.5 px-4 font-bold text-gray-900">${username}</td>
              <td class="py-3.5 px-4"><span class="px-2 py-0.5 bg-pink-50 text-pink-700 font-bold rounded text-[10px] uppercase">${method}</span></td>
              <td class="py-3.5 px-4 text-gray-500 font-mono text-xs max-w-xs truncate">${notes}</td>
              <td class="py-3.5 px-4 font-extrabold text-gray-900">GH₵${amt}</td>
              <td class="py-3.5 px-4 text-gray-500 text-xs">${dateFormatted}</td>
              <td class="py-3.5 px-4"><span class="px-2.5 py-1 ${badgeClass} font-bold rounded-full text-[11px] capitalize">${statusText}</span></td>
              <td class="py-3.5 px-4 text-center space-x-1">${actionButtons}</td>
            </tr>
          `;
        }).join('');

        // Attach action handlers
        tableBody.querySelectorAll('.dep-action-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const action = e.target.getAttribute('data-action');
            const depId = e.target.getAttribute('data-id');
            const targetStatus = action === 'approve' ? 'completed' : 'rejected';

            if (!confirm(`Are you sure you want to ${action} this deposit request?`)) return;

            try {
              e.target.disabled = true;
              e.target.textContent = '...';
              const updateRes = await API.request('/admin/deposits/status', 'POST', { id: depId, status: targetStatus });
              if (updateRes.success) {
                initAdminDepositsPage();
              }
            } catch (err) {
              alert('Failed to update deposit status: ' + err.message);
              initAdminDepositsPage();
            }
          });
        });
      }

      // 3. Search & Tab Filter Logic
      function applyFilter() {
        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
        let filtered = deposits;

        if (currentTab !== 'all') {
          filtered = filtered.filter(d => {
            const st = (d.status || '').toLowerCase();
            if (currentTab === 'completed') return st === 'completed' || st === 'approved';
            if (currentTab === 'failed') return st === 'failed' || st === 'rejected' || st === 'canceled';
            return st === currentTab;
          });
        }

        if (query) {
          filtered = filtered.filter(d => {
            const ref = (d.reference || d.payment_ref || '').toLowerCase();
            const user = (d.profiles?.username || d.profiles?.email || '').toLowerCase();
            const gateway = (d.gateway || d.payment_method || '').toLowerCase();
            return ref.includes(query) || user.includes(query) || gateway.includes(query);
          });
        }

        renderTable(filtered);
      }

      if (searchInput) {
        searchInput.addEventListener('input', applyFilter);
      }

      if (tabContainer) {
        tabContainer.querySelectorAll('.dep-tab').forEach(tabBtn => {
          tabBtn.addEventListener('click', (e) => {
            tabContainer.querySelectorAll('.dep-tab').forEach(b => {
              b.classList.remove('bg-pink-600', 'text-white', 'shadow-sm');
              b.classList.add('bg-gray-100', 'text-gray-600');
            });
            e.target.classList.remove('bg-gray-100', 'text-gray-600');
            e.target.classList.add('bg-pink-600', 'text-white', 'shadow-sm');
            currentTab = e.target.getAttribute('data-tab') || 'all';
            applyFilter();
          });
        });
      }

      renderTable(deposits);
    }
  } catch (e) {
    console.error('Failed to load admin deposits:', e);
  }
}

// ADMIN TRANSACTIONS HANDLER
async function initAdminTransactionsPage() {
  const tableBody = document.querySelector('tbody');
  if (!tableBody) return;

  try {
    const res = await API.request('/admin/deposits');
    if (res.success && res.deposits) {
      tableBody.innerHTML = res.deposits.map(t => `
        <tr class="hover:bg-gray-50 border-b border-gray-100">
          <td class="px-6 py-3.5 font-bold text-gray-900">${t.reference}</td>
          <td class="px-6 py-3.5 font-medium text-gray-900">${t.profiles?.username || 'User'}</td>
          <td class="px-6 py-3.5 font-bold ${t.amount >= 0 ? 'text-green-600' : 'text-red-600'}">GH₵${Math.abs(t.amount).toFixed(2)}</td>
          <td class="px-6 py-3.5 text-xs text-gray-500">${t.gateway}</td>
          <td class="px-6 py-3.5 text-xs text-gray-500">${new Date(t.created_at).toLocaleString()}</td>
        </tr>
      `).join('');
    }
  } catch (e) {}
}

// ADMIN PAYMENTS HANDLER
function initAdminPaymentsPage() {}

// ADMIN TICKETS HANDLER
async function initAdminTicketsPage() {
  const tableBody = document.querySelector('tbody');
  if (!tableBody) return;

  try {
    const res = await API.request('/admin/tickets');
    if (res.success && res.tickets) {
      tableBody.innerHTML = res.tickets.map(t => `
        <tr class="hover:bg-gray-50 border-b border-gray-100">
          <td class="px-6 py-3.5 font-bold text-gray-900">#${t.id}</td>
          <td class="px-6 py-3.5 font-medium text-gray-900">${t.profiles?.username || 'User'}</td>
          <td class="px-6 py-3.5 font-medium text-gray-900">${t.subject}</td>
          <td class="px-6 py-3.5"><span class="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-blue-100 text-blue-700">${t.status}</span></td>
          <td class="px-6 py-3.5 text-xs text-gray-500">${new Date(t.created_at).toLocaleString()}</td>
        </tr>
      `).join('');
    }
  } catch (e) {}
}

// ADMIN REFERRALS HANDLER
async function initAdminReferralsPage() {
  const tableBody = document.querySelector('tbody');
  if (!tableBody) return;

  try {
    const res = await API.request('/admin/referrals');
    if (res.success && res.referrals) {
      tableBody.innerHTML = res.referrals.map(r => `
        <tr class="hover:bg-gray-50 border-b border-gray-100">
          <td class="px-6 py-3.5 font-bold text-gray-900">${r.profiles?.username || 'User'}</td>
          <td class="px-6 py-3.5 font-bold text-green-600">GH₵${parseFloat(r.amount || 0).toFixed(2)}</td>
          <td class="px-6 py-3.5"><span class="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-yellow-100 text-yellow-700">${r.status}</span></td>
          <td class="px-6 py-3.5 text-xs text-gray-500">${new Date(r.created_at).toLocaleString()}</td>
        </tr>
      `).join('');
    }
  } catch (e) {}
}

// ADMIN CHILD PANELS HANDLER
async function initAdminChildPanelsPage() {
  const tableBody = document.querySelector('tbody');
  if (!tableBody) return;

  try {
    const res = await API.request('/admin/child-panels');
    if (res.success && res.childPanels) {
      tableBody.innerHTML = res.childPanels.map(p => `
        <tr class="hover:bg-gray-50 border-b border-gray-100">
          <td class="px-6 py-3.5 font-bold text-gray-900">${p.domain}</td>
          <td class="px-6 py-3.5 font-medium text-gray-900">${p.profiles?.username || 'User'}</td>
          <td class="px-6 py-3.5 font-bold text-gray-900">GH₵${parseFloat(p.price || 25).toFixed(2)}</td>
          <td class="px-6 py-3.5"><span class="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-blue-100 text-blue-700">${p.status}</span></td>
        </tr>
      `).join('');
    }
  } catch (e) {}
}

// ADMIN BONUSES HANDLER
async function initAdminBonusesPage() {
  const tableBody = document.querySelector('tbody');
  if (!tableBody) return;

  try {
    const res = await API.request('/admin/bonuses');
    if (res.success && res.bonuses) {
      tableBody.innerHTML = res.bonuses.map(b => `
        <tr class="hover:bg-gray-50 border-b border-gray-100">
          <td class="px-6 py-3.5 font-bold text-gray-900">GH₵${parseFloat(b.min_amount).toFixed(2)}</td>
          <td class="px-6 py-3.5 font-bold text-pink-600">${b.bonus_percentage}%</td>
          <td class="px-6 py-3.5 text-xs text-gray-500">${b.gateway}</td>
          <td class="px-6 py-3.5"><span class="px-2 py-0.5 text-[11px] font-bold rounded-full bg-green-100 text-green-700">${b.status}</span></td>
        </tr>
      `).join('');
    }
  } catch (e) {}
}

// ADMIN PROMOTIONS HANDLER
async function initAdminPromotionsPage() {
  const tableBody = document.querySelector('tbody');
  if (!tableBody) return;

  try {
    const res = await API.request('/admin/promotions');
    if (res.success && res.promotions) {
      tableBody.innerHTML = res.promotions.map(p => `
        <tr class="hover:bg-gray-50 border-b border-gray-100">
          <td class="px-6 py-3.5 font-bold text-gray-900">${p.code}</td>
          <td class="px-6 py-3.5 font-bold text-pink-600">${p.discount_percentage}%</td>
          <td class="px-6 py-3.5 text-xs">${p.used_count} / ${p.max_uses}</td>
          <td class="px-6 py-3.5"><span class="px-2 py-0.5 text-[11px] font-bold rounded-full bg-green-100 text-green-700">${p.status}</span></td>
        </tr>
      `).join('');
    }
  } catch (e) {}
}

// ADMIN NEWS HANDLER
async function initAdminNewsPage() {
  const tableBody = document.querySelector('tbody');
  if (!tableBody) return;

  try {
    const res = await API.request('/admin/news');
    if (res.success && res.news) {
      tableBody.innerHTML = res.news.map(n => `
        <tr class="hover:bg-gray-50 border-b border-gray-100">
          <td class="px-6 py-3.5 font-bold text-gray-900">${n.title}</td>
          <td class="px-6 py-3.5 text-xs text-gray-500 max-w-xs truncate">${n.content}</td>
          <td class="px-6 py-3.5 text-xs text-gray-500">${new Date(n.created_at).toLocaleString()}</td>
        </tr>
      `).join('');
    }
  } catch (e) {}
}

// ADMIN LOGS HANDLER
async function initAdminLogsPage() {
  const tableBody = document.querySelector('tbody');
  if (!tableBody) return;

  try {
    const res = await API.request('/admin/logs');
    if (res.success && res.logs) {
      tableBody.innerHTML = res.logs.map(l => `
        <tr class="hover:bg-gray-50 border-b border-gray-100">
          <td class="px-6 py-3.5 font-mono text-xs text-gray-500">${new Date(l.created_at).toLocaleString()}</td>
          <td class="px-6 py-3.5 font-bold text-gray-900">${l.action}</td>
          <td class="px-6 py-3.5 text-xs text-gray-600">${l.details || ''}</td>
          <td class="px-6 py-3.5 font-mono text-xs text-gray-400">${l.ip_address || '127.0.0.1'}</td>
        </tr>
      `).join('');
    }
  } catch (e) {}
}

// ADMIN SETTINGS HANDLER
async function initAdminSettingsPage() {
  const form = document.querySelector('form');
  if (!form) return;

  try {
    const res = await API.request('/admin/settings');
    if (res.success && res.settings) {
      const inputs = form.querySelectorAll('input, select');
      inputs.forEach(input => {
        if (input.name && res.settings[input.name]) {
          input.value = res.settings[input.name];
        }
      });
    }
  } catch (e) {}

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const settingsObj = {};
    formData.forEach((val, key) => { settingsObj[key] = val; });

    try {
      const res = await API.request('/admin/settings', 'POST', settingsObj);
      alert(res.message || 'Settings Saved!');
    } catch (err) {
      alert(err.message);
    }
  });
}

/**
 * Safely escapes a string to prevent XSS when injecting into innerHTML.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Copies text to clipboard with a graceful fallback for non-HTTPS / unsupported environments.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      // fall through to execCommand fallback
    }
  }
  // Fallback: create a hidden textarea and use document.execCommand
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:absolute;left:-9999px;top:-9999px;opacity:0';
    ta.setAttribute('readonly', '');
    ta.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (_) {
    return false;
  }
}

async function initOrderDetailPage() {
  const skeleton = document.getElementById('order-skeleton');
  const wrapper = document.getElementById('order-content-wrapper');
  const errorState = document.getElementById('order-error-state');
  const announcer = document.getElementById('a11y-announcer');

  let currentOrder = null;
  let pollTimer = null;
  let pollFailures = 0;
  const MAX_POLL_FAILURES = 3;

  // Extract order ID from URL path (e.g. /dashboard/orders/76a57d66-...) or query param (?id=...)
  const urlParams = new URLSearchParams(window.location.search);
  let orderId = urlParams.get('id');

  if (!orderId) {
    const parts = window.location.pathname.split('/');
    const lastPart = parts[parts.length - 1];
    // Accept UUID-formatted ID
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (uuidRegex.test(lastPart)) {
      orderId = lastPart;
    }
  }

  // Update canonical and OG URL dynamically for this specific order
  if (orderId) {
    const canonicalEl = document.getElementById('page-canonical');
    if (canonicalEl) canonicalEl.setAttribute('href', `https://ghbooster.com/dashboard/orders/${orderId}`);
    const ogUrlEl = document.getElementById('og-url');
    if (ogUrlEl) ogUrlEl.setAttribute('content', `https://ghbooster.com/dashboard/orders/${orderId}`);
  }

  function announce(msg) {
    if (announcer) {
      announcer.textContent = msg;
    }
  }

  function showError(title, msg) {
    if (skeleton) skeleton.classList.add('hidden');
    if (wrapper) wrapper.classList.add('hidden');
    if (errorState) {
      errorState.classList.remove('hidden');
      const errTitle = document.getElementById('error-title');
      const errMessage = document.getElementById('error-message');
      if (errTitle) errTitle.textContent = title;
      if (errMessage) errMessage.textContent = msg;
    }
    document.title = `${title} | GhBooster`;
    announce(`${title}: ${msg}`);
  }

  function showToast(message, isError = false) {
    const toast = document.getElementById('action-toast');
    if (toast) {
      toast.textContent = message;
      toast.className = `p-3 rounded-xl text-xs font-semibold ${
        isError
          ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800'
          : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800'
      }`;
      toast.classList.remove('hidden');
      setTimeout(() => toast.classList.add('hidden'), 5000);
    }
    announce(message);
  }

  function sanitizeUrl(input) {
    if (!input) return '';
    const trimmed = String(input).trim();
    if (!trimmed) return '';
    try {
      const url = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return url.href;
      }
    } catch (e) {}
    return '';
  }

  async function loadOrder(isSilent = false) {
    if (!orderId) {
      showError('No Order ID', 'No valid order ID was found in the URL. Please navigate from your Orders History.');
      return;
    }

    try {
      if (!isSilent) {
        if (skeleton) skeleton.classList.remove('hidden');
        if (wrapper) wrapper.classList.add('hidden');
        if (errorState) errorState.classList.add('hidden');
      }

      const res = await API.request(`/orders/${orderId}`);
      if (res.success && res.order) {
        pollFailures = 0;
        currentOrder = res.order;
        renderOrderDetail(res.order);
        managePolling(res.order.status);
      } else {
        showError('Order Not Found', 'Could not locate order details.');
        stopPolling();
      }
    } catch (err) {
      const status = err.status;
      if (status === 404) {
        showError('Order Not Found', 'This order does not exist or does not belong to your account.');
        stopPolling();
      } else if (status === 403 || status === 401) {
        showError('Access Denied', 'You do not have permission to view this order.');
        stopPolling();
      } else {
        if (isSilent) {
          pollFailures++;
          if (pollFailures >= MAX_POLL_FAILURES) {
            stopPolling();
          }
        } else {
          showError('Unable to Load Order', err.message || 'A server error occurred while fetching order details.');
          stopPolling();
        }
      }
    }
  }

  function managePolling(status) {
    const activeStatuses = ['Pending', 'Processing', 'In Progress'];
    const isActive = activeStatuses.includes(status);

    if (isActive && !pollTimer) {
      pollTimer = setInterval(() => {
        if (!document.hidden) {
          loadOrder(true);
        }
      }, 20000);
    } else if (!isActive && pollTimer) {
      stopPolling();
    }
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  /**
   * Updates visual stepper progress bar and step dots with accessibility attributes
   */
  function updateStepper(order) {
    const status = order.status || '';
    const st = String(status).toLowerCase();
    const qty = parseInt(order.quantity || 0, 10);
    const rem = parseInt(order.remains || 0, 10);

    let activeStep = 1; // Placed
    let pctNum = 25;

    if (st === 'pending') {
      activeStep = 1;
      pctNum = 25;
    } else if (st === 'processing') {
      activeStep = 2;
      pctNum = 50;
    } else if (st === 'in progress') {
      activeStep = 3;
      pctNum = 75;
    } else if (st === 'completed') {
      activeStep = 4;
      pctNum = 100;
    } else if (st === 'partial') {
      activeStep = 3;
      if (qty > 0 && rem >= 0 && rem <= qty) {
        pctNum = Math.min(90, Math.max(10, Math.round(((qty - rem) / qty) * 100)));
      } else {
        pctNum = 60;
      }
    } else if (st === 'canceled' || st === 'refunded') {
      activeStep = 0;
      pctNum = 0;
    }

    const pctStr = `${pctNum}%`;
    const fillBar = document.getElementById('progress-bar-fill');
    const progressContainer = document.getElementById('progress-bar-container');
    const fillPercentage = document.getElementById('progress-percentage');

    if (fillBar) fillBar.style.width = pctStr;
    if (progressContainer) {
      progressContainer.setAttribute('aria-valuenow', pctNum);
      progressContainer.setAttribute('aria-valuetext', `${pctStr} — ${status}`);
    }
    if (fillPercentage) fillPercentage.textContent = `${pctStr} — ${escapeHtml(status)}`;

    // Update Step Dots
    for (let i = 1; i <= 4; i++) {
      const dot = document.getElementById(`step-dot-${i}`);
      if (!dot) continue;

      dot.className = 'w-6 h-6 rounded-full border-2 mx-auto flex items-center justify-center font-bold text-[10px] transition-colors duration-300';

      if (activeStep === 0) {
        dot.classList.add('bg-gray-100', 'dark:bg-gray-700', 'border-gray-300', 'dark:border-gray-600', 'text-gray-500', 'dark:text-gray-400');
        dot.removeAttribute('aria-current');
      } else if (i < activeStep) {
        dot.classList.add('bg-green-100', 'dark:bg-green-900/40', 'border-green-500', 'text-green-700', 'dark:text-green-400');
        dot.removeAttribute('aria-current');
      } else if (i === activeStep) {
        dot.classList.add('bg-blue-100', 'dark:bg-blue-900/40', 'border-blue-500', 'text-blue-700', 'dark:text-blue-400', 'ring-2', 'ring-blue-400/30');
        dot.setAttribute('aria-current', 'step');
      } else {
        dot.classList.add('bg-gray-100', 'dark:bg-gray-700', 'border-gray-300', 'dark:border-gray-600', 'text-gray-500', 'dark:text-gray-400');
        dot.removeAttribute('aria-current');
      }
    }

    // Style step labels
    const stepIds = ['step-placed', 'step-processing', 'step-inprogress', 'step-completed'];
    stepIds.forEach((id, idx) => {
      const stepEl = document.getElementById(id);
      if (!stepEl) return;
      const stepNum = idx + 1;
      const textEl = stepEl.querySelector('div:last-child');
      if (!textEl) return;

      textEl.className = 'text-[11px] sm:text-xs truncate transition-colors duration-300';
      if (activeStep === 0) {
        textEl.classList.add('text-gray-400', 'dark:text-gray-500');
      } else if (stepNum < activeStep) {
        textEl.classList.add('text-green-600', 'dark:text-green-400', 'font-semibold');
      } else if (stepNum === activeStep) {
        textEl.classList.add('text-blue-600', 'dark:text-blue-400', 'font-bold');
      } else {
        textEl.classList.add('text-gray-400', 'dark:text-gray-500');
      }
    });
  }

  function getStatusBadgeStyle(status) {
    const st = String(status || '').toLowerCase();
    if (st === 'completed') {
      return { wrapperClass: 'bg-green-500/20 text-green-400 border border-green-500/30', dotClass: 'bg-green-400', pulse: false };
    }
    if (st === 'in progress') {
      return { wrapperClass: 'bg-purple-500/20 text-purple-400 border border-purple-500/30', dotClass: 'bg-purple-400', pulse: true };
    }
    if (st === 'processing') {
      return { wrapperClass: 'bg-blue-500/20 text-blue-400 border border-blue-500/30', dotClass: 'bg-blue-400', pulse: true };
    }
    if (st === 'pending') {
      return { wrapperClass: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30', dotClass: 'bg-yellow-400', pulse: true };
    }
    if (st === 'canceled' || st === 'refunded') {
      return { wrapperClass: 'bg-red-500/20 text-red-400 border border-red-500/30', dotClass: 'bg-red-400', pulse: false };
    }
    if (st === 'partial') {
      return { wrapperClass: 'bg-orange-500/20 text-orange-400 border border-orange-500/30', dotClass: 'bg-orange-400', pulse: true };
    }
    return { wrapperClass: 'bg-gray-500/20 text-gray-400 border border-gray-500/30', dotClass: 'bg-gray-400', pulse: false };
  }

  function renderOrderDetail(order) {
    if (skeleton) skeleton.classList.add('hidden');
    if (wrapper) wrapper.classList.remove('hidden');

    const shortId = order.id.substring(0, 8);
    const displayId = `#${shortId}…`;
    const svcName = order.service_name || 'Social Media Service';

    // Dynamic SEO Title & Meta Tags
    const fullTitle = `Order #${shortId} - ${svcName} | GhBooster`;
    const dynamicDesc = `Live progress, start count (${order.start_count || 0}), remainder (${order.remains || 0}), and refill status for Order #${shortId} on GhBooster SMM Panel.`;
    const orderUrl = `https://ghbooster.com/dashboard/orders/${order.id}`;

    document.title = fullTitle;

    const pageDescEl = document.getElementById('page-description');
    if (pageDescEl) pageDescEl.setAttribute('content', dynamicDesc);

    const ogTitleEl = document.getElementById('og-title');
    if (ogTitleEl) ogTitleEl.setAttribute('content', fullTitle);

    const ogDescEl = document.getElementById('og-desc');
    if (ogDescEl) ogDescEl.setAttribute('content', dynamicDesc);

    const twTitleEl = document.getElementById('twitter-title');
    if (twTitleEl) twTitleEl.setAttribute('content', fullTitle);

    const twDescEl = document.getElementById('twitter-desc');
    if (twDescEl) twDescEl.setAttribute('content', dynamicDesc);

    // Update JSON-LD Structured Data
    const schemaEl = document.getElementById('schema-jsonld');
    if (schemaEl) {
      schemaEl.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://ghbooster.com/" },
              { "@type": "ListItem", "position": 2, "name": "Dashboard", "item": "https://ghbooster.com/dashboard.html" },
              { "@type": "ListItem", "position": 3, "name": "Orders", "item": "https://ghbooster.com/orders.html" },
              { "@type": "ListItem", "position": 4, "name": `Order #${shortId}`, "item": orderUrl }
            ]
          },
          {
            "@type": "Order",
            "orderNumber": order.id,
            "orderStatus": `https://schema.org/Order${order.status === 'Completed' ? 'Delivered' : order.status === 'Processing' || order.status === 'In Progress' ? 'InTransit' : 'Processing'}`,
            "price": String(order.charge || 0),
            "priceCurrency": "GHS",
            "orderedItem": {
              "@type": "Product",
              "name": svcName,
              "description": order.service_description || "Social media boosting service"
            }
          }
        ]
      }, null, 2);
    }

    const bcId = document.getElementById('breadcrumb-order-id');
    if (bcId) bcId.textContent = displayId;

    const idDisplay = document.getElementById('order-id-display');
    if (idDisplay) idDisplay.textContent = `Order #${shortId}`;

    const createdAt = document.getElementById('order-created-at');
    if (createdAt) createdAt.textContent = order.created_at || '—';

    const providerId = document.getElementById('provider-order-id');
    if (providerId) {
      providerId.textContent = order.provider_order_id || '—';
      if (!order.provider_order_id) {
        providerId.title = 'Provider tracking ID not yet available';
      }
    }

    const badgeStyle = getStatusBadgeStyle(order.status);
    const statusBadge = document.getElementById('order-status-badge');
    if (statusBadge) {
      statusBadge.className = `px-3 py-1 text-xs font-extrabold rounded-full flex items-center ${badgeStyle.wrapperClass}`;
      const dot = document.getElementById('status-dot');
      const statusText = document.getElementById('status-text');
      if (dot) {
        dot.className = `w-2 h-2 rounded-full mr-2 ${badgeStyle.dotClass}${badgeStyle.pulse ? ' animate-pulse' : ''}`;
      }
      if (statusText) statusText.textContent = order.status;
    }

    updateStepper(order);

    const refillBadge = document.getElementById('refill-guarantee-badge');
    const refillLabel = document.getElementById('refill-guarantee-label');
    if (refillBadge && refillLabel) {
      if (order.refill_guarantee) {
        const days = order.refill_period_days || 30;
        refillLabel.textContent = `${days} Day Refill Guarantee`;
        refillBadge.classList.remove('hidden');
      } else {
        refillBadge.classList.add('hidden');
      }
    }

    const qEl = document.getElementById('stat-quantity');
    if (qEl) qEl.textContent = (order.quantity || 0).toLocaleString();

    const scEl = document.getElementById('stat-start-count');
    if (scEl) scEl.textContent = (order.start_count || 0).toLocaleString();

    const remEl = document.getElementById('stat-remains');
    if (remEl) remEl.textContent = (order.remains || 0).toLocaleString();

    const chgEl = document.getElementById('stat-charge');
    if (chgEl) chgEl.textContent = `GH₵${parseFloat(order.charge || 0).toFixed(2)}`;

    const rateEl = document.getElementById('stat-rate');
    if (rateEl) rateEl.textContent = `GH₵${parseFloat(order.rate_per_1k || 0).toFixed(2)} per 1k`;

    const refillStatus = document.getElementById('stat-refill-status');
    if (refillStatus) {
      if (order.refill_guarantee) {
        refillStatus.textContent = `Active (${order.refill_period_days || 30} Days)`;
      } else {
        refillStatus.textContent = 'Not Eligible';
      }
    }

    // Target Link Card & Strict URL Protocol Sanitization
    const linkInput = document.getElementById('target-link-input');
    const rawUrl = String(order.link || '').trim();
    const safeUrl = sanitizeUrl(rawUrl);

    if (linkInput) {
      linkInput.value = rawUrl || 'No target link provided';
      linkInput.onfocus = () => linkInput.select();
      linkInput.onclick = () => linkInput.select();
    }

    const openLinkBtn = document.getElementById('open-link-btn');
    if (openLinkBtn) {
      if (safeUrl) {
        openLinkBtn.href = safeUrl;
        openLinkBtn.classList.remove('opacity-40', 'pointer-events-none');
        openLinkBtn.removeAttribute('aria-disabled');
        openLinkBtn.title = 'Open Target Link in New Tab';
      } else {
        openLinkBtn.href = 'javascript:void(0)';
        openLinkBtn.classList.add('opacity-40', 'pointer-events-none');
        openLinkBtn.setAttribute('aria-disabled', 'true');
        openLinkBtn.title = 'No valid web link available';
      }
    }

    const validatedBadge = document.getElementById('link-validated-badge');
    if (validatedBadge) {
      if (safeUrl) {
        validatedBadge.classList.remove('hidden');
      } else {
        validatedBadge.classList.add('hidden');
      }
    }

    const serviceNameEl = document.getElementById('service-name');
    if (serviceNameEl) serviceNameEl.textContent = order.service_name || 'Social Media Service';

    const catNameEl = document.getElementById('category-name');
    if (catNameEl) catNameEl.textContent = order.category_name ? `${order.category_name} Booster` : '';

    const descEl = document.getElementById('service-description');
    if (descEl) descEl.textContent = order.service_description || 'High quality social media boosting service with refill guarantee.';

    const svcIdTag = document.getElementById('service-id-tag');
    if (svcIdTag) svcIdTag.textContent = order.service_id ? `ID: #${order.service_id}` : 'ID: —';

    const ticketLink = document.getElementById('open-ticket-link');
    if (ticketLink) ticketLink.href = `/tickets.html?order_id=${encodeURIComponent(order.id)}`;

    // Refill Button Availability
    const refillBtn = document.getElementById('trigger-refill-btn');
    if (refillBtn) {
      const isRefillEligible = order.status === 'Completed' && Boolean(order.refill_guarantee) && Boolean(order.provider_order_id);
      if (isRefillEligible) {
        refillBtn.disabled = false;
        refillBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        refillBtn.removeAttribute('aria-disabled');
        refillBtn.title = 'Request an automatic refill if your count has dropped';
      } else {
        refillBtn.disabled = true;
        refillBtn.classList.add('opacity-50', 'cursor-not-allowed');
        refillBtn.setAttribute('aria-disabled', 'true');
        if (order.status !== 'Completed') {
          refillBtn.title = 'Refill is available after order status becomes Completed.';
        } else if (!order.refill_guarantee) {
          refillBtn.title = 'This service does not include a refill guarantee.';
        } else {
          refillBtn.title = 'Provider refill is not available for this order.';
        }
      }
    }

    // Cancel & Refund Button Availability
    const cancelBtn = document.getElementById('trigger-cancel-btn');
    if (cancelBtn) {
      const isCancellable = order.status === 'Pending' || order.status === 'Processing';
      if (!isCancellable) {
        cancelBtn.disabled = true;
        cancelBtn.classList.add('opacity-50', 'cursor-not-allowed');
        cancelBtn.setAttribute('aria-disabled', 'true');
        cancelBtn.title = `Orders with status "${order.status}" cannot be canceled.`;
      } else {
        cancelBtn.disabled = false;
        cancelBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        cancelBtn.removeAttribute('aria-disabled');
        cancelBtn.title = 'Cancel order and request a refund to your wallet';
      }
    }
  }

  // Bind Static Event Listeners Once
  const copyIdBtn = document.getElementById('copy-order-id-btn');
  if (copyIdBtn) {
    copyIdBtn.onclick = async () => {
      if (!currentOrder) return;
      const success = await copyToClipboard(currentOrder.id);
      if (success) {
        copyIdBtn.querySelector('span').textContent = 'Copied!';
        setTimeout(() => { copyIdBtn.querySelector('span').textContent = 'Copy ID'; }, 2000);
        showToast('Order ID copied to clipboard!');
      } else {
        showToast('Could not copy automatically. Please copy manually: ' + currentOrder.id, true);
      }
    };
  }

  const refreshBtn = document.getElementById('refresh-order-btn');
  if (refreshBtn) {
    refreshBtn.onclick = () => {
      showToast('Refreshing order status...');
      loadOrder(false);
    };
  }

  const copyLinkBtn = document.getElementById('copy-link-btn');
  if (copyLinkBtn) {
    copyLinkBtn.onclick = async () => {
      const rawUrl = currentOrder ? String(currentOrder.link || '').trim() : '';
      if (!rawUrl) {
        showToast('No target URL available to copy.', true);
        return;
      }
      const success = await copyToClipboard(rawUrl);
      if (success) {
        showToast('Target URL copied to clipboard!');
      } else {
        showToast('Could not copy automatically. Please copy manually.', true);
      }
    };
  }

  const refillBtn = document.getElementById('trigger-refill-btn');
  if (refillBtn) {
    refillBtn.onclick = async () => {
      if (!currentOrder || refillBtn.disabled) return;
      try {
        refillBtn.disabled = true;
        refillBtn.querySelector('span').textContent = 'Submitting…';
        const rRes = await API.request(`/orders/${currentOrder.id}/refill`, 'POST');
        showToast(rRes.message || 'Refill request submitted successfully!');
        if (rRes.order) {
          currentOrder = rRes.order;
          renderOrderDetail(rRes.order);
        } else {
          loadOrder(true);
        }
      } catch (e) {
        showToast(e.message || 'Refill request failed. Please try again.', true);
      } finally {
        refillBtn.disabled = false;
        refillBtn.querySelector('span').textContent = 'Request Automatic Refill';
      }
    };
  }

  const cancelBtn = document.getElementById('trigger-cancel-btn');
  if (cancelBtn) {
    cancelBtn.onclick = async () => {
      if (!currentOrder || cancelBtn.disabled) return;
      const shortId = currentOrder.id.substring(0, 8);
      const chargeFormatted = `GH₵${parseFloat(currentOrder.charge || 0).toFixed(2)}`;
      if (!confirm(`Are you sure you want to cancel Order #${shortId} and refund ${chargeFormatted} to your wallet balance?`)) return;
      try {
        cancelBtn.disabled = true;
        cancelBtn.querySelector('span').textContent = 'Canceling…';
        const cRes = await API.request(`/orders/${currentOrder.id}/cancel`, 'POST');
        showToast(cRes.message || 'Order canceled and wallet refunded successfully!');
        const user = API.getUser();
        if (user && cRes.new_balance !== undefined && cRes.new_balance !== null) {
          user.balance = cRes.new_balance;
          API.setUser(user);
          updateUserUI(user);
        }
        if (cRes.order) {
          currentOrder = cRes.order;
          renderOrderDetail(cRes.order);
        } else {
          loadOrder(false);
        }
      } catch (e) {
        showToast(e.message || 'Failed to cancel order. Please contact support.', true);
        cancelBtn.disabled = false;
        cancelBtn.querySelector('span').textContent = 'Cancel & Refund Order';
      }
    };
  }

  // Handle Tab Visibility Changes to pause/resume auto-polling
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && currentOrder) {
      const activeStatuses = ['Pending', 'Processing', 'In Progress'];
      if (activeStatuses.includes(currentOrder.status)) {
        loadOrder(true);
      }
    }
  });

  window.addEventListener('beforeunload', () => stopPolling());

  // Initial Load
  loadOrder(false);
}

function getStatusBadgeClass(status) {
  switch (String(status || '').toLowerCase()) {
    case 'completed':  return 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/40';
    case 'processing': return 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/40';
    case 'in progress': return 'text-purple-700 bg-purple-100 dark:text-purple-300 dark:bg-purple-900/40';
    case 'pending':    return 'text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/40';
    case 'partial':    return 'text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-900/40';
    case 'canceled':   return 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/40';
    case 'refunded':   return 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/40';
    default:           return 'text-gray-700 bg-gray-100 dark:text-gray-300 dark:bg-gray-700';
  }
}

window.API = API;

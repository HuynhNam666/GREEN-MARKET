(function (window, document) {
  const STORAGE_KEYS = {
    session: 'greenMarket.session',
    apiBase: 'greenMarket.apiBase',
    favorites: 'greenMarket.favorites',
  };

  const FILTER_ALIASES = {
    rau: ['rau cu huu co', 'rau huu co', 'organic vegetable', 'vegetable'],
    traicay: ['trai cay mua vu', 'hoa qua', 'fruit', 'seasonal fruit'],
    ngucoc: ['ngu coc hat', 'ngu coc', 'grain', 'seed'],
    suatrung: ['sua trung', 'egg', 'milk', 'dairy'],
    chebien: ['thuc pham che bien', 'che bien', 'processed', 'dong goi'],
    dacsan: ['dac san vung mien', 'dac san', 'regional', 'specialty'],
    thiennhien: ['san pham tu thien nhien', 'thien nhien', 'mat ong', 'honey'],
    combo: ['combo', 'set', 'goi'],
    quatang: ['qua tang', 'gift', 'hop qua', 'gio qua'],
    matong: ['san pham tu thien nhien', 'thien nhien', 'mat ong', 'honey'],
    qua: ['qua tang', 'gift', 'hop qua', 'gio qua'],
    trai: ['trai cay mua vu', 'hoa qua', 'fruit'],
    hat: ['ngu coc hat', 'grain', 'seed'],
    co: ['huu co', 'organic'],
    he: ['he', 'summer'],
    lanh: ['lanh', 'dong', 'winter', 'mua lanh'],
    uoplanh: ['uop lanh', 'dong lanh', 'frozen', 'lanh'],
    saykho: ['say kho', 'dried'],
    caocap: ['cao cap', 'premium'],
    mebe: ['me va be', 'tre em', 'baby'],
    tangluc: ['tang luc', 'healthy', 'fitness'],
    boiduong: ['boi duong', 'nutritious'],
    all: [],
  };

  const App = {
    _apiBase: null,
    _currentUserPromise: null,

    escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    normalizeText(value) {
      return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    },

    formatCurrency(value) {
      return Number(value || 0).toLocaleString('vi-VN') + 'đ';
    },

    formatDate(value) {
      if (!value) return '—';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '—';
      return date.toLocaleString('vi-VN');
    },

    getSession() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.session);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch (error) {
        console.warn('Không đọc được session:', error);
        return null;
      }
    },

    setSession(session) {
      localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
    },

    clearSession() {
      localStorage.removeItem(STORAGE_KEYS.session);
      this._currentUserPromise = null;
    },

    getToken() {
      return this.getSession()?.token || '';
    },

    getUser() {
      return this.getSession()?.user || null;
    },

    updateStoredUser(user) {
      const session = this.getSession();
      if (!session) return;
      session.user = user;
      this.setSession(session);
    },

    buildPageUrl(fileName, params) {
      const url = new URL(`../page/${fileName}`, window.location.href);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value === null || value === undefined || value === '') return;
          url.searchParams.set(key, value);
        });
      }
      return url.toString();
    },

    getCurrentRelativeUrl() {
      return `${window.location.pathname}${window.location.search}`;
    },

    redirectToLogin() {
      window.location.href = this.buildPageUrl('dangnhap.html', {
        redirect: this.getCurrentRelativeUrl(),
      });
    },

    logout(redirectToHome = true) {
      this.clearSession();
      this.notify('Đã đăng xuất.', 'success');
      if (redirectToHome) {
        window.location.href = this.buildPageUrl('index.html');
      }
    },

    async probeApiBase(base) {
      try {
        const response = await fetch(`${base}/api/categories`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        return response.ok || response.status === 401 || response.status === 403;
      } catch (error) {
        return false;
      }
    },

    getApiCandidates() {
      const host = window.location.hostname || 'localhost';
      const stored = localStorage.getItem(STORAGE_KEYS.apiBase);
      const candidates = [
        window.GREEN_MARKET_API_BASE,
        stored,
        `${window.location.protocol}//${host}:5000`,
        `http://${host}:5000`,
        'http://localhost:5000',
        'http://127.0.0.1:5000',
        'http://localhost:5035',
        'https://localhost:7152',
      ].filter(Boolean);

      return [...new Set(candidates)];
    },

    async resolveApiBase() {
      if (this._apiBase) return this._apiBase;

      const candidates = this.getApiCandidates();
      for (const candidate of candidates) {
        // eslint-disable-next-line no-await-in-loop
        const isAlive = await this.probeApiBase(candidate);
        if (isAlive) {
          this._apiBase = candidate;
          localStorage.setItem(STORAGE_KEYS.apiBase, candidate);
          return candidate;
        }
      }

      this._apiBase = candidates[0] || 'http://localhost:5000';
      return this._apiBase;
    },

    async request(path, options) {
      const settings = options || {};
      const base = await this.resolveApiBase();
      const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
      const headers = new Headers(settings.headers || {});
      const isFormData = settings.body instanceof FormData;

      if (!isFormData && !headers.has('Content-Type') && settings.body !== undefined) {
        headers.set('Content-Type', 'application/json');
      }

      const token = this.getToken();
      if (settings.auth !== false && token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      const fetchOptions = {
        method: settings.method || 'GET',
        headers,
        body: isFormData
          ? settings.body
          : settings.body !== undefined
            ? JSON.stringify(settings.body)
            : undefined,
      };

      const response = await fetch(url, fetchOptions);
      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : await response.text().catch(() => '');

      if (!response.ok) {
        const message = (data && data.message) || `Yêu cầu thất bại (${response.status}).`;
        if (response.status === 401 && settings.auth !== false) {
          this.clearSession();
        }
        const error = new Error(message);
        error.status = response.status;
        error.payload = data;
        throw error;
      }

      return data;
    },

    resolveImageUrl(imageUrl) {
      if (!imageUrl) return '../img/banner.png';
      if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
      const base = this._apiBase || localStorage.getItem(STORAGE_KEYS.apiBase) || 'http://localhost:5000';
      return `${base}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
    },

    getHeaderElements() {
      const header = document.querySelector('header');
      if (!header) return {};

      const searchInput = header.querySelector('input[placeholder*="Tìm kiếm"]');
      const clickableElements = Array.from(header.querySelectorAll('a, button'));
      const cartButton = clickableElements.find((element) => element.textContent.includes('shopping_cart')) || null;
      const userButton = clickableElements.find((element) => element.textContent.includes('person')) || null;
      const cartBadge = cartButton
        ? Array.from(cartButton.querySelectorAll('span')).find(
            (span) => !span.classList.contains('material-symbols-outlined')
          ) || null
        : null;

      return { header, searchInput, cartButton, userButton, cartBadge };
    },

    bindHeaderSearch() {
      const { searchInput } = this.getHeaderElements();
      if (!searchInput || searchInput.dataset.bound === 'true') return;

      searchInput.dataset.bound = 'true';
      searchInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        const keyword = searchInput.value.trim();
        window.location.href = this.buildPageUrl('sanpham.html', { keyword });
      });
    },

    bindHeaderLinks() {
      const { cartButton, userButton } = this.getHeaderElements();
      const user = this.getUser();

      if (cartButton && cartButton.dataset.bound !== 'true') {
        cartButton.dataset.bound = 'true';
        cartButton.addEventListener('click', (event) => {
          if (cartButton.tagName.toLowerCase() === 'a') return;
          event.preventDefault();
          window.location.href = this.buildPageUrl('giohang.html');
        });
      }

      if (userButton) {
        const target = user ? this.buildPageUrl('taikhoan.html') : this.buildPageUrl('dangnhap.html');
        if (userButton.tagName.toLowerCase() === 'a') {
          userButton.setAttribute('href', target);
        } else if (userButton.dataset.bound !== 'true') {
          userButton.dataset.bound = 'true';
          userButton.addEventListener('click', (event) => {
            event.preventDefault();
            window.location.href = target;
          });
        }
        userButton.setAttribute('title', user ? `Tài khoản: ${user.username}` : 'Đăng nhập');
      }

      this.ensureHeaderLogoutButton();
    },

    async refreshCurrentUser(force) {
      if (!force && this._currentUserPromise) {
        return this._currentUserPromise;
      }

      const token = this.getToken();
      if (!token) {
        this._currentUserPromise = Promise.resolve(null);
        return null;
      }

      this._currentUserPromise = this.request('/api/auth/me')
        .then((user) => {
          this.updateStoredUser(user);
          return user;
        })
        .catch((error) => {
          console.warn('Không làm mới được phiên đăng nhập:', error);
          this.clearSession();
          return null;
        });

      return this._currentUserPromise;
    },

    async requireAuth(roles) {
      const user = await this.refreshCurrentUser();
      if (!user) {
        this.redirectToLogin();
        return null;
      }

      if (Array.isArray(roles) && roles.length > 0 && !roles.includes(user.role)) {
        this.notify('Bạn không có quyền truy cập khu vực này.', 'error');
        window.location.href = this.buildPageUrl('taikhoan.html');
        return null;
      }

      return user;
    },

    async updateCartBadge() {
      const { cartBadge } = this.getHeaderElements();
      if (!cartBadge) return;

      const token = this.getToken();
      if (!token) {
        cartBadge.textContent = '0';
        return;
      }

      try {
        const cart = await this.request('/api/cart');
        const count = Array.isArray(cart.items)
          ? cart.items.reduce((total, item) => total + Number(item.quantity || 0), 0)
          : 0;
        cartBadge.textContent = String(count);
      } catch (error) {
        cartBadge.textContent = '0';
      }
    },

    async updateHeaderState() {
      this.bindHeaderSearch();
      await this.refreshCurrentUser();
      this.bindHeaderLinks();
      await this.updateCartBadge();
    },

    getQueryParam(name) {
      return new URLSearchParams(window.location.search).get(name);
    },

    setQueryParam(name, value) {
      const url = new URL(window.location.href);
      if (value === null || value === undefined || value === '') {
        url.searchParams.delete(name);
      } else {
        url.searchParams.set(name, value);
      }
      window.history.replaceState({}, '', url);
    },

    notify(message, type) {
      const tone = type || 'info';
      const colors = {
        success: 'bg-emerald-600',
        error: 'bg-rose-600',
        warning: 'bg-amber-500',
        info: 'bg-slate-900',
      };

      let container = document.getElementById('gm-toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'gm-toast-container';
        container.className = 'fixed top-4 right-4 z-[100] flex max-w-sm flex-col gap-3';
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      toast.className = `${colors[tone] || colors.info} text-white px-4 py-3 rounded-xl shadow-xl text-sm leading-relaxed`;
      toast.textContent = message;
      container.appendChild(toast);

      window.setTimeout(() => {
        toast.remove();
        if (!container.children.length) {
          container.remove();
        }
      }, 3200);
    },


    getStoredFavorites() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.favorites);
        const data = raw ? JSON.parse(raw) : [];
        return Array.isArray(data) ? data : [];
      } catch (error) {
        return [];
      }
    },

    setStoredFavorites(favorites) {
      const uniqueFavorites = [...new Set((favorites || []).map((item) => String(item || '').trim()).filter(Boolean))];
      localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(uniqueFavorites));
    },

    ensureHeaderLogoutButton() {
      const { userButton } = this.getHeaderElements();
      const user = this.getUser();
      const host = userButton?.parentElement;
      if (!host) return;

      let logoutButton = host.querySelector('#gm-header-logout');
      if (!user) {
        logoutButton?.remove();
        return;
      }

      if (!logoutButton) {
        logoutButton = document.createElement('button');
        logoutButton.id = 'gm-header-logout';
        logoutButton.type = 'button';
        logoutButton.className = 'inline-flex h-10 w-10 items-center justify-center rounded-full text-forest transition-colors hover:bg-earth-beige';
        logoutButton.setAttribute('aria-label', 'Đăng xuất');
        logoutButton.setAttribute('title', 'Đăng xuất');
        logoutButton.innerHTML = '<span class="material-symbols-outlined text-[20px]">logout</span>';
        userButton.insertAdjacentElement('afterend', logoutButton);
      }

      if (logoutButton.dataset.bound !== 'true') {
        logoutButton.dataset.bound = 'true';
        logoutButton.addEventListener('click', (event) => {
          event.preventDefault();
          this.logout();
        });
      }
    },

    getNearestProductCard(element) {
      return element.closest('article, .product-card, [data-category], .group, .rounded-2xl, .rounded-[2rem]') || element.parentElement;
    },

    findNearestProductTitle(element) {
      const card = this.getNearestProductCard(element);
      if (!card) return '';

      const heading = card.querySelector('h1, h2, h3, h4, h5, h6');
      if (heading?.textContent?.trim()) {
        return heading.textContent.trim();
      }

      const titleLikeLink = Array.from(card.querySelectorAll('a, p, strong, span'))
        .map((node) => node.textContent.trim())
        .find((value) => value && value.length >= 3 && value.length <= 120 && !/^\d+[\d.,\sđ%()-]*$/.test(value));

      if (titleLikeLink) {
        return titleLikeLink;
      }

      const image = card.querySelector('img[alt]');
      return image?.getAttribute('alt')?.trim() || '';
    },

    async findProductByKeyword(keyword) {
      const normalizedKeyword = this.normalizeText(keyword);
      if (!normalizedKeyword) return null;

      const products = await this.request(`/api/products?keyword=${encodeURIComponent(keyword)}`, { auth: false });
      const list = Array.isArray(products) ? products : [];
      if (!list.length) return null;

      const getScore = (product) => {
        const normalizedName = this.normalizeText(product.name);
        const searchIndex = this.getProductSearchIndex(product);
        let score = 0;
        if (normalizedName === normalizedKeyword) score += 100;
        if (normalizedName.includes(normalizedKeyword)) score += 80;
        if (normalizedKeyword.includes(normalizedName)) score += 40;
        if (searchIndex.includes(normalizedKeyword)) score += 20;
        score -= Math.abs(normalizedName.length - normalizedKeyword.length) / 100;
        return score;
      };

      return list.sort((left, right) => getScore(right) - getScore(left))[0] || null;
    },

    async addProductToCart(productId, button) {
      const user = await this.refreshCurrentUser();
      if (!user) {
        this.redirectToLogin();
        return;
      }

      const resolvedProductId = Number(productId);
      if (!resolvedProductId) {
        this.notify('Không xác định được sản phẩm để thêm vào giỏ.', 'warning');
        return;
      }

      const originalText = button ? button.textContent : '';
      if (button) {
        button.disabled = true;
        button.textContent = 'Đang thêm...';
      }

      try {
        await this.request('/api/cart/add', {
          method: 'POST',
          body: { productId: resolvedProductId, quantity: 1 },
        });
        this.notify('Đã thêm sản phẩm vào giỏ hàng.', 'success');
        await this.updateCartBadge();
      } catch (error) {
        this.notify(error.message, 'error');
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = originalText;
        }
      }
    },

    bindStaticProductButtons(root) {
      const scope = root || document;
      scope.querySelectorAll('button').forEach((button) => {
        if (button.dataset.boundStaticCart === 'true' || button.classList.contains('add-to-cart-btn') || button.closest('header')) {
          return;
        }

        const iconText = button.querySelector('.material-symbols-outlined')?.textContent?.trim() || '';
        const textIndex = this.normalizeText(button.textContent);
        const isStaticAddToCartButton = iconText === 'add_shopping_cart' || textIndex.includes('them vao gio');
        if (!isStaticAddToCartButton) return;

        button.dataset.boundStaticCart = 'true';
        button.addEventListener('click', async (event) => {
          event.preventDefault();
          const productTitle = this.findNearestProductTitle(button);
          if (!productTitle) {
            window.location.href = this.buildPageUrl('sanpham.html');
            return;
          }

          try {
            const matchedProduct = await this.findProductByKeyword(productTitle);
            if (!matchedProduct) {
              window.location.href = this.buildPageUrl('sanpham.html', { keyword: productTitle });
              return;
            }

            await this.addProductToCart(matchedProduct.id, button);
          } catch (error) {
            this.notify(error.message, 'error');
          }
        });
      });
    },

    bindWishlistButtons(root) {
      const scope = root || document;
      const favorites = new Set(this.getStoredFavorites());
      const applyState = (button, active) => {
        button.classList.toggle('text-red-500', active);
        button.classList.toggle('bg-rose-50', active);
      };

      scope.querySelectorAll('button').forEach((button) => {
        if (button.dataset.boundFavorite === 'true' || button.closest('header')) return;
        const icon = button.querySelector('.material-symbols-outlined');
        if (!icon || icon.textContent.trim() !== 'favorite') return;

        const favoriteKey = this.findNearestProductTitle(button) || button.dataset.favoriteKey || `favorite-${Math.random()}`;
        applyState(button, favorites.has(favoriteKey));

        button.dataset.boundFavorite = 'true';
        button.addEventListener('click', (event) => {
          event.preventDefault();
          if (favorites.has(favoriteKey)) {
            favorites.delete(favoriteKey);
            this.notify('Đã bỏ sản phẩm khỏi danh sách yêu thích.', 'info');
          } else {
            favorites.add(favoriteKey);
            this.notify('Đã lưu sản phẩm vào danh sách yêu thích.', 'success');
          }
          this.setStoredFavorites([...favorites]);
          applyState(button, favorites.has(favoriteKey));
        });
      });
    },

    bindExploreButtons(root) {
      const scope = root || document;
      scope.querySelectorAll('button').forEach((button) => {
        if (button.dataset.boundExplore === 'true' || button.closest('header')) return;
        const textIndex = this.normalizeText(button.textContent);
        if (!textIndex.includes('kham pha ngay')) return;

        button.dataset.boundExplore = 'true';
        button.addEventListener('click', (event) => {
          event.preventDefault();
          const target = document.querySelector('.product-grid')
            || document.getElementById('deal-products')
            || document.querySelector('main section:nth-of-type(2)')
            || document.querySelector('main');

          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            window.location.href = this.buildPageUrl('sanpham.html');
          }
        });
      });
    },

    bindNewsletterForms(root) {
      const scope = root || document;
      scope.querySelectorAll('form').forEach((form) => {
        if (form.dataset.boundNewsletter === 'true') return;
        const emailInput = form.querySelector('input[type="email"]');
        const inFooter = !!form.closest('footer');
        const normalizedFormText = this.normalizeText(form.parentElement?.textContent || form.textContent || '');
        const looksLikeNewsletter = inFooter || normalizedFormText.includes('nhan tin');
        const isAuthForm = ['login-form', 'register-form', 'checkout-form', 'message-form'].includes(form.id);

        if (!emailInput || !looksLikeNewsletter || isAuthForm) return;

        form.dataset.boundNewsletter = 'true';
        form.addEventListener('submit', (event) => {
          event.preventDefault();
          const email = emailInput.value.trim();
          if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            this.notify('Vui lòng nhập email hợp lệ để đăng ký nhận tin.', 'warning');
            emailInput.focus();
            return;
          }

          this.notify('Đăng ký nhận tin thành công. Green Market sẽ gửi ưu đãi mới tới email của bạn.', 'success');
          form.reset();
        });
      });
    },

    bindPlaceholderLinks(root) {
      const scope = root || document;
      scope.querySelectorAll('a[href="#"]').forEach((link) => {
        if (link.dataset.boundPlaceholder === 'true') return;
        const textIndex = this.normalizeText(link.textContent);
        const isContactLink = textIndex.includes('lien he');
        const isHomeBreadcrumb = textIndex === 'trang chu';
        const isForgotPassword = textIndex.includes('quen mat khau');
        const isSocialLogin = textIndex.includes('google') || textIndex.includes('facebook');
        const handledByCustomAuth = !!link.closest('[data-social-provider]');

        if (!isContactLink && !isHomeBreadcrumb && !isForgotPassword && !isSocialLogin) return;
        if (handledByCustomAuth) return;

        link.dataset.boundPlaceholder = 'true';
        link.addEventListener('click', (event) => {
          if (isHomeBreadcrumb) {
            event.preventDefault();
            window.location.href = this.buildPageUrl('index.html');
            return;
          }

          if (isContactLink) {
            event.preventDefault();
            const footer = document.querySelector('footer');
            if (footer) {
              footer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            return;
          }

          if (isForgotPassword) {
            event.preventDefault();
            this.notify('Chức năng quên mật khẩu chưa được bật trong bản demo. Hãy đăng nhập bằng tài khoản test hoặc nhờ admin đặt lại mật khẩu.', 'info');
            return;
          }

          if (isSocialLogin) {
            event.preventDefault();
            this.notify('Đăng nhập bằng mạng xã hội chưa được bật trong bản demo hiện tại.', 'info');
          }
        });
      });
    },

    bindGlobalActions(root) {
      const scope = root || document;
      this.bindProductCardActions(scope);
      this.bindStaticProductButtons(scope);
      this.bindWishlistButtons(scope);
      this.bindExploreButtons(scope);
      this.bindNewsletterForms(scope);
      this.bindPlaceholderLinks(scope);
    },

    shouldEnableFloatingChat() {
      const path = window.location.pathname.toLowerCase();
      return !path.endsWith('/chat.html')
        && !path.endsWith('/dangnhap.html')
        && !path.endsWith('/dangky.html');
    },

    getAssistantContext() {
      const explicitContext = window.GREEN_MARKET_ASSISTANT_CONTEXT || {};
      const productId = Number(explicitContext.productId || 0) || Number(this.getQueryParam('id') || 0) || null;
      const sellerId = Number(explicitContext.sellerId || 0) || null;
      const shopId = Number(explicitContext.shopId || 0) || Number(this.getQueryParam('shopId') || 0) || null;
      const orderId = Number(explicitContext.orderId || 0) || Number(this.getQueryParam('orderId') || 0) || null;

      return {
        productId,
        sellerId,
        shopId,
        orderId,
        productName: explicitContext.productName || '',
        shopName: explicitContext.shopName || '',
      };
    },

    setAssistantContext(context, options) {
      const nextContext = {
        ...(window.GREEN_MARKET_ASSISTANT_CONTEXT || {}),
        ...(context || {}),
      };
      window.GREEN_MARKET_ASSISTANT_CONTEXT = nextContext;

      const shouldRefresh = options?.refresh !== false;
      if (!shouldRefresh) return nextContext;

      const existingWidget = document.getElementById('gm-floating-chat');
      if (existingWidget) {
        existingWidget.remove();
      }

      this.ensureFloatingChatWidget();
      return nextContext;
    },

    appendFloatingChatMessage(container, options) {
      if (!container) return null;
      const message = options || {};
      const wrapper = document.createElement('div');
      wrapper.className = `gm-chat-message ${message.isUser ? 'user' : 'bot'}`;
      wrapper.innerHTML = `
        <span class="gm-chat-meta">${this.escapeHtml(message.sender || (message.isUser ? 'Bạn' : 'AgriFresh AI'))}</span>
        <div>${this.escapeHtml(message.text || '')}</div>
      `;
      container.appendChild(wrapper);
      container.scrollTop = container.scrollHeight;
      return wrapper;
    },

    renderFloatingChatPrompts(container, prompts, onPromptClick) {
      if (!container) return;
      const list = Array.isArray(prompts) ? prompts.filter(Boolean).slice(0, 4) : [];
      if (!list.length) {
        container.innerHTML = '';
        return;
      }

      container.innerHTML = list
        .map((prompt, index) => `<button type="button" class="gm-chat-prompt" data-prompt-index="${index}">${this.escapeHtml(prompt)}</button>`)
        .join('');

      container.querySelectorAll('.gm-chat-prompt').forEach((button) => {
        button.addEventListener('click', () => {
          const prompt = list[Number(button.dataset.promptIndex)];
          if (prompt) {
            onPromptClick(prompt);
          }
        });
      });
    },

    async openShopConversation(context) {
      const user = await this.refreshCurrentUser();
      if (!user) {
        this.redirectToLogin();
        return null;
      }

      const response = await this.request('/api/chat/open', {
        method: 'POST',
        body: {
          sellerId: context?.sellerId || null,
          shopId: context?.shopId || null,
          productId: context?.productId || null,
          orderId: context?.orderId || null,
        },
      });

      return response;
    },

    bindFloatingChatHandoff(button, context) {
      if (!button || button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';

      button.addEventListener('click', async () => {
        try {
          const opened = await this.openShopConversation(context);
          if (!opened?.conversationId) {
            this.notify('Không mở được hội thoại với shop.', 'error');
            return;
          }

          window.location.href = this.buildPageUrl('chat.html', {
            conversationId: opened.conversationId,
            sellerId: opened.sellerId,
            shopId: opened.shopId,
            productId: context?.productId || undefined,
            orderId: context?.orderId || undefined,
          });
        } catch (error) {
          this.notify(error.message || 'Không mở được hội thoại với shop.', 'error');
        }
      });
    },

    async sendFloatingChatMessage(widget, message) {
  if (!widget || !message) return;
  const input = widget.querySelector('.gm-chat-input');
  const submitButton = widget.querySelector('.gm-chat-submit');
  const messages = widget.querySelector('.gm-chat-messages');
  const prompts = widget.querySelector('.gm-chat-prompts');
  const context = this.getAssistantContext();

  this.appendFloatingChatMessage(messages, {
    isUser: true,
    sender: 'Bạn',
    text: message,
  });

  const typing = this.appendFloatingChatMessage(messages, {
    isUser: false,
    sender: 'AgriFresh AI',
    text: 'Đang phân tích câu hỏi của bạn...',
  });

  if (submitButton) submitButton.disabled = true;
  if (input) input.disabled = true;

  try {
    const response = await this.request('/api/chat-assistant/ask', {
      method: 'POST',
      body: {
        message,
        sellerId: context.sellerId,
        productId: context.productId,
        orderId: context.orderId,
      },
    });

    typing?.remove();
    this.appendFloatingChatMessage(messages, {
      isUser: false,
      sender: response.assistantName || 'AgriFresh AI',
      text: [response.answer, response.handoffHint].filter(Boolean).join('\n\n'),
    });

    this.renderFloatingChatPrompts(prompts, response.suggestions, (prompt) => {
      if (input) input.value = prompt;
      this.sendFloatingChatMessage(widget, prompt);
    });
  } catch (error) {
    typing?.remove();

    const friendlyMessage =
      error?.message === 'Failed to fetch'
        ? 'Không kết nối được tới máy chủ API. Hãy kiểm tra backend đang chạy ở cổng 5000 và thử lại.'
        : (error?.message || 'Mình chưa thể trả lời ngay lúc này. Bạn vui lòng thử lại sau.');

    this.appendFloatingChatMessage(messages, {
      isUser: false,
      sender: 'AgriFresh AI',
      text: friendlyMessage,
    });
  } finally {
    if (submitButton) submitButton.disabled = false;
    if (input) {
      input.disabled = false;
      input.value = '';
      input.focus();
    }
  }
},

    ensureFloatingChatWidget() {
      if (!this.shouldEnableFloatingChat()) return;
      if (document.getElementById('gm-floating-chat')) return;

      const context = this.getAssistantContext();
      const widget = document.createElement('div');
      widget.id = 'gm-floating-chat';
      widget.innerHTML = `
        <button type="button" class="gm-chat-toggle" aria-controls="gm-chat-panel" aria-expanded="false">
          <span class="material-symbols-outlined">smart_toy</span>
          <span><strong>Hỗ trợ nhanh</strong><br><small>AI bán hàng</small></span>
        </button>
        <section id="gm-chat-panel" class="gm-chat-panel" hidden>
          <div class="gm-chat-header">
            <div class="gm-chat-header-row">
              <div class="gm-chat-header-title">
                <span class="material-symbols-outlined">smart_toy</span>
                <div>
                  <h3>AgriFresh AI</h3>
                  <p>${this.escapeHtml(context.shopName ? `Đang hỗ trợ cho ${context.shopName}` : 'Tư vấn sản phẩm, đơn hàng và giao hàng')}</p>
                </div>
              </div>
              <div class="gm-chat-header-actions">
                <button type="button" class="gm-chat-expand" aria-label="Phóng to khung chat" title="Phóng to khung chat" aria-pressed="false">
                  <span class="material-symbols-outlined">open_in_full</span>
                </button>
                <button type="button" class="gm-chat-close" aria-label="Đóng hỗ trợ nhanh">
                  <span class="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>
          </div>
          <div class="gm-chat-body">
            <div class="gm-chat-messages"></div>
            <div class="gm-chat-prompts"></div>
            <div class="gm-chat-handoff">
              <div class="gm-chat-helper">AI sẽ trả lời các câu hỏi thường gặp, sau đó bạn có thể chuyển sang chat trực tiếp với shop.</div>
              <button type="button" class="gm-chat-open-human" ${context.sellerId ? '' : 'disabled'}>Nhắn trực tiếp shop</button>
            </div>
          </div>
          <form class="gm-chat-form">
            <div class="gm-chat-input-wrap">
              <textarea class="gm-chat-input" placeholder="Hỏi về giá, tồn kho, giao hàng, đơn hàng..." rows="3"></textarea>
              <button type="submit" class="gm-chat-submit">
                <span class="material-symbols-outlined">send</span>
              </button>
            </div>
          </form>
        </section>
      `;
      document.body.appendChild(widget);

      const toggle = widget.querySelector('.gm-chat-toggle');
      const panel = widget.querySelector('.gm-chat-panel');
      const close = widget.querySelector('.gm-chat-close');
      const expand = widget.querySelector('.gm-chat-expand');
      const form = widget.querySelector('.gm-chat-form');
      const input = widget.querySelector('.gm-chat-input');
      const messages = widget.querySelector('.gm-chat-messages');
      const handoffButton = widget.querySelector('.gm-chat-open-human');
      const defaultPrompts = context.productName
        ? [`${context.productName} còn hàng không?`, 'Bao lâu thì giao tới?', 'Cách bảo quản sản phẩm này?']
        : ['Sản phẩm nào đang bán tốt?', 'Bao lâu thì giao hàng?', 'Tôi muốn hỏi về đơn hàng'];

      this.appendFloatingChatMessage(messages, {
        isUser: false,
        sender: 'AgriFresh AI',
        text: context.productName
          ? `Mình đang hỗ trợ cho sản phẩm ${context.productName}. Bạn có thể hỏi nhanh về giá, tồn kho, thời gian giao hoặc tình trạng đơn.`
          : 'Mình có thể hỗ trợ nhanh về sản phẩm, đơn hàng, vận chuyển và thanh toán mà không làm bạn rời trang hiện tại.',
      });
      this.renderFloatingChatPrompts(widget.querySelector('.gm-chat-prompts'), defaultPrompts, (prompt) => {
        if (input) input.value = prompt;
        this.sendFloatingChatMessage(widget, prompt);
      });
      this.bindFloatingChatHandoff(handoffButton, context);

      const syncExpandState = () => {
        if (!expand) return;
        const isExpanded = panel.classList.contains('is-expanded');
        expand.setAttribute('aria-pressed', isExpanded ? 'true' : 'false');
        expand.setAttribute('title', isExpanded ? 'Thu nhỏ khung chat' : 'Phóng to khung chat');
        const icon = expand.querySelector('.material-symbols-outlined');
        if (icon) {
          icon.textContent = isExpanded ? 'close_fullscreen' : 'open_in_full';
        }
      };

      const openPanel = () => {
        panel.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
        syncExpandState();
        input?.focus();
      };

      const closePanel = () => {
        panel.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
      };

      toggle?.addEventListener('click', () => {
        if (panel.hidden) {
          openPanel();
        } else {
          closePanel();
        }
      });
      close?.addEventListener('click', closePanel);
      expand?.addEventListener('click', () => {
        panel.classList.toggle('is-expanded');
        syncExpandState();
        input?.focus();
      });
      syncExpandState();

      form?.addEventListener('submit', (event) => {
        event.preventDefault();
        const message = input?.value.trim() || '';
        if (!message) return;
        this.sendFloatingChatMessage(widget, message);
      });
    },

    prepareSelectableButtons(buttons) {
      (buttons || []).forEach((button) => {
        if (!button.dataset.inactiveClassName) {
          button.dataset.inactiveClassName = button.className
            .split(/\s+/)
            .filter(Boolean)
            .filter((token) => !['bg-primary', 'text-white', 'border-primary', 'bg-green-600'].includes(token))
            .join(' ');
        }
      });
    },

    applyActiveButtonState(buttons, activeButton) {
      (buttons || []).forEach((button) => {
        if (!button.dataset.inactiveClassName) {
          this.prepareSelectableButtons([button]);
        }

        button.className = button.dataset.inactiveClassName || button.className;
        button.classList.remove('bg-green-600');

        if (button === activeButton) {
          button.classList.add('bg-primary', 'text-white', 'border-primary');
        }
      });
    },

    findCatalogSummaryElement(selector, productContainer) {
      if (selector) {
        const directTarget = document.querySelector(selector);
        if (directTarget) return directTarget;
      }

      const candidates = Array.from(document.querySelectorAll('p')).filter((element) => {
        const textIndex = this.normalizeText(element.textContent);
        return textIndex.includes('hien thi') && textIndex.includes('san pham');
      });

      if (!candidates.length) return null;
      if (!productContainer) return candidates[0];

      return candidates.sort((left, right) => {
        const leftDistance = Math.abs(left.getBoundingClientRect().top - productContainer.getBoundingClientRect().top);
        const rightDistance = Math.abs(right.getBoundingClientRect().top - productContainer.getBoundingClientRect().top);
        return leftDistance - rightDistance;
      })[0];
    },

    renderCatalogSummary(target, visibleCount, totalCount) {
      if (!target) return;
      target.innerHTML = `Hiển thị <span class="text-slate-900 dark:text-white">${visibleCount}</span> trong <span class="text-slate-900 dark:text-white">${totalCount}</span> sản phẩm`;
    },

    findPaginationContainer(productContainer, selector) {
      if (selector) {
        const directTarget = document.querySelector(selector);
        if (directTarget) return directTarget;
      }

      let candidate = productContainer?.nextElementSibling || null;
      while (candidate) {
        const textIndex = this.normalizeText(candidate.textContent || '');
        if (textIndex.includes('chevron left') || textIndex.includes('chevron right')) {
          return candidate;
        }
        candidate = candidate.nextElementSibling;
      }

      if (!productContainer) return null;

      const createdContainer = document.createElement('div');
      createdContainer.className = 'mt-12 flex items-center justify-center gap-2';
      productContainer.insertAdjacentElement('afterend', createdContainer);
      return createdContainer;
    },

    renderPagination(container, currentPage, totalPages, onChange) {
      if (!container) return;
      if (!totalPages || totalPages <= 1) {
        container.innerHTML = '';
        return;
      }

      const buildButton = (label, page, options) => {
        const settings = options || {};
        const classes = settings.active
          ? 'h-10 w-10 flex items-center justify-center rounded-lg bg-primary text-white font-bold'
          : 'h-10 w-10 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold';
        const disabled = settings.disabled ? 'disabled aria-disabled="true"' : '';
        const extraClasses = settings.extraClasses || '';
        return `<button type="button" class="${classes} ${extraClasses}" data-page="${page}" ${disabled}>${label}</button>`;
      };

      const pages = [];
      const startPage = Math.max(1, currentPage - 1);
      const endPage = Math.min(totalPages, currentPage + 1);

      pages.push(buildButton('<span class="material-symbols-outlined text-lg leading-none">chevron_left</span>', currentPage - 1, {
        disabled: currentPage === 1,
        extraClasses: 'p-2',
      }));

      if (startPage > 1) {
        pages.push(buildButton('1', 1, { active: currentPage === 1 }));
        if (startPage > 2) {
          pages.push('<span class="px-2 text-slate-400 font-bold">...</span>');
        }
      }

      for (let page = startPage; page <= endPage; page += 1) {
        pages.push(buildButton(String(page), page, { active: page === currentPage }));
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          pages.push('<span class="px-2 text-slate-400 font-bold">...</span>');
        }
        pages.push(buildButton(String(totalPages), totalPages, { active: currentPage === totalPages }));
      }

      pages.push(buildButton('<span class="material-symbols-outlined text-lg leading-none">chevron_right</span>', currentPage + 1, {
        disabled: currentPage === totalPages,
        extraClasses: 'p-2',
      }));

      container.innerHTML = pages.join('');
      container.querySelectorAll('button[data-page]').forEach((button) => {
        if (button.dataset.boundPagination === 'true') return;
        button.dataset.boundPagination = 'true';
        button.addEventListener('click', () => {
          const page = Number(button.dataset.page || 1);
          if (!page || page < 1 || page > totalPages || page === currentPage) return;
          onChange(page);
        });
      });
    },

    getProductSearchIndex(product) {
      return this.normalizeText([
        product.name,
        product.description,
        product.categoryName,
        product.shopName,
      ].join(' '));
    },

    matchesProductFilter(product, filterKey, fallbackText, activeButton) {
      if (!filterKey || filterKey === 'all') return true;

      const normalizedCategoryName = this.normalizeText(product?.categoryName || '');
      const explicitCategoryNames = [
        activeButton?.dataset?.categoryName,
        activeButton?.dataset?.category,
      ]
        .map((value) => this.normalizeText(value || ''))
        .filter(Boolean);

      if (explicitCategoryNames.length && normalizedCategoryName) {
        return explicitCategoryNames.some((candidate) => candidate === normalizedCategoryName);
      }

      const searchIndex = this.getProductSearchIndex(product);
      const candidates = [
        ...(FILTER_ALIASES[filterKey] || []),
        this.normalizeText(fallbackText || ''),
        this.normalizeText(filterKey),
      ].filter(Boolean);

      return candidates.some((candidate) => searchIndex.includes(this.normalizeText(candidate)));
    },

    sortProducts(products, sortType) {
      const list = [...products];

      if (sortType === 'price-asc') {
        list.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
      } else if (sortType === 'price-desc') {
        list.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
      } else {
        list.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
      }

      return list;
    },

    createProductCard(product, options) {
      const settings = options || {};
      const price = this.formatCurrency(product.price);
      const stockText = Number(product.stock || 0) > 0
        ? `Còn ${product.stock} sản phẩm`
        : 'Hết hàng';
      const stockColor = Number(product.stock || 0) > 0 ? 'text-emerald-600' : 'text-rose-500';
      const imageUrl = this.resolveImageUrl(product.imageUrl);
      const detailUrl = this.buildPageUrl('chitietsanpham.html', { id: product.id });
      const chatButton = settings.showChat
        ? `
            <button
              class="contact-shop-btn px-4 py-3 rounded-xl border border-primary/20 text-primary font-bold hover:bg-primary/5 transition-colors"
              data-shop-id="${product.shopId || ''}"
              data-product-id="${product.id || ''}"
            >Nhắn shop</button>
          `
        : '';

      return `
        <article class="product-card group relative bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300">
          <a href="${detailUrl}" class="block">
            <div class="aspect-[4/3] overflow-hidden bg-earth-beige/40">
              <img
                src="${imageUrl}"
                alt="${this.escapeHtml(product.name)}"
                class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            </div>
          </a>
          <div class="p-5 space-y-4">
            <div class="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide">
              <span class="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-primary">
                ${this.escapeHtml(product.categoryName || 'Nông sản sạch')}
              </span>
              ${product.shopName ? `<span class="text-slate-400">${this.escapeHtml(product.shopName)}</span>` : ''}
            </div>
            <div>
              <a href="${detailUrl}" class="block hover:text-primary transition-colors">
                <h3 class="text-xl font-bold text-forest line-clamp-2">${this.escapeHtml(product.name)}</h3>
              </a>
              <p class="mt-2 text-sm text-slate-500 line-clamp-3">
                ${this.escapeHtml(product.description || 'Sản phẩm tươi sạch được tuyển chọn từ Green Market.')}
              </p>
            </div>
            <div class="flex items-end justify-between gap-4">
              <div>
                <p class="text-2xl font-black text-primary">${price}</p>
                <p class="mt-1 text-sm font-medium ${stockColor}">${stockText}</p>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <a
                href="${detailUrl}"
                class="px-4 py-3 rounded-xl bg-earth-beige/50 text-forest text-center font-bold hover:bg-earth-beige transition-colors"
              >Xem chi tiết</a>
              <button
                class="add-to-cart-btn px-4 py-3 rounded-xl bg-primary text-white font-bold hover:bg-forest transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                data-product-id="${product.id}"
                ${Number(product.stock || 0) <= 0 ? 'disabled' : ''}
              >Thêm giỏ hàng</button>
            </div>
            ${chatButton ? `<div class="grid grid-cols-1">${chatButton}</div>` : ''}
          </div>
        </article>
      `;
    },

    bindProductCardActions(root) {
      const scope = root || document;
      scope.querySelectorAll('.add-to-cart-btn').forEach((button) => {
        if (button.dataset.bound === 'true') return;
        button.dataset.bound = 'true';
        button.addEventListener('click', async (event) => {
          event.preventDefault();
          await this.addProductToCart(button.dataset.productId, button);
        });
      });

      scope.querySelectorAll('.contact-shop-btn').forEach((button) => {
        if (button.dataset.bound === 'true') return;
        button.dataset.bound = 'true';
        button.addEventListener('click', async (event) => {
          event.preventDefault();
          const user = await this.refreshCurrentUser();
          if (!user) {
            this.redirectToLogin();
            return;
          }

          const shopId = Number(button.dataset.shopId);
          if (!shopId) {
            this.notify('Không tìm thấy thông tin shop để nhắn.', 'warning');
            return;
          }

          try {
            const opened = await this.openShopConversation({
              shopId,
              productId: Number(button.dataset.productId || 0) || null,
            });

            if (!opened?.conversationId) {
              this.notify('Không mở được hội thoại với shop.', 'error');
              return;
            }

            window.location.href = this.buildPageUrl('chat.html', {
              conversationId: opened.conversationId,
              sellerId: opened.sellerId,
              shopId: opened.shopId,
              productId: Number(button.dataset.productId || 0) || undefined,
            });
          } catch (error) {
            this.notify(error.message, 'error');
          }
        });
      });
    },

    async bootstrapPage() {
      await this.updateHeaderState();
      this.bindGlobalActions(document);
      this.ensureFloatingChatWidget();
    },

    initCatalogPage(config) {
      const pageConfig = config || {};

      document.addEventListener('DOMContentLoaded', async () => {
        await this.bootstrapPage();

        const productContainer = document.querySelector(pageConfig.containerSelector)
          || document.querySelector('.product-grid')
          || (document.querySelector('.product-card') ? document.querySelector('.product-card').parentElement : null);
        const filterButtons = Array.from(document.querySelectorAll(pageConfig.filterButtonSelector || '.filter-btn, .veg-filter'));
        const priceRange = document.querySelector(pageConfig.priceRangeSelector || '#priceRange');
        const priceValue = document.querySelector(pageConfig.priceValueSelector || '#priceValue');
        const sortOptions = Array.from(document.querySelectorAll(pageConfig.sortOptionSelector || '.sort-option'));
        const sortButton = document.querySelector(pageConfig.sortButtonSelector || '#sortBtn');
        const sortMenu = document.querySelector(pageConfig.sortMenuSelector || '#sortMenu');
        const sortText = document.querySelector(pageConfig.sortTextSelector || '#sortText');
        const resetButton = document.querySelector(pageConfig.resetButtonSelector || '#resetFilter');
        const countTarget = document.querySelector(pageConfig.countSelector || '[data-product-count]');
        const emptyTitle = pageConfig.emptyTitle || 'Chưa có sản phẩm phù hợp';
        const emptyDescription = pageConfig.emptyDescription || 'Hiện chưa có dữ liệu từ backend cho bộ lọc này.';
        const pageSize = Math.max(Number(pageConfig.pageSize || 12), 1);
        let activeFilter = pageConfig.defaultFilter || 'all';
        let activeSort = pageConfig.defaultSort || 'new';
        let currentPage = 1;
        let allProducts = [];
        let scopedProducts = [];

        if (!productContainer) return;

        const summaryTarget = this.findCatalogSummaryElement(pageConfig.summarySelector, productContainer);
        const paginationContainer = this.findPaginationContainer(productContainer, pageConfig.paginationContainerSelector);

        this.prepareSelectableButtons(filterButtons);
        this.prepareSelectableButtons(sortOptions);
        this.applyActiveButtonState(
          filterButtons,
          filterButtons.find((button) => (button.dataset.filter || 'all') === activeFilter) || null
        );
        this.applyActiveButtonState(
          sortOptions,
          sortOptions.find((option) => (option.dataset.sort || 'new') === activeSort) || null
        );

        productContainer.innerHTML = `
          <div class="col-span-full rounded-2xl border border-dashed border-primary/20 bg-white px-6 py-10 text-center text-slate-500">
            Đang tải sản phẩm...
          </div>
        `;

        if (sortButton && sortMenu && sortButton.dataset.boundSortMenu !== 'true') {
          sortButton.dataset.boundSortMenu = 'true';
          sortButton.addEventListener('click', () => {
            sortMenu.classList.toggle('hidden');
          });

          document.addEventListener('click', (event) => {
            if (sortMenu.classList.contains('hidden')) return;
            if (sortMenu.contains(event.target) || sortButton.contains(event.target)) return;
            sortMenu.classList.add('hidden');
          });
        }

        sortOptions.forEach((option) => {
          if (option.dataset.boundSortOption === 'true') return;
          option.dataset.boundSortOption = 'true';
          option.addEventListener('click', () => {
            activeSort = option.dataset.sort || 'new';
            currentPage = 1;
            this.applyActiveButtonState(sortOptions, option);
            if (sortText) {
              sortText.textContent = `Sắp xếp: ${option.textContent.trim()}`;
            }
            if (sortMenu) {
              sortMenu.classList.add('hidden');
            }
            render();
          });
        });

        if (resetButton && resetButton.dataset.boundReset !== 'true') {
          resetButton.dataset.boundReset = 'true';
          resetButton.addEventListener('click', () => {
            activeFilter = 'all';
            currentPage = 1;
            if (priceRange) {
              priceRange.value = priceRange.max || priceRange.value;
            }
            this.applyActiveButtonState(
              filterButtons,
              filterButtons.find((button) => (button.dataset.filter || 'all') === 'all') || null
            );
            render();
          });
        }

        filterButtons.forEach((button) => {
          if (button.dataset.boundFilter === 'true') return;
          button.dataset.boundFilter = 'true';
          button.addEventListener('click', () => {
            activeFilter = button.dataset.filter || 'all';
            currentPage = 1;
            this.applyActiveButtonState(filterButtons, button);
            render();
          });
        });

        if (priceRange && priceRange.dataset.boundPrice !== 'true') {
          priceRange.dataset.boundPrice = 'true';
          priceRange.addEventListener('input', () => {
            currentPage = 1;
            render();
          });
        }

        const keywordQuery = this.getQueryParam('keyword');
        const normalizedKeyword = this.normalizeText(keywordQuery || '');

        const findMatchingCategory = async (categories) => {
          if (!pageConfig.categoryName) return null;
          const normalizedTarget = this.normalizeText(pageConfig.categoryName);
          return categories.find((category) => this.normalizeText(category.name) === normalizedTarget)
            || categories.find((category) => this.normalizeText(category.name).includes(normalizedTarget))
            || null;
        };

        const render = () => {
          const maxPrice = priceRange ? Number(priceRange.value) : Number.MAX_SAFE_INTEGER;
          if (priceValue && priceRange) {
            priceValue.textContent = this.formatCurrency(maxPrice);
          }

          const activeFilterButton = filterButtons.find((button) => button.dataset.filter === activeFilter) || null;
          const filteredProducts = this.sortProducts(
            scopedProducts.filter((product) => {
              const withinPrice = Number(product.price || 0) <= maxPrice;
              const matchesFilter = this.matchesProductFilter(
                product,
                activeFilter,
                activeFilterButton?.textContent || '',
                activeFilterButton
              );
              const matchesKeyword = !normalizedKeyword || this.getProductSearchIndex(product).includes(normalizedKeyword);
              return withinPrice && matchesFilter && matchesKeyword;
            }),
            activeSort
          );

          if (countTarget) {
            countTarget.textContent = String(filteredProducts.length);
          }

          const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
          currentPage = Math.min(currentPage, totalPages);
          const startIndex = (currentPage - 1) * pageSize;
          const pageProducts = filteredProducts.slice(startIndex, startIndex + pageSize);

          this.renderCatalogSummary(summaryTarget, pageProducts.length, filteredProducts.length);

          if (!filteredProducts.length) {
            productContainer.innerHTML = `
              <div class="col-span-full rounded-2xl border border-dashed border-primary/20 bg-white px-6 py-12 text-center">
                <h3 class="text-2xl font-bold text-forest">${this.escapeHtml(emptyTitle)}</h3>
                <p class="mt-3 text-slate-500">${this.escapeHtml(emptyDescription)}</p>
                <a href="${this.buildPageUrl('sanpham.html')}" class="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-white hover:bg-forest transition-colors">
                  Xem toàn bộ sản phẩm
                </a>
              </div>
            `;
            this.renderPagination(paginationContainer, 1, 0, () => {});
            return;
          }

          productContainer.innerHTML = pageProducts
            .map((product) => this.createProductCard(product, { showChat: pageConfig.showChat !== false }))
            .join('');

          this.bindProductCardActions(productContainer);
          this.bindGlobalActions(productContainer);
          this.renderPagination(paginationContainer, currentPage, totalPages, (page) => {
            currentPage = page;
            render();
            productContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        };

        try {
          const [products, categories] = await Promise.all([
            this.request('/api/products', { auth: false }),
            this.request('/api/categories', { auth: false }),
          ]);

          allProducts = Array.isArray(products) ? products : [];
          const matchedCategory = await findMatchingCategory(Array.isArray(categories) ? categories : []);
          scopedProducts = [...allProducts];

          if (matchedCategory) {
            scopedProducts = scopedProducts.filter((product) => Number(product.categoryId) === Number(matchedCategory.id));
          } else if (Array.isArray(pageConfig.fallbackKeywords) && pageConfig.fallbackKeywords.length) {
            const normalizedKeywords = pageConfig.fallbackKeywords.map((keyword) => this.normalizeText(keyword)).filter(Boolean);
            scopedProducts = scopedProducts.filter((product) => {
              const searchIndex = this.getProductSearchIndex(product);
              return normalizedKeywords.some((keyword) => searchIndex.includes(keyword));
            });
          }

          if (!matchedCategory && pageConfig.categoryName && !scopedProducts.length) {
            scopedProducts = [...allProducts];
          }

          if (priceRange) {
            const maxProductPrice = Math.max(...scopedProducts.map((product) => Number(product.price || 0)), 0);
            const sliderMax = Math.max(Number(priceRange.max || 0), maxProductPrice);
            priceRange.max = String(sliderMax || 1000000);
            if (!priceRange.value || Number(priceRange.value) < maxProductPrice) {
              priceRange.value = String(sliderMax || 1000000);
            }
          }

          render();
        } catch (error) {
          productContainer.innerHTML = `
            <div class="col-span-full rounded-2xl border border-rose-200 bg-rose-50 px-6 py-12 text-center text-rose-600">
              ${this.escapeHtml(error.message || 'Không tải được sản phẩm từ backend.')}
            </div>
          `;
        }
      });
    },
  };

  window.GreenMarketApp = App;

  document.addEventListener('DOMContentLoaded', () => {
    App.bootstrapPage().catch((error) => {
      console.warn('Bootstrap page failed:', error);
    });
  });
})(window, document);

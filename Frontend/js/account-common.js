(function (window, document) {
  const app = window.GreenMarketApp;
  if (!app) return;

  const orderLabelMap = {
    PendingPayment: 'Chờ thanh toán',
    AwaitingConfirmation: 'Chờ xác nhận',
    Processing: 'Đang xử lý',
    ReadyToShip: 'Sẵn sàng giao',
    Shipping: 'Đang giao hàng',
    Delivered: 'Đã giao hàng',
    Completed: 'Hoàn tất',
    Cancelled: 'Đã hủy',
    FailedDelivery: 'Giao thất bại',
    ReturnRequested: 'Yêu cầu trả hàng',
    Returned: 'Đã trả hàng',
    PaymentFailed: 'Thanh toán thất bại',
  };

  const orderToneMap = {
    PendingPayment: 'bg-amber-100 text-amber-700',
    AwaitingConfirmation: 'bg-sky-100 text-sky-700',
    Processing: 'bg-indigo-100 text-indigo-700',
    ReadyToShip: 'bg-teal-100 text-teal-700',
    Shipping: 'bg-blue-100 text-blue-700',
    Delivered: 'bg-emerald-100 text-emerald-700',
    Completed: 'bg-emerald-100 text-emerald-700',
    Cancelled: 'bg-rose-100 text-rose-700',
    FailedDelivery: 'bg-rose-100 text-rose-700',
    ReturnRequested: 'bg-orange-100 text-orange-700',
    Returned: 'bg-slate-100 text-slate-700',
    PaymentFailed: 'bg-rose-100 text-rose-700',
  };

  const roleToneMap = {
    User: 'bg-slate-100 text-slate-700',
    Seller: 'bg-emerald-100 text-emerald-700',
    Shipper: 'bg-sky-100 text-sky-700',
    Admin: 'bg-amber-100 text-amber-700',
  };

  const pageMetaMap = {
    dashboard: {
      kicker: 'Tài khoản',
      title: 'Tổng quan',
      description: 'Nhìn nhanh đơn hàng, vai trò và lối tắt cần dùng mỗi ngày.',
    },
    profile: {
      kicker: 'Hồ sơ',
      title: 'Thông tin tài khoản',
      description: 'Email, vai trò và quyền truy cập hiện tại của bạn.',
    },
    orders: {
      kicker: 'Đơn hàng',
      title: 'Theo dõi đơn của bạn',
      description: 'Lọc nhanh, xem tiến độ và xử lý từng đơn ở một nơi.',
    },
    seller: {
      kicker: 'Cửa hàng',
      title: 'Shop & sản phẩm',
      description: 'Quản lý shop, SKU và trạng thái bán hàng hiện tại.',
    },
    shipping: {
      kicker: 'Vận chuyển',
      title: 'Bàn giao & giao hàng',
      description: 'Theo dõi job đang nhận và cập nhật tiến độ giao.',
    },
    admin: {
      kicker: 'Quản trị',
      title: 'Điều hành hệ thống',
      description: 'Người dùng, danh mục và số liệu chính trong một màn hình gọn.',
    },
  };

  const navigationItems = [
    { key: 'dashboard', label: 'Tổng quan', icon: 'space_dashboard', file: 'taikhoan.html', roles: ['User', 'Seller', 'Shipper', 'Admin'], helper: 'Tổng quan' },
    { key: 'profile', label: 'Hồ sơ', icon: 'badge', file: 'taikhoan-hoso.html', roles: ['User', 'Seller', 'Shipper', 'Admin'], helper: 'Tài khoản' },
    { key: 'orders', label: 'Đơn hàng', icon: 'receipt_long', file: 'taikhoan-donhang.html', roles: ['User', 'Seller', 'Shipper', 'Admin'], helper: 'Theo dõi đơn' },
    { key: 'seller', label: 'Cửa hàng', icon: 'storefront', file: 'taikhoan-shop.html', roles: ['Seller', 'Admin'], helper: 'Bán hàng' },
    { key: 'shipping', label: 'Giao hàng', icon: 'local_shipping', file: 'taikhoan-vanchuyen.html', roles: ['Shipper', 'Admin'], helper: 'Vận chuyển' },
    { key: 'admin', label: 'Quản trị', icon: 'shield_person', file: 'taikhoan-quantri.html', roles: ['Admin'], helper: 'Quyền quản trị' },
  ];

  const tabRouteMap = {
    orders: 'taikhoan-donhang.html',
    'orders-section': 'taikhoan-donhang.html',
    'user-role': 'taikhoan-hoso.html',
    'user-role-section': 'taikhoan-hoso.html',
    'seller-role': 'taikhoan-shop.html',
    'seller-role-section': 'taikhoan-shop.html',
    'shipper-role': 'taikhoan-vanchuyen.html',
    'shipper-role-section': 'taikhoan-vanchuyen.html',
    'admin-role': 'taikhoan-quantri.html',
    'admin-role-section': 'taikhoan-quantri.html',
  };

  function supportsRole(roles, role) {
    return Array.isArray(roles) && roles.includes(role);
  }

  const Account = {
    app,
    orderLabelMap,
    orderToneMap,
    roleToneMap,
    pageMetaMap,
    navigationItems,

    async boot(pageKey) {
      const currentUser = await app.requireAuth();
      if (!currentUser) return null;

      if (pageKey === 'dashboard') {
        const requestedTab = app.getQueryParam('tab');
        const redirectFile = tabRouteMap[requestedTab || ''];
        if (redirectFile) {
          const target = app.buildPageUrl(redirectFile, {
            orderId: app.getQueryParam('orderId') || '',
          });
          if (!window.location.pathname.endsWith(`/${redirectFile}`)) {
            window.location.href = target;
            return null;
          }
        }
      }

      const ctx = {
        pageKey,
        currentUser,
        state: {
          orders: [],
          shops: [],
          products: [],
          categories: [],
          adminUsers: [],
          dashboard: null,
          availableOrders: [],
        },
        elements: {
          sidebar: document.getElementById('account-sidebar'),
          heroKicker: document.getElementById('account-page-kicker'),
          heroTitle: document.getElementById('account-page-title'),
          heroDescription: document.getElementById('account-page-description'),
          heroMeta: document.getElementById('account-hero-meta'),
          content: document.getElementById('account-page-content'),
        },
      };

      this.renderHero(ctx);
      this.renderSidebar(ctx);
      return ctx;
    },

    renderHero(ctx) {
      const meta = pageMetaMap[ctx.pageKey] || pageMetaMap.dashboard;
      if (ctx.elements.heroKicker) ctx.elements.heroKicker.textContent = meta.kicker;
      if (ctx.elements.heroTitle) ctx.elements.heroTitle.textContent = meta.title;
      if (ctx.elements.heroDescription) ctx.elements.heroDescription.textContent = meta.description;
      if (!ctx.elements.heroMeta) return;

      const roleTone = roleToneMap[ctx.currentUser.role] || roleToneMap.User;
      ctx.elements.heroMeta.innerHTML = `
        <div class="gm-account-mini-stat">
          <span class="gm-account-mini-label">Tài khoản</span>
          <strong>${app.escapeHtml(ctx.currentUser.username || 'Người dùng')}</strong>
        </div>
        <div class="gm-account-mini-stat">
          <span class="gm-account-mini-label">Role</span>
          <span class="inline-flex rounded-full px-3 py-1 text-xs font-extrabold ${roleTone}">${app.escapeHtml(ctx.currentUser.role)}</span>
        </div>
        <div class="gm-account-mini-stat">
          <span class="gm-account-mini-label">Trạng thái</span>
          <strong>Đang hoạt động</strong>
        </div>
      `;
    },

    getNavigationModel(ctx) {
      return navigationItems.reduce((items, item) => {
        const accessible = supportsRole(item.roles, ctx.currentUser.role);
        let href = app.buildPageUrl(item.file);
        let helper = item.helper;
        let label = item.label;

        if (item.key === 'seller' && !accessible && ctx.currentUser.role === 'User') {
          href = app.buildPageUrl('taikhoan-hoso.html', { focus: 'become-seller' }) + '#become-seller';
          helper = 'Mở shop';
          label = 'Mở shop';
        } else if (!accessible) {
          return items;
        }

        items.push({
          ...item,
          href,
          helper,
          label,
          accessible,
          active: item.key === ctx.pageKey,
        });
        return items;
      }, []);
    },

    renderSidebar(ctx) {
      if (!ctx.elements.sidebar) return;
      const roleTone = roleToneMap[ctx.currentUser.role] || roleToneMap.User;
      const navItems = this.getNavigationModel(ctx);
      const initial = String(ctx.currentUser.username || 'U').trim().charAt(0).toUpperCase() || 'U';

      ctx.elements.sidebar.innerHTML = `
        <div class="gm-account-sidebar-card is-profile">
          <div class="gm-account-user">
            <span class="gm-account-avatar">${app.escapeHtml(initial)}</span>
            <div class="gm-account-user-meta">
              <p class="text-lg font-black text-forest">${app.escapeHtml(ctx.currentUser.username || 'Người dùng')}</p>
              <p class="mt-1 text-sm text-slate-500">${app.escapeHtml(ctx.currentUser.email || '')}</p>
            </div>
          </div>
          <div class="gm-account-top-actions">
            <span class="inline-flex rounded-full px-3 py-1 text-xs font-extrabold ${roleTone}">${app.escapeHtml(ctx.currentUser.role)}</span>
            <button id="account-logout-button" class="gm-account-logout-btn" type="button" aria-label="Đăng xuất" title="Đăng xuất">
              <span class="material-symbols-outlined text-lg">logout</span>
            </button>
          </div>
        </div>
        <div class="gm-account-sidebar-card">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="text-xs font-extrabold uppercase tracking-[0.25em] text-slate-400">Điều hướng</p>
            <a href="${app.buildPageUrl('chat.html')}" class="text-sm font-bold text-primary transition hover:text-forest">Tin nhắn</a>
          </div>
          <div class="gm-account-nav mt-4">
            ${navItems.map((item) => `
              <a href="${item.href}" class="gm-account-nav-link ${item.active ? 'is-active' : ''} ${!item.accessible && item.key !== 'seller' ? 'is-disabled' : ''}" ${!item.accessible && item.key !== 'seller' ? 'aria-disabled="true"' : ''}>
                <span class="material-symbols-outlined">${item.icon}</span>
                <span>
                  <strong>${app.escapeHtml(item.label)}</strong>
                  <small>${app.escapeHtml(item.helper)}</small>
                </span>
              </a>
            `).join('')}
          </div>
        </div>
      `;

      ctx.elements.sidebar.querySelector('#account-logout-button')?.addEventListener('click', () => app.logout());
    },

    async loadData(ctx, include) {
      const flags = include || {};
      const currentRole = ctx.currentUser.role;
      const requests = [
        flags.orders ? app.request('/api/orders/my') : Promise.resolve([]),
        flags.shops ? app.request('/api/shops', { auth: false }) : Promise.resolve([]),
        flags.products ? app.request('/api/products', { auth: false }) : Promise.resolve([]),
        flags.categories ? app.request('/api/categories', { auth: false }) : Promise.resolve([]),
        flags.adminUsers ? app.request('/api/admin/users') : Promise.resolve([]),
        flags.dashboard ? app.request('/api/admin/dashboard') : Promise.resolve(null),
        flags.availableOrders ? app.request('/api/orders/available-for-shipping') : Promise.resolve([]),
      ];

      const [orders, shops, products, categories, adminUsers, dashboard, availableOrders] = await Promise.all(requests);
      ctx.state.orders = Array.isArray(orders) ? orders : [];
      ctx.state.shops = Array.isArray(shops) ? shops : [];
      ctx.state.products = Array.isArray(products) ? products : [];
      ctx.state.categories = Array.isArray(categories) ? categories : [];
      ctx.state.adminUsers = Array.isArray(adminUsers) ? adminUsers : [];
      ctx.state.dashboard = dashboard;
      ctx.state.availableOrders = Array.isArray(availableOrders) ? availableOrders : [];

      if (!flags.categories && (currentRole === 'Seller' || currentRole === 'Admin')) {
        ctx.state.categories = ctx.state.categories || [];
      }
    },

    getManagedShops(ctx) {
      if (ctx.currentUser.role === 'Admin') return ctx.state.shops;
      return ctx.state.shops.filter((shop) => Number(shop.sellerId) === Number(ctx.currentUser.id));
    },

    getManagedProducts(ctx) {
      if (ctx.currentUser.role === 'Admin') return ctx.state.products;
      const shopIds = new Set(this.getManagedShops(ctx).map((shop) => Number(shop.id)));
      return ctx.state.products.filter((product) => shopIds.has(Number(product.shopId)));
    },

    countOrdersByStatus(orders, statuses) {
      const statusList = Array.isArray(statuses) ? statuses : [statuses];
      return (orders || []).filter((order) => statusList.includes(order.status)).length;
    },

    createKpiCardMarkup(label, value, helper, valueClassName) {
      return `
        <article class="gm-kpi-card">
          <p class="gm-kpi-card-label">${app.escapeHtml(label)}</p>
          <h3 class="gm-kpi-card-value ${valueClassName || ''}">${app.escapeHtml(String(value))}</h3>
          ${helper ? `<p class="mt-2 text-sm leading-6 text-slate-500">${app.escapeHtml(helper)}</p>` : ''}
        </article>
      `;
    },

    createEmptyStateMarkup(title, description, actionMarkup) {
      return `
        <div class="gm-account-empty">
          <h3 class="text-xl font-black text-forest">${app.escapeHtml(title)}</h3>
          <p class="mt-3 max-w-xl text-sm leading-7 text-slate-500">${app.escapeHtml(description)}</p>
          ${actionMarkup ? `<div class="mt-5">${actionMarkup}</div>` : ''}
        </div>
      `;
    },

    createAccessStateMarkup(title, description, actionMarkup) {
      return `
        <section class="gm-account-surface p-8">
          <div class="rounded-[1.75rem] border border-dashed border-primary/20 bg-background-light px-6 py-10 text-center">
            <p class="text-xs font-extrabold uppercase tracking-[0.24em] text-primary">Quyền truy cập</p>
            <h2 class="mt-4 text-3xl font-black text-forest">${app.escapeHtml(title)}</h2>
            <p class="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-500">${app.escapeHtml(description)}</p>
            ${actionMarkup ? `<div class="mt-6 flex flex-wrap justify-center gap-3">${actionMarkup}</div>` : ''}
          </div>
        </section>
      `;
    },

    hasRole(ctx, roles) {
      return supportsRole(roles, ctx.currentUser.role);
    },

    renderAccessState(container, title, description, actionMarkup) {
      if (!container) return;
      container.innerHTML = this.createAccessStateMarkup(title, description, actionMarkup);
    },

    getShipperOptions(ctx, selectedId) {
      const shippers = ctx.state.adminUsers.filter((user) => user.role === 'Shipper');
      return ['<option value="">Chọn shipper</option>']
        .concat(shippers.map((shipper) => `
          <option value="${shipper.id}" ${Number(selectedId) === Number(shipper.id) ? 'selected' : ''}>${app.escapeHtml(shipper.username)} - ${app.escapeHtml(shipper.email)}</option>
        `))
        .join('');
    },

    createOrderDetailsMarkup(order) {
      const details = Array.isArray(order.orderDetails) ? order.orderDetails : [];
      if (!details.length) {
        return '<p class="text-sm text-slate-500">Đơn hàng chưa có chi tiết sản phẩm.</p>';
      }

      return details.map((detail) => `
        <div class="flex items-center justify-between gap-4 rounded-2xl bg-background-light px-4 py-3">
          <div class="flex items-center gap-3">
            <img src="${app.resolveImageUrl(detail.imageUrl)}" alt="${app.escapeHtml(detail.productName || 'Sản phẩm')}" class="h-14 w-14 rounded-2xl object-cover bg-earth-beige/40" />
            <div>
              <p class="font-bold text-forest">${app.escapeHtml(detail.productName || 'Sản phẩm')}</p>
              <p class="text-sm text-slate-500">${detail.shopName ? app.escapeHtml(detail.shopName) : ''}</p>
            </div>
          </div>
          <div class="text-right text-sm text-slate-500">
            <p>x${detail.quantity}</p>
            <p class="font-bold text-primary">${app.formatCurrency(detail.lineTotal)}</p>
          </div>
        </div>
      `).join('');
    },

    createOrderProgressMarkup(order) {
      const progress = Math.max(0, Math.min(100, Number(order.progressPercent || 0)));
      const reservationLabel = order.reservationState?.label;
      const shippingLabel = order.shipping?.attentionLabel || order.shipping?.deliveryNote;
      return `
        <div class="space-y-3 rounded-2xl border border-primary/10 bg-white p-4">
          <div class="flex items-center justify-between gap-3 text-sm">
            <p class="font-bold text-forest">Tiến độ vận hành</p>
            <span class="font-bold text-primary">${progress}%</span>
          </div>
          <div class="gm-order-progress"><span style="width:${progress}%"></span></div>
          <p class="text-sm text-slate-500">${app.escapeHtml(reservationLabel || shippingLabel || 'Đơn đang được xử lý theo luồng vận hành hiện tại.')}</p>
        </div>
      `;
    },

    createTimelineMarkup(order) {
      const timeline = Array.isArray(order.timeline) ? order.timeline : [];
      if (!timeline.length) return '';
      return `
        <div class="rounded-2xl border border-primary/10 bg-white p-4">
          <div class="flex items-center justify-between gap-3">
            <p class="font-bold text-forest">Timeline đơn hàng</p>
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Workflow</span>
          </div>
          <div class="gm-order-timeline mt-4">
            ${timeline.map((item) => `
              <div class="gm-order-timeline-item">
                <span class="gm-order-timeline-dot ${item.isCompleted ? 'is-completed' : ''} ${item.isCurrent ? 'is-active' : ''}"></span>
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="font-bold text-forest">${app.escapeHtml(item.title || 'Cập nhật')}</p>
                    ${item.occurredAt ? `<span class="text-xs text-slate-400">${app.formatDate(item.occurredAt)}</span>` : ''}
                  </div>
                  <p class="mt-1 text-sm text-slate-500">${app.escapeHtml(item.description || '')}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    },

    createShippingMarkup(order) {
      const shipping = order.shipping;
      if (!shipping) return '';
      return `
        <div class="rounded-2xl border border-primary/10 bg-white p-4 text-sm text-slate-600">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="font-bold text-forest">Vận chuyển & bàn giao</p>
              <p class="mt-1 text-slate-500">${app.escapeHtml(shipping.carrierLabel || 'Đang chờ điều phối vận chuyển')}</p>
            </div>
            <span class="gm-order-chip">${app.escapeHtml(shipping.currentStatusLabel || order.statusLabel || order.status || 'Đang xử lý')}</span>
          </div>
          <div class="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p class="text-xs font-bold uppercase tracking-widest text-slate-400">Mã theo dõi</p>
              <p class="mt-1 font-bold text-forest">${app.escapeHtml(shipping.trackingCode || order.orderCode || `Đơn #${order.id}`)}</p>
            </div>
            <div>
              <p class="text-xs font-bold uppercase tracking-widest text-slate-400">Phụ trách</p>
              <p class="mt-1 font-bold text-forest">${app.escapeHtml(shipping.assignedShipperName || order.assignedShipper?.username || 'Chưa gán shipper')}</p>
            </div>
          </div>
          <p class="mt-3 text-sm text-slate-500">${app.escapeHtml(shipping.deliveryNote || shipping.attentionLabel || 'Thông tin bàn giao sẽ được cập nhật theo trạng thái đơn hàng.')}</p>
        </div>
      `;
    },

    createSellerSlicesMarkup(order) {
      const sellerSlices = Array.isArray(order.sellerSlices) ? order.sellerSlices : [];
      if (!sellerSlices.length) return '';
      return `
        <div class="rounded-2xl border border-primary/10 bg-white p-4">
          <p class="font-bold text-forest">Phân bổ theo shop</p>
          <div class="mt-4 grid gap-3 lg:grid-cols-2">
            ${sellerSlices.map((slice) => `
              <div class="rounded-2xl bg-background-light px-4 py-3 text-sm text-slate-600">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="font-bold text-forest">${app.escapeHtml(slice.shopName || 'Shop liên kết')}</p>
                    <p class="mt-1 text-slate-500">${slice.itemCount || 0} sản phẩm</p>
                  </div>
                  <p class="font-black text-primary">${app.formatCurrency(slice.subtotal || 0)}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    },

    getOrderActionsMarkup(ctx, order) {
      const status = order.status;
      const actions = [];
      const currentRole = ctx.currentUser.role;

      if (currentRole === 'User') {
        if (status === 'PendingPayment' || status === 'PaymentFailed') {
          actions.push('<button data-action="pay-order" data-order-id="' + order.id + '" class="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-forest transition-colors">Thanh toán lại</button>');
        }
        if (['PendingPayment', 'AwaitingConfirmation', 'Processing', 'ReadyToShip', 'FailedDelivery'].includes(status)) {
          actions.push('<button data-action="update-status" data-order-id="' + order.id + '" data-status="Cancelled" class="rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors">Hủy đơn</button>');
        }
        if (status === 'Delivered') {
          actions.push('<button data-action="update-status" data-order-id="' + order.id + '" data-status="Completed" class="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 transition-colors">Xác nhận hoàn tất</button>');
          actions.push('<button data-action="update-status" data-order-id="' + order.id + '" data-status="ReturnRequested" class="rounded-xl border border-orange-200 px-4 py-3 text-sm font-bold text-orange-600 hover:bg-orange-50 transition-colors">Yêu cầu trả hàng</button>');
        }
        if (status === 'Shipping') {
          actions.push('<button data-action="update-status" data-order-id="' + order.id + '" data-status="ReturnRequested" class="rounded-xl border border-orange-200 px-4 py-3 text-sm font-bold text-orange-600 hover:bg-orange-50 transition-colors">Yêu cầu trả hàng</button>');
        }
      }

      if (currentRole === 'Seller') {
        if (status === 'AwaitingConfirmation') {
          actions.push('<button data-action="update-status" data-order-id="' + order.id + '" data-status="Processing" class="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-forest transition-colors">Xác nhận đơn</button>');
          actions.push('<button data-action="update-status" data-order-id="' + order.id + '" data-status="Cancelled" class="rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors">Từ chối đơn</button>');
        }
        if (status === 'Processing') {
          actions.push('<button data-action="update-status" data-order-id="' + order.id + '" data-status="ReadyToShip" class="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-forest transition-colors">Chuẩn bị giao</button>');
          actions.push('<button data-action="update-status" data-order-id="' + order.id + '" data-status="Cancelled" class="rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors">Hủy đơn</button>');
        }
        if (status === 'FailedDelivery') {
          actions.push('<button data-action="update-status" data-order-id="' + order.id + '" data-status="ReadyToShip" class="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-forest transition-colors">Giao lại</button>');
          actions.push('<button data-action="update-status" data-order-id="' + order.id + '" data-status="Cancelled" class="rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors">Hủy đơn</button>');
        }
      }

      if (currentRole === 'Shipper' && status === 'Shipping') {
        actions.push('<button data-action="update-status" data-order-id="' + order.id + '" data-status="Delivered" class="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 transition-colors">Đã giao thành công</button>');
        actions.push('<button data-action="update-status" data-order-id="' + order.id + '" data-status="FailedDelivery" class="rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors">Giao thất bại</button>');
      }

      if (currentRole === 'Admin') {
        actions.push(`
          <div class="flex flex-wrap items-center gap-3">
            <select data-action="admin-status-select" data-order-id="${order.id}" class="rounded-xl border border-primary/15 bg-white px-4 py-3 text-sm focus:border-primary focus:ring-primary">
              ${Object.keys(orderLabelMap).map((statusKey) => `<option value="${statusKey}" ${statusKey === status ? 'selected' : ''}>${orderLabelMap[statusKey]}</option>`).join('')}
            </select>
            <button data-action="admin-status-save" data-order-id="${order.id}" class="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-forest transition-colors">Cập nhật trạng thái</button>
          </div>
        `);

        if (['ReadyToShip', 'FailedDelivery'].includes(status)) {
          actions.push(`
            <div class="flex flex-wrap items-center gap-3">
              <select data-action="shipper-select" data-order-id="${order.id}" class="rounded-xl border border-primary/15 bg-white px-4 py-3 text-sm focus:border-primary focus:ring-primary">
                ${this.getShipperOptions(ctx, order.assignedShipperId)}
              </select>
              <button data-action="assign-shipper" data-order-id="${order.id}" class="rounded-xl border border-primary/15 px-4 py-3 text-sm font-bold text-primary hover:bg-primary/5 transition-colors">Gán shipper</button>
            </div>
          `);
        }
      }

      return actions.join('');
    },

    renderOrderCard(ctx, order, options) {
      const settings = options || {};
      const actionMarkup = this.getOrderActionsMarkup(ctx, order);
      const showAiButton = settings.showAiButton !== false;
      const compact = settings.compact === true;
      const wrapperClass = compact
        ? 'rounded-[1.75rem] border border-primary/10 bg-white p-5 shadow-sm'
        : 'rounded-[1.75rem] border border-primary/10 bg-white p-6 shadow-sm';

      return `
        <article class="${wrapperClass}" data-order-card data-order-id="${order.id}">
          <div class="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div class="flex-1 space-y-4">
              <div class="flex flex-wrap items-center gap-3">
                <h3 class="text-2xl font-bold text-forest">${app.escapeHtml(order.orderCode || `Đơn #${order.id}`)}</h3>
                <span class="rounded-full px-4 py-2 text-sm font-bold ${orderToneMap[order.status] || 'bg-slate-100 text-slate-700'}">${app.escapeHtml(order.statusLabel || orderLabelMap[order.status] || order.status)}</span>
                ${order.reservationState?.isHoldingStock ? '<span class="gm-order-chip">Giữ hàng</span>' : ''}
              </div>
              <div class="grid gap-4 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p class="font-bold text-forest">Ngày tạo</p>
                  <p class="mt-1">${app.formatDate(order.orderDate)}</p>
                </div>
                <div>
                  <p class="font-bold text-forest">Người nhận</p>
                  <p class="mt-1">${app.escapeHtml(order.contactName || '—')}</p>
                </div>
                <div>
                  <p class="font-bold text-forest">Điện thoại</p>
                  <p class="mt-1">${app.escapeHtml(order.contactPhone || '—')}</p>
                </div>
                <div>
                  <p class="font-bold text-forest">Tổng tiền</p>
                  <p class="mt-1 font-black text-primary">${app.formatCurrency(order.totalAmount)}</p>
                </div>
              </div>
              <div class="rounded-2xl bg-background-light p-4 text-sm text-slate-600">
                <p><span class="font-bold text-forest">Địa chỉ giao hàng:</span> ${app.escapeHtml(order.shippingAddress || '—')}</p>
                ${order.note ? `<p class="mt-2"><span class="font-bold text-forest">Ghi chú:</span> ${app.escapeHtml(order.note)}</p>` : ''}
                ${order.assignedShipper ? `<p class="mt-2"><span class="font-bold text-forest">Shipper:</span> ${app.escapeHtml(order.assignedShipper.username)} (${app.escapeHtml(order.assignedShipper.email)})</p>` : ''}
              </div>
              ${this.createOrderProgressMarkup(order)}
              ${this.createShippingMarkup(order)}
              ${this.createSellerSlicesMarkup(order)}
              <div class="space-y-3">${this.createOrderDetailsMarkup(order)}</div>
              ${compact ? '' : this.createTimelineMarkup(order)}
            </div>
            <div class="xl:w-[340px] shrink-0 space-y-3">
              ${actionMarkup || '<p class="rounded-2xl border border-dashed border-primary/20 px-4 py-5 text-center text-sm text-slate-500">Chưa có thao tác phù hợp cho trạng thái này.</p>'}
              ${showAiButton ? `<button data-action="ask-ai-order" data-order-id="${order.id}" class="w-full rounded-xl border border-primary/15 px-4 py-3 text-sm font-bold text-forest hover:bg-earth-beige/50 transition-colors">Hỏi AI về đơn này</button>` : ''}
            </div>
          </div>
        </article>
      `;
    },

    scrollToOrderFromQuery(container) {
      const orderId = Number(app.getQueryParam('orderId') || 0);
      if (!orderId || !container) return;
      const target = container.querySelector(`[data-order-card][data-order-id="${orderId}"]`);
      if (!target) return;
      window.setTimeout(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        target.classList.add('ring-2', 'ring-primary/20');
        window.setTimeout(() => target.classList.remove('ring-2', 'ring-primary/20'), 2200);
      }, 240);
    },

    async handleOrderStatusUpdate(orderId, status, refreshFn) {
      await app.request(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        body: { status },
      });
      app.notify('Cập nhật trạng thái đơn hàng thành công.', 'success');
      if (typeof refreshFn === 'function') await refreshFn();
    },

    async handlePayOrder(orderId) {
      const response = await app.request(`/api/orders/${orderId}/pay-url`, { method: 'POST' });
      if (response.paymentUrl) {
        window.open(response.paymentUrl, '_blank', 'noopener');
        app.notify('Đã mở cổng thanh toán cho đơn hàng.', 'success');
      }
    },

    bindOrderActions(ctx, refreshFn, root) {
      const scope = root || document;

      scope.querySelectorAll('[data-action="update-status"]').forEach((button) => {
        if (button.dataset.bound === 'true') return;
        button.dataset.bound = 'true';
        button.addEventListener('click', async () => {
          try {
            await this.handleOrderStatusUpdate(Number(button.dataset.orderId), button.dataset.status, refreshFn);
          } catch (error) {
            app.notify(error.message, 'error');
          }
        });
      });

      scope.querySelectorAll('[data-action="pay-order"]').forEach((button) => {
        if (button.dataset.bound === 'true') return;
        button.dataset.bound = 'true';
        button.addEventListener('click', async () => {
          try {
            await this.handlePayOrder(Number(button.dataset.orderId));
          } catch (error) {
            app.notify(error.message, 'error');
          }
        });
      });

      scope.querySelectorAll('[data-action="ask-ai-order"]').forEach((button) => {
        if (button.dataset.bound === 'true') return;
        button.dataset.bound = 'true';
        button.addEventListener('click', () => {
          const order = ctx.state.orders.find((item) => Number(item.id) === Number(button.dataset.orderId));
          if (!order) {
            app.notify('Không tìm thấy ngữ cảnh đơn hàng để mở AI.', 'warning');
            return;
          }

          const primarySlice = Array.isArray(order.sellerSlices) ? order.sellerSlices[0] : null;
          const matchedShop = primarySlice?.shopId
            ? ctx.state.shops.find((shop) => Number(shop.id) === Number(primarySlice.shopId))
            : null;

          app.setAssistantContext({
            orderId: order.id,
            sellerId: matchedShop?.sellerId || null,
            shopId: matchedShop?.id || primarySlice?.shopId || null,
            shopName: matchedShop?.name || primarySlice?.shopName || '',
            productName: '',
          });

          const widget = document.getElementById('gm-floating-chat');
          const panel = widget?.querySelector('.gm-chat-panel');
          const toggle = widget?.querySelector('.gm-chat-toggle');
          const input = widget?.querySelector('.gm-chat-input');
          if (panel?.hidden && toggle) {
            toggle.click();
          }
          if (input) {
            input.value = `Cho tôi biết tình trạng đơn ${order.orderCode || `#${order.id}`}`;
            input.focus();
          }

          app.notify('Đã gắn AI với ngữ cảnh đơn hàng hiện tại.', 'info');
        });
      });

      scope.querySelectorAll('[data-action="accept-delivery"]').forEach((button) => {
        if (button.dataset.bound === 'true') return;
        button.dataset.bound = 'true';
        button.addEventListener('click', async () => {
          try {
            await app.request(`/api/orders/${button.dataset.orderId}/accept-delivery`, { method: 'PUT' });
            app.notify('Đã nhận giao đơn hàng.', 'success');
            if (typeof refreshFn === 'function') await refreshFn();
          } catch (error) {
            app.notify(error.message, 'error');
          }
        });
      });

      scope.querySelectorAll('[data-action="assign-shipper"]').forEach((button) => {
        if (button.dataset.bound === 'true') return;
        button.dataset.bound = 'true';
        button.addEventListener('click', async () => {
          const orderId = Number(button.dataset.orderId);
          const select = document.querySelector(`[data-action="shipper-select"][data-order-id="${orderId}"]`);
          const shipperId = Number(select?.value || 0);
          if (!shipperId) {
            app.notify('Vui lòng chọn shipper trước khi gán.', 'warning');
            return;
          }
          try {
            await app.request(`/api/orders/${orderId}/assign-shipper`, {
              method: 'PUT',
              body: { shipperId },
            });
            app.notify('Đã gán shipper cho đơn hàng.', 'success');
            if (typeof refreshFn === 'function') await refreshFn();
          } catch (error) {
            app.notify(error.message, 'error');
          }
        });
      });

      scope.querySelectorAll('[data-action="admin-status-save"]').forEach((button) => {
        if (button.dataset.bound === 'true') return;
        button.dataset.bound = 'true';
        button.addEventListener('click', async () => {
          const orderId = Number(button.dataset.orderId);
          const select = document.querySelector(`[data-action="admin-status-select"][data-order-id="${orderId}"]`);
          const status = select?.value;
          if (!status) return;
          try {
            await this.handleOrderStatusUpdate(orderId, status, refreshFn);
          } catch (error) {
            app.notify(error.message, 'error');
          }
        });
      });
    },
  };

  window.GreenMarketAccount = Account;
})(window, document);

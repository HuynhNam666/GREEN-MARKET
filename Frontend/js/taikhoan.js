document.addEventListener('DOMContentLoaded', async () => {
  const app = window.GreenMarketApp;
  if (!app) return;

  const currentUser = await app.requireAuth();
  if (!currentUser) return;

  const state = {
    currentUser,
    orders: [],
    shops: [],
    categories: [],
    products: [],
    adminUsers: [],
    dashboard: null,
    availableOrders: [],
  };

  const elements = {
    profileCard: document.getElementById('profile-card'),
    ordersContent: document.getElementById('orders-content'),
    userRoleSection: document.getElementById('user-role-section'),
    sellerRoleSection: document.getElementById('seller-role-section'),
    shipperRoleSection: document.getElementById('shipper-role-section'),
    adminRoleSection: document.getElementById('admin-role-section'),
    availableOrdersContent: document.getElementById('available-orders-content'),
    shopsContent: document.getElementById('shops-content'),
    productsContent: document.getElementById('products-content'),
    categoriesContent: document.getElementById('categories-content'),
    usersContent: document.getElementById('users-content'),
    dashboardContent: document.getElementById('dashboard-content'),
    accountNav: document.getElementById('account-nav'),
    ordersSummary: document.getElementById('orders-summary'),
    sellerOpsSummary: document.getElementById('seller-ops-summary'),
    shipperSummary: document.getElementById('shipper-summary'),
  };

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

  const renderProfile = () => {
    if (!elements.profileCard) return;
    const roleTone = roleToneMap[currentUser.role] || roleToneMap.User;
    elements.profileCard.innerHTML = `
      <div class="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p class="text-sm font-bold uppercase tracking-widest text-white/60">Tài khoản đang đăng nhập</p>
          <h2 class="mt-2 text-3xl font-bold">${app.escapeHtml(currentUser.username)}</h2>
          <p class="mt-2 text-white/70">${app.escapeHtml(currentUser.email)}</p>
        </div>
        <div class="space-y-3">
          <span class="inline-flex rounded-full px-4 py-2 text-sm font-bold ${roleTone}">${app.escapeHtml(currentUser.role)}</span>
          <div>
            <button id="logout-button" class="rounded-xl border border-white/20 px-5 py-3 font-bold hover:bg-white/10 transition-colors">Đăng xuất</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('logout-button')?.addEventListener('click', () => app.logout());
  };

  const bindNavigation = () => {
    if (!elements.accountNav) return;
    elements.accountNav.querySelectorAll('[data-section]').forEach((button) => {
      const sectionId = button.dataset.section;
      const section = sectionId ? document.getElementById(sectionId) : null;
      if (!section || section.classList.contains('hidden')) {
        button.classList.add('hidden');
        return;
      }
      button.addEventListener('click', () => {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    const requestedTab = app.getQueryParam('tab');
    const targetSection = requestedTab ? document.getElementById(`${requestedTab}-section`) || document.getElementById(requestedTab) : null;
    if (targetSection) {
      window.setTimeout(() => {
        targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  };

  const showRelevantSections = () => {
    if (currentUser.role === 'User') {
      elements.userRoleSection?.classList.remove('hidden');
    }

    if (currentUser.role === 'Seller' || currentUser.role === 'Admin') {
      elements.sellerRoleSection?.classList.remove('hidden');
    }

    if (currentUser.role === 'Shipper' || currentUser.role === 'Admin') {
      elements.shipperRoleSection?.classList.remove('hidden');
    }

    if (currentUser.role === 'Admin') {
      elements.adminRoleSection?.classList.remove('hidden');
    }
  };

  const getManagedShops = () => {
    if (currentUser.role === 'Admin') return state.shops;
    return state.shops.filter((shop) => Number(shop.sellerId) === Number(currentUser.id));
  };

  const getManagedProducts = () => {
    if (currentUser.role === 'Admin') return state.products;
    const shopIds = new Set(getManagedShops().map((shop) => Number(shop.id)));
    return state.products.filter((product) => shopIds.has(Number(product.shopId)));
  };

  const loadData = async () => {
    const requests = [
      app.request('/api/orders/my'),
      app.request('/api/shops', { auth: false }),
      app.request('/api/products', { auth: false }),
      (currentUser.role === 'Seller' || currentUser.role === 'Admin')
        ? app.request('/api/categories', { auth: false })
        : Promise.resolve([]),
      currentUser.role === 'Admin' ? app.request('/api/admin/users') : Promise.resolve([]),
      currentUser.role === 'Admin' ? app.request('/api/admin/dashboard') : Promise.resolve(null),
      (currentUser.role === 'Shipper' || currentUser.role === 'Admin')
        ? app.request('/api/orders/available-for-shipping')
        : Promise.resolve([]),
    ];

    const [orders, shops, products, categories, adminUsers, dashboard, availableOrders] = await Promise.all(requests);
    state.orders = Array.isArray(orders) ? orders : [];
    state.shops = Array.isArray(shops) ? shops : [];
    state.products = Array.isArray(products) ? products : [];
    state.categories = Array.isArray(categories) ? categories : [];
    state.adminUsers = Array.isArray(adminUsers) ? adminUsers : [];
    state.dashboard = dashboard;
    state.availableOrders = Array.isArray(availableOrders) ? availableOrders : [];
  };

  const createOrderDetailsMarkup = (order) => {
    const details = Array.isArray(order.orderDetails) ? order.orderDetails : [];
    if (!details.length) {
      return '<p class="text-sm text-slate-500">Đơn hàng chưa có chi tiết sản phẩm.</p>';
    }

    return details
      .map((detail) => `
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
      `)
      .join('');
  };

  const getShipperOptions = (selectedId) => {
    const shippers = state.adminUsers.filter((user) => user.role === 'Shipper');
    return [`<option value="">Chọn shipper</option>`]
      .concat(shippers.map((shipper) => `
        <option value="${shipper.id}" ${Number(selectedId) === Number(shipper.id) ? 'selected' : ''}>${app.escapeHtml(shipper.username)} - ${app.escapeHtml(shipper.email)}</option>
      `))
      .join('');
  };

  const getOrderActionsMarkup = (order) => {
    const status = order.status;
    const actions = [];

    if (currentUser.role === 'User') {
      if (status === 'PendingPayment' || status === 'PaymentFailed') {
        actions.push(`<button data-action="pay-order" data-order-id="${order.id}" class="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-forest transition-colors">Thanh toán lại</button>`);
      }
      if (['PendingPayment', 'AwaitingConfirmation', 'Processing', 'ReadyToShip', 'FailedDelivery'].includes(status)) {
        actions.push(`<button data-action="update-status" data-order-id="${order.id}" data-status="Cancelled" class="rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors">Hủy đơn</button>`);
      }
      if (status === 'Delivered') {
        actions.push(`<button data-action="update-status" data-order-id="${order.id}" data-status="Completed" class="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 transition-colors">Xác nhận hoàn tất</button>`);
        actions.push(`<button data-action="update-status" data-order-id="${order.id}" data-status="ReturnRequested" class="rounded-xl border border-orange-200 px-4 py-3 text-sm font-bold text-orange-600 hover:bg-orange-50 transition-colors">Yêu cầu trả hàng</button>`);
      }
      if (status === 'Shipping') {
        actions.push(`<button data-action="update-status" data-order-id="${order.id}" data-status="ReturnRequested" class="rounded-xl border border-orange-200 px-4 py-3 text-sm font-bold text-orange-600 hover:bg-orange-50 transition-colors">Yêu cầu trả hàng</button>`);
      }
    }

    if (currentUser.role === 'Seller') {
      if (status === 'AwaitingConfirmation') {
        actions.push(`<button data-action="update-status" data-order-id="${order.id}" data-status="Processing" class="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-forest transition-colors">Xác nhận đơn</button>`);
        actions.push(`<button data-action="update-status" data-order-id="${order.id}" data-status="Cancelled" class="rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors">Từ chối đơn</button>`);
      }
      if (status === 'Processing') {
        actions.push(`<button data-action="update-status" data-order-id="${order.id}" data-status="ReadyToShip" class="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-forest transition-colors">Chuẩn bị giao</button>`);
        actions.push(`<button data-action="update-status" data-order-id="${order.id}" data-status="Cancelled" class="rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors">Hủy đơn</button>`);
      }
      if (status === 'FailedDelivery') {
        actions.push(`<button data-action="update-status" data-order-id="${order.id}" data-status="ReadyToShip" class="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-forest transition-colors">Giao lại</button>`);
        actions.push(`<button data-action="update-status" data-order-id="${order.id}" data-status="Cancelled" class="rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors">Hủy đơn</button>`);
      }
    }

    if (currentUser.role === 'Shipper' && status === 'Shipping') {
      actions.push(`<button data-action="update-status" data-order-id="${order.id}" data-status="Delivered" class="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 transition-colors">Đã giao thành công</button>`);
      actions.push(`<button data-action="update-status" data-order-id="${order.id}" data-status="FailedDelivery" class="rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors">Giao thất bại</button>`);
    }

    if (currentUser.role === 'Admin') {
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
              ${getShipperOptions(order.assignedShipperId)}
            </select>
            <button data-action="assign-shipper" data-order-id="${order.id}" class="rounded-xl border border-primary/15 px-4 py-3 text-sm font-bold text-primary hover:bg-primary/5 transition-colors">Gán shipper</button>
          </div>
        `);
      }
    }

    return actions.join('');
  };

  const countOrdersByStatus = (orders, statuses) => {
    const statusList = Array.isArray(statuses) ? statuses : [statuses];
    return (orders || []).filter((order) => statusList.includes(order.status)).length;
  };

  const createKpiCardMarkup = (label, value, helper, valueClassName) => `
    <article class="gm-kpi-card">
      <p class="gm-kpi-card-label">${app.escapeHtml(label)}</p>
      <h3 class="gm-kpi-card-value ${valueClassName || ''}">${app.escapeHtml(String(value))}</h3>
      ${helper ? `<p class="mt-2 text-sm text-slate-500">${app.escapeHtml(helper)}</p>` : ''}
    </article>
  `;

  const createOrderProgressMarkup = (order) => {
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
  };

  const createTimelineMarkup = (order) => {
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
  };

  const createShippingMarkup = (order) => {
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
  };

  const createSellerSlicesMarkup = (order) => {
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
  };

  const renderOrdersSummary = () => {
    if (!elements.ordersSummary) return;

    const orders = Array.isArray(state.orders) ? state.orders : [];
    const cards = [
      {
        label: 'Tổng đơn',
        value: orders.length,
        helper: currentUser.role === 'Seller' ? 'Đơn có liên quan tới shop của bạn.' : 'Tổng số đơn theo vai trò hiện tại.',
      },
      {
        label: 'Chờ xử lý',
        value: countOrdersByStatus(orders, ['PendingPayment', 'AwaitingConfirmation', 'Processing']),
        helper: 'Đơn đang ở bước thanh toán hoặc xác nhận/soạn hàng.',
      },
      {
        label: 'Đang vận chuyển',
        value: countOrdersByStatus(orders, ['ReadyToShip', 'Shipping', 'FailedDelivery']),
        helper: 'Bao gồm đơn chờ shipper, đang giao hoặc cần giao lại.',
      },
      {
        label: 'Hoàn tất',
        value: countOrdersByStatus(orders, ['Delivered', 'Completed']),
        helper: 'Đơn đã giao hoặc đã khép lại thành công.',
        valueClassName: 'text-emerald-700',
      },
    ];

    elements.ordersSummary.innerHTML = cards.map((card) => createKpiCardMarkup(card.label, card.value, card.helper, card.valueClassName)).join('');
  };

  const renderSellerOpsSummary = () => {
    if (!elements.sellerOpsSummary) return;

    const managedOrders = Array.isArray(state.orders) ? state.orders : [];
    const managedProducts = getManagedProducts();
    const cards = [
      {
        label: 'SKU đang quản lý',
        value: managedProducts.length,
        helper: 'Tổng sản phẩm thuộc các shop bạn đang quản lý.',
      },
      {
        label: 'Chờ xác nhận',
        value: countOrdersByStatus(managedOrders, 'AwaitingConfirmation'),
        helper: 'Đơn vừa thanh toán xong và cần shop xác nhận.',
      },
      {
        label: 'Chờ bàn giao',
        value: countOrdersByStatus(managedOrders, ['Processing', 'ReadyToShip']),
        helper: 'Đơn cần soạn hàng hoặc gán shipper ngay.',
      },
      {
        label: 'Giao lỗi / hậu mãi',
        value: countOrdersByStatus(managedOrders, ['FailedDelivery', 'ReturnRequested', 'Returned']),
        helper: 'Các case cần xử lý lại, đổi trả hoặc theo dõi sau bán.',
        valueClassName: 'text-orange-700',
      },
    ];

    elements.sellerOpsSummary.innerHTML = cards.map((card) => createKpiCardMarkup(card.label, card.value, card.helper, card.valueClassName)).join('');
  };

  const renderShipperSummary = () => {
    if (!elements.shipperSummary) return;

    const assignedOrders = (Array.isArray(state.orders) ? state.orders : []).filter((order) => {
      if (currentUser.role === 'Admin') return true;
      return Number(order.assignedShipperId || 0) === Number(currentUser.id || 0);
    });

    const cards = [
      {
        label: 'Chờ nhận giao',
        value: Array.isArray(state.availableOrders) ? state.availableOrders.length : 0,
        helper: 'Đơn đã ready-to-ship và đang chờ shipper nhận hoặc được gán.',
      },
      {
        label: 'Đang giao',
        value: countOrdersByStatus(assignedOrders, 'Shipping'),
        helper: 'Đơn đang ở trên tuyến giao hàng.',
      },
      {
        label: 'Giao thất bại',
        value: countOrdersByStatus(assignedOrders, 'FailedDelivery'),
        helper: 'Đơn cần hẹn lại hoặc xác minh địa chỉ.',
        valueClassName: 'text-orange-700',
      },
      {
        label: 'Đã giao',
        value: countOrdersByStatus(assignedOrders, ['Delivered', 'Completed']),
        helper: 'Đơn đã giao thành công hoặc khách đã xác nhận.',
        valueClassName: 'text-emerald-700',
      },
    ];

    elements.shipperSummary.innerHTML = cards.map((card) => createKpiCardMarkup(card.label, card.value, card.helper, card.valueClassName)).join('');
  };

  const renderOrders = () => {
    if (!elements.ordersContent) return;

    if (!state.orders.length) {
      elements.ordersContent.innerHTML = `
        <div class="rounded-[1.75rem] border border-dashed border-primary/20 bg-background-light px-6 py-10 text-center text-slate-500">
          Chưa có đơn hàng nào cho vai trò hiện tại.
        </div>
      `;
      return;
    }

    elements.ordersContent.innerHTML = state.orders
      .map((order) => `
        <article class="rounded-[1.75rem] border border-primary/10 bg-background-light p-6 shadow-sm">
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

              <div class="rounded-2xl bg-white p-4 text-sm text-slate-600">
                <p><span class="font-bold text-forest">Địa chỉ giao hàng:</span> ${app.escapeHtml(order.shippingAddress || '—')}</p>
                ${order.note ? `<p class="mt-2"><span class="font-bold text-forest">Ghi chú:</span> ${app.escapeHtml(order.note)}</p>` : ''}
                ${order.assignedShipper ? `<p class="mt-2"><span class="font-bold text-forest">Shipper:</span> ${app.escapeHtml(order.assignedShipper.username)} (${app.escapeHtml(order.assignedShipper.email)})</p>` : ''}
              </div>

              ${createOrderProgressMarkup(order)}
              ${createShippingMarkup(order)}
              ${createSellerSlicesMarkup(order)}

              <div class="space-y-3">${createOrderDetailsMarkup(order)}</div>
              ${createTimelineMarkup(order)}
            </div>
            <div class="xl:w-[340px] shrink-0 space-y-3">
              ${getOrderActionsMarkup(order) || '<p class="rounded-2xl border border-dashed border-primary/20 px-4 py-5 text-center text-sm text-slate-500">Chưa có thao tác phù hợp cho trạng thái này.</p>'}
              <button data-action="ask-ai-order" data-order-id="${order.id}" class="w-full rounded-xl border border-primary/15 px-4 py-3 text-sm font-bold text-forest hover:bg-white transition-colors">Hỏi AI về đơn này</button>
            </div>
          </div>
        </article>
      `)
      .join('');

    bindOrderActions();
  };

  const renderAvailableOrders = () => {
    if (!elements.availableOrdersContent) return;

    if (!state.availableOrders.length) {
      elements.availableOrdersContent.innerHTML = `
        <div class="rounded-[1.75rem] border border-dashed border-primary/20 bg-background-light px-6 py-10 text-center text-slate-500">
          Hiện chưa có đơn nào sẵn sàng giao.
        </div>
      `;
      return;
    }

    elements.availableOrdersContent.innerHTML = state.availableOrders
      .map((order) => `
        <article class="rounded-[1.75rem] border border-primary/10 bg-background-light p-6">
          <div class="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div class="flex-1 space-y-4">
              <div class="flex flex-wrap items-center gap-3">
                <h3 class="text-xl font-bold text-forest">${app.escapeHtml(order.orderCode || `Đơn #${order.id}`)}</h3>
                <span class="rounded-full px-4 py-2 text-sm font-bold ${orderToneMap[order.status] || 'bg-slate-100 text-slate-700'}">${app.escapeHtml(order.statusLabel || orderLabelMap[order.status] || order.status)}</span>
              </div>
              <p class="text-sm text-slate-500">Người nhận: ${app.escapeHtml(order.contactName || '—')} • ${app.escapeHtml(order.contactPhone || '—')}</p>
              <p class="text-sm text-slate-500">Địa chỉ: ${app.escapeHtml(order.shippingAddress || '—')}</p>
              <p class="text-sm font-bold text-primary">Tổng tiền: ${app.formatCurrency(order.totalAmount)}</p>
              ${createOrderProgressMarkup(order)}
              ${createShippingMarkup(order)}
            </div>
            <div class="flex flex-wrap gap-3 xl:w-[320px] xl:justify-end">
              ${currentUser.role === 'Shipper'
                ? `<button data-action="accept-delivery" data-order-id="${order.id}" class="rounded-xl bg-primary px-5 py-3 font-bold text-white hover:bg-forest transition-colors">Nhận giao đơn</button>`
                : `
                  <select data-action="shipper-select" data-order-id="${order.id}" class="rounded-xl border border-primary/15 bg-white px-4 py-3 text-sm focus:border-primary focus:ring-primary">
                    ${getShipperOptions(order.assignedShipperId)}
                  </select>
                  <button data-action="assign-shipper" data-order-id="${order.id}" class="rounded-xl border border-primary/15 px-5 py-3 font-bold text-primary hover:bg-primary/5 transition-colors">Gán shipper</button>
                `}
            </div>
          </div>
        </article>
      `)
      .join('');

    bindOrderActions();
  };

  const resetShopForm = () => {
    document.getElementById('shop-id').value = '';
    document.getElementById('shop-name').value = '';
    document.getElementById('shop-description').value = '';
  };

  const renderShops = () => {
    if (!elements.shopsContent) return;
    const shops = getManagedShops();

    if (!shops.length) {
      elements.shopsContent.innerHTML = `
        <div class="rounded-[1.75rem] border border-dashed border-primary/20 bg-background-light px-6 py-10 text-center text-slate-500">
          Bạn chưa có shop nào. Hãy tạo shop đầu tiên để đăng sản phẩm.
        </div>
      `;
    } else {
      elements.shopsContent.innerHTML = shops
        .map((shop) => `
          <article class="rounded-[1.75rem] border border-primary/10 bg-background-light p-5">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h3 class="text-xl font-bold text-forest">${app.escapeHtml(shop.name)}</h3>
                <p class="mt-2 text-sm text-slate-500 leading-7">${app.escapeHtml(shop.description || 'Chưa có mô tả')}</p>
                <p class="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">Seller ID: ${shop.sellerId}</p>
              </div>
              <div class="flex flex-col gap-2">
                <button data-action="edit-shop" data-shop-id="${shop.id}" class="rounded-xl border border-primary/15 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/5 transition-colors">Sửa</button>
                <button data-action="delete-shop" data-shop-id="${shop.id}" class="rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors">Xóa</button>
              </div>
            </div>
          </article>
        `)
        .join('');
    }

    populateShopSelect();
    bindShopActions();
  };

  const populateShopSelect = () => {
    const shopSelect = document.getElementById('product-shop');
    if (!shopSelect) return;
    const shops = getManagedShops();
    shopSelect.innerHTML = shops.length
      ? shops.map((shop) => `<option value="${shop.id}">${app.escapeHtml(shop.name)}</option>`).join('')
      : '<option value="">Chưa có shop</option>';
  };

  const populateCategorySelect = () => {
    const categorySelect = document.getElementById('product-category');
    if (!categorySelect) return;
    categorySelect.innerHTML = state.categories.length
      ? state.categories.map((category) => `<option value="${category.id}">${app.escapeHtml(category.name)}</option>`).join('')
      : '<option value="">Chưa có danh mục</option>';
  };

  const resetProductForm = () => {
    document.getElementById('product-id').value = '';
    document.getElementById('product-name').value = '';
    document.getElementById('product-description').value = '';
    document.getElementById('product-price').value = '';
    document.getElementById('product-stock').value = '';
    document.getElementById('product-image-url').value = '';
    document.getElementById('product-image-file').value = '';
    populateCategorySelect();
    populateShopSelect();
  };

  const renderProducts = () => {
    if (!elements.productsContent) return;
    const products = getManagedProducts();

    if (!products.length) {
      elements.productsContent.innerHTML = `
        <div class="rounded-[1.75rem] border border-dashed border-primary/20 bg-background-light px-6 py-10 text-center text-slate-500 xl:col-span-2">
          Chưa có sản phẩm nào trong phạm vi quản lý hiện tại.
        </div>
      `;
      return;
    }

    elements.productsContent.innerHTML = products
      .map((product) => `
        <article class="rounded-[1.75rem] border border-primary/10 bg-background-light p-5 shadow-sm">
          <div class="flex gap-4">
            <img src="${app.resolveImageUrl(product.imageUrl)}" alt="${app.escapeHtml(product.name)}" class="h-24 w-24 rounded-2xl object-cover bg-earth-beige/40" />
            <div class="flex-1">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h3 class="text-xl font-bold text-forest">${app.escapeHtml(product.name)}</h3>
                  <p class="mt-2 text-sm text-slate-500 line-clamp-3">${app.escapeHtml(product.description || 'Chưa có mô tả')}</p>
                </div>
                <div class="flex flex-col gap-2">
                  <button data-action="edit-product" data-product-id="${product.id}" class="rounded-xl border border-primary/15 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/5 transition-colors">Sửa</button>
                  <button data-action="delete-product" data-product-id="${product.id}" class="rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors">Xóa</button>
                </div>
              </div>
              <div class="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                <span class="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">${app.escapeHtml(product.categoryName || 'Không rõ danh mục')}</span>
                <span>${app.escapeHtml(product.shopName || 'Không rõ shop')}</span>
                <span class="font-bold text-primary">${app.formatCurrency(product.price)}</span>
                <span>Tồn kho: ${product.stock}</span>
              </div>
            </div>
          </div>
        </article>
      `)
      .join('');

    bindProductActions();
  };

  const resetCategoryForm = () => {
    document.getElementById('category-id').value = '';
    document.getElementById('category-name').value = '';
    document.getElementById('category-description').value = '';
  };

  const renderCategories = () => {
    if (!elements.categoriesContent) return;
    if (!state.categories.length) {
      elements.categoriesContent.innerHTML = `
        <div class="rounded-[1.75rem] border border-dashed border-primary/20 bg-background-light px-6 py-10 text-center text-slate-500">
          Chưa có danh mục nào.
        </div>
      `;
      return;
    }

    elements.categoriesContent.innerHTML = state.categories
      .map((category) => `
        <article class="rounded-[1.75rem] border border-primary/10 bg-background-light p-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="text-xl font-bold text-forest">${app.escapeHtml(category.name)}</h3>
              <p class="mt-2 text-sm text-slate-500 leading-7">${app.escapeHtml(category.description || 'Chưa có mô tả')}</p>
            </div>
            <div class="flex flex-col gap-2">
              <button data-action="edit-category" data-category-id="${category.id}" class="rounded-xl border border-primary/15 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/5 transition-colors">Sửa</button>
              <button data-action="delete-category" data-category-id="${category.id}" class="rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors">Xóa</button>
            </div>
          </div>
        </article>
      `)
      .join('');

    bindCategoryActions();
  };

  const renderDashboard = () => {
    if (!elements.dashboardContent || !state.dashboard) return;
    const cards = [
      { label: 'Người dùng', value: state.dashboard.totalUsers },
      { label: 'Người bán', value: state.dashboard.totalSellers },
      { label: 'Sản phẩm', value: state.dashboard.totalProducts },
      { label: 'Đơn hàng', value: state.dashboard.totalOrders },
      { label: 'Doanh thu', value: app.formatCurrency(state.dashboard.totalRevenue) },
    ];

    elements.dashboardContent.innerHTML = cards
      .map((card) => `
        <div class="rounded-[1.75rem] border border-primary/10 bg-background-light p-6">
          <p class="text-sm font-bold uppercase tracking-widest text-slate-400">${app.escapeHtml(card.label)}</p>
          <h3 class="mt-4 text-3xl font-black text-forest">${app.escapeHtml(String(card.value))}</h3>
        </div>
      `)
      .join('');
  };

  const renderUsers = () => {
    if (!elements.usersContent) return;
    if (!state.adminUsers.length) {
      elements.usersContent.innerHTML = `
        <div class="rounded-[1.75rem] border border-dashed border-primary/20 bg-background-light px-6 py-10 text-center text-slate-500">
          Chưa có dữ liệu người dùng.
        </div>
      `;
      return;
    }

    elements.usersContent.innerHTML = `
      <table class="min-w-full overflow-hidden rounded-2xl border border-primary/10 bg-background-light text-sm">
        <thead>
          <tr class="bg-white text-left text-slate-500">
            <th class="px-4 py-4 font-bold">Người dùng</th>
            <th class="px-4 py-4 font-bold">Vai trò</th>
            <th class="px-4 py-4 font-bold">Trạng thái</th>
            <th class="px-4 py-4 font-bold">Ngày tạo</th>
            <th class="px-4 py-4 font-bold">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${state.adminUsers.map((user) => `
            <tr class="border-t border-primary/10 align-top">
              <td class="px-4 py-4">
                <p class="font-bold text-forest">${app.escapeHtml(user.username)}</p>
                <p class="mt-1 text-slate-500">${app.escapeHtml(user.email)}</p>
              </td>
              <td class="px-4 py-4">
                <select data-action="user-role-select" data-user-id="${user.id}" class="rounded-xl border border-primary/15 bg-white px-4 py-3 text-sm focus:border-primary focus:ring-primary">
                  ${['User', 'Seller', 'Shipper', 'Admin'].map((role) => `<option value="${role}" ${role === user.role ? 'selected' : ''}>${role}</option>`).join('')}
                </select>
              </td>
              <td class="px-4 py-4 text-slate-500">
                <p>${user.isLocked ? 'Đang bị khóa' : 'Hoạt động'}</p>
                <p class="mt-1">${user.isApproved ? 'Đã duyệt' : 'Chưa duyệt'}</p>
              </td>
              <td class="px-4 py-4 text-slate-500">${app.formatDate(user.createdAt)}</td>
              <td class="px-4 py-4">
                <div class="flex flex-wrap gap-2">
                  ${!user.isApproved ? `<button data-action="approve-user" data-user-id="${user.id}" class="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-700 transition-colors">Duyệt</button>` : ''}
                  <button data-action="${user.isLocked ? 'unlock-user' : 'lock-user'}" data-user-id="${user.id}" class="rounded-xl border ${user.isLocked ? 'border-emerald-200 text-emerald-600 hover:bg-emerald-50' : 'border-rose-200 text-rose-600 hover:bg-rose-50'} px-4 py-2 font-bold transition-colors">
                    ${user.isLocked ? 'Mở khóa' : 'Khóa'}
                  </button>
                  <button data-action="save-user-role" data-user-id="${user.id}" class="rounded-xl border border-primary/15 px-4 py-2 font-bold text-primary hover:bg-primary/5 transition-colors">Lưu role</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    bindUserActions();
  };

  const refreshAll = async () => {
    await loadData();
    renderProfile();
    renderOrdersSummary();
    renderSellerOpsSummary();
    renderShipperSummary();
    renderOrders();
    renderAvailableOrders();
    renderShops();
    renderProducts();
    renderCategories();
    renderDashboard();
    renderUsers();
    populateCategorySelect();
    populateShopSelect();
    bindNavigation();
  };

  const handleOrderStatusUpdate = async (orderId, status) => {
    await app.request(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      body: { status },
    });
    app.notify('Cập nhật trạng thái đơn hàng thành công.', 'success');
    await refreshAll();
  };

  const handlePayOrder = async (orderId) => {
    const response = await app.request(`/api/orders/${orderId}/pay-url`, {
      method: 'POST',
    });
    if (response.paymentUrl) {
      window.open(response.paymentUrl, '_blank', 'noopener');
      app.notify('Đã mở cổng thanh toán cho đơn hàng.', 'success');
    }
  };

  const bindOrderActions = () => {
    document.querySelectorAll('[data-action="update-status"]').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';
      button.addEventListener('click', async () => {
        try {
          await handleOrderStatusUpdate(Number(button.dataset.orderId), button.dataset.status);
        } catch (error) {
          app.notify(error.message, 'error');
        }
      });
    });

    document.querySelectorAll('[data-action="pay-order"]').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';
      button.addEventListener('click', async () => {
        try {
          await handlePayOrder(Number(button.dataset.orderId));
        } catch (error) {
          app.notify(error.message, 'error');
        }
      });
    });

    document.querySelectorAll('[data-action="ask-ai-order"]').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';
      button.addEventListener('click', () => {
        const order = state.orders.find((item) => Number(item.id) === Number(button.dataset.orderId));
        if (!order) {
          app.notify('Không tìm thấy ngữ cảnh đơn hàng để mở AI.', 'warning');
          return;
        }

        const primarySlice = Array.isArray(order.sellerSlices) ? order.sellerSlices[0] : null;
        const matchedShop = primarySlice?.shopId
          ? state.shops.find((shop) => Number(shop.id) === Number(primarySlice.shopId))
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

    document.querySelectorAll('[data-action="accept-delivery"]').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';
      button.addEventListener('click', async () => {
        try {
          await app.request(`/api/orders/${button.dataset.orderId}/accept-delivery`, { method: 'PUT' });
          app.notify('Đã nhận giao đơn hàng.', 'success');
          await refreshAll();
        } catch (error) {
          app.notify(error.message, 'error');
        }
      });
    });

    document.querySelectorAll('[data-action="assign-shipper"]').forEach((button) => {
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
          await refreshAll();
        } catch (error) {
          app.notify(error.message, 'error');
        }
      });
    });

    document.querySelectorAll('[data-action="admin-status-save"]').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';
      button.addEventListener('click', async () => {
        const orderId = Number(button.dataset.orderId);
        const select = document.querySelector(`[data-action="admin-status-select"][data-order-id="${orderId}"]`);
        const status = select?.value;
        if (!status) return;
        try {
          await handleOrderStatusUpdate(orderId, status);
        } catch (error) {
          app.notify(error.message, 'error');
        }
      });
    });
  };

  const bindShopActions = () => {
    document.querySelectorAll('[data-action="edit-shop"]').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';
      button.addEventListener('click', () => {
        const shop = getManagedShops().find((item) => Number(item.id) === Number(button.dataset.shopId));
        if (!shop) return;
        document.getElementById('shop-id').value = shop.id;
        document.getElementById('shop-name').value = shop.name || '';
        document.getElementById('shop-description').value = shop.description || '';
        document.getElementById('shop-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });

    document.querySelectorAll('[data-action="delete-shop"]').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';
      button.addEventListener('click', async () => {
        try {
          await app.request(`/api/shops/${button.dataset.shopId}`, { method: 'DELETE' });
          app.notify('Đã xóa shop.', 'success');
          resetShopForm();
          await refreshAll();
        } catch (error) {
          app.notify(error.message, 'error');
        }
      });
    });
  };

  const bindProductActions = () => {
    document.querySelectorAll('[data-action="edit-product"]').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';
      button.addEventListener('click', () => {
        const product = getManagedProducts().find((item) => Number(item.id) === Number(button.dataset.productId));
        if (!product) return;
        document.getElementById('product-id').value = product.id;
        document.getElementById('product-name').value = product.name || '';
        document.getElementById('product-description').value = product.description || '';
        document.getElementById('product-price').value = product.price || 0;
        document.getElementById('product-stock').value = product.stock || 0;
        document.getElementById('product-image-url').value = product.imageUrl || '';
        populateCategorySelect();
        populateShopSelect();
        document.getElementById('product-category').value = product.categoryId;
        document.getElementById('product-shop').value = product.shopId;
        document.getElementById('product-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });

    document.querySelectorAll('[data-action="delete-product"]').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';
      button.addEventListener('click', async () => {
        try {
          await app.request(`/api/products/${button.dataset.productId}`, { method: 'DELETE' });
          app.notify('Đã xóa sản phẩm.', 'success');
          resetProductForm();
          await refreshAll();
        } catch (error) {
          app.notify(error.message, 'error');
        }
      });
    });
  };

  const bindCategoryActions = () => {
    document.querySelectorAll('[data-action="edit-category"]').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';
      button.addEventListener('click', () => {
        const category = state.categories.find((item) => Number(item.id) === Number(button.dataset.categoryId));
        if (!category) return;
        document.getElementById('category-id').value = category.id;
        document.getElementById('category-name').value = category.name || '';
        document.getElementById('category-description').value = category.description || '';
        document.getElementById('category-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });

    document.querySelectorAll('[data-action="delete-category"]').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';
      button.addEventListener('click', async () => {
        try {
          await app.request(`/api/categories/${button.dataset.categoryId}`, { method: 'DELETE' });
          app.notify('Đã xóa danh mục.', 'success');
          resetCategoryForm();
          await refreshAll();
        } catch (error) {
          app.notify(error.message, 'error');
        }
      });
    });
  };

  const bindUserActions = () => {
    const actionMap = {
      'approve-user': 'approve',
      'lock-user': 'lock',
      'unlock-user': 'unlock',
    };

    Object.keys(actionMap).forEach((action) => {
      document.querySelectorAll(`[data-action="${action}"]`).forEach((button) => {
        if (button.dataset.bound === 'true') return;
        button.dataset.bound = 'true';
        button.addEventListener('click', async () => {
          try {
            await app.request(`/api/admin/users/${button.dataset.userId}/${actionMap[action]}`, { method: 'PUT' });
            app.notify('Đã cập nhật trạng thái người dùng.', 'success');
            await refreshAll();
          } catch (error) {
            app.notify(error.message, 'error');
          }
        });
      });
    });

    document.querySelectorAll('[data-action="save-user-role"]').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';
      button.addEventListener('click', async () => {
        const userId = Number(button.dataset.userId);
        const select = document.querySelector(`[data-action="user-role-select"][data-user-id="${userId}"]`);
        const role = select?.value;
        if (!role) return;
        try {
          await app.request(`/api/admin/users/${userId}/role`, {
            method: 'PUT',
            body: { role },
          });
          app.notify('Đã cập nhật role người dùng.', 'success');
          await refreshAll();
        } catch (error) {
          app.notify(error.message, 'error');
        }
      });
    });
  };

  document.getElementById('become-seller-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const shopName = document.getElementById('seller-shop-name').value.trim();
    const shopDescription = document.getElementById('seller-shop-description').value.trim();
    if (!shopName) {
      app.notify('Vui lòng nhập tên shop.', 'warning');
      return;
    }
    try {
      await app.request('/api/auth/become-seller', {
        method: 'POST',
        body: { shopName, shopDescription },
      });
      app.notify('Đăng ký trở thành người bán thành công. Vui lòng đăng nhập lại để cập nhật vai trò.', 'success');
      app.logout(false);
      window.location.reload();
    } catch (error) {
      app.notify(error.message, 'error');
    }
  });

  document.getElementById('shop-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const shopId = document.getElementById('shop-id').value;
    const name = document.getElementById('shop-name').value.trim();
    const description = document.getElementById('shop-description').value.trim();
    if (!name) {
      app.notify('Vui lòng nhập tên shop.', 'warning');
      return;
    }
    try {
      await app.request(shopId ? `/api/shops/${shopId}` : '/api/shops', {
        method: shopId ? 'PUT' : 'POST',
        body: { name, description },
      });
      app.notify(shopId ? 'Đã cập nhật shop.' : 'Đã tạo shop mới.', 'success');
      resetShopForm();
      await refreshAll();
    } catch (error) {
      app.notify(error.message, 'error');
    }
  });

  document.getElementById('shop-form-reset')?.addEventListener('click', resetShopForm);

  document.getElementById('upload-product-image')?.addEventListener('click', async () => {
    const fileInput = document.getElementById('product-image-file');
    const file = fileInput?.files?.[0];
    if (!file) {
      app.notify('Vui lòng chọn file ảnh để upload.', 'warning');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await app.request('/api/products/upload', {
        method: 'POST',
        body: formData,
      });
      document.getElementById('product-image-url').value = response.url || '';
      app.notify('Upload ảnh thành công.', 'success');
    } catch (error) {
      app.notify(error.message, 'error');
    }
  });

  document.getElementById('product-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const productId = document.getElementById('product-id').value;
    const name = document.getElementById('product-name').value.trim();
    const description = document.getElementById('product-description').value.trim();
    const price = Number(document.getElementById('product-price').value || 0);
    const stock = Number(document.getElementById('product-stock').value || 0);
    const categoryId = Number(document.getElementById('product-category').value || 0);
    const shopId = Number(document.getElementById('product-shop').value || 0);
    const imageUrl = document.getElementById('product-image-url').value.trim();

    if (!name || !categoryId || !shopId) {
      app.notify('Vui lòng nhập tên sản phẩm, chọn danh mục và shop.', 'warning');
      return;
    }

    try {
      await app.request(productId ? `/api/products/${productId}` : '/api/products', {
        method: productId ? 'PUT' : 'POST',
        body: { name, description, price, stock, imageUrl, categoryId, shopId },
      });
      app.notify(productId ? 'Đã cập nhật sản phẩm.' : 'Đã tạo sản phẩm mới.', 'success');
      resetProductForm();
      await refreshAll();
    } catch (error) {
      app.notify(error.message, 'error');
    }
  });

  document.getElementById('product-form-reset')?.addEventListener('click', resetProductForm);

  document.getElementById('category-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const categoryId = document.getElementById('category-id').value;
    const name = document.getElementById('category-name').value.trim();
    const description = document.getElementById('category-description').value.trim();
    if (!name) {
      app.notify('Vui lòng nhập tên danh mục.', 'warning');
      return;
    }
    try {
      await app.request(categoryId ? `/api/categories/${categoryId}` : '/api/categories', {
        method: categoryId ? 'PUT' : 'POST',
        body: { name, description },
      });
      app.notify(categoryId ? 'Đã cập nhật danh mục.' : 'Đã tạo danh mục mới.', 'success');
      resetCategoryForm();
      await refreshAll();
    } catch (error) {
      app.notify(error.message, 'error');
    }
  });

  document.getElementById('category-form-reset')?.addEventListener('click', resetCategoryForm);

  showRelevantSections();
  renderProfile();
  await refreshAll();
});

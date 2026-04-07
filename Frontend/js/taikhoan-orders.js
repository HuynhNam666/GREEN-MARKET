document.addEventListener('DOMContentLoaded', async () => {
  const account = window.GreenMarketAccount;
  if (!account) return;

  const ctx = await account.boot('orders');
  if (!ctx) return;

  const summaryEl = document.getElementById('orders-summary');
  const filtersEl = document.getElementById('orders-filters');
  const listEl = document.getElementById('orders-list');
  const searchInput = document.getElementById('orders-search');

  const filterState = {
    status: 'all',
    keyword: '',
  };

  const loadAndRender = async () => {
    await account.loadData(ctx, {
      orders: true,
      shops: true,
      adminUsers: ctx.currentUser.role === 'Admin',
    });
    renderSummary();
    renderFilters();
    renderOrders();
  };

  const renderSummary = () => {
    if (!summaryEl) return;
    const cards = [
      {
        label: 'Tổng đơn',
        value: ctx.state.orders.length,
        helper: 'Tất cả đơn hàng theo role hiện tại.',
      },
      {
        label: 'Chờ xử lý',
        value: account.countOrdersByStatus(ctx.state.orders, ['PendingPayment', 'AwaitingConfirmation', 'Processing']),
        helper: 'Đơn còn ở pha thanh toán, xác nhận hoặc chuẩn bị.',
      },
      {
        label: 'Đang vận chuyển',
        value: account.countOrdersByStatus(ctx.state.orders, ['ReadyToShip', 'Shipping', 'FailedDelivery']),
        helper: 'Đơn chờ giao, đang giao hoặc cần giao lại.',
      },
      {
        label: 'Đã giao / hoàn tất',
        value: account.countOrdersByStatus(ctx.state.orders, ['Delivered', 'Completed']),
        helper: 'Đơn đã giao xong hoặc người mua đã xác nhận nhận hàng.',
        valueClassName: 'text-emerald-700',
      },
    ];
    summaryEl.innerHTML = cards.map((card) => account.createKpiCardMarkup(card.label, card.value, card.helper, card.valueClassName)).join('');
  };

  const renderFilters = () => {
    if (!filtersEl) return;
    const filters = [
      { key: 'all', label: 'Tất cả' },
      { key: 'pending', label: 'Chờ xử lý' },
      { key: 'shipping', label: 'Đang giao' },
      { key: 'completed', label: 'Đã giao / hoàn tất' },
      { key: 'issue', label: 'Sự cố / hậu mãi' },
    ];

    filtersEl.innerHTML = filters.map((item) => `
      <button type="button" class="gm-account-filter-btn ${filterState.status === item.key ? 'is-active' : ''}" data-status-filter="${item.key}">${item.label}</button>
    `).join('');

    filtersEl.querySelectorAll('[data-status-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        filterState.status = button.dataset.statusFilter || 'all';
        renderFilters();
        renderOrders();
      });
    });
  };

  const matchesStatusFilter = (order) => {
    switch (filterState.status) {
      case 'pending':
        return ['PendingPayment', 'AwaitingConfirmation', 'Processing'].includes(order.status);
      case 'shipping':
        return ['ReadyToShip', 'Shipping'].includes(order.status);
      case 'completed':
        return ['Delivered', 'Completed'].includes(order.status);
      case 'issue':
        return ['FailedDelivery', 'Cancelled', 'ReturnRequested', 'Returned', 'PaymentFailed'].includes(order.status);
      default:
        return true;
    }
  };

  const matchesKeyword = (order) => {
    if (!filterState.keyword) return true;
    const searchIndex = account.app.normalizeText([
      order.orderCode,
      order.contactName,
      order.contactPhone,
      order.shippingAddress,
      order.note,
      ...(Array.isArray(order.orderDetails) ? order.orderDetails.map((detail) => detail.productName) : []),
    ].join(' '));
    return searchIndex.includes(filterState.keyword);
  };

  const renderOrders = () => {
    if (!listEl) return;
    const filteredOrders = [...ctx.state.orders]
      .sort((left, right) => new Date(right.orderDate || 0) - new Date(left.orderDate || 0))
      .filter((order) => matchesStatusFilter(order) && matchesKeyword(order));

    if (!filteredOrders.length) {
      listEl.innerHTML = account.createEmptyStateMarkup(
        'Không có đơn phù hợp',
        'Hãy đổi bộ lọc hoặc từ khóa tìm kiếm để xem các đơn hàng theo trạng thái khác.',
        `<a href="${account.app.buildPageUrl('sanpham.html')}" class="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-forest">Mở trang sản phẩm</a>`
      );
      return;
    }

    listEl.innerHTML = filteredOrders.map((order) => account.renderOrderCard(ctx, order)).join('');
    account.bindOrderActions(ctx, loadAndRender, listEl);
    account.scrollToOrderFromQuery(listEl);
  };

  searchInput?.addEventListener('input', () => {
    filterState.keyword = account.app.normalizeText(searchInput.value || '');
    renderOrders();
  });

  await loadAndRender();
});

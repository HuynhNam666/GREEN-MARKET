document.addEventListener('DOMContentLoaded', async () => {
  const account = window.GreenMarketAccount;
  if (!account) return;

  const ctx = await account.boot('dashboard');
  if (!ctx) return;

  const summaryEl = document.getElementById('dashboard-summary');
  const linksEl = document.getElementById('dashboard-quick-links');
  const focusEl = document.getElementById('dashboard-role-focus');
  const ordersEl = document.getElementById('dashboard-recent-orders');

  await account.loadData(ctx, {
    orders: true,
    shops: true,
    products: true,
    dashboard: ctx.currentUser.role === 'Admin',
    availableOrders: ctx.currentUser.role === 'Shipper' || ctx.currentUser.role === 'Admin',
  });

  const managedShops = account.getManagedShops(ctx);
  const managedProducts = account.getManagedProducts(ctx);
  const recentOrders = [...ctx.state.orders]
    .sort((left, right) => new Date(right.orderDate || 0) - new Date(left.orderDate || 0))
    .slice(0, 2);

  if (summaryEl) {
    const roleSummary = ctx.currentUser.role === 'Admin'
      ? { label: 'Người dùng', value: ctx.state.dashboard?.totalUsers || 0, helper: 'Toàn hệ thống' }
      : ctx.currentUser.role === 'Seller'
        ? { label: 'SKU quản lý', value: managedProducts.length, helper: 'Đang bán' }
        : ctx.currentUser.role === 'Shipper'
          ? { label: 'Job giao', value: ctx.state.availableOrders.length, helper: 'Chờ nhận' }
          : { label: 'Đã giao / hoàn tất', value: account.countOrdersByStatus(ctx.state.orders, ['Delivered', 'Completed']), helper: 'Đơn đã giao xong hoặc đã được người mua xác nhận.' };

    const cards = [
      {
        label: 'Đơn hiện có',
        value: ctx.state.orders.length,
        helper: 'Theo role hiện tại',
      },
      {
        label: 'Cần xử lý',
        value: account.countOrdersByStatus(ctx.state.orders, ['PendingPayment', 'AwaitingConfirmation', 'Processing']),
        helper: 'Thanh toán / xác nhận / chuẩn bị',
      },
      roleSummary,
    ];

    summaryEl.innerHTML = cards.map((card) => account.createKpiCardMarkup(card.label, card.value, card.helper)).join('');
  }

  if (linksEl) {
    const navItems = account.getNavigationModel(ctx).filter((item) => item.key !== 'dashboard');
    linksEl.innerHTML = navItems.map((item) => `
      <a href="${item.href}" class="gm-account-action-card transition hover:-translate-y-0.5">
        <div class="flex items-center gap-3">
          <span class="gm-account-action-icon material-symbols-outlined">${item.icon}</span>
          <div>
            <h3 class="text-lg font-black text-forest">${account.app.escapeHtml(item.label)}</h3>
            <p class="mt-1 text-sm text-slate-500">${account.app.escapeHtml(item.helper)}</p>
          </div>
        </div>
        <span class="gm-account-chip">Mở nhanh</span>
      </a>
    `).join('');
  }

  if (focusEl) {
    const priorities = [];
    if (ctx.currentUser.role === 'User') {
      priorities.push(
        { label: 'Mua sắm tiếp', value: 'Sản phẩm' },
        { label: 'Mở shop', value: 'Seller' },
        { label: 'AI hỗ trợ', value: 'Đã bật' },
      );
    }
    if (ctx.currentUser.role === 'Seller' || ctx.currentUser.role === 'Admin') {
      priorities.push(
        { label: 'Shop', value: managedShops.length },
        { label: 'SKU', value: managedProducts.length },
        { label: 'Chờ xác nhận', value: account.countOrdersByStatus(ctx.state.orders, 'AwaitingConfirmation') },
      );
    }
    if (ctx.currentUser.role === 'Shipper') {
      priorities.push(
        { label: 'Chờ nhận', value: ctx.state.availableOrders.length },
        { label: 'Đang giao', value: account.countOrdersByStatus(ctx.state.orders, 'Shipping') },
        { label: 'Giao lỗi', value: account.countOrdersByStatus(ctx.state.orders, 'FailedDelivery') },
      );
    }

    focusEl.innerHTML = priorities.slice(0, 3).map((item) => account.createKpiCardMarkup(item.label, item.value, '')).join('');
  }

  if (ordersEl) {
    if (!recentOrders.length) {
      ordersEl.innerHTML = account.createEmptyStateMarkup(
        'Chưa có đơn hàng',
        'Đơn mới sẽ xuất hiện ở đây để bạn theo dõi nhanh.',
        `<a href="${account.app.buildPageUrl('sanpham.html')}" class="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-forest">Mở trang sản phẩm</a>`
      );
    } else {
      ordersEl.innerHTML = recentOrders.map((order) => account.renderOrderCard(ctx, order, { compact: true })).join('');
      account.bindOrderActions(ctx, async () => window.location.reload(), ordersEl);
      account.scrollToOrderFromQuery(ordersEl);
    }
  }
});

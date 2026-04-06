document.addEventListener('DOMContentLoaded', async () => {
  const account = window.GreenMarketAccount;
  if (!account) return;

  const ctx = await account.boot('shipping');
  if (!ctx) return;

  const pageContent = document.getElementById('account-page-content');
  if (!account.hasRole(ctx, ['Shipper', 'Admin'])) {
    account.renderAccessState(
      pageContent,
      'Khu vực này dành cho vận chuyển',
      'Trang này được tách riêng cho shipper và admin để nhận giao, theo dõi tuyến giao và xử lý đơn thất bại mà không lẫn với các tác vụ khác.',
      `<a href="${account.app.buildPageUrl('taikhoan.html')}" class="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-forest">Quay về tổng quan tài khoản</a>`
    );
    return;
  }

  const summaryEl = document.getElementById('shipper-summary');
  const availableEl = document.getElementById('shipper-available-orders');
  const assignedEl = document.getElementById('shipper-assigned-orders');

  const loadAndRender = async () => {
    await account.loadData(ctx, {
      orders: true,
      availableOrders: true,
      adminUsers: ctx.currentUser.role === 'Admin',
    });
    renderSummary();
    renderAvailableOrders();
    renderAssignedOrders();
  };

  const getAssignedOrders = () => {
    if (ctx.currentUser.role === 'Admin') {
      return ctx.state.orders.filter((order) => ['Shipping', 'FailedDelivery', 'Delivered', 'Completed'].includes(order.status));
    }
    return ctx.state.orders;
  };

  const renderSummary = () => {
    if (!summaryEl) return;
    const assignedOrders = getAssignedOrders();
    const cards = [
      {
        label: 'Chờ nhận giao',
        value: ctx.state.availableOrders.length,
        helper: 'Đơn ready-to-ship cần shipper nhận hoặc admin gán.',
      },
      {
        label: 'Đang giao',
        value: account.countOrdersByStatus(assignedOrders, 'Shipping'),
        helper: 'Đơn đang nằm trên tuyến giao hàng hiện tại.',
      },
      {
        label: 'Giao thất bại',
        value: account.countOrdersByStatus(assignedOrders, 'FailedDelivery'),
        helper: 'Đơn cần hẹn lại, gọi khách hoặc xử lý địa chỉ.',
        valueClassName: 'text-orange-700',
      },
      {
        label: 'Đã giao',
        value: account.countOrdersByStatus(assignedOrders, ['Delivered', 'Completed']),
        helper: 'Đơn đã giao xong hoặc đã được khách xác nhận.',
        valueClassName: 'text-emerald-700',
      },
    ];
    summaryEl.innerHTML = cards.map((card) => account.createKpiCardMarkup(card.label, card.value, card.helper, card.valueClassName)).join('');
  };

  const renderAvailableOrders = () => {
    if (!availableEl) return;
    if (!ctx.state.availableOrders.length) {
      availableEl.innerHTML = account.createEmptyStateMarkup(
        'Chưa có đơn sẵn sàng giao',
        'Khi seller chuẩn bị xong hàng hoặc admin điều phối, các đơn sẽ hiển thị tại đây để shipper nhận giao.',
        ''
      );
      return;
    }

    availableEl.innerHTML = ctx.state.availableOrders
      .sort((left, right) => new Date(right.orderDate || 0) - new Date(left.orderDate || 0))
      .map((order) => account.renderOrderCard(ctx, order, { compact: true, showAiButton: false }))
      .join('');
    account.bindOrderActions(ctx, loadAndRender, availableEl);
  };

  const renderAssignedOrders = () => {
    if (!assignedEl) return;
    const orders = getAssignedOrders().sort((left, right) => new Date(right.orderDate || 0) - new Date(left.orderDate || 0));
    if (!orders.length) {
      assignedEl.innerHTML = account.createEmptyStateMarkup(
        'Bạn chưa có đơn đang phụ trách',
        'Sau khi nhận giao hoặc được gán shipper, các đơn sẽ xuất hiện trong danh sách này.',
        ''
      );
      return;
    }

    assignedEl.innerHTML = orders.map((order) => account.renderOrderCard(ctx, order, { compact: true, showAiButton: false })).join('');
    account.bindOrderActions(ctx, loadAndRender, assignedEl);
  };

  await loadAndRender();
});

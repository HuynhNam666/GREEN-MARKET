document.addEventListener('DOMContentLoaded', async () => {
  const account = window.GreenMarketAccount;
  if (!account) return;

  const ctx = await account.boot('seller');
  if (!ctx) return;

  const pageContent = document.getElementById('account-page-content');
  if (!account.hasRole(ctx, ['Seller', 'Admin'])) {
    account.renderAccessState(
      pageContent,
      'Khu vực này dành cho người bán',
      'Bạn cần nâng cấp lên Seller để quản lý shop và sản phẩm. Nếu đang là User, hãy mở trang Hồ sơ & vai trò để gửi yêu cầu tạo shop.',
      `<a href="${account.app.buildPageUrl('taikhoan-hoso.html', { focus: 'become-seller' })}#become-seller" class="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-forest">Mở trang nâng cấp Seller</a>`
    );
    return;
  }

  const summaryEl = document.getElementById('seller-ops-summary');
  const queueEl = document.getElementById('seller-order-queue');
  const shopsContent = document.getElementById('shops-content');
  const productsContent = document.getElementById('products-content');

  const loadAndRender = async () => {
    await account.loadData(ctx, {
      orders: true,
      shops: true,
      products: true,
      categories: true,
    });

    renderSummary();
    renderSellerQueue();
    renderShops();
    renderProducts();
    populateCategorySelect();
    populateShopSelect();
  };

  const getManagedShops = () => account.getManagedShops(ctx);
  const getManagedProducts = () => account.getManagedProducts(ctx);

  const renderSummary = () => {
    if (!summaryEl) return;
    const cards = [
      {
        label: 'Shop đang quản lý',
        value: getManagedShops().length,
        helper: 'Số shop bạn có thể chỉnh sửa trực tiếp.',
      },
      {
        label: 'SKU đang quản lý',
        value: getManagedProducts().length,
        helper: 'Tổng số sản phẩm thuộc các shop hiện tại.',
      },
      {
        label: 'Chờ xác nhận',
        value: account.countOrdersByStatus(ctx.state.orders, 'AwaitingConfirmation'),
        helper: 'Đơn vừa thanh toán xong và cần shop xác nhận.',
      },
      {
        label: 'Hậu mãi / giao lỗi',
        value: account.countOrdersByStatus(ctx.state.orders, ['FailedDelivery', 'ReturnRequested', 'Returned']),
        helper: 'Những đơn cần xử lý lại hoặc theo dõi sau bán.',
        valueClassName: 'text-orange-700',
      },
    ];
    summaryEl.innerHTML = cards.map((card) => account.createKpiCardMarkup(card.label, card.value, card.helper, card.valueClassName)).join('');
  };

  const renderSellerQueue = () => {
    if (!queueEl) return;
    const sellerOrders = [...ctx.state.orders]
      .filter((order) => ['AwaitingConfirmation', 'Processing', 'ReadyToShip', 'FailedDelivery'].includes(order.status))
      .sort((left, right) => new Date(right.orderDate || 0) - new Date(left.orderDate || 0))
      .slice(0, 3);

    if (!sellerOrders.length) {
      queueEl.innerHTML = account.createEmptyStateMarkup(
        'Không có đơn cần xử lý ngay',
        'Khu vực này sẽ ưu tiên hiển thị các đơn cần xác nhận, chuẩn bị giao hoặc cần giao lại.',
        `<a href="${account.app.buildPageUrl('taikhoan-donhang.html')}" class="inline-flex items-center gap-2 rounded-xl border border-primary/15 px-5 py-3 text-sm font-bold text-forest transition hover:bg-earth-beige/60">Mở trang đơn hàng</a>`
      );
      return;
    }

    queueEl.innerHTML = sellerOrders.map((order) => account.renderOrderCard(ctx, order, { compact: true, showAiButton: false })).join('');
    account.bindOrderActions(ctx, loadAndRender, queueEl);
  };

  const resetShopForm = () => {
    document.getElementById('shop-id').value = '';
    document.getElementById('shop-name').value = '';
    document.getElementById('shop-description').value = '';
  };

  const populateShopSelect = () => {
    const shopSelect = document.getElementById('product-shop');
    if (!shopSelect) return;
    const shops = getManagedShops();
    shopSelect.innerHTML = shops.length
      ? shops.map((shop) => `<option value="${shop.id}">${account.app.escapeHtml(shop.name)}</option>`).join('')
      : '<option value="">Chưa có shop</option>';
  };

  const populateCategorySelect = () => {
    const categorySelect = document.getElementById('product-category');
    if (!categorySelect) return;
    categorySelect.innerHTML = ctx.state.categories.length
      ? ctx.state.categories.map((category) => `<option value="${category.id}">${account.app.escapeHtml(category.name)}</option>`).join('')
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
          await account.app.request(`/api/shops/${button.dataset.shopId}`, { method: 'DELETE' });
          account.app.notify('Đã xóa shop.', 'success');
          resetShopForm();
          await loadAndRender();
        } catch (error) {
          account.app.notify(error.message, 'error');
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
          await account.app.request(`/api/products/${button.dataset.productId}`, { method: 'DELETE' });
          account.app.notify('Đã xóa sản phẩm.', 'success');
          resetProductForm();
          await loadAndRender();
        } catch (error) {
          account.app.notify(error.message, 'error');
        }
      });
    });
  };

  const renderShops = () => {
    if (!shopsContent) return;
    const shops = getManagedShops();
    if (!shops.length) {
      shopsContent.innerHTML = account.createEmptyStateMarkup(
        'Bạn chưa có shop nào',
        'Hãy tạo shop đầu tiên để bắt đầu xây dựng mặt tiền bán hàng và đăng sản phẩm.',
        ''
      );
      return;
    }

    shopsContent.innerHTML = shops.map((shop) => `
      <article class="gm-account-action-card">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h3 class="text-xl font-black text-forest">${account.app.escapeHtml(shop.name)}</h3>
            <p class="mt-2 text-sm leading-7 text-slate-500">${account.app.escapeHtml(shop.description || 'Chưa có mô tả')}</p>
            <p class="mt-3 text-xs font-extrabold uppercase tracking-[0.22em] text-slate-400">Seller ID: ${shop.sellerId}</p>
          </div>
          <div class="flex flex-col gap-2">
            <button data-action="edit-shop" data-shop-id="${shop.id}" class="rounded-xl border border-primary/15 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/5 transition-colors">Sửa</button>
            <button data-action="delete-shop" data-shop-id="${shop.id}" class="rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors">Xóa</button>
          </div>
        </div>
      </article>
    `).join('');

    bindShopActions();
  };

  const renderProducts = () => {
    if (!productsContent) return;
    const products = getManagedProducts();
    if (!products.length) {
      productsContent.innerHTML = account.createEmptyStateMarkup(
        'Chưa có sản phẩm nào',
        'Khi bạn tạo SKU đầu tiên, danh sách sản phẩm sẽ hiển thị tại đây cùng các thao tác sửa và xóa.',
        ''
      );
      return;
    }

    productsContent.innerHTML = products.map((product) => `
      <article class="gm-account-action-card">
        <div class="flex gap-4">
          <img src="${account.app.resolveImageUrl(product.imageUrl)}" alt="${account.app.escapeHtml(product.name)}" class="h-24 w-24 rounded-2xl object-cover bg-earth-beige/40" />
          <div class="flex-1">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h3 class="text-xl font-black text-forest">${account.app.escapeHtml(product.name)}</h3>
                <p class="mt-2 text-sm leading-7 text-slate-500">${account.app.escapeHtml(product.description || 'Chưa có mô tả')}</p>
              </div>
              <div class="flex flex-col gap-2">
                <button data-action="edit-product" data-product-id="${product.id}" class="rounded-xl border border-primary/15 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/5 transition-colors">Sửa</button>
                <button data-action="delete-product" data-product-id="${product.id}" class="rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors">Xóa</button>
              </div>
            </div>
            <div class="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span class="gm-account-chip">${account.app.escapeHtml(product.categoryName || 'Không rõ danh mục')}</span>
              <span>${account.app.escapeHtml(product.shopName || 'Không rõ shop')}</span>
              <span class="font-black text-primary">${account.app.formatCurrency(product.price)}</span>
              <span>Tồn kho: ${product.stock}</span>
            </div>
          </div>
        </div>
      </article>
    `).join('');

    bindProductActions();
  };

  document.getElementById('shop-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const shopId = document.getElementById('shop-id').value;
    const name = document.getElementById('shop-name').value.trim();
    const description = document.getElementById('shop-description').value.trim();
    if (!name) {
      account.app.notify('Vui lòng nhập tên shop.', 'warning');
      return;
    }
    try {
      await account.app.request(shopId ? `/api/shops/${shopId}` : '/api/shops', {
        method: shopId ? 'PUT' : 'POST',
        body: { name, description },
      });
      account.app.notify(shopId ? 'Đã cập nhật shop.' : 'Đã tạo shop mới.', 'success');
      resetShopForm();
      await loadAndRender();
    } catch (error) {
      account.app.notify(error.message, 'error');
    }
  });

  document.getElementById('shop-form-reset')?.addEventListener('click', resetShopForm);

  document.getElementById('upload-product-image')?.addEventListener('click', async () => {
    const fileInput = document.getElementById('product-image-file');
    const file = fileInput?.files?.[0];
    if (!file) {
      account.app.notify('Vui lòng chọn file ảnh để upload.', 'warning');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await account.app.request('/api/products/upload', {
        method: 'POST',
        body: formData,
      });
      document.getElementById('product-image-url').value = response.url || '';
      account.app.notify('Upload ảnh thành công.', 'success');
    } catch (error) {
      account.app.notify(error.message, 'error');
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
      account.app.notify('Vui lòng nhập tên sản phẩm, chọn danh mục và shop.', 'warning');
      return;
    }

    try {
      await account.app.request(productId ? `/api/products/${productId}` : '/api/products', {
        method: productId ? 'PUT' : 'POST',
        body: { name, description, price, stock, imageUrl, categoryId, shopId },
      });
      account.app.notify(productId ? 'Đã cập nhật sản phẩm.' : 'Đã tạo sản phẩm mới.', 'success');
      resetProductForm();
      await loadAndRender();
    } catch (error) {
      account.app.notify(error.message, 'error');
    }
  });

  document.getElementById('product-form-reset')?.addEventListener('click', resetProductForm);

  await loadAndRender();
});

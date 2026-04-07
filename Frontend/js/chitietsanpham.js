document.addEventListener('DOMContentLoaded', async () => {
  const app = window.GreenMarketApp;
  if (!app) return;

  await app.bootstrapPage();

  const productId = Number(app.getQueryParam('id'));
  const detailContainer = document.getElementById('product-detail');
  const relatedContainer = document.getElementById('related-products');
  const breadcrumbProductName = document.getElementById('breadcrumb-product-name');

  if (!productId || !detailContainer) {
    if (detailContainer) {
      detailContainer.innerHTML = '<div class="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-600">Thiếu mã sản phẩm để hiển thị chi tiết.</div>';
    }
    return;
  }

  detailContainer.innerHTML = '<div class="rounded-2xl border border-dashed border-primary/20 bg-white p-10 text-center text-slate-500">Đang tải thông tin sản phẩm...</div>';

  try {
    const product = await app.request(`/api/products/${productId}`, { auth: false });
    const shop = product.shopId ? await app.request(`/api/shops/${product.shopId}`, { auth: false }) : null;
    const imageUrl = app.resolveImageUrl(product.imageUrl);

    app.setAssistantContext({
      productId: product.id,
      sellerId: shop?.sellerId || null,
      shopId: product.shopId || shop?.id || null,
      productName: product.name || '',
      shopName: product.shopName || shop?.name || '',
    });

    if (breadcrumbProductName) {
      breadcrumbProductName.textContent = product.name;
    }

    detailContainer.innerHTML = `
      <div class="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div class="overflow-hidden rounded-[2rem] border border-primary/10 bg-white shadow-sm">
          <div class="aspect-[4/3] bg-earth-beige/30">
            <img src="${imageUrl}" alt="${app.escapeHtml(product.name)}" class="h-full w-full object-cover" />
          </div>
        </div>
        <div class="rounded-[2rem] border border-primary/10 bg-white p-8 shadow-sm">
          <div class="flex flex-wrap gap-3 text-xs font-bold uppercase tracking-wide">
            <span class="rounded-full bg-primary/10 px-3 py-1 text-primary">${app.escapeHtml(product.categoryName || 'Nông sản sạch')}</span>
            ${product.shopName ? `<span class="rounded-full bg-earth-beige/60 px-3 py-1 text-forest">${app.escapeHtml(product.shopName)}</span>` : ''}
          </div>
          <h1 class="mt-5 text-4xl font-black leading-tight text-forest">${app.escapeHtml(product.name)}</h1>
          <p class="mt-4 text-lg leading-8 text-slate-600">${app.escapeHtml(product.description || 'Sản phẩm tươi sạch được tuyển chọn từ Green Market.')}</p>

          <div class="mt-8 grid gap-4 rounded-2xl bg-background-light p-6 sm:grid-cols-2">
            <div>
              <p class="text-sm font-semibold uppercase tracking-wide text-slate-400">Giá bán</p>
              <p class="mt-2 text-4xl font-black text-primary">${app.formatCurrency(product.price)}</p>
            </div>
            <div>
              <p class="text-sm font-semibold uppercase tracking-wide text-slate-400">Tồn kho</p>
              <p class="mt-2 text-xl font-bold ${Number(product.stock) > 0 ? 'text-emerald-600' : 'text-rose-500'}">
                ${Number(product.stock) > 0 ? `Còn ${product.stock} sản phẩm` : 'Hết hàng'}
              </p>
            </div>
          </div>

          <div class="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div class="inline-flex items-center rounded-full border border-primary/15 bg-background-light px-2 py-1">
              <button id="quantity-decrease" class="flex h-11 w-11 items-center justify-center rounded-full text-2xl font-bold text-forest hover:bg-white">-</button>
              <input id="product-quantity" type="number" min="1" max="${Math.max(1, Number(product.stock || 1))}" value="1" class="w-16 border-none bg-transparent text-center text-lg font-bold focus:ring-0" />
              <button id="quantity-increase" class="flex h-11 w-11 items-center justify-center rounded-full text-2xl font-bold text-forest hover:bg-white">+</button>
            </div>
            <button id="detail-add-to-cart" class="flex-1 rounded-2xl bg-primary px-6 py-4 text-lg font-bold text-white hover:bg-forest transition-colors disabled:cursor-not-allowed disabled:opacity-60" ${Number(product.stock) <= 0 ? 'disabled' : ''}>Thêm vào giỏ hàng</button>
          </div>

          <div class="mt-4 grid gap-3 sm:grid-cols-2">
            <a href="${app.buildPageUrl('giohang.html')}" class="rounded-2xl border border-primary/15 px-6 py-4 text-center font-bold text-forest hover:bg-earth-beige/40 transition-colors">Xem giỏ hàng</a>
            <button id="contact-shop" class="rounded-2xl border border-primary/15 px-6 py-4 text-center font-bold text-primary hover:bg-primary/5 transition-colors">Nhắn shop</button>
          </div>

          <dl class="mt-8 grid gap-4 rounded-2xl border border-primary/10 p-6 text-sm text-slate-600 sm:grid-cols-2">
            <div>
              <dt class="font-bold text-forest">Danh mục</dt>
              <dd class="mt-1">${app.escapeHtml(product.categoryName || 'Đang cập nhật')}</dd>
            </div>
            <div>
              <dt class="font-bold text-forest">Cửa hàng</dt>
              <dd class="mt-1">${app.escapeHtml(product.shopName || 'Đang cập nhật')}</dd>
            </div>
            <div>
              <dt class="font-bold text-forest">Mã sản phẩm</dt>
              <dd class="mt-1">#${product.id}</dd>
            </div>
            <div>
              <dt class="font-bold text-forest">Người bán</dt>
              <dd class="mt-1">${shop ? app.escapeHtml(String(shop.sellerId)) : 'Đang cập nhật'}</dd>
            </div>
          </dl>
        </div>
      </div>
    `;

    const quantityInput = document.getElementById('product-quantity');
    const decreaseButton = document.getElementById('quantity-decrease');
    const increaseButton = document.getElementById('quantity-increase');
    const addToCartButton = document.getElementById('detail-add-to-cart');
    const contactShopButton = document.getElementById('contact-shop');
    const maxQuantity = Math.max(1, Number(product.stock || 1));

    const setQuantity = (value) => {
      if (!quantityInput) return;
      const safeValue = Math.max(1, Math.min(maxQuantity, Number(value || 1)));
      quantityInput.value = String(safeValue);
    };

    quantityInput?.addEventListener('change', () => setQuantity(quantityInput.value));
    decreaseButton?.addEventListener('click', () => setQuantity(Number(quantityInput?.value || 1) - 1));
    increaseButton?.addEventListener('click', () => setQuantity(Number(quantityInput?.value || 1) + 1));

    addToCartButton?.addEventListener('click', async () => {
      const user = await app.refreshCurrentUser();
      if (!user) {
        app.redirectToLogin();
        return;
      }

      const quantity = Number(quantityInput?.value || 1);
      const originalText = addToCartButton.textContent;
      addToCartButton.disabled = true;
      addToCartButton.textContent = 'Đang thêm...';

      try {
        await app.request('/api/cart/add', {
          method: 'POST',
          body: { productId: product.id, quantity },
        });
        app.notify('Đã thêm sản phẩm vào giỏ hàng.', 'success');
        await app.updateCartBadge();
      } catch (error) {
        app.notify(error.message, 'error');
      } finally {
        addToCartButton.disabled = Number(product.stock) <= 0;
        addToCartButton.textContent = originalText;
      }
    });

    contactShopButton?.addEventListener('click', async () => {
      try {
        const opened = await app.openShopConversation({
          sellerId: shop?.sellerId || null,
          shopId: product.shopId || null,
          productId: product.id,
        });

        if (!opened?.conversationId) {
          app.notify('Không mở được hội thoại với shop.', 'error');
          return;
        }

        window.location.href = app.buildPageUrl('chat.html', {
          conversationId: opened.conversationId,
          sellerId: opened.sellerId,
          shopId: opened.shopId,
          productId: product.id,
        });
      } catch (error) {
        app.notify(error.message || 'Không mở được hội thoại với shop.', 'error');
      }
    });

    if (relatedContainer) {
      const allProducts = await app.request('/api/products', { auth: false });
      const relatedProducts = (Array.isArray(allProducts) ? allProducts : [])
        .filter((item) => item.id !== product.id && Number(item.categoryId) === Number(product.categoryId))
        .slice(0, 3);

      if (!relatedProducts.length) {
        relatedContainer.innerHTML = '<div class="rounded-2xl border border-dashed border-primary/20 bg-white p-8 text-center text-slate-500">Chưa có sản phẩm liên quan cùng danh mục.</div>';
      } else {
        relatedContainer.innerHTML = relatedProducts
          .map((item) => app.createProductCard(item, { showChat: true }))
          .join('');
        app.bindProductCardActions(relatedContainer);
      }
    }
  } catch (error) {
    detailContainer.innerHTML = `
      <div class="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-600">
        ${app.escapeHtml(error.message || 'Không tải được sản phẩm.')}
      </div>
    `;
  }
});

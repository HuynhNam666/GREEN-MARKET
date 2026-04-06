tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#17cf26',
        accent: '#A3B18A',
        forest: '#1B3022',
        'earth-beige': '#E9E3D3',
        'background-light': '#FDFCF8',
        'background-dark': '#112112',
      },
      fontFamily: {
        display: ['Plus Jakarta Sans', 'Manrope', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
      },
    },
  },
};

document.addEventListener('DOMContentLoaded', async () => {
  const app = window.GreenMarketApp;
  if (!app) return;

  await app.bootstrapPage();

  const cartItemsContainer = document.getElementById('cart-items');
  const cartCountLabel = document.getElementById('cart-count');
  const subtotalElement = document.getElementById('subtotal');
  const shippingElement = document.getElementById('shipping');
  const discountElement = document.getElementById('discount');
  const totalElement = document.getElementById('total');
  const totalNote = totalElement?.parentElement?.querySelector('p');
  const summaryCard = subtotalElement ? subtotalElement.closest('.bg-white') : null;
  const summaryWrapper = summaryCard ? summaryCard.parentElement : null;
  let checkoutForm = null;

  const renderLoginRequired = () => {
    if (cartItemsContainer) {
      cartItemsContainer.innerHTML = `
        <div class="p-10 text-center">
          <h3 class="text-2xl font-bold text-forest">Bạn chưa đăng nhập</h3>
          <p class="mt-3 text-slate-500">Vui lòng đăng nhập để đồng bộ giỏ hàng với backend.</p>
          <a href="${app.buildPageUrl('dangnhap.html', { redirect: app.getCurrentRelativeUrl() })}" class="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-white hover:bg-forest transition-colors">
            Đăng nhập ngay
          </a>
        </div>
      `;
    }

    if (cartCountLabel) cartCountLabel.textContent = '(0 sản phẩm)';
    if (subtotalElement) subtotalElement.textContent = '0đ';
    if (shippingElement) shippingElement.textContent = '0đ';
    if (discountElement) discountElement.textContent = '0đ';
    if (totalElement) totalElement.textContent = '0đ';
    if (totalNote) totalNote.textContent = '(Vui lòng đăng nhập)';

    if (summaryCard) {
      const checkoutButton = summaryCard.querySelector('button');
      if (checkoutButton) {
        checkoutButton.disabled = false;
        checkoutButton.className = 'w-full bg-primary text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-forest transition-colors';
        checkoutButton.textContent = 'Đăng nhập để thanh toán';
        checkoutButton.onclick = () => {
          window.location.href = app.buildPageUrl('dangnhap.html', { redirect: app.getCurrentRelativeUrl() });
        };
      }
    }
  };

  const ensureCheckoutForm = () => {
    if (!summaryWrapper || checkoutForm) return checkoutForm;

    checkoutForm = document.createElement('div');
    checkoutForm.className = 'mb-6 rounded-xl border border-primary/5 bg-white p-6 shadow-sm';
    checkoutForm.innerHTML = `
      <h3 class="text-xl font-bold mb-4">Thông tin nhận hàng</h3>
      <form id="checkout-form" class="space-y-4">
        <div>
          <label class="mb-2 block text-sm font-semibold text-slate-700">Họ và tên người nhận</label>
          <input id="checkout-contact-name" class="w-full rounded-xl border border-primary/15 bg-background-light px-4 py-3 focus:border-primary focus:ring-primary" placeholder="Nguyễn Văn A" />
        </div>
        <div>
          <label class="mb-2 block text-sm font-semibold text-slate-700">Số điện thoại</label>
          <input id="checkout-contact-phone" class="w-full rounded-xl border border-primary/15 bg-background-light px-4 py-3 focus:border-primary focus:ring-primary" placeholder="09xx xxx xxx" />
        </div>
        <div>
          <label class="mb-2 block text-sm font-semibold text-slate-700">Địa chỉ giao hàng</label>
          <textarea id="checkout-address" rows="3" class="w-full rounded-xl border border-primary/15 bg-background-light px-4 py-3 focus:border-primary focus:ring-primary" placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"></textarea>
        </div>
        <div>
          <label class="mb-2 block text-sm font-semibold text-slate-700">Ghi chú cho đơn hàng</label>
          <textarea id="checkout-note" rows="2" class="w-full rounded-xl border border-primary/15 bg-background-light px-4 py-3 focus:border-primary focus:ring-primary" placeholder="Ví dụ: giao giờ hành chính, gọi trước khi giao..."></textarea>
        </div>
        <div class="rounded-xl bg-earth-beige/40 px-4 py-3 text-sm text-slate-600">
          Sau khi tạo đơn, hệ thống sẽ lấy link thanh toán VNPay từ backend. Nếu chưa cấu hình VNPay, bạn vẫn tạo được đơn và kiểm tra trạng thái trong trang tài khoản.
        </div>
      </form>
    `;

    summaryWrapper.insertBefore(checkoutForm, summaryCard);
    return checkoutForm;
  };

  const updateSummary = (cart) => {
    const count = Array.isArray(cart.items)
      ? cart.items.reduce((total, item) => total + Number(item.quantity || 0), 0)
      : 0;
    const total = Number(cart.total || 0);

    if (cartCountLabel) cartCountLabel.textContent = `(${count} sản phẩm)`;
    if (subtotalElement) subtotalElement.textContent = app.formatCurrency(total);
    if (shippingElement) shippingElement.textContent = '0đ';
    if (discountElement) discountElement.textContent = '0đ';
    if (totalElement) totalElement.textContent = app.formatCurrency(total);
    if (totalNote) totalNote.textContent = count ? '(Chưa bao gồm phát sinh khác nếu có)' : '(Chưa có sản phẩm)';
  };

  const bindItemActions = (reloadCart) => {
    cartItemsContainer.querySelectorAll('[data-action="decrease"], [data-action="increase"]').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';
      button.addEventListener('click', async () => {
        const itemId = Number(button.dataset.itemId);
        const currentQuantity = Number(button.dataset.quantity || 1);
        const stock = Number(button.dataset.stock || currentQuantity);
        const nextQuantity = button.dataset.action === 'increase'
          ? Math.min(stock, currentQuantity + 1)
          : currentQuantity - 1;

        if (nextQuantity <= 0) {
          await removeItem(itemId, reloadCart);
          return;
        }

        try {
          await app.request(`/api/cart/items/${itemId}`, {
            method: 'PUT',
            body: { quantity: nextQuantity },
          });
          await reloadCart();
        } catch (error) {
          app.notify(error.message, 'error');
        }
      });
    });

    cartItemsContainer.querySelectorAll('[data-action="remove"]').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';
      button.addEventListener('click', async () => {
        await removeItem(Number(button.dataset.itemId), reloadCart);
      });
    });
  };

  const removeItem = async (itemId, reloadCart) => {
    try {
      await app.request(`/api/cart/items/${itemId}`, {
        method: 'DELETE',
      });
      app.notify('Đã xóa sản phẩm khỏi giỏ hàng.', 'success');
      await reloadCart();
    } catch (error) {
      app.notify(error.message, 'error');
    }
  };

  const renderCart = (cart, reloadCart) => {
    const items = Array.isArray(cart.items) ? cart.items : [];
    updateSummary(cart);

    if (!items.length) {
      if (cartItemsContainer) {
        cartItemsContainer.innerHTML = `
          <div class="p-10 text-center text-slate-400">
            Giỏ hàng của bạn đang trống.
            <div class="mt-5">
              <a href="${app.buildPageUrl('sanpham.html')}" class="inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-white hover:bg-forest transition-colors">
                Đi mua sắm ngay
              </a>
            </div>
          </div>
        `;
      }
    } else if (cartItemsContainer) {
      cartItemsContainer.innerHTML = items
        .map((item) => `
          <article class="p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex gap-4">
              <a href="${app.buildPageUrl('chitietsanpham.html', { id: item.productId })}" class="h-24 w-24 overflow-hidden rounded-2xl bg-earth-beige/50">
                <img src="${app.resolveImageUrl(item.imageUrl)}" alt="${app.escapeHtml(item.productName)}" class="h-full w-full object-cover" />
              </a>
              <div class="space-y-2">
                <a href="${app.buildPageUrl('chitietsanpham.html', { id: item.productId })}" class="block text-lg font-bold text-forest hover:text-primary transition-colors">${app.escapeHtml(item.productName)}</a>
                <div class="flex flex-wrap gap-2 text-sm text-slate-500">
                  ${item.categoryName ? `<span class="rounded-full bg-primary/10 px-3 py-1 text-primary font-semibold">${app.escapeHtml(item.categoryName)}</span>` : ''}
                  ${item.shopName ? `<span>${app.escapeHtml(item.shopName)}</span>` : ''}
                </div>
                <p class="text-sm text-slate-500">Đơn giá: <strong>${app.formatCurrency(item.price)}</strong></p>
                <p class="text-sm text-slate-500">Tồn kho hiện tại: ${item.stock}</p>
              </div>
            </div>
            <div class="flex items-center justify-between gap-6 sm:justify-end">
              <div class="inline-flex items-center rounded-full border border-primary/15 bg-background-light px-2 py-1">
                <button data-action="decrease" data-item-id="${item.id}" data-quantity="${item.quantity}" data-stock="${item.stock}" class="flex h-9 w-9 items-center justify-center rounded-full text-xl font-bold text-forest hover:bg-white">-</button>
                <span class="min-w-10 text-center font-bold">${item.quantity}</span>
                <button data-action="increase" data-item-id="${item.id}" data-quantity="${item.quantity}" data-stock="${item.stock}" class="flex h-9 w-9 items-center justify-center rounded-full text-xl font-bold text-forest hover:bg-white">+</button>
              </div>
              <div class="text-right">
                <p class="text-lg font-black text-primary">${app.formatCurrency(item.lineTotal)}</p>
                <button data-action="remove" data-item-id="${item.id}" class="mt-2 text-sm font-semibold text-rose-500 hover:text-rose-600">Xóa</button>
              </div>
            </div>
          </article>
        `)
        .join('');
    }

    ensureCheckoutForm();
    const checkoutButton = summaryCard?.querySelector('button');
    if (checkoutButton) {
      checkoutButton.disabled = !items.length;
      checkoutButton.className = `w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-colors ${
        items.length ? 'bg-primary text-white hover:bg-forest' : 'bg-gray-300 text-white cursor-not-allowed'
      }`;
      checkoutButton.textContent = items.length ? 'Tạo đơn & lấy link thanh toán' : 'Chưa thể thanh toán';
      checkoutButton.onclick = async () => {
        if (!items.length) return;
        const form = document.getElementById('checkout-form');
        const contactName = document.getElementById('checkout-contact-name')?.value.trim() || '';
        const contactPhone = document.getElementById('checkout-contact-phone')?.value.trim() || '';
        const shippingAddress = document.getElementById('checkout-address')?.value.trim() || '';
        const note = document.getElementById('checkout-note')?.value.trim() || '';

        if (!contactName || !contactPhone || !shippingAddress) {
          app.notify('Vui lòng nhập đầy đủ thông tin giao hàng.', 'warning');
          form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }

        const originalText = checkoutButton.textContent;
        checkoutButton.disabled = true;
        checkoutButton.textContent = 'Đang tạo đơn...';

        try {
          const order = await app.request('/api/orders/checkout', {
            method: 'POST',
            body: { contactName, contactPhone, shippingAddress, note },
          });

          let paymentUrl = '';
          try {
            const payment = await app.request(`/api/orders/${order.id}/pay-url`, {
              method: 'POST',
            });
            paymentUrl = payment.paymentUrl || '';
          } catch (paymentError) {
            app.notify(`Đã tạo đơn ${order.orderCode || `#${order.id}`}, nhưng chưa lấy được link thanh toán: ${paymentError.message}`, 'warning');
          }

          if (paymentUrl) {
            app.notify(`Đã tạo đơn ${order.orderCode || `#${order.id}`}. Đang mở cổng thanh toán...`, 'success');
            window.open(paymentUrl, '_blank', 'noopener');
          }

          window.location.href = app.buildPageUrl('taikhoan-donhang.html', {
            orderId: order.id,
          });
        } catch (error) {
          app.notify(error.message, 'error');
          checkoutButton.disabled = false;
          checkoutButton.textContent = originalText;
        }
      };
    }

    bindItemActions(reloadCart);
  };

  const currentUser = await app.refreshCurrentUser();
  if (!currentUser) {
    renderLoginRequired();
    return;
  }

  const reloadCart = async () => {
    try {
      const cart = await app.request('/api/cart');
      renderCart(cart, reloadCart);
      await app.updateCartBadge();
    } catch (error) {
      app.notify(error.message, 'error');
    }
  };

  await reloadCart();
});

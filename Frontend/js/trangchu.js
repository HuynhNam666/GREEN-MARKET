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
  const dealContainer = document.getElementById('deal-products');
  const hourElement = document.getElementById('hours');
  const minuteElement = document.getElementById('minutes');
  const secondElement = document.getElementById('seconds');

  const updateCountdown = () => {
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const distance = Math.max(0, endOfDay.getTime() - now.getTime());
    const hours = String(Math.floor(distance / (1000 * 60 * 60))).padStart(2, '0');
    const minutes = String(Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
    const seconds = String(Math.floor((distance % (1000 * 60)) / 1000)).padStart(2, '0');

    if (hourElement) hourElement.textContent = hours;
    if (minuteElement) minuteElement.textContent = minutes;
    if (secondElement) secondElement.textContent = seconds;
  };

  updateCountdown();
  window.setInterval(updateCountdown, 1000);

  if (!dealContainer || !window.GreenMarketApp) return;

  dealContainer.innerHTML = `
    <div class="col-span-full rounded-2xl border border-dashed border-white/10 bg-white/5 px-6 py-10 text-center text-white/70">
      Đang tải sản phẩm nổi bật...
    </div>
  `;

  try {
    const products = await window.GreenMarketApp.request('/api/products', { auth: false });
    const latestProducts = (Array.isArray(products) ? products : []).slice(0, 4);

    if (!latestProducts.length) {
      dealContainer.innerHTML = `
        <div class="col-span-full rounded-2xl border border-dashed border-white/10 bg-white/5 px-6 py-10 text-center text-white/70">
          Hiện chưa có sản phẩm nào từ backend. Bạn hãy thêm dữ liệu ở trang quản trị hoặc tài khoản người bán.
        </div>
      `;
      return;
    }

    dealContainer.innerHTML = latestProducts
      .map((product) => {
        const detailUrl = window.GreenMarketApp.buildPageUrl('chitietsanpham.html', { id: product.id });
        return `
          <article class="rounded-2xl overflow-hidden border border-white/10 bg-white/10 backdrop-blur-sm shadow-xl">
            <a href="${detailUrl}" class="block aspect-[4/3] overflow-hidden bg-black/10">
              <img
                src="${window.GreenMarketApp.resolveImageUrl(product.imageUrl)}"
                alt="${window.GreenMarketApp.escapeHtml(product.name)}"
                class="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
              />
            </a>
            <div class="p-6 text-white">
              <div class="flex items-center justify-between gap-4">
                <span class="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent">
                  ${window.GreenMarketApp.escapeHtml(product.categoryName || 'Nông sản')}
                </span>
                <span class="text-lg font-black text-accent">${window.GreenMarketApp.formatCurrency(product.price)}</span>
              </div>
              <h3 class="mt-4 text-xl font-bold leading-snug">${window.GreenMarketApp.escapeHtml(product.name)}</h3>
              <p class="mt-2 text-sm text-white/70 line-clamp-2">${window.GreenMarketApp.escapeHtml(product.description || 'Sản phẩm tươi sạch được lấy trực tiếp từ Green Market.')}</p>
              <div class="mt-5 grid grid-cols-2 gap-3">
                <a href="${detailUrl}" class="rounded-xl border border-white/20 px-4 py-3 text-center font-bold hover:bg-white/10 transition-colors">Xem chi tiết</a>
                <button class="add-to-cart-btn rounded-xl bg-primary px-4 py-3 font-bold text-white hover:bg-forest transition-colors" data-product-id="${product.id}">Thêm giỏ hàng</button>
              </div>
            </div>
          </article>
        `;
      })
      .join('');

    window.GreenMarketApp.bindProductCardActions(dealContainer);
  } catch (error) {
    dealContainer.innerHTML = `
      <div class="col-span-full rounded-2xl border border-rose-200 bg-rose-50 px-6 py-10 text-center text-rose-600">
        ${window.GreenMarketApp.escapeHtml(error.message || 'Không tải được sản phẩm nổi bật.')}
      </div>
    `;
  }
});

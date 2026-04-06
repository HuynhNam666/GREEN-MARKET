document.addEventListener('DOMContentLoaded', async () => {
  const account = window.GreenMarketAccount;
  if (!account) return;

  const ctx = await account.boot('profile');
  if (!ctx) return;

  const profileOverview = document.getElementById('profile-overview');
  const roleCapabilities = document.getElementById('profile-role-capabilities');
  const roleActions = document.getElementById('profile-role-actions');
  const quickLinks = document.getElementById('profile-quick-links');

  await account.loadData(ctx, {
    shops: ctx.currentUser.role === 'Seller' || ctx.currentUser.role === 'Admin',
    products: ctx.currentUser.role === 'Seller' || ctx.currentUser.role === 'Admin',
  });

  const managedShops = account.getManagedShops(ctx);
  const managedProducts = account.getManagedProducts(ctx);

  if (profileOverview) {
    const roleTone = account.roleToneMap[ctx.currentUser.role] || account.roleToneMap.User;
    profileOverview.innerHTML = `
      <section class="gm-account-surface p-6 md:p-8">
        <div class="gm-account-section-heading">
          <div>
            <p class="text-sm font-black uppercase tracking-[0.24em] text-primary">Thông tin đăng nhập</p>
            <h2 class="mt-3 text-3xl font-black text-forest">Hồ sơ hiện tại</h2>
          </div>
        </div>
        <div class="gm-account-split">
          <div class="gm-account-surface-soft p-6">
            <div class="flex flex-wrap items-center gap-3">
              <span class="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <span class="material-symbols-outlined text-3xl">account_circle</span>
              </span>
              <div>
                <h3 class="text-2xl font-black text-forest">${account.app.escapeHtml(ctx.currentUser.username)}</h3>
                <p class="mt-1 text-sm text-slate-500">${account.app.escapeHtml(ctx.currentUser.email)}</p>
              </div>
            </div>
            <div class="mt-6 grid gap-4 sm:grid-cols-2">
              <div class="rounded-2xl bg-white px-4 py-4">
                <p class="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-400">Vai trò</p>
                <p class="mt-3"><span class="inline-flex rounded-full px-3 py-1 text-xs font-extrabold ${roleTone}">${account.app.escapeHtml(ctx.currentUser.role)}</span></p>
              </div>
              <div class="rounded-2xl bg-white px-4 py-4">
                <p class="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-400">Bố cục module</p>
                <p class="mt-3 text-sm font-bold text-forest">Tách theo trang chức năng</p>
              </div>
              <div class="rounded-2xl bg-white px-4 py-4">
                <p class="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-400">Shop quản lý</p>
                <p class="mt-3 text-lg font-black text-forest">${managedShops.length}</p>
              </div>
              <div class="rounded-2xl bg-white px-4 py-4">
                <p class="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-400">SKU quản lý</p>
                <p class="mt-3 text-lg font-black text-forest">${managedProducts.length}</p>
              </div>
            </div>
          </div>
          <div class="gm-account-surface-soft p-6">
            <p class="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-400">Gợi ý nhanh</p>
            <div class="mt-4 space-y-4 text-sm leading-7 text-slate-500">
              <p>Mỗi trang chỉ tập trung vào một việc để dễ nhìn hơn.</p>
              <p>Thiết kế giữ nguyên màu xanh, nền sáng và card bo tròn của AgriFresh.</p>
              <p>Chat AI vẫn có sẵn ở mọi trang để hỗ trợ nhanh.</p>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  if (roleCapabilities) {
    const capabilities = [
      {
        icon: 'shopping_bag',
        title: 'Người dùng',
        description: 'Theo dõi và xử lý đơn hàng cá nhân.',
        active: ['User', 'Seller', 'Shipper', 'Admin'].includes(ctx.currentUser.role),
      },
      {
        icon: 'storefront',
        title: 'Người bán',
        description: 'Quản lý shop, SKU và đơn đang bán.',
        active: ['Seller', 'Admin'].includes(ctx.currentUser.role),
      },
      {
        icon: 'local_shipping',
        title: 'Shipper',
        description: 'Nhận job giao và cập nhật trạng thái đơn.',
        active: ['Shipper', 'Admin'].includes(ctx.currentUser.role),
      },
      {
        icon: 'shield_person',
        title: 'Quản trị',
        description: 'Quản lý người dùng, role và danh mục.',
        active: ctx.currentUser.role === 'Admin',
      },
    ];

    roleCapabilities.innerHTML = `
      <section class="gm-account-surface p-6 md:p-8">
        <div class="gm-account-section-heading">
          <div>
            <p class="text-sm font-black uppercase tracking-[0.24em] text-primary">Vai trò khả dụng</p>
            <h2 class="mt-3 text-3xl font-black text-forest">Quyền theo vai trò</h2>
          </div>
        </div>
        <div class="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
          ${capabilities.map((item) => `
            <article class="gm-account-action-card">
              <span class="gm-account-action-icon material-symbols-outlined">${item.icon}</span>
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="text-lg font-black text-forest">${account.app.escapeHtml(item.title)}</h3>
                  <span class="gm-account-chip ${item.active ? '' : 'opacity-60'}">${item.active ? 'Đang có quyền' : 'Chưa mở quyền'}</span>
                </div>
                <p class="mt-3 text-sm leading-7 text-slate-500">${account.app.escapeHtml(item.description)}</p>
              </div>
            </article>
          `).join('')}
        </div>
      </section>
    `;
  }

  if (roleActions) {
    if (ctx.currentUser.role === 'User') {
      roleActions.innerHTML = `
        <section class="gm-account-surface p-6 md:p-8" id="become-seller">
          <div class="gm-account-split">
            <div>
              <p class="text-sm font-black uppercase tracking-[0.24em] text-primary">Nâng cấp vai trò</p>
              <h2 class="mt-3 text-3xl font-black text-forest">Mở shop ngay từ tài khoản hiện tại</h2>
              <p class="mt-4 text-sm leading-8 text-slate-500">Gửi form để mở quyền Seller và tạo shop đầu tiên.</p>
              <div class="mt-6 gm-account-pill-grid">
                <span class="gm-account-chip">Không đổi layout tổng thể</span>
                <span class="gm-account-chip">Mở role đúng luồng backend</span>
                <span class="gm-account-chip">Liền mạch với Seller page</span>
              </div>
            </div>
            <form id="become-seller-form" class="gm-account-surface-soft p-6 space-y-4">
              <div>
                <label class="mb-2 block text-sm font-semibold text-forest">Tên shop</label>
                <input id="seller-shop-name" class="w-full rounded-xl border border-primary/15 bg-white px-4 py-3 focus:border-primary focus:ring-primary" placeholder="Nông trại của bạn" />
              </div>
              <div>
                <label class="mb-2 block text-sm font-semibold text-forest">Mô tả shop</label>
                <textarea id="seller-shop-description" rows="5" class="w-full rounded-xl border border-primary/15 bg-white px-4 py-3 focus:border-primary focus:ring-primary" placeholder="Giới thiệu vùng trồng, thế mạnh, nhóm sản phẩm chủ lực..."></textarea>
              </div>
              <button type="submit" class="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-white transition hover:bg-forest">
                Gửi đăng ký mở shop
                <span class="material-symbols-outlined text-lg">arrow_forward</span>
              </button>
            </form>
          </div>
        </section>
      `;

      document.getElementById('become-seller-form')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const shopName = document.getElementById('seller-shop-name').value.trim();
        const shopDescription = document.getElementById('seller-shop-description').value.trim();
        if (!shopName) {
          account.app.notify('Vui lòng nhập tên shop.', 'warning');
          return;
        }
        try {
          await account.app.request('/api/auth/become-seller', {
            method: 'POST',
            body: { shopName, shopDescription },
          });
          account.app.notify('Đăng ký trở thành người bán thành công. Vui lòng đăng nhập lại để cập nhật vai trò.', 'success');
          account.app.logout(false);
          window.location.reload();
        } catch (error) {
          account.app.notify(error.message, 'error');
        }
      });
    } else {
      const nextTarget = ctx.currentUser.role === 'Seller' || ctx.currentUser.role === 'Admin'
        ? account.app.buildPageUrl('taikhoan-shop.html')
        : account.app.buildPageUrl('taikhoan-vanchuyen.html');
      const nextLabel = ctx.currentUser.role === 'Seller' || ctx.currentUser.role === 'Admin'
        ? 'Mở trang Shop & sản phẩm'
        : 'Mở trang Vận chuyển';

      roleActions.innerHTML = `
        <section class="gm-account-surface p-6 md:p-8">
          <div class="gm-account-split">
            <div>
              <p class="text-sm font-black uppercase tracking-[0.24em] text-primary">Vai trò đang hoạt động</p>
              <h2 class="mt-3 text-3xl font-black text-forest">Bạn đã có quyền truy cập nâng cao</h2>
              <p class="mt-4 text-sm leading-8 text-slate-500">Vai trò hiện tại đã sẵn sàng, bạn có thể đi thẳng tới đúng màn hình nghiệp vụ.</p>
            </div>
            <div class="gm-account-surface-soft p-6">
              <div class="space-y-4 text-sm leading-7 text-slate-500">
                <p><strong class="text-forest">Seller/Admin:</strong> dùng trang riêng để quản lý shop, sản phẩm, ảnh upload và shop operation summary.</p>
                <p><strong class="text-forest">Shipper/Admin:</strong> dùng trang vận chuyển để nhận giao, xem đơn phụ trách và cập nhật trạng thái giao.</p>
              </div>
              <div class="mt-6 flex flex-wrap gap-3">
                <a href="${nextTarget}" class="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-forest">${nextLabel}</a>
                <a href="${account.app.buildPageUrl('taikhoan-donhang.html')}" class="inline-flex items-center gap-2 rounded-xl border border-primary/15 px-5 py-3 text-sm font-bold text-forest transition hover:bg-earth-beige/60">Mở trang đơn hàng</a>
              </div>
            </div>
          </div>
        </section>
      `;
    }
  }

  if (quickLinks) {
    const quickItems = [
      { href: account.app.buildPageUrl('taikhoan-donhang.html'), title: 'Theo dõi đơn hàng', desc: 'Xem tiến độ đơn' },
      { href: account.app.buildPageUrl('chat.html'), title: 'Tin nhắn', desc: 'Nhắn tin hoặc hỏi AI' },
      { href: account.app.buildPageUrl('bosuutap.html'), title: 'Bộ sưu tập', desc: 'Xem các bộ sưu tập nổi bật' },
    ];

    quickLinks.innerHTML = quickItems.map((item) => `
      <a href="${item.href}" class="gm-account-action-card">
        <span class="gm-account-action-icon material-symbols-outlined">arrow_outward</span>
        <div>
          <h3 class="text-lg font-black text-forest">${account.app.escapeHtml(item.title)}</h3>
          <p class="mt-2 text-sm leading-7 text-slate-500">${account.app.escapeHtml(item.desc)}</p>
        </div>
      </a>
    `).join('');
  }

  if (account.app.getQueryParam('focus') === 'become-seller') {
    document.getElementById('become-seller')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

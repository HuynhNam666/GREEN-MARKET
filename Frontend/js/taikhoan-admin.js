document.addEventListener('DOMContentLoaded', async () => {
  const account = window.GreenMarketAccount;
  if (!account) return;

  const ctx = await account.boot('admin');
  if (!ctx) return;

  const pageContent = document.getElementById('account-page-content');
  if (!account.hasRole(ctx, ['Admin'])) {
    account.renderAccessState(
      pageContent,
      'Khu vực này dành cho quản trị viên',
      'Trang quản trị được tách riêng để bảo toàn tính tập trung cho dashboard, người dùng và danh mục. Chỉ role Admin mới được phép truy cập.',
      `<a href="${account.app.buildPageUrl('taikhoan.html')}" class="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-forest">Quay về tổng quan tài khoản</a>`
    );
    return;
  }

  const dashboardContent = document.getElementById('dashboard-content');
  const categoriesContent = document.getElementById('categories-content');
  const usersContent = document.getElementById('users-content');

  const loadAndRender = async () => {
    await account.loadData(ctx, {
      categories: true,
      adminUsers: true,
      dashboard: true,
    });
    renderDashboard();
    renderCategories();
    renderUsers();
  };

  const resetCategoryForm = () => {
    document.getElementById('category-id').value = '';
    document.getElementById('category-name').value = '';
    document.getElementById('category-description').value = '';
  };

  const bindCategoryActions = () => {
    document.querySelectorAll('[data-action="edit-category"]').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';
      button.addEventListener('click', () => {
        const category = ctx.state.categories.find((item) => Number(item.id) === Number(button.dataset.categoryId));
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
          await account.app.request(`/api/categories/${button.dataset.categoryId}`, { method: 'DELETE' });
          account.app.notify('Đã xóa danh mục.', 'success');
          resetCategoryForm();
          await loadAndRender();
        } catch (error) {
          account.app.notify(error.message, 'error');
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
            await account.app.request(`/api/admin/users/${button.dataset.userId}/${actionMap[action]}`, { method: 'PUT' });
            account.app.notify('Đã cập nhật trạng thái người dùng.', 'success');
            await loadAndRender();
          } catch (error) {
            account.app.notify(error.message, 'error');
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
          await account.app.request(`/api/admin/users/${userId}/role`, {
            method: 'PUT',
            body: { role },
          });
          account.app.notify('Đã cập nhật role người dùng.', 'success');
          await loadAndRender();
        } catch (error) {
          account.app.notify(error.message, 'error');
        }
      });
    });
  };

  const renderDashboard = () => {
    if (!dashboardContent || !ctx.state.dashboard) return;
    const cards = [
      { label: 'Người dùng', value: ctx.state.dashboard.totalUsers },
      { label: 'Người bán', value: ctx.state.dashboard.totalSellers },
      { label: 'Sản phẩm', value: ctx.state.dashboard.totalProducts },
      { label: 'Đơn hàng', value: ctx.state.dashboard.totalOrders },
      { label: 'Doanh thu', value: account.app.formatCurrency(ctx.state.dashboard.totalRevenue), valueClassName: 'text-emerald-700' },
    ];
    dashboardContent.innerHTML = cards.map((card) => account.createKpiCardMarkup(card.label, card.value, 'Tổng hợp toàn hệ thống.', card.valueClassName)).join('');
  };

  const renderCategories = () => {
    if (!categoriesContent) return;
    if (!ctx.state.categories.length) {
      categoriesContent.innerHTML = account.createEmptyStateMarkup(
        'Chưa có danh mục nào',
        'Tạo danh mục mới để seller có thể gắn SKU vào đúng nhóm hàng.',
        ''
      );
      return;
    }

    categoriesContent.innerHTML = ctx.state.categories.map((category) => `
      <article class="gm-account-action-card">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h3 class="text-xl font-black text-forest">${account.app.escapeHtml(category.name)}</h3>
            <p class="mt-2 text-sm leading-7 text-slate-500">${account.app.escapeHtml(category.description || 'Chưa có mô tả')}</p>
          </div>
          <div class="flex flex-col gap-2">
            <button data-action="edit-category" data-category-id="${category.id}" class="rounded-xl border border-primary/15 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/5 transition-colors">Sửa</button>
            <button data-action="delete-category" data-category-id="${category.id}" class="rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors">Xóa</button>
          </div>
        </div>
      </article>
    `).join('');

    bindCategoryActions();
  };

  const renderUsers = () => {
    if (!usersContent) return;
    if (!ctx.state.adminUsers.length) {
      usersContent.innerHTML = account.createEmptyStateMarkup(
        'Chưa có dữ liệu người dùng',
        'Dữ liệu người dùng sẽ xuất hiện tại đây để admin quản trị role, phê duyệt và khóa tài khoản.',
        ''
      );
      return;
    }

    usersContent.innerHTML = `
      <div class="overflow-x-auto">
        <table class="gm-account-table text-sm">
          <thead>
            <tr class="text-left text-slate-500">
              <th class="font-bold">Người dùng</th>
              <th class="font-bold">Vai trò</th>
              <th class="font-bold">Trạng thái</th>
              <th class="font-bold">Ngày tạo</th>
              <th class="font-bold">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${ctx.state.adminUsers.map((user) => `
              <tr>
                <td>
                  <p class="font-black text-forest">${account.app.escapeHtml(user.username)}</p>
                  <p class="mt-1 text-slate-500">${account.app.escapeHtml(user.email)}</p>
                </td>
                <td>
                  <select data-action="user-role-select" data-user-id="${user.id}" class="rounded-xl border border-primary/15 bg-white px-4 py-3 text-sm focus:border-primary focus:ring-primary">
                    ${['User', 'Seller', 'Shipper', 'Admin'].map((role) => `<option value="${role}" ${role === user.role ? 'selected' : ''}>${role}</option>`).join('')}
                  </select>
                </td>
                <td class="text-slate-500">
                  <p>${user.isLocked ? 'Đang bị khóa' : 'Hoạt động'}</p>
                  <p class="mt-1">${user.isApproved ? 'Đã duyệt' : 'Chưa duyệt'}</p>
                </td>
                <td class="text-slate-500">${account.app.formatDate(user.createdAt)}</td>
                <td>
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
      </div>
    `;

    bindUserActions();
  };

  document.getElementById('category-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const categoryId = document.getElementById('category-id').value;
    const name = document.getElementById('category-name').value.trim();
    const description = document.getElementById('category-description').value.trim();
    if (!name) {
      account.app.notify('Vui lòng nhập tên danh mục.', 'warning');
      return;
    }
    try {
      await account.app.request(categoryId ? `/api/categories/${categoryId}` : '/api/categories', {
        method: categoryId ? 'PUT' : 'POST',
        body: { name, description },
      });
      account.app.notify(categoryId ? 'Đã cập nhật danh mục.' : 'Đã tạo danh mục mới.', 'success');
      resetCategoryForm();
      await loadAndRender();
    } catch (error) {
      account.app.notify(error.message, 'error');
    }
  });

  document.getElementById('category-form-reset')?.addEventListener('click', resetCategoryForm);

  await loadAndRender();
});

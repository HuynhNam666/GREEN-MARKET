document.addEventListener('DOMContentLoaded', async () => {
  const app = window.GreenMarketApp;
  const catalog = window.GreenMarketCollections;
  if (!app || !catalog) return;

  const bodySlug = document.body.dataset.collectionSlug || '';
  const pageName = window.location.pathname.split('/').pop() || '';
  const baseCollection = catalog.getCollectionBySlug(bodySlug) || catalog.getCollectionByPage(pageName);
  if (!baseCollection) return;

  const refs = {
    breadcrumb: document.getElementById('collection-breadcrumb-current'),
    campaign: document.getElementById('detail-campaign-label'),
    title: document.getElementById('detail-title'),
    accent: document.getElementById('detail-accent'),
    description: document.getElementById('detail-description'),
    heroImage: document.getElementById('detail-hero-image'),
    serviceTags: document.getElementById('detail-service-tags'),
    audienceTags: document.getElementById('detail-audience-tags'),
    stats: document.getElementById('detail-stats'),
    purchaseGuide: document.getElementById('detail-purchase-guide'),
    commitments: document.getElementById('detail-commitments'),
    featuredProducts: document.getElementById('detail-featured-products'),
    featuredMeta: document.getElementById('detail-featured-meta'),
    relatedCollections: document.getElementById('detail-related-collections'),
    orderLink: document.getElementById('detail-order-link'),
    shopTargets: document.getElementById('detail-shop-targets'),
  };

  const getAudienceLabels = (collection) => (collection.audiences || [])
    .map((key) => (catalog.segments || []).find((segment) => segment.key === key)?.label || key)
    .filter(Boolean);

  const renderHeader = (collection) => {
    document.title = `${collection.name} | AgriFresh`;
    if (refs.breadcrumb) refs.breadcrumb.textContent = collection.name;
    if (refs.campaign) refs.campaign.textContent = collection.campaignLabel;
    if (refs.title) refs.title.textContent = collection.heroTitle;
    if (refs.accent) refs.accent.textContent = collection.heroAccent;
    if (refs.description) refs.description.textContent = collection.description;
    if (refs.heroImage) {
      refs.heroImage.src = collection.heroImage;
      refs.heroImage.alt = collection.name;
    }
    if (refs.serviceTags) {
      refs.serviceTags.innerHTML = (collection.serviceTags || []).map((tag) => `<span class="gm-collection-chip">${app.escapeHtml(tag)}</span>`).join('');
    }
    if (refs.audienceTags) {
      refs.audienceTags.innerHTML = getAudienceLabels(collection).map((label) => `<span class="gm-collection-chip">${app.escapeHtml(label)}</span>`).join('');
    }
    if (refs.shopTargets) {
      const audienceText = getAudienceLabels(collection).join(' • ') || collection.bestFor;
      const shops = collection.shops?.length ? collection.shops.join(' • ') : 'Nhiều shop phù hợp';
      refs.shopTargets.innerHTML = `
        <p class="text-sm font-bold text-forest">Khách mục tiêu: ${app.escapeHtml(audienceText)}</p>
        <p class="mt-2 text-sm leading-7 text-slate-500">Shop đang có hàng cho collection này: ${app.escapeHtml(shops)}.</p>
      `;
    }
    if (refs.orderLink) {
      refs.orderLink.href = app.buildPageUrl('sanpham.html', { keyword: collection.categoryName });
    }
  };

  const renderStats = (collection) => {
    if (!refs.stats) return;
    const priceRange = collection.priceFrom
      ? `${catalog.formatCurrency(collection.priceFrom)}${collection.priceTo && collection.priceTo !== collection.priceFrom ? ` - ${catalog.formatCurrency(collection.priceTo)}` : ''}`
      : 'Đang cập nhật';
    const stats = [
      { label: 'Sản phẩm hiện có', value: String(collection.productCount || 0), hint: 'Số SKU đang sẵn sàng cho collection này.' },
      { label: 'Mức giá', value: priceRange, hint: 'Giúp khách chọn nhanh theo ngân sách.' },
      { label: 'Đối tượng phù hợp', value: collection.bestFor, hint: 'Nhóm khách hàng nên thấy bộ sưu tập này đầu tiên.' },
      { label: 'Nhịp mua lại', value: collection.purchaseRhythm, hint: 'Gợi ý kích hoạt CRM và nhắc mua lại.' },
    ];

    refs.stats.innerHTML = stats.map((item) => `
      <article class="gm-collection-stat-card">
        <p class="text-[11px] font-black uppercase tracking-[0.26em] text-primary/70">${app.escapeHtml(item.label)}</p>
        <p class="mt-3 text-xl font-black text-forest">${app.escapeHtml(item.value)}</p>
        <p class="mt-3 text-sm leading-7 text-slate-500">${app.escapeHtml(item.hint)}</p>
      </article>
    `).join('');
  };

  const renderPurchaseGuide = (collection) => {
    if (!refs.purchaseGuide) return;
    refs.purchaseGuide.innerHTML = `
      <div class="grid gap-4 md:grid-cols-3">
        ${(collection.buyingGuide || []).map((item, index) => `
          <article class="gm-section-surface p-6">
            <div class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-black text-white">${index + 1}</div>
            <p class="mt-4 text-base font-bold text-forest">${app.escapeHtml(item)}</p>
            <p class="mt-3 text-sm leading-7 text-slate-500">${index === 0 ? 'Tập trung vào insight chính giúp khách ra quyết định nhanh hơn.' : index === 1 ? 'Dùng combo hoặc cross-sell để tăng giá trị đơn mà không rối layout.' : 'Đưa tín hiệu dịch vụ và tái mua để giữ doanh thu lặp lại.'}</p>
          </article>
        `).join('')}
      </div>
    `;
  };

  const renderCommitments = (collection) => {
    if (!refs.commitments) return;
    refs.commitments.innerHTML = `
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        ${(collection.commitments || []).map((item) => `
          <article class="gm-section-surface p-6">
            <p class="text-[11px] font-black uppercase tracking-[0.26em] text-primary/70">Cam kết vận hành</p>
            <p class="mt-3 text-base font-bold text-forest">${app.escapeHtml(item)}</p>
            <p class="mt-3 text-sm leading-7 text-slate-500">${app.escapeHtml(collection.deliveryText)}</p>
          </article>
        `).join('')}
      </div>
    `;
  };

  const renderFeaturedProducts = (collection) => {
    if (refs.featuredMeta) {
      refs.featuredMeta.innerHTML = `
        <span class="gm-collection-chip">${app.escapeHtml(collection.bundleHint)}</span>
        <span class="gm-collection-chip">${app.escapeHtml(collection.deliveryText)}</span>
      `;
    }

    if (!refs.featuredProducts) return;
    if (!collection.featuredProducts?.length) {
      refs.featuredProducts.innerHTML = `
        <div class="rounded-[28px] border border-dashed border-primary/20 bg-background-light px-6 py-12 text-center text-slate-500">
          Chưa có sản phẩm đồng bộ cho bộ sưu tập này.
        </div>
      `;
      return;
    }

    refs.featuredProducts.innerHTML = collection.featuredProducts.map((product) => app.createProductCard(product, { showChat: true })).join('');
    app.bindProductCardActions(refs.featuredProducts);

    const firstProduct = collection.featuredProducts[0];
    if (firstProduct) {
      app.setAssistantContext({
        productId: firstProduct.id,
        shopId: firstProduct.shopId,
        shopName: firstProduct.shopName,
      }, { refresh: true });
    }

  };

  const renderRelatedCollections = (collection, enrichedCollections) => {
    if (!refs.relatedCollections) return;
    const relatedCollections = catalog.getRelatedCollections(collection, enrichedCollections);
    if (!relatedCollections.length) {
      refs.relatedCollections.innerHTML = '';
      return;
    }

    refs.relatedCollections.innerHTML = relatedCollections.map((item) => `
      <article class="gm-section-surface overflow-hidden">
        <a href="../page/${item.page}" class="grid h-full gap-0 md:grid-cols-[180px_1fr]">
          <div class="gm-collection-media min-h-[180px]">
            <img src="${item.heroImage}" alt="${app.escapeHtml(item.name)}" class="h-full w-full object-cover" />
          </div>
          <div class="p-6">
            <span class="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-primary">${app.escapeHtml(item.campaignLabel)}</span>
            <h3 class="mt-4 text-xl font-black text-forest">${app.escapeHtml(item.name)}</h3>
            <p class="mt-3 text-sm leading-7 text-slate-500">${app.escapeHtml(item.bundleHint)}</p>
            <div class="mt-4 flex flex-wrap gap-2">
              ${(item.serviceTags || []).slice(0, 2).map((tag) => `<span class="gm-collection-chip">${app.escapeHtml(tag)}</span>`).join('')}
            </div>
          </div>
        </a>
      </article>
    `).join('');
  };

  try {
    await app.bootstrapPage();
    const products = await app.request('/api/products', { auth: false });
    const enrichedCollections = catalog.enrichCollections(Array.isArray(products) ? products : []);
    const collection = enrichedCollections.find((item) => item.slug === baseCollection.slug) || baseCollection;

    renderHeader(collection);
    renderStats(collection);
    renderPurchaseGuide(collection);
    renderCommitments(collection);
    renderFeaturedProducts(collection);
    renderRelatedCollections(collection, enrichedCollections);
  } catch (error) {
    console.warn(error);
    if (refs.featuredProducts) {
      refs.featuredProducts.innerHTML = `
        <div class="rounded-[28px] border border-dashed border-rose-200 bg-white px-6 py-12 text-center text-rose-500">
          Không tải được dữ liệu collection từ backend. Hãy kiểm tra API rồi tải lại trang.
        </div>
      `;
    }
  }
});

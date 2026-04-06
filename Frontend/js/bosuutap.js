document.addEventListener('DOMContentLoaded', async () => {
  const app = window.GreenMarketApp;
  const catalog = window.GreenMarketCollections;
  if (!app || !catalog) return;

  const grid = document.getElementById('collection-grid');
  const segmentContainer = document.getElementById('collection-segments');
  const filterContainer = document.getElementById('collection-filters');
  const showcaseTitle = document.getElementById('collection-showcase-title');
  const showcaseSubtitle = document.getElementById('collection-showcase-subtitle');
  const showcaseProducts = document.getElementById('collection-showcase-products');
  const showcaseGuide = document.getElementById('collection-showcase-guide');
  const showcaseMeta = document.getElementById('collection-showcase-meta');
  const collectionCount = document.getElementById('collection-count');
  const productCount = document.getElementById('collection-product-count');
  const lowPrice = document.getElementById('collection-low-price');
  const segmentCaption = document.getElementById('segment-caption');

  let products = [];
  let enrichedCollections = catalog.enrichCollections([]);
  let activeSegment = app.getQueryParam('segment') || 'all';
  let activeCollectionSlug = app.getQueryParam('collection') || '';

  const getVisibleCollections = () => enrichedCollections.filter((item) => {
    const matchesSegment = activeSegment === 'all' || item.audiences.includes(activeSegment);
    const matchesCollection = !activeCollectionSlug || item.slug === activeCollectionSlug;
    return matchesSegment && matchesCollection;
  });

  const updateHeroStats = () => {
    const visibleCollections = getVisibleCollections();
    const visibleProducts = visibleCollections.flatMap((item) => item.featuredProducts.length ? item.featuredProducts : []);
    const allVisibleProducts = enrichedCollections
      .filter((item) => activeSegment === 'all' || item.audiences.includes(activeSegment))
      .flatMap((item) => item.featuredProducts);

    if (collectionCount) {
      collectionCount.textContent = String(visibleCollections.length || enrichedCollections.length);
    }

    if (productCount) {
      productCount.textContent = String(
        enrichedCollections
          .filter((item) => activeSegment === 'all' || item.audiences.includes(activeSegment))
          .reduce((sum, item) => sum + Number(item.productCount || 0), 0)
      );
    }

    const priceCandidates = enrichedCollections
      .filter((item) => activeSegment === 'all' || item.audiences.includes(activeSegment))
      .map((item) => Number(item.priceFrom || 0))
      .filter((value) => value > 0);
    if (lowPrice) {
      lowPrice.textContent = priceCandidates.length ? catalog.formatCurrency(Math.min(...priceCandidates)) : '0đ';
    }

    if (segmentCaption) {
      const segment = catalog.segments.find((item) => item.key === activeSegment) || catalog.segments[0];
      segmentCaption.textContent = segment.description;
    }
  };

  const renderSegments = () => {
    if (!segmentContainer) return;
    segmentContainer.innerHTML = catalog.segments.map((segment) => `
      <button
        type="button"
        class="rounded-full border px-4 py-2 text-sm font-semibold transition-all ${segment.key === activeSegment ? 'border-primary bg-primary text-white shadow-lg shadow-primary/15' : 'border-primary/10 bg-white text-forest hover:border-primary/30 hover:bg-primary/5'}"
        data-segment-key="${segment.key}"
      >${app.escapeHtml(segment.label)}</button>
    `).join('');

    segmentContainer.querySelectorAll('[data-segment-key]').forEach((button) => {
      button.addEventListener('click', () => {
        activeSegment = button.dataset.segmentKey || 'all';
        if (activeCollectionSlug) {
          const current = enrichedCollections.find((item) => item.slug === activeCollectionSlug);
          if (current && !current.audiences.includes(activeSegment) && activeSegment !== 'all') {
            activeCollectionSlug = '';
          }
        }
        app.setQueryParam('segment', activeSegment === 'all' ? '' : activeSegment);
        app.setQueryParam('collection', activeCollectionSlug || '');
        renderAll();
      });
    });
  };

  const renderCollectionFilters = () => {
    if (!filterContainer) return;
    const visibleCollections = enrichedCollections.filter((item) => activeSegment === 'all' || item.audiences.includes(activeSegment));
    filterContainer.innerHTML = [`
      <button
        type="button"
        class="rounded-full border px-4 py-2 text-sm font-semibold transition-all ${!activeCollectionSlug ? 'border-primary bg-primary text-white shadow-lg shadow-primary/15' : 'border-primary/10 bg-white text-forest hover:border-primary/30 hover:bg-primary/5'}"
        data-collection-slug=""
      >Tất cả bộ sưu tập</button>
    `, ...visibleCollections.map((item) => `
      <button
        type="button"
        class="rounded-full border px-4 py-2 text-sm font-semibold transition-all ${item.slug === activeCollectionSlug ? 'border-primary bg-primary text-white shadow-lg shadow-primary/15' : 'border-primary/10 bg-white text-forest hover:border-primary/30 hover:bg-primary/5'}"
        data-collection-slug="${item.slug}"
      >${app.escapeHtml(item.name)}</button>
    `)].join('');

    filterContainer.querySelectorAll('[data-collection-slug]').forEach((button) => {
      button.addEventListener('click', () => {
        activeCollectionSlug = button.dataset.collectionSlug || '';
        app.setQueryParam('collection', activeCollectionSlug || '');
        renderAll();
      });
    });
  };

  const createCollectionCard = (collection, index) => {
    const cardSizes = [
      'col-span-12 md:col-span-7 min-h-[460px]',
      'col-span-12 md:col-span-5 min-h-[460px]',
      'col-span-12 md:col-span-4 min-h-[360px]',
      'col-span-12 md:col-span-4 min-h-[360px]',
      'col-span-12 md:col-span-4 min-h-[360px]',
    ];
    const sizeClass = cardSizes[index] || 'col-span-12 md:col-span-6 min-h-[360px]';
    const productCountText = collection.productCount ? `${collection.productCount} sản phẩm` : 'Đang đồng bộ sản phẩm';
    const priceText = collection.priceFrom ? `Từ ${catalog.formatCurrency(collection.priceFrom)}` : 'Đang cập nhật giá';
    const productPreview = collection.featuredProducts.slice(0, 2).map((product) => `
      <span class="inline-flex items-center rounded-full bg-white/14 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur">${app.escapeHtml(product.name)}</span>
    `).join('');

    return `
      <article class="collection-card gm-collection-card ${sizeClass}">
        <a href="../page/${collection.page}" class="block h-full">
          <div class="gm-collection-media absolute inset-0">
            <img src="${collection.heroImage}" alt="${app.escapeHtml(collection.name)}" class="h-full w-full object-cover" />
            <div class="absolute inset-0 bg-gradient-to-t from-background-dark/90 via-background-dark/25 to-transparent"></div>
          </div>
          <div class="relative flex h-full flex-col justify-between p-8 md:p-10">
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-full bg-primary px-4 py-1 text-[11px] font-bold uppercase tracking-[0.28em] text-white">${app.escapeHtml(collection.campaignLabel)}</span>
              <span class="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur">${app.escapeHtml(productCountText)}</span>
            </div>
            <div>
              <h3 class="max-w-xl text-3xl font-black text-white md:text-4xl">${app.escapeHtml(collection.heroTitle)}</h3>
              <p class="mt-2 max-w-xl text-lg font-semibold text-primary">${app.escapeHtml(collection.heroAccent)}</p>
              <p class="mt-4 max-w-2xl text-sm leading-7 text-slate-200 md:text-base">${app.escapeHtml(collection.description)}</p>
              <div class="mt-5 flex flex-wrap gap-2">${productPreview}</div>
              <div class="mt-6 grid gap-3 text-sm text-white/90 md:grid-cols-2">
                <div class="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
                  <p class="text-[11px] uppercase tracking-[0.22em] text-white/60">Nhịp mua phù hợp</p>
                  <p class="mt-1 font-semibold">${app.escapeHtml(collection.purchaseRhythm)}</p>
                </div>
                <div class="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
                  <p class="text-[11px] uppercase tracking-[0.22em] text-white/60">Giá mở đầu</p>
                  <p class="mt-1 font-semibold">${app.escapeHtml(priceText)}</p>
                </div>
              </div>
              <div class="mt-6 flex flex-wrap gap-2 text-xs text-white/80">
                ${(collection.serviceTags || []).slice(0, 3).map((tag) => `<span class="rounded-full border border-white/20 px-3 py-1 backdrop-blur">${app.escapeHtml(tag)}</span>`).join('')}
              </div>
            </div>
          </div>
        </a>
      </article>
    `;
  };

  const renderGrid = () => {
    if (!grid) return;
    const visibleCollections = getVisibleCollections();
    if (!visibleCollections.length) {
      grid.innerHTML = `
        <div class="col-span-full rounded-[28px] border border-dashed border-primary/20 bg-white px-6 py-12 text-center text-slate-500">
          Không có bộ sưu tập phù hợp với bộ lọc hiện tại.
        </div>
      `;
      return;
    }

    grid.innerHTML = visibleCollections.map(createCollectionCard).join('');
  };

  const renderShowcase = () => {
    const visibleCollections = getVisibleCollections();
    const showcaseCollection = visibleCollections[0] || enrichedCollections[0];
    if (!showcaseCollection) return;

    if (showcaseTitle) {
      showcaseTitle.textContent = `${showcaseCollection.name} nên bán như thế nào?`;
    }
    if (showcaseSubtitle) {
      showcaseSubtitle.textContent = showcaseCollection.bundleHint;
    }
    if (showcaseMeta) {
      showcaseMeta.innerHTML = `
        <span class="gm-collection-chip">Phù hợp: ${app.escapeHtml(showcaseCollection.bestFor)}</span>
        <span class="gm-collection-chip">Giao hàng: ${app.escapeHtml(showcaseCollection.deliveryText)}</span>
      `;
    }
    if (showcaseGuide) {
      showcaseGuide.innerHTML = `
        <div class="grid gap-4 md:grid-cols-3">
          ${(showcaseCollection.buyingGuide || []).map((item, index) => `
            <article class="gm-collection-stat-card">
              <p class="text-[11px] font-black uppercase tracking-[0.26em] text-primary/70">Bước ${index + 1}</p>
              <p class="mt-3 text-sm font-semibold leading-7 text-forest">${app.escapeHtml(item)}</p>
            </article>
          `).join('')}
        </div>
      `;
    }

    if (!showcaseProducts) return;
    const featuredProducts = showcaseCollection.featuredProducts || [];
    if (!featuredProducts.length) {
      showcaseProducts.innerHTML = `
        <div class="rounded-[24px] border border-dashed border-primary/20 bg-background-light px-6 py-10 text-center text-slate-500">
          Dữ liệu sản phẩm của bộ sưu tập này sẽ hiển thị khi backend sẵn sàng.
        </div>
      `;
      return;
    }

    showcaseProducts.innerHTML = featuredProducts.slice(0, 3).map((product) => app.createProductCard(product, { showChat: true })).join('');
    app.bindProductCardActions(showcaseProducts);

    const firstProduct = featuredProducts[0];
    if (firstProduct) {
      app.setAssistantContext({
        productId: firstProduct.id,
        shopId: firstProduct.shopId,
        shopName: firstProduct.shopName,
      }, { refresh: true });
    }
  };

  const renderAll = () => {
    renderSegments();
    renderCollectionFilters();
    updateHeroStats();
    renderGrid();
    renderShowcase();
  };

  try {
    await app.bootstrapPage();
    products = await app.request('/api/products', { auth: false });
    enrichedCollections = catalog.enrichCollections(Array.isArray(products) ? products : []);
    if (activeCollectionSlug && !enrichedCollections.some((item) => item.slug === activeCollectionSlug)) {
      activeCollectionSlug = '';
    }
    if (activeSegment !== 'all' && !catalog.segments.some((item) => item.key === activeSegment)) {
      activeSegment = 'all';
    }
    renderAll();
  } catch (error) {
    console.warn(error);
    if (grid) {
      grid.innerHTML = `
        <div class="col-span-full rounded-[28px] border border-dashed border-rose-200 bg-white px-6 py-12 text-center text-rose-500">
          Không tải được dữ liệu bộ sưu tập. Hãy kiểm tra backend API rồi tải lại trang.
        </div>
      `;
    }
  }
});

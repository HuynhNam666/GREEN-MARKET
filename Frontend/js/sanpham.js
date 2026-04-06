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

if (window.GreenMarketApp) {
  window.GreenMarketApp.initCatalogPage({
    containerSelector: '.product-grid',
    filterButtonSelector: '.filter-btn',
    priceRangeSelector: '#priceRange',
    priceValueSelector: '#priceValue',
    sortOptionSelector: '.sort-option',
    sortButtonSelector: '#sortBtn',
    sortMenuSelector: '#sortMenu',
    sortTextSelector: '#sortText',
    resetButtonSelector: '#resetFilter',
    defaultFilter: 'all',
    defaultSort: 'new',
    emptyTitle: 'Chưa tìm thấy sản phẩm phù hợp',
    emptyDescription: 'Hãy đổi từ khóa, bộ lọc hoặc thêm sản phẩm mới từ backend.',
  });
}

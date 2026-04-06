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
    categoryName: 'Rau Củ Hữu Cơ',
    fallbackKeywords: ['rau', 'củ', 'hữu cơ', 'organic'],
    filterButtonSelector: '.veg-filter',
    priceRangeSelector: '#priceRange',
    priceValueSelector: '#priceValue',
    sortOptionSelector: '.sort-option',
    defaultFilter: 'all',
    defaultSort: 'new',
    emptyTitle: 'Danh mục này chưa có sản phẩm phù hợp',
    emptyDescription: 'Bạn có thể thêm dữ liệu từ backend hoặc quay lại trang sản phẩm tổng hợp.',
  });
}

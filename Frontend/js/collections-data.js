(function (window) {
  const COLLECTIONS = [
    {
      slug: 'rau-cu-huu-co',
      page: 'raucuhuuco.html',
      categoryName: 'Rau Củ Hữu Cơ',
      name: 'Rau củ hữu cơ',
      shortName: 'Rau sạch mỗi ngày',
      heroTitle: 'Rau củ hữu cơ',
      heroAccent: 'tươi trong ngày',
      description: 'Danh mục dành cho bữa ăn hằng ngày, ưu tiên độ tươi, truy xuất nguồn gốc rõ ràng và vòng quay hàng nhanh.',
      heroImage: '../img/rancu.png',
      campaignLabel: 'Đi chợ sạch mỗi ngày',
      bestFor: 'Gia đình nhỏ, khách eat-clean, bếp văn phòng',
      deliveryText: 'Ưu tiên giao nội thành trong ngày và nhắc đổi lô mới khi tồn giảm.',
      purchaseRhythm: '2-3 lần/tuần',
      bundleHint: 'Gom salad + rau nấu canh + gia vị tươi để tăng AOV tự nhiên.',
      serviceTags: ['Giao trong ngày', 'Đơn tươi xoay vòng', 'Nhắc mua định kỳ'],
      audiences: ['gia-dinh', 'eat-clean', 'tien-loi'],
      commitments: ['Thu hoạch gần ngày giao', 'Kiểm soát tồn theo lô', 'Ưu tiên đóng gói thoáng khí'],
      buyingGuide: ['Ưu tiên gói 2-3 món dùng trong 48h', 'Cross-sell với trái cây hoặc combo bữa tối', 'Đẩy voucher freeship cho đơn trên 149k'],
      related: ['trai-cay-mua-vu', 'combo-nong-san-gia-dinh'],
    },
    {
      slug: 'trai-cay-mua-vu',
      page: 'traicaymuavu.html',
      categoryName: 'Trái Cây Mùa Vụ',
      name: 'Trái cây mùa vụ',
      shortName: 'Vitamin theo mùa',
      heroTitle: 'Trái cây mùa vụ',
      heroAccent: 'ngọt đúng thời điểm',
      description: 'Tập trung vào câu chuyện mùa vụ, độ chín, độ ngọt và gói giao biếu hoặc ăn gia đình.',
      heroImage: '../img/traicay.png',
      campaignLabel: 'Ngon theo mùa',
      bestFor: 'Gia đình, văn phòng, khách mua biếu nhanh',
      deliveryText: 'Gợi ý chín ăn ngay hoặc chín dần để giảm hoàn hàng.',
      purchaseRhythm: '1-2 lần/tuần',
      bundleHint: 'Bán theo set 2-3 loại trái cây để tăng giá trị đơn và giảm phí giao.',
      serviceTags: ['Theo mùa thật', 'Tư vấn độ chín', 'Phù hợp biếu nhanh'],
      audiences: ['gia-dinh', 'eat-clean', 'bieu-tang'],
      commitments: ['Tư vấn độ chín trước giao', 'Phân nhóm ăn ngay / trữ 2-3 ngày', 'Ưu tiên bảo vệ bề mặt trái'],
      buyingGuide: ['Dùng badge “mùa này bán tốt”', 'Combo trái cây + mật ong cho set wellness', 'Đề xuất lịch giao định kỳ cho văn phòng'],
      related: ['mat-ong-san-pham-tu-nhien', 'qua-tang-khach-hang'],
    },
    {
      slug: 'ngu-coc-hat-dinh-duong',
      page: 'ngucochat.html',
      categoryName: 'Ngũ Cốc Hạt',
      name: 'Ngũ cốc & hạt dinh dưỡng',
      shortName: 'Năng lượng bền vững',
      heroTitle: 'Ngũ cốc và hạt dinh dưỡng',
      heroAccent: 'cho bữa sáng hiệu quả',
      description: 'Nhóm bán tốt cho khách hàng quan tâm sức khỏe, bữa sáng nhanh, gói mua theo tuần và quà tặng wellness.',
      heroImage: '../img/ngucoc.png',
      campaignLabel: 'Bữa sáng thông minh',
      bestFor: 'Dân văn phòng, người tập luyện, mẹ và bé',
      deliveryText: 'Ưu tiên combo nhiều SKU, bảo quản khô và tái mua định kỳ.',
      purchaseRhythm: '7-14 ngày/lần',
      bundleHint: 'Bundle yến mạch + hạt điều + mật ong để tạo set breakfast margin tốt.',
      serviceTags: ['Bán theo set', 'Bảo quản khô', 'Tái mua định kỳ'],
      audiences: ['bua-sang', 'eat-clean', 'tien-loi'],
      commitments: ['Ưu tiên lô hạn dùng dài', 'Gợi ý set 7 ngày / 14 ngày', 'Mô tả rõ khẩu phần mỗi gói'],
      buyingGuide: ['Thiết kế combo giá 169k-229k', 'Gắn quick benefit cho từng SKU', 'Tạo gợi ý dùng cùng sữa chua / trái cây'],
      related: ['sua-trung-trang-trai', 'mat-ong-san-pham-tu-nhien'],
    },
    {
      slug: 'mat-ong-san-pham-tu-nhien',
      page: 'sanphamtunhien.html',
      categoryName: 'Sản Phẩm Từ Thiên Nhiên',
      name: 'Mật ong & sản phẩm tự nhiên',
      shortName: 'Wellness mỗi ngày',
      heroTitle: 'Mật ong và sản phẩm tự nhiên',
      heroAccent: 'tăng giá trị mỗi đơn',
      description: 'Danh mục lợi nhuận tốt để cross-sell với trái cây, ngũ cốc, quà tặng và các kịch bản chăm sóc sức khỏe.',
      heroImage: '../img/matongdaklak.png',
      campaignLabel: 'Wellness box',
      bestFor: 'Khách chăm sức khỏe, quà biếu, khách tái mua',
      deliveryText: 'Sản phẩm ổn định, dễ gói quà và phù hợp upsell ở checkout.',
      purchaseRhythm: '2-4 tuần/lần',
      bundleHint: 'Upsell ở sản phẩm giỏ quà, combo bữa sáng, set trái cây chăm sóc sức khỏe.',
      serviceTags: ['Upsell lợi nhuận tốt', 'Phù hợp gói quà', 'Dễ tái mua'],
      audiences: ['bua-sang', 'bieu-tang', 'doanh-nghiep'],
      commitments: ['Mô tả rõ nguồn hoa / vùng nuôi', 'Tư vấn liều dùng cơ bản', 'Đóng gói chống tràn khi giao'],
      buyingGuide: ['Đặt trong module “thêm để hoàn thiện set”', 'Ưu tiên combo 2 chai cho quà biếu', 'Nhắc mua lại sau 21 ngày'],
      related: ['trai-cay-mua-vu', 'qua-tang-khach-hang'],
    },
    {
      slug: 'sua-trung-trang-trai',
      page: 'suatrung.html',
      categoryName: 'Sữa Trứng',
      name: 'Sữa & trứng trang trại sạch',
      shortName: 'Bữa sáng đủ chất',
      heroTitle: 'Sữa và trứng trang trại',
      heroAccent: 'dễ chốt đơn hằng tuần',
      description: 'Nhóm sản phẩm cần nhấn mạnh chuỗi lạnh, độ tươi và kịch bản mua định kỳ cho gia đình.',
      heroImage: '../img/trung.png',
      campaignLabel: 'Đủ chất cả tuần',
      bestFor: 'Gia đình có trẻ nhỏ, khách mua bữa sáng, khách hàng định kỳ',
      deliveryText: 'Hiển thị rõ nhịp giao lạnh, khung giờ phù hợp và số lượng khuyến nghị cho tuần.',
      purchaseRhythm: '3-7 ngày/lần',
      bundleHint: 'Đề xuất combo sữa + trứng + ngũ cốc để tăng độ hoàn chỉnh của giỏ hàng.',
      serviceTags: ['Chuỗi lạnh', 'Khuyến nghị định kỳ', 'Giao cẩn thận'],
      audiences: ['gia-dinh', 'bua-sang', 'tien-loi'],
      commitments: ['Giữ lạnh khi vận chuyển', 'Thông báo hạn dùng rõ', 'Ưu tiên khung giờ sáng / chiều mát'],
      buyingGuide: ['Dùng combo tuần 179k+', 'Cross-sell với ngũ cốc và trái cây', 'Nhắc tái mua theo chu kỳ 3 ngày'],
      related: ['ngu-coc-hat-dinh-duong', 'combo-nong-san-gia-dinh'],
    },
    {
      slug: 'thuc-pham-che-bien-huu-co',
      page: 'thucphamchebien.html',
      categoryName: 'Thực Phẩm Chế Biến',
      name: 'Thực phẩm chế biến hữu cơ',
      shortName: 'Tiện lợi nhưng vẫn sạch',
      heroTitle: 'Thực phẩm chế biến hữu cơ',
      heroAccent: 'cho nhịp sống bận rộn',
      description: 'Danh mục dành cho khách cần tốc độ ra quyết định nhanh, ưu tiên tiện lợi, dễ bảo quản và đơn giá vừa phải.',
      heroImage: '../img/banner.png',
      campaignLabel: 'Nhanh gọn mỗi ngày',
      bestFor: 'Dân văn phòng, sinh viên, gia đình bận rộn',
      deliveryText: 'Mô tả rõ thời gian bảo quản, cách dùng và khối lượng phù hợp 1-2 người.',
      purchaseRhythm: '7 ngày/lần',
      bundleHint: 'Bán theo combo snack + cháo ăn liền + trái cây sấy để tăng số món trên đơn.',
      serviceTags: ['Tiện lợi', 'Đọc nhanh là hiểu', 'Dễ mua lặp lại'],
      audiences: ['tien-loi', 'bua-sang'],
      commitments: ['Hiển thị hạn dùng rõ', 'Ưu tiên set thử 2-3 SKU', 'Mô tả nhanh cách sử dụng'],
      buyingGuide: ['Dùng card “ăn liền / văn phòng”', 'Tạo combo 99k - 149k', 'Đặt tại khu vực gợi ý mua thêm trong giỏ'],
      related: ['ngu-coc-hat-dinh-duong', 'combo-nong-san-gia-dinh'],
    },
    {
      slug: 'tinh-hoa-dac-san-viet',
      page: 'dacsan.html',
      categoryName: 'Đặc Sản Vùng Miền',
      name: 'Tinh hoa đặc sản Việt',
      shortName: 'Bản sắc vùng miền',
      heroTitle: 'Tinh hoa đặc sản Việt',
      heroAccent: 'đậm câu chuyện xuất xứ',
      description: 'Danh mục tăng giá trị nhờ storytelling, vùng nguyên liệu, truyền thống địa phương và kịch bản quà biếu.',
      heroImage: '../img/farmer.png',
      campaignLabel: 'Quà mang bản sắc',
      bestFor: 'Khách biếu tặng, khách thích trải nghiệm địa phương',
      deliveryText: 'Nên gắn câu chuyện vùng miền, độ hiếm và gợi ý quà biếu trọn bộ.',
      purchaseRhythm: 'Theo dịp / chiến dịch',
      bundleHint: 'Ghép trà + đặc sản mặn + mật ong để tạo set biếu linh hoạt theo ngân sách.',
      serviceTags: ['Storytelling mạnh', 'Phù hợp quà biếu', 'Theo chiến dịch lễ'],
      audiences: ['bieu-tang', 'doanh-nghiep'],
      commitments: ['Mô tả rõ nguồn gốc vùng miền', 'Thiết kế gói quà dễ chọn ngân sách', 'Đề xuất thông điệp biếu tặng'],
      buyingGuide: ['Nhấn mạnh nguồn gốc', 'Dùng badge “biếu đối tác / gia đình”', 'Cross-sell với quà tặng khách hàng'],
      related: ['qua-tang-khach-hang', 'mat-ong-san-pham-tu-nhien'],
    },
    {
      slug: 'combo-nong-san-gia-dinh',
      page: 'combo.html',
      categoryName: 'Combo',
      name: 'Combo nông sản gia đình',
      shortName: 'Giải pháp đi chợ trọn gói',
      heroTitle: 'Combo nông sản gia đình',
      heroAccent: 'tăng AOV không cần đổi layout',
      description: 'Combo là lớp nghiệp vụ quan trọng giúp đẩy giá trị đơn, giảm thời gian chọn hàng và tăng tỷ lệ thanh toán thành công.',
      heroImage: '../img/banner.png',
      campaignLabel: 'Trọn bữa - trọn đơn',
      bestFor: 'Gia đình nhỏ, khách mới, đơn đặt theo tuần',
      deliveryText: 'Phù hợp hiển thị giá lợi hơn mua lẻ, số bữa phục vụ và tần suất tái mua.',
      purchaseRhythm: '7 ngày/lần',
      bundleHint: 'Hiển thị rõ “phù hợp 3-4 bữa” để khách chốt nhanh.',
      serviceTags: ['Đẩy AOV', 'Mua nhanh', 'Dễ tái mua'],
      audiences: ['gia-dinh', 'tien-loi'],
      commitments: ['So sánh lợi hơn mua lẻ', 'Gợi ý số người / số bữa', 'Tối ưu freeship và voucher'],
      buyingGuide: ['Đặt ở trang chủ và bộ sưu tập', 'Ưu tiên combo 149k / 199k / 299k', 'Liên kết trực tiếp giỏ hàng'],
      related: ['rau-cu-huu-co', 'sua-trung-trang-trai'],
    },
    {
      slug: 'qua-tang-khach-hang',
      page: 'quatang.html',
      categoryName: 'Quà Tặng',
      name: 'Quà tặng khách hàng',
      shortName: 'Gói quà theo ngân sách',
      heroTitle: 'Quà tặng khách hàng',
      heroAccent: 'đẹp, dễ chọn, dễ chốt',
      description: 'Bộ sưu tập phục vụ khách mua biếu, doanh nghiệp, dịp lễ và chiến dịch tri ân với ngân sách linh hoạt.',
      heroImage: '../img/banner.png',
      campaignLabel: 'Tri ân chỉn chu',
      bestFor: 'Khách doanh nghiệp, lễ Tết, quà gia đình',
      deliveryText: 'Cần nêu rõ ngân sách, thông điệp tặng quà và khả năng gói nhiều địa chỉ.',
      purchaseRhythm: 'Theo dịp',
      bundleHint: 'Chia rõ set 299k / 399k / 499k để rút ngắn quyết định mua.',
      serviceTags: ['Theo ngân sách', 'Dễ gói quà', 'Cho dịp lễ / doanh nghiệp'],
      audiences: ['bieu-tang', 'doanh-nghiep'],
      commitments: ['Phân tầng ngân sách rõ', 'Có note người nhận / dịp tặng', 'Ưu tiên đóng gói đẹp'],
      buyingGuide: ['Nhấn vào nhu cầu “biếu đối tác / người thân”', 'Upsell đặc sản và mật ong', 'Cho phép đặt nhiều hộp cùng đơn'],
      related: ['tinh-hoa-dac-san-viet', 'mat-ong-san-pham-tu-nhien'],
    },
  ];

  const SEGMENTS = [
    { key: 'all', label: 'Tất cả nhu cầu', description: 'Toàn bộ bộ sưu tập đang hoạt động.' },
    { key: 'gia-dinh', label: 'Gia đình', description: 'Đi chợ hằng tuần, ưu tiên sản phẩm dễ dùng và dễ tái mua.' },
    { key: 'eat-clean', label: 'Eat clean', description: 'Khách hàng quan tâm dinh dưỡng, sản phẩm sạch và minh bạch.' },
    { key: 'bua-sang', label: 'Bữa sáng', description: 'Nhịp mua nhanh, combo gọn và dùng lặp lại mỗi tuần.' },
    { key: 'tien-loi', label: 'Tiện lợi', description: 'Sản phẩm dễ hiểu, chốt nhanh và phù hợp nhịp sống bận rộn.' },
    { key: 'bieu-tang', label: 'Biếu tặng', description: 'Có câu chuyện, ngân sách rõ và gợi ý set quà hoàn chỉnh.' },
    { key: 'doanh-nghiep', label: 'Doanh nghiệp', description: 'Hộp quà, đơn số lượng, mua theo chiến dịch hoặc dịp lễ.' },
  ];

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const formatCurrency = (value) => Number(value || 0).toLocaleString('vi-VN') + 'đ';

  const getCollectionBySlug = (slug) => COLLECTIONS.find((item) => item.slug === slug) || null;
  const getCollectionByPage = (page) => COLLECTIONS.find((item) => item.page === page) || null;

  const enrichCollections = (products) => COLLECTIONS.map((collection) => {
    const items = (products || []).filter((product) => normalize(product.categoryName) === normalize(collection.categoryName));
    const prices = items.map((item) => Number(item.price || 0)).filter((value) => value > 0);
    const stocks = items.map((item) => Number(item.stock || 0)).filter((value) => value >= 0);
    const featuredProducts = [...items]
      .sort((left, right) => Number(right.stock || 0) - Number(left.stock || 0))
      .slice(0, 6);

    return {
      ...collection,
      productCount: items.length,
      totalStock: stocks.reduce((sum, value) => sum + value, 0),
      priceFrom: prices.length ? Math.min(...prices) : 0,
      priceTo: prices.length ? Math.max(...prices) : 0,
      featuredProducts,
      shops: Array.from(new Set(items.map((item) => item.shopName).filter(Boolean))).slice(0, 3),
    };
  });

  const getRelatedCollections = (collection, enrichedCollections) => (collection.related || [])
    .map((slug) => enrichedCollections.find((item) => item.slug === slug))
    .filter(Boolean);

  window.GreenMarketCollections = {
    items: COLLECTIONS,
    segments: SEGMENTS,
    normalize,
    formatCurrency,
    getCollectionBySlug,
    getCollectionByPage,
    enrichCollections,
    getRelatedCollections,
  };
}(window));

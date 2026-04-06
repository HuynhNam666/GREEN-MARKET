using GreenMarket.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace GreenMarket.API.Data
{
    public static class AppDbSeeder
    {
        public static async Task InitializeAsync(IServiceProvider services, ILogger logger)
        {
            using var scope = services.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            await EnsureDatabaseReadyAsync(context, logger);

            var users = await SeedUsersAsync(context);
            var categories = await SeedCategoriesAsync(context);
            var shops = await SeedShopsAsync(context, users);
            await SeedProductsAsync(context, categories, shops);

            logger.LogInformation("Green Market sample data is ready.");
        }

        private static async Task EnsureDatabaseReadyAsync(AppDbContext context, ILogger logger)
        {
            const int maxAttempts = 10;
            for (var attempt = 1; attempt <= maxAttempts; attempt += 1)
            {
                try
                {
                    await context.Database.MigrateAsync();
                    return;
                }
                catch (Exception ex) when (attempt < maxAttempts)
                {
                    logger.LogWarning(ex, "Database is not ready yet. Retrying seed setup ({Attempt}/{MaxAttempts})...", attempt, maxAttempts);
                    await Task.Delay(TimeSpan.FromSeconds(3));
                }
            }

            await context.Database.MigrateAsync();
        }

        private static async Task<Dictionary<string, User>> SeedUsersAsync(AppDbContext context)
        {
            var seededUsers = new Dictionary<string, User>(StringComparer.OrdinalIgnoreCase)
            {
                ["admin"] = await UpsertUserAsync(context, "System Admin", "admin@greenmarket.local", UserRoles.Admin, "Admin@123"),
                ["sellerFresh"] = await UpsertUserAsync(context, "Vườn Xanh Đà Lạt", "sellerfresh@greenmarket.local", UserRoles.Seller, "Seller@123"),
                ["sellerHealthy"] = await UpsertUserAsync(context, "Nhà Hạt An Nhiên", "sellerhealthy@greenmarket.local", UserRoles.Seller, "Seller@123"),
                ["sellerGift"] = await UpsertUserAsync(context, "Đặc Sản Ba Miền", "sellergift@greenmarket.local", UserRoles.Seller, "Seller@123"),
                ["shipper"] = await UpsertUserAsync(context, "Shipper Demo", "shipper@greenmarket.local", UserRoles.Shipper, "Shipper@123"),
                ["customer"] = await UpsertUserAsync(context, "Khách Hàng Demo", "user@greenmarket.local", UserRoles.User, "User@123")
            };

            await context.SaveChangesAsync();
            await EnsureCartsAsync(context, seededUsers.Values);
            return seededUsers;
        }

        private static async Task<User> UpsertUserAsync(AppDbContext context, string username, string email, string role, string password)
        {
            var normalizedEmail = email.Trim().ToLowerInvariant();
            var user = await context.Users.FirstOrDefaultAsync(x => x.Email == normalizedEmail);

            if (user == null)
            {
                user = new User
                {
                    Email = normalizedEmail,
                    CreatedAt = DateTime.UtcNow
                };
                context.Users.Add(user);
            }

            user.Username = username;
            user.Email = normalizedEmail;
            user.Role = role;
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password);
            user.IsApproved = true;
            user.IsLocked = false;

            return user;
        }

        private static async Task EnsureCartsAsync(AppDbContext context, IEnumerable<User> users)
        {
            var userIds = users.Select(x => x.Id).ToList();
            var existingCartUserIds = await context.Carts
                .Where(x => userIds.Contains(x.UserId))
                .Select(x => x.UserId)
                .ToListAsync();

            foreach (var user in users.Where(user => !existingCartUserIds.Contains(user.Id)))
            {
                context.Carts.Add(new Cart { UserId = user.Id });
            }

            await context.SaveChangesAsync();
        }

        private static async Task<Dictionary<string, Category>> SeedCategoriesAsync(AppDbContext context)
        {
            var categorySeeds = new[]
            {
                new CategorySeed("Rau Củ Hữu Cơ", "Nhóm rau củ quả tươi sạch, phù hợp với các trang danh mục rau hữu cơ."),
                new CategorySeed("Trái Cây Mùa Vụ", "Nhóm trái cây theo mùa, giàu vitamin và phù hợp trang trái cây."),
                new CategorySeed("Ngũ Cốc Hạt", "Ngũ cốc nguyên hạt, hạt dinh dưỡng và bột ngũ cốc."),
                new CategorySeed("Sữa Trứng", "Sản phẩm sữa tươi, sữa chua, trứng và phô mai."),
                new CategorySeed("Thực Phẩm Chế Biến", "Các sản phẩm chế biến, đóng gói, sấy khô tiện lợi."),
                new CategorySeed("Đặc Sản Vùng Miền", "Đặc sản 3 miền để hiển thị đúng các trang đặc sản."),
                new CategorySeed("Sản Phẩm Từ Thiên Nhiên", "Mật ong và sản phẩm tự nhiên từ ong."),
                new CategorySeed("Combo", "Combo sản phẩm tiện lợi cho gia đình, ăn sáng và tiết kiệm."),
                new CategorySeed("Quà Tặng", "Hộp quà và giỏ quà nông sản."),
            };

            foreach (var seed in categorySeeds)
            {
                var category = await context.Categories.FirstOrDefaultAsync(x => x.Name == seed.Name);
                if (category == null)
                {
                    category = new Category();
                    context.Categories.Add(category);
                }

                category.Name = seed.Name;
                category.Description = seed.Description;
            }

            await context.SaveChangesAsync();

            return await context.Categories
                .Where(x => categorySeeds.Select(seed => seed.Name).Contains(x.Name))
                .ToDictionaryAsync(x => x.Name, x => x, StringComparer.OrdinalIgnoreCase);
        }

        private static async Task<Dictionary<string, Shop>> SeedShopsAsync(AppDbContext context, Dictionary<string, User> users)
        {
            var shopSeeds = new[]
            {
                new ShopSeed("Vườn Xanh Đà Lạt", "Chuyên rau lá xanh, củ quả rễ và trái cây theo mùa từ Đà Lạt.", users["sellerFresh"].Id),
                new ShopSeed("Nhà Hạt An Nhiên", "Chuyên ngũ cốc hạt, sữa trứng và thực phẩm chế biến tiện lợi.", users["sellerHealthy"].Id),
                new ShopSeed("Đặc Sản Ba Miền", "Chuyên đặc sản vùng miền, mật ong và sản phẩm thiên nhiên.", users["sellerGift"].Id),
                new ShopSeed("Quà Xanh Green Market", "Chuyên combo gia đình và hộp quà nông sản.", users["sellerGift"].Id),
            };

            foreach (var seed in shopSeeds)
            {
                var shop = await context.Shops.FirstOrDefaultAsync(x => x.Name == seed.Name);
                if (shop == null)
                {
                    shop = new Shop();
                    context.Shops.Add(shop);
                }

                shop.Name = seed.Name;
                shop.Description = seed.Description;
                shop.SellerId = seed.SellerId;
            }

            await context.SaveChangesAsync();

            return await context.Shops
                .Where(x => shopSeeds.Select(seed => seed.Name).Contains(x.Name))
                .ToDictionaryAsync(x => x.Name, x => x, StringComparer.OrdinalIgnoreCase);
        }

        private static async Task SeedProductsAsync(AppDbContext context, Dictionary<string, Category> categories, Dictionary<string, Shop> shops)
        {
            var productSeeds = new[]
            {
                new ProductSeed("Xà Lách Lô Lô Xanh", "Rau lá xanh hữu cơ thu hoạch trong ngày, ăn sống và trộn salad rất giòn mát.", 28000m, 120, "/images/rancu.png", "Rau Củ Hữu Cơ", "Vườn Xanh Đà Lạt"),
                new ProductSeed("Cà Rốt Baby Hữu Cơ", "Nhóm củ quả rễ sạch, vị ngọt tự nhiên, phù hợp cho bé và gia đình.", 32000m, 95, "/images/cachua.png", "Rau Củ Hữu Cơ", "Vườn Xanh Đà Lạt"),
                new ProductSeed("Nấm Bào Ngư Xám", "Nấm tươi tuyển chọn, giàu đạm thực vật, dễ chế biến món chay và món xào.", 45000m, 80, "/images/bapcai.jpg", "Rau Củ Hữu Cơ", "Vườn Xanh Đà Lạt"),
                new ProductSeed("Húng Quế Hữu Cơ", "Gia vị & thảo mộc thơm tự nhiên, phù hợp các món nước và salad kiểu Âu.", 18000m, 140, "/images/rancu.png", "Rau Củ Hữu Cơ", "Vườn Xanh Đà Lạt"),

                new ProductSeed("Táo Gala Mùa Lạnh", "Trái cây mùa lạnh giòn ngọt, dễ bảo quản và phù hợp ăn vặt hằng ngày.", 65000m, 90, "/images/tao.jpg", "Trái Cây Mùa Vụ", "Vườn Xanh Đà Lạt"),
                new ProductSeed("Dưa Lưới Mùa Hè", "Trái cây mùa hè vị thanh mát, cùi dày, độ ngọt ổn định.", 89000m, 60, "/images/traicay.png", "Trái Cây Mùa Vụ", "Vườn Xanh Đà Lạt"),
                new ProductSeed("Chuối Hữu Cơ Nam Mỹ", "Trái cây hữu cơ chín đều, thơm nhẹ, phù hợp ăn trực tiếp và làm sinh tố.", 36000m, 110, "/images/traicay.png", "Trái Cây Mùa Vụ", "Vườn Xanh Đà Lạt"),
                new ProductSeed("Bơ Sáp Đắk Lắk", "Bơ sáp béo mịn, cơm dày, thích hợp làm salad hoặc sinh tố.", 78000m, 70, "/images/bo.png", "Trái Cây Mùa Vụ", "Vườn Xanh Đà Lạt"),

                new ProductSeed("Yến Mạch Nguyên Hạt", "Ngũ cốc nguyên hạt giàu chất xơ, dùng cho bữa sáng và chế độ eat clean.", 52000m, 130, "/images/ngucoc.png", "Ngũ Cốc Hạt", "Nhà Hạt An Nhiên"),
                new ProductSeed("Hạt Điều Dinh Dưỡng", "Hạt dinh dưỡng rang mộc, ít muối, phù hợp ăn kiêng và bổ sung năng lượng.", 98000m, 85, "/images/ngucoc.png", "Ngũ Cốc Hạt", "Nhà Hạt An Nhiên"),
                new ProductSeed("Bột Ngũ Cốc Dinh Dưỡng", "Bột ngũ cốc tiện pha, phù hợp cho bữa sáng nhanh và người tập luyện.", 67000m, 100, "/images/ngucoc.png", "Ngũ Cốc Hạt", "Nhà Hạt An Nhiên"),

                new ProductSeed("Sữa Tươi Thanh Trùng", "Sữa tươi thanh trùng ít đường, nguồn sữa sạch từ trang trại chuẩn lạnh.", 42000m, 75, "/images/phomai.png", "Sữa Trứng", "Nhà Hạt An Nhiên"),
                new ProductSeed("Trứng Gà Sạch 10 Quả", "Trứng gà sạch vỏ nâu, tuyển chọn đồng đều, phù hợp bữa sáng gia đình.", 38000m, 160, "/images/trung.png", "Sữa Trứng", "Nhà Hạt An Nhiên"),
                new ProductSeed("Sữa Chua Không Đường", "Sữa chua lên men tự nhiên, vị dịu nhẹ, phù hợp ăn kiêng và trẻ nhỏ.", 34000m, 95, "/images/phomai.png", "Sữa Trứng", "Nhà Hạt An Nhiên"),
                new ProductSeed("Phô Mai Tươi Trang Trại", "Phô mai tươi vị béo nhẹ, dùng tốt cho bánh mì và salad.", 59000m, 65, "/images/phomai.png", "Sữa Trứng", "Nhà Hạt An Nhiên"),

                new ProductSeed("Rau Củ Sấy Thập Cẩm", "Dòng rau củ sấy giòn nhẹ, đóng gói tiện lợi cho dân văn phòng.", 49000m, 140, "/images/rancu.png", "Thực Phẩm Chế Biến", "Nhà Hạt An Nhiên"),
                new ProductSeed("Mứt Xoài Dẻo", "Mứt trái cây mềm dẻo, vị chua ngọt cân bằng, dùng làm món ăn vặt.", 58000m, 90, "/images/traicay.png", "Thực Phẩm Chế Biến", "Nhà Hạt An Nhiên"),
                new ProductSeed("Cháo Yến Mạch Ăn Liền", "Đồ đóng gói tiện lợi, chỉ cần pha nước nóng là dùng được.", 45000m, 120, "/images/ngucoc.png", "Thực Phẩm Chế Biến", "Nhà Hạt An Nhiên"),

                new ProductSeed("Chè Shan Tuyết Hà Giang", "Đặc sản miền Bắc hương thơm dịu, nước vàng xanh và hậu ngọt.", 76000m, 70, "/images/farmer.png", "Đặc Sản Vùng Miền", "Đặc Sản Ba Miền"),
                new ProductSeed("Tỏi Lý Sơn Sấy", "Đặc sản miền Trung, thơm nồng, tiện dùng cho nấu ăn và biếu tặng.", 69000m, 80, "/images/banner.png", "Đặc Sản Vùng Miền", "Đặc Sản Ba Miền"),
                new ProductSeed("Muối Tôm Tây Ninh", "Đặc sản miền Nam, vị đậm đà, hợp trái cây chấm và món nướng.", 35000m, 150, "/images/banner.png", "Đặc Sản Vùng Miền", "Đặc Sản Ba Miền"),

                new ProductSeed("Mật Ong Rừng Tây Nguyên", "Mật ong rừng nguyên chất, hương thơm đậm, phù hợp pha nước ấm và chế biến.", 135000m, 55, "/images/matongdaklak.png", "Sản Phẩm Từ Thiên Nhiên", "Đặc Sản Ba Miền"),
                new ProductSeed("Mật Ong Nuôi Hoa Nhãn", "Mật ong nuôi ổn định chất lượng, vị ngọt thanh, dễ dùng mỗi ngày.", 115000m, 65, "/images/matong.png", "Sản Phẩm Từ Thiên Nhiên", "Đặc Sản Ba Miền"),
                new ProductSeed("Sáp Ong Mật Tự Nhiên", "Sản phẩm từ mật ong dùng cho trà, bánh mì và quà biếu đặc trưng.", 89000m, 45, "/images/matong.png", "Sản Phẩm Từ Thiên Nhiên", "Đặc Sản Ba Miền"),

                new ProductSeed("Combo Rau Củ Gia Đình", "Combo rau củ đủ cho 3-4 bữa, phù hợp gia đình nhỏ và ăn sạch hằng ngày.", 149000m, 40, "/images/banner.png", "Combo", "Quà Xanh Green Market"),
                new ProductSeed("Combo Dinh Dưỡng Bữa Sáng", "Combo dinh dưỡng gồm ngũ cốc, sữa chua và trái cây khô cho buổi sáng tiện lợi.", 179000m, 35, "/images/banner.png", "Combo", "Quà Xanh Green Market"),
                new ProductSeed("Combo Tiết Kiệm Trong Tuần", "Combo tiết kiệm giúp tối ưu chi phí đi chợ, vẫn đủ rau, trái cây và đồ khô cơ bản.", 199000m, 30, "/images/banner.png", "Combo", "Quà Xanh Green Market"),

                new ProductSeed("Hộp Quà Doanh Nghiệp", "Hộp quà doanh nghiệp sang trọng, phù hợp biếu đối tác và nhân viên dịp lễ.", 399000m, 25, "/images/banner.png", "Quà Tặng", "Quà Xanh Green Market"),
                new ProductSeed("Hộp Quà Gia Đình", "Hộp quà gia đình gồm trái cây sấy, mật ong và trà thảo mộc dễ dùng.", 289000m, 28, "/images/banner.png", "Quà Tặng", "Quà Xanh Green Market"),
                new ProductSeed("Hộp Quà Lễ", "Hộp quà lễ thiết kế chỉn chu, phù hợp tặng sinh nhật, lễ Tết và dịp tri ân.", 329000m, 20, "/images/banner.png", "Quà Tặng", "Quà Xanh Green Market")
            };

            foreach (var seed in productSeeds)
            {
                var category = categories[seed.CategoryName];
                var shop = shops[seed.ShopName];
                var product = await context.Products.FirstOrDefaultAsync(x => x.Name == seed.Name);

                if (product == null)
                {
                    product = new Product();
                    context.Products.Add(product);
                }

                product.Name = seed.Name;
                product.Description = seed.Description;
                product.Price = seed.Price;
                product.Stock = seed.Stock;
                product.ImageUrl = seed.ImageUrl;
                product.CategoryId = category.Id;
                product.ShopId = shop.Id;
            }

            await context.SaveChangesAsync();
        }

        private sealed record CategorySeed(string Name, string Description);
        private sealed record ShopSeed(string Name, string Description, int SellerId);
        private sealed record ProductSeed(string Name, string Description, decimal Price, int Stock, string ImageUrl, string CategoryName, string ShopName);
    }
}

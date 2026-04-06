using System.Globalization;
using System.Security.Claims;
using System.Text;
using GreenMarket.API.Data;
using GreenMarket.API.Models;
using Microsoft.EntityFrameworkCore;

namespace GreenMarket.API.Services
{
    public sealed record StoreAssistantRequest(
        string Message,
        int? SellerId = null,
        int? ProductId = null,
        int? OrderId = null,
        int? ConversationId = null,
        bool IsConversationAutoReply = false);

    public sealed record StoreAssistantResponse(
        string Answer,
        IReadOnlyList<string> Suggestions,
        bool UsedAi,
        string Topic,
        string AssistantName,
        string? HandoffHint = null);

    public class StoreAssistantService
    {
        private readonly AppDbContext _context;
        private readonly GeminiService _geminiService;
        private readonly OrderReservationService _reservationService;

        public StoreAssistantService(
            AppDbContext context,
            GeminiService geminiService,
            OrderReservationService reservationService)
        {
            _context = context;
            _geminiService = geminiService;
            _reservationService = reservationService;
        }

        public async Task<StoreAssistantResponse> AskAsync(
            StoreAssistantRequest request,
            ClaimsPrincipal? principal,
            CancellationToken cancellationToken = default)
        {
            var normalizedMessage = Normalize(request.Message);
            var topic = DetectTopic(normalizedMessage);
            var sellerContext = await GetSellerContextAsync(request.SellerId, request.ProductId, cancellationToken);
            var userOrderContext = await GetOrderContextAsync(principal, request.OrderId, cancellationToken);
            var recentUserOrders = await GetRecentOrdersAsync(principal, cancellationToken);
            var conversationTurns = request.ConversationId.HasValue
                ? await GetConversationTurnsAsync(request.ConversationId.Value, cancellationToken)
                : new List<GeminiTurn>();

            var systemInstruction = BuildSystemInstruction(topic, sellerContext, userOrderContext, recentUserOrders, request.IsConversationAutoReply);
            var turns = new List<GeminiTurn>(conversationTurns)
            {
                new("user", request.Message.Trim())
            };

            var aiAnswer = await _geminiService.GenerateReplyAsync(systemInstruction, turns, cancellationToken);
            if (!string.IsNullOrWhiteSpace(aiAnswer))
            {
                return new StoreAssistantResponse(
                    CleanAnswer(aiAnswer),
                    BuildSuggestions(topic, sellerContext.ProductName),
                    true,
                    topic,
                    "AgriFresh AI",
                    BuildHandoffHint(topic, request.IsConversationAutoReply));
            }

            var fallback = BuildFallbackAnswer(topic, sellerContext, userOrderContext, recentUserOrders);
            return new StoreAssistantResponse(
                fallback,
                BuildSuggestions(topic, sellerContext.ProductName),
                false,
                topic,
                "AgriFresh AI",
                BuildHandoffHint(topic, request.IsConversationAutoReply));
        }

        public bool ShouldAutoReply(string message)
        {
            var rawMessage = message?.Trim() ?? string.Empty;
            var normalized = Normalize(rawMessage);
            if (string.IsNullOrWhiteSpace(normalized))
            {
                return false;
            }

            var faqKeywords = new[]
            {
                "gia", "gia bao nhieu", "con hang", "ton kho", "phi ship", "van chuyen", "giao hang",
                "thanh toan", "vnpay", "bao lau", "doi tra", "hoan tien", "uu dai", "khuyen mai",
                "bao quan", "shop", "don hang", "tracking", "shipper", "giao duoc khong", "size"
            };

            return rawMessage.Contains('?') || faqKeywords.Any(normalized.Contains);
        }

        private async Task<(int? SellerId, string SellerName, string? ProductName, string? ProductPrice, string ShopSummary, List<string> FeaturedProducts)> GetSellerContextAsync(
            int? sellerId,
            int? productId,
            CancellationToken cancellationToken)
        {
            string sellerName = "Green Market";
            string? productName = null;
            string? productPrice = null;
            var featuredProducts = new List<string>();
            var shopSummaryBuilder = new StringBuilder();

            if (productId.HasValue)
            {
                var product = await _context.Products
                    .Include(item => item.Shop)
                    .FirstOrDefaultAsync(item => item.Id == productId.Value, cancellationToken);

                if (product != null)
                {
                    sellerId ??= product.Shop?.SellerId;
                    productName = product.Name;
                    var availableStock = await _reservationService.GetAvailableStockAsync(product.Id, product.Stock, null, cancellationToken);
                    productPrice = $"{product.Price:N0}đ";
                    shopSummaryBuilder.AppendLine($"Sản phẩm đang được hỏi: {product.Name}.");
                    shopSummaryBuilder.AppendLine($"Giá bán hiện tại: {product.Price:N0}đ.");
                    shopSummaryBuilder.AppendLine($"Tồn kho khả dụng: {availableStock}.");
                    if (!string.IsNullOrWhiteSpace(product.Description))
                    {
                        shopSummaryBuilder.AppendLine($"Mô tả ngắn: {product.Description}");
                    }
                }
            }

            if (sellerId.HasValue)
            {
                var seller = await _context.Users.FirstOrDefaultAsync(user => user.Id == sellerId.Value, cancellationToken);
                if (seller != null)
                {
                    sellerName = seller.Username;
                }

                var shops = await _context.Shops
                    .Where(shop => shop.SellerId == sellerId.Value)
                    .Select(shop => new { shop.Id, shop.Name, shop.Description })
                    .ToListAsync(cancellationToken);

                if (shops.Any())
                {
                    shopSummaryBuilder.AppendLine($"Người bán phụ trách: {sellerName}.");
                    foreach (var shop in shops.Take(2))
                    {
                        shopSummaryBuilder.AppendLine($"Shop: {shop.Name}. {shop.Description}");
                    }

                    var shopIds = shops.Select(shop => shop.Id).ToList();
                    var products = await _context.Products
                        .Where(product => shopIds.Contains(product.ShopId))
                        .OrderByDescending(product => product.Stock)
                        .Take(6)
                        .Select(product => new { product.Id, product.Name, product.Price, product.Stock })
                        .ToListAsync(cancellationToken);

                    if (products.Any())
                    {
                        var physicalStocks = products.ToDictionary(product => product.Id, product => product.Stock);
                        var availableStocks = await _reservationService.GetAvailableStocksAsync(physicalStocks, null, cancellationToken);
                        foreach (var product in products)
                        {
                            var available = availableStocks.TryGetValue(product.Id, out var value) ? value : product.Stock;
                            featuredProducts.Add($"{product.Name} ({product.Price:N0}đ, còn {available})");
                        }
                    }
                }
            }
            else
            {
                var products = await _context.Products
                    .OrderByDescending(product => product.Id)
                    .Take(5)
                    .Select(product => new { product.Id, product.Name, product.Price, product.Stock })
                    .ToListAsync(cancellationToken);

                if (products.Any())
                {
                    var physicalStocks = products.ToDictionary(product => product.Id, product => product.Stock);
                    var availableStocks = await _reservationService.GetAvailableStocksAsync(physicalStocks, null, cancellationToken);
                    foreach (var product in products)
                    {
                        var available = availableStocks.TryGetValue(product.Id, out var value) ? value : product.Stock;
                        featuredProducts.Add($"{product.Name} ({product.Price:N0}đ, còn {available})");
                    }
                }
            }

            return (sellerId, sellerName, productName, productPrice, shopSummaryBuilder.ToString().Trim(), featuredProducts);
        }

        private async Task<string> GetOrderContextAsync(ClaimsPrincipal? principal, int? orderId, CancellationToken cancellationToken)
        {
            var userId = TryGetUserId(principal);
            if (!userId.HasValue || !orderId.HasValue)
            {
                return string.Empty;
            }

            var order = await _context.Orders
                .Include(item => item.OrderDetails)
                    .ThenInclude(detail => detail.Product)
                .FirstOrDefaultAsync(item => item.Id == orderId.Value && item.UserId == userId.Value, cancellationToken);

            if (order == null)
            {
                return string.Empty;
            }

            var builder = new StringBuilder();
            builder.AppendLine($"Đơn hàng gần nhất cần hỗ trợ: {order.OrderCode}.");
            builder.AppendLine($"Trạng thái hiện tại: {TranslateStatus(order.Status)}.");
            builder.AppendLine($"Ngày tạo: {order.OrderDate:dd/MM/yyyy HH:mm}.");
            builder.AppendLine($"Tổng tiền: {order.TotalAmount:N0}đ.");
            if (!string.IsNullOrWhiteSpace(order.ShippingAddress))
            {
                builder.AppendLine($"Địa chỉ giao: {order.ShippingAddress}.");
            }
            var productNames = order.OrderDetails
                .Where(detail => detail.Product != null)
                .Select(detail => $"{detail.Product!.Name} x{detail.Quantity}")
                .ToList();
            if (productNames.Any())
            {
                builder.AppendLine($"Sản phẩm trong đơn: {string.Join(", ", productNames)}.");
            }
            return builder.ToString().Trim();
        }

        private async Task<List<string>> GetRecentOrdersAsync(ClaimsPrincipal? principal, CancellationToken cancellationToken)
        {
            var userId = TryGetUserId(principal);
            if (!userId.HasValue)
            {
                return new List<string>();
            }

            return await _context.Orders
                .Where(order => order.UserId == userId.Value)
                .OrderByDescending(order => order.OrderDate)
                .Take(3)
                .Select(order => $"{order.OrderCode}: {TranslateStatus(order.Status)}")
                .ToListAsync(cancellationToken);
        }

        private async Task<List<GeminiTurn>> GetConversationTurnsAsync(int conversationId, CancellationToken cancellationToken)
        {
            var messages = await _context.Messages
                .Where(message => message.ConversationId == conversationId)
                .OrderByDescending(message => message.SentAt)
                .Take(8)
                .OrderBy(message => message.SentAt)
                .ToListAsync(cancellationToken);

            return messages
                .Where(message => !string.IsNullOrWhiteSpace(message.Content))
                .Select(message => new GeminiTurn(message.IsBot ? "model" : "user", message.Content))
                .ToList();
        }

        private string BuildSystemInstruction(
            string topic,
            (int? SellerId, string SellerName, string? ProductName, string? ProductPrice, string ShopSummary, List<string> FeaturedProducts) sellerContext,
            string orderContext,
            List<string> recentOrders,
            bool isConversationAutoReply)
        {
            var builder = new StringBuilder();
            builder.AppendLine("Bạn là trợ lý bán hàng của AgriFresh/Green Market.");
            builder.AppendLine("Luôn trả lời bằng tiếng Việt, thân thiện, đúng trọng tâm, tối đa 5 câu ngắn.");
            builder.AppendLine("Không bịa ra chính sách. Nếu thiếu dữ liệu, nói rõ là cần nhân viên cửa hàng kiểm tra thêm.");
            builder.AppendLine("Ưu tiên trả lời các câu về sản phẩm, tồn kho, vận chuyển, đơn hàng, thanh toán, đổi trả và chăm sóc sau bán.");
            builder.AppendLine("Không dùng markdown phức tạp, không mở đầu bằng lời xin lỗi dài dòng.");

            if (isConversationAutoReply)
            {
                builder.AppendLine("Bạn đang trả lời tự động thay shop trong cửa sổ chat. Hãy ngắn gọn và mang tính điều phối, tránh hứa hẹn quá mức.");
            }

            builder.AppendLine($"Chủ đề chính của lượt hỏi hiện tại: {topic}.");

            if (!string.IsNullOrWhiteSpace(sellerContext.ShopSummary))
            {
                builder.AppendLine("Thông tin cửa hàng/sản phẩm:");
                builder.AppendLine(sellerContext.ShopSummary);
            }

            if (sellerContext.FeaturedProducts.Any())
            {
                builder.AppendLine($"Một số sản phẩm gợi ý hiện có: {string.Join("; ", sellerContext.FeaturedProducts.Take(4))}.");
            }

            if (!string.IsNullOrWhiteSpace(orderContext))
            {
                builder.AppendLine("Thông tin đơn hàng của khách:");
                builder.AppendLine(orderContext);
            }
            else if (recentOrders.Any())
            {
                builder.AppendLine($"Các đơn gần đây của khách: {string.Join(" | ", recentOrders)}.");
            }

            builder.AppendLine("Chính sách mặc định có thể nhắc nếu phù hợp: thanh toán online qua VNPay, có chat trực tiếp với shop, đơn đã giao có thể yêu cầu trả hàng hoặc hỗ trợ sau bán nếu phát sinh vấn đề.");
            builder.AppendLine("Nếu khách hỏi thông tin vượt ngoài dữ liệu hiện có, hãy mời khách để lại tin nhắn để nhân viên cửa hàng phản hồi thủ công.");

            return builder.ToString().Trim();
        }

        private string BuildFallbackAnswer(
            string topic,
            (int? SellerId, string SellerName, string? ProductName, string? ProductPrice, string ShopSummary, List<string> FeaturedProducts) sellerContext,
            string orderContext,
            List<string> recentOrders)
        {
            var productSnippet = !string.IsNullOrWhiteSpace(sellerContext.ProductName)
                ? $"Sản phẩm {sellerContext.ProductName}{(string.IsNullOrWhiteSpace(sellerContext.ProductPrice) ? string.Empty : $" hiện có giá {sellerContext.ProductPrice}")}"
                : "Shop hiện có nhiều nông sản tươi, đồ khô và combo theo mùa";

            return topic switch
            {
                "shipping" => $"{productSnippet}. Về giao hàng, shop sẽ xác nhận đơn trước rồi chuyển sang bước chuẩn bị giao, sau đó điều phối shipper nội bộ. Bạn có thể nhắn thêm khu vực nhận hàng để shop báo ETA chính xác hơn.",
                "payment" => "Green Market hiện hỗ trợ thanh toán online qua VNPay. Sau khi thanh toán thành công, đơn sẽ chuyển sang bước chờ shop xác nhận và chuẩn bị giao.",
                "order" when !string.IsNullOrWhiteSpace(orderContext) => $"Mình đã kiểm tra nhanh thông tin đơn của bạn. {orderContext} Nếu bạn muốn, mình có thể hướng dẫn bước tiếp theo theo đúng trạng thái hiện tại của đơn.",
                "policy" => "Shop hỗ trợ chăm sóc sau bán cho các vấn đề như giao chậm, hàng chưa đúng mô tả hoặc nhu cầu đổi trả sau khi giao. Bạn hãy mô tả rõ tình huống để cửa hàng xử lý nhanh hơn.",
                _ => $"{productSnippet}. Bạn có thể hỏi thêm về giá, tồn kho, cách bảo quản, thời gian giao hàng hoặc tình trạng đơn để mình hỗ trợ tiếp."
            };
        }

        private static string BuildHandoffHint(string topic, bool isConversationAutoReply)
        {
            if (isConversationAutoReply)
            {
                return "Nếu bạn cần xác nhận thủ công, nhân viên shop sẽ tiếp tục hỗ trợ trong cùng cuộc trò chuyện.";
            }

            return topic is "order" or "policy"
                ? "Nếu cần xử lý thủ công, bạn có thể mở chat trực tiếp với shop ngay trong hệ thống."
                : "Nếu cần tư vấn sâu hơn, bạn có thể chuyển sang chat trực tiếp với shop.";
        }

        private static IReadOnlyList<string> BuildSuggestions(string topic, string? productName)
        {
            return topic switch
            {
                "shipping" => new[] { "Phí ship tính thế nào?", "Bao lâu thì giao tới?", "Đơn của tôi đang ở đâu?" },
                "payment" => new[] { "Thanh toán VNPay ra sao?", "Thanh toán lỗi phải làm gì?", "Tôi có thể đặt lại đơn không?" },
                "order" => new[] { "Kiểm tra trạng thái đơn", "Tôi muốn hủy đơn", "Đơn đã giao nhưng có vấn đề" },
                "policy" => new[] { "Chính sách đổi trả", "Tôi muốn hỗ trợ sau bán", "Liên hệ nhân viên shop" },
                _ => new[]
                {
                    !string.IsNullOrWhiteSpace(productName) ? $"{productName} còn hàng không?" : "Sản phẩm nào đang bán tốt?",
                    "Bao lâu thì giao hàng?",
                    "Tôi muốn chat trực tiếp với shop"
                }
            };
        }

        private static string DetectTopic(string normalizedMessage)
        {
            if (ContainsAny(normalizedMessage, "ship", "giao hang", "van chuyen", "tracking", "shipper", "eta", "bao lau"))
            {
                return "shipping";
            }

            if (ContainsAny(normalizedMessage, "vnpay", "thanh toan", "tra tien", "chuyen khoan", "payment"))
            {
                return "payment";
            }

            if (ContainsAny(normalizedMessage, "don hang", "ma don", "trang thai", "huy don", "hoan tat", "tra hang"))
            {
                return "order";
            }

            if (ContainsAny(normalizedMessage, "doi tra", "hoan tien", "chinh sach", "bao hanh", "khieu nai", "hau mai"))
            {
                return "policy";
            }

            return "product";
        }

        private static string TranslateStatus(string status)
        {
            return status switch
            {
                OrderStatuses.PendingPayment => "Chờ thanh toán",
                OrderStatuses.AwaitingConfirmation => "Chờ shop xác nhận",
                OrderStatuses.Processing => "Đang xử lý",
                OrderStatuses.ReadyToShip => "Sẵn sàng giao",
                OrderStatuses.Shipping => "Đang giao hàng",
                OrderStatuses.Delivered => "Đã giao hàng",
                OrderStatuses.Completed => "Hoàn tất",
                OrderStatuses.Cancelled => "Đã hủy",
                OrderStatuses.FailedDelivery => "Giao thất bại",
                OrderStatuses.ReturnRequested => "Đang yêu cầu trả hàng",
                OrderStatuses.Returned => "Đã trả hàng",
                OrderStatuses.PaymentFailed => "Thanh toán thất bại",
                _ => status
            };
        }

        private static bool ContainsAny(string text, params string[] keywords)
        {
            return keywords.Any(keyword => text.Contains(keyword, StringComparison.OrdinalIgnoreCase));
        }

        private static int? TryGetUserId(ClaimsPrincipal? principal)
        {
            var raw = principal?.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.TryParse(raw, out var userId) ? userId : null;
        }

        private static string Normalize(string input)
        {
            if (string.IsNullOrWhiteSpace(input))
            {
                return string.Empty;
            }

            var normalized = input.Trim().Normalize(NormalizationForm.FormD);
            var builder = new StringBuilder();
            foreach (var character in normalized)
            {
                var unicodeCategory = CharUnicodeInfo.GetUnicodeCategory(character);
                if (unicodeCategory == UnicodeCategory.NonSpacingMark)
                {
                    continue;
                }

                builder.Append(character);
            }

            return builder
                .ToString()
                .Replace("đ", "d", StringComparison.OrdinalIgnoreCase)
                .ToLowerInvariant();
        }

        private static string CleanAnswer(string answer)
        {
            return answer
                .Replace("**", string.Empty)
                .Replace("__", string.Empty)
                .Trim();
        }
    }
}

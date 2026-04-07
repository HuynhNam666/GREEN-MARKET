using System.Security.Claims;
using GreenMarket.API.Data;
using GreenMarket.API.DTOs;
using GreenMarket.API.Hubs;
using GreenMarket.API.Models;
using GreenMarket.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace GreenMarket.API.Controllers
{
    [ApiController]
    [Route("api/chat")]
    [Authorize]
    public class ChatController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<ChatHub> _hubContext;
        private readonly StoreAssistantService _storeAssistantService;

        public ChatController(
            AppDbContext context,
            IHubContext<ChatHub> hubContext,
            StoreAssistantService storeAssistantService)
        {
            _context = context;
            _hubContext = hubContext;
            _storeAssistantService = storeAssistantService;
        }

        private int GetCurrentUserId()
        {
            return int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        }

        private bool IsAdmin()
        {
            return User.IsInRole(UserRoles.Admin);
        }

        private async Task<(int SellerId, int? ShopId, string? ShopName)> ResolveSellerContextAsync(OpenConversationRequest request, CancellationToken cancellationToken)
        {
            if (request.SellerId.HasValue)
            {
                var directSeller = await _context.Users
                    .Where(user => user.Id == request.SellerId.Value && user.Role == UserRoles.Seller)
                    .Select(user => new { user.Id })
                    .FirstOrDefaultAsync(cancellationToken);

                if (directSeller != null)
                {
                    int? directShopId = request.ShopId;
                    string? directShopName = null;

                    if (request.ShopId.HasValue)
                    {
                        var directShop = await _context.Shops
                            .Where(shop => shop.Id == request.ShopId.Value && shop.SellerId == directSeller.Id)
                            .Select(shop => new { shop.Id, shop.Name })
                            .FirstOrDefaultAsync(cancellationToken);

                        if (directShop != null)
                        {
                            directShopId = directShop.Id;
                            directShopName = directShop.Name;
                        }
                    }

                    return (directSeller.Id, directShopId, directShopName);
                }
            }

            if (request.ShopId.HasValue)
            {
                var shop = await _context.Shops
                    .Where(item => item.Id == request.ShopId.Value)
                    .Select(item => new { item.Id, item.Name, item.SellerId })
                    .FirstOrDefaultAsync(cancellationToken);

                if (shop != null)
                {
                    return (shop.SellerId, shop.Id, shop.Name);
                }
            }

            if (request.ProductId.HasValue)
            {
                var product = await _context.Products
                    .Include(item => item.Shop)
                    .Where(item => item.Id == request.ProductId.Value)
                    .Select(item => new
                    {
                        item.Id,
                        item.ShopId,
                        ShopName = item.Shop != null ? item.Shop.Name : null,
                        SellerId = item.Shop != null ? item.Shop.SellerId : (int?)null
                    })
                    .FirstOrDefaultAsync(cancellationToken);

                if (product?.SellerId is int productSellerId)
                {
                    return (productSellerId, product.ShopId, product.ShopName);
                }
            }

            if (request.OrderId.HasValue)
            {
                var order = await _context.Orders
                    .Include(item => item.OrderDetails)
                        .ThenInclude(detail => detail.Product)
                            .ThenInclude(product => product!.Shop)
                    .Where(item => item.Id == request.OrderId.Value)
                    .FirstOrDefaultAsync(cancellationToken);

                if (order != null)
                {
                    var requestedShop = request.ShopId.HasValue
                        ? order.OrderDetails.FirstOrDefault(detail => detail.Product != null && detail.Product.ShopId == request.ShopId.Value)?.Product?.Shop
                        : null;

                    var resolvedShop = requestedShop ?? order.OrderDetails
                        .Select(detail => detail.Product?.Shop)
                        .FirstOrDefault(shop => shop != null);

                    if (resolvedShop != null)
                    {
                        return (resolvedShop.SellerId, resolvedShop.Id, resolvedShop.Name);
                    }
                }
            }

            throw new InvalidOperationException("Không xác định được shop để mở hội thoại.");
        }

        private async Task<object> BuildConversationSummaryAsync(Conversation conversation, int currentUserId, CancellationToken cancellationToken)
        {
            var lastMessage = await _context.Messages
                .Where(message => message.ConversationId == conversation.Id)
                .OrderByDescending(message => message.SentAt)
                .Select(message => new { message.Content, message.SentAt })
                .FirstOrDefaultAsync(cancellationToken);

            var unreadCount = await _context.Messages
                .CountAsync(message => message.ConversationId == conversation.Id && !message.IsRead && message.SenderId != currentUserId, cancellationToken);

            var botMessageCount = await _context.Messages
                .CountAsync(message => message.ConversationId == conversation.Id && message.IsBot, cancellationToken);

            return new
            {
                conversation.Id,
                conversation.UserId,
                UserName = conversation.User?.Username,
                conversation.SellerId,
                SellerName = conversation.Seller?.Username,
                conversation.CreatedAt,
                LastMessage = lastMessage?.Content,
                LastMessageAt = lastMessage?.SentAt,
                UnreadCount = unreadCount,
                BotMessageCount = botMessageCount
            };
        }

        [HttpPost("open")]
        public async Task<IActionResult> OpenConversation([FromBody] OpenConversationRequest request)
        {
            var currentUserId = GetCurrentUserId();

            try
            {
                var (sellerId, shopId, shopName) = await ResolveSellerContextAsync(request, HttpContext.RequestAborted);

                var seller = await _context.Users
                    .FirstOrDefaultAsync(user => user.Id == sellerId && user.Role == UserRoles.Seller, HttpContext.RequestAborted);

                if (seller == null)
                {
                    return BadRequest(new { message = "Shop không tồn tại hoặc chưa có người bán hợp lệ." });
                }

                var conversation = await _context.Conversations
                    .Include(item => item.User)
                    .Include(item => item.Seller)
                    .FirstOrDefaultAsync(item => item.UserId == currentUserId && item.SellerId == sellerId, HttpContext.RequestAborted);

                if (conversation == null)
                {
                    conversation = new Conversation
                    {
                        UserId = currentUserId,
                        SellerId = sellerId,
                        CreatedAt = DateTime.UtcNow
                    };

                    _context.Conversations.Add(conversation);
                    await _context.SaveChangesAsync(HttpContext.RequestAborted);
                    conversation = await _context.Conversations
                        .Include(item => item.User)
                        .Include(item => item.Seller)
                        .FirstAsync(item => item.Id == conversation.Id, HttpContext.RequestAborted);
                }

                var summary = await BuildConversationSummaryAsync(conversation, currentUserId, HttpContext.RequestAborted);
                return Ok(new
                {
                    conversationId = conversation.Id,
                    sellerId,
                    sellerName = seller.Username,
                    shopId,
                    shopName,
                    conversation = summary
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("conversations")]
        public async Task<IActionResult> CreateConversation([FromBody] CreateConversationRequest request)
        {
            return await OpenConversation(new OpenConversationRequest { SellerId = request.SellerId });
        }

        [HttpGet("conversations")]
        public async Task<IActionResult> GetConversations()
        {
            var currentUserId = GetCurrentUserId();

            var conversationRows = await _context.Conversations
                .Include(item => item.User)
                .Include(item => item.Seller)
                .Where(item => item.UserId == currentUserId || item.SellerId == currentUserId || IsAdmin())
                .Select(item => new
                {
                    item.Id,
                    item.UserId,
                    UserName = item.User != null ? item.User.Username : null,
                    item.SellerId,
                    SellerName = item.Seller != null ? item.Seller.Username : null,
                    item.CreatedAt,
                    LastMessage = item.Messages.OrderByDescending(message => message.SentAt).Select(message => message.Content).FirstOrDefault(),
                    LastMessageAt = item.Messages.OrderByDescending(message => message.SentAt).Select(message => (DateTime?)message.SentAt).FirstOrDefault(),
                    UnreadCount = item.Messages.Count(message => !message.IsRead && message.SenderId != currentUserId),
                    BotMessageCount = item.Messages.Count(message => message.IsBot)
                })
                .ToListAsync(HttpContext.RequestAborted);

            var conversations = conversationRows
                .OrderByDescending(item => item.LastMessageAt ?? item.CreatedAt)
                .ToList();

            return Ok(conversations);
        }

        [HttpDelete("conversations/{id}/history")]
        public async Task<IActionResult> DeleteConversationHistory(int id)
        {
            var currentUserId = GetCurrentUserId();

            var conversation = await _context.Conversations
                .FirstOrDefaultAsync(item => item.Id == id, HttpContext.RequestAborted);

            if (conversation == null)
            {
                return NotFound(new { message = "Không tìm thấy hội thoại." });
            }

            if (!IsAdmin() && conversation.UserId != currentUserId && conversation.SellerId != currentUserId)
            {
                return Forbid();
            }

            var messages = await _context.Messages
                .Where(item => item.ConversationId == id)
                .ToListAsync(HttpContext.RequestAborted);

            if (messages.Any())
            {
                _context.Messages.RemoveRange(messages);
                await _context.SaveChangesAsync(HttpContext.RequestAborted);
            }

            return Ok(new { message = "Đã xóa lịch sử trò chuyện." });
        }

        [HttpGet("conversations/{id}/messages")]
        public async Task<IActionResult> GetMessages(int id)
        {
            var currentUserId = GetCurrentUserId();

            var conversation = await _context.Conversations
                .FirstOrDefaultAsync(item => item.Id == id, HttpContext.RequestAborted);

            if (conversation == null)
            {
                return NotFound(new { message = "Không tìm thấy hội thoại." });
            }

            if (!IsAdmin() && conversation.UserId != currentUserId && conversation.SellerId != currentUserId)
            {
                return Forbid();
            }

            var unreadMessages = await _context.Messages
                .Where(item => item.ConversationId == id && !item.IsRead && item.SenderId != currentUserId)
                .ToListAsync(HttpContext.RequestAborted);

            if (unreadMessages.Any())
            {
                unreadMessages.ForEach(message => message.IsRead = true);
                await _context.SaveChangesAsync(HttpContext.RequestAborted);
            }

            var messages = await _context.Messages
                .Include(item => item.Sender)
                .Where(item => item.ConversationId == id)
                .OrderBy(item => item.SentAt)
                .Select(item => new
                {
                    item.Id,
                    item.ConversationId,
                    item.SenderId,
                    SenderName = item.IsBot ? "AgriFresh AI" : (item.Sender != null ? item.Sender.Username : null),
                    item.Content,
                    item.IsRead,
                    item.IsBot,
                    item.SentAt
                })
                .ToListAsync(HttpContext.RequestAborted);

            return Ok(messages);
        }

        [HttpPost("conversations/{id}/messages")]
        public async Task<IActionResult> SendMessage(int id, [FromBody] SendMessageRequest request)
        {
            var currentUserId = GetCurrentUserId();

            if (string.IsNullOrWhiteSpace(request.Content))
            {
                return BadRequest(new { message = "Nội dung tin nhắn không được để trống." });
            }

            var conversation = await _context.Conversations
                .FirstOrDefaultAsync(item => item.Id == id, HttpContext.RequestAborted);

            if (conversation == null)
            {
                return NotFound(new { message = "Không tìm thấy hội thoại." });
            }

            if (!IsAdmin() && conversation.UserId != currentUserId && conversation.SellerId != currentUserId)
            {
                return Forbid();
            }

            var userMessage = new Message
            {
                ConversationId = id,
                SenderId = currentUserId,
                Content = request.Content.Trim(),
                IsRead = false,
                IsBot = false,
                SentAt = DateTime.UtcNow
            };

            _context.Messages.Add(userMessage);
            await _context.SaveChangesAsync(HttpContext.RequestAborted);

            var sender = await _context.Users.FindAsync(new object[] { currentUserId }, HttpContext.RequestAborted);

            var userResponse = new
            {
                userMessage.Id,
                userMessage.ConversationId,
                userMessage.SenderId,
                SenderName = sender?.Username,
                userMessage.Content,
                userMessage.IsRead,
                userMessage.IsBot,
                userMessage.SentAt
            };

            await _hubContext.Clients.Group($"conversation-{id}")
                .SendAsync("ReceiveMessage", userResponse);

            var shouldAutoReply = currentUserId == conversation.UserId
    && _storeAssistantService.ShouldAutoReply(request.Content);

if (shouldAutoReply)
{
    var assistantReply = await _storeAssistantService.AskAsync(
        new StoreAssistantRequest(
            request.Content.Trim(),
            conversation.SellerId,
            request.ProductId,
            request.OrderId,
            id,
            true),
        User,
        HttpContext.RequestAborted);

    var replyText = assistantReply.Answer;
    if (!string.IsNullOrWhiteSpace(assistantReply.HandoffHint) && assistantReply.Topic is "policy" or "order")
    {
        replyText = $"{replyText}\n\n{assistantReply.HandoffHint}";
    }

    if (!string.IsNullOrWhiteSpace(replyText))
    {
        var botMessage = new Message
        {
            ConversationId = id,
            SenderId = conversation.SellerId,
            Content = replyText,
            IsRead = false,
            IsBot = true,
            SentAt = DateTime.UtcNow
        };

        _context.Messages.Add(botMessage);
        await _context.SaveChangesAsync(HttpContext.RequestAborted);

        var botResponse = new
        {
            botMessage.Id,
            botMessage.ConversationId,
            botMessage.SenderId,
            SenderName = assistantReply.AssistantName,
            botMessage.Content,
            botMessage.IsRead,
            botMessage.IsBot,
            botMessage.SentAt,
            Suggestions = assistantReply.Suggestions
        };

        await _hubContext.Clients.Group($"conversation-{id}")
            .SendAsync("ReceiveMessage", botResponse);
    }
}

            return Ok(userResponse);
        }
        [HttpPut("messages/{id}/read")]
        public async Task<IActionResult> MarkAsRead(int id)
        {
            var currentUserId = GetCurrentUserId();

            var message = await _context.Messages
                .Include(item => item.Conversation)
                .FirstOrDefaultAsync(item => item.Id == id, HttpContext.RequestAborted);

            if (message == null)
            {
                return NotFound(new { message = "Không tìm thấy tin nhắn." });
            }

            if (message.Conversation == null)
            {
                return BadRequest(new { message = "Hội thoại không hợp lệ." });
            }

            if (!IsAdmin() &&
                message.Conversation.UserId != currentUserId &&
                message.Conversation.SellerId != currentUserId)
            {
                return Forbid();
            }

            message.IsRead = true;
            await _context.SaveChangesAsync(HttpContext.RequestAborted);

            return Ok(new { message = "Đã đánh dấu đã đọc." });
        }
    }
}

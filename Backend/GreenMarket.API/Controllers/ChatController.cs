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

        [HttpPost("conversations")]
        public async Task<IActionResult> CreateConversation([FromBody] CreateConversationRequest request)
        {
            var currentUserId = GetCurrentUserId();

            var seller = await _context.Users.FirstOrDefaultAsync(x => x.Id == request.SellerId && x.Role == UserRoles.Seller);
            if (seller == null)
            {
                return BadRequest(new { message = "Seller không tồn tại." });
            }

            var existingConversation = await _context.Conversations
                .FirstOrDefaultAsync(x => x.UserId == currentUserId && x.SellerId == request.SellerId);

            if (existingConversation != null)
            {
                return Ok(existingConversation);
            }

            var conversation = new Conversation
            {
                UserId = currentUserId,
                SellerId = request.SellerId,
                CreatedAt = DateTime.UtcNow
            };

            _context.Conversations.Add(conversation);
            await _context.SaveChangesAsync();

            return Ok(conversation);
        }

        [HttpGet("conversations")]
        public async Task<IActionResult> GetConversations()
        {
            var currentUserId = GetCurrentUserId();

            var conversations = await _context.Conversations
                .Include(x => x.User)
                .Include(x => x.Seller)
                .Include(x => x.Messages)
                .Where(x => x.UserId == currentUserId || x.SellerId == currentUserId || IsAdmin())
                .OrderByDescending(x => x.Id)
                .Select(x => new
                {
                    x.Id,
                    x.UserId,
                    UserName = x.User != null ? x.User.Username : null,
                    x.SellerId,
                    SellerName = x.Seller != null ? x.Seller.Username : null,
                    x.CreatedAt,
                    LastMessage = x.Messages
                        .OrderByDescending(m => m.SentAt)
                        .Select(m => m.Content)
                        .FirstOrDefault(),
                    LastMessageAt = x.Messages
                        .OrderByDescending(m => m.SentAt)
                        .Select(m => m.SentAt)
                        .FirstOrDefault(),
                    UnreadCount = x.Messages.Count(m => !m.IsRead && m.SenderId != currentUserId),
                    BotMessageCount = x.Messages.Count(m => m.IsBot)
                })
                .ToListAsync();

            return Ok(conversations);
        }

        [HttpGet("conversations/{id}/messages")]
        public async Task<IActionResult> GetMessages(int id)
        {
            var currentUserId = GetCurrentUserId();

            var conversation = await _context.Conversations
                .FirstOrDefaultAsync(x => x.Id == id);

            if (conversation == null)
            {
                return NotFound(new { message = "Không tìm thấy hội thoại." });
            }

            if (!IsAdmin() && conversation.UserId != currentUserId && conversation.SellerId != currentUserId)
            {
                return Forbid();
            }

            var unreadMessages = await _context.Messages
                .Where(x => x.ConversationId == id && !x.IsRead && x.SenderId != currentUserId)
                .ToListAsync();

            if (unreadMessages.Any())
            {
                unreadMessages.ForEach(message => message.IsRead = true);
                await _context.SaveChangesAsync();
            }

            var messages = await _context.Messages
                .Include(x => x.Sender)
                .Where(x => x.ConversationId == id)
                .OrderBy(x => x.SentAt)
                .Select(x => new
                {
                    x.Id,
                    x.ConversationId,
                    x.SenderId,
                    SenderName = x.IsBot ? "AgriFresh AI" : (x.Sender != null ? x.Sender.Username : null),
                    x.Content,
                    x.IsRead,
                    x.IsBot,
                    x.SentAt
                })
                .ToListAsync();

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
                .FirstOrDefaultAsync(x => x.Id == id);

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
            await _context.SaveChangesAsync();

            var sender = await _context.Users.FindAsync(currentUserId);

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
                    await _context.SaveChangesAsync();

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
                .Include(x => x.Conversation)
                .FirstOrDefaultAsync(x => x.Id == id);

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
            await _context.SaveChangesAsync();

            return Ok(new { message = "Đã đánh dấu đã đọc." });
        }
    }
}

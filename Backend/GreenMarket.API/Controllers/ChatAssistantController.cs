using GreenMarket.API.DTOs;
using GreenMarket.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GreenMarket.API.Controllers
{
    [ApiController]
    [Route("api/chat-assistant")]
    [AllowAnonymous]
    public class ChatAssistantController : ControllerBase
    {
        private readonly StoreAssistantService _storeAssistantService;

        public ChatAssistantController(StoreAssistantService storeAssistantService)
        {
            _storeAssistantService = storeAssistantService;
        }

        [HttpPost("ask")]
        public async Task<IActionResult> Ask([FromBody] ChatAssistantRequestDto request)
        {
            if (string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest(new { message = "Vui lòng nhập nội dung cần hỗ trợ." });
            }

            var response = await _storeAssistantService.AskAsync(
                new StoreAssistantRequest(
                    request.Message,
                    request.SellerId,
                    request.ProductId,
                    request.OrderId,
                    request.ConversationId,
                    false),
                User,
                HttpContext.RequestAborted);

            return Ok(new
            {
                answer = response.Answer,
                suggestions = response.Suggestions,
                usedAi = response.UsedAi,
                topic = response.Topic,
                assistantName = response.AssistantName,
                handoffHint = response.HandoffHint
            });
        }
    }
}

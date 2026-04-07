namespace GreenMarket.API.DTOs
{
    public class CreateConversationRequest
    {
        public int SellerId { get; set; }
    }

    public class OpenConversationRequest
    {
        public int? SellerId { get; set; }
        public int? ShopId { get; set; }
        public int? ProductId { get; set; }
        public int? OrderId { get; set; }
    }

    public class SendMessageRequest
    {
        public string Content { get; set; } = string.Empty;
        public int? ProductId { get; set; }
        public int? OrderId { get; set; }
    }

    public class ChatAssistantRequestDto
    {
        public string Message { get; set; } = string.Empty;
        public int? SellerId { get; set; }
        public int? ProductId { get; set; }
        public int? OrderId { get; set; }
        public int? ConversationId { get; set; }
    }
}

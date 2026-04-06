using System.ComponentModel.DataAnnotations;

namespace GreenMarket.API.Models
{
    public class Message
    {
        public int Id { get; set; }

        public int ConversationId { get; set; }
        public Conversation? Conversation { get; set; }

        public int SenderId { get; set; }
        public User? Sender { get; set; }

        [Required]
        [MaxLength(2000)]
        public string Content { get; set; } = string.Empty;

        public bool IsRead { get; set; } = false;
        public bool IsBot { get; set; } = false;

        public DateTime SentAt { get; set; } = DateTime.UtcNow;
    }
}
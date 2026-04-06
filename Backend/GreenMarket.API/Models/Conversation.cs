using System.ComponentModel.DataAnnotations;

namespace GreenMarket.API.Models
{
    public class Conversation
    {
        public int Id { get; set; }

        public int UserId { get; set; }
        public User? User { get; set; }

        public int SellerId { get; set; }
        public User? Seller { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<Message> Messages { get; set; } = new List<Message>();
    }
}
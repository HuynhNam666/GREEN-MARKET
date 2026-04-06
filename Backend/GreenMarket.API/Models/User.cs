using System.ComponentModel.DataAnnotations;

namespace GreenMarket.API.Models
{
    public class User
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Username { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [MaxLength(150)]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string PasswordHash { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string Role { get; set; } = UserRoles.User;

        public bool IsLocked { get; set; } = false;
        public bool IsApproved { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public Cart? Cart { get; set; }
        public ICollection<Shop> Shops { get; set; } = new List<Shop>();
        public ICollection<Order> Orders { get; set; } = new List<Order>();
        public ICollection<Order> AssignedOrders { get; set; } = new List<Order>();

        public ICollection<Conversation> UserConversations { get; set; } = new List<Conversation>();
        public ICollection<Conversation> SellerConversations { get; set; } = new List<Conversation>();
        public ICollection<Message> Messages { get; set; } = new List<Message>();
    }
}
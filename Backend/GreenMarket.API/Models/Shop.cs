using System.ComponentModel.DataAnnotations;

namespace GreenMarket.API.Models
{
    public class Shop
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(150)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(500)]
        public string Description { get; set; } = string.Empty;

        public int SellerId { get; set; }

        public User? Seller { get; set; }

        public ICollection<Product> Products { get; set; } = new List<Product>();
    }
}
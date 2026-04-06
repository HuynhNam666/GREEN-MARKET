using System.ComponentModel.DataAnnotations;

namespace GreenMarket.API.Models
{
    public class Product
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string Description { get; set; } = string.Empty;

        [Range(0, 999999999)]
        public decimal Price { get; set; }

        [Range(0, int.MaxValue)]
        public int Stock { get; set; }

        [MaxLength(500)]
        public string ImageUrl { get; set; } = string.Empty;

        public int CategoryId { get; set; }
        public Category? Category { get; set; }

        public int ShopId { get; set; }
        public Shop? Shop { get; set; }
    }
}
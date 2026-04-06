namespace GreenMarket.API.DTOs
{
    public class ProductRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public int Stock { get; set; }
        public string ImageUrl { get; set; } = string.Empty;
        public int CategoryId { get; set; }
        public int ShopId { get; set; }
    }
}

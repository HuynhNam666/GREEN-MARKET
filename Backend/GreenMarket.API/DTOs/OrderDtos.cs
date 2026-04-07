namespace GreenMarket.API.DTOs
{
    public class CheckoutRequest
    {
        public string ShippingAddress { get; set; } = string.Empty;
        public string ContactName { get; set; } = string.Empty;
        public string ContactPhone { get; set; } = string.Empty;
        public string? PaymentMethod { get; set; }
        public string? Note { get; set; }
    }

    public class UpdateOrderStatusRequest
    {
        public string Status { get; set; } = string.Empty;
    }

    public class AssignShipperRequest
    {
        public int ShipperId { get; set; }
    }

    public class BecomeSellerRequest
    {
        public string ShopName { get; set; } = string.Empty;
        public string? ShopDescription { get; set; }
    }
}
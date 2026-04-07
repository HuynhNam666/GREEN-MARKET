namespace GreenMarket.API.Models
{
    public class Order
    {
        public int Id { get; set; }

        public int UserId { get; set; }
        public User? User { get; set; }

        public int? AssignedShipperId { get; set; }
        public User? AssignedShipper { get; set; }

        public string OrderCode { get; set; } = $"GM{DateTime.UtcNow:yyyyMMddHHmmss}";
        public DateTime OrderDate { get; set; } = DateTime.UtcNow;
        public decimal TotalAmount { get; set; }
        public string PaymentMethod { get; set; } = PaymentMethods.VNPay;
        public string PaymentStatus { get; set; } = PaymentStatuses.Unpaid;
        public string SettlementStatus { get; set; } = SettlementStatuses.NotReady;
        public string Status { get; set; } = OrderStatuses.PendingPayment;

        public string ShippingAddress { get; set; } = string.Empty;
        public string ContactName { get; set; } = string.Empty;
        public string ContactPhone { get; set; } = string.Empty;
        public string Note { get; set; } = string.Empty;

        public DateTime? ConfirmedAt { get; set; }
        public DateTime? ShippedAt { get; set; }
        public DateTime? DeliveredAt { get; set; }
        public DateTime? PaidAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public DateTime? CancelledAt { get; set; }

        public ICollection<OrderDetail> OrderDetails { get; set; } = new List<OrderDetail>();
    }
}
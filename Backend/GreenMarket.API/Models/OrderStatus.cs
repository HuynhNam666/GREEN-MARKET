namespace GreenMarket.API.Models
{
    public static class UserRoles
    {
        public const string Admin = "Admin";
        public const string Seller = "Seller";
        public const string User = "User";
        public const string Shipper = "Shipper";

        public static readonly string[] All = { Admin, Seller, User, Shipper };
    }

    public static class OrderStatuses
    {
        public const string PendingPayment = "PendingPayment";
        public const string AwaitingConfirmation = "AwaitingConfirmation";
        public const string Processing = "Processing";
        public const string ReadyToShip = "ReadyToShip";
        public const string Shipping = "Shipping";
        public const string Delivered = "Delivered";
        public const string Completed = "Completed";
        public const string Cancelled = "Cancelled";
        public const string FailedDelivery = "FailedDelivery";
        public const string ReturnRequested = "ReturnRequested";
        public const string Returned = "Returned";
        public const string PaymentFailed = "PaymentFailed";

        public static readonly string[] All =
        {
            PendingPayment,
            AwaitingConfirmation,
            Processing,
            ReadyToShip,
            Shipping,
            Delivered,
            Completed,
            Cancelled,
            FailedDelivery,
            ReturnRequested,
            Returned,
            PaymentFailed
        };

        public static bool CanTransition(string currentStatus, string newStatus)
        {
            if (string.Equals(currentStatus, newStatus, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            return currentStatus switch
            {
                PendingPayment => new[] { AwaitingConfirmation, Cancelled, PaymentFailed }.Contains(newStatus),
                AwaitingConfirmation => new[] { Processing, Cancelled }.Contains(newStatus),
                Processing => new[] { ReadyToShip, Cancelled }.Contains(newStatus),
                ReadyToShip => new[] { Shipping, Cancelled }.Contains(newStatus),
                Shipping => new[] { Delivered, FailedDelivery, ReturnRequested }.Contains(newStatus),
                Delivered => new[] { Completed, ReturnRequested }.Contains(newStatus),
                ReturnRequested => new[] { Returned }.Contains(newStatus),
                FailedDelivery => new[] { ReadyToShip, Cancelled }.Contains(newStatus),
                _ => false
            };
        }
    }
}
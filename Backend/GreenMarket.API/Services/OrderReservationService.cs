using GreenMarket.API.Data;
using GreenMarket.API.Models;
using Microsoft.EntityFrameworkCore;

namespace GreenMarket.API.Services
{
    public class OrderReservationService
    {
        private readonly AppDbContext _context;

        public OrderReservationService(AppDbContext context)
        {
            _context = context;
        }

        public bool IsReserved(Order? order)
        {
            return order != null && string.Equals(order.Status, OrderStatuses.PendingPayment, StringComparison.OrdinalIgnoreCase);
        }

        public async Task<Dictionary<int, int>> GetReservedQuantitiesAsync(
            IEnumerable<int> productIds,
            int? excludeOrderId = null,
            CancellationToken cancellationToken = default)
        {
            var ids = productIds
                .Select(id => id)
                .Distinct()
                .ToList();

            if (!ids.Any())
            {
                return new Dictionary<int, int>();
            }

            var query = _context.OrderDetails
                .AsNoTracking()
                .Where(detail => ids.Contains(detail.ProductId))
                .Where(detail => detail.Order != null && detail.Order.Status == OrderStatuses.PendingPayment);

            if (excludeOrderId.HasValue)
            {
                query = query.Where(detail => detail.OrderId != excludeOrderId.Value);
            }

            return await query
                .GroupBy(detail => detail.ProductId)
                .Select(group => new
                {
                    ProductId = group.Key,
                    Quantity = group.Sum(detail => detail.Quantity)
                })
                .ToDictionaryAsync(item => item.ProductId, item => item.Quantity, cancellationToken);
        }

        public async Task<int> GetAvailableStockAsync(
            int productId,
            int physicalStock,
            int? excludeOrderId = null,
            CancellationToken cancellationToken = default)
        {
            var reserved = await GetReservedQuantitiesAsync(new[] { productId }, excludeOrderId, cancellationToken);
            var reservedQuantity = reserved.TryGetValue(productId, out var value) ? value : 0;
            return Math.Max(physicalStock - reservedQuantity, 0);
        }

        public async Task<Dictionary<int, int>> GetAvailableStocksAsync(
            IDictionary<int, int> physicalStocks,
            int? excludeOrderId = null,
            CancellationToken cancellationToken = default)
        {
            var reserved = await GetReservedQuantitiesAsync(physicalStocks.Keys, excludeOrderId, cancellationToken);
            return physicalStocks.ToDictionary(
                item => item.Key,
                item => Math.Max(item.Value - (reserved.TryGetValue(item.Key, out var reservedQty) ? reservedQty : 0), 0));
        }
    }
}

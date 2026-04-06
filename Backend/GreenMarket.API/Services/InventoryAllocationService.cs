using GreenMarket.API.Data;
using GreenMarket.API.Models;
using Microsoft.EntityFrameworkCore;

namespace GreenMarket.API.Services
{
    public class InventoryAllocationService
    {
        private readonly AppDbContext _context;

        public InventoryAllocationService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<bool> CanCommitOrderAsync(int orderId, CancellationToken cancellationToken = default)
        {
            var details = await _context.OrderDetails
                .Include(detail => detail.Product)
                .Where(detail => detail.OrderId == orderId)
                .ToListAsync(cancellationToken);

            return details.All(detail => detail.Product != null && detail.Product.Stock >= detail.Quantity);
        }

        public async Task CommitStockForOrderAsync(int orderId, CancellationToken cancellationToken = default)
        {
            var details = await _context.OrderDetails
                .Include(detail => detail.Product)
                .Where(detail => detail.OrderId == orderId)
                .ToListAsync(cancellationToken);

            foreach (var detail in details)
            {
                if (detail.Product == null)
                {
                    throw new InvalidOperationException("Không tìm thấy sản phẩm trong chi tiết đơn hàng.");
                }

                if (detail.Product.Stock < detail.Quantity)
                {
                    throw new InvalidOperationException($"Sản phẩm {detail.Product.Name} không đủ tồn kho để xác nhận thanh toán.");
                }

                detail.Product.Stock -= detail.Quantity;
            }
        }

        public async Task ReleaseStockForOrderAsync(int orderId, CancellationToken cancellationToken = default)
        {
            var details = await _context.OrderDetails
                .Include(detail => detail.Product)
                .Where(detail => detail.OrderId == orderId)
                .ToListAsync(cancellationToken);

            foreach (var detail in details)
            {
                if (detail.Product == null)
                {
                    continue;
                }

                detail.Product.Stock += detail.Quantity;
            }
        }
    }
}

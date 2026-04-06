using System.Security.Claims;
using GreenMarket.API.Data;
using GreenMarket.API.DTOs;
using GreenMarket.API.Models;
using GreenMarket.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GreenMarket.API.Controllers
{
    [ApiController]
    [Route("api/orders")]
    [Authorize]
    public class OrderController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly VNPayService _vnpayService;
        private readonly OrderReservationService _reservationService;
        private readonly InventoryAllocationService _inventoryAllocationService;

        public OrderController(
            AppDbContext context,
            VNPayService vnpayService,
            OrderReservationService reservationService,
            InventoryAllocationService inventoryAllocationService)
        {
            _context = context;
            _vnpayService = vnpayService;
            _reservationService = reservationService;
            _inventoryAllocationService = inventoryAllocationService;
        }

        private int GetCurrentUserId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        private string GetCurrentRole() => User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
        private bool IsAdmin() => User.IsInRole(UserRoles.Admin);
        private bool IsSeller() => User.IsInRole(UserRoles.Seller);
        private bool IsShipper() => User.IsInRole(UserRoles.Shipper);

        private IQueryable<Order> BuildOrderQuery()
        {
            return _context.Orders
                .Include(x => x.User)
                .Include(x => x.AssignedShipper)
                .Include(x => x.OrderDetails)
                    .ThenInclude(x => x.Product)
                        .ThenInclude(x => x!.Shop);
        }

        private static string TranslateStatus(string status)
        {
            return status switch
            {
                OrderStatuses.PendingPayment => "Chờ thanh toán",
                OrderStatuses.AwaitingConfirmation => "Chờ xác nhận",
                OrderStatuses.Processing => "Đang xử lý",
                OrderStatuses.ReadyToShip => "Sẵn sàng giao",
                OrderStatuses.Shipping => "Đang giao hàng",
                OrderStatuses.Delivered => "Đã giao hàng",
                OrderStatuses.Completed => "Hoàn tất",
                OrderStatuses.Cancelled => "Đã hủy",
                OrderStatuses.FailedDelivery => "Giao thất bại",
                OrderStatuses.ReturnRequested => "Yêu cầu trả hàng",
                OrderStatuses.Returned => "Đã trả hàng",
                OrderStatuses.PaymentFailed => "Thanh toán thất bại",
                _ => status
            };
        }

        private static int GetProgressPercentage(string status)
        {
            return status switch
            {
                OrderStatuses.PendingPayment => 10,
                OrderStatuses.PaymentFailed => 10,
                OrderStatuses.AwaitingConfirmation => 25,
                OrderStatuses.Processing => 45,
                OrderStatuses.ReadyToShip => 60,
                OrderStatuses.Shipping => 80,
                OrderStatuses.Delivered => 92,
                OrderStatuses.Completed => 100,
                OrderStatuses.Cancelled => 100,
                OrderStatuses.FailedDelivery => 78,
                OrderStatuses.ReturnRequested => 88,
                OrderStatuses.Returned => 100,
                _ => 0
            };
        }

        private static string GetAttentionLabel(string status)
        {
            return status switch
            {
                OrderStatuses.PendingPayment => "Đơn đang giữ hàng chờ thanh toán.",
                OrderStatuses.PaymentFailed => "Thanh toán chưa thành công, cần tạo lại link thanh toán.",
                OrderStatuses.AwaitingConfirmation => "Shop cần xác nhận đơn để bắt đầu xử lý.",
                OrderStatuses.Processing => "Shop đang soạn hàng và chuẩn bị bàn giao.",
                OrderStatuses.ReadyToShip => "Đơn đã sẵn sàng để gán shipper hoặc nhận giao.",
                OrderStatuses.Shipping => "Shipper đang giao tới địa chỉ nhận hàng.",
                OrderStatuses.Delivered => "Đơn đã giao, chờ khách xác nhận hoàn tất.",
                OrderStatuses.Completed => "Đơn đã khép lại thành công.",
                OrderStatuses.Cancelled => "Đơn đã dừng xử lý.",
                OrderStatuses.FailedDelivery => "Cần xử lý giao lại hoặc hủy đơn.",
                OrderStatuses.ReturnRequested => "Đang chờ xử lý yêu cầu sau bán/đổi trả.",
                OrderStatuses.Returned => "Đơn đã kết thúc ở trạng thái trả hàng.",
                _ => string.Empty
            };
        }

        private static bool IsStockCommittedStatus(string status)
        {
            return status != OrderStatuses.PendingPayment
                && status != OrderStatuses.PaymentFailed
                && status != OrderStatuses.Cancelled;
        }

        private object BuildTimeline(Order order)
        {
            var stages = new List<object>
            {
                new
                {
                    Key = "created",
                    Title = "Tạo đơn",
                    Description = "Đơn hàng được tạo trong hệ thống.",
                    OccurredAt = order.OrderDate,
                    IsCompleted = true,
                    IsCurrent = false
                },
                new
                {
                    Key = "payment",
                    Title = order.Status == OrderStatuses.PaymentFailed ? "Thanh toán thất bại" : "Thanh toán",
                    Description = order.Status == OrderStatuses.PendingPayment
                        ? "Đang chờ khách hoàn tất thanh toán."
                        : order.Status == OrderStatuses.PaymentFailed
                            ? "Khách cần thử lại thanh toán."
                            : "Thanh toán đã được ghi nhận.",
                    OccurredAt = order.Status == OrderStatuses.PendingPayment || order.Status == OrderStatuses.PaymentFailed ? (DateTime?)null : order.OrderDate,
                    IsCompleted = order.Status != OrderStatuses.PendingPayment && order.Status != OrderStatuses.PaymentFailed,
                    IsCurrent = order.Status == OrderStatuses.PendingPayment || order.Status == OrderStatuses.PaymentFailed
                },
                new
                {
                    Key = "confirmation",
                    Title = "Xác nhận đơn",
                    Description = "Shop xác nhận và bắt đầu xử lý đơn.",
                    OccurredAt = order.ConfirmedAt,
                    IsCompleted = order.ConfirmedAt.HasValue || new[] { OrderStatuses.ReadyToShip, OrderStatuses.Shipping, OrderStatuses.Delivered, OrderStatuses.Completed, OrderStatuses.FailedDelivery, OrderStatuses.ReturnRequested, OrderStatuses.Returned }.Contains(order.Status),
                    IsCurrent = order.Status == OrderStatuses.AwaitingConfirmation || order.Status == OrderStatuses.Processing
                },
                new
                {
                    Key = "shipping",
                    Title = "Giao hàng",
                    Description = order.Status == OrderStatuses.FailedDelivery ? "Đã phát sinh lỗi khi giao." : "Đơn đang được bàn giao và vận chuyển.",
                    OccurredAt = order.ShippedAt,
                    IsCompleted = order.ShippedAt.HasValue || new[] { OrderStatuses.Delivered, OrderStatuses.Completed, OrderStatuses.FailedDelivery, OrderStatuses.ReturnRequested, OrderStatuses.Returned }.Contains(order.Status),
                    IsCurrent = new[] { OrderStatuses.ReadyToShip, OrderStatuses.Shipping, OrderStatuses.FailedDelivery }.Contains(order.Status)
                },
                new
                {
                    Key = "completion",
                    Title = order.Status == OrderStatuses.Cancelled ? "Đã hủy" : order.Status == OrderStatuses.Returned ? "Đã trả hàng" : "Hoàn tất",
                    Description = order.Status == OrderStatuses.Delivered
                        ? "Đơn đã giao thành công và chờ người mua xác nhận."
                        : order.Status == OrderStatuses.Completed
                            ? "Đơn đã hoàn tất."
                            : order.Status == OrderStatuses.Cancelled
                                ? "Đơn hàng đã bị hủy."
                                : order.Status == OrderStatuses.Returned
                                    ? "Đơn đã hoàn tất quy trình trả hàng."
                                    : "Đơn đang tiếp tục được xử lý.",
                    OccurredAt = order.CompletedAt ?? order.DeliveredAt ?? order.CancelledAt,
                    IsCompleted = new[] { OrderStatuses.Delivered, OrderStatuses.Completed, OrderStatuses.Cancelled, OrderStatuses.Returned }.Contains(order.Status),
                    IsCurrent = new[] { OrderStatuses.Delivered, OrderStatuses.Completed, OrderStatuses.Cancelled, OrderStatuses.Returned, OrderStatuses.ReturnRequested }.Contains(order.Status)
                }
            };

            return stages;
        }

        private object BuildShippingOverview(Order order)
        {
            return new
            {
                TrackingCode = $"TRK-{order.OrderCode}",
                CarrierLabel = order.AssignedShipper != null ? "Đội giao nội bộ Green Market" : "Đang chờ điều phối shipper",
                CurrentStatusLabel = TranslateStatus(order.Status),
                ProgressPercent = GetProgressPercentage(order.Status),
                AttentionLabel = GetAttentionLabel(order.Status),
                AssignedShipperName = order.AssignedShipper?.Username,
                DeliveryNote = order.Status switch
                {
                    OrderStatuses.ReadyToShip => "Shop đã đóng gói xong và chờ shipper nhận đơn.",
                    OrderStatuses.Shipping => order.ShippedAt.HasValue ? $"Đơn đã rời kho lúc {order.ShippedAt.Value:dd/MM/yyyy HH:mm}." : "Đơn đang trên đường giao tới khách.",
                    OrderStatuses.FailedDelivery => "Cần xác nhận lại địa chỉ, thời gian nhận hoặc thực hiện giao lại.",
                    OrderStatuses.Delivered => order.DeliveredAt.HasValue ? $"Đơn đã giao lúc {order.DeliveredAt.Value:dd/MM/yyyy HH:mm}." : "Đơn đã giao thành công.",
                    _ => GetAttentionLabel(order.Status)
                }
            };
        }

        private object MapOrder(Order order)
        {
            var sellerSlices = order.OrderDetails
                .GroupBy(detail => new
                {
                    ShopId = detail.Product?.ShopId,
                    ShopName = detail.Product?.Shop?.Name
                })
                .Select(group => new
                {
                    group.Key.ShopId,
                    group.Key.ShopName,
                    ItemCount = group.Sum(detail => detail.Quantity),
                    Subtotal = group.Sum(detail => detail.Price * detail.Quantity),
                    Items = group.Select(detail => new
                    {
                        detail.Id,
                        detail.ProductId,
                        ProductName = detail.Product?.Name,
                        ImageUrl = detail.Product?.ImageUrl,
                        detail.Quantity,
                        detail.Price,
                        LineTotal = detail.Quantity * detail.Price
                    })
                });

            return new
            {
                order.Id,
                order.UserId,
                User = order.User == null
                    ? null
                    : new
                    {
                        order.User.Id,
                        order.User.Username,
                        order.User.Email,
                        order.User.Role
                    },
                order.AssignedShipperId,
                AssignedShipper = order.AssignedShipper == null
                    ? null
                    : new
                    {
                        order.AssignedShipper.Id,
                        order.AssignedShipper.Username,
                        order.AssignedShipper.Email,
                        order.AssignedShipper.Role
                    },
                order.OrderCode,
                order.OrderDate,
                order.TotalAmount,
                order.Status,
                StatusLabel = TranslateStatus(order.Status),
                order.ShippingAddress,
                order.ContactName,
                order.ContactPhone,
                order.Note,
                order.ConfirmedAt,
                order.ShippedAt,
                order.DeliveredAt,
                order.CompletedAt,
                order.CancelledAt,
                ProgressPercent = GetProgressPercentage(order.Status),
                ReservationState = new
                {
                    IsHoldingStock = _reservationService.IsReserved(order),
                    Label = _reservationService.IsReserved(order)
                        ? "Hàng đang được giữ cho đơn chờ thanh toán."
                        : "Tồn kho đã được ghi nhận theo trạng thái đơn hiện tại."
                },
                Shipping = BuildShippingOverview(order),
                Timeline = BuildTimeline(order),
                SellerSlices = sellerSlices,
                OrderDetails = order.OrderDetails.Select(detail => new
                {
                    detail.Id,
                    detail.ProductId,
                    ProductName = detail.Product?.Name,
                    ImageUrl = detail.Product?.ImageUrl,
                    ShopId = detail.Product?.ShopId,
                    ShopName = detail.Product?.Shop?.Name,
                    detail.Quantity,
                    detail.Price,
                    LineTotal = detail.Quantity * detail.Price
                })
            };
        }

        private async Task<bool> SellerOwnsOrderAsync(Order order, int sellerId)
        {
            return await _context.OrderDetails
                .Include(x => x.Product)
                    .ThenInclude(x => x!.Shop)
                .AnyAsync(x => x.OrderId == order.Id && x.Product != null && x.Product.Shop != null && x.Product.Shop.SellerId == sellerId);
        }

        private async Task<bool> CanAccessOrderAsync(Order order, int userId)
        {
            if (IsAdmin()) return true;
            if (order.UserId == userId) return true;
            if (IsShipper() && order.AssignedShipperId == userId) return true;
            if (IsSeller() && await SellerOwnsOrderAsync(order, userId)) return true;
            return false;
        }

        [HttpGet("my")]
        public async Task<IActionResult> GetMyOrders()
        {
            var userId = GetCurrentUserId();
            var query = BuildOrderQuery();

            List<Order> orders;
            if (IsAdmin())
            {
                orders = await query.OrderByDescending(x => x.Id).ToListAsync();
            }
            else if (IsSeller())
            {
                orders = await query
                    .Where(x => x.OrderDetails.Any(od => od.Product != null && od.Product.Shop != null && od.Product.Shop.SellerId == userId))
                    .OrderByDescending(x => x.Id)
                    .ToListAsync();
            }
            else if (IsShipper())
            {
                orders = await query
                    .Where(x => x.AssignedShipperId == userId)
                    .OrderByDescending(x => x.Id)
                    .ToListAsync();
            }
            else
            {
                orders = await query
                    .Where(x => x.UserId == userId)
                    .OrderByDescending(x => x.Id)
                    .ToListAsync();
            }

            return Ok(orders.Select(MapOrder));
        }

        [HttpGet("available-for-shipping")]
        [Authorize(Roles = "Shipper,Admin")]
        public async Task<IActionResult> GetAvailableForShipping()
        {
            var orders = await BuildOrderQuery()
                .Where(x => x.Status == OrderStatuses.ReadyToShip && x.AssignedShipperId == null)
                .OrderByDescending(x => x.Id)
                .ToListAsync();

            return Ok(orders.Select(MapOrder));
        }

        [HttpGet("{orderId}")]
        public async Task<IActionResult> GetOrderById(int orderId)
        {
            var userId = GetCurrentUserId();
            var order = await BuildOrderQuery().FirstOrDefaultAsync(x => x.Id == orderId);
            if (order == null)
            {
                return NotFound(new { message = "Không tìm thấy đơn hàng." });
            }

            if (!await CanAccessOrderAsync(order, userId))
            {
                return Forbid();
            }

            return Ok(MapOrder(order));
        }

        [HttpPost("checkout")]
        [Authorize(Roles = "User")]
        public async Task<IActionResult> Checkout([FromBody] CheckoutRequest request)
        {
            var userId = GetCurrentUserId();

            var cart = await _context.Carts
                .Include(x => x.CartItems)
                .ThenInclude(x => x.Product)
                .FirstOrDefaultAsync(x => x.UserId == userId);

            if (cart == null || !cart.CartItems.Any())
            {
                return BadRequest(new { message = "Giỏ hàng đang trống." });
            }

            if (string.IsNullOrWhiteSpace(request.ShippingAddress) ||
                string.IsNullOrWhiteSpace(request.ContactName) ||
                string.IsNullOrWhiteSpace(request.ContactPhone))
            {
                return BadRequest(new { message = "Vui lòng nhập đầy đủ thông tin giao hàng." });
            }

            foreach (var item in cart.CartItems)
            {
                if (item.Product == null)
                {
                    return BadRequest(new { message = "Có sản phẩm không tồn tại trong giỏ hàng." });
                }

                var availableStock = await _reservationService.GetAvailableStockAsync(item.ProductId, item.Product.Stock, null, HttpContext.RequestAborted);
                if (item.Quantity > availableStock)
                {
                    return BadRequest(new { message = $"Sản phẩm {item.Product.Name} không đủ tồn kho khả dụng." });
                }
            }

            await using var transaction = await _context.Database.BeginTransactionAsync();

            var order = new Order
            {
                UserId = userId,
                OrderDate = DateTime.UtcNow,
                OrderCode = $"GM{DateTime.UtcNow:yyyyMMddHHmmssfff}",
                Status = OrderStatuses.PendingPayment,
                TotalAmount = cart.CartItems.Sum(x => x.Price * x.Quantity),
                ShippingAddress = request.ShippingAddress.Trim(),
                ContactName = request.ContactName.Trim(),
                ContactPhone = request.ContactPhone.Trim(),
                Note = request.Note?.Trim() ?? string.Empty
            };

            _context.Orders.Add(order);
            await _context.SaveChangesAsync();

            foreach (var item in cart.CartItems)
            {
                _context.OrderDetails.Add(new OrderDetail
                {
                    OrderId = order.Id,
                    ProductId = item.ProductId,
                    Quantity = item.Quantity,
                    Price = item.Price
                });
            }

            _context.CartItems.RemoveRange(cart.CartItems);
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            var createdOrder = await BuildOrderQuery().FirstAsync(x => x.Id == order.Id);
            return Ok(MapOrder(createdOrder));
        }

        [HttpPost("{orderId}/pay-url")]
        [Authorize(Roles = "User")]
        public async Task<IActionResult> CreatePaymentUrl(int orderId)
        {
            var userId = GetCurrentUserId();

            var order = await _context.Orders.FirstOrDefaultAsync(x => x.Id == orderId && x.UserId == userId);
            if (order == null)
            {
                return NotFound(new { message = "Không tìm thấy đơn hàng." });
            }

            if (order.Status == OrderStatuses.PaymentFailed)
            {
                order.Status = OrderStatuses.PendingPayment;
                await _context.SaveChangesAsync();
            }

            if (order.Status != OrderStatuses.PendingPayment)
            {
                return BadRequest(new { message = "Đơn hàng không ở trạng thái chờ thanh toán." });
            }

            var paymentUrl = _vnpayService.CreatePaymentUrl(order, HttpContext);
            return Ok(new { paymentUrl });
        }

        [HttpPut("{orderId}/assign-shipper")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> AssignShipper(int orderId, [FromBody] AssignShipperRequest request)
        {
            var order = await _context.Orders.FindAsync(orderId);
            if (order == null) return NotFound(new { message = "Không tìm thấy đơn hàng." });

            if (order.Status != OrderStatuses.ReadyToShip && order.Status != OrderStatuses.FailedDelivery)
            {
                return BadRequest(new { message = "Chỉ gán shipper cho đơn đã sẵn sàng giao hoặc giao thất bại." });
            }

            var shipper = await _context.Users.FirstOrDefaultAsync(x => x.Id == request.ShipperId && x.Role == UserRoles.Shipper);
            if (shipper == null)
            {
                return BadRequest(new { message = "Shipper không tồn tại hoặc không hợp lệ." });
            }

            order.AssignedShipperId = request.ShipperId;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Gán shipper thành công." });
        }

        [HttpPut("{orderId}/accept-delivery")]
        [Authorize(Roles = "Shipper")]
        public async Task<IActionResult> AcceptDelivery(int orderId)
        {
            var userId = GetCurrentUserId();
            var order = await _context.Orders.FindAsync(orderId);
            if (order == null) return NotFound(new { message = "Không tìm thấy đơn hàng." });

            if (order.AssignedShipperId.HasValue && order.AssignedShipperId != userId)
            {
                return BadRequest(new { message = "Đơn đã được nhận bởi shipper khác." });
            }

            if (order.Status != OrderStatuses.ReadyToShip)
            {
                return BadRequest(new { message = "Đơn chưa sẵn sàng để giao." });
            }

            order.AssignedShipperId = userId;
            order.Status = OrderStatuses.Shipping;
            order.ShippedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Nhận đơn giao thành công." });
        }

        [HttpPut("{orderId}/status")]
        public async Task<IActionResult> UpdateStatus(int orderId, [FromBody] UpdateOrderStatusRequest request)
        {
            var userId = GetCurrentUserId();
            var newStatus = request.Status?.Trim() ?? string.Empty;

            if (!OrderStatuses.All.Contains(newStatus))
            {
                return BadRequest(new { message = "Trạng thái đơn hàng không hợp lệ." });
            }

            var order = await _context.Orders.FirstOrDefaultAsync(x => x.Id == orderId);
            if (order == null)
            {
                return NotFound(new { message = "Không tìm thấy đơn hàng." });
            }

            var canAccess = await CanAccessOrderAsync(order, userId);
            if (!canAccess)
            {
                return Forbid();
            }

            var role = GetCurrentRole();
            var currentStatus = order.Status;

            var allowedByRole = role switch
            {
                UserRoles.Admin => true,
                UserRoles.Seller => new[] { OrderStatuses.Processing, OrderStatuses.ReadyToShip, OrderStatuses.Cancelled }.Contains(newStatus),
                UserRoles.Shipper => new[] { OrderStatuses.Shipping, OrderStatuses.Delivered, OrderStatuses.FailedDelivery }.Contains(newStatus),
                UserRoles.User => new[] { OrderStatuses.Completed, OrderStatuses.Cancelled, OrderStatuses.ReturnRequested }.Contains(newStatus),
                _ => false
            };

            if (!allowedByRole)
            {
                return BadRequest(new { message = $"Vai trò {role} không được cập nhật sang trạng thái {newStatus}." });
            }

            if (!OrderStatuses.CanTransition(currentStatus, newStatus) && !IsAdmin())
            {
                return BadRequest(new { message = $"Không thể chuyển từ {currentStatus} sang {newStatus}." });
            }

            await using var transaction = await _context.Database.BeginTransactionAsync();

            if (newStatus == OrderStatuses.Cancelled && IsStockCommittedStatus(currentStatus))
            {
                await _inventoryAllocationService.ReleaseStockForOrderAsync(order.Id, HttpContext.RequestAborted);
            }

            order.Status = newStatus;

            if (newStatus == OrderStatuses.Processing) order.ConfirmedAt = DateTime.UtcNow;
            if (newStatus == OrderStatuses.Shipping) order.ShippedAt = DateTime.UtcNow;
            if (newStatus == OrderStatuses.Delivered) order.DeliveredAt = DateTime.UtcNow;
            if (newStatus == OrderStatuses.Completed) order.CompletedAt = DateTime.UtcNow;
            if (newStatus == OrderStatuses.Cancelled)
            {
                order.CancelledAt = DateTime.UtcNow;
                if (order.AssignedShipperId.HasValue)
                {
                    order.AssignedShipperId = null;
                }
            }

            await _context.SaveChangesAsync(HttpContext.RequestAborted);
            await transaction.CommitAsync(HttpContext.RequestAborted);

            return Ok(new
            {
                message = "Cập nhật trạng thái đơn hàng thành công.",
                status = order.Status
            });
        }
    }
}

using GreenMarket.API.Data;
using GreenMarket.API.Models;
using GreenMarket.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GreenMarket.API.Controllers
{
    [ApiController]
    [Route("api/payment")]
    public class PaymentController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly VNPayService _vnpayService;
        private readonly InventoryAllocationService _inventoryAllocationService;

        public PaymentController(
            AppDbContext context,
            VNPayService vnpayService,
            InventoryAllocationService inventoryAllocationService)
        {
            _context = context;
            _vnpayService = vnpayService;
            _inventoryAllocationService = inventoryAllocationService;
        }

        [HttpGet("callback")]
        public async Task<IActionResult> Callback()
        {
            var isValidSignature = _vnpayService.ValidateSignature(Request.Query);
            if (!isValidSignature)
            {
                return BadRequest(new { message = "Chữ ký không hợp lệ." });
            }

            var responseCode = Request.Query["vnp_ResponseCode"].ToString();
            var txnRef = Request.Query["vnp_TxnRef"].ToString();

            if (!int.TryParse(txnRef, out var orderId))
            {
                return BadRequest(new { message = "TxnRef không hợp lệ." });
            }

            var order = await _context.Orders.FirstOrDefaultAsync(x => x.Id == orderId);
            if (order == null)
            {
                return NotFound(new { message = "Không tìm thấy đơn hàng." });
            }

            if (responseCode != "00")
            {
                if (order.Status == OrderStatuses.PendingPayment)
                {
                    order.Status = OrderStatuses.PaymentFailed;
                    await _context.SaveChangesAsync();
                }

                return Ok(new
                {
                    message = "Thanh toán không thành công.",
                    orderId = order.Id,
                    status = order.Status
                });
            }

            if (order.Status == OrderStatuses.AwaitingConfirmation ||
                order.Status == OrderStatuses.Processing ||
                order.Status == OrderStatuses.ReadyToShip ||
                order.Status == OrderStatuses.Shipping ||
                order.Status == OrderStatuses.Delivered ||
                order.Status == OrderStatuses.Completed)
            {
                return Ok(new
                {
                    message = "Đơn hàng đã được xác nhận trước đó.",
                    orderId = order.Id,
                    status = order.Status
                });
            }

            if (order.Status != OrderStatuses.PendingPayment && order.Status != OrderStatuses.PaymentFailed)
            {
                return BadRequest(new
                {
                    message = "Đơn hàng không còn hợp lệ để xác nhận thanh toán.",
                    orderId = order.Id,
                    status = order.Status
                });
            }

            await using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var canCommitStock = await _inventoryAllocationService.CanCommitOrderAsync(order.Id, HttpContext.RequestAborted);
                if (!canCommitStock)
                {
                    order.Status = OrderStatuses.PaymentFailed;
                    await _context.SaveChangesAsync(HttpContext.RequestAborted);
                    await transaction.CommitAsync(HttpContext.RequestAborted);

                    return Ok(new
                    {
                        message = "Thanh toán đã nhận nhưng tồn kho không còn đủ. Vui lòng liên hệ shop để được hỗ trợ.",
                        orderId = order.Id,
                        status = order.Status
                    });
                }

                await _inventoryAllocationService.CommitStockForOrderAsync(order.Id, HttpContext.RequestAborted);
                order.Status = OrderStatuses.AwaitingConfirmation;
                await _context.SaveChangesAsync(HttpContext.RequestAborted);
                await transaction.CommitAsync(HttpContext.RequestAborted);

                return Ok(new
                {
                    message = "Thanh toán thành công. Đơn hàng đang chờ shop xác nhận.",
                    orderId = order.Id,
                    status = order.Status
                });
            }
            catch (Exception)
            {
                await transaction.RollbackAsync(HttpContext.RequestAborted);
                throw;
            }
        }
    }
}

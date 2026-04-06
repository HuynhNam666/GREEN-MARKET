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
    [Route("api/cart")]
    [Authorize]
    public class CartController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly OrderReservationService _reservationService;

        public CartController(AppDbContext context, OrderReservationService reservationService)
        {
            _context = context;
            _reservationService = reservationService;
        }

        private int GetCurrentUserId()
        {
            return int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        }

        private IQueryable<Cart> BuildCartQuery()
        {
            return _context.Carts
                .Include(x => x.CartItems)
                    .ThenInclude(x => x.Product)
                        .ThenInclude(x => x!.Category)
                .Include(x => x.CartItems)
                    .ThenInclude(x => x.Product)
                        .ThenInclude(x => x!.Shop);
        }

        private async Task<Cart> GetOrCreateCartAsync(int userId)
        {
            var cart = await BuildCartQuery().FirstOrDefaultAsync(x => x.UserId == userId);

            if (cart != null) return cart;

            cart = new Cart { UserId = userId };
            _context.Carts.Add(cart);
            await _context.SaveChangesAsync();

            return await BuildCartQuery().FirstAsync(x => x.UserId == userId);
        }

        [HttpGet]
        public async Task<IActionResult> GetCart()
        {
            var userId = GetCurrentUserId();
            var cart = await GetOrCreateCartAsync(userId);
            var products = cart.CartItems
                .Where(item => item.Product != null)
                .Select(item => item.Product!)
                .DistinctBy(product => product.Id)
                .ToDictionary(product => product.Id, product => product.Stock);
            var availableStocks = await _reservationService.GetAvailableStocksAsync(products, null, HttpContext.RequestAborted);

            var result = new
            {
                cart.Id,
                cart.UserId,
                items = cart.CartItems.Select(x => new
                {
                    x.Id,
                    x.ProductId,
                    productName = x.Product != null ? x.Product.Name : string.Empty,
                    imageUrl = x.Product != null ? x.Product.ImageUrl : string.Empty,
                    categoryName = x.Product?.Category != null ? x.Product.Category.Name : string.Empty,
                    shopName = x.Product?.Shop != null ? x.Product.Shop.Name : string.Empty,
                    stock = x.Product != null && availableStocks.TryGetValue(x.Product.Id, out var availableStock) ? availableStock : 0,
                    physicalStock = x.Product?.Stock ?? 0,
                    x.Quantity,
                    x.Price,
                    lineTotal = x.Quantity * x.Price
                }),
                total = cart.CartItems.Sum(x => x.Quantity * x.Price)
            };

            return Ok(result);
        }

        [HttpPost("add")]
        public async Task<IActionResult> AddToCart([FromBody] AddToCartRequest request)
        {
            if (request.Quantity <= 0)
            {
                return BadRequest(new { message = "Số lượng phải lớn hơn 0." });
            }

            var userId = GetCurrentUserId();
            var product = await _context.Products.FindAsync(request.ProductId);

            if (product == null)
            {
                return NotFound(new { message = "Sản phẩm không tồn tại." });
            }

            var availableStock = await _reservationService.GetAvailableStockAsync(product.Id, product.Stock, null, HttpContext.RequestAborted);
            if (availableStock < request.Quantity)
            {
                return BadRequest(new { message = "Không đủ tồn kho khả dụng." });
            }

            var cart = await GetOrCreateCartAsync(userId);

            var existingItem = cart.CartItems.FirstOrDefault(x => x.ProductId == request.ProductId);
            if (existingItem != null)
            {
                var newQuantity = existingItem.Quantity + request.Quantity;
                if (newQuantity > availableStock)
                {
                    return BadRequest(new { message = "Vượt quá tồn kho khả dụng." });
                }

                existingItem.Quantity = newQuantity;
                existingItem.Price = product.Price;
            }
            else
            {
                var item = new CartItem
                {
                    CartId = cart.Id,
                    ProductId = product.Id,
                    Quantity = request.Quantity,
                    Price = product.Price
                };

                _context.CartItems.Add(item);
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Đã thêm vào giỏ hàng." });
        }

        [HttpPut("items/{id}")]
        public async Task<IActionResult> UpdateItem(int id, [FromBody] UpdateCartItemRequest request)
        {
            if (request.Quantity <= 0)
            {
                return BadRequest(new { message = "Số lượng phải lớn hơn 0." });
            }

            var userId = GetCurrentUserId();

            var item = await _context.CartItems
                .Include(x => x.Cart)
                .Include(x => x.Product)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (item == null) return NotFound(new { message = "Không tìm thấy item." });
            if (item.Cart == null || item.Cart.UserId != userId) return Forbid();
            if (item.Product == null) return BadRequest(new { message = "Sản phẩm không tồn tại." });

            var availableStock = await _reservationService.GetAvailableStockAsync(item.Product.Id, item.Product.Stock, null, HttpContext.RequestAborted);
            if (request.Quantity > availableStock)
            {
                return BadRequest(new { message = "Vượt quá tồn kho khả dụng." });
            }

            item.Quantity = request.Quantity;
            item.Price = item.Product.Price;

            await _context.SaveChangesAsync();

            return Ok(new { message = "Cập nhật giỏ hàng thành công." });
        }

        [HttpDelete("items/{id}")]
        public async Task<IActionResult> RemoveItem(int id)
        {
            var userId = GetCurrentUserId();

            var item = await _context.CartItems
                .Include(x => x.Cart)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (item == null) return NotFound(new { message = "Không tìm thấy item." });
            if (item.Cart == null || item.Cart.UserId != userId) return Forbid();

            _context.CartItems.Remove(item);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Đã xóa sản phẩm khỏi giỏ hàng." });
        }
    }
}

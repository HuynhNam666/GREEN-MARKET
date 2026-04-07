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
    [Route("api/products")]
    public class ProductController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;
        private readonly OrderReservationService _reservationService;

        public ProductController(
            AppDbContext context,
            IWebHostEnvironment env,
            OrderReservationService reservationService)
        {
            _context = context;
            _env = env;
            _reservationService = reservationService;
        }

        private int GetCurrentUserId()
        {
            return int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        }

        private bool IsAdmin()
        {
            return User.IsInRole("Admin");
        }

        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetProducts(
            [FromQuery] string? keyword,
            [FromQuery] int? categoryId,
            [FromQuery] int? shopId)
        {
            var query = _context.Products
                .Include(x => x.Category)
                .Include(x => x.Shop)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x => x.Name.Contains(keyword) || x.Description.Contains(keyword));
            }

            if (categoryId.HasValue)
            {
                query = query.Where(x => x.CategoryId == categoryId.Value);
            }

            if (shopId.HasValue)
            {
                query = query.Where(x => x.ShopId == shopId.Value);
            }

            var rawProducts = await query
                .OrderByDescending(x => x.Id)
                .Select(x => new
                {
                    x.Id,
                    x.Name,
                    x.Description,
                    x.Price,
                    x.Stock,
                    x.ImageUrl,
                    x.CategoryId,
                    CategoryName = x.Category != null ? x.Category.Name : null,
                    x.ShopId,
                    ShopName = x.Shop != null ? x.Shop.Name : null,
                    SellerId = x.Shop != null ? x.Shop.SellerId : (int?)null
                })
                .ToListAsync();

            var availableStocks = await _reservationService.GetAvailableStocksAsync(
                rawProducts.ToDictionary(item => item.Id, item => item.Stock),
                null,
                HttpContext.RequestAborted);

            var products = rawProducts.Select(product =>
            {
                var availableStock = availableStocks.TryGetValue(product.Id, out var value) ? value : product.Stock;
                return new
                {
                    product.Id,
                    product.Name,
                    product.Description,
                    product.Price,
                    Stock = availableStock,
                    PhysicalStock = product.Stock,
                    ReservedStock = Math.Max(product.Stock - availableStock, 0),
                    product.ImageUrl,
                    product.CategoryId,
                    product.CategoryName,
                    product.ShopId,
                    product.ShopName,
                    product.SellerId
                };
            });

            return Ok(products);
        }

        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetProduct(int id)
        {
            var product = await _context.Products
                .Include(x => x.Category)
                .Include(x => x.Shop)
                .Where(x => x.Id == id)
                .Select(x => new
                {
                    x.Id,
                    x.Name,
                    x.Description,
                    x.Price,
                    x.Stock,
                    x.ImageUrl,
                    x.CategoryId,
                    CategoryName = x.Category != null ? x.Category.Name : null,
                    x.ShopId,
                    ShopName = x.Shop != null ? x.Shop.Name : null,
                    SellerId = x.Shop != null ? x.Shop.SellerId : (int?)null
                })
                .FirstOrDefaultAsync();

            if (product == null) return NotFound(new { message = "Không tìm thấy sản phẩm." });

            var availableStock = await _reservationService.GetAvailableStockAsync(product.Id, product.Stock, null, HttpContext.RequestAborted);
            return Ok(new
            {
                product.Id,
                product.Name,
                product.Description,
                product.Price,
                Stock = availableStock,
                PhysicalStock = product.Stock,
                ReservedStock = Math.Max(product.Stock - availableStock, 0),
                product.ImageUrl,
                product.CategoryId,
                product.CategoryName,
                product.ShopId,
                product.ShopName,
                product.SellerId
            });
        }

        [HttpPost]
        [Authorize(Roles = "Seller,Admin")]
        public async Task<IActionResult> Create([FromBody] ProductRequest request)
        {
            if (request.Price < 0 || request.Stock < 0)
            {
                return BadRequest(new { message = "Giá và tồn kho phải lớn hơn hoặc bằng 0." });
            }

            var categoryExists = await _context.Categories.AnyAsync(x => x.Id == request.CategoryId);
            if (!categoryExists)
            {
                return BadRequest(new { message = "Danh mục không tồn tại." });
            }

            var shop = await _context.Shops.FindAsync(request.ShopId);
            if (shop == null)
            {
                return BadRequest(new { message = "Shop không tồn tại." });
            }

            var userId = GetCurrentUserId();
            if (!IsAdmin() && shop.SellerId != userId)
            {
                return Forbid();
            }

            var product = new Product
            {
                Name = request.Name.Trim(),
                Description = request.Description?.Trim() ?? string.Empty,
                Price = request.Price,
                Stock = request.Stock,
                ImageUrl = request.ImageUrl?.Trim() ?? string.Empty,
                CategoryId = request.CategoryId,
                ShopId = request.ShopId
            };

            _context.Products.Add(product);
            await _context.SaveChangesAsync();

            return Ok(product);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Seller,Admin")]
        public async Task<IActionResult> Update(int id, [FromBody] ProductRequest request)
        {
            var product = await _context.Products.FindAsync(id);
            if (product == null) return NotFound(new { message = "Không tìm thấy sản phẩm." });

            var shop = await _context.Shops.FindAsync(product.ShopId);
            if (shop == null) return BadRequest(new { message = "Shop không tồn tại." });

            var userId = GetCurrentUserId();
            if (!IsAdmin() && shop.SellerId != userId)
            {
                return Forbid();
            }

            if (request.Price < 0 || request.Stock < 0)
            {
                return BadRequest(new { message = "Giá và tồn kho phải lớn hơn hoặc bằng 0." });
            }

            var categoryExists = await _context.Categories.AnyAsync(x => x.Id == request.CategoryId);
            if (!categoryExists)
            {
                return BadRequest(new { message = "Danh mục không tồn tại." });
            }

            var newShop = await _context.Shops.FindAsync(request.ShopId);
            if (newShop == null)
            {
                return BadRequest(new { message = "Shop không tồn tại." });
            }

            if (!IsAdmin() && newShop.SellerId != userId)
            {
                return Forbid();
            }

            product.Name = request.Name.Trim();
            product.Description = request.Description?.Trim() ?? string.Empty;
            product.Price = request.Price;
            product.Stock = request.Stock;
            product.ImageUrl = request.ImageUrl?.Trim() ?? string.Empty;
            product.CategoryId = request.CategoryId;
            product.ShopId = request.ShopId;

            await _context.SaveChangesAsync();

            return Ok(product);
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Seller,Admin")]
        public async Task<IActionResult> Delete(int id)
        {
            var product = await _context.Products.FindAsync(id);
            if (product == null) return NotFound(new { message = "Không tìm thấy sản phẩm." });

            var shop = await _context.Shops.FindAsync(product.ShopId);
            if (shop == null) return BadRequest(new { message = "Shop không tồn tại." });

            var userId = GetCurrentUserId();
            if (!IsAdmin() && shop.SellerId != userId)
            {
                return Forbid();
            }

            _context.Products.Remove(product);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Đã xóa sản phẩm." });
        }

        [HttpPost("upload")]
        [Authorize(Roles = "Seller,Admin")]
        public async Task<IActionResult> Upload(IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { message = "File không hợp lệ." });
            }

            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };
            var extension = Path.GetExtension(file.FileName).ToLower();

            if (!allowedExtensions.Contains(extension))
            {
                return BadRequest(new { message = "Chỉ cho phép jpg, jpeg, png, webp." });
            }

            if (file.Length > 5 * 1024 * 1024)
            {
                return BadRequest(new { message = "File vượt quá 5MB." });
            }

            var uploadsFolder = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "images");
            if (!Directory.Exists(uploadsFolder))
            {
                Directory.CreateDirectory(uploadsFolder);
            }

            var fileName = $"{Guid.NewGuid()}{extension}";
            var filePath = Path.Combine(uploadsFolder, fileName);

            await using var stream = new FileStream(filePath, FileMode.Create);
            await file.CopyToAsync(stream);

            return Ok(new { url = $"/images/{fileName}" });
        }
    }
}

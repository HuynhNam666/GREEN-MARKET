using System.Security.Claims;
using GreenMarket.API.Data;
using GreenMarket.API.DTOs;
using GreenMarket.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GreenMarket.API.Controllers
{
    [ApiController]
    [Route("api/shops")]
    public class ShopController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ShopController(AppDbContext context)
        {
            _context = context;
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
        public async Task<IActionResult> GetShops()
        {
            var shops = await _context.Shops
                .Select(x => new
                {
                    x.Id,
                    x.Name,
                    x.Description,
                    x.SellerId
                })
                .ToListAsync();

            return Ok(shops);
        }

        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetShop(int id)
        {
            var shop = await _context.Shops
                .Where(x => x.Id == id)
                .Select(x => new
                {
                    x.Id,
                    x.Name,
                    x.Description,
                    x.SellerId
                })
                .FirstOrDefaultAsync();

            if (shop == null) return NotFound(new { message = "Không tìm thấy shop." });

            return Ok(shop);
        }

        [HttpPost]
[Authorize(Roles = "Seller,Admin")]
public async Task<IActionResult> Create([FromBody] ShopRequest request)
{
    if (string.IsNullOrWhiteSpace(request.Name))
    {
        return BadRequest(new { message = "Tên shop không được để trống." });
    }

    var userId = GetCurrentUserId();

    var shop = new Shop
    {
        Name = request.Name.Trim(),
        Description = request.Description?.Trim() ?? string.Empty,
        SellerId = userId
    };

    _context.Shops.Add(shop);
    await _context.SaveChangesAsync();

    return Ok(shop);
}
        [HttpPut("{id}")]
        [Authorize(Roles = "Seller,Admin")]
        public async Task<IActionResult> Update(int id, [FromBody] ShopRequest request)
        {
            var shop = await _context.Shops.FindAsync(id);
            if (shop == null) return NotFound(new { message = "Không tìm thấy shop." });

            var userId = GetCurrentUserId();
            if (!IsAdmin() && shop.SellerId != userId)
            {
                return Forbid();
            }

            shop.Name = request.Name.Trim();
            shop.Description = request.Description?.Trim() ?? string.Empty;

            await _context.SaveChangesAsync();

            return Ok(shop);
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Seller,Admin")]
        public async Task<IActionResult> Delete(int id)
        {
            var shop = await _context.Shops.FindAsync(id);
            if (shop == null) return NotFound(new { message = "Không tìm thấy shop." });

            var userId = GetCurrentUserId();
            if (!IsAdmin() && shop.SellerId != userId)
            {
                return Forbid();
            }

            _context.Shops.Remove(shop);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Đã xóa shop." });
        }
    }
}
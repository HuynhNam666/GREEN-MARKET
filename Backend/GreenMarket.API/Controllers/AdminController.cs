using GreenMarket.API.Data;
using GreenMarket.API.DTOs;
using GreenMarket.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GreenMarket.API.Controllers
{
    [ApiController]
    [Route("api/admin")]
    [Authorize(Roles = "Admin")]
    public class AdminController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AdminController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("users")]
        public async Task<IActionResult> GetUsers()
        {
            var users = await _context.Users
                .OrderByDescending(x => x.CreatedAt)
                .Select(x => new UserResponse
                {
                    Id = x.Id,
                    Username = x.Username,
                    Email = x.Email,
                    Role = x.Role,
                    IsLocked = x.IsLocked,
                    IsApproved = x.IsApproved,
                    CreatedAt = x.CreatedAt
                })
                .ToListAsync();

            return Ok(users);
        }

        [HttpPut("users/{id}/lock")]
        public async Task<IActionResult> LockUser(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = "Không tìm thấy user." });

            user.IsLocked = true;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Đã khóa tài khoản." });
        }

        [HttpPut("users/{id}/unlock")]
        public async Task<IActionResult> UnlockUser(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = "Không tìm thấy user." });

            user.IsLocked = false;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Đã mở khóa tài khoản." });
        }

        [HttpPut("users/{id}/approve")]
        public async Task<IActionResult> ApproveUser(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = "Không tìm thấy user." });

            user.IsApproved = true;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Đã duyệt tài khoản." });
        }

        [HttpPut("users/{id}/role")]
        public async Task<IActionResult> UpdateRole(int id, [FromBody] UpdateUserRoleRequest request)
        {
            var allowedRoles = UserRoles.All;
            if (!allowedRoles.Contains(request.Role))
            {
                return BadRequest(new { message = "Role không hợp lệ." });
            }

            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = "Không tìm thấy user." });

            user.Role = request.Role;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Cập nhật role thành công." });
        }

        [HttpGet("dashboard")]
        public async Task<IActionResult> Dashboard()
        {
            var totalUsers = await _context.Users.CountAsync();
            var totalSellers = await _context.Users.CountAsync(x => x.Role == UserRoles.Seller);
            var totalProducts = await _context.Products.CountAsync();
            var totalOrders = await _context.Orders.CountAsync();
            var totalRevenue = await _context.Orders
                .Where(x => x.Status != OrderStatuses.PendingPayment
                            && x.Status != OrderStatuses.PaymentFailed
                            && x.Status != OrderStatuses.Cancelled)
                .Select(x => (decimal?)x.TotalAmount)
                .SumAsync() ?? 0;

            return Ok(new
            {
                totalUsers,
                totalSellers,
                totalProducts,
                totalOrders,
                totalRevenue
            });
        }
    }
}

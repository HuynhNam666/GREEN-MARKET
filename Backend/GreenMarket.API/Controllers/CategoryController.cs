using GreenMarket.API.Data;
using GreenMarket.API.DTOs;
using GreenMarket.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GreenMarket.API.Controllers
{
    [ApiController]
    [Route("api/categories")]
    public class CategoryController : ControllerBase
    {
        private readonly AppDbContext _context;

        public CategoryController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetAll()
        {
            var data = await _context.Categories.OrderBy(x => x.Name).ToListAsync();
            return Ok(data);
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Create([FromBody] CategoryRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(new { message = "Tên danh mục không được để trống." });
            }

            var exists = await _context.Categories.AnyAsync(x => x.Name == request.Name.Trim());
            if (exists)
            {
                return BadRequest(new { message = "Danh mục đã tồn tại." });
            }

            var category = new Category
            {
                Name = request.Name.Trim(),
                Description = request.Description?.Trim() ?? string.Empty
            };

            _context.Categories.Add(category);
            await _context.SaveChangesAsync();

            return Ok(category);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Update(int id, [FromBody] CategoryRequest request)
        {
            var data = await _context.Categories.FindAsync(id);
            if (data == null) return NotFound(new { message = "Không tìm thấy danh mục." });

            data.Name = request.Name.Trim();
            data.Description = request.Description?.Trim() ?? string.Empty;

            await _context.SaveChangesAsync();

            return Ok(data);
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Delete(int id)
        {
            var category = await _context.Categories.FindAsync(id);
            if (category == null) return NotFound(new { message = "Không tìm thấy danh mục." });

            var hasProducts = await _context.Products.AnyAsync(x => x.CategoryId == id);
            if (hasProducts)
            {
                return BadRequest(new { message = "Danh mục đang có sản phẩm, không thể xóa." });
            }

            _context.Categories.Remove(category);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Đã xóa danh mục." });
        }
    }
}
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
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly JwtService _jwtService;
        private readonly ExternalAuthService _externalAuthService;

        public AuthController(
            AppDbContext context,
            JwtService jwtService,
            ExternalAuthService externalAuthService)
        {
            _context = context;
            _jwtService = jwtService;
            _externalAuthService = externalAuthService;
        }

        [HttpGet("external-config")]
        [AllowAnonymous]
        public IActionResult GetExternalConfig()
        {
            return Ok(new ExternalAuthConfigResponse
            {
                GoogleEnabled = _externalAuthService.IsGoogleConfigured,
                GoogleClientId = _externalAuthService.GoogleClientId,
                FacebookEnabled = _externalAuthService.IsFacebookConfigured,
                FacebookAppId = _externalAuthService.FacebookAppId
            });
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Username) ||
                string.IsNullOrWhiteSpace(request.Email) ||
                string.IsNullOrWhiteSpace(request.Password))
            {
                return BadRequest(new { message = "Thiếu dữ liệu đăng ký." });
            }

            var email = request.Email.Trim().ToLowerInvariant();
            var emailExists = await _context.Users.AnyAsync(x => x.Email == email);
            if (emailExists)
            {
                return BadRequest(new { message = "Email đã tồn tại." });
            }

            var requestedRole = (request.Role ?? string.Empty).Trim();
            var role = requestedRole == UserRoles.Shipper ? UserRoles.Shipper : UserRoles.User;

            var user = new User
            {
                Username = request.Username.Trim(),
                Email = email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                Role = role,
                IsLocked = false,
                IsApproved = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            await EnsureCartAsync(user.Id);

            return Ok(new
            {
                message = "Đăng ký thành công.",
                user = new UserResponse
                {
                    Id = user.Id,
                    Username = user.Username,
                    Email = user.Email,
                    Role = user.Role,
                    IsLocked = user.IsLocked,
                    IsApproved = user.IsApproved,
                    CreatedAt = user.CreatedAt
                }
            });
        }

        [Authorize(Roles = "User")]
        [HttpPost("become-seller")]
        public async Task<IActionResult> BecomeSeller([FromBody] BecomeSellerRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.ShopName))
            {
                return BadRequest(new { message = "Tên shop không được để trống." });
            }

            var userIdClaim = User.Claims.FirstOrDefault(x => x.Type.Contains("nameidentifier"))?.Value;
            if (string.IsNullOrWhiteSpace(userIdClaim))
            {
                return Unauthorized();
            }

            var userId = int.Parse(userIdClaim);
            var user = await _context.Users.Include(x => x.Shops).FirstOrDefaultAsync(x => x.Id == userId);
            if (user == null)
            {
                return NotFound(new { message = "Không tìm thấy tài khoản." });
            }

            if (user.Role != UserRoles.User)
            {
                return BadRequest(new { message = "Tài khoản hiện tại không thể chuyển sang người bán." });
            }

            user.Role = UserRoles.Seller;
            var shop = new Shop
            {
                Name = request.ShopName.Trim(),
                Description = request.ShopDescription?.Trim() ?? string.Empty,
                SellerId = user.Id
            };

            _context.Shops.Add(shop);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Đăng ký trở thành người bán thành công.",
                role = user.Role,
                shop
            });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            var normalizedEmail = request.Email?.Trim().ToLowerInvariant() ?? string.Empty;
            var user = await _context.Users.FirstOrDefaultAsync(x => x.Email == normalizedEmail);

            if (user == null)
            {
                return Unauthorized(new { message = "Sai email hoặc mật khẩu." });
            }

            if (user.IsLocked)
            {
                return Unauthorized(new { message = "Tài khoản đã bị khóa." });
            }

            if (!user.IsApproved)
            {
                return Unauthorized(new { message = "Tài khoản chưa được duyệt." });
            }

            var isValidPassword = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
            if (!isValidPassword)
            {
                return Unauthorized(new { message = "Sai email hoặc mật khẩu." });
            }

            return Ok(BuildAuthResponse(user));
        }

        [HttpPost("google")]
        [AllowAnonymous]
        public async Task<IActionResult> LoginWithGoogle([FromBody] GoogleLoginRequest request)
        {
            var token = string.IsNullOrWhiteSpace(request.Credential) ? request.IdToken : request.Credential;
            if (string.IsNullOrWhiteSpace(token))
            {
                return BadRequest(new { message = "Thiếu Google ID token." });
            }

            try
            {
                var profile = await _externalAuthService.ValidateGoogleAsync(token.Trim());
                if (profile == null)
                {
                    return Unauthorized(new { message = "Không xác minh được tài khoản Google." });
                }

                var user = await FindOrCreateExternalUserAsync(profile, HttpContext.RequestAborted);
                if (user.IsLocked)
                {
                    return Unauthorized(new { message = "Tài khoản đã bị khóa." });
                }

                if (!user.IsApproved)
                {
                    return Unauthorized(new { message = "Tài khoản chưa được duyệt." });
                }

                return Ok(BuildAuthResponse(user));
            }
            catch (InvalidOperationException ex)
            {
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = ex.Message });
            }
            catch
            {
                return Unauthorized(new { message = "Google token không hợp lệ hoặc đã hết hạn." });
            }
        }

        [HttpPost("facebook")]
        [AllowAnonymous]
        public async Task<IActionResult> LoginWithFacebook([FromBody] FacebookLoginRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.AccessToken))
            {
                return BadRequest(new { message = "Thiếu Facebook access token." });
            }

            try
            {
                var profile = await _externalAuthService.ValidateFacebookAsync(request.AccessToken.Trim(), HttpContext.RequestAborted);
                if (profile == null)
                {
                    return Unauthorized(new { message = "Không xác minh được tài khoản Facebook." });
                }

                var user = await FindOrCreateExternalUserAsync(profile, HttpContext.RequestAborted);
                if (user.IsLocked)
                {
                    return Unauthorized(new { message = "Tài khoản đã bị khóa." });
                }

                if (!user.IsApproved)
                {
                    return Unauthorized(new { message = "Tài khoản chưa được duyệt." });
                }

                return Ok(BuildAuthResponse(user));
            }
            catch (InvalidOperationException ex)
            {
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = ex.Message });
            }
        }

        [Authorize]
        [HttpGet("me")]
        public async Task<IActionResult> Me()
        {
            var userIdClaim = User.Claims.FirstOrDefault(x => x.Type.Contains("nameidentifier"))?.Value;
            if (string.IsNullOrWhiteSpace(userIdClaim))
            {
                return Unauthorized();
            }

            var userId = int.Parse(userIdClaim);
            var user = await _context.Users.FindAsync(userId);

            if (user == null)
            {
                return NotFound();
            }

            return Ok(new UserResponse
            {
                Id = user.Id,
                Username = user.Username,
                Email = user.Email,
                Role = user.Role,
                IsLocked = user.IsLocked,
                IsApproved = user.IsApproved,
                CreatedAt = user.CreatedAt
            });
        }

        private AuthResponse BuildAuthResponse(User user)
        {
            var token = _jwtService.GenerateToken(user);
            return new AuthResponse
            {
                Token = token,
                UserId = user.Id,
                Username = user.Username,
                Email = user.Email,
                Role = user.Role
            };
        }

        private async Task<User> FindOrCreateExternalUserAsync(ExternalIdentityProfile profile, CancellationToken cancellationToken)
        {
            var normalizedEmail = NormalizeExternalEmail(profile);
            var user = await _context.Users.FirstOrDefaultAsync(x => x.Email == normalizedEmail, cancellationToken);
            var isNew = false;

            if (user == null)
            {
                user = new User
                {
                    Email = normalizedEmail,
                    Username = string.IsNullOrWhiteSpace(profile.DisplayName) ? BuildFallbackUsername(normalizedEmail) : profile.DisplayName.Trim(),
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N")),
                    Role = UserRoles.User,
                    IsLocked = false,
                    IsApproved = true,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Users.Add(user);
                isNew = true;
            }
            else if (string.IsNullOrWhiteSpace(user.Username) || user.Username.Contains('@'))
            {
                user.Username = string.IsNullOrWhiteSpace(profile.DisplayName)
                    ? BuildFallbackUsername(normalizedEmail)
                    : profile.DisplayName.Trim();
            }

            if (string.IsNullOrWhiteSpace(user.PasswordHash))
            {
                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N"));
            }

            await _context.SaveChangesAsync(cancellationToken);

            if (isNew)
            {
                await EnsureCartAsync(user.Id, cancellationToken);
            }

            return user;
        }

        private string NormalizeExternalEmail(ExternalIdentityProfile profile)
        {
            if (!string.IsNullOrWhiteSpace(profile.Email))
            {
                return profile.Email.Trim().ToLowerInvariant();
            }

            return $"{profile.Provider}_{profile.ProviderUserId}@{profile.Provider}.greenmarket.local".ToLowerInvariant();
        }

        private static string BuildFallbackUsername(string email)
        {
            var localPart = email.Split('@')[0];
            return string.IsNullOrWhiteSpace(localPart) ? "Khách hàng mới" : localPart;
        }

        private async Task EnsureCartAsync(int userId, CancellationToken cancellationToken = default)
        {
            var hasCart = await _context.Carts.AnyAsync(x => x.UserId == userId, cancellationToken);
            if (hasCart)
            {
                return;
            }

            _context.Carts.Add(new Cart { UserId = userId });
            await _context.SaveChangesAsync(cancellationToken);
        }
    }
}

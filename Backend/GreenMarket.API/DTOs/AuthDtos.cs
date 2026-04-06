namespace GreenMarket.API.DTOs
{
    public class RegisterRequest
    {
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string Role { get; set; } = "User";
    }

    public class LoginRequest
    {
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class GoogleLoginRequest
    {
        public string Credential { get; set; } = string.Empty;
        public string IdToken { get; set; } = string.Empty;
    }

    public class FacebookLoginRequest
    {
        public string AccessToken { get; set; } = string.Empty;
    }

    public class ExternalAuthConfigResponse
    {
        public bool GoogleEnabled { get; set; }
        public string GoogleClientId { get; set; } = string.Empty;
        public bool FacebookEnabled { get; set; }
        public string FacebookAppId { get; set; } = string.Empty;
    }

    public class AuthResponse
    {
        public string Token { get; set; } = string.Empty;
        public int UserId { get; set; }
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
    }
}

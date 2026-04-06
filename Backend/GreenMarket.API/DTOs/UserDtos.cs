namespace GreenMarket.API.DTOs
{
    public class UserResponse
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public bool IsLocked { get; set; }
        public bool IsApproved { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class UpdateUserRoleRequest
    {
        public string Role { get; set; } = "User";
    }
}

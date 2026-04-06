namespace GreenMarket.API.Models
{
    public class ExternalAuthOptions
    {
        public string GoogleClientId { get; set; } = string.Empty;
        public string FacebookAppId { get; set; } = string.Empty;
        public string FacebookAppSecret { get; set; } = string.Empty;
    }
}

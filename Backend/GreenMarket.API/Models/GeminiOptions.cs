namespace GreenMarket.API.Services
{
    public class GeminiOptions
    {
        public string ApiKey { get; set; } = string.Empty;
        public string Model { get; set; } = "gemini-2.5-flash";
        public string SystemPrompt { get; set; } = "Bạn là trợ lý AI của Green Market.";
    }
}
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace GreenMarket.API.Services
{
    public sealed record GeminiTurn(string Role, string Text);

    public class GeminiService
    {
        private readonly HttpClient _httpClient;
        private readonly GeminiOptions _options;

        public GeminiService(HttpClient httpClient, IOptions<GeminiOptions> options)
        {
            _httpClient = httpClient;
            _options = options.Value;
        }

        public bool IsConfigured => !string.IsNullOrWhiteSpace(_options.ApiKey);

        public async Task<string> GenerateReplyAsync(
            string systemInstruction,
            IEnumerable<GeminiTurn> turns,
            CancellationToken cancellationToken = default)
        {
            if (!IsConfigured)
            {
                return string.Empty;
            }

            var model = string.IsNullOrWhiteSpace(_options.Model) ? "gemini-2.5-flash" : _options.Model.Trim();
            var contentItems = turns
                .Where(turn => !string.IsNullOrWhiteSpace(turn.Text))
                .Select(turn => new
                {
                    role = string.Equals(turn.Role, "model", StringComparison.OrdinalIgnoreCase) ? "model" : "user",
                    parts = new[]
                    {
                        new { text = turn.Text.Trim() }
                    }
                })
                .ToList();

            if (!contentItems.Any())
            {
                return string.Empty;
            }

            var requestBody = new
            {
                system_instruction = new
                {
                    parts = new[]
                    {
                        new { text = string.IsNullOrWhiteSpace(systemInstruction) ? _options.SystemPrompt : systemInstruction.Trim() }
                    }
                },
                contents = contentItems,
                generationConfig = new
                {
                    temperature = 0.4,
                    topP = 0.95,
                    maxOutputTokens = 512
                }
            };

            using var request = new HttpRequestMessage(
                HttpMethod.Post,
                $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent");

            request.Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            request.Headers.Add("x-goog-api-key", _options.ApiKey.Trim());

            using var response = await _httpClient.SendAsync(request, cancellationToken);
            var responseText = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                return string.Empty;
            }

            try
            {
                using var document = JsonDocument.Parse(responseText);
                var candidates = document.RootElement.GetProperty("candidates");
                if (candidates.GetArrayLength() == 0)
                {
                    return string.Empty;
                }

                var content = candidates[0].GetProperty("content");
                var parts = content.GetProperty("parts");
                var segments = new List<string>();

                foreach (var part in parts.EnumerateArray())
                {
                    if (part.TryGetProperty("text", out var textNode))
                    {
                        var text = textNode.GetString();
                        if (!string.IsNullOrWhiteSpace(text))
                        {
                            segments.Add(text.Trim());
                        }
                    }
                }

                return string.Join("\n", segments).Trim();
            }
            catch
            {
                return string.Empty;
            }
        }
    }
}

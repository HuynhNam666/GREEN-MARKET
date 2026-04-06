using System.Text.Json;
using Google.Apis.Auth;
using GreenMarket.API.Models;
using Microsoft.Extensions.Options;

namespace GreenMarket.API.Services
{
    public sealed record ExternalIdentityProfile(
        string Provider,
        string ProviderUserId,
        string? Email,
        string DisplayName,
        string? PictureUrl);

    public class ExternalAuthService
    {
        private readonly HttpClient _httpClient;
        private readonly ExternalAuthOptions _options;

        public ExternalAuthService(HttpClient httpClient, IOptions<ExternalAuthOptions> options)
        {
            _httpClient = httpClient;
            _options = options.Value;
        }

        public bool IsGoogleConfigured => !string.IsNullOrWhiteSpace(_options.GoogleClientId);
        public bool IsFacebookConfigured => !string.IsNullOrWhiteSpace(_options.FacebookAppId)
            && !string.IsNullOrWhiteSpace(_options.FacebookAppSecret);

        public string GoogleClientId => _options.GoogleClientId;
        public string FacebookAppId => _options.FacebookAppId;

        public async Task<ExternalIdentityProfile?> ValidateGoogleAsync(string idToken)
        {
            if (!IsGoogleConfigured)
            {
                throw new InvalidOperationException("Đăng nhập Google chưa được cấu hình.");
            }

            if (string.IsNullOrWhiteSpace(idToken))
            {
                return null;
            }

            var payload = await GoogleJsonWebSignature.ValidateAsync(
                idToken,
                new GoogleJsonWebSignature.ValidationSettings
                {
                    Audience = new[] { _options.GoogleClientId }
                });

            if (payload == null || string.IsNullOrWhiteSpace(payload.Subject))
            {
                return null;
            }

            return new ExternalIdentityProfile(
                "google",
                payload.Subject,
                payload.Email,
                string.IsNullOrWhiteSpace(payload.Name) ? payload.Email ?? "Khách hàng Google" : payload.Name,
                payload.Picture);
        }

        public async Task<ExternalIdentityProfile?> ValidateFacebookAsync(string accessToken, CancellationToken cancellationToken)
        {
            if (!IsFacebookConfigured)
            {
                throw new InvalidOperationException("Đăng nhập Facebook chưa được cấu hình.");
            }

            if (string.IsNullOrWhiteSpace(accessToken))
            {
                return null;
            }

            var appToken = $"{_options.FacebookAppId}|{_options.FacebookAppSecret}";
            var debugUrl = $"https://graph.facebook.com/debug_token?input_token={Uri.EscapeDataString(accessToken)}&access_token={Uri.EscapeDataString(appToken)}";
            using var debugResponse = await _httpClient.GetAsync(debugUrl, cancellationToken);
            if (!debugResponse.IsSuccessStatusCode)
            {
                return null;
            }

            await using var debugStream = await debugResponse.Content.ReadAsStreamAsync(cancellationToken);
            using var debugDocument = await JsonDocument.ParseAsync(debugStream, cancellationToken: cancellationToken);
            if (!debugDocument.RootElement.TryGetProperty("data", out var debugData))
            {
                return null;
            }

            var isValid = debugData.TryGetProperty("is_valid", out var validElement) && validElement.GetBoolean();
            var appId = debugData.TryGetProperty("app_id", out var appIdElement) ? appIdElement.GetString() : null;
            if (!isValid || !string.Equals(appId, _options.FacebookAppId, StringComparison.Ordinal))
            {
                return null;
            }

            var profileUrl = $"https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token={Uri.EscapeDataString(accessToken)}";
            using var profileResponse = await _httpClient.GetAsync(profileUrl, cancellationToken);
            if (!profileResponse.IsSuccessStatusCode)
            {
                return null;
            }

            await using var profileStream = await profileResponse.Content.ReadAsStreamAsync(cancellationToken);
            using var profileDocument = await JsonDocument.ParseAsync(profileStream, cancellationToken: cancellationToken);
            var root = profileDocument.RootElement;

            var id = root.TryGetProperty("id", out var idElement) ? idElement.GetString() : null;
            var name = root.TryGetProperty("name", out var nameElement) ? nameElement.GetString() : null;
            var email = root.TryGetProperty("email", out var emailElement) ? emailElement.GetString() : null;
            string? pictureUrl = null;
            if (root.TryGetProperty("picture", out var pictureElement)
                && pictureElement.TryGetProperty("data", out var pictureData)
                && pictureData.TryGetProperty("url", out var pictureUrlElement))
            {
                pictureUrl = pictureUrlElement.GetString();
            }

            if (string.IsNullOrWhiteSpace(id))
            {
                return null;
            }

            return new ExternalIdentityProfile(
                "facebook",
                id,
                email,
                string.IsNullOrWhiteSpace(name) ? "Khách hàng Facebook" : name,
                pictureUrl);
        }
    }
}

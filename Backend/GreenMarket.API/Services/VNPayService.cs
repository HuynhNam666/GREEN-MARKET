using GreenMarket.API.Models;
using Microsoft.AspNetCore.Http;
using System.Security.Cryptography;
using System.Text;

namespace GreenMarket.API.Services
{
    public class VNPayService
    {
        private readonly IConfiguration _config;

        public VNPayService(IConfiguration config)
        {
            _config = config;
        }

        public string CreatePaymentUrl(Order order, HttpContext httpContext)
        {
            var vnpUrl = _config["VNPay:Url"] ?? "";
            var returnUrl = _config["VNPay:ReturnUrl"] ?? "";
            var tmnCode = _config["VNPay:TmnCode"] ?? "";
            var hashSecret = _config["VNPay:HashSecret"] ?? "";

            var ipAddress = httpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

            var inputData = new SortedDictionary<string, string>
            {
                { "vnp_Version", "2.1.0" },
                { "vnp_Command", "pay" },
                { "vnp_TmnCode", tmnCode },
                { "vnp_Amount", ((long)(order.TotalAmount * 100)).ToString() },
                { "vnp_CreateDate", DateTime.Now.ToString("yyyyMMddHHmmss") },
                { "vnp_CurrCode", "VND" },
                { "vnp_IpAddr", ipAddress },
                { "vnp_Locale", "vn" },
                { "vnp_OrderInfo", $"Thanh toan don hang {order.Id}" },
                { "vnp_OrderType", "other" },
                { "vnp_ReturnUrl", returnUrl },
                { "vnp_TxnRef", order.Id.ToString() }
            };

            var queryString = string.Join("&", inputData.Select(kvp => $"{kvp.Key}={Uri.EscapeDataString(kvp.Value)}"));
            var secureHash = HmacSHA512(hashSecret, queryString);

            return $"{vnpUrl}?{queryString}&vnp_SecureHash={secureHash}";
        }

        public bool ValidateSignature(IQueryCollection queryParams)
        {
            var hashSecret = _config["VNPay:HashSecret"] ?? "";
            var vnpSecureHash = queryParams["vnp_SecureHash"].ToString();

            var inputData = new SortedDictionary<string, string>();

            foreach (var key in queryParams.Keys)
            {
                if (key == "vnp_SecureHash" || key == "vnp_SecureHashType")
                    continue;

                var value = queryParams[key].ToString();
                if (!string.IsNullOrEmpty(value))
                {
                    inputData.Add(key, value);
                }
            }

            var rawData = string.Join("&", inputData.Select(kvp => $"{kvp.Key}={Uri.EscapeDataString(kvp.Value)}"));
            var computedHash = HmacSHA512(hashSecret, rawData);

            return string.Equals(computedHash, vnpSecureHash, StringComparison.OrdinalIgnoreCase);
        }

        private string HmacSHA512(string key, string inputData)
        {
            var keyBytes = Encoding.UTF8.GetBytes(key);
            var inputBytes = Encoding.UTF8.GetBytes(inputData);

            using var hmac = new HMACSHA512(keyBytes);
            var hashValue = hmac.ComputeHash(inputBytes);
            return BitConverter.ToString(hashValue).Replace("-", "").ToLower();
        }
    }
}
using System.Text;
using GreenMarket.API.Data;
using GreenMarket.API.Hubs;
using GreenMarket.API.Models;
using GreenMarket.API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "GreenMarket.API",
        Version = "v1"
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Nhập token theo dạng: Bearer {your JWT token}"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<VNPayService>();
builder.Services.AddScoped<OrderReservationService>();
builder.Services.AddScoped<InventoryAllocationService>();
builder.Services.AddScoped<StoreAssistantService>();

builder.Services.AddSignalR();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod());
});

var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new Exception("JWT Key not found");
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? throw new Exception("JWT Issuer not found");
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? throw new Exception("JWT Audience not found");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };

        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];

                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/chatHub"))
                {
                    context.Token = accessToken;
                }

                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();
builder.Services.Configure<GeminiOptions>(
    builder.Configuration.GetSection("Gemini"));
builder.Services.Configure<ExternalAuthOptions>(
    builder.Configuration.GetSection("ExternalAuth"));

builder.Services.AddHttpClient<GeminiService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(60);
});

builder.Services.AddHttpClient<ExternalAuthService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(20);
});

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();

var isRunningInContainer = string.Equals(
    Environment.GetEnvironmentVariable("DOTNET_RUNNING_IN_CONTAINER"),
    "true",
    StringComparison.OrdinalIgnoreCase);

if (app.Environment.IsDevelopment() && !isRunningInContainer)
{
    app.UseHttpsRedirection();
}

if (!Directory.Exists(Path.Combine(Directory.GetCurrentDirectory(), "wwwroot")))
{
    Directory.CreateDirectory(Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"));
}

if (!Directory.Exists(Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "images")))
{
    Directory.CreateDirectory(Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "images"));
}

await AppDbSeeder.InitializeAsync(app.Services, app.Logger);

app.UseStaticFiles();

app.UseCors("AllowAll");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<ChatHub>("/chatHub");

app.Run();

using GreenMarket.API.Models;
using Microsoft.EntityFrameworkCore;

namespace GreenMarket.API.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<User> Users => Set<User>();
        public DbSet<Category> Categories => Set<Category>();
        public DbSet<Shop> Shops => Set<Shop>();
        public DbSet<Product> Products => Set<Product>();
        public DbSet<Cart> Carts => Set<Cart>();
        public DbSet<CartItem> CartItems => Set<CartItem>();
        public DbSet<Order> Orders => Set<Order>();
        public DbSet<OrderDetail> OrderDetails => Set<OrderDetail>();
        public DbSet<Conversation> Conversations => Set<Conversation>();
        public DbSet<Message> Messages => Set<Message>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<User>()
                .HasIndex(x => x.Email)
                .IsUnique();

            modelBuilder.Entity<User>()
                .HasMany(x => x.Shops)
                .WithOne(x => x.Seller)
                .HasForeignKey(x => x.SellerId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Category>()
                .HasMany(x => x.Products)
                .WithOne(x => x.Category)
                .HasForeignKey(x => x.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Shop>()
                .HasMany(x => x.Products)
                .WithOne(x => x.Shop)
                .HasForeignKey(x => x.ShopId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Cart>()
                .HasOne(x => x.User)
                .WithOne(x => x.Cart)
                .HasForeignKey<Cart>(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Cart>()
                .HasMany(x => x.CartItems)
                .WithOne(x => x.Cart)
                .HasForeignKey(x => x.CartId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<CartItem>()
                .HasOne(x => x.Product)
                .WithMany()
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Order>()
                .HasMany(x => x.OrderDetails)
                .WithOne(x => x.Order)
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Order>()
                .HasOne(x => x.User)
                .WithMany(x => x.Orders)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Order>()
                .HasOne(x => x.AssignedShipper)
                .WithMany(x => x.AssignedOrders)
                .HasForeignKey(x => x.AssignedShipperId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<OrderDetail>()
                .HasOne(x => x.Product)
                .WithMany()
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Conversation>()
                .HasOne(x => x.User)
                .WithMany(x => x.UserConversations)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Conversation>()
                .HasOne(x => x.Seller)
                .WithMany(x => x.SellerConversations)
                .HasForeignKey(x => x.SellerId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Message>()
                .HasOne(x => x.Conversation)
                .WithMany(x => x.Messages)
                .HasForeignKey(x => x.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Message>()
                .HasOne(x => x.Sender)
                .WithMany(x => x.Messages)
                .HasForeignKey(x => x.SenderId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Product>().Property(x => x.Price).HasColumnType("decimal(18,2)");
            modelBuilder.Entity<CartItem>().Property(x => x.Price).HasColumnType("decimal(18,2)");
            modelBuilder.Entity<Order>().Property(x => x.TotalAmount).HasColumnType("decimal(18,2)");
            modelBuilder.Entity<OrderDetail>().Property(x => x.Price).HasColumnType("decimal(18,2)");
        }
    }
}
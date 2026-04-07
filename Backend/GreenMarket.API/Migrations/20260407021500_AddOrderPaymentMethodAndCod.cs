using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GreenMarket.API.Migrations
{
    public partial class AddOrderPaymentMethodAndCod : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PaymentMethod",
                table: "Orders",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "VNPay");

            migrationBuilder.Sql("UPDATE Orders SET PaymentMethod = 'VNPay' WHERE PaymentMethod IS NULL");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PaymentMethod",
                table: "Orders");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GreenMarket.API.Migrations
{
    /// <inheritdoc />
    public partial class AddGeminiBotMessage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsBot",
                table: "Messages",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsBot",
                table: "Messages");
        }
    }
}

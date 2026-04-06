using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace GreenMarket.API.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        public async Task JoinConversation(string conversationId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"conversation-{conversationId}");
        }

        public async Task LeaveConversation(string conversationId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"conversation-{conversationId}");
        }
    }
}
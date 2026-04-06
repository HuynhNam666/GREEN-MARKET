document.addEventListener('DOMContentLoaded', async () => {
  const app = window.GreenMarketApp;
  if (!app) return;

  const user = await app.requireAuth();
  if (!user) return;

  await app.bootstrapPage();

  const conversationList = document.getElementById('conversation-list');
  const messageList = document.getElementById('message-list');
  const emptyState = document.getElementById('chat-empty-state');
  const chatTitle = document.getElementById('chat-title');
  const chatSubtitle = document.getElementById('chat-subtitle');
  const chatAiBanner = document.getElementById('chat-ai-banner');
  const quickPromptsContainer = document.getElementById('chat-quick-prompts');
  const messageForm = document.getElementById('message-form');
  const messageInput = document.getElementById('message-input');
  const refreshButton = document.getElementById('refresh-conversations');

  const entryContext = {
    sellerId: Number(app.getQueryParam('sellerId')) || null,
    shopId: Number(app.getQueryParam('shopId')) || null,
    productId: Number(app.getQueryParam('productId')) || null,
    productName: '',
    shopName: '',
  };

  let activeConversationId = Number(app.getQueryParam('conversationId')) || 0;
  let conversations = [];
  let pollingTimer = null;

  const setEntryContext = (nextContext) => {
    Object.assign(entryContext, nextContext || {});
    app.setAssistantContext(entryContext, { refresh: false });
  };

  const renderQuickPrompts = () => {
    if (!quickPromptsContainer) return;

    const prompts = entryContext.productName
      ? [
          `${entryContext.productName} còn hàng không?`,
          `Giá ${entryContext.productName} hiện tại bao nhiêu?`,
          'Bao lâu thì giao tới?',
          'Nếu hàng không đúng mô tả thì xử lý sao?',
        ]
      : [
          'Shop đang có sản phẩm nào bán tốt?',
          'Bao lâu thì giao hàng?',
          'Thanh toán VNPay thế nào?',
          'Tôi muốn hỏi về tình trạng đơn hàng',
        ];

    quickPromptsContainer.innerHTML = prompts
      .map((prompt, index) => `
        <button
          type="button"
          class="rounded-full border border-primary/15 bg-background-light px-4 py-2 text-sm font-bold text-forest hover:border-primary hover:bg-primary/5 transition-colors"
          data-quick-prompt-index="${index}"
        >${app.escapeHtml(prompt)}</button>
      `)
      .join('');

    quickPromptsContainer.querySelectorAll('[data-quick-prompt-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const prompt = prompts[Number(button.dataset.quickPromptIndex)] || '';
        if (!messageInput) return;
        messageInput.value = prompt;
        messageInput.focus();
      });
    });
  };

  const renderChatBanner = (conversation) => {
    if (!chatAiBanner) return;

    const partnerName = conversation
      ? (user.role === 'Seller' || user.role === 'Admin'
        ? (conversation.userName || `Khách hàng #${conversation.userId}`)
        : (conversation.sellerName || `Người bán #${conversation.sellerId}`))
      : '';

    const productContextText = entryContext.productName
      ? `Ngữ cảnh hiện tại đang gắn với sản phẩm ${entryContext.productName}. `
      : '';

    const partnerText = partnerName
      ? `Cuộc trò chuyện này đang kết nối với ${partnerName}. `
      : '';

    chatAiBanner.textContent = `${productContextText}${partnerText}AI của shop có thể tự động trả lời các câu hỏi thường gặp về sản phẩm, giao hàng, thanh toán và đơn hàng.`.trim();
  };

  const loadEntryContext = async () => {
    try {
      if (entryContext.productId) {
        const product = await app.request(`/api/products/${entryContext.productId}`, { auth: false });
        setEntryContext({
          productId: product.id,
          productName: product.name || '',
          shopId: product.shopId || entryContext.shopId,
          shopName: product.shopName || entryContext.shopName,
        });
      }

      if (entryContext.shopId && !entryContext.shopName) {
        const shop = await app.request(`/api/shops/${entryContext.shopId}`, { auth: false });
        setEntryContext({
          shopId: shop.id,
          shopName: shop.name || '',
          sellerId: entryContext.sellerId || shop.sellerId || null,
        });
      }
    } catch (error) {
      console.warn('Không tải được ngữ cảnh chat:', error);
    }

    renderQuickPrompts();
    renderChatBanner(null);
  };

  const ensureConversationFromSeller = async () => {
    if (!entryContext.sellerId) return;

    const conversation = await app.request('/api/chat/conversations', {
      method: 'POST',
      body: { sellerId: entryContext.sellerId },
    });

    activeConversationId = Number(conversation.id);
    app.setQueryParam('conversationId', activeConversationId);
  };

  const renderConversations = () => {
    if (!conversationList) return;

    if (!conversations.length) {
      conversationList.innerHTML = `
        <div class="rounded-2xl border border-dashed border-primary/20 bg-background-light px-4 py-8 text-center text-sm text-slate-500">
          Chưa có cuộc trò chuyện nào.
        </div>
      `;
      return;
    }

    conversationList.innerHTML = conversations
      .map((conversation) => {
        const isActive = Number(conversation.id) === Number(activeConversationId);
        const partnerName = user.role === 'Seller' || user.role === 'Admin'
          ? (conversation.userName || `Khách hàng #${conversation.userId}`)
          : (conversation.sellerName || `Người bán #${conversation.sellerId}`);
        const unreadCount = Number(conversation.unreadCount || 0);
        const botMessageCount = Number(conversation.botMessageCount || 0);

        return `
          <button
            class="conversation-item w-full rounded-2xl border px-4 py-4 text-left transition-colors ${isActive ? 'border-primary bg-primary/5' : 'border-transparent bg-background-light hover:border-primary/20'}"
            data-conversation-id="${conversation.id}"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2 text-[11px]">
                  <h3 class="font-bold text-forest">${app.escapeHtml(partnerName)}</h3>
                  ${botMessageCount > 0 ? '<span class="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">AI</span>' : ''}
                  ${unreadCount > 0 ? `<span class="rounded-full bg-primary px-2 py-1 text-[11px] font-bold text-white">${unreadCount}</span>` : ''}
                </div>
                <p class="mt-1 line-clamp-2 text-sm text-slate-500">${app.escapeHtml(conversation.lastMessage || 'Chưa có tin nhắn')}</p>
              </div>
              <span class="text-xs text-slate-400">${conversation.lastMessageAt ? app.formatDate(conversation.lastMessageAt) : ''}</span>
            </div>
          </button>
        `;
      })
      .join('');

    conversationList.querySelectorAll('.conversation-item').forEach((button) => {
      button.addEventListener('click', async () => {
        activeConversationId = Number(button.dataset.conversationId);
        app.setQueryParam('conversationId', activeConversationId);
        renderConversations();
        await loadMessages();
      });
    });
  };

  const loadConversations = async () => {
    conversations = await app.request('/api/chat/conversations');
    if (!activeConversationId && conversations.length) {
      activeConversationId = Number(conversations[0].id);
      app.setQueryParam('conversationId', activeConversationId);
    }
    renderConversations();
  };

  const renderMessages = (messages) => {
    if (!messageList || !emptyState) return;

    if (!messages.length) {
      emptyState.classList.remove('hidden');
      messageList.innerHTML = '';
      return;
    }

    emptyState.classList.add('hidden');
    messageList.innerHTML = messages
      .map((message) => {
        const isMine = Number(message.senderId) === Number(user.id) && !message.isBot;
        const bubbleClasses = isMine
          ? 'bg-primary text-white'
          : message.isBot
            ? 'bg-emerald-50 text-forest border border-emerald-200'
            : 'bg-white text-forest border border-primary/10';
        const metaTone = isMine ? 'text-white/70' : 'text-slate-400';

        return `
          <div class="flex ${isMine ? 'justify-end' : 'justify-start'}">
            <div class="max-w-[88%] md:max-w-[80%] rounded-[28px] px-5 py-4 shadow-sm ${bubbleClasses}">
              <div class="flex flex-wrap items-center gap-2 text-[11px]">
                <p class="text-xs font-bold uppercase tracking-wide ${metaTone}">${app.escapeHtml(message.senderName || 'Người dùng')}</p>
                ${message.isBot ? '<span class="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Tự động</span>' : ''}
              </div>
              <p class="mt-2 whitespace-pre-wrap text-[15px] leading-8">${app.escapeHtml(message.content)}</p>
              <p class="mt-2 text-right text-[11px] ${metaTone}">${app.formatDate(message.sentAt)}</p>
            </div>
          </div>
        `;
      })
      .join('');

    messageList.scrollTop = messageList.scrollHeight;
  };

  const loadMessages = async () => {
    if (!activeConversationId) {
      if (chatTitle) chatTitle.textContent = 'Chọn một cuộc trò chuyện';
      if (chatSubtitle) chatSubtitle.textContent = 'Danh sách cuộc trò chuyện sẽ hiện ở bên trái.';
      renderMessages([]);
      renderChatBanner(null);
      return;
    }

    const conversation = conversations.find((item) => Number(item.id) === Number(activeConversationId));
    if (conversation) {
      const partnerName = user.role === 'Seller' || user.role === 'Admin'
        ? (conversation.userName || `Khách hàng #${conversation.userId}`)
        : (conversation.sellerName || `Người bán #${conversation.sellerId}`);

      if (chatTitle) chatTitle.textContent = partnerName;
      if (chatSubtitle) {
        chatSubtitle.textContent = conversation.lastMessageAt
          ? `Hoạt động gần nhất: ${app.formatDate(conversation.lastMessageAt)}`
          : 'Chưa có tin nhắn nào';
      }

      if (!entryContext.sellerId && conversation.sellerId) {
        setEntryContext({ sellerId: conversation.sellerId });
      }
    }

    renderQuickPrompts();
    renderChatBanner(conversation || null);

    const messages = await app.request(`/api/chat/conversations/${activeConversationId}/messages`);
    renderMessages(Array.isArray(messages) ? messages : []);
  };

  const startPolling = () => {
    if (pollingTimer) {
      window.clearInterval(pollingTimer);
    }

    pollingTimer = window.setInterval(async () => {
      try {
        await loadConversations();
        await loadMessages();
      } catch (error) {
        console.warn('Polling chat failed:', error);
      }
    }, 5000);
  };

  refreshButton?.addEventListener('click', async () => {
    await loadConversations();
    await loadMessages();
  });

  messageForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const content = messageInput?.value.trim() || '';
    if (!content || !activeConversationId) return;

    const submitButton = messageForm.querySelector('button[type="submit"]');
    const originalText = submitButton?.textContent || 'Gửi';
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Đang gửi...';
    }

    try {
      await app.request(`/api/chat/conversations/${activeConversationId}/messages`, {
        method: 'POST',
        body: { content, productId: entryContext.productId, orderId: Number(app.getQueryParam('orderId')) || null },
      });
      if (messageInput) messageInput.value = '';
      await loadConversations();
      await loadMessages();
    } catch (error) {
      app.notify(error.message, 'error');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    }
  });

  try {
    await loadEntryContext();
    await ensureConversationFromSeller();
    await loadConversations();
    await loadMessages();
    startPolling();
  } catch (error) {
    app.notify(error.message || 'Không tải được cuộc trò chuyện.', 'error');
  }

  window.addEventListener('beforeunload', () => {
    if (pollingTimer) {
      window.clearInterval(pollingTimer);
    }
  });
});

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
  const deleteHistoryButton = document.getElementById('delete-history-btn');
  const sendButton = document.getElementById('send-message-btn') || messageForm?.querySelector('button[type="submit"]') || null;

  const entryContext = {
    sellerId: Number(app.getQueryParam('sellerId')) || null,
    shopId: Number(app.getQueryParam('shopId')) || null,
    productId: Number(app.getQueryParam('productId')) || null,
    orderId: Number(app.getQueryParam('orderId')) || null,
    productName: '',
    shopName: '',
  };

  let activeConversationId = Number(app.getQueryParam('conversationId')) || 0;
  let conversations = [];
  let pollingTimer = null;
  let optimisticMessages = [];

  const setEntryContext = (nextContext) => {
    Object.assign(entryContext, nextContext || {});
    app.setAssistantContext(entryContext, { refresh: false });
  };

  const updateActionState = () => {
    if (deleteHistoryButton) {
      deleteHistoryButton.disabled = !activeConversationId;
    }
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
          class="rounded-full border border-primary/15 bg-white px-4 py-2 text-sm font-bold text-forest hover:border-primary hover:bg-primary/5 transition-colors"
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

    const shopText = entryContext.shopName
      ? `Bạn đang trò chuyện với shop ${entryContext.shopName}. `
      : (partnerName ? `Bạn đang trò chuyện với ${partnerName}. ` : '');

    const productContextText = entryContext.productName
      ? `Ngữ cảnh hiện tại: Sản phẩm ${entryContext.productName}. `
      : '';

    chatAiBanner.textContent = `${shopText}${productContextText}AI của shop có thể tự động trả lời các câu hỏi thường gặp về sản phẩm, giao hàng, thanh toán và đơn hàng.`.trim();
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
          sellerId: product.sellerId || entryContext.sellerId || null,
        });
      }

      if (entryContext.shopId) {
        const shop = await app.request(`/api/shops/${entryContext.shopId}`, { auth: false });
        setEntryContext({
          shopId: shop.id,
          shopName: entryContext.shopName || shop.name || '',
          sellerId: entryContext.sellerId || shop.sellerId || null,
        });
      }
    } catch (error) {
      console.warn('Không tải được ngữ cảnh chat:', error);
    }

    renderQuickPrompts();
    renderChatBanner(null);
  };

  const ensureConversation = async () => {
    if (activeConversationId) return activeConversationId;

    const opened = await app.openShopConversation({
      sellerId: entryContext.sellerId,
      shopId: entryContext.shopId,
      productId: entryContext.productId,
      orderId: entryContext.orderId,
    });

    if (!opened?.conversationId) {
      throw new Error('Không thể mở cuộc trò chuyện với shop.');
    }

    activeConversationId = Number(opened.conversationId);
    app.setQueryParam('conversationId', activeConversationId);
    setEntryContext({
      sellerId: opened.sellerId || entryContext.sellerId,
      shopId: opened.shopId || entryContext.shopId,
      shopName: opened.shopName || entryContext.shopName,
    });
    updateActionState();
    return activeConversationId;
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
            class="conversation-item w-full rounded-[24px] border px-4 py-4 text-left transition-colors ${isActive ? 'border-primary bg-primary/5 shadow-sm' : 'border-transparent bg-white hover:border-primary/20 hover:bg-background-light'}"
            data-conversation-id="${conversation.id}"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2 text-[11px]">
                  <h3 class="font-bold text-forest">${app.escapeHtml(partnerName)}</h3>
                  ${botMessageCount > 0 ? '<span class="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">AI</span>' : ''}
                  ${unreadCount > 0 ? `<span class="rounded-full bg-primary px-2 py-1 text-[11px] font-bold text-white">${unreadCount}</span>` : ''}
                </div>
                <p class="mt-2 line-clamp-2 text-sm text-slate-500">${app.escapeHtml(conversation.lastMessage || 'Chưa có tin nhắn')}</p>
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
        optimisticMessages = [];
        app.setQueryParam('conversationId', activeConversationId);
        renderConversations();
        updateActionState();
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
    updateActionState();
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
        const extraBadge = message.isPending
          ? `<span class="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isMine ? 'text-primary' : 'text-amber-600'}">Đang gửi</span>`
          : (message.isBot
            ? '<span class="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Tự động</span>'
            : '');

        return `
          <div class="flex ${isMine ? 'justify-end' : 'justify-start'}">
            <div class="max-w-[88%] md:max-w-[76%] rounded-[28px] px-5 py-4 shadow-sm ${bubbleClasses}">
              <div class="flex flex-wrap items-center gap-2 text-[11px]">
                <p class="text-xs font-bold uppercase tracking-wide ${metaTone}">${app.escapeHtml(message.senderName || (isMine ? 'Bạn' : 'Người dùng'))}</p>
                ${extraBadge}
              </div>
              <p class="mt-2 whitespace-pre-wrap break-words text-[15px] leading-8">${app.escapeHtml(message.content)}</p>
              <p class="mt-2 text-right text-[11px] ${metaTone}">${message.sentAt ? app.formatDate(message.sentAt) : 'Vừa xong'}</p>
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
      updateActionState();
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
    const mergedMessages = [...(Array.isArray(messages) ? messages : []), ...optimisticMessages];
    renderMessages(mergedMessages);
    updateActionState();
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
    optimisticMessages = [];
    await loadConversations();
    await loadMessages();
  });

  deleteHistoryButton?.addEventListener('click', async () => {
    if (!activeConversationId) return;
    if (!window.confirm('Bạn có chắc muốn xóa toàn bộ lịch sử trò chuyện này không?')) return;

    const originalText = deleteHistoryButton.innerHTML;
    deleteHistoryButton.disabled = true;
    deleteHistoryButton.innerHTML = '<span class="material-symbols-outlined text-[18px]">hourglass_top</span> Đang xóa';

    try {
      await app.request(`/api/chat/conversations/${activeConversationId}/history`, { method: 'DELETE' });
      optimisticMessages = [];
      await loadConversations();
      await loadMessages();
      app.notify('Đã xóa lịch sử trò chuyện.', 'success');
    } catch (error) {
      app.notify(error.message || 'Không xóa được lịch sử trò chuyện.', 'error');
    } finally {
      deleteHistoryButton.innerHTML = originalText;
      updateActionState();
    }
  });

  messageInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      messageForm?.requestSubmit();
    }
  });

  messageForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const content = messageInput?.value.trim() || '';
    if (!content) return;

    const originalHTML = sendButton?.innerHTML || 'Gửi';
    if (sendButton) {
      sendButton.disabled = true;
      sendButton.innerHTML = '<span class="material-symbols-outlined text-[20px]">hourglass_top</span> Đang gửi';
    }

    try {
      await ensureConversation();

      const optimisticMessage = {
        senderId: user.id,
        senderName: user.username || user.fullName || 'Bạn',
        content,
        sentAt: new Date().toISOString(),
        isBot: false,
        isPending: true,
      };

      optimisticMessages.push(optimisticMessage);
      renderMessages(optimisticMessages);

      if (messageInput) {
        messageInput.value = '';
        messageInput.focus();
      }

      await app.request(`/api/chat/conversations/${activeConversationId}/messages`, {
        method: 'POST',
        body: {
          content,
          productId: entryContext.productId,
          orderId: entryContext.orderId,
        },
      });

      optimisticMessages = [];
      await loadConversations();
      await loadMessages();
    } catch (error) {
      optimisticMessages = [];
      await loadMessages().catch(() => {});
      app.notify(error.message || 'Không gửi được tin nhắn.', 'error');
      console.error('Chat send failed:', error);
    } finally {
      if (sendButton) {
        sendButton.disabled = false;
        sendButton.innerHTML = originalHTML;
      }
    }
  });

  try {
    await loadEntryContext();
    if (!activeConversationId && (entryContext.sellerId || entryContext.shopId || entryContext.productId || entryContext.orderId)) {
      await ensureConversation();
    }
    await loadConversations();
    await loadMessages();
    startPolling();
  } catch (error) {
    app.notify(error.message || 'Không tải được cuộc trò chuyện.', 'error');
    console.error('Chat bootstrap failed:', error);
  }

  updateActionState();

  window.addEventListener('beforeunload', () => {
    if (pollingTimer) {
      window.clearInterval(pollingTimer);
    }
  });
});

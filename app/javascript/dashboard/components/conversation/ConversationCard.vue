const customerMessagesSinceResponse = computed(() => {
  if (!props.chat.messages) {
    console.log('No messages loaded for conversation:', props.chat.id);
    return 0;
  }
  
  console.log('Calculating customerMessagesSinceResponse for conversation:', {
    id: props.chat.id,
    messageCount: props.chat.messages.length,
    unreadCount: props.chat.unread_count
  });
  
  const count = getCustomerMessagesSinceResponse(props.chat, props.chat.unread_count);
  console.log('Calculated count:', count);
  return count;
});

const fetchMessagesForBatch = debounce(async (conversationIds) => {
  if (isLoading.value) {
    console.log('Already loading messages, skipping batch:', conversationIds);
    return;
  }
  
  // Filter out conversations we already have messages for
  const conversationsToFetch = conversationIds.filter(id => !messages.value[id]);
  if (conversationsToFetch.length === 0) {
    console.log('No new conversations to fetch messages for');
    return;
  }
  
  console.log('Fetching messages for conversations:', conversationsToFetch);
  
  try {
    isLoading.value = true;
    const response = await axios.post('/api/v1/conversations/batch_messages', {
      conversation_ids: conversationsToFetch
    });
    
    console.log('Received messages for conversations:', response.data.map(d => d.conversation_id));
    
    response.data.forEach(conversationData => {
      messages.value[conversationData.conversation_id] = conversationData.messages;
      // Clear cache when new messages arrive
      messageCache.delete(conversationData.conversation_id);
      console.log('Loaded messages for conversation:', {
        id: conversationData.conversation_id,
        messageCount: conversationData.messages.length
      });
    });
  } catch (error) {
    console.error('Error fetching batch messages:', error);
    // Implement retry logic here if needed
  } finally {
    isLoading.value = false;
  }
}, 300); // Debounce for 300ms 
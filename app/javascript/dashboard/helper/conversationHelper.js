/**
 * Determines the last non-activity message between store and API messages.
 * @param {Object} messageInStore - The last non-activity message from the store.
 * @param {Object} messageFromAPI - The last non-activity message from the API.
 * @returns {Object} The latest non-activity message.
 */
const getLastNonActivityMessage = (messageInStore, messageFromAPI) => {
  // If both API value and store value for last non activity message
  // are available, then return the latest one.
  if (messageInStore && messageFromAPI) {
    return messageInStore.created_at >= messageFromAPI.created_at
      ? messageInStore
      : messageFromAPI;
  }
  // Otherwise, return whichever is available
  return messageInStore || messageFromAPI;
};

/**
 * Filters out duplicate source messages from an array of messages.
 * @param {Array} messages - The array of messages to filter.
 * @returns {Array} An array of messages without duplicates.
 */
export const filterDuplicateSourceMessages = (messages = []) => {
  const messagesWithoutDuplicates = [];
  // We cannot use Map or any short hand method as it returns the last message with the duplicate ID
  // We should return the message with smaller id when there is a duplicate
  messages.forEach(m1 => {
    if (m1.source_id) {
      const index = messagesWithoutDuplicates.findIndex(
        m2 => m1.source_id === m2.source_id
      );

      if (index < 0) {
        messagesWithoutDuplicates.push(m1);
      }
    } else {
      messagesWithoutDuplicates.push(m1);
    }
  });
  return messagesWithoutDuplicates;
};

/**
 * Retrieves the last message from a conversation, prioritizing non-activity messages.
 * @param {Object} m - The conversation object containing messages.
 * @returns {Object} The last message of the conversation.
 */
export const getLastMessage = m => {
  const lastMessageIncludingActivity = m.messages[m.messages.length - 1];

  const nonActivityMessages = m.messages.filter(
    message => message.message_type !== 2
  );
  const lastNonActivityMessageInStore =
    nonActivityMessages[nonActivityMessages.length - 1];

  const lastNonActivityMessageFromAPI = m.last_non_activity_message;

  // If API value and store value for last non activity message
  // is empty, then return the last activity message
  if (!lastNonActivityMessageInStore && !lastNonActivityMessageFromAPI) {
    return lastMessageIncludingActivity;
  }

  return getLastNonActivityMessage(
    lastNonActivityMessageInStore,
    lastNonActivityMessageFromAPI
  );
};

/**
 * Filters messages that have been read by the agent.
 * @param {Array} messages - The array of messages to filter.
 * @param {number} agentLastSeenAt - The timestamp of when the agent last saw the messages.
 * @returns {Array} An array of read messages.
 */
export const getReadMessages = (messages, agentLastSeenAt) => {
  return messages.filter(
    message => message.created_at * 1000 <= agentLastSeenAt * 1000
  );
};

/**
 * Filters messages that have not been read by the agent.
 * @param {Array} messages - The array of messages to filter.
 * @param {number} agentLastSeenAt - The timestamp of when the agent last saw the messages.
 * @returns {Array} An array of unread messages.
 */
export const getUnreadMessages = (messages, agentLastSeenAt) => {
  return messages.filter(
    message => message.created_at * 1000 > agentLastSeenAt * 1000
  );
};

/**
 * Determines if a message is automated based on various criteria
 * @param {Object} message - The message object to check
 * @param {Object} conversation - The conversation object containing the message
 * @returns {boolean} - True if the message is automated, false otherwise
 */
export const isAutomatedAckMessage = (message, conversation) => {
  console.log('isAutomatedAckMessage called with message ID:', message?.id);
  
  if (!message) {
    console.log('No message provided, returning false');
    return false;
  }
  
  // CASE 1: Check automation rule ID in content_attributes
  if (message.content_attributes && 
      (message.content_attributes.automation_rule_id || 
       message.content_attributes.automated === true)) {
    console.log('Message is automated (CASE 1): Automation rule or automated flag found', JSON.stringify({
      messageId: message.id,
      content_attributes: message.content_attributes
    }, null, 2));
    return true;
  }
  
  // CASE 2: Check campaign ID in additional_attributes
  if (message.additional_attributes && 
      message.additional_attributes.campaign_id) {
    console.log('Message is automated (CASE 2): Campaign ID found', JSON.stringify({
      messageId: message.id,
      campaign_id: message.additional_attributes.campaign_id
    }, null, 2));
    return true;
  }
  
  // CASE 3: Check sender type - messages from bots
  if (message.sender_type === 'AgentBot') {
    console.log('Message is automated (CASE 3): AgentBot sender type', JSON.stringify({
      messageId: message.id,
      sender_type: message.sender_type
    }, null, 2));
    return true;
  }
  
  // CASE 4: Messages sent immediately after conversation creation
  // Only consider this for automated acknowledgments, not all outgoing messages
  if (conversation?.created_at && message.created_at) {
    const conversationCreationTime = new Date(conversation.created_at).getTime();
    const messageCreationTime = new Date(message.created_at).getTime();
    const timeDifference = messageCreationTime - conversationCreationTime;
    
    // Only mark as automated if it's an acknowledgment message sent quickly
    if (timeDifference <= 5000 && 
        message.message_type === 1 && 
        message.content_attributes?.automated_acknowledgement === true) {
      console.log('Message is automated (CASE 4): Automated acknowledgment sent within 5 seconds of conversation creation', JSON.stringify({
        messageId: message.id,
        timeDifference,
        automated_acknowledgement: message.content_attributes?.automated_acknowledgement
      }, null, 2));
      return true;
    }
  }
  
  console.log('Message is not automated', JSON.stringify({
    messageId: message.id,
    message_type: message.message_type,
    sender_type: message.sender_type
  }, null, 2));
  return false;
};

/**
 * Calculates the number of customer messages since the last human response
 * @param {Object} conversation - The conversation object
 * @param {number} unreadCount - The number of unread messages
 * @returns {number} - The count of customer messages since last human response
 */
export const getCustomerMessagesSinceResponse = (conversation, unreadCount) => {
  console.log('DEBUG - getCustomerMessagesSinceResponse called for:', conversation?.id);
  
  // If conversation doesn't exist or id is not available, return 0
  if (!conversation || !conversation.id) {
    console.log('DEBUG - Invalid conversation object');
    return 0;
  }
  
  console.log('DEBUG - Conversation state:', JSON.stringify({
    id: conversation.id,
    hasLastNonActivityMessage: !!conversation.last_non_activity_message,
    hasMessages: !!conversation.messages,
    messageCount: conversation.messages?.length || 0
  }, null, 2));

  console.log('DEBUG - Conversation messages:', JSON.stringify(conversation.messages, null, 2));
  
  // First, check if there's unread count from the backend
  // If there is, we can use that as a fallback
  const lastMessage = conversation.last_non_activity_message || 
                     (conversation.messages && conversation.messages.length > 0 ? 
                      conversation.messages[0] : null);
  
  console.log('DEBUG - Last message:', JSON.stringify(lastMessage, null, 2));

  // If we have unread messages and the last message is from customer, use unread count
  if (unreadCount > 0 && lastMessage && lastMessage.message_type === 0) {
    console.log(`DEBUG - Using unread count ${unreadCount} as fallback since last message is from customer`);
    return unreadCount; // TODO: I don't think we need to fallback to unread count here, if everything works it is not needed
  }
  
  // Look for the last_non_activity_message if messages aren't loaded yet
  if (!conversation.messages || conversation.messages.length === 0) {
    console.log('DEBUG - No messages loaded, checking last_non_activity_message');
    // If we don't have messages loaded yet, but have the lastNonActivityMessage
    // we can use it to determine if it's a customer message
    if (conversation.last_non_activity_message) {
      const lastMsg = conversation.last_non_activity_message;
      console.log('DEBUG - Last non-activity message:', JSON.stringify({
        id: lastMsg.id,
        type: lastMsg.message_type,
        isCustomer: lastMsg.message_type === 0
      }, null, 2));
      
      // If the last message is from a customer, count it as 1 unresponded message
      if (lastMsg.message_type === 0) {
        console.log('DEBUG - Using fallback: Last message is from customer, returning 1');
        return 1;
      }
    }
    console.log('DEBUG - No customer messages or empty conversation, returning 0');
    return 0;
  }
  
  const messages = conversation.messages || [];
  console.log(`DEBUG - Processing ${messages.length} messages for conversation ${conversation.id}`);

  // For debugging - log all messages
  messages.forEach((msg, idx) => {
    console.log(`DEBUG - Message[${idx}]: id=${msg.id}, type=${msg.message_type}, sender=${msg.sender_type}`);
  });

  // Find the last non-automated agent message
  let lastNonAutomatedAgentMessage = null;
  let lastNonAutomatedAgentIndex = -1;
  
  console.log('DEBUG - Searching for last non-automated agent message');
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    
    // Only consider agent messages (type 1)
    if (message.message_type === 1) {
      const isAutomated = isAutomatedAckMessage(message, conversation);
      console.log(`DEBUG - Found agent message ${message.id} at index ${i}, automated: ${isAutomated}`);
      
      if (!isAutomated) {
        lastNonAutomatedAgentMessage = message;
        lastNonAutomatedAgentIndex = i;
        console.log(`DEBUG - Found last non-automated agent message: ${message.id} at index ${i}`);
        break;
      }
    }
  }

  // If no non-automated agent messages found, count all customer messages
  if (!lastNonAutomatedAgentMessage) {
    const count = messages.filter(msg => msg.message_type === 0).length;
    console.log(`DEBUG - No non-automated agent messages found, counting all ${count} customer messages`);
    return count;
  }

  // Check if the most recent message is a non-automated agent message or occurred after it
  // If so, there are no customer messages since the agent's response
  if (lastNonAutomatedAgentIndex === 0) {
    console.log('DEBUG - Agent message is the newest, no customer messages since, returning 0');
    return 0;
  }
  
  // Check if there are customer messages after agent message (newer messages)
  // Messages[0] is the newest message in Chatwoot 
  let hasCustomerMessagesAfterAgent = false;
  
  for (let i = 0; i < lastNonAutomatedAgentIndex; i++) {
    if (messages[i].message_type === 0) {
      hasCustomerMessagesAfterAgent = true;
      break;
    }
  }
  
  // If no customer messages after agent response, return 0
  if (!hasCustomerMessagesAfterAgent) {
    console.log('DEBUG - No customer messages after agent response, returning 0');
    return 0;
  }
  
  // Count customer messages before the last non-automated agent message
  // Since in Chatwoot messages are ordered newest to oldest (index 0 is newest),
  // we need to count all customer messages after the agent's message in the array
  let count = 0;
  
  console.log(`DEBUG - Counting customer messages from index 0 to ${lastNonAutomatedAgentIndex-1}`);
  
  for (let i = 0; i < lastNonAutomatedAgentIndex; i++) {
    const message = messages[i];
    console.log(`DEBUG - Checking message at index ${i}: type=${message.message_type}, id=${message.id}`);
    if (message.message_type === 0) {
      count++;
      console.log(`DEBUG - Counted customer message, running total: ${count}`);
    }
  }
  
  console.log(`DEBUG - Final customer messages count: ${count}`);
  return count;
};

/**
 * Determines if a conversation should show the unread indicator
 * @param {Object} conversation - The conversation object
 * @param {number} unreadCount - The number of unread messages
 * @returns {boolean} - True if the unread indicator should be shown
 */
export const shouldShowUnread = (conversation, unreadCount) => {
  //console.log('shouldShowUnread called with:', JSON.stringify({ conversation, unreadCount }, null, 2));
  
  // Show unread indicator if there are unread messages according to backend
  if (unreadCount > 0) {
    //console.log('Unread count > 0, returning true');
    return true;
  }
  
  // Always show unread indicator if last message is incoming
  const lastMessage = getLastMessage(conversation);
  //console.log('Last message:', JSON.stringify(lastMessage, null, 2));
  
  if (lastMessage) {
    const shouldShow = lastMessage.message_type === 0;
    //console.log('Last message is incoming:', shouldShow);
    return shouldShow;
  }
  
  //console.log('No last message found, returning false');
  return false;
};

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
 * @returns {number} - The count of customer messages since last human response
 */
export const getCustomerMessagesSinceResponse = (conversation) => {
  console.log('DEBUG - getCustomerMessagesSinceResponse called for:', conversation?.id);
  
  // If conversation doesn't exist or id is not available, return 0
  if (!conversation || !conversation.id) {
    console.log('DEBUG - Invalid conversation object');
    return 0;
  }
  
  console.log('DEBUG - Conversation:', JSON.stringify(conversation, null, 2));

  // Check if we have a last_non_activity_message - this is what Chatwoot provides by default
  const lastNonActivityMessage = conversation.last_non_activity_message;
  
  if (lastNonActivityMessage) {
    // If last message is from a customer, show the indicator (1 message without response)
    if (lastNonActivityMessage.message_type === 0) {
      console.log('DEBUG - Last non-activity message is from customer, showing indicator');
      return 1;
    }
    
    // If it's an agent message, check if it's automated
    if (lastNonActivityMessage.message_type === 1) {
      const isAutomated = isAutomatedAckMessage(lastNonActivityMessage);
      
      // If it's an automated message, show indicator as customers need real response
      if (isAutomated) {
        console.log('DEBUG - Last non-activity message is automated agent message, showing indicator');
        return 1;
      }
      
      // If it's a real agent message, no need for indicator
      console.log('DEBUG - Last non-activity message is human agent message, not showing indicator');
      return 0;
    }
  }
  
  // If we have no last non-activity message, assume no pending customer messages
  console.log('DEBUG - No last_non_activity_message available, returning 0');
  return 0;
};

/**
 * Determines if a conversation should show the unread indicator
 * @param {Object} conversation - The conversation object
 * @param {number} unreadCount - The number of unread messages
 * @returns {boolean} - True if the unread indicator should be shown
 */
export const shouldShowUnread = (conversation, unreadCount) => {
  // Show unread indicator if there are unread messages according to backend
  if (unreadCount > 0 || (conversation && conversation.unread_count > 0)) {
    return true;
  }
  
  // If we have a last_non_activity_message, use that to determine if indicator needed
  if (conversation && conversation.last_non_activity_message) {
    // Show indicator if last message is from customer
    return conversation.last_non_activity_message.message_type === 0;
  }
  
  // Default to false if we can't determine
  return false;
};

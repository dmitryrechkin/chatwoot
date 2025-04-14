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
    console.log('Message is automated (CASE 1): Automation rule or automated flag found', {
      messageId: message.id,
      content_attributes: message.content_attributes
    });
    return true;
  }
  
  // CASE 2: Check campaign ID in additional_attributes
  if (message.additional_attributes && 
      message.additional_attributes.campaign_id) {
    console.log('Message is automated (CASE 2): Campaign ID found', {
      messageId: message.id,
      campaign_id: message.additional_attributes.campaign_id
    });
    return true;
  }
  
  // CASE 3: Check sender type - messages from bots
  if (message.sender_type === 'AgentBot') {
    console.log('Message is automated (CASE 3): AgentBot sender type', {
      messageId: message.id,
      sender_type: message.sender_type
    });
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
      console.log('Message is automated (CASE 4): Automated acknowledgment sent within 5 seconds of conversation creation', {
        messageId: message.id,
        timeDifference,
        automated_acknowledgement: message.content_attributes?.automated_acknowledgement
      });
      return true;
    }
  }
  
  console.log('Message is not automated', {
    messageId: message.id,
    message_type: message.message_type,
    sender_type: message.sender_type
  });
  return false;
};

/**
 * Calculates the number of customer messages since the last human response
 * @param {Object} conversation - The conversation object
 * @param {number} unreadCount - The number of unread messages
 * @returns {number} - The count of customer messages since last human response
 */
export const getCustomerMessagesSinceResponse = (conversation, unreadCount) => {
  // If conversation doesn't exist or id is not available, return 0
  if (!conversation || !conversation.id) {
    return 0;
  }
  
  // Look for the last_non_activity_message if messages aren't loaded yet
  if (!conversation.messages || conversation.messages.length === 0) {
    // If we don't have messages loaded yet, but have the lastNonActivityMessage
    // we can use it to determine if it's a customer message
    if (conversation.last_non_activity_message) {
      const lastMsg = conversation.last_non_activity_message;
      // If the last message is from a customer, count it as 1 unresponded message
      if (lastMsg.message_type === 0) {
        return 1;
      }
    }
    return 0;
  }
  
  const messages = conversation.messages || [];

  // Find the last non-automated agent message
  let lastNonAutomatedAgentMessage = null;
  let lastNonAutomatedAgentIndex = -1;
  
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    
    // Only consider agent messages (type 1)
    if (message.message_type === 1) {
      const isAutomated = isAutomatedAckMessage(message, conversation);
      
      if (!isAutomated) {
        lastNonAutomatedAgentMessage = message;
        lastNonAutomatedAgentIndex = i;
        break;
      }
    }
  }

  // If no non-automated agent messages found, count all customer messages
  if (!lastNonAutomatedAgentMessage) {
    return messages.filter(msg => msg.message_type === 0).length;
  }

  // Count customer messages after the last non-automated agent message
  // Since in Chatwoot messages are ordered newest to oldest,
  // we need to count from index 0 to lastNonAutomatedAgentIndex
  let count = 0;
  for (let i = 0; i < lastNonAutomatedAgentIndex; i++) {
    const message = messages[i];
    if (message.message_type === 0) {
      count++;
    }
  }
  
  return count;
};

/**
 * Determines if a conversation should show the unread indicator
 * @param {Object} conversation - The conversation object
 * @param {number} unreadCount - The number of unread messages
 * @returns {boolean} - True if the unread indicator should be shown
 */
export const shouldShowUnread = (conversation, unreadCount) => {
  console.log('shouldShowUnread called with:', { conversation, unreadCount });
  
  // Show unread indicator if there are unread messages according to backend
  if (unreadCount > 0) {
    console.log('Unread count > 0, returning true');
    return true;
  }
  
  // Always show unread indicator if last message is incoming
  const lastMessage = getLastMessage(conversation);
  console.log('Last message:', lastMessage);
  
  if (lastMessage) {
    const shouldShow = lastMessage.message_type === 0;
    console.log('Last message is incoming:', shouldShow);
    return shouldShow;
  }
  
  console.log('No last message found, returning false');
  return false;
};

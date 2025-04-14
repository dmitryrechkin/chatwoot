<script setup>
import { computed, ref, onMounted, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMessageFormatter } from 'shared/composables/useMessageFormatter';

import Avatar from 'dashboard/components-next/avatar/Avatar.vue';
import Icon from 'dashboard/components-next/icon/Icon.vue';

const props = defineProps({
  conversation: {
    type: Object,
    required: true,
  },
});

const conversationMessages = inject('conversationMessages');

const { t } = useI18n();

const { getPlainText } = useMessageFormatter();

const lastNonActivityMessageContent = computed(() => {
  const { lastNonActivityMessage = {}, customAttributes = {} } =
    props.conversation;
  const { email: { subject } = {} } = customAttributes;
  return getPlainText(
    lastNonActivityMessage?.content || t('CHAT_LIST.NO_CONTENT')
  );
});

const emailSubject = computed(() => {
  const { additional_attributes: additionalAttributes = {} } = props.conversation;
  return additionalAttributes.mail_subject || null;
});

const conversationId = computed(() => {
  return props.conversation.id;
});

const assignee = computed(() => {
  const { meta: { assignee: agent = {} } = {} } = props.conversation;
  return {
    name: agent.name ?? agent.availableName,
    thumbnail: agent.thumbnail,
    status: agent.availabilityStatus,
  };
});

const unreadMessagesCount = computed(() => {
  const { unreadCount } = props.conversation;
  return unreadCount;
});

const shouldShowUnread = computed(() => {
  // Show unread indicator if there are unread messages according to backend
  if (unreadMessagesCount.value > 0) {
    return true;
  }
  
  // Always show unread indicator if last message is incoming
  // This ensures we mark conversations as "requiring attention" even after viewing
  const { lastNonActivityMessage } = props.conversation;
  if (lastNonActivityMessage) {
    // Message type 0 is incoming and we want to continue showing the indicator
    // for incoming messages even after they've been seen but not replied to
    return lastNonActivityMessage.message_type === 0;  
  }
  
  return false;
});

// Helper function to detect automated ACK messages
const isAutomatedAckMessage = (message) => {
  if (!message) return false;
  
  // CASE 1: Check automation rule ID in content_attributes
  // This identifies messages created by automation rules
  if (message.content_attributes && 
      (message.content_attributes.automation_rule_id || 
       message.content_attributes.automated === true)) {
    return true;
  }
  
  // CASE 2: Check campaign ID in additional_attributes
  // This identifies messages created by a campaign
  if (message.additional_attributes && 
      message.additional_attributes.campaign_id) {
    return true;
  }
  
  // CASE 3: Check sender type - messages from bots
  if (message.sender_type === 'AgentBot') {
    return true;
  }
  
  // CASE 4: Messages sent immediately after conversation creation (within 5 seconds)
  // This likely identifies automated greetings/welcome messages
  const conversation = props.conversation;
  if (conversation.created_at && message.created_at) {
    const conversationCreationTime = new Date(conversation.created_at).getTime();
    const messageCreationTime = new Date(message.created_at).getTime();
    const timeDifference = messageCreationTime - conversationCreationTime;
    
    // If message was sent within 5 seconds of conversation creation and is outgoing
    if (timeDifference <= 5000 && message.message_type === 1) {
      return true;
    }
  }
  
  return false;
};

const customerMessagesSinceResponse = computed(() => {
  const { messages = [] } = props.conversation;
  
  console.log('All messages:', messages);
  
  // Find the index of the last human agent response
  const lastHumanResponseIndex = [...messages].reverse().findIndex(
    message => {
      const isHumanResponse = message.message_type === 1 && !isAutomatedAckMessage(message);
      console.log('Checking message:', message, 'isHumanResponse:', isHumanResponse);
      return isHumanResponse;
    }
  );
  
  console.log('Last human response index:', lastHumanResponseIndex);
  
  // If no human response found, return 0
  if (lastHumanResponseIndex === -1) {
    return 0;
  }
  
  // Get messages after the last human response
  const messagesSinceLastResponse = messages.slice(-lastHumanResponseIndex);
  console.log('Messages since last response:', messagesSinceLastResponse);
  
  // Count incoming messages since last human response
  const count = messagesSinceLastResponse.filter(
    message => message.message_type === 0
  ).length;
  
  console.log('Final count:', count);
  return count;
});

onMounted(() => {
  // fetchMessages();
});
</script>

<template>
  <div class="flex flex-col w-full gap-1">
    <div v-if="emailSubject" class="flex items-center mb-0 text-sm font-medium text-n-slate-12" 
         :class="shouldShowUnread ? 'font-medium' : ''">
      <span>↑</span>
      <span class="truncate ml-1">{{ emailSubject }}</span>
    </div>
    <div class="flex items-end w-full gap-2 pb-1">
      <p class="w-full mb-0 text-sm leading-7 text-n-slate-9 line-clamp-2" :class="shouldShowUnread ? 'font-medium' : ''">
        {{ lastNonActivityMessageContent }}
        <span class="text-xs text-n-slate-9"> #{{ conversationId }}</span>
      </p>
      <div class="flex items-center flex-shrink-0 gap-1 pb-2">
        <Avatar
          :name="assignee.name"
          :src="assignee.thumbnail"
          :size="20"
          :status="assignee.status"
          rounded-full
        />
        <!-- Messages Since Response Indicator (Blue) -->
        <div
          v-if="customerMessagesSinceResponse > 0"
          class="shadow-lg rounded-full text-xxs font-semibold h-4 leading-4 mr-1 min-w-[1rem] px-1 py-0 text-center text-white bg-n-blue-10"
        >
          {{ customerMessagesSinceResponse }}
        </div>
        <!-- Unread/Attention Indicator (Green) -->
        <div
          v-if="shouldShowUnread"
          class="inline-flex items-center justify-center rounded-full size-5 bg-green-500"
          :title="unreadMessagesCount > 0 ? `${unreadMessagesCount} unread message${unreadMessagesCount > 1 ? 's' : ''}` : 'Needs attention'"
        >
          <span class="text-xs font-semibold text-white">
            {{ unreadMessagesCount > 0 ? unreadMessagesCount : '!' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

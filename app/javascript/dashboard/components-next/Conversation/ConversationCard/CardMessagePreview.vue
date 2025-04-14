<script setup>
import { computed } from 'vue';
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

// Calculate the number of customer messages since last agent response
const customerMessagesSinceResponse = computed(() => {
  const { messages } = props.conversation;
  if (!messages || !messages.length) {
    return 0;
  }
  
  // Find the last outgoing message from the agent
  const messageArray = [...messages].reverse();
  const lastOutgoingIndex = messageArray.findIndex(message => message.message_type === 1); // 1 for outgoing
  
  // If no outgoing message found, all messages are from customer
  if (lastOutgoingIndex === -1) {
    // Count only incoming messages
    return messageArray.filter(message => message.message_type === 0).length;
  }
  
  // Count incoming messages since last outgoing message
  return messageArray.slice(0, lastOutgoingIndex)
    .filter(message => message.message_type === 0).length;
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
          class="inline-flex items-center justify-center rounded-full size-5 bg-n-blue-10"
          :title="customerMessagesSinceResponse === 1 ? '1 message since your last response' : `${customerMessagesSinceResponse} messages since your last response`"
        >
          <span class="text-xs font-semibold text-white">
            {{ customerMessagesSinceResponse }}
          </span>
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

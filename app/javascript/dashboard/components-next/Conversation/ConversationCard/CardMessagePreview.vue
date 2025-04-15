<script setup>
import { computed, ref, onMounted, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMessageFormatter } from 'shared/composables/useMessageFormatter';
import { 
  getLastMessage, 
  isAutomatedAckMessage, 
  getCustomerMessagesSinceResponse,
  shouldShowUnread as shouldShowUnreadHelper
} from 'dashboard/helper/conversationHelper';

import Avatar from 'dashboard/components-next/avatar/Avatar.vue';
import Icon from 'dashboard/components-next/icon/Icon.vue';
import { dynamicTime, shortTimestamp } from 'shared/helpers/timeHelper';

const props = defineProps({
  conversation: {
    type: Object,
    required: true,
  },
  unreadCount: {
    type: Number,
    default: 0,
  },
});

console.log('Component setup - props:', props);

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

const unreadMessagesCount = computed(() => props.unreadCount);

const shouldShowUnread = computed(() => {
  return shouldShowUnreadHelper(props.conversation, props.unreadCount);
});

const customerMessagesSinceResponse = computed(() => {
  console.log('CardMessagePreview - computing customerMessagesSinceResponse for:', props.conversation.id);
  
  // Directly call the helper function - we've updated it to handle all edge cases
  const count = getCustomerMessagesSinceResponse(props.conversation);
  console.log('CardMessagePreview - computed count:', count);
  return count;
});

onMounted(() => {
  console.log('MessagePreview component mounted for conversation:', props.conversation.id);
  console.log('Last non-activity message:', 
    props.conversation.last_non_activity_message ? 
    `ID: ${props.conversation.last_non_activity_message.id}, Type: ${props.conversation.last_non_activity_message.message_type}` : 
    'None');
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

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMessageFormatter } from 'shared/composables/useMessageFormatter';
import { 
  getLastMessage, 
  isAutomatedAckMessage, 
  getCustomerMessagesSinceResponse,
  shouldShowUnread as shouldShowUnreadHelper
} from 'dashboard/helper/conversationHelper';

import Avatar from 'dashboard/components-next/avatar/Avatar.vue';
import CardLabels from 'dashboard/components-next/Conversation/ConversationCard/CardLabels.vue';
import SLACardLabel from 'dashboard/components-next/Conversation/ConversationCard/SLACardLabel.vue';
import Icon from 'dashboard/components-next/icon/Icon.vue';

const props = defineProps({
  conversation: {
    type: Object,
    required: true,
  },
  accountLabels: {
    type: Array,
    required: true,
  },
  unreadCount: {
    type: Number,
    default: 0,
  },
});

const { t } = useI18n();

const slaCardLabelRef = ref(null);

const { getPlainText } = useMessageFormatter();

const lastNonActivityMessageContent = computed(() => {
  const { lastNonActivityMessage = {}, customAttributes = {} } =
    props.conversation;
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
  console.log('CardMessagePreviewWithMeta - computing customerMessagesSinceResponse for:', props.conversation.id);
  const count = getCustomerMessagesSinceResponse(props.conversation, props.unreadCount);
  console.log('CardMessagePreviewWithMeta - result:', count);
  return count;
});

const hasSlaThreshold = computed(() => {
  return (
    slaCardLabelRef.value?.hasSlaThreshold && props.conversation?.slaPolicyId
  );
});

defineExpose({
  hasSlaThreshold,
});
</script>

<template>
  <div class="flex flex-col w-full gap-1">
    <div v-if="emailSubject" class="flex items-center mb-0 text-sm font-medium text-n-slate-12"
         :class="shouldShowUnread ? 'font-medium' : ''">
      <span>↑</span>
      <span class="truncate ml-1">{{ emailSubject }}</span>
    </div>

    <div class="flex items-center justify-between w-full gap-2 py-1 h-7">
      <p class="mb-0 text-sm leading-7 text-n-slate-9 line-clamp-1" :class="shouldShowUnread ? 'font-medium' : ''">
        {{ lastNonActivityMessageContent }}
        <span class="text-xs text-n-slate-9"> #{{ conversationId }}</span>
      </p>

      <div class="flex items-center flex-shrink-0 gap-1">
        <!-- Messages Since Response Indicator (Blue) -->
        <div
          v-if="customerMessagesSinceResponse > 0"
          class="inline-flex items-center justify-center rounded-full size-5 bg-blue-600"
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

    <div
      class="grid items-center gap-2.5 h-7"
      :class="
        hasSlaThreshold
          ? 'grid-cols-[auto_auto_1fr_20px]'
          : 'grid-cols-[1fr_20px]'
      "
    >
      <SLACardLabel
        v-show="hasSlaThreshold"
        ref="slaCardLabelRef"
        :conversation="conversation"
      />
      <div v-if="hasSlaThreshold" class="w-px h-3 bg-n-slate-4" />
      <div class="overflow-hidden">
        <CardLabels
          :conversation-labels="conversation.labels"
          :account-labels="accountLabels"
        />
      </div>
      <Avatar
        :name="assignee.name"
        :src="assignee.thumbnail"
        :size="20"
        :status="assignee.status"
        rounded-full
      />
    </div>
  </div>
</template>

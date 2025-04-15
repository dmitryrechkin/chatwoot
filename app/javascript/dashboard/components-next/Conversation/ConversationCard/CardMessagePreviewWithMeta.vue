<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMessageFormatter } from 'shared/composables/useMessageFormatter';
import { 
  getLastMessage, 
  isAutomatedAckMessage, 
  getNewIncomingMessageCount
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
  const { lastNonActivityMessage = {} } =
    props.conversation;
  return getPlainText(
    lastNonActivityMessage?.content || t('CHAT_LIST.NO_CONTENT')
  );
});

const emailSubject = computed(() => {
  const { additional_attributes: additionalAttributes = {}, customAttributes = {} } = props.conversation;
  const { email: { subject } = {} } = customAttributes;

  return additionalAttributes.mail_subject || subject || null;
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

const newIncomingMessageCount = computed(() => {
  console.log('CardMessagePreviewWithMeta - computing newIncomingMessageCount for:', props.conversation.id);

  const count = getNewIncomingMessageCount(props.conversation, props.unreadCount);

  console.log('CardMessagePreviewWithMeta - result:', count);

  return count;
});

const hasNewIncomingMessages = computed(() => {
  return newIncomingMessageCount.value > 0;
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
         :class="hasNewIncomingMessages ? 'font-medium' : ''">
      <span>↑</span>
      <span class="truncate ml-1">{{ emailSubject }}</span>
    </div>

    <div class="flex items-center justify-between w-full gap-2 py-1 h-7">
      <p class="mb-0 text-sm leading-7 text-n-slate-9 line-clamp-1" :class="hasNewIncomingMessages ? 'font-medium' : ''">
        {{ lastNonActivityMessageContent }}
        <span class="text-xs text-n-slate-9"> #{{ conversationId }}</span>
      </p>

      <div class="flex items-center flex-shrink-0 gap-1">
        <!-- New Incoming Messages Indicator (Blue) -->
        <div
          v-if="newIncomingMessageCount > 0"
          class="inline-flex items-center justify-center rounded-full size-5 bg-blue-600"
          :title="newIncomingMessageCount === 1 ? '1 message since your last response' : `${newIncomingMessageCount} messages since your last response`"
        >
          <span class="text-xs font-semibold text-white">
            {{ newIncomingMessageCount }}
          </span>
        </div>
        <!-- Unread/Attention Indicator (Green) -->
        <div
          v-if="unreadMessagesCount > 0"
          class="inline-flex items-center justify-center rounded-full size-5 bg-green-500"
          :title="`${unreadMessagesCount} unread message${unreadMessagesCount > 1 ? 's' : ''}`"
        >
          <span class="text-xs font-semibold text-white">
            {{ unreadMessagesCount }}
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

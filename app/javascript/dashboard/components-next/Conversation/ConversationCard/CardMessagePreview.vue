<script setup>
import { computed, ref, onMounted, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMessageFormatter } from 'shared/composables/useMessageFormatter';
import { 
  getLastMessage, 
  isAutomatedAckMessage, 
  getNewIncomingMessageCount
} from 'dashboard/helper/conversationHelper';

import Avatar from 'dashboard/components-next/avatar/Avatar.vue';
import Icon from 'dashboard/components-next/icon/Icon.vue';

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

const { t } = useI18n();

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
  console.log('CardMessagePreview - computing newIncomingMessageCount for:', props.conversation.id);

  const count = getNewIncomingMessageCount(props.conversation, props.unreadCount);

  console.log('CardMessagePreview - result:', count);

  return count;
});

const hasNewIncomingMessages = computed(() => {
  return newIncomingMessageCount.value > 0;
});
</script>

<template>
  <div class="flex flex-col w-full gap-1">
    <div v-if="emailSubject" class="flex items-center mb-0 text-sm font-medium text-n-slate-12" 
         :class="hasNewIncomingMessages ? 'font-medium' : ''">
      <span>↑</span>
      <span class="truncate ml-1">{{ emailSubject }}</span>
    </div>
    <div class="flex items-end w-full gap-2 pb-1">
      <p class="w-full mb-0 text-sm leading-7 text-n-slate-9 line-clamp-2" :class="hasNewIncomingMessages ? 'font-medium' : ''">
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
        <!-- New Incoming Messages Indicator (Blue) -->
        <div
          v-if="newIncomingMessageCount > 0"
          class="shadow-lg rounded-full text-xxs font-semibold h-4 leading-4 mr-1 min-w-[1rem] px-1 py-0 text-center text-white bg-n-blue-10"
        >
          {{ newIncomingMessageCount }}
        </div>
        <!-- Unread/Attention Indicator (Green) -->
        <div
          v-if="unreadMessagesCount > 0"
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

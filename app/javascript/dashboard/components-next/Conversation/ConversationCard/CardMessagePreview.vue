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
      <div class="flex items-center flex-shrink-0 gap-2 pb-2">
        <Avatar
          :name="assignee.name"
          :src="assignee.thumbnail"
          :size="20"
          :status="assignee.status"
          rounded-full
        />
        <div
          v-if="shouldShowUnread"
          class="inline-flex items-center justify-center rounded-full size-5 bg-red-500"
        >
          <span class="text-xs font-semibold text-white">
            {{ unreadMessagesCount > 0 ? unreadMessagesCount : '!' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

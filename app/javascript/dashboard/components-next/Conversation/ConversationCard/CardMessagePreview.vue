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
  const { customAttributes = {} } = props.conversation;
  const { email: { subject } = {} } = customAttributes;
  return subject ? getPlainText(subject) : null;
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
</script>

<template>
  <div class="flex flex-col w-full gap-1">
    <div v-if="emailSubject" class="flex items-center mb-0 text-sm font-medium text-n-brand">
      <Icon icon="mail" size="16" class="mr-1" />
      <span class="truncate">{{ emailSubject }}</span>
    </div>
    <div class="flex items-center mb-0 text-xs text-n-slate-9">
      <span>#{{ conversationId }}</span>
    </div>
    <div class="flex items-end w-full gap-2 pb-1">
      <p class="w-full mb-0 text-sm leading-7 text-n-slate-12 line-clamp-2">
        {{ lastNonActivityMessageContent }}
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
          v-if="unreadMessagesCount > 0"
          class="inline-flex items-center justify-center rounded-full size-5 bg-n-brand"
        >
          <span class="text-xs font-semibold text-white">
            {{ unreadMessagesCount }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

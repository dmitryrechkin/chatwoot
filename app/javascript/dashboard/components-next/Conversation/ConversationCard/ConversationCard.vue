<script setup>
import { computed, ref, onMounted, provide, onUnmounted, watch } from 'vue';
import { getInboxIconByType } from 'dashboard/helper/inbox';
import { useRouter, useRoute } from 'vue-router';
import { frontendURL, conversationUrl } from 'dashboard/helper/URLHelper.js';
import { dynamicTime, shortTimestamp } from 'shared/helpers/timeHelper';
import { useStore } from 'vuex';

import Icon from 'dashboard/components-next/icon/Icon.vue';
import Avatar from 'dashboard/components-next/avatar/Avatar.vue';
import CardMessagePreview from './CardMessagePreview.vue';
import CardMessagePreviewWithMeta from './CardMessagePreviewWithMeta.vue';
import CardPriorityIcon from './CardPriorityIcon.vue';

const props = defineProps({
  conversation: {
    type: Object,
    default: null,
  },
  contact: {
    type: Object,
    required: true,
  },
  stateInbox: {
    type: Object,
    required: true,
  },
  accountLabels: {
    type: Array,
    required: true,
  },
  conversations: {
    type: Array,
    required: true,
  },
  hideLabels: {
    type: Boolean,
    default: false,
  },
  active: {
    type: Boolean,
    default: false,
  },
});

const router = useRouter();
const route = useRoute();

const cardMessagePreviewWithMetaRef = ref(null);

const currentContact = computed(() => props.contact);

const currentContactName = computed(() => currentContact.value?.name);
const currentContactThumbnail = computed(() => currentContact.value?.thumbnail);
const currentContactStatus = computed(
  () => currentContact.value?.availabilityStatus
);

const inbox = computed(() => props.stateInbox);

const inboxName = computed(() => inbox.value?.name);

const inboxIcon = computed(() => {
  const { phoneNumber, channelType } = inbox.value;
  return getInboxIconByType(channelType, phoneNumber);
});

const lastActivityAt = computed(() => {
  const timestamp = props.conversation?.timestamp;
  return timestamp ? shortTimestamp(dynamicTime(timestamp)) : '';
});

const showMessagePreviewWithoutMeta = computed(() => {
  const { labels = [] } = props.conversation;
  return (
    !cardMessagePreviewWithMetaRef.value?.hasSlaThreshold && labels.length === 0
  );
});

const onCardClick = e => {
  const path = frontendURL(
    conversationUrl({
      accountId: route.params.accountId,
      id: props.conversation.id,
    })
  );

  if (e.metaKey || e.ctrlKey) {
    window.open(
      window.chatwootConfig.hostURL + path,
      '_blank',
      'noopener noreferrer nofollow'
    );
    return;
  }
  router.push({ path });
};

const messages = ref({});
const isLoading = ref(false);
const messageCache = new Map(); // Cache for computed results

// Provide basic message access
provide('conversationMessages', {
  messages: computed(() => messages.value)
});

onMounted(() => {
  console.log('🔵 [NEXT VERSION] ConversationCard component mounted for conversation:', props.conversation?.id);
  
  // Setup store subscription to listen for message updates
  const store = useStore();
  const unsubscribe = store.subscribe((mutation) => {
    // Only listen for mutations related to this conversation
    if (!props.conversation) return;
    
    // Check if this mutation concerns messages
    if (mutation.type.includes('MESSAGE') && 
        mutation.payload && 
        mutation.payload.conversation_id === props.conversation.id) {
      // Force reactivity update by toggling a reactive property
      props.conversation._lastUpdate = Date.now();
    }
  });
  
  // Clean up subscription on unmount
  onUnmounted(() => {
    unsubscribe();
  });
});

onUnmounted(() => {
  // Cleanup logic when component is unmounted
});

// Add a watcher for the conversation property to keep indicators updated
watch(() => props.conversation, (newConversation) => {
  if (!newConversation) return;
  
  console.log('🔵 [NEXT VERSION] Conversation updated:', {
    id: newConversation.id,
    hasLastNonActivityMessage: !!newConversation.last_non_activity_message,
    lastMessageType: newConversation.last_non_activity_message?.message_type,
    unreadCount: newConversation.unread_count
  });
  
  // This will trigger a re-render of child components and update indicators
}, { deep: true });
</script>

<template>
  <div
    role="button"
    class="flex w-full gap-3 px-3 py-4 transition-all duration-300 ease-in-out cursor-pointer"
    @click="onCardClick"
    :data-conversation-id="conversation.id"
    :id="`conversation-card-${conversation.id}`"
  >
    <Avatar
      :name="currentContactName"
      :src="currentContactThumbnail"
      :size="24"
      :status="currentContactStatus"
      rounded-full
    />
    <div class="flex flex-col w-full gap-1 min-w-0">
      <div class="flex items-center justify-between h-6 gap-2">
        <h4 class="text-base font-medium truncate text-n-slate-12">
          {{ currentContactName }}
          <span class="font-normal text-xs text-n-slate-9"> #{{ conversation.id }}</span>
        </h4>
        <div class="flex items-center gap-2">
          <CardPriorityIcon :priority="conversation.priority || null" />
          <div
            v-tooltip.left="inboxName"
            class="flex items-center justify-center flex-shrink-0 rounded-full bg-n-alpha-2 size-5"
          >
            <Icon
              :icon="inboxIcon"
              class="flex-shrink-0 text-n-slate-11 size-3"
            />
          </div>
          <span class="text-sm text-n-slate-10">
            {{ lastActivityAt }}
          </span>
        </div>
      </div>
      <CardMessagePreview
        v-show="showMessagePreviewWithoutMeta"
        :conversation="conversation"
        :unread-count="conversation.unread_count"
      />
      <CardMessagePreviewWithMeta
        v-show="!showMessagePreviewWithoutMeta"
        ref="cardMessagePreviewWithMetaRef"
        :conversation="conversation"
        :account-labels="accountLabels"
        :unread-count="conversation.unread_count"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch, provide } from 'vue';
import { getInboxIconByType } from 'dashboard/helper/inbox';
import { useRouter, useRoute } from 'vue-router';
import { frontendURL, conversationUrl } from 'dashboard/helper/URLHelper.js';
import { dynamicTime, shortTimestamp } from 'shared/helpers/timeHelper';
import axios from 'axios';
import { 
  getLastMessage, 
  isAutomatedAckMessage, 
  getCustomerMessagesSinceResponse,
  shouldShowUnread
} from 'dashboard/helper/conversationHelper';

import Icon from 'dashboard/components-next/icon/Icon.vue';
import Avatar from 'dashboard/components-next/avatar/Avatar.vue';
import CardMessagePreview from './CardMessagePreview.vue';
import CardMessagePreviewWithMeta from './CardMessagePreviewWithMeta.vue';
import CardPriorityIcon from './CardPriorityIcon.vue';

const props = defineProps({
  conversation: {
    type: Object,
    required: true,
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
const batchSize = 10;
const messageCache = new Map(); // Cache for computed results

// Simple debounce implementation
const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
};

const fetchMessagesForBatch = debounce(async (conversationIds) => {
  if (isLoading.value) return;
  
  // Filter out conversations we already have messages for
  const conversationsToFetch = conversationIds.filter(id => !messages.value[id]);
  if (conversationsToFetch.length === 0) return;
  
  try {
    isLoading.value = true;
    const response = await axios.post('/api/v1/conversations/batch_messages', {
      conversation_ids: conversationsToFetch
    });
    
    response.data.forEach(conversationData => {
      messages.value[conversationData.conversation_id] = conversationData.messages;
      // Clear cache when new messages arrive
      messageCache.delete(conversationData.conversation_id);
    });
  } catch (error) {
    console.error('Error fetching batch messages:', error);
    // Implement retry logic here if needed
  } finally {
    isLoading.value = false;
  }
}, 300); // Debounce for 300ms

// Priority loading for conversations with unread messages
const loadVisibleMessages = () => {
  const conversations = props.conversations
    .filter(conv => !messages.value[conv.id]);
    
  // Split into priority and regular conversations
  const priorityConversations = conversations
    .filter(conv => conv.unreadCount > 0)
    .slice(0, batchSize / 2);
    
  const regularConversations = conversations
    .filter(conv => conv.unreadCount === 0)
    .slice(0, batchSize - priorityConversations.length);
    
  const conversationsToLoad = [...priorityConversations, ...regularConversations];
  
  if (conversationsToLoad.length > 0) {
    fetchMessagesForBatch(conversationsToLoad.map(conv => conv.id));
  }
};

// Add intersection observer for lazy loading
const setupIntersectionObserver = () => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const conversationId = entry.target.dataset.conversationId;
        if (conversationId && !messages.value[conversationId]) {
          fetchMessagesForBatch([conversationId]);
        }
      }
    });
  }, { threshold: 0.1 });
  
  return observer;
};

onMounted(() => {
  const observer = setupIntersectionObserver();
  // Apply observer to conversation elements
  document.querySelectorAll('[data-conversation-id]').forEach(el => {
    observer.observe(el);
  });
});

// Provide enhanced message access with caching
provide('conversationMessages', {
  messages,
  getMessageCount: (conversationId) => {
    if (messageCache.has(conversationId)) {
      return messageCache.get(conversationId);
    }
    
    const messages = messages.value[conversationId] || [];
    
    // Find the index of the last human agent response
    const lastHumanResponseIndex = [...messages].reverse().findIndex(
      message => message.message_type === 'outgoing' && !isAutomatedAckMessage(message)
    );
    
    // If no human response found, return 0
    if (lastHumanResponseIndex === -1) {
      messageCache.set(conversationId, 0);
      return 0;
    }
    
    // Get messages after the last human response
    const messagesSinceLastResponse = messages.slice(-lastHumanResponseIndex);
    
    // Count incoming messages since last human response
    const count = messagesSinceLastResponse.filter(
      message => message.message_type === 'incoming'
    ).length;
    
    messageCache.set(conversationId, count);
    return count;
  }
});
</script>

<template>
  <div
    role="button"
    class="flex w-full gap-3 px-3 py-4 transition-all duration-300 ease-in-out cursor-pointer"
    @click="onCardClick"
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

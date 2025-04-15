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

// Add a watcher for the conversation's messages
watch(() => props.conversation?.messages, (newMessages, oldMessages) => {
  console.log('🔵 [NEXT VERSION] Conversation messages changed:', {
    id: props.conversation?.id,
    hasMessages: !!newMessages,
    messageCount: newMessages?.length || 0,
    oldMessageCount: oldMessages?.length || 0
  });

  // If messages are provided via props, update our local cache
  if (newMessages && newMessages.length > 0) {
    console.log(`🔵 [NEXT VERSION] Auto-updating messages for conversation ${props.conversation.id} from props`);
    messages.value[props.conversation.id] = newMessages;
    messageCache.delete(props.conversation.id);
  }
}, { immediate: true });

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
  console.log('🔵 [NEXT VERSION] fetchMessagesForBatch called for:', conversationIds);
  
  if (!conversationIds || conversationIds.length === 0) {
    console.log('🔵 [NEXT VERSION] No conversation IDs provided');
    return;
  }
  
  if (isLoading.value) {
    console.log('🔵 [NEXT VERSION] Skipping batch fetch - already loading');
    return;
  }
  
  // Filter out conversations we already have messages for
  const conversationsToFetch = conversationIds.filter(id => !messages.value[id]);
  if (conversationsToFetch.length === 0) {
    console.log('🔵 [NEXT VERSION] No new conversations to fetch');
    return;
  }
  
  console.log(`🔵 [NEXT VERSION] Fetching messages for conversations: ${conversationsToFetch.join(', ')}`);
  
  try {
    isLoading.value = true;
    const response = await axios.post('/api/v1/conversations/batch_messages', {
      conversation_ids: conversationsToFetch
    });
    
    if (!response.data || !Array.isArray(response.data)) {
      console.error('🔵 [NEXT VERSION] Received invalid response from batch_messages API:', response);
      return;
    }
    
    console.log(`🔵 [NEXT VERSION] Received batch messages for ${response.data.length} conversations`);
    
    if (response.data.length === 0) {
      console.log('🔵 [NEXT VERSION] No messages found for requested conversations');
      return;
    }
    
    // Process each conversation's messages
    response.data.forEach(conversationData => {
      if (!conversationData || !conversationData.conversation_id) {
        console.error('🔵 [NEXT VERSION] Invalid conversation data in response:', conversationData);
        return;
      }
      
      const convoId = conversationData.conversation_id;
      console.log(`🔵 [NEXT VERSION] Processing messages for conversation ${convoId}: ${conversationData.messages?.length || 0} messages`);
      
      if (!conversationData.messages || !Array.isArray(conversationData.messages)) {
        console.error('🔵 [NEXT VERSION] Missing or invalid messages array for conversation:', convoId);
        return;
      }
      
      // Store the messages in our local ref
      messages.value[convoId] = conversationData.messages;
      
      // Clear cache when new messages arrive
      messageCache.delete(convoId);
      
      // Update conversation object directly if it's in our props
      const matchingConvo = props.conversations.find(c => c.id === convoId);
      if (matchingConvo) {
        console.log(`🔵 [NEXT VERSION] Updating conversation ${convoId} directly with ${conversationData.messages.length} messages`);
        matchingConvo.messages = conversationData.messages;
      }
      
      // Update current conversation if it matches
      if (props.conversation && props.conversation.id === convoId) {
        console.log(`🔵 [NEXT VERSION] Updating current conversation ${convoId} directly`);
        props.conversation.messages = conversationData.messages;
      }
    });
    
    // Force a reactivity update by recreating the messages object
    messages.value = { ...messages.value };
    
    console.log('🔵 [NEXT VERSION] Batch message loading complete');
  } catch (error) {
    console.error('🔵 [NEXT VERSION] Error fetching batch messages:', error);
    // If there was an API error, try individual fetch for conversations 
    if (conversationsToFetch.length > 1) {
      console.log('🔵 [NEXT VERSION] Attempting individual fetch for each conversation');
      conversationsToFetch.forEach(id => {
        setTimeout(() => {
          fetchMessagesForBatch([id]);
        }, 100);
      });
    }
  } finally {
    isLoading.value = false;
  }
}, 100); // Reduce debounce to 100ms to load faster

// Priority loading for conversations with unread messages
const loadVisibleMessages = () => {
  console.log('🔵 [NEXT VERSION] loadVisibleMessages called for ConversationCard');
  
  // Increase batch size to load more conversations at once
  const increasedBatchSize = 30;
  
  // Get all conversations without loaded messages
  const conversationsToLoad = props.conversations
    .filter(conv => !messages.value[conv.id])
    .slice(0, increasedBatchSize);
    
  console.log(`🔵 [NEXT VERSION] Found ${conversationsToLoad.length} conversations without loaded messages`);
  
  if (conversationsToLoad.length > 0) {
    console.log('🔵 [NEXT VERSION] Loading all visible conversations immediately:', 
      conversationsToLoad.map(c => c.id));
    fetchMessagesForBatch(conversationsToLoad.map(conv => conv.id));
  }
  
  // Also ensure current conversation is loaded if it's not part of the batch
  if (props.conversation && props.conversation.id && 
      !messages.value[props.conversation.id] && 
      !conversationsToLoad.find(c => c.id === props.conversation.id)) {
    console.log(`🔵 [NEXT VERSION] Loading current conversation ${props.conversation.id} separately`);
    fetchMessagesForBatch([props.conversation.id]);
  }
};

// Add intersection observer for lazy loading
const setupIntersectionObserver = () => {
  console.log('🔵 [NEXT VERSION] Setting up intersection observer');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const conversationId = entry.target.dataset.conversationId;
        if (conversationId && !messages.value[conversationId]) {
          console.log(`🔵 [NEXT VERSION] Conversation ${conversationId} visible, loading messages`);
          fetchMessagesForBatch([conversationId]);
        }
      }
    });
  }, { threshold: 0.1 });
  
  return observer;
};

onMounted(() => {
  console.log('🔵 [NEXT VERSION] ConversationCard component mounted');
  console.log('🔵 [NEXT VERSION] Initial conversation data:', {
    id: props.conversation?.id,
    hasMessages: !!props.conversation?.messages,
    messageCount: props.conversation?.messages?.length || 0,
    hasLastMessage: !!props.conversation?.last_non_activity_message,
    messagesFromStore: !!messages.value[props.conversation?.id]
  });
  
  // FORCE IMMEDIATE MESSAGE LOADING - No delay to ensure indicators appear immediately
  if (props.conversation && props.conversation.id) {
    console.log(`🔵 [NEXT VERSION] FORCING immediate message load for conversation ${props.conversation.id}`);
    try {
      axios.post('/api/v1/conversations/batch_messages', {
        conversation_ids: [props.conversation.id]
      }).then(response => {
        console.log(`🔵 [NEXT VERSION] Forced load successful for ${props.conversation.id}`);
        if (response.data && response.data.length > 0) {
          response.data.forEach(conversationData => {
            console.log(`🔵 [NEXT VERSION] Loaded ${conversationData.messages?.length || 0} messages for conversation ${conversationData.conversation_id}`);
            messages.value[conversationData.conversation_id] = conversationData.messages;
            
            // Force the conversation to update its messages directly
            if (props.conversation.id === conversationData.conversation_id) {
              props.conversation.messages = conversationData.messages;
              console.log(`🔵 [NEXT VERSION] Updated conversation directly with ${conversationData.messages.length} messages`);
            }
          });
          // Force reactivity
          messages.value = { ...messages.value };
        }
      }).catch(err => {
        console.error('🔵 [NEXT VERSION] Error in forced message loading:', err);
      });
    } catch (error) {
      console.error('🔵 [NEXT VERSION] Exception in forced message loading:', error);
    }
  }
  
  // Apply observer to load any other conversations that become visible
  const observer = setupIntersectionObserver();
  
  // Apply observer to conversation elements
  const elements = document.querySelectorAll('[data-conversation-id]');
  console.log(`🔵 [NEXT VERSION] Found ${elements.length} conversation elements to observe`);
  elements.forEach(el => {
    observer.observe(el);
  });
  
  // No delays for message loading - load all visible conversations immediately
  loadVisibleMessages();
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

import React, {useState} from 'react';
import {Box, Flex, Heading, Text, ThemeProvider} from 'theme-ui';

import {motion} from 'framer-motion';
import {
  streamMessage,
  ChatMessage as A2AChatMessage,
} from '../helpers/a2a-client';
import {
  getChatHistory,
  saveChatHistory,
  getSessionId,
  getContextId,
  setContextId,
  clearChatSession,
  StoredMessage,
} from '../helpers/storage';

// Local helper functions (A2A mode)
const isCustomerMessage = (msg: any, customerId?: string): boolean => {
  return !!(msg?.customer_id || msg?.type === 'customer');
};

const isAgentMessage = (msg: any): boolean => {
  return !!(msg?.user_id || msg?.type === 'agent' || msg?.type === 'bot');
};
import ChatHeader from './ChatHeader';
import ChatMessages from './ChatMessages';
import ChatFooter from './ChatFooter';
import InhotelBranding from './InhotelBranding';
import {
  shorten,
  shouldActivateGameMode,
  setupPostMessageHandlers,
} from '../helpers/utils';
import {
  Message,
  CustomerMetadata,
  WidgetSettings,
  QuickReply,
} from '../helpers/types';
import Logger from '../helpers/logger';
import {fetchAgentAvatar, AVATAR_LOAD_TIMEOUT_MS} from '../helpers/agent-card';
import {
  Appearance,
  FormFieldAppearance,
  settingsAppearance,
} from '../helpers/appearance';
import {
  agentEndpoint,
  isTrustedParentMessage,
  isValidAssistantProfileId,
} from '../helpers/embed-security';
import {
  isWindowHidden,
  addVisibilityEventListener,
} from '../helpers/visibility';
import analytics from '../helpers/analytics';
import EmbeddedGame from './EmbeddedGame';
import UnreadMessages from './UnreadMessages';
import ContactForm from './ContactForm';
import ChatFooterEmail from './ChatFooterEmail';
// import Swal from 'sweetalert2';

type Props = {
  inboxId?: string;
  accountId: string;
  customerId?: string;
  title?: string;
  subtitle?: string;
  baseUrl?: string;
  greeting?: string;
  awayMessage?: string;
  newMessagePlaceholder?: string;
  emailInputPlaceholder?: string;
  newMessagesNotificationText?: string;
  shouldRequireEmail?: boolean;
  isMobile?: boolean;
  customer?: CustomerMetadata;
  companyName?: string;
  agentAvailableText?: string;
  agentUnavailableText?: string;
  showAgentAvailability?: boolean;
  disableAnalyticsTracking?: boolean;
  isCloseable?: boolean;
  debug?: boolean;
  version?: string;
  ts?: string;
  primaryColor?: string;
  position?: string;
  shouldShowContactForm?: boolean;
  hotelPhone?: string;
  hotelEmail?: string;
  avatarURL?: string;
  parentOrigin?: string | null;
  assistantRemount?: boolean;
  // What the chat looks like: its blocks and their values. Left out, it is
  // the look the flat settings above describe.
  appearance?: Appearance;
  // Whether the assistant's appearance profile is still being read. Until
  // that is over, the greeting the launcher may show above its button is not
  // known.
  isAppearancePending?: boolean;
};

type State = {
  messages: Array<Message>;
  customerId: string;
  conversationId: string | null;
  availableAgents: Array<any>;
  settings: WidgetSettings;
  isSending: boolean;
  isOpen: boolean;
  isTransitioning: boolean;
  isGameMode?: boolean;
  shouldDisplayNotifications: boolean;
  popUpInitialMessage?: boolean;
  shouldDisplayBranding: boolean;
  isMailIconClicked: boolean;
  isContactFormSubmitted: boolean;
  firstName: string;
  lastName: string;
  email: string;
  message: string;
  clickedSubmit: boolean;
  errors: {
    firstName: '';
    lastName: '';
    email: '';
    message: '';
  };
  isLoading: boolean;
  statusMessageCF: string;
  numberOfMessages: number;
  shouldSummarize: boolean;
  isSummarizeGenerated: boolean;
  shouldShowMessageLoading: boolean;
  avatarURL: string;
  agentCardAvatarURL: string | null | undefined;
  isAvatarLoading: boolean;
};

class ChatWindow extends React.Component<Props, State> {
  scrollToEl: any = null;
  avatarRequest: AbortController | null = null;
  messageRequest: AbortController | null = null;
  avatarTimeout: ReturnType<typeof setTimeout> | null = null;
  subscriptions: Array<() => void> = [];
  logger: Logger;
  // The greeting the conversation was last opened with, and whether it was
  // an appearance profile's.
  shownGreeting: string | undefined = undefined;
  shownFromProfile = false;
  // A2A mode - no legacy SDK instance

  constructor(props: Props) {
    super(props);

    const {debug: debugModeEnabled, disableAnalyticsTracking = false} = props;

    this.logger = new Logger(debugModeEnabled);

    if (!disableAnalyticsTracking) {
      this.logger.debug('Initializing analytics...');
      // Just initializes Sentry for error monitoring if available
      analytics.init();
    } else {
      this.logger.debug('Analytics disabled.');
    }
    console.log('Here is the position from Frontend: ' + this.props.position);
    const win = window as any;
    const doc = (document || win.document) as any;

    // A2A mode - no legacy initialization needed
    // Messages and session will be loaded from localStorage in componentDidMount

    this.subscriptions = [
      setupPostMessageHandlers(win, this.postMessageHandlers),
      addVisibilityEventListener(doc, this.handleVisibilityChange),
    ];

    this.state = {
      messages: [],
      // TODO: figure out how to determine these, either by IP or localStorage
      // (eventually we will probably use cookies for this)
      // TODO: remove this from state if possible, just use props instead?
      customerId: null,
      availableAgents: [],
      settings: {} as WidgetSettings,
      conversationId: null,
      isSending: false,
      isOpen: false,
      isTransitioning: false,
      isGameMode: false,
      shouldDisplayNotifications: false,
      popUpInitialMessage: false,
      shouldDisplayBranding: false,
      isMailIconClicked: false,
      isContactFormSubmitted: false,
      firstName: null,
      lastName: null,
      email: null,
      message: null,
      clickedSubmit: false,
      errors: {
        firstName: '',
        lastName: '',
        email: '',
        message: '',
      },
      isLoading: false,
      statusMessageCF: '',
      numberOfMessages: 0,
      shouldSummarize: false,
      isSummarizeGenerated: false,
      shouldShowMessageLoading: false,
      avatarURL: props.avatarURL,
      agentCardAvatarURL: undefined,
      isAvatarLoading: true,
    };
  }

  async componentDidMount() {
    // A2A mode - restore history from localStorage
    const {inboxId} = this.props;
    const greeting = this.greetingText();
    this.shownGreeting = greeting;
    this.shownFromProfile = this.look().source === 'profile';
    if (inboxId) {
      const savedHistory = getChatHistory(inboxId);
      const savedSessionId = getSessionId(inboxId);

      // Convert StoredMessage to Message format
      const restoredMessages: Message[] = savedHistory.map((m, idx) => ({
        id: `restored-${idx}`,
        body: m.content,
        customer_id: m.role === 'user' ? 'customer' : undefined,
        user_id: m.role === 'assistant' ? 1 : undefined, // Use number for user_id
        created_at: m.timestamp,
        type: (m.role === 'user'
          ? 'customer'
          : m.type === 'bot' || (!m.type && idx === 0 && m.content === greeting)
          ? 'bot'
          : 'agent') as 'customer' | 'agent' | 'bot',
        // Add user object for assistant messages to preserve avatar
        user:
          m.role === 'assistant'
            ? {
                id: 1,
                email: 'assistant@inhotel.io',
                display_name: null,
                full_name: null,
                profile_photo_url: this.state.avatarURL,
              }
            : undefined,
      }));

      // Add greeting if no messages and greeting exists
      if (restoredMessages.length === 0 && greeting) {
        restoredMessages.push(this.greetingMessage(greeting));
      }

      this.setState({
        messages: restoredMessages,
        conversationId: savedSessionId,
      });
    }

    this.loadAgentAvatar();
    this.emit('chat:loaded', {assistantRemount: this.props.assistantRemount});

    if (this.isOnDeprecatedVersion()) {
      console.warn(
        'You are currently on a deprecated version of InHotel Chat.'
      );
      console.warn('Please upgrade to the latest version.');
    }
  }

  componentDidUpdate(previous: Props) {
    if (previous.inboxId !== this.props.inboxId) {
      this.setState({agentCardAvatarURL: undefined, isAvatarLoading: true});
      this.loadAgentAvatar();
    }
    const followed = this.followGreeting();
    // The read of the profile is over and changed no greeting. If the
    // launcher is waiting to show one above its button and there is none, it
    // is told so now.
    if (
      previous.isAppearancePending &&
      !this.props.isAppearancePending &&
      !followed
    ) {
      this.setState(null, this.settlePreview);
    }
  }

  // What the chat looks like. `Widget` passes the model it resolved from the
  // assistant's appearance profile; without one it is what the flat settings
  // describe.
  look = (): Appearance => {
    const {
      appearance,
      title,
      subtitle,
      greeting,
      newMessagePlaceholder,
      primaryColor,
      shouldShowContactForm,
    } = this.props;

    return (
      appearance ||
      settingsAppearance({
        title,
        subtitle,
        greeting,
        newMessagePlaceholder,
        primaryColor,
        shouldShowContactForm,
      })
    );
  };

  greetingText = (): string | undefined => {
    const {greeting} = this.look();

    return greeting ? greeting.text : undefined;
  };

  greetingMessage = (body: string): Message => ({
    id: 'greeting',
    body,
    customer_id: undefined,
    user_id: 0, // Bot user
    created_at: new Date().toISOString(),
    type: 'bot',
  });

  // The greeting is the look's. When an appearance profile arrives after the
  // chat has loaded, or changes, the greeting follows it while the guest has
  // not written. A conversation under way is left as it is, and so is a
  // greeting that changes in the settings alone, as it always was.
  // Whether the conversation was asked to follow a greeting that changed.
  followGreeting = (): boolean => {
    const greeting = this.greetingText();
    const fromProfile = this.look().source === 'profile';
    const follows =
      greeting !== this.shownGreeting && (fromProfile || this.shownFromProfile);
    this.shownGreeting = greeting;
    this.shownFromProfile = fromProfile;
    if (!follows) return false;

    this.setState(({messages}) => {
      const isUntouched =
        messages.length === 0 ||
        (messages.length === 1 && messages[0].id === 'greeting');

      return isUntouched
        ? {messages: greeting ? [this.greetingMessage(greeting)] : []}
        : null;
    }, this.settlePreview);
    return true;
  };

  loadAgentAvatar = () => {
    if (this.avatarRequest) this.avatarRequest.abort();
    if (this.avatarTimeout) clearTimeout(this.avatarTimeout);
    const controller = new AbortController();
    const profileId = this.props.inboxId || '';
    this.avatarRequest = controller;
    this.avatarTimeout = setTimeout(() => {
      if (this.avatarRequest !== controller) return;
      controller.abort();
      this.avatarTimeout = null;
      this.setState({agentCardAvatarURL: null, isAvatarLoading: false});
    }, AVATAR_LOAD_TIMEOUT_MS);
    fetchAgentAvatar(profileId, controller.signal).then((url) => {
      if (
        controller.signal.aborted ||
        this.avatarRequest !== controller ||
        this.props.inboxId !== profileId
      )
        return;
      if (this.avatarTimeout) clearTimeout(this.avatarTimeout);
      this.avatarTimeout = null;
      this.setState({agentCardAvatarURL: url, isAvatarLoading: false});
    });
  };

  componentWillUnmount() {
    if (this.messageRequest) this.messageRequest.abort();
    if (this.avatarRequest) this.avatarRequest.abort();
    if (this.avatarTimeout) clearTimeout(this.avatarTimeout);
    // A2A mode - no legacy SDK to disconnect
    this.subscriptions.forEach((unsubscribe) => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
  }

  emit = (event: string, data = {}) => {
    const payload = {...data, ts: this.props.ts};
    this.logger.debug('Sending event from iframe:', {event, payload});

    const {parentOrigin} = this.props;
    if (!parentOrigin || window.parent === window) return;
    window.parent.postMessage({event, payload}, parentOrigin);
  };

  postMessageHandlers = (msg: any) => {
    if (!isTrustedParentMessage(msg, this.props.parentOrigin, window)) return;
    const {event, payload = {}} = msg.data;
    this.logger.debug('Handling in iframe:', msg.data);

    switch (event) {
      case 'customer:set:id':
        // A2A mode - customer ID handling is local
        return this.setState({customerId: payload});
      case 'customer:update':
        return this.handleCustomerUpdated(payload);
      case 'notifications:display':
        return this.handleDisplayNotifications(payload);
      case 'inhotel:toggle':
        return this.handleToggleDisplay(payload);
      case 'inhotel:plan':
        return this.handleInhotelPlan(payload);
      case 'inhotel:ping':
        return this.logger.debug('Pong!');
      default:
        return null;
    }
  };

  handleCustomerUpdated = (payload: any) => {
    const {customerId, metadata = {}} = payload;
    // A2A mode - just update local state, no remote call
    if (customerId) {
      this.setState({customerId});
    }
  };

  handleDisplayNotifications = (payload: any) => {
    const {
      shouldDisplayNotifications = false,
      popUpInitialMessage = false,
    } = payload;

    return this.setState(
      {
        shouldDisplayNotifications,
        popUpInitialMessage,
      },
      this.settlePreview
    );
  };

  // The launcher may be showing the greeting above its button. When there is
  // none to show it is told so, as it is when the chat loads with nothing
  // unread; it would otherwise hold an empty frame open. While the profile is
  // still being read the greeting is not known yet, so the launcher waits.
  settlePreview = () => {
    const {shouldDisplayNotifications, popUpInitialMessage} = this.state;
    if (
      shouldDisplayNotifications &&
      popUpInitialMessage &&
      !this.props.isAppearancePending &&
      this.getUnreadMessages().length === 0
    ) {
      this.markMessagesAsSeen();
    }
  };

  onWidgetSettingsLoaded = (settings: WidgetSettings) => {
    this.setState({settings});
  };

  onSetCustomerId = (customerId: string) => {
    this.logger.debug('Setting customer ID:', customerId);

    if (customerId !== this.state.customerId) {
      this.setState({customerId});
      this.emit('customer:updated', {customerId});
    }
  };

  onSetConversationId = (conversationId: string) => {
    this.setState({conversationId});
    this.emit('conversation:join', {
      conversationId,
      customerId: this.state.customerId,
    });
  };

  onConversationCreated = (customerId: string, data: any) => {
    this.logger.debug('Handling conversation created:', data);
  };

  onMessagesUpdated = (messages: Array<Message>) => {
    this.setState({messages}, () => this.scrollIntoView());

    const unseenMessages = messages.filter(
      (msg: Message) => !msg.seen_at && !!msg.user_id
    );

    if (unseenMessages.length > 0) {
      const [firstUnseenMessage] = unseenMessages;

      this.emitUnseenMessage(firstUnseenMessage);
    }
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.user !== null) {
      // console.log("LAst Message: ", messages[messages.length-1]);
      this.setState({shouldShowMessageLoading: false});
      // console.log("shouldShowMessageLoading: ", this.state.shouldShowMessageLoading);
    }
  };

  scrollIntoView = () => {
    if (this.scrollToEl && this.scrollToEl.parentElement) {
      const parent = this.scrollToEl.parentElement;
      parent.scrollTop = this.scrollToEl.offsetTop - parent.offsetTop;
    }
  };

  handleVisibilityChange = (e?: any) => {
    const doc = document || (e && e.target);

    if (isWindowHidden(doc)) {
      return;
    }

    const {messages = []} = this.state;
    const shouldMarkSeen = messages.some((msg) => this.shouldMarkAsSeen(msg));

    if (shouldMarkSeen) {
      this.markMessagesAsSeen();
    }
  };

  handleInhotelPlan = (payload: any = {}) => {
    this.logger.debug('Handling subscription plan:', payload);

    const {settings = {} as WidgetSettings} = this.state;
    const plan = payload && payload.plan;
    const shouldHideBranding = settings && settings.is_branding_hidden;
    const isTeamPlan = plan && String(plan).toLowerCase() === 'team';
    const shouldDisplayBranding = !(isTeamPlan && shouldHideBranding);

    this.setState({shouldDisplayBranding});
  };

  handleToggleDisplay = (payload: any = {}) => {
    const isOpen = !!payload.isOpen;

    this.setState({isOpen, isTransitioning: false}, () => {
      this.handleVisibilityChange();

      if (isOpen) {
        this.scrollIntoView();
      }
    });
  };

  getDefaultGreeting = (overrides = {}): Array<Message> => {
    const {greeting, awayMessage} = this.props;

    if (!greeting && !awayMessage) {
      return [];
    }

    const {settings, availableAgents = []} = this.state;
    const hasAvailableAgents = availableAgents.length > 0;
    const hasAwayMessage = awayMessage && awayMessage.length > 0;
    const isOutsideWorkingHours = settings.account?.is_outside_working_hours;
    const shouldDisplayAwayMessage =
      hasAwayMessage && isOutsideWorkingHours && !hasAvailableAgents;
    const body = shouldDisplayAwayMessage ? awayMessage : greeting;
    const hasValidMessage = body && body.trim().length > 0;

    if (!hasValidMessage) {
      return [];
    }

    return [
      {
        type: 'bot',
        customer_id: 'bot',
        body: shouldDisplayAwayMessage ? awayMessage : greeting,
        created_at: new Date().toISOString(), // TODO: what should this be?
        ...overrides,
      },
    ];
  };

  emitUnseenMessage = (message: Message) => {
    this.emit('messages:unseen', {message});
  };

  emitOpenWindow = (e: any) => {
    this.emit('inhotel:open', {});
    // This is the state where we are waiting for parent window to reply,
    // letting us know when the transition from closed to open is over
    this.setState({isTransitioning: true});
  };

  emitCloseWindow = (e: any) => {
    this.setState({statusMessageCF: null});
    this.emit('inhotel:close', {});
  };

  handleNewMessage = (message: Message) => {
    if (isAgentMessage(message)) {
      this.emit('message:received', message);
    } else {
      this.emit('message:sent', message);
    }

    if (this.shouldMarkAsSeen(message)) {
      this.markMessagesAsSeen();
    } else if (isAgentMessage(message)) {
      this.emitUnseenMessage(message);
      this.playNotificationSound();
    }
  };

  shouldMarkAsSeen = (message: Message) => {
    const {isOpen} = this.state;
    const {seen_at: seenAt} = message;

    // If already seen or the page is not visible, don't mark as seen
    if (seenAt || isWindowHidden(document)) {
      return false;
    }

    return isAgentMessage(message) && isOpen;
  };

  markMessagesAsSeen = () => {
    const {customerId, conversationId} = this.state;

    this.logger.debug('Marking messages as seen!');
    this.emit('messages:seen', {});

    // A2A mode - no remote marking needed, just emit event
  };

  handleSendMessage = async (message: Partial<Message>, email?: string) => {
    if (this.state.isSending || this.messageRequest) {
      return;
    }

    const {body = ''} = message;
    const {inboxId, baseUrl} = this.props;
    if (!isValidAssistantProfileId(inboxId)) {
      this.logger.error(
        'Refusing to send with an invalid assistant profile ID'
      );
      return;
    }
    const {messages, conversationId} = this.state;

    if (shouldActivateGameMode(body)) {
      this.setState({isGameMode: true});
      return;
    }

    // A2A mode - send via streaming API
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      body: body,
      customer_id: 'customer',
      user_id: null,
      created_at: new Date().toISOString(),
      type: 'customer',
    };

    const updatedMessages = [...messages, userMessage];
    this.setState(
      {
        messages: updatedMessages,
        isSending: true,
        isSummarizeGenerated: false,
        shouldShowMessageLoading: true,
      },
      () => this.scrollIntoView()
    );

    // Convert to A2A history format
    const a2aHistory = messages.map((m) => ({
      role: (m.customer_id ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.body || '',
      timestamp: m.created_at || new Date().toISOString(),
    }));

    // Build A2A endpoint URL using subdomain pattern
    const a2aUrl = agentEndpoint(inboxId);

    // Get existing contextId for session continuity
    const existingContextId = inboxId ? getContextId(inboxId) : null;

    const controller = new AbortController();
    this.messageRequest = controller;
    try {
      await streamMessage(
        a2aUrl,
        {
          message: body,
          assistant_id: inboxId || '',
          session_id: conversationId || undefined,
          context_id: existingContextId || undefined, // Include contextId for session continuity
          history: a2aHistory,
        },
        // The message bubble renders the completed response.
        () => {},
        // onComplete
        (finalText, contextId) => {
          if (controller.signal.aborted) return;
          // Store contextId for future messages
          if (contextId && inboxId) {
            setContextId(inboxId, contextId);
          }

          const assistantMessage: Message = {
            id: `assistant-${Date.now()}`,
            body: finalText,
            customer_id: undefined,
            user_id: 1, // Agent user (number type)
            created_at: new Date().toISOString(),
            type: 'agent',
            user: {
              id: 1,
              email: 'assistant@inhotel.io',
              display_name: null,
              full_name: null,
              profile_photo_url: this.state.avatarURL,
            },
          };

          const newMessages = [...updatedMessages, assistantMessage];
          this.setState({
            messages: newMessages,
            isSending: false,
            shouldShowMessageLoading: false,
          });

          // Save to localStorage
          const storedMessages: StoredMessage[] = newMessages.map((m) => ({
            role: (m.customer_id ? 'user' : 'assistant') as
              | 'user'
              | 'assistant',
            type: m.type,
            content: m.body || '',
            timestamp: m.created_at || new Date().toISOString(),
          }));
          if (inboxId) {
            saveChatHistory(inboxId, storedMessages);
          }

          this.emit('message:received', assistantMessage);
          this.scrollIntoView();
        },
        // onError
        (error) => {
          if (controller.signal.aborted) return;
          console.error('Failed to send message:', error);
          this.setState({
            isSending: false,
            shouldShowMessageLoading: false,
          });
        },
        controller.signal
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('A2A message error:', error);
      this.setState({
        isSending: false,
        shouldShowMessageLoading: false,
      });
    } finally {
      this.messageRequest = null;
    }
  };

  // If this is true, we don't allow the customer to send any messages
  // until they enter an email address in the chat widget.
  askForEmailUpfront = () => {
    const {customer, shouldRequireEmail} = this.props;
    const {customerId, messages = []} = this.state;

    if (!shouldRequireEmail) {
      return false;
    }

    if (customer && customer.email) {
      return false;
    }

    // TODO: figure out what this actual logic should be...
    const previouslySentMessages = messages.find((msg) =>
      isCustomerMessage(msg, customerId)
    );

    return !previouslySentMessages;
  };

  playNotificationSound = async (volume = 0.2) => {
    try {
      const file = '/alert.mp3';
      const audio = new Audio(file);
      audio.volume = volume;

      await audio?.play();
    } catch (err) {
      this.logger.error('Failed to play notification sound:', err);
    }
  };

  handleGameLoaded = (e: any) => {
    if (e.currentTarget && e.currentTarget.focus) {
      e.currentTarget.focus();
    }
  };

  handleLeaveGameMode = () => {
    this.setState({isGameMode: false}, () => this.scrollIntoView());
  };

  isOnDeprecatedVersion = (): boolean => {
    const {version = '1.0.0'} = this.props;
    const [major, minor, patch] = version.split('.').map((n) => Number(n) || 0);

    return major <= 1 && minor <= 1 && patch <= 2;
  };

  handleSelectQuickReply = ({text, action}: QuickReply) => {
    this.handleSendMessage({
      body: text,
      metadata: {
        // TODO: what should this be called?
        reply_action: action,
      },
    });
  };

  getQuickReplies = (messages: Array<Message>): Array<QuickReply> => {
    if (!messages || messages.length === 0) {
      return [];
    }

    const message = messages[messages.length - 1];

    if (!isAgentMessage(message)) {
      return [];
    }

    const replies =
      message.quick_replies || message.metadata?.quick_replies || [];

    return replies.filter(
      (reply: any): reply is QuickReply => !!reply.text && !!reply.action
    );
  };

  getUnreadMessages = () => {
    const MAX_CHARS = 140;
    const {customerId, popUpInitialMessage, messages = []} = this.state;
    const [initialMessage] = messages;
    const hasOnlyBotMessage =
      messages.length === 1 &&
      initialMessage.type === 'bot' &&
      !initialMessage.seen_at;

    if (popUpInitialMessage && hasOnlyBotMessage) {
      return messages;
    }

    return messages
      .filter((msg) => {
        const {seen_at: seen, type: messageType} = msg;

        if (seen || messageType === 'bot') {
          return false;
        }

        // NB: `msg.type` doesn't come from the server, it's just a way to
        // help identify unsent messages in the frontend for now
        const isMe = isCustomerMessage(msg, customerId);

        return !isMe;
      })
      .slice(0, 2) // Only show the first 2 unread messages
      .map((msg) => {
        const {body} = msg;

        return {...msg, body: shorten(body, MAX_CHARS)};
      });
  };

  handleClickMailIcon = () => {
    this.setState((prevState) => ({
      isMailIconClicked: !prevState.isMailIconClicked,
    }));
    this.setState((prevState) => ({
      isContactFormSubmitted: false,
    }));
    this.setState({statusMessageCF: null});
  };
  handleSummarize = () => {
    const updateMessages = this.greetingText()
      ? this.state.messages.length - 1
      : this.state.messages.length;

    this.setState({numberOfMessages: updateMessages}, () => {
      if (
        Math.floor(this.state.numberOfMessages / 2) >= 5 &&
        !this.state.isSummarizeGenerated
      ) {
        this.setState({shouldSummarize: true});
        console.log('Call an API');
        console.log('Conversation ID: ', this.state.conversationId);
        fetch(
          'https://backend.inhotel.io/contact_form/summarize_chat_history/',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              conversation_id: this.state.conversationId,
              inbox_id: this.props.inboxId,
            }),
            mode: 'cors',
          }
        )
          .then((response) => {
            if (!response.ok) {
              throw new Error('Network response was not ok');
            }
            return response.json();
          })
          .then((data) => {
            // console.log('Success:', data);
            // this.setState({clickedSubmit: false});
            // console.log('Response data:', data.message); // This will log the actual data object
            if (data.status === -1) {
              console.log('Error');
              this.setState({shouldSummarize: false});
            } else {
              // console.log("message before summarize: ", this.state.message);
              this.setState({message: data.summarize_chat_message});
              this.setState({email: data.email});
              this.setState({firstName: data.first_name});
              this.setState({lastName: data.last_name});
              this.setState({isSummarizeGenerated: true});
              // console.log("message after summarize: ", this.state.message);
            }
            this.setState({
              shouldSummarize: false,
            });
          })
          .catch((error) => {
            console.error('Error:', error);
            this.setState({
              shouldSummarize: false,
            });
          });
        // setTimeout(() => {
        //   this.setState({ shouldSummarize: false });
        //   console.log('State updated');
        // }, 3000);
      }
    });
  };

  handleChangeCF = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const {name, value} = e.target;
    const updatedValue: unknown = {[name]: value};
    this.setState(updatedValue as Pick<State, keyof State>);
  };

  // handleSubmitCF = () => {
  //   const {firstName, lastName, email, message} = this.state;
  //   this.setState({
  //     isContactFormSubmitted: true,
  //   });
  //   console.log('Submitted!');

  // };
  handleSubmitCF = () => {
    this.setState({clickedSubmit: true});
    const contact = this.look().contact;
    const form = contact && contact.form;
    if (!form) return;
    // What the guest wrote in each field the form has. A field it does not
    // have is sent empty, and one it requires must be filled.
    const fields: Array<[FormFieldAppearance | null, string | null]> = [
      [form.firstName, this.state.firstName],
      [form.lastName, this.state.lastName],
      [form.email, this.state.email],
      [form.message, this.state.message],
    ];
    const [firstName, lastName, email, message] = fields.map(
      ([field, written]) => (field && written) || ''
    );
    if (
      fields.some(([field, written]) => field && field.isRequired && !written)
    ) {
      console.log('Missing value');
      return;
    }

    this.setState({
      isContactFormSubmitted: false,
      isLoading: true,
    });
    console.log('Submitting...');

    fetch('https://backend.inhotel.io/contact_form/send_email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firstname: firstName,
        lastname: lastName,
        email: email,
        message: message,
        inbox_id: this.props.inboxId,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then((data) => {
        console.log('Success:', data);
        this.setState({clickedSubmit: false});
        // Update the state to reflect the success and stop loading
        console.log('Response data:', data.message); // This will log the actual data object
        if (data.status === -1) {
          console.log('Error');
          this.setState({statusMessageCF: data.message});
          this.setState({
            isLoading: false,
          });
        } else {
          this.setState({
            isContactFormSubmitted: true,
            isLoading: false,
          });
          this.setState({statusMessageCF: null});
        }
        this.setState({
          isContactFormSubmitted: true,
          isLoading: false,
        });
        // Optionally, clear the form fields here if needed
      })
      .catch((error) => {
        console.error('Error:', error);
        // Update the state to stop loading and handle errors
        this.setState({
          isLoading: false,
        });
        // Show an error message here if needed
      });
  };

  render() {
    const {
      emailInputPlaceholder = 'Enter your email',
      agentAvailableText = "We're online right now!",
      agentUnavailableText = "We're away at the moment.",
      newMessagesNotificationText = 'View new messages',
      companyName,
      isMobile = false,
      isCloseable = true,
      showAgentAvailability = false,
      accountId,
      baseUrl,
    } = this.props;
    const {
      customerId,
      messages = [],
      availableAgents = [],
      isSending,
      isOpen,
      isTransitioning,
      isGameMode,
      shouldDisplayNotifications,
      shouldDisplayBranding,
    } = this.state;

    if (isGameMode) {
      return (
        <EmbeddedGame
          isMobile={isMobile}
          onLoadGame={this.handleGameLoaded}
          onLeaveGame={this.handleLeaveGameMode}
        />
      );
    }

    if (isTransitioning) {
      return null; // TODO: need to figure out the best way to handle this
    }

    if (!isOpen && shouldDisplayNotifications) {
      return (
        <UnreadMessages
          messages={this.getUnreadMessages()}
          newMessagesNotificationText={newMessagesNotificationText}
          isMobile={isMobile}
          onOpen={this.emitOpenWindow}
        />
      );
    }

    // FIXME: only return null for versions of the chat-widget after v1.1.0
    if (!isOpen && !this.isOnDeprecatedVersion()) {
      return null;
    }

    // Each block below is one component of the UI's library. The look lists
    // the blocks the chat has; one it leaves out is not drawn.
    const look = this.look();
    const shouldAskForEmail = this.askForEmailUpfront();
    const hasAvailableAgents = availableAgents.length > 0;
    const replies = this.getQuickReplies(messages);
    // A profile's contact form is sent to the assistant's e-mail. Without one
    // there is nowhere to send it, so it is not offered. For a chat drawn from
    // its settings the flag says so already: the service that gives it knows
    // whether there is an e-mail.
    const form = look.contact ? look.contact.form : null;
    const hasContactForm =
      !!form &&
      form.isOffered &&
      (look.source !== 'profile' || !!this.props.hotelEmail);
    const isFormOpen =
      this.state.isMailIconClicked &&
      (look.source === 'profile' ? hasContactForm : !!form);
    // A profile lists the branding or leaves it out, whether it is the
    // assistant's own or one the page gives itself. For a chat drawn from its
    // settings the subscription plan decides, as it always has.
    const hasBranding =
      !!look.branding && (look.source === 'profile' || shouldDisplayBranding);

    return (
      <Box
        id="widgetContainer"
        sx={{
          height: '100%',
          width: '100%',
        }}
      >
        <Flex
          className={isMobile ? 'Mobile' : ''}
          sx={{
            bg: isFormOpen ? 'rgb(239, 239, 239)' : 'background',
            flexDirection: 'column',
            height: '100%',
            width: '100%',
            // minWidth: '376px',
            flex: 1,
          }}
        >
          <ChatHeader
            header={look.header}
            canClose={isCloseable && !this.isOnDeprecatedVersion()}
            onClose={this.emitCloseWindow}
            showAgentAvailability={showAgentAvailability}
            hasAvailableAgents={hasAvailableAgents}
            agentAvailableText={agentAvailableText}
            agentUnavailableText={agentUnavailableText}
          />

          {!isFormOpen && (
            <ChatMessages
              messages={messages}
              isMine={(msg) => isCustomerMessage(msg, customerId)}
              companyName={companyName}
              isReplying={this.state.shouldShowMessageLoading}
              avatarURL={this.state.agentCardAvatarURL}
              isAvatarLoading={this.state.isAvatarLoading}
              replyingAvatarURL={this.state.avatarURL}
              replies={replies}
              onSelectReply={this.handleSelectQuickReply}
              scrollRef={(el) => (this.scrollToEl = el)}
              look={look.messages}
            />
          )}

          {isFormOpen && (
            <Box sx={{flex: 1, minHeight: 0, overflowY: 'auto'}} px={'20px'}>
              <ContactForm
                handleChange={this.handleChangeCF}
                handleSubmit={this.handleSubmitCF}
                firstName={this.state.firstName}
                lastName={this.state.lastName}
                email={this.state.email}
                message={this.state.message}
                clickedSubmit={this.state.clickedSubmit}
                shouldSummarize={this.state.shouldSummarize}
                primaryColor={this.props.primaryColor}
                form={form}
              />
            </Box>
          )}

          {!isFormOpen && look.composer && (
            <Box
              px={'20px'}
              sx={{
                bg: 'background',
                borderTop: '1px solid rgb(230, 230, 230)',
                // TODO: only show shadow on focus TextArea below
                boxShadow: 'rgba(0, 0, 0, 0.1) 0px 0px 100px 0px',
                marginTop: '2px',
              }}
              data-component="Composer"
            >
              {/*
              NB: we use a `key` prop here to force re-render on open so
              that the input will auto-focus appropriately
            */}
              <ChatFooter
                key={isOpen ? 1 : 0}
                accountId={accountId}
                baseUrl={baseUrl}
                placeholder={look.composer.placeholder}
                emailInputPlaceholder={emailInputPlaceholder}
                isSending={isSending}
                shouldRequireEmail={shouldAskForEmail}
                onSendMessage={this.handleSendMessage}
              />
            </Box>
          )}

          {look.contact && (
            <Box
              px={'20px'}
              sx={{
                bg: 'rgb(239, 239, 239)',
                marginTop: '2px',
              }}
              data-component="Contact"
            >
              <ChatFooterEmail
                onClickMailIcon={this.handleClickMailIcon}
                isMailIconClicked={isFormOpen}
                handleSubmitCF={this.handleSubmitCF}
                isSubmittedCF={this.state.isContactFormSubmitted}
                hotelEmail={look.contact.email || this.props.hotelEmail}
                hotelPhone={look.contact.phone || this.props.hotelPhone}
                shouldShowContactForm={hasContactForm}
                isLoading={this.state.isLoading}
                statusMessageCF={this.state.statusMessageCF}
                handleSummarize={this.handleSummarize}
                look={look.contact}
              />
            </Box>
          )}

          <Box
            sx={{
              bg: 'rgb(239, 239, 239)',
            }}
          >
            {hasBranding && <InhotelBranding {...look.branding} />}
          </Box>

          <img
            alt="InHotel"
            src="https://cdn.prod.website-files.com/657ae60d92ed823479730a3f/67fb02a683fe906731362325_inhotel-logo-green-400.svg"
            width="0"
            height="0"
          />
        </Flex>
      </Box>
    );
  }
}

export default ChatWindow;

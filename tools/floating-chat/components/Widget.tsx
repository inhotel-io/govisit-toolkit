import React from 'react';
import {ThemeProvider} from 'theme-ui';
import ChatWindow from './ChatWindow';
import {CustomerMetadata} from '../helpers/types';
import {loadAvatarConfig, setupPostMessageHandlers} from '../helpers/utils';
import getThemeConfig from '../helpers/theme';
import Logger from '../helpers/logger';
import {
  APPEARANCE_LOAD_TIMEOUT_MS,
  Appearance,
  AppearanceProfile,
  embedKeys,
  embedProfile,
  isAssistantId,
  resolveAppearance,
} from '../helpers/appearance';
import {fetchAppearanceProfile} from '../helpers/appearance-api';
import {isDev} from '../helpers/config';
import {
  AgentCard,
  CARD_LOAD_TIMEOUT_MS,
  inhotelCardUrl,
  isAgentCardUrl,
  readAgentCard,
  webAddress,
} from '../helpers/agent-card';
import {
  isRecord,
  isTrustedParentMessage,
  isValidAssistantProfileId,
  resolveParentOrigin,
} from '../helpers/embed-security';

type Config = {
  token?: string;
  inbox?: string;
  // TODO: deprecate
  accountId?: string;
  title?: string;
  subtitle?: string;
  primaryColor?: string;
  baseUrl?: string;
  greeting?: string;
  awayMessage?: string;
  customerId?: string;
  newMessagePlaceholder?: string;
  emailInputPlaceholder?: string;
  newMessagesNotificationText?: string;
  companyName?: string;
  agentAvailableText?: string;
  agentUnavailableText?: string;
  showAgentAvailability?: boolean;
  defaultIsOpen?: boolean;
  requireEmailUpfront?: boolean;
  disableAnalyticsTracking?: boolean;
  closeable?: boolean;
  debug?: boolean;
  mobile?: boolean;
  metadata?: string; // stringified CustomerMetadata JSON
  version?: string;
  ts?: string;
  parentOrigin?: string;
  position?: string;
  shouldShowContactForm?: string;
  hotelPhone?: string;
  hotelEmail?: string;
  assistantType?: string;
  // The page's language, for the texts of the appearance profile.
  locale?: string;
  // The code of the appearance profile the embed names, when it names one.
  appearanceProfile?: string;
  // Which of title, subtitle, greeting, newMessagePlaceholder and
  // primaryColor the page set in its own embed, comma-separated. Those stand
  // in front of the profile.
  embedKeys?: string;
  // Set when the page gives a whole profile in its own embed. The launcher
  // sends that profile by message, and the assistant's is not read.
  appearanceInline?: string;
  // Any agent that is not inHotel's: the address of its agent card. An
  // inHotel `inbox` stands in front of it.
  agentCard?: string;
  // Set when the page takes the contact form itself, with
  // `onContactFormSubmit`.
  contactHandler?: string;
};

const parseCustomerMetadata = (str: string): CustomerMetadata => {
  try {
    return JSON.parse(str);
  } catch (err) {
    return {} as CustomerMetadata;
  }
};

const sanitizeConfigPayload = (payload: any): Config => {
  if (
    !isRecord(payload) ||
    ('inbox' in payload && !isValidAssistantProfileId(payload.inbox)) ||
    ('agentCard' in payload && !isAgentCardUrl(payload.agentCard))
  ) {
    return {};
  }

  const valid = [
    'token',
    'inbox',
    'accountId',
    'title',
    'subtitle',
    'primaryColor',
    'baseUrl',
    'greeting',
    'awayMessage',
    'companyName',
    'requireEmailUpfront',
    'newMessagePlaceholder',
    'emailInputPlaceholder',
    'newMessagesNotificationText',
    'agentAvailableText',
    'agentUnavailableText',
    'showAgentAvailability',
    'disableAnalyticsTracking',
    'closeable',
    'debug',
    'version',
    'position',
    'shouldShowContactForm',
    'hotelPhone',
    'hotelEmail',
    'assistantType',
    'locale',
    'appearanceProfile',
    'embedKeys',
    'agentCard',
    'contactHandler',
  ];

  return valid.reduce((acc, key) => {
    if (typeof payload[key] !== 'undefined') {
      return {...acc, [key]: payload[key]};
    } else {
      return acc;
    }
  }, {} as Config);
};

type Props = {config: Config};
type State = {
  config: Config;
  assistantRemount: boolean;
  // The appearance profile of the assistant in `config.inbox`, once read.
  profile: AppearanceProfile | null;
  // The profile the page gives in its own embed, as the launcher sent it. It
  // is the page's, so it stands in front of the assistant's, whichever
  // assistant the page shows.
  embed: unknown;
  // Whether the assistant's profile is being read right now.
  isReadingProfile: boolean;
  // The card of the agent the chat talks to, and the address it was read
  // from: a card that did not answer is null, read all the same.
  card: AgentCard | null;
  cardFor: string | null;
  isReadingCard: boolean;
};

class Wrapper extends React.Component<Props, State> {
  logger: Logger;
  unsubscribe: () => void;
  parentOrigin: string | null;
  appearanceRequest: AbortController | null = null;
  appearanceTimeout: ReturnType<typeof setTimeout> | null = null;
  cardRequest: AbortController | null = null;
  cardTimeout: ReturnType<typeof setTimeout> | null = null;
  // The address of the card being read.
  readingCard: string | null = null;

  constructor(props: Props) {
    super(props);

    this.parentOrigin = resolveParentOrigin(
      props.config.parentOrigin,
      typeof document === 'undefined' ? '' : document.referrer
    );
    this.state = {
      config: props.config,
      assistantRemount: false,
      profile: null,
      embed: null,
      isReadingProfile: false,
      card: null,
      cardFor: null,
      isReadingCard: false,
    };
  }

  componentDidMount() {
    const debugModeEnabled = !!Number(this.props.config.debug);

    this.logger = new Logger(debugModeEnabled);
    this.unsubscribe = setupPostMessageHandlers(
      window,
      this.postMessageHandlers
    );
    this.loadAppearance();
    this.loadCard();
  }

  componentDidUpdate(_: Props, previous: State) {
    const {inbox, appearanceProfile, locale} = this.state.config;
    const before = previous.config;

    if (
      before.inbox !== inbox ||
      before.appearanceProfile !== appearanceProfile ||
      before.locale !== locale
    ) {
      this.loadAppearance();
    }
    this.loadCard();
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
    this.cancelAppearance();
    this.cancelCard();
  }

  // Whether the chat talks to any agent by its card, rather than to an
  // inHotel assistant by its ID. It does so inside a page that frames it, or
  // on this computer: opened by itself on the hosted service, the address in
  // the browser would stand for an agent that is not the service's.
  isCardMode = (): boolean => {
    const {inbox, agentCard} = this.state.config;
    return (
      !isValidAssistantProfileId(inbox) &&
      isAgentCardUrl(agentCard) &&
      typeof window !== 'undefined' &&
      (window.parent !== window || isDev(window))
    );
  };

  // The card the chat needs: a card's chat always needs its own; an inHotel
  // chat needs its card only for the questions its look offers.
  cardAddress = (look: Appearance | null): string | null => {
    const {inbox, agentCard} = this.state.config;
    if (isValidAssistantProfileId(inbox))
      return look && look.suggestions ? inhotelCardUrl(inbox) : null;
    return this.isCardMode() ? webAddress(agentCard) : null;
  };

  cancelCard = () => {
    if (this.cardRequest) this.cardRequest.abort();
    if (this.cardTimeout) clearTimeout(this.cardTimeout);
    this.cardRequest = null;
    this.cardTimeout = null;
    this.readingCard = null;
  };

  // Read the card the chat needs, once. The chat waits for it a few seconds
  // at most, and takes it whenever it answers.
  loadCard = () => {
    const address = this.cardAddress(this.resolveLook().appearance);
    if (
      !address ||
      address === this.state.cardFor ||
      address === this.readingCard
    )
      return;
    this.cancelCard();
    const controller = new AbortController();
    this.cardRequest = controller;
    this.readingCard = address;
    this.cardTimeout = setTimeout(() => {
      if (this.cardRequest !== controller) return;
      // The chat stops waiting and is drawn without the card. The read goes
      // on: a card that answers later is still taken.
      this.cardTimeout = null;
      this.setState({isReadingCard: false});
    }, CARD_LOAD_TIMEOUT_MS);
    this.setState({isReadingCard: true});
    readAgentCard(address, controller.signal).then((card) => {
      if (this.cardRequest !== controller || controller.signal.aborted) return;
      this.cancelCard();
      this.setState({card, cardFor: address, isReadingCard: false});
    });
  };

  cancelAppearance = () => {
    if (this.appearanceRequest) this.appearanceRequest.abort();
    if (this.appearanceTimeout) clearTimeout(this.appearanceTimeout);
    this.appearanceRequest = null;
    this.appearanceTimeout = null;
  };

  // Read the assistant's appearance profile for this UI. Until it answers the
  // chat is drawn from its settings, and it stays so when the assistant has no
  // profile or the read does not answer in time. A page with a profile of its
  // own needs no read.
  loadAppearance = () => {
    this.cancelAppearance();
    const {inbox, appearanceProfile, locale} = this.state.config;
    const hasOwnProfile =
      !!Number(this.state.config.appearanceInline) ||
      !!embedProfile(this.state.embed, locale);
    if (!isAssistantId(inbox) || hasOwnProfile) {
      if (this.state.isReadingProfile) this.setState({isReadingProfile: false});
      return;
    }

    const controller = new AbortController();
    this.appearanceRequest = controller;
    this.appearanceTimeout = setTimeout(() => {
      controller.abort();
      // The read ran out of time: the chat keeps the look it has.
      if (this.appearanceRequest === controller)
        this.setState({isReadingProfile: false});
    }, APPEARANCE_LOAD_TIMEOUT_MS);
    this.setState({isReadingProfile: true});
    fetchAppearanceProfile({
      assistantId: inbox,
      code: appearanceProfile,
      locale,
      signal: controller.signal,
    }).then((profile) => {
      // An answer for an assistant the chat has left is not this one's.
      if (this.appearanceRequest !== controller || controller.signal.aborted)
        return;
      this.cancelAppearance();
      this.setState({profile, isReadingProfile: false});
    });
  };

  postMessageHandlers = (msg: any) => {
    if (!isTrustedParentMessage(msg, this.parentOrigin, window)) return;
    this.logger.debug('Handling in wrapper:', msg.data);
    const {event, payload = {}} = msg.data;

    switch (event) {
      case 'config:update':
        return this.handleConfigUpdate(payload);
      default:
        return null;
    }
  };

  handleConfigUpdate = (payload: any) => {
    const updates = sanitizeConfigPayload(payload);
    // The page's own profile comes as it was given. It is checked when it is
    // read, like one from the network.
    const hasEmbed = isRecord(payload) && 'appearance' in payload;
    // With a profile of the page's own, the assistant's is not waited for any
    // longer. What is no profile leaves that read to go on.
    const isOwnProfile =
      hasEmbed &&
      !!embedProfile(
        payload.appearance,
        {...this.state.config, ...updates}.locale
      );
    this.logger.debug('Updating widget config:', updates);

    if (isOwnProfile) this.cancelAppearance();
    const config = this.state.config;
    const next = {...config, ...updates};
    const isAnotherAssistant =
      config.inbox !== next.inbox || config.agentCard !== next.agentCard;
    if (isAnotherAssistant) this.cancelCard();
    this.setState((state) => ({
      config: {...state.config, ...updates},
      assistantRemount: state.assistantRemount || isAnotherAssistant,
      // One assistant is never drawn in the look of another, nor sent its
      // messages.
      profile: isAnotherAssistant ? null : state.profile,
      card: isAnotherAssistant ? null : state.card,
      cardFor: isAnotherAssistant ? null : state.cardFor,
      isReadingCard: isAnotherAssistant ? false : state.isReadingCard,
      embed: hasEmbed ? payload.appearance : state.embed,
      isReadingProfile: isOwnProfile ? false : state.isReadingProfile,
    }));
  };

  // What the chat looks like, and the card it is drawn with: the profile the
  // page gives itself, else the agent's own (an inHotel assistant's profile,
  // or the look a card publishes), and otherwise the settings, as it has
  // always been drawn. A card's chat without a profile takes its name, its
  // description and its questions from the card.
  resolveLook = (): {appearance: Appearance; card: AgentCard | null} => {
    const {config} = this.state;
    const isCardMode = this.isCardMode();
    const address = isCardMode
      ? webAddress(config.agentCard)
      : isValidAssistantProfileId(config.inbox)
      ? inhotelCardUrl(config.inbox)
      : null;
    const card =
      this.state.card && this.state.cardFor === address
        ? this.state.card
        : null;
    const profile =
      embedProfile(this.state.embed, config.locale) ||
      (isCardMode
        ? embedProfile(card && card.appearance, config.locale)
        : this.state.profile);
    const appearance = resolveAppearance(
      profile,
      {
        title: isCardMode ? config.title || undefined : config.title,
        subtitle: isCardMode ? config.subtitle || undefined : config.subtitle,
        agentName: (isCardMode && card && card.name) || undefined,
        agentDescription: (isCardMode && card && card.description) || undefined,
        greeting: config.greeting,
        newMessagePlaceholder: config.newMessagePlaceholder,
        primaryColor: config.primaryColor,
        // A card's chat offers its form when the page takes it; an inHotel
        // chat drawn from its settings when they say so.
        shouldShowContactForm: isCardMode
          ? !!Number(config.contactHandler)
          : String(config.shouldShowContactForm) === 'true',
        suggestions: isCardMode,
      },
      embedKeys(config.embedKeys)
    );
    return {appearance, card};
  };

  render() {
    const {config = {}} = this.state;

    const isCardMode = this.isCardMode();
    if (
      Object.keys(config).length === 0 ||
      !(isValidAssistantProfileId(config.inbox) || isCardMode)
    ) {
      return null;
    }

    const {
      token,
      inbox,
      accountId,
      customerId,
      awayMessage,
      companyName,
      agentAvailableText,
      agentUnavailableText,
      emailInputPlaceholder = 'Enter your email',
      newMessagesNotificationText = 'View new messages',
      baseUrl = 'https://backend.inhotel.io',
      requireEmailUpfront = '0',
      showAgentAvailability = '0',
      disableAnalyticsTracking = '0',
      closeable = '1',
      debug = '0',
      mobile = '0',
      metadata = '{}',
      version = '1.0.0',
      ts,
      position = 'left',
      hotelPhone,
      hotelEmail,
      assistantType,
    } = config;

    const {appearance, card} = this.resolveLook();
    const theme = getThemeConfig({primary: appearance.accentColor});
    const primaryColor = theme.colors.primary;
    const customer = parseCustomerMetadata(metadata);
    document.documentElement.style.setProperty('--primary-color', primaryColor);
    const avatarURL = loadAvatarConfig(assistantType || 'default');
    return (
      <ThemeProvider theme={theme}>
        <ChatWindow
          key={isCardMode ? `card:${webAddress(config.agentCard)}` : inbox}
          assistantRemount={this.state.assistantRemount}
          parentOrigin={this.parentOrigin}
          accountId={token || accountId}
          inboxId={isCardMode ? undefined : inbox}
          agent={
            isCardMode
              ? {
                  cardUrl: webAddress(config.agentCard),
                  endpoint: card ? card.endpoint : null,
                  streaming: !!(card && card.streaming),
                  iconUrl: card ? card.iconUrl : null,
                  isReading: this.state.isReadingCard,
                }
              : undefined
          }
          hasContactHandler={isCardMode && !!Number(config.contactHandler)}
          suggestions={
            appearance.suggestions && card
              ? card.examples.slice(0, appearance.suggestions.limit)
              : []
          }
          customerId={customerId}
          appearance={appearance}
          isAppearancePending={
            isCardMode ? this.state.isReadingCard : this.state.isReadingProfile
          }
          awayMessage={awayMessage}
          companyName={companyName}
          emailInputPlaceholder={emailInputPlaceholder}
          newMessagesNotificationText={newMessagesNotificationText}
          agentAvailableText={agentAvailableText}
          agentUnavailableText={agentUnavailableText}
          showAgentAvailability={!!Number(showAgentAvailability)}
          shouldRequireEmail={!!Number(requireEmailUpfront)}
          isMobile={!!Number(mobile)}
          isCloseable={!!Number(closeable)}
          debug={!!Number(debug)}
          disableAnalyticsTracking={!!Number(disableAnalyticsTracking)}
          baseUrl={baseUrl}
          customer={customer}
          version={version}
          ts={ts}
          primaryColor={primaryColor}
          position={position}
          hotelPhone={hotelPhone}
          hotelEmail={hotelEmail}
          avatarURL={avatarURL}
        />
      </ThemeProvider>
    );
  }
}

export default Wrapper;

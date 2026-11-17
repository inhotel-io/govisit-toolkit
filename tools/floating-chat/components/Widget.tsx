import React from 'react';
import {ThemeProvider} from 'theme-ui';
import ChatWindow from './ChatWindow';
import {CustomerMetadata} from '../helpers/types';
import {loadAvatarConfig, setupPostMessageHandlers} from '../helpers/utils';
import getThemeConfig from '../helpers/theme';
import Logger from '../helpers/logger';
import {
  APPEARANCE_LOAD_TIMEOUT_MS,
  AppearanceProfile,
  embedKeys,
  embedProfile,
  isAssistantId,
  resolveAppearance,
} from '../helpers/appearance';
import {fetchAppearanceProfile} from '../helpers/appearance-api';
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
    ('inbox' in payload && !isValidAssistantProfileId(payload.inbox))
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
};

class Wrapper extends React.Component<Props, State> {
  logger: Logger;
  unsubscribe: () => void;
  parentOrigin: string | null;
  appearanceRequest: AbortController | null = null;
  appearanceTimeout: ReturnType<typeof setTimeout> | null = null;

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
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
    this.cancelAppearance();
  }

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
    this.setState(
      ({config, assistantRemount, profile, embed, isReadingProfile}) => {
        const nextConfig = {...config, ...updates};
        const isAnotherAssistant = config.inbox !== nextConfig.inbox;
        return {
          config: nextConfig,
          assistantRemount: assistantRemount || isAnotherAssistant,
          // One assistant is never drawn in the look of another.
          profile: isAnotherAssistant ? null : profile,
          embed: hasEmbed ? payload.appearance : embed,
          isReadingProfile: isOwnProfile ? false : isReadingProfile,
        };
      }
    );
  };

  render() {
    const {config = {}} = this.state;

    if (
      Object.keys(config).length === 0 ||
      !isValidAssistantProfileId(config.inbox)
    ) {
      return null;
    }

    const {
      token,
      inbox,
      accountId,
      customerId,
      greeting,
      awayMessage,
      companyName,
      agentAvailableText,
      agentUnavailableText,
      title,
      subtitle,
      newMessagePlaceholder,
      emailInputPlaceholder = 'Enter your email',
      newMessagesNotificationText = 'View new messages',
      primaryColor: configuredPrimaryColor,
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
      shouldShowContactForm = false,
      hotelPhone,
      hotelEmail,
      assistantType,
    } = config;

    let shouldShowCF: boolean = false;
    if (shouldShowContactForm === 'true') {
      shouldShowCF = true;
    } else {
      shouldShowCF = false;
    }
    // What the chat looks like: the profile the page gives itself, else the
    // assistant's appearance profile when it has one, and otherwise the
    // settings above, as it has always been drawn.
    const ownProfile = embedProfile(this.state.embed, config.locale);
    const appearance = resolveAppearance(
      ownProfile || this.state.profile,
      {
        title,
        subtitle,
        greeting,
        newMessagePlaceholder,
        primaryColor: configuredPrimaryColor,
        shouldShowContactForm: shouldShowCF,
      },
      embedKeys(config.embedKeys),
      !!ownProfile
    );
    const theme = getThemeConfig({primary: appearance.accentColor});
    const primaryColor = theme.colors.primary;
    const customer = parseCustomerMetadata(metadata);
    document.documentElement.style.setProperty('--primary-color', primaryColor);
    const avatarURL = loadAvatarConfig(assistantType || 'default');
    return (
      <ThemeProvider theme={theme}>
        <ChatWindow
          key={inbox}
          assistantRemount={this.state.assistantRemount}
          parentOrigin={this.parentOrigin}
          accountId={token || accountId}
          inboxId={inbox}
          customerId={customerId}
          appearance={appearance}
          isAppearancePending={this.state.isReadingProfile}
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

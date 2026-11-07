import React from 'react';
import {ThemeProvider} from 'theme-ui';
import ChatWindow from './ChatWindow';
import {CustomerMetadata} from '../helpers/types';
import {loadAvatarConfig, setupPostMessageHandlers} from '../helpers/utils';
import getThemeConfig from '../helpers/theme';
import Logger from '../helpers/logger';
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
type State = {config: Config; assistantRemount: boolean};

class Wrapper extends React.Component<Props, State> {
  logger: Logger;
  unsubscribe: () => void;
  parentOrigin: string | null;

  constructor(props: Props) {
    super(props);

    this.parentOrigin = resolveParentOrigin(
      props.config.parentOrigin,
      typeof document === 'undefined' ? '' : document.referrer
    );
    this.state = {
      config: props.config,
      assistantRemount: false,
    };
  }

  componentDidMount() {
    const debugModeEnabled = !!Number(this.props.config.debug);

    this.logger = new Logger(debugModeEnabled);
    this.unsubscribe = setupPostMessageHandlers(
      window,
      this.postMessageHandlers
    );
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

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
    this.logger.debug('Updating widget config:', updates);

    this.setState(({config, assistantRemount}) => {
      const nextConfig = {...config, ...updates};
      return {
        config: nextConfig,
        assistantRemount: assistantRemount || config.inbox !== nextConfig.inbox,
      };
    });
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
      title = 'Welcome!',
      subtitle = 'How can we help you?',
      newMessagePlaceholder = 'Start typing...',
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

    const theme = getThemeConfig({primary: configuredPrimaryColor});
    const primaryColor = theme.colors.primary;
    const customer = parseCustomerMetadata(metadata);
    document.documentElement.style.setProperty('--primary-color', primaryColor);
    let shouldShowCF: boolean = false;
    if (shouldShowContactForm === 'true') {
      shouldShowCF = true;
    } else {
      shouldShowCF = false;
    }
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
          title={title}
          subtitle={subtitle}
          greeting={greeting}
          awayMessage={awayMessage}
          companyName={companyName}
          newMessagePlaceholder={newMessagePlaceholder}
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
          shouldShowContactForm={shouldShowCF}
          hotelPhone={hotelPhone}
          hotelEmail={hotelEmail}
          avatarURL={avatarURL}
        />
      </ThemeProvider>
    );
  }
}

export default Wrapper;

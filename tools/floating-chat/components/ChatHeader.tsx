import React from 'react';
import {Box, Heading, Text} from 'theme-ui';
import AgentAvailability from './AgentAvailability';
import CloseIcon from './CloseIcon';

type Props = {
  // What the look gives the header, or null when it has none.
  header: {title: string; subtitle: string} | null;
  canClose: boolean;
  isMobile: boolean;
  onClose: (e: any) => void;
  showAgentAvailability: boolean;
  hasAvailableAgents: boolean;
  agentAvailableText: string;
  agentUnavailableText: string;
};

// The bar at the top of the chat: `Header` in the UI's library.
const ChatHeader = ({
  header,
  canClose,
  isMobile,
  onClose,
  showAgentAvailability,
  hasAvailableAgents,
  agentAvailableText,
  agentUnavailableText,
}: Props) => {
  const close = canClose ? (
    // TODO: wrap in a button element
    <CloseIcon className="CloseIcon" width={24} height={24} onClick={onClose} />
  ) : null;

  if (!header) {
    // On a phone the chat fills the screen, so the control that closes it
    // stays even when the look leaves the header out.
    return isMobile && close ? (
      <Box sx={{bg: 'primary', position: 'relative', height: 40}}>{close}</Box>
    ) : null;
  }

  return (
    <Box sx={{bg: 'primary', position: 'relative'}} data-component="Header">
      <Box pt={3} pb={showAgentAvailability ? 12 : 16} px={20}>
        {close}
        <Heading
          as="h2"
          className="Inhotel-heading"
          sx={{color: 'background', my: 1, mr: 12}}
        >
          {header.title}
        </Heading>
        <Text sx={{color: 'offset'}}>{header.subtitle}</Text>
      </Box>

      {showAgentAvailability && (
        <AgentAvailability
          hasAvailableAgents={hasAvailableAgents}
          agentAvailableText={agentAvailableText}
          agentUnavailableText={agentUnavailableText}
        />
      )}
    </Box>
  );
};

export default ChatHeader;

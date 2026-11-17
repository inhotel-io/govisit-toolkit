import React from 'react';
import {Box, Button, Flex, Input} from 'theme-ui';
import ResizableTextArea from './ResizableTextArea';
import SendIcon from './SendIcon';
import {Message} from '../helpers/types';

const ChatFooter = ({
  placeholder,
  emailInputPlaceholder,
  isSending,
  shouldRequireEmail,
  onSendMessage,
}: {
  placeholder?: string;
  emailInputPlaceholder?: string;
  isSending: boolean;
  shouldRequireEmail?: boolean;
  onSendMessage: (message: Partial<Message>, email?: string) => Promise<void>;
}) => {
  const [message, setMessage] = React.useState('');
  const [email, setEmail] = React.useState('');
  const messageInput = React.useRef(null);

  const hasValidEmail = email && email.length > 5 && email.indexOf('@') !== -1;
  const isComposerDisabled =
    isSending || (shouldRequireEmail && !hasValidEmail);
  const canSend = !isComposerDisabled && message.trim().length > 0;

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    setMessage(e.target.value);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setEmail(e.target.value);

  const handleSetEmail = (e?: React.FormEvent<HTMLFormElement>) => {
    e && e.preventDefault();

    if (messageInput.current) {
      messageInput.current.focus();
    }
  };

  const handleSendMessage = (e?: React.FormEvent<HTMLFormElement>) => {
    e && e.preventDefault();
    if (!canSend) return;
    onSendMessage({body: message}, email);
    setMessage('');
    setEmail('');
  };

  const handleKeyDown = (e: any) => {
    const {key, shiftKey} = e;

    if (!shiftKey && key === 'Enter') {
      handleSendMessage(e);
    }
  };

  return (
    <Box>
      <form onSubmit={handleSetEmail}>
        {shouldRequireEmail && (
          <Box py={1}>
            <Input
              sx={{variant: 'styles.input.transparent'}}
              placeholder={emailInputPlaceholder}
              value={email}
              onChange={handleEmailChange}
            />
          </Box>
        )}
      </form>

      <form onSubmit={handleSendMessage}>
        <Flex sx={{alignItems: 'center'}} py={2}>
          <Box mr={2} sx={{flex: 1}}>
            <ResizableTextArea
              sx={{
                fontFamily: 'body',
                color: 'black',
                variant: 'styles.input.transparent',
              }}
              ref={messageInput}
              className="TextArea--transparent"
              placeholder={placeholder}
              minRows={1}
              maxRows={4}
              autoFocus
              value={message}
              disabled={isComposerDisabled}
              onKeyDown={handleKeyDown}
              onChange={handleMessageChange}
            />
          </Box>

          <Flex>
            <Button
              variant="primary"
              type="submit"
              disabled={!canSend}
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: '50%',
                height: '36px',
                width: '36px',
                padding: 0,
                '&:disabled, &:disabled:hover, &:disabled:active': {
                  bg: '#ebebeb',
                  cursor: 'default',
                },
              }}
            >
              <SendIcon width={16} height={16} fill="#fff" />
            </Button>
          </Flex>
        </Flex>
      </form>
    </Box>
  );
};

export default ChatFooter;

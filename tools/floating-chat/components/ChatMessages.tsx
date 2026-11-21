import React from 'react';
import {Box} from 'theme-ui';
import {motion} from 'framer-motion';
import {PulseLoader} from 'react-spinners';
import ChatMessage from './ChatMessage';
import QuickReplies from './QuickReplies';
import {Message, QuickReply} from '../helpers/types';
import {MessagesAppearance} from '../helpers/appearance';

type Props = {
  messages: Array<Message>;
  isMine: (message: Message) => boolean;
  companyName?: string;
  // The assistant is writing its reply.
  isReplying: boolean;
  avatarURL?: string | null;
  isAvatarLoading: boolean;
  // The picture of the row that shows the assistant writing.
  replyingAvatarURL?: string;
  replies: Array<QuickReply>;
  // Whether the replies are the card's questions, offered before the guest
  // writes: `Suggestions` in the UI's library.
  isSuggestions?: boolean;
  onSelectReply: (reply: QuickReply) => void;
  scrollRef: (el: HTMLDivElement | null) => void;
  // The `Messages` values of the UI's library.
  look: MessagesAppearance;
};

// The list of messages. The chat always has one, so the library holds no block
// for it, only the values in `look`.
const ChatMessages = ({
  messages,
  isMine,
  companyName,
  isReplying,
  avatarURL,
  isAvatarLoading,
  replyingAvatarURL,
  replies,
  isSuggestions,
  onSelectReply,
  scrollRef,
  look,
}: Props) => {
  const bubbles = {
    assistantBubbleColor: look.assistantBubbleColor,
    guestBubbleColor: look.guestBubbleColor,
    hasAvatar: look.hasAvatars,
    hasFeedback: look.hasFeedback,
  };

  return (
    <Box
      p={3}
      px={'20px'}
      sx={{
        flex: 1,
        boxShadow: 'rgba(0, 0, 0, 0.2) 0px 21px 4px -20px inset',
        overflowY: 'scroll',
      }}
      data-component="Messages"
    >
      {messages.map((msg, key) => {
        const next = messages[key + 1];
        const isLastInGroup = next
          ? msg.customer_id !== next.customer_id
          : true;
        const isLastMessage = key === messages.length - 1;
        const isMe = isMine(msg);
        const isReplyingHere = isLastMessage && isReplying;
        const userBot = {
          archived_at: null,
          created_at: '2024-03-11T07:13:39',
          disabled_at: null,
          display_name: null,
          email: 'testhotel@inhotel.io',
          full_name: null,
          id: 117,
          object: 'user',
          profile_photo_url: replyingAvatarURL,
          role: 'admin',
        };
        const loader = isReplyingHere ? (
          <Box
            sx={{
              backgroundColor: 'rgba(200, 200, 200, 0.2)',
              padding: '6px 10px',
              borderRadius: '10px',
            }}
          >
            <PulseLoader
              color="rgba(200, 200, 200, 1.0)"
              size="7px"
              speedMultiplier={0.4}
            />
          </Box>
        ) : null;

        return (
          <React.Fragment key={key}>
            <motion.div
              initial={{opacity: 0, x: isMe ? 2 : -2}}
              animate={{opacity: 1, x: 0}}
              transition={{duration: 0.2, ease: 'easeIn'}}
            >
              <ChatMessage
                message={msg}
                isMe={isMe}
                companyName={companyName}
                isLastInGroup={isLastInGroup}
                shouldDisplayTimestamp={isLastMessage && look.hasTimestamps}
                shouldShowLoader={false}
                avatarURL={avatarURL}
                isAvatarLoading={isAvatarLoading}
                {...bubbles}
              />
            </motion.div>
            {isReplyingHere && (
              <motion.div
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                transition={{duration: 0.2}}
              >
                <ChatMessage
                  message={{body: '', user: userBot}}
                  loader={loader}
                  shouldShowLoader={true}
                  avatarURL={avatarURL}
                  isAvatarLoading={isAvatarLoading}
                  {...bubbles}
                />
              </motion.div>
            )}
          </React.Fragment>
        );
      })}

      {replies && replies.length > 0 ? (
        <QuickReplies
          replies={replies}
          onSelect={onSelectReply}
          component={isSuggestions ? 'Suggestions' : undefined}
          guestBubbleColor={look.guestBubbleColor}
        />
      ) : null}

      <div ref={scrollRef} />
    </Box>
  );
};

export default ChatMessages;

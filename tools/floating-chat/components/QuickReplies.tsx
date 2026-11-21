import React from 'react';
import {Box, Flex} from 'theme-ui';
import {motion} from 'framer-motion';
import {bubbleShape} from './ChatMessageBody';
import {QuickReply} from '../helpers/types';
import {guestBubbleColors} from '../helpers/theme';

type Props = {
  replies: Array<QuickReply>;
  onSelect: (reply: QuickReply) => void;
  // The component of the UI's library the replies are, when they are one.
  component?: string;
  // The colour the look gives the guest's messages, when it gives one.
  guestBubbleColor?: string | null;
};

// What the guest can send with one click. A click makes each the guest's own
// message, so each is drawn as that message is.
const QuickReplies = ({
  replies,
  onSelect,
  component,
  guestBubbleColor,
}: Props) => {
  if (!replies || !replies.length) {
    return null;
  }
  const colors = guestBubbleColors(guestBubbleColor).sx;

  return (
    <Flex pb={5} data-component={component} sx={{flexDirection: 'column'}}>
      {replies.map((reply) => {
        const {text, action} = reply;

        return (
          <motion.div
            key={action}
            initial={{opacity: 0, x: -2}}
            animate={{opacity: 1, x: 0}}
            transition={{duration: 0.2, ease: 'easeIn'}}
          >
            <Flex pl={4} mb={2} sx={{justifyContent: 'flex-end'}}>
              <Box
                as="button"
                type="button"
                onClick={() => onSelect(reply)}
                sx={{
                  ...bubbleShape,
                  ...colors,
                  whiteSpace: 'pre-wrap',
                  // A button's own frame, type and centred text give way to
                  // the bubble's.
                  appearance: 'none',
                  border: 0,
                  fontFamily: 'inherit',
                  lineHeight: 'inherit',
                  textAlign: 'left',
                  // It is still a button: it answers the pointer and the
                  // keyboard.
                  cursor: 'pointer',
                  transition: 'filter 0.2s',
                  '&:hover': {filter: 'brightness(0.92)'},
                  '&:active': {filter: 'brightness(0.85)'},
                  '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'text',
                    outlineOffset: '2px',
                  },
                }}
              >
                {text}
              </Box>
            </Flex>
          </motion.div>
        );
      })}
    </Flex>
  );
};

export default QuickReplies;

import React, {useState} from 'react';
import {Box, Button, Flex, Text} from 'theme-ui';
import SendIcon from './SendIcon';
import MailIcon from './MailIcon';
import PhoneIcon from './PhoneIcon';
import DiscardIcon from './DiscardIcon';
import Tippy from '@tippyjs/react';
import {FadeLoader} from 'react-spinners';
import {ContactAppearance} from '../helpers/appearance';

// Where the hint of the phone, or of the e-mail, stands: before the first
// copy, after one, or just after a copy that worked or failed.
type CopyHint = 'first' | 'again' | 'copied' | 'failed';

const ChatFooterEmail = ({
  onClickMailIcon,
  isMailIconClicked,
  handleSubmitCF,
  isSubmittedCF,
  hotelEmail,
  hotelPhone,
  isPhoneShown = true,
  shouldShowContactForm,
  isLoading,
  statusMessageCF,
  look,
}: {
  onClickMailIcon: () => void;
  isMailIconClicked: boolean;
  handleSubmitCF: () => void;
  isSubmittedCF: boolean;
  hotelEmail: string;
  hotelPhone: string;
  // Whether the phone and its icon are drawn: with a phone, and always on a
  // line drawn from inHotel's settings.
  isPhoneShown?: boolean;
  shouldShowContactForm: boolean;
  isLoading: boolean;
  statusMessageCF: string;
  // What the look gives the contact line: its hints, and the words of its
  // form when it has one.
  look: ContactAppearance;
}) => {
  const {form} = look;
  const [emailHint, setEmailHint] = useState<CopyHint>('first');
  const [phoneHint, setPhoneHint] = useState<CopyHint>('first');
  // The words are read from the look each time, so a look that arrives late
  // is the one the hint speaks in.
  const hintText = (hint: CopyHint): string =>
    ({
      first: look.firstCopyHint,
      again: look.copyHint,
      copied: look.copiedNote,
      failed: look.copyFailedNote,
    }[hint]);

  const copyToClipboard = (
    text: string,
    setHint: React.Dispatch<React.SetStateAction<CopyHint>>
  ) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setHint('copied');
        setTimeout(() => setHint('again'), 1500);
      },
      (err) => {
        console.error('Failed to copy:', err);
        setHint('failed');
        setTimeout(() => setHint('again'), 1500);
      }
    );
  };
  const [isDiscardFocused, setIsDiscardFocused] = useState(false);
  const useHoverStylesOnEnter = () => {
    setIsDiscardFocused(true);
  };
  const useHoverStylesOnLeave = () => {
    setIsDiscardFocused(false);
  };

  return (
    <Box sx={{}}>
      {isMailIconClicked && (
        <Box>
          <Flex
            sx={{
              alignItems: 'center',
              justifyContent:
                statusMessageCF === null ? 'space-between' : 'left',
              flexDirection: 'row',
            }}
            py={2}
            mt={'2px'}
          >
            <Box
              mr={2}
              sx={{flex: '0 0 auto', display: 'flex', alignItems: 'center'}}
            >
              <Tippy
                content={form ? form.discardHint : ''}
                interactive={true}
                interactiveBorder={20}
                delay={100}
              >
                <Button
                  onClick={() => {
                    onClickMailIcon();
                    useHoverStylesOnLeave();
                  }}
                  onMouseEnter={useHoverStylesOnEnter}
                  onMouseLeave={useHoverStylesOnLeave}
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: '50%',
                    height: '36px',
                    width: '36px',
                    padding: '2px',
                    borderStyle: 'solid',
                    borderColor: '#9a9b9b',
                    borderWidth: '2px',
                    bg: '#f5f5f5',
                  }}
                >
                  <DiscardIcon fill={isDiscardFocused ? 'white' : '#9a9b9b'} />
                </Button>
              </Tippy>
              {!isSubmittedCF && (
                <Box
                  sx={{
                    display: 'flex',
                    color: 'rgba(148, 148, 156, 1.0)',
                    marginLeft: '8px',
                  }}
                >
                  {form && form.discardLabel}
                </Box>
              )}
            </Box>

            {!isSubmittedCF && (
              <Box sx={{display: 'flex', alignItems: 'center', mb: '2px'}}>
                {!isLoading && (
                  <Box
                    sx={{
                      display: 'flex',
                      color: 'rgba(148, 148, 156, 1.0)',
                      marginRight: '8px',
                    }}
                  >
                    {form && form.sendLabel}
                  </Box>
                )}
                {isLoading && (
                  <Box
                    sx={{
                      display: 'flex',
                      color: 'rgba(148, 148, 156, 1.0)',
                      marginRight: '8px',
                    }}
                  >
                    {form && form.sendingLabel}
                  </Box>
                )}
                <Tippy
                  content={form ? form.sendHint : ''}
                  interactive={true}
                  interactiveBorder={20}
                  delay={100}
                >
                  <Button
                    onClick={handleSubmitCF}
                    sx={{
                      display: 'flex',
                      position: 'relative',
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderRadius: '50%',
                      height: '36px',
                      width: '36px',
                      padding: '2px',
                      borderWidth: '2px',
                      ml: 'auto', // Push it to the right if needed, or adjust as per design
                    }}
                  >
                    {!isLoading && <SendIcon fill="background" />}
                    {isLoading && (
                      <div
                        style={{
                          position: 'absolute', // Use absolute positioning within the button
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <FadeLoader
                          color="background"
                          height="6px"
                          width="4px"
                          margin={-5}
                          cssOverride={{
                            marginTop: '16px',
                            marginLeft: '8px',
                          }}
                        />
                      </div>
                    )}
                  </Button>
                </Tippy>
              </Box>
            )}
            {isSubmittedCF && statusMessageCF == null && (
              <Box
                sx={{
                  fontSize: '0.85em',
                  display: 'flex',
                  marginLeft: '8px', // Ensure some space between the button and text, adjust as needed
                }}
              >
                {form && form.confirmation}
              </Box>
            )}

            {statusMessageCF != null && (
              <Box
                sx={{
                  fontSize: '0.85em',
                  display: 'flex',
                  marginLeft: '8px', // Ensure some space between the button and text, adjust as needed
                }}
              >
                {statusMessageCF}
              </Box>
            )}
          </Flex>
        </Box>
      )}

      <Flex
        p={0}
        sx={{
          color: 'tertiary',
          flex: 1,
          fontSize: '14px',
          alignItems: 'center',
        }}
      >
        <Flex
          sx={{
            flex: 1,
            alignItems: 'stretch',
            justifyContent: 'space-between',
            borderTop: isMailIconClicked ? '1px solid rgb(230, 230, 230)' : '',
            minHeight: '40px',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {isPhoneShown && <PhoneIcon />}
            {isPhoneShown && (
              <Box
                p={1}
                sx={{
                  mr: 0,
                  wordWrap: 'break-word',
                  fontSize: '14px',
                }}
              >
                <Tippy content={hintText(phoneHint)}>
                  <Text
                    sx={{ml: 0, whiteSpace: 'nowrap', cursor: 'pointer'}}
                    onClick={() => copyToClipboard(hotelPhone, setPhoneHint)}
                  >
                    {hotelPhone}
                  </Text>
                </Tippy>
              </Box>
            )}
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Box
              sx={{
                wordWrap: 'break-word',
                mr: 2,
                fontSize: '14px',
              }}
            >
              <Tippy content={hintText(emailHint)}>
                <Text
                  sx={{
                    ml: 2,
                    mr: 0,
                    maxWidth: '122px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                  }}
                  onClick={() => copyToClipboard(hotelEmail, setEmailHint)}
                >
                  {hotelEmail}
                </Text>
              </Tippy>
            </Box>
            <Tippy
              content={form ? form.openHint : ''}
              disabled={!form}
              interactive={true}
              interactiveBorder={20}
              delay={100}
            >
              <Box
                data-contact-form-control={
                  shouldShowContactForm ? 'true' : undefined
                }
                onClick={() => {
                  onClickMailIcon();
                }}
                sx={{
                  cursor: 'pointer',
                  visibility: isMailIconClicked ? 'hidden' : 'visible',
                }}
              >
                {shouldShowContactForm && <MailIcon />}
              </Box>
            </Tippy>
          </Box>
        </Flex>
      </Flex>
    </Box>
  );
};

export default ChatFooterEmail;

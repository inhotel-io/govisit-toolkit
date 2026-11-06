import React from 'react';
import {Box, Input, Textarea, Flex, Heading} from 'theme-ui';
import {BeatLoader} from 'react-spinners';

type Props = {
  handleChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  firstName: string;
  lastName: string;
  email: string;
  message: string;
  clickedSubmit: boolean;
  shouldSummarize: boolean;
  primaryColor: string;
};

const ContactForm = ({
  handleChange,
  firstName,
  lastName,
  email,
  message,
  clickedSubmit,
  shouldSummarize,
  primaryColor,
}: Props) => {
  return (
    <Box
      as="form"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        width: '100%',
      }}
    >
      <Heading
        mt={3}
        mb={3}
        sx={{
          fontFamily: 'body',
          color: 'rgba(148, 148, 156, 1.0)',
          fontWeight: 400,
          fontSize: '18px',
        }}
      >
        Contact Us
      </Heading>
      <Flex
        sx={{
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Input
          className="on-focus"
          name="firstName"
          id="firstName"
          mb={3}
          mr={3}
          px="12px"
          py="4px"
          sx={{
            borderStyle: 'solid',
            borderRadius: '16px',
            bg: 'white',
            borderWidth: '2px',
            borderColor: !firstName && clickedSubmit ? 'red' : 'transparent',
          }}
          value={firstName}
          placeholder="First Name"
          onChange={handleChange}
        />

        <Input
          className="on-focus"
          sx={{
            borderStyle: 'solid',
            borderRadius: '16px',
            bg: 'white',
            borderWidth: '2px',
            borderColor: !lastName && clickedSubmit ? 'red' : 'transparent',
          }}
          px="12px"
          py="4px"
          name="lastName"
          id="lastName"
          mb={3}
          value={lastName}
          placeholder="Last Name"
          onChange={handleChange}
        />
      </Flex>

      <Input
        className="on-focus"
        sx={{
          borderStyle: 'solid',
          borderRadius: '16px',
          bg: 'white',
          borderWidth: '2px',
          borderColor: !email && clickedSubmit ? 'red' : 'transparent',
        }}
        px="12px"
        py="4px"
        name="email"
        id="email"
        mb={3}
        type="email"
        value={email}
        placeholder="Email"
        onChange={handleChange}
      />

      <Box sx={{position: 'relative', display: 'flex', flex: '1 0 40px'}}>
        <Textarea
          className="on-focus"
          sx={{
            borderStyle: 'solid',
            borderRadius: '16px',
            bg: 'white',
            borderWidth: '2px',
            borderColor: !message && clickedSubmit ? 'red' : 'transparent',
            resize: 'none',
            opacity: shouldSummarize ? 0.1 : 1, // Apply fading effect based on shouldSummarize
            pointerEvents: shouldSummarize ? 'none' : 'auto', // Prevent interaction when faded/disabled
          }}
          px="12px"
          py="4px"
          name="message"
          id="message"
          rows={1}
          mb={0}
          value={message}
          placeholder="Message"
          onChange={handleChange}
          disabled={shouldSummarize} // Disable based on shouldSummarize
        />
        {shouldSummarize && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              color: 'black',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              zIndex: 1,
            }}
          >
            <BeatLoader color={primaryColor} />
          </div>
        )}
      </Box>
    </Box>
  );
};

export default ContactForm;

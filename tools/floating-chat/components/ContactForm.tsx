import React from 'react';
import {Box, Input, Textarea, Flex, Heading} from 'theme-ui';
import {BeatLoader} from 'react-spinners';
import {ContactFormAppearance} from '../helpers/appearance';

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
  // What the look gives the form: its heading and the fields it has.
  form: ContactFormAppearance;
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
  form,
}: Props) => {
  // A field is marked once the guest tries to send the form without what it
  // requires.
  const isMissing = (
    field: ContactFormAppearance['email'],
    value: string
  ): boolean => !!field && field.isRequired && !value && clickedSubmit;

  return (
    <Box
      as="form"
      // The form is sent by the button under it, never by the browser: a form
      // with one single-line field would be submitted on Enter, to the chat's
      // own address with what the guest wrote in it.
      onSubmit={(event: React.FormEvent) => event.preventDefault()}
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
        {form.title}
      </Heading>
      {/* Each field below is a `FormField` of the form: one the look leaves
          out is not drawn. */}
      {(form.firstName || form.lastName) && (
        <Flex
          sx={{
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {form.firstName && (
            <Input
              className="on-focus"
              name="firstName"
              id="firstName"
              mb={3}
              mr={form.lastName ? 3 : 0}
              px="12px"
              py="4px"
              sx={{
                borderStyle: 'solid',
                borderRadius: '16px',
                bg: 'white',
                borderWidth: '2px',
                borderColor: isMissing(form.firstName, firstName)
                  ? 'red'
                  : 'transparent',
              }}
              value={firstName}
              placeholder={form.firstName.label}
              onChange={handleChange}
            />
          )}

          {form.lastName && (
            <Input
              className="on-focus"
              sx={{
                borderStyle: 'solid',
                borderRadius: '16px',
                bg: 'white',
                borderWidth: '2px',
                borderColor: isMissing(form.lastName, lastName)
                  ? 'red'
                  : 'transparent',
              }}
              px="12px"
              py="4px"
              name="lastName"
              id="lastName"
              mb={3}
              value={lastName}
              placeholder={form.lastName.label}
              onChange={handleChange}
            />
          )}
        </Flex>
      )}

      {form.email && (
        <Input
          className="on-focus"
          sx={{
            borderStyle: 'solid',
            borderRadius: '16px',
            bg: 'white',
            borderWidth: '2px',
            borderColor: isMissing(form.email, email) ? 'red' : 'transparent',
          }}
          px="12px"
          py="4px"
          name="email"
          id="email"
          mb={3}
          type="email"
          value={email}
          placeholder={form.email.label}
          onChange={handleChange}
        />
      )}

      {form.message && (
        <Box sx={{position: 'relative', display: 'flex', flex: '1 0 40px'}}>
          <Textarea
            className="on-focus"
            sx={{
              borderStyle: 'solid',
              borderRadius: '16px',
              bg: 'white',
              borderWidth: '2px',
              borderColor: isMissing(form.message, message)
                ? 'red'
                : 'transparent',
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
            placeholder={form.message.label}
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
      )}
    </Box>
  );
};

export default ContactForm;

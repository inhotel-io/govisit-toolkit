import React from 'react';
import {Box, Link} from 'theme-ui';
import {BrandingAppearance} from '../helpers/appearance';

// The line at the bottom of the chat: `Branding` in the UI's library.
const InhotelBranding = ({text, name, linkUrl}: BrandingAppearance) => (
  <Box
    p={2}
    pt={0}
    sx={{textAlign: 'center', color: 'gray', fontSize: '0.75rem'}}
    data-component="Branding"
  >
    {text}{' '}
    {linkUrl ? (
      <Link
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          color: 'inherit',
          opacity: 0.8,
          transition: '0.2s',
          '&:hover': {opacity: 1},
        }}
      >
        {name}
      </Link>
    ) : (
      name
    )}
  </Box>
);

export default InhotelBranding;

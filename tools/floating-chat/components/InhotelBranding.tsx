import React from 'react';
import {Box, Link} from 'theme-ui';

const InhotelBranding = () => (
  <Box
    p={2}
    pt={0}
    sx={{textAlign: 'center', color: 'gray', fontSize: '0.75rem'}}
  >
    Powered by{' '}
    <Link
      href="https://www.inhotel.io"
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        color: 'inherit',
        opacity: 0.8,
        transition: '0.2s',
        '&:hover': {opacity: 1},
      }}
    >
      inHotel
    </Link>
  </Box>
);

export default InhotelBranding;

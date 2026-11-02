import React from 'react';
import twemoji from 'twemoji';

interface CustomEmojiProps {
  text: string;
  className?: string;
}

export const CustomEmoji: React.FC<CustomEmojiProps> = ({
  text,
  className = '',
}) => {
  // Twemoji's string API produces HTML; escape untrusted text before adding emoji markup.
  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const processedHtml = twemoji.parse(escapedText, {
    folder: 'svg',
    ext: '.svg',
    className: 'emoji-icon',
    base: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/',
  });

  return (
    <span
      className={`emoji-wrapper ${className}`}
      dangerouslySetInnerHTML={{__html: processedHtml}}
    />
  );
};

export default CustomEmoji;

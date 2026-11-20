import configData from '../avatar-config.json';

// Returns the words (or whatever substrings based on the `separator`)
// in a string up until the point of meeting the`max` character limit
export function shorten(str: string | null, max: number, separator = ' ') {
  if (!str) {
    return '';
  } else if (str.length <= max) {
    return str;
  }

  return str.substr(0, str.lastIndexOf(separator, max)).concat('...');
}

export function setupPostMessageHandlers(w: any, handler: (msg: any) => void) {
  const cb = (msg: any) => {
    handler(msg);
  };

  if (w.addEventListener) {
    w.addEventListener('message', cb);

    return () => w.removeEventListener('message', cb);
  } else {
    w.attachEvent('onmessage', cb);

    return () => w.detachEvent('message', cb);
  }
}

export const loadAvatarConfig = (assistantType: string): string => {
  const data = configData['assistant-type-to-avatar-url']; // Access the array
  const config = data.find((item) => item['assistant-type'] === assistantType);
  return config
    ? config['avatar-url']
    : data.find((item) => item['assistant-type'] === 'default')!['avatar-url'];
};

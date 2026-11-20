export const DEFAULT_BASE_URL = 'https://backend.inhotel.io';

export const isDev = (w: any) => {
  const hostname = w?.location?.hostname || '';

  return Boolean(
    hostname === 'localhost' ||
      // [::1] is the IPv6 localhost address.
      hostname === '[::1]' ||
      // 127.0.0.0/8 are considered localhost for IPv4.
      hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
  );
};

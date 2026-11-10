import type { NextConfig } from 'next';

const config: NextConfig = {
  // Photo links come from the API's private storage and expire after 15 minutes, so pages are built per request and
  // images are shown as they are, not copied into Next's own image cache.
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default config;

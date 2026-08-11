import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'TCP Mobile Reference',
  slug: 'tcp-mobile-reference',
  version: '0.1.0',
  orientation: 'portrait',
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
  },
};

export default config;

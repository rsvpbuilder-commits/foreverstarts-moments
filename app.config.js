const { config } = require('dotenv');

config();

const parseBoolean = (value, fallback = false) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
      return false;
    }
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return fallback;
};

module.exports = {
  expo: {
    name: 'Moments - Forever Start - Josh & Josh',
    slug: 'moments-forever',
    version: '1.0.0',
    scheme: 'momentsforeverstart',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0B1828'
    },
    ios: {
      supportsTablet: true
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0B1828'
      },
      package: 'com.anonymous.momentsforever'
    },
    web: {
      favicon: './assets/favicon.png'
    },
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
      uploadEndpoint: process.env.EXPO_PUBLIC_UPLOAD_ENDPOINT || '',
      allowCoupleProvisioning: parseBoolean(
        process.env.EXPO_PUBLIC_ALLOW_COUPLE_PROVISIONING,
        false
      )
    },
    plugins: ['expo-video', 'expo-router']
  }
};

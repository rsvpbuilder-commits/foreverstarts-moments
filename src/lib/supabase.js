import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { safeAsyncStorage } from './safeAsyncStorage';

const extraConfig =
  Constants?.expoConfig?.extra ||
  Constants?.manifestExtra ||
  Constants?.manifest?.extra ||
  {};

export const SUPABASE_URL =
  extraConfig.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY =
  extraConfig.supabaseAnonKey ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    'Supabase URL or anon key missing. Please set them via app.json extra or EXPO_PUBLIC_* env vars.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: safeAsyncStorage
  }
});

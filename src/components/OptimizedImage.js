import { Image } from 'expo-image';
import { Platform } from 'react-native';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';

const isWeb = Platform.OS === 'web';
const RENDER_SEGMENT = '/storage/v1/render/image/';
const OBJECT_SEGMENT = '/storage/v1/object/';

const supabaseHost = (() => {
  if (!SUPABASE_URL) return '';
  try {
    const url = new URL(SUPABASE_URL);
    return url.host;
  } catch (_err) {
    return '';
  }
})();

function shouldAttachHeader(uri) {
  return (
    !isWeb &&
    !!SUPABASE_ANON_KEY &&
    typeof uri === 'string' &&
    uri.includes(RENDER_SEGMENT) &&
    (uri.includes(supabaseHost) || supabaseHost === '')
  );
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object' || !entry.uri) return entry;
  let uri = entry.uri;
  if (isWeb && uri.includes(RENDER_SEGMENT)) {
    uri = uri.replace(RENDER_SEGMENT, OBJECT_SEGMENT).split('?')[0];
  }
  const normalized = { ...entry, uri };
  if (shouldAttachHeader(uri)) {
    normalized.headers = {
      ...(entry.headers || {}),
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY
    };
  }
  return normalized;
}

function normalizeSource(source) {
  if (Array.isArray(source)) {
    return source.map(normalizeEntry);
  }
  if (typeof source === 'string') {
    return normalizeEntry({ uri: source });
  }
  return normalizeEntry(source);
}

export function OptimizedImage({ source, resizeMode, contentFit, ...props }) {
  const normalizedSource = normalizeSource(source);
  const fit = contentFit || resizeMode;
  return <Image source={normalizedSource} contentFit={fit} {...props} />;
}

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase, SUPABASE_URL } from './supabase';

const extraConfig =
  Constants?.expoConfig?.extra ||
  Constants?.manifestExtra ||
  Constants?.manifest?.extra ||
  {};

const STORAGE_BUCKET =
  extraConfig.storageBucket || process.env.EXPO_PUBLIC_STORAGE_BUCKET || '';

const CACHE_CONTROL =
  extraConfig.uploadCacheControl ||
  process.env.EXPO_PUBLIC_UPLOAD_CACHE_CONTROL ||
  '3600';

if (!STORAGE_BUCKET) {
  console.warn(
    'Storage bucket missing. Set extra.storageBucket or EXPO_PUBLIC_STORAGE_BUCKET.'
  );
}

const isImageMime = (mime) => (mime || '').startsWith('image/');

const MIME_EXTENSION_MAP = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/mpeg': 'mpeg',
  'video/3gpp': '3gp',
  'video/3gpp2': '3g2',
  'video/webm': 'webm',
  'video/x-matroska': 'mkv'
};

const getExtensionFromMime = (mimeType = '') => {
  const normalized = mimeType.toLowerCase();
  if (!normalized || normalized === 'application/octet-stream') {
    return '';
  }
  return MIME_EXTENSION_MAP[normalized] || normalized.split('/').pop() || '';
};

const buildFileName = (uri = '', mimeType = 'application/octet-stream') => {
  const fallbackName = `upload-${Date.now()}`;
  const uriName = uri.split('?')[0].split('/').pop();
  if (uriName && uriName.includes('.')) return uriName;
  const extension = getExtensionFromMime(mimeType);
  return extension ? `${fallbackName}.${extension}` : fallbackName;
};

const sanitizePathSegment = (value = '') =>
  value
    .toString()
    .trim()
    .replace(/^[\\/]+|[\\/]+$/g, '')
    .replace(/[^0-9a-zA-Z/_-]/g, '-');

const buildStoragePath = ({ folder, guestId, fileName }) => {
  const safeFolder = sanitizePathSegment(folder || 'misc');
  const safeGuest = sanitizePathSegment(guestId || 'guest');
  const prefix = [safeFolder, safeGuest].filter(Boolean).join('/');
  return [prefix, `${Date.now()}-${fileName}`].filter(Boolean).join('/');
};

const PUBLIC_OBJECT_PREFIX = SUPABASE_URL
  ? `${SUPABASE_URL}/storage/v1/object/public/`
  : '';
const PUBLIC_RENDER_PREFIX = SUPABASE_URL
  ? `${SUPABASE_URL}/storage/v1/render/image/public/`
  : '';

const compressImageAsync = async (uri, mimeType) => {
  if (Platform.OS === 'web' || !isImageMime(mimeType)) {
    return { uri, mimeType };
  }
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1920 } }],
      {
        compress: 0.85,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: false
      }
    );
    return {
      uri: result.uri,
      mimeType: 'image/jpeg'
    };
  } catch (err) {
    console.warn('Image compression failed, uploading original file', err);
    return { uri, mimeType };
  }
};

const readWebBlobAsync = async (uri) => {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('Unable to read file for upload.');
  }
  return response.blob();
};

const buildNativeFormData = ({ uri, fileName, mimeType }) => {
  const form = new FormData();
  form.append('', {
    uri,
    name: fileName,
    type: mimeType
  });
  return form;
};

const createUploadTargetAsync = async (path) => {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });

  if (error) {
    throw new Error(`Unable to create upload target: ${error.message}`);
  }

  return data;
};

const getPublicUrlAsync = async (path) => {
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path, {
    download: false
  });
  return data?.publicUrl || '';
};

export async function uploadMediaAsync({
  uri,
  folder,
  guestId,
  mimeType = 'application/octet-stream'
}) {
  if (!uri) throw new Error('Missing file URI');
  if (!STORAGE_BUCKET) {
    throw new Error('Storage bucket not configured.');
  }

  const fileName = buildFileName(uri, mimeType);
  const { uri: processedUri, mimeType: processedMime } = await compressImageAsync(
    uri,
    mimeType
  );
  const storagePath = buildStoragePath({ folder, guestId, fileName });
  const { token, path } = await createUploadTargetAsync(storagePath);
  const fileBody =
    Platform.OS === 'web'
      ? await readWebBlobAsync(processedUri)
      : buildNativeFormData({
          uri: processedUri,
          fileName,
          mimeType: processedMime
        });

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .uploadToSignedUrl(path, token, fileBody, {
      upsert: true,
      contentType: processedMime,
      cacheControl: CACHE_CONTROL
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  return getPublicUrlAsync(path);
}

export const STORAGE_BUCKET_NAME = STORAGE_BUCKET;

export function getStoragePathFromUrl(url = '') {
  if (!url || typeof url !== 'string') return null;
  const base = decodeURIComponent(url.split('?')[0]);
  let remainder = null;

  if (PUBLIC_OBJECT_PREFIX && base.startsWith(PUBLIC_OBJECT_PREFIX)) {
    remainder = base.slice(PUBLIC_OBJECT_PREFIX.length);
  } else if (PUBLIC_RENDER_PREFIX && base.startsWith(PUBLIC_RENDER_PREFIX)) {
    remainder = base.slice(PUBLIC_RENDER_PREFIX.length);
  } else {
    return null;
  }

  if (!remainder) return null;
  const parts = remainder.split('/');
  if (parts.length < 2) return null;
  if (parts[0] === STORAGE_BUCKET && parts.length >= 2) {
    return parts.slice(1).join('/');
  }
  return parts.slice(1).join('/');
}

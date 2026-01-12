import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './supabase';

const extraConfig =
  Constants?.expoConfig?.extra ||
  Constants?.manifestExtra ||
  Constants?.manifest?.extra ||
  {};

const UPLOAD_ENDPOINT =
  extraConfig.uploadEndpoint || process.env.EXPO_PUBLIC_UPLOAD_ENDPOINT || '';

const MEDIA_FIELD = 'file';

if (!UPLOAD_ENDPOINT) {
  console.warn(
    'Upload endpoint missing. Set extra.uploadEndpoint or EXPO_PUBLIC_UPLOAD_ENDPOINT.'
  );
}

const isImageMime = (mime) => (mime || '').startsWith('image/');

const buildFileName = (uri = '', mimeType = 'application/octet-stream') => {
  const fallbackName = `upload-${Date.now()}`;
  const uriName = uri.split('/').pop();
  if (uriName) return uriName;
  const extension = mimeType.split('/').pop();
  return extension ? `${fallbackName}.${extension}` : fallbackName;
};

const getAuthHeaders = async () => {
  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    return {
      Authorization: `Bearer ${session.access_token}`
    };
  }
  return {};
};

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

const uploadNativeAsync = async ({
  uri,
  mimeType,
  fileName,
  folder,
  guestId
}) => {
  const headers = {
    Accept: 'application/json',
    ...(await getAuthHeaders())
  };

  const result = await FileSystem.uploadAsync(UPLOAD_ENDPOINT, uri, {
    httpMethod: 'POST',
    headers,
    fieldName: MEDIA_FIELD,
    mimeType,
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    parameters: {
      fileName,
      folder: folder || 'misc',
      guestId: guestId || 'guest',
      mediaType: isImageMime(mimeType) ? 'image' : 'video'
    }
  });

  if (result.status >= 400) {
    throw new Error(
      `Upload failed with status ${result.status}: ${result.body || ''}`
    );
  }

  try {
    const parsed = JSON.parse(result.body);
    return parsed?.url || parsed?.publicUrl || '';
  } catch (err) {
    throw new Error('Upload succeeded but response was invalid JSON.');
  }
};

const uploadWebAsync = async ({
  uri,
  mimeType,
  fileName,
  folder,
  guestId
}) => {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('Unable to read file for upload.');
  }
  const blob = await response.blob();

  const form = new FormData();
  form.append(MEDIA_FIELD, blob, fileName);
  form.append('folder', folder || 'misc');
  form.append('guestId', guestId || 'guest');
  form.append('mediaType', isImageMime(mimeType) ? 'image' : 'video');

  const headers = await getAuthHeaders();

  const uploadResponse = await fetch(UPLOAD_ENDPOINT, {
    method: 'POST',
    headers,
    body: form
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(
      `Upload failed with status ${uploadResponse.status}: ${errorText}`
    );
  }

  const data = await uploadResponse.json();
  return data?.url || data?.publicUrl || '';
};

export async function uploadMediaAsync({
  uri,
  folder,
  guestId,
  mimeType = 'application/octet-stream'
}) {
  if (!uri) throw new Error('Missing file URI');
  if (!UPLOAD_ENDPOINT) {
    throw new Error('Upload endpoint not configured.');
  }

  const fileName = buildFileName(uri, mimeType);
  const { uri: processedUri, mimeType: processedMime } = await compressImageAsync(
    uri,
    mimeType
  );

  if (Platform.OS === 'web') {
    return uploadWebAsync({
      uri: processedUri,
      mimeType: processedMime,
      fileName,
      folder,
      guestId
    });
  }

  return uploadNativeAsync({
    uri: processedUri,
    mimeType: processedMime,
    fileName,
    folder,
    guestId
  });
}

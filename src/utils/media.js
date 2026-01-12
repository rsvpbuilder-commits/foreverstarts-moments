import { Platform } from 'react-native';

const PUBLIC_SEGMENT = '/storage/v1/object/public/';
const RENDER_SEGMENT = '/storage/v1/render/image/public/';
const IS_WEB = Platform.OS === 'web';

function parseQuery(queryString = '') {
  if (!queryString) return {};
  return queryString.split('&').reduce((acc, pair) => {
    if (!pair) return acc;
    const [rawKey, rawValue = ''] = pair.split('=');
    if (!rawKey) return acc;
    const key = decodeURIComponent(rawKey);
    const value = decodeURIComponent(rawValue);
    acc[key] = value;
    return acc;
  }, {});
}

function serializeQuery(params) {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function buildParams(options = {}, existingQuery = '') {
  const params = parseQuery(existingQuery);
  if (options.width) {
    params.width = String(options.width);
  }
  if (options.height) {
    params.height = String(options.height);
  }
  params.quality = String(options.quality ?? 70);
  params.resize = options.fit ?? 'cover';
  if (options.format) {
    params.format = options.format;
  }
  return serializeQuery(params);
}

export function getOptimizedImageUrl(uri, options = {}) {
  if (!uri || typeof uri !== 'string') return uri;
  if (!uri.includes(PUBLIC_SEGMENT)) {
    return uri;
  }
  if (!IS_WEB) {
    return uri;
  }
  const [base, query = ''] = uri.split('?');
  const params = buildParams(options, query);
  if (base.includes(RENDER_SEGMENT)) {
    const renderParams = buildParams(options, query);
    return `${base}?${renderParams}`;
  }
  const optimizedBase = base.replace(PUBLIC_SEGMENT, RENDER_SEGMENT);
  const renderParams = buildParams(options, query);
  return `${optimizedBase}?${renderParams}`;
}

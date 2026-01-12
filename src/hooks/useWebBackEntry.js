import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';

const getCurrentUrl = () => {
  if (typeof window === 'undefined') {
    return '';
  }
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
};

let pendingHistoryBacks = 0;

const debugLog = (...args) => {
  if (typeof console !== 'undefined') {
    console.log('[useWebBackEntry]', ...args);
  }
};

const markProgrammaticBack = (label) => {
  pendingHistoryBacks += 1;
  debugLog('markProgrammaticBack', label, { pendingHistoryBacks });
};

const shouldIgnorePop = () => {
  if (pendingHistoryBacks > 0) {
    pendingHistoryBacks -= 1;
    debugLog('ignorePopState', { pendingHistoryBacks });
    return true;
  }
  debugLog('handlePopState');
  return false;
};

export function useWebBackEntry(isActive, onBack, key = 'overlay') {
  const entryActiveRef = useRef(false);
  const skipNextCloseRef = useRef(false);
  const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

  const skipNextHistoryClose = useCallback(() => {
    skipNextCloseRef.current = true;
    debugLog('skipNextHistoryClose', { key });
  }, [key]);

  useEffect(() => {
    if (!isWeb) return undefined;

    const handlePopState = () => {
      if (shouldIgnorePop()) {
        return;
      }
      if (entryActiveRef.current) {
        entryActiveRef.current = false;
        debugLog('onBack', { key });
        onBack?.();
      } else {
        debugLog('popstate with no active entry', { key });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isWeb, onBack]);

  useEffect(() => {
    if (!isWeb) return undefined;
    const currentUrl = getCurrentUrl();

    if (isActive && !entryActiveRef.current) {
      window.history.pushState({ __overlay: key }, '', currentUrl);
      entryActiveRef.current = true;
      debugLog('pushState', { key, url: currentUrl });
    } else if (!isActive && entryActiveRef.current) {
      entryActiveRef.current = false;
      if (skipNextCloseRef.current) {
        skipNextCloseRef.current = false;
        debugLog('skip history.back', { key });
      } else {
        markProgrammaticBack(`effect-${key}`);
        window.history.back();
      }
    }
  }, [isActive, isWeb, key]);

  useEffect(() => {
    return () => {
      if (!isWeb) return;
      if (entryActiveRef.current) {
        entryActiveRef.current = false;
        markProgrammaticBack(`cleanup-${key}`);
        window.history.back();
      }
    };
  }, [isWeb]);

  return skipNextHistoryClose;
}

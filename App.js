import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  BackHandler
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useGuestStore } from './src/store/useGuestStore';
import { theme } from './src/theme/colors';
import { supabase } from './src/lib/supabase';
import { ensureGuestProfile } from './src/lib/guestProfiles';

// Screens
import AuthScreen from './src/screens/AuthScreen';
import FeedScreen from './src/screens/FeedScreen';
import WishesScreen from './src/screens/WishesScreen';
import StoriesScreen from './src/screens/StoriesScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import RsvpManagerScreen from './src/screens/RsvpManagerScreen';

// Components
import { BottomTabBar } from './src/components/BottomTabBar';
import { ComposerModal } from './src/components/ComposerModal';
import { UploadToast } from './src/components/UploadToast';
import { useWebBackEntry } from './src/hooks/useWebBackEntry';

function MainApp({ guest, onSignOut }) {
  const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
  const initialTabRef = useRef(
    isWeb && window.history.state?.tab ? window.history.state.tab : 'feed'
  );
  const [activeTab, setActiveTab] = useState(initialTabRef.current);
  const [rsvpManagerVisible, setRsvpManagerVisible] = useState(false);
  const isCouple = ['bride', 'groom'].includes(guest?.role);
  const [composerVisible, setComposerVisible] = useState(false);
  const [composerType, setComposerType] = useState('post');
  const [uploadToast, setUploadToast] = useState({
    visible: false,
    status: 'idle',
    current: 0,
    total: 0,
    type: 'post',
    message: ''
  });
  const [feedRefreshToken, setFeedRefreshToken] = useState(0);
  const handleCloseRsvpManager = useCallback(() => {
    setRsvpManagerVisible(false);
  }, []);
  const handleOpenRsvpManager = useCallback(() => {
    if (isCouple) {
      setRsvpManagerVisible(true);
    }
  }, [isCouple]);
  const changeTab = useCallback(
    (nextTab, options = {}) => {
      setActiveTab((prev) => {
        if (prev === nextTab) {
          return prev;
        }
        if (isWeb && options.recordHistory !== false) {
          const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
          window.history.pushState({ tab: nextTab }, '', currentUrl);
        }
        return nextTab;
      });
    },
    [isWeb]
  );

  useEffect(() => {
    if (!isWeb) return undefined;

    if (!window.history.state || !window.history.state.tab) {
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.history.replaceState({ tab: initialTabRef.current }, '', currentUrl);
    }

    const handleTabPop = (event) => {
      if (event.state?.tab) {
        changeTab(event.state.tab, { recordHistory: false });
      }
    };

    window.addEventListener('popstate', handleTabPop);
    return () => {
      window.removeEventListener('popstate', handleTabPop);
    };
  }, [isWeb, changeTab]);

  const handleTabPress = (tab) => {
    if (tab === 'create') {
      handleOpenComposer('post');
    } else {
      changeTab(tab);
    }
  };

  const handleOpenComposer = (type = 'post') => {
    setComposerType(type);
    setComposerVisible(true);
  };

  const handleCloseComposer = useCallback(() => {
    setComposerVisible(false);
  }, []);

  useWebBackEntry(composerVisible, handleCloseComposer, 'composer');
  useWebBackEntry(rsvpManagerVisible, handleCloseRsvpManager, 'rsvp-manager');

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    const handleHardwareBack = () => {
      if (rsvpManagerVisible) {
        handleCloseRsvpManager();
        return true;
      }
      if (composerVisible) {
        handleCloseComposer();
        return true;
      }
      if (activeTab !== 'feed') {
        changeTab('feed', { recordHistory: false });
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handleHardwareBack
    );
    return () => subscription.remove();
  }, [
    activeTab,
    changeTab,
    composerVisible,
    handleCloseComposer,
    handleCloseRsvpManager,
    rsvpManagerVisible
  ]);

  const handleUploadStatusChange = useCallback((payload) => {
    if (!payload) return;
    const nextType = payload.type || 'post';

    if (payload.state === 'starting') {
      setUploadToast({
        visible: true,
        status: 'uploading',
        current: 0,
        total: payload.total ?? 0,
        type: nextType,
        message: payload.message || `Preparing to share your ${nextType}...`
      });
      return;
    }

    if (payload.state === 'progress') {
      setUploadToast((prev) => ({
        visible: true,
        status: 'uploading',
        current: payload.current ?? prev.current ?? 0,
        total: payload.total ?? prev.total ?? 0,
        type: nextType,
        message: payload.message || `Uploading ${payload.current}/${payload.total}`
      }));
      return;
    }

    if (payload.state === 'success') {
      setUploadToast({
        visible: true,
        status: 'success',
        current: payload.current ?? payload.total ?? 0,
        total: payload.total ?? 0,
        type: nextType,
        message: payload.message || `Shared your ${nextType}!`
      });
      setTimeout(() => {
        setUploadToast((prev) => ({ ...prev, visible: false }));
      }, 2500);
      return;
    }

    if (payload.state === 'error') {
      setUploadToast({
        visible: true,
        status: 'error',
        current: payload.current ?? 0,
        total: payload.total ?? 0,
        type: nextType,
        message: payload.message || 'Upload failed. Please try again.'
      });
      setTimeout(() => {
        setUploadToast((prev) => ({ ...prev, visible: false }));
      }, 4000);
    }
  }, []);

  const renderScreen = () => {
    if (rsvpManagerVisible) {
      return (
        <RsvpManagerScreen
          guest={guest}
          onClose={handleCloseRsvpManager}
        />
      );
    }
    switch (activeTab) {
      case 'feed':
        return (
          <FeedScreen 
            guest={guest} 
            onOpenComposer={handleOpenComposer}
            refreshTrigger={feedRefreshToken}
            canManageRsvps={isCouple}
            onManageRsvps={handleOpenRsvpManager}
          />
        );
      case 'wishes':
        return <WishesScreen guest={guest} />;
      case 'messages':
        return <StoriesScreen guest={guest} />;
      case 'profile':
        return (
          <ProfileScreen 
            guest={guest} 
            onSignOut={onSignOut}
          />
        );
      default:
        return (
          <FeedScreen 
            guest={guest} 
            onOpenComposer={handleOpenComposer}
            refreshTrigger={feedRefreshToken}
            canManageRsvps={isCouple}
            onManageRsvps={handleOpenRsvpManager}
          />
        );
    }
  };

  const handleComposerUploaded = useCallback(() => {
    setFeedRefreshToken((prev) => prev + 1);
    changeTab('feed');
  }, [changeTab]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {renderScreen()}
      </SafeAreaView>
      
      {!rsvpManagerVisible && (
        <BottomTabBar 
          activeTab={activeTab} 
          onTabPress={handleTabPress}
          guest={guest}
        />
      )}

      <ComposerModal
        visible={composerVisible}
        onClose={handleCloseComposer}
        guest={guest}
        type={composerType}
        onUploaded={handleComposerUploaded}
        onUploadStateChange={handleUploadStatusChange}
      />

      <UploadToast
        visible={uploadToast.visible}
        status={uploadToast.status}
        current={uploadToast.current}
        total={uploadToast.total}
        type={uploadToast.type}
        message={uploadToast.message}
        onDismiss={() => setUploadToast((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

export default function App() {
  const guest = useGuestStore((state) => state.guest);
  const setGuest = useGuestStore((state) => state.setGuest);
  const signOut = useGuestStore((state) => state.signOut);

  useEffect(() => {
    let isMounted = true;

    const syncFromSession = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (session?.user) {
        try {
          const profile = await ensureGuestProfile(session.user);
          if (isMounted && profile) {
            setGuest(profile);
          }
        } catch (err) {
          console.error('Session bootstrap error', err);
        }
      }
    };

    syncFromSession();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session?.user) {
          signOut();
          return;
        }
        ensureGuestProfile(session.user)
          .then((profile) => {
            if (profile) setGuest(profile);
          })
          .catch((err) => console.error('Auth state sync error', err));
      }
    );

    return () => {
      isMounted = false;
      subscription?.subscription.unsubscribe();
    };
  }, [setGuest, signOut]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {guest ? (
          <MainApp guest={guest} onSignOut={signOut} />
        ) : (
          <AuthScreen />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background
  },
  safeArea: {
    flex: 1
  }
});

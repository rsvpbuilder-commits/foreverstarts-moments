import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Pressable,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { theme, spacing, radius } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { initialsAvatar } from '../utils/avatar';
import { IconClose } from './Icons';
import { getOptimizedImageUrl } from '../utils/media';
import { OptimizedImage } from './OptimizedImage';
import { ZoomableMedia } from './ZoomableMedia';

function StoryAvatar({ guest }) {
  const guestName = guest?.name || 'Guest';
  const fallbackAvatar = initialsAvatar(guestName);
  
  const hasValidAvatar = guest?.avatar_url && 
    typeof guest.avatar_url === 'string' && 
    guest.avatar_url.trim().length > 0 &&
    guest.avatar_url.startsWith('http');
  
  const optimizedAvatar = hasValidAvatar
    ? getOptimizedImageUrl(guest.avatar_url, { width: 140, height: 140, quality: 60 })
    : fallbackAvatar;
  const [avatarUri, setAvatarUri] = useState(optimizedAvatar);
  
  useEffect(() => {
    setAvatarUri(optimizedAvatar);
  }, [optimizedAvatar]);
  
  return (
    <OptimizedImage 
      source={{ uri: avatarUri }} 
      style={styles.avatar}
      onError={() => setAvatarUri(fallbackAvatar)}
    />
  );
}

function StoryVideoPlayer({ uri, isActive }) {
  const player = useVideoPlayer(uri, (playerInstance) => {
    playerInstance.loop = true;
    playerInstance.muted = Platform.OS === 'web';
    if (isActive) {
      playerInstance.play();
    }
  });

  useEffect(() => {
    if (!player) return;
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [player, isActive]);

  useEffect(() => {
    return () => {
      player?.pause();
    };
  }, [player]);

  if (!uri) return null;

  return (
    <VideoView
      style={styles.video}
      player={player}
      contentFit="cover"
      fullscreenOptions={{ enabled: true }}
      allowsPictureInPicture={false}
    />
  );
}

function formatTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function StoryViewerModal({
  visible,
  groups = [],
  initialGroupIndex = 0,
  initialStoryIndex = 0,
  guest,
  onClose,
  onStoryRemoved
}) {
  const [currentGroup, setCurrentGroup] = useState(initialGroupIndex);
  const [currentStory, setCurrentStory] = useState(initialStoryIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const transition = useRef(new Animated.Value(1));
  const directionRef = useRef('none');
  const zoomableRef = useRef(null);
  const [manageState, setManageState] = useState({
    visible: false,
    loading: false,
    error: ''
  });

  useEffect(() => {
    if (visible) {
      directionRef.current = 'none';
      setCurrentGroup(initialGroupIndex);
      setCurrentStory(initialStoryIndex);
      setIsZoomed(false);
    }
  }, [visible, initialGroupIndex, initialStoryIndex]);

  useEffect(() => {
    if (!visible) return;
    if (!groups.length) {
      onClose?.();
      return;
    }
    if (currentGroup >= groups.length) {
      setCurrentGroup(groups.length - 1);
      setCurrentStory(0);
      return;
    }
    const currentStories = groups[currentGroup]?.stories || [];
    if (!currentStories.length) {
      const nextGroupIndex = groups.findIndex((item) => item?.stories?.length);
      if (nextGroupIndex === -1) {
        onClose?.();
      } else {
        setCurrentGroup(nextGroupIndex);
        setCurrentStory(0);
      }
      return;
    }
    if (currentStory >= currentStories.length) {
      setCurrentStory(currentStories.length - 1);
    }
  }, [groups, currentGroup, currentStory, visible, onClose]);

  useEffect(() => {
    if (!visible) {
      setManageState({ visible: false, loading: false, error: '' });
    }
  }, [visible]);

  const group = groups[currentGroup] || null;
  const stories = group?.stories || [];
  const story = stories[currentStory] || null;
  const storyUri =
    story?.media_type === 'video'
      ? story?.media_url
      : getOptimizedImageUrl(story?.media_url, {
          width: 1600,
          quality: 80,
          fit: 'contain'
        });
  const storyOwnerId = story?.guest?.id || story?.guest_id;
  const canManageStory = Boolean(guest?.id && storyOwnerId && guest.id === storyOwnerId);

  const goToPrevious = useCallback(() => {
    if (isZoomed) return;
    
    // Reset zoom when navigating
    if (zoomableRef.current?.resetZoom) {
      zoomableRef.current.resetZoom();
    }
    setIsZoomed(false);
    
    directionRef.current = 'previous';
    if (currentStory > 0) {
      setCurrentStory((prev) => prev - 1);
      return;
    }
    if (currentGroup > 0) {
      const prevGroup = groups[currentGroup - 1];
      const prevStories = prevGroup?.stories || [];
      setCurrentGroup((prev) => prev - 1);
      setCurrentStory(Math.max(prevStories.length - 1, 0));
      return;
    }
    onClose?.();
  }, [currentStory, currentGroup, groups, onClose, isZoomed]);

  const goToNext = useCallback(() => {
    if (isZoomed) return;
    
    // Reset zoom when navigating
    if (zoomableRef.current?.resetZoom) {
      zoomableRef.current.resetZoom();
    }
    setIsZoomed(false);
    
    directionRef.current = 'next';
    if (currentStory < stories.length - 1) {
      setCurrentStory((prev) => prev + 1);
      return;
    }
    if (currentGroup < groups.length - 1) {
      setCurrentGroup((prev) => prev + 1);
      setCurrentStory(0);
      return;
    }
    onClose?.();
  }, [currentStory, currentGroup, groups, stories.length, onClose, isZoomed]);

  const openManageSheet = useCallback(() => {
    setManageState({ visible: true, loading: false, error: '' });
  }, []);

  const closeManageSheet = useCallback(() => {
    setManageState((prev) =>
      prev.loading ? prev : { visible: false, loading: false, error: '' }
    );
  }, []);

  const handleStoryAction = useCallback(
    async (action) => {
      if (!story?.id) return;
      const targetStoryId = story.id;
      setManageState((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        if (action === 'archive') {
          const expiresAt = new Date(Date.now() - 1000).toISOString();
          const { error } = await supabase
            .from('stories')
            .update({ expires_at: expiresAt })
            .eq('id', targetStoryId);
          if (error) {
            console.warn('Archive update failed, deleting instead', error);
            const { error: deleteFallbackError } = await supabase
              .from('stories')
              .delete()
              .eq('id', targetStoryId);
            if (deleteFallbackError) throw deleteFallbackError;
          }
        } else {
          const { error } = await supabase
            .from('stories')
            .delete()
            .eq('id', targetStoryId);
          if (error) throw error;
        }
        goToNext();
        onStoryRemoved?.(targetStoryId);
        setManageState({ visible: false, loading: false, error: '' });
      } catch (err) {
        console.error('Story action failed', err);
        setManageState((prev) => ({
          ...prev,
          loading: false,
          error:
            action === 'archive'
              ? 'Could not archive this story. Please try again.'
              : 'Could not delete this story. Please try again.'
        }));
      }
    },
    [story?.id, goToNext, onStoryRemoved]
  );

  const animateTransition = useCallback(() => {
    transition.current.setValue(0);
    Animated.timing(transition.current, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true
    }).start();
  }, []);

  useEffect(() => {
    animateTransition();
  }, [animateTransition, currentGroup, currentStory]);

  const handleZoomChange = useCallback((zoomed) => {
    setIsZoomed(zoomed);
  }, []);

  // Swipe gesture for navigation (only when not zoomed)
  const swipeGesture = useMemo(() => {
    return Gesture.Pan()
      .minPointers(1)
      .maxPointers(1)
      .activeOffsetX([-20, 20])
      .failOffsetY([-20, 20])
      .onEnd((event) => {
        if (isZoomed) return;
        
        const threshold = 60;
        if (event.translationX > threshold) {
          goToPrevious();
        } else if (event.translationX < -threshold) {
          goToNext();
        }
      })
      .enabled(!isZoomed);
  }, [goToNext, goToPrevious, isZoomed]);

  if (!visible || !group || !story) {
    return null;
  }

  const translateX = transition.current.interpolate({
    inputRange: [0, 1],
    outputRange:
      directionRef.current === 'next'
        ? [40, 0]
        : directionRef.current === 'previous'
        ? [-40, 0]
        : [0, 0]
  });
  const animatedStyle = {
    opacity: transition.current,
    transform: [{ translateX }]
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="fade"
        onRequestClose={onClose}
      >
        <SafeAreaView style={styles.container}>
          {/* Progress Bars */}
          <View style={styles.progressContainer}>
            {stories.map((_, index) => (
              <View key={index} style={styles.progressTrack}>
                <View 
                  style={[
                    styles.progressFill,
                    index < currentStory && styles.progressComplete,
                    index === currentStory && styles.progressActive
                  ]} 
                />
              </View>
            ))}
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.authorRow}>
              <StoryAvatar guest={group.guest || story.guest} />
              <View>
                <Text style={styles.author}>
                  {group.guest?.name || story.guest?.name || 'Guest'}
                </Text>
                <Text style={styles.timestamp}>{formatTime(story.created_at)}</Text>
              </View>
            </View>
            <View style={styles.headerButtons}>
              {canManageStory ? (
                <TouchableOpacity
                  onPress={openManageSheet}
                  style={styles.manageButton}
                >
                  <Text style={styles.manageButtonText}>Manage</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <IconClose size={20} color="#fff" strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Media */}
          <GestureDetector gesture={swipeGesture}>
            <View style={styles.mediaContainer}>
              <Animated.View style={[styles.mediaContent, animatedStyle]}>
                {story.media_type === 'video' ? (
                  <ZoomableMedia 
                    ref={zoomableRef}
                    style={styles.zoomWrapper}
                    onZoomChange={handleZoomChange}
                  >
                    <StoryVideoPlayer
                      key={story.id}
                      uri={storyUri}
                      isActive={visible && story.media_type === 'video'}
                    />
                  </ZoomableMedia>
                ) : (
                  <ZoomableMedia 
                    ref={zoomableRef}
                    style={styles.zoomWrapper}
                    onZoomChange={handleZoomChange}
                  >
                    <OptimizedImage
                      source={{ uri: storyUri }}
                      style={styles.image}
                      resizeMode="cover"
                    />
                  </ZoomableMedia>
                )}
              </Animated.View>

              {/* Touch Navigation Areas - only active when not zoomed */}
              {!isZoomed && (
                <View style={styles.touchAreas} pointerEvents="box-none">
                  <TouchableOpacity 
                    style={styles.touchLeft} 
                    onPress={goToPrevious}
                    activeOpacity={1}
                  />
                  <TouchableOpacity 
                    style={styles.touchRight} 
                    onPress={goToNext}
                    activeOpacity={1}
                  />
                </View>
              )}
            </View>
          </GestureDetector>

          {/* Meta */}
          <View style={styles.footer}>
            <Text style={styles.counter}>
              {currentStory + 1} / {stories.length} | {currentGroup + 1} of {groups.length}
            </Text>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={manageState.visible}
        onRequestClose={closeManageSheet}
      >
        <View style={styles.manageModalBackdrop}>
          <Pressable
            style={styles.manageModalOverlay}
            onPress={closeManageSheet}
          />
          <View style={styles.manageModalCard}>
            <Text style={styles.manageModalTitle}>Manage Story</Text>
            <Text style={styles.manageModalText}>
              Hide this story from the feed immediately or delete it forever.
            </Text>
            {manageState.error ? (
              <Text style={styles.manageModalError}>{manageState.error}</Text>
            ) : null}
            <TouchableOpacity
              style={[
                styles.manageDeleteButton,
                manageState.loading && styles.manageDisabled
              ]}
              onPress={() => handleStoryAction('delete')}
              disabled={manageState.loading}
            >
              {manageState.loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.manageDeleteText}>Delete story</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.manageCancelButton}
              onPress={closeManageSheet}
              disabled={manageState.loading}
            >
              <Text style={styles.manageCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: spacing.md
  },
  progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: 4
  },
  progressTrack: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.5)'
  },
  progressComplete: {
    width: '100%',
    backgroundColor: '#fff'
  },
  progressActive: {
    width: '100%',
    backgroundColor: theme.accent
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  authorRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center'
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: theme.accent
  },
  author: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14
  },
  timestamp: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12
  },
  manageButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)'
  },
  manageButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  mediaContainer: {
    flex: 1,
    marginHorizontal: spacing.sm,
    marginTop: spacing.md,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: '#111'
  },
  zoomWrapper: {
    flex: 1
  },
  mediaContent: {
    flex: 1
  },
  image: {
    width: '100%',
    height: '100%'
  },
  video: {
    width: '100%',
    height: '100%'
  },
  touchAreas: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row'
  },
  touchLeft: {
    flex: 1
  },
  touchRight: {
    flex: 1
  },
  footer: {
    padding: spacing.md,
    alignItems: 'center'
  },
  counter: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    textAlign: 'center'
  },
  manageModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: spacing.md,
    justifyContent: 'flex-end'
  },
  manageModalOverlay: {
    ...StyleSheet.absoluteFillObject
  },
  manageModalCard: {
    backgroundColor: 'rgba(17,17,17,0.95)',
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  manageModalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  manageModalText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    lineHeight: 18
  },
  manageModalError: {
    color: theme.error,
    fontSize: 13
  },
  manageArchiveButton: {
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center'
  },
  manageArchiveText: {
    color: '#fff',
    fontWeight: '600'
  },
  manageDeleteButton: {
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: theme.error,
    alignItems: 'center'
  },
  manageDeleteText: {
    color: '#fff',
    fontWeight: '700'
  },
  manageCancelButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center'
  },
  manageCancelText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600'
  },
  manageDisabled: {
    opacity: 0.7
  }
});

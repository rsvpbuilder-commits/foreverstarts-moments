import { useEffect, useMemo, useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { theme, spacing, radius } from '../theme/colors';
import { IconClose } from './Icons';
import { initialsAvatar } from '../utils/avatar';
import { getOptimizedImageUrl } from '../utils/media';
import { OptimizedImage } from './OptimizedImage';
import { ZoomableMedia } from './ZoomableMedia';

function ViewerAvatar({ guest, size = 44 }) {
  const guestName = guest?.name || 'Guest';
  const fallbackAvatar = initialsAvatar(guestName);
  const hasValidAvatar =
    guest?.avatar_url &&
    typeof guest.avatar_url === 'string' &&
    guest.avatar_url.trim().length > 0 &&
    guest.avatar_url.startsWith('http');
  const optimizedAvatar = hasValidAvatar
    ? getOptimizedImageUrl(guest.avatar_url, {
        width: size * 2,
        height: size * 2,
        quality: 65
      })
    : fallbackAvatar;
  const [avatarUri, setAvatarUri] = useState(optimizedAvatar);

  useEffect(() => {
    setAvatarUri(optimizedAvatar);
  }, [optimizedAvatar]);

  return (
    <OptimizedImage
      source={{ uri: avatarUri }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.accentMuted
      }}
      onError={() => setAvatarUri(fallbackAvatar)}
    />
  );
}

function ViewerVideo({ uri }) {
  const player = useVideoPlayer(uri, (playerInstance) => {
    playerInstance.loop = true;
    playerInstance.play();
  });

  return (
    <VideoView
      style={styles.viewerVideo}
      player={player}
      fullscreenOptions={{ enabled: true }}
      allowsPictureInPicture
      contentFit="contain"
    />
  );
}

function formatTime(dateString, isFeatured) {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / 86400000);
  if (isFeatured && diffDays >= 7) {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function PostViewerModal({
  visible,
  post,
  initialIndex = 0,
  onClose
}) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const scrollRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const zoomableRefs = useRef([]);

  const mediaItems = useMemo(() => {
    if (!post) return [];
    const items = [];
    if (post.media_url) {
      items.push({
        uri: post.media_url,
        type: post.media_type
      });
    }
    if (post.media_gallery?.length) {
      items.push(
        ...post.media_gallery.map((item) => ({
          uri: item.media_url,
          type: item.media_type
        }))
      );
    }
    return items;
  }, [post]);

  const highlightDate = useMemo(() => {
    if (!post?.is_featured || !post?.created_at) return null;
    try {
      return new Date(post.created_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (_err) {
      return null;
    }
  }, [post]);
  const highlightIcon = post?.moment_icon?.trim() || '';
  const hasHighlightIcon = Boolean(highlightIcon);

  useEffect(() => {
    if (!visible) return;
    setCurrentIndex(initialIndex);
    setIsZoomed(false);
    const schedule =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (cb) => setTimeout(cb, 0);
    schedule(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          x: screenWidth * initialIndex,
          animated: false
        });
      }
    });
  }, [initialIndex, screenWidth, visible, mediaItems.length]);

  // Reset zoom when changing slides
  const handleScrollEnd = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / screenWidth);
    
    if (newIndex !== currentIndex) {
      // Reset zoom on previous slide
      const prevRef = zoomableRefs.current[currentIndex];
      if (prevRef?.resetZoom) {
        prevRef.resetZoom();
      }
      setIsZoomed(false);
    }
    
    setCurrentIndex(newIndex);
  };

  const handleZoomChange = (zoomed) => {
    setIsZoomed(zoomed);
  };

  if (!visible || !post || mediaItems.length === 0) {
    return null;
  }

  const guestName = post.guest?.name || 'Guest';

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.authorRow}>
            <ViewerAvatar guest={post.guest} />
            <View>
              <Text style={styles.author}>{guestName}</Text>
              <Text style={styles.timestamp}>
                {formatTime(post.created_at, post.is_featured)}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <IconClose size={20} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled={!isZoomed}
          scrollEnabled={!isZoomed}
          showsHorizontalScrollIndicator={false}
          style={styles.viewerScroll}
          onMomentumScrollEnd={handleScrollEnd}
          bounces={!isZoomed}
        >
          {mediaItems.map((item, index) => {
            if (item.type === 'video') {
              return (
                <ZoomableMedia
                  key={`${item.uri}-${index}`}
                  ref={(ref) => { zoomableRefs.current[index] = ref; }}
                  style={[
                    styles.viewerSlide,
                    { width: screenWidth, height: screenHeight * 0.7 }
                  ]}
                  onZoomChange={handleZoomChange}
                >
                  <ViewerVideo uri={item.uri} />
                </ZoomableMedia>
              );
            }
            const optimizedUri = getOptimizedImageUrl(item.uri, {
              width: Math.round(screenWidth * 1.5),
              quality: 75,
              fit: 'contain'
            });
            return (
              <ZoomableMedia
                key={`${item.uri}-${index}`}
                ref={(ref) => { zoomableRefs.current[index] = ref; }}
                style={[
                  styles.viewerSlide,
                  { width: screenWidth, height: screenHeight * 0.7 }
                ]}
                onZoomChange={handleZoomChange}
              >
                <OptimizedImage
                  source={{ uri: optimizedUri }}
                  style={styles.viewerImage}
                  resizeMode="contain"
                />
              </ZoomableMedia>
            );
          })}
        </ScrollView>

        <View style={styles.metaRow}>
          <Text style={styles.counter}>
            {currentIndex + 1} / {mediaItems.length}
          </Text>
          {post.location ? (
            <Text style={styles.location}>{post.location}</Text>
          ) : null}
        </View>

        {post.is_featured ? (
          <View style={styles.highlightCard}>
            {hasHighlightIcon ? (
              <View style={styles.highlightIcon}>
                <Text style={styles.highlightIconText}>{highlightIcon}</Text>
              </View>
            ) : null}
            <View style={styles.highlightDetails}>
              <Text style={styles.highlightTitle}>
                {post.moment_title || 'Featured Moment'}
              </Text>
              {post.moment_subtitle ? (
                <Text style={styles.highlightSubtitle}>
                  {post.moment_subtitle}
                </Text>
              ) : null}
              {highlightDate ? (
                <Text style={styles.highlightDate}>{highlightDate}</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {post.caption ? (
          <Text style={styles.caption}>
            <Text style={styles.captionAuthor}>{guestName} </Text>
            {post.caption}
          </Text>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingBottom: spacing.lg,
    paddingTop: spacing.lg
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  author: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16
  },
  timestamp: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  viewerScroll: {
    flexGrow: 0
  },
  viewerSlide: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  viewerImage: {
    width: '100%',
    height: '100%'
  },
  viewerVideo: {
    width: '100%',
    height: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden'
  },
  metaRow: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  counter: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13
  },
  location: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13
  },
  caption: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    color: '#fff',
    fontSize: 15,
    lineHeight: 22
  },
  captionAuthor: {
    fontWeight: '600'
  },
  highlightCard: {
    flexDirection: 'row',
    gap: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)'
  },
  highlightIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  highlightIconText: {
    color: '#fff',
    fontSize: 20
  },
  highlightDetails: {
    flex: 1,
    gap: 4
  },
  highlightTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600'
  },
  highlightSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    lineHeight: 18
  },
  highlightDate: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    letterSpacing: 0.5
  }
});

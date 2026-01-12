import { memo, useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { theme, spacing, radius } from '../theme/colors';
import { initialsAvatar } from '../utils/avatar';
import { IconHeart, IconComment } from '../components/Icons';
import { getOptimizedImageUrl } from '../utils/media';
import { OptimizedImage } from './OptimizedImage';

function PostAvatar({ guest }) {
  const guestName = guest?.name || 'Guest';
  const fallbackAvatar = initialsAvatar(guestName);
  
  const hasValidAvatar = guest?.avatar_url && 
    typeof guest.avatar_url === 'string' && 
    guest.avatar_url.trim().length > 0 &&
    guest.avatar_url.startsWith('http');
  
  const optimizedAvatar = hasValidAvatar
    ? getOptimizedImageUrl(guest.avatar_url, { width: 160, height: 160, quality: 60 })
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

function ReactionButton({ reactions, currentGuestId, onPress }) {
  const hasReacted = reactions?.some(r => r.guest_id === currentGuestId);
  const count = reactions?.length || 0;

  return (
    <TouchableOpacity 
      style={styles.actionButton}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <IconHeart 
        size={20} 
        color={hasReacted ? theme.heart : theme.textSecondary} 
        filled={hasReacted}
      />
      {count > 0 && (
        <Text style={[styles.actionCount, hasReacted && styles.actionCountActive]}>
          {count}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function VideoPlayer({ uri }) {
  const player = useVideoPlayer(uri, (player) => {
    player.loop = false;
    player.muted = true;
  });

  return (
    <VideoView
      style={styles.video}
      player={player}
      allowsFullscreen
      allowsPictureInPicture
      contentFit="cover"
    />
  );
}

function PostCardComponent({
  post,
  currentGuestId,
  onReactPress,
  onCommentPress,
  onMediaPress,
  onAuthorPress,
  onManagePost
}) {
  const { width: screenWidth } = useWindowDimensions();
  const fallbackMediaWidth = Math.max(screenWidth - spacing.md * 2, 1);
  const [mediaWidth, setMediaWidth] = useState(fallbackMediaWidth);
  const slideWidth = Math.max(mediaWidth, 1);
  
  const guest = post?.guest || {};
  const guestName = guest.name || 'Guest';
  
  const mediaItems = useMemo(() => {
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
  }, [post.media_url, post.media_type, post.media_gallery]);
  
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [mediaItems.length]);

  useEffect(() => {
    setMediaWidth((prev) =>
      Math.abs(prev - fallbackMediaWidth) > 1 ? fallbackMediaWidth : prev
    );
  }, [fallbackMediaWidth]);

  const handleCardLayout = useCallback((event) => {
    const measuredWidth = event?.nativeEvent?.layout?.width;
    if (!measuredWidth) return;
    setMediaWidth((prev) =>
      Math.abs(prev - measuredWidth) > 1 ? measuredWidth : prev
    );
  }, []);

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (post.is_featured && diffDays >= 7) {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const highlightIcon = post.moment_icon?.trim();
  const hasHighlightIcon = Boolean(highlightIcon);

  return (
    <View style={styles.card} onLayout={handleCardLayout}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.authorButton}
          activeOpacity={0.75}
          onPress={() => guest?.id && onAuthorPress?.(guest)}
        >
          <PostAvatar guest={guest} />
          <View style={styles.headerMeta}>
            <Text style={styles.authorName}>{guestName}</Text>
            <Text style={styles.timestamp}>{formatTime(post.created_at)}</Text>
          </View>
        </TouchableOpacity>
        {guest?.id === currentGuestId && (
          <TouchableOpacity
            style={styles.manageButton}
            onPress={() => onManagePost?.(post)}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Text style={styles.manageButtonText}>•••</Text>
          </TouchableOpacity>
        )}
      </View>

      {post.is_featured && (
        <View style={styles.highlightBanner}>
          {hasHighlightIcon ? (
            <View style={styles.highlightIconWrapper}>
              <Text style={styles.highlightIconText}>{highlightIcon}</Text>
            </View>
          ) : null}
          <View style={styles.highlightText}>
            <Text style={styles.highlightTitle}>
              {post.moment_title || 'Featured Moment'}
            </Text>
            {post.moment_subtitle ? (
              <Text style={styles.highlightSubtitle}>
                {post.moment_subtitle}
              </Text>
            ) : null}
          </View>
        </View>
      )}

      {/* Media */}
      {mediaItems.length > 0 && (
        <View style={styles.mediaContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(event) => {
              const offsetX = event.nativeEvent.contentOffset.x;
              const index = Math.round(offsetX / slideWidth);
              setActiveIndex(index);
            }}
            scrollEventThrottle={16}
          >
            {mediaItems.map((item, index) => {
              if (item.type === 'video') {
                return (
                  <View style={[styles.mediaSlide, { width: slideWidth }]} key={index.toString()}>
                    <VideoPlayer uri={item.uri} />
                  </View>
                );
              }
              const optimizedUri = getOptimizedImageUrl(item.uri, {
                width: Math.round(slideWidth * 1.2),
                quality: 65,
                fit: 'cover'
              });
              return (
                <TouchableOpacity
                  key={index.toString()}
                  activeOpacity={0.92}
                  onPress={() => onMediaPress?.(post, index)}
                  style={[styles.mediaSlide, { width: slideWidth }]}
                >
                  <OptimizedImage
                    source={{ uri: optimizedUri }}
                    style={styles.mediaImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {mediaItems.length > 1 && (
            <View style={styles.paginationDots}>
              {mediaItems.map((_, index) => (
                <View 
                  key={index}
                  style={[
                    styles.dot,
                    index === activeIndex && styles.dotActive
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* Caption */}
      {post.caption && (
        <Text style={styles.caption}>
          <Text style={styles.captionAuthor}>{guestName} </Text>
          {post.caption}
        </Text>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <ReactionButton 
          reactions={post.reactions}
          currentGuestId={currentGuestId}
          onPress={() => onReactPress?.(post)}
        />
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => onCommentPress?.(post)}
          activeOpacity={0.7}
        >
          <IconComment size={20} color={theme.textSecondary} />
          {(post.comments?.length || 0) > 0 && (
            <Text style={styles.actionCount}>
              {post.comments.length}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const PostCard = memo(PostCardComponent);

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.cardElevated,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }
  },
  authorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm
  },
  manageButton: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs
  },
  manageButtonText: {
    color: theme.textSecondary,
    fontSize: 18,
    letterSpacing: 2
  },
  highlightBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: theme.cardElevated,
    borderWidth: 1,
    borderColor: theme.border
  },
  highlightIconWrapper: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border
  },
  highlightIconText: {
    fontSize: 20,
    color: theme.textPrimary
  },
  highlightText: {
    flex: 1,
    gap: 2
  },
  highlightLabel: {
    fontSize: 11,
    color: theme.accent,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '600'
  },
  highlightTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary
  },
  highlightSubtitle: {
    fontSize: 12,
    color: theme.textSecondary,
    lineHeight: 16
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.accentMuted
  },
  headerMeta: {
    flex: 1
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary
  },
  timestamp: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 1
  },
  mediaContainer: {
    position: 'relative',
    marginBottom: spacing.sm
  },
  mediaSlide: {
    height: 340
  },
  mediaImage: {
    width: '100%',
    height: 340
  },
  video: {
    width: '100%',
    height: '100%'
  },
  paginationDots: {
    position: 'absolute',
    bottom: spacing.sm,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)'
  },
  dotActive: {
    backgroundColor: theme.accent,
    width: 16
  },
  caption: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    marginTop: spacing.sm,
    fontSize: 14,
    color: theme.textPrimary,
    lineHeight: 20
  },
  captionAuthor: {
    fontWeight: '600'
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.lg
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  actionCount: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: '500'
  },
  actionCountActive: {
    color: theme.heart
  }
});

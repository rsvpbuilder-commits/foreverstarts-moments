import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ScrollView
} from 'react-native';
import { supabase } from '../lib/supabase';
import { theme, spacing, radius } from '../theme/colors';
import { StoryViewerModal } from '../components/StoryViewerModal';
import { PostViewerModal } from '../components/PostViewerModal';
import { IconCamera } from '../components/Icons';
import { useWebBackEntry } from '../hooks/useWebBackEntry';
import { getOptimizedImageUrl } from '../utils/media';
import { OptimizedImage } from '../components/OptimizedImage';

function groupStories(rawStories) {
  const grouped = [];
  const map = new Map();
  rawStories.forEach((story) => {
    const guestId =
      story.guest?.id || story.guest_id || `guest-${story.id}-${Math.random()}`;
    if (!map.has(guestId)) {
      map.set(guestId, {
        guest: story.guest,
        stories: []
      });
      grouped.push(map.get(guestId));
    }
    map.get(guestId).stories.push(story);
  });

  grouped.forEach((group) => {
    group.stories.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
  });

  return grouped;
}

function StoryCard({ group, index, onPress }) {
  const cover = group.stories?.[0];
  const guestName = group.guest?.name || 'Guest';
  const count = group.stories?.length || 0;
  const plural = count === 1 ? 'story' : 'stories';
  const coverUri = getOptimizedImageUrl(cover?.media_url, {
    width: 900,
    height: 900,
    quality: 70,
    fit: 'cover'
  }) || cover?.media_url;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => onPress?.(index)}
    >
      <View style={styles.cardImageWrapper}>
        <OptimizedImage
          source={{ uri: coverUri }}
          style={styles.cardImage}
          resizeMode="cover"
        />
        <View style={styles.cardOverlay} />
        <View style={styles.cardMeta}>
          <Text style={styles.cardName}>{guestName}</Text>
          <Text style={styles.cardCount}>
            {count} {plural}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function StoriesScreen({ guest }) {
  const [stories, setStories] = useState([]);
  const [featuredMoments, setFeaturedMoments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewer, setViewer] = useState({
    visible: false,
    groupIndex: 0
  });
  const [highlightViewer, setHighlightViewer] = useState({
    visible: false,
    post: null
  });
  const autoOpened = useRef(false);

  const fetchStories = useCallback(async () => {
    try {
      const now = Date.now();
      const { data, error } = await supabase
        .from('stories')
        .select(
          `
          id,
          media_url,
          media_type,
          created_at,
          expires_at,
          guest:guest_id (
            id,
            name,
            avatar_url
          )
        `
        )
        .order('created_at', { ascending: false })
        .limit(80);
      if (error) throw error;
      const active = (data || []).filter((story) => {
        const expiresAt = story.expires_at
          ? new Date(story.expires_at).getTime()
          : null;
        if (Number.isFinite(expiresAt)) {
          return expiresAt > now;
        }
        const createdAt = new Date(story.created_at).getTime();
        return Number.isFinite(createdAt) && now - createdAt < 24 * 60 * 60 * 1000;
      });
      const grouped = groupStories(active);
      const randomized = [...grouped].sort(() => Math.random() - 0.5);
      setStories(randomized.slice(0, 40));
    } catch (err) {
      console.error('Stories tab load error', err);
      setStories([]);
    }
  }, []);

  const fetchFeaturedMoments = useCallback(async () => {
    const { data, error } = await supabase
      .from('posts')
      .select(
        `
        id,
        media_url,
        media_type,
        caption,
        location,
        is_featured,
        moment_title,
        moment_subtitle,
        moment_icon,
        created_at,
        media_gallery:post_media (
          id,
          media_url,
          media_type,
          created_at
        ),
        guest:guest_id (
          id,
          name,
          avatar_url
        )
      `
      )
      .eq('is_featured', true)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) {
      console.error('Timeline highlights load error', error);
      return;
    }
    setFeaturedMoments(data || []);
  }, []);

  const loadStories = useCallback(
    async (showLoader = false) => {
      if (showLoader) {
        setLoading(true);
      }
      setRefreshing(true);
      try {
        await Promise.all([fetchStories(), fetchFeaturedMoments()]);
      } finally {
        setRefreshing(false);
        setLoading(false);
      }
    },
    [fetchStories, fetchFeaturedMoments]
  );

  useEffect(() => {
    loadStories(true);
  }, [loadStories]);

  const handleStoryRemoved = useCallback(
    (storyId) => {
      if (!storyId) return;
      setStories((prev) => {
        let changed = false;
        const updated = prev
          .map((group) => {
            const remaining = (group.stories || []).filter(
              (story) => story.id !== storyId
            );
            if (remaining.length !== (group.stories?.length || 0)) {
              changed = true;
              return { ...group, stories: remaining };
            }
            return group;
          })
          .filter((group) => group.stories?.length);
        return changed ? updated : prev;
      });
      loadStories(false);
    },
    [loadStories]
  );

  useEffect(() => {
    const channel = supabase
      .channel('stories-random-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stories' },
        fetchStories
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        fetchFeaturedMoments
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStories, fetchFeaturedMoments]);

  useEffect(() => {
    if (!autoOpened.current && stories.length) {
      autoOpened.current = true;
      setViewer({
        visible: true,
        groupIndex: 0
      });
    }
  }, [stories.length]);

  const openViewer = useCallback(
    (index) => {
      autoOpened.current = true;
      setViewer({
        visible: true,
        groupIndex: index
      });
    },
    []
  );

  const closeViewer = useCallback(() => {
    setViewer((prev) => ({ ...prev, visible: false }));
  }, []);
  useWebBackEntry(viewer.visible, closeViewer, 'stories-viewer');

  const openHighlightViewer = useCallback((moment) => {
    if (!moment) return;
    setHighlightViewer({
      visible: true,
      post: moment
    });
  }, []);

  const closeHighlightViewer = useCallback(() => {
    setHighlightViewer({ visible: false, post: null });
  }, []);
  useWebBackEntry(highlightViewer.visible, closeHighlightViewer, 'highlight-viewer');

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={() => loadStories(false)}
        tintColor={theme.accent}
      />
    ),
    [loadStories, refreshing]
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={stories}
        keyExtractor={(_item, index) => `story-group-${index}`}
        renderItem={({ item, index }) => (
          <StoryCard group={item} index={index} onPress={openViewer} />
        )}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <IconCamera size={20} color={theme.accent} />
              <Text style={styles.title}>Stories</Text>
            </View>
            <Text style={styles.subtitle}>
              Random stories from guests over the last 24 hours.
            </Text>
            <View style={styles.highlightsSection}>
              <Text style={styles.highlightsHeading}>Timeline Highlights</Text>
              {featuredMoments.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.highlightsRow}
                >
                  {featuredMoments.map((moment) => {
                    const displayDate = new Date(moment.created_at).toLocaleDateString(
                      'en-US',
                      { month: 'short', day: 'numeric', year: 'numeric' }
                    );
                    return (
                      <TouchableOpacity
                        key={moment.id}
                        style={styles.highlightCard}
                        activeOpacity={0.85}
                        onPress={() => openHighlightViewer(moment)}
                      >
                        <Text style={styles.highlightIcon}>
                          {moment.moment_icon || '<3'}
                        </Text>
                        <Text style={styles.highlightTitle}>
                          {moment.moment_title || 'Featured Moment'}
                        </Text>
                        {moment.moment_subtitle ? (
                          <Text style={styles.highlightSubtitle}>
                            {moment.moment_subtitle}
                          </Text>
                        ) : null}
                        <Text style={styles.highlightDate}>{displayDate}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <Text style={styles.highlightsEmpty}>
                  Featured timeline posts will appear here when the couple spotlights them.
                </Text>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <IconCamera size={28} color={theme.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No stories right now</Text>
              <Text style={styles.emptyText}>
                Once guests add stories, they’ll appear here at random.
              </Text>
            </View>
          )
        }
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
      />

      <StoryViewerModal
        visible={viewer.visible}
        groups={stories}
        initialGroupIndex={viewer.groupIndex}
        initialStoryIndex={0}
        guest={guest}
        onClose={closeViewer}
        onStoryRemoved={handleStoryRemoved}
      />

      <PostViewerModal
        visible={highlightViewer.visible}
        post={highlightViewer.post}
        initialIndex={0}
        onClose={closeHighlightViewer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 100,
    gap: spacing.md
  },
  header: {
    paddingTop: spacing.sm,
    gap: spacing.xs
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary
  },
  subtitle: {
    color: theme.textSecondary,
    fontSize: 13
  },
  highlightsSection: {
    marginTop: spacing.lg,
    gap: spacing.sm
  },
  highlightsHeading: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  highlightsRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs
  },
  highlightCard: {
    width: 200,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 6
  },
  highlightIcon: {
    fontSize: 24,
    marginBottom: spacing.xs
  },
  highlightTitle: {
    color: theme.textPrimary,
    fontSize: 15,
    fontWeight: '600'
  },
  highlightSubtitle: {
    color: theme.textSecondary,
    fontSize: 12,
    lineHeight: 16
  },
  highlightDate: {
    color: theme.textMuted,
    fontSize: 12,
    marginTop: spacing.xs
  },
  highlightsEmpty: {
    color: theme.textSecondary,
    fontSize: 13,
    lineHeight: 18
  },
  card: {
    height: 160,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.border
  },
  cardImageWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
    borderRadius: radius.xl,
    overflow: 'hidden'
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%'
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)'
  },
  cardMeta: {
    padding: spacing.md
  },
  cardName: {
    color: theme.textPrimary,
    fontSize: 16,
    fontWeight: '600'
  },
  cardCount: {
    color: theme.textSecondary,
    marginTop: 2
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xxl,
    gap: spacing.sm
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyTitle: {
    color: theme.textPrimary,
    fontSize: 17,
    fontWeight: '600'
  },
  emptyText: {
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260
  }
});

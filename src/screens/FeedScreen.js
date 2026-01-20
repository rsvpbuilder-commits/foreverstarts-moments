import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Pressable,
  Modal,
  ActivityIndicator,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import {
  STORAGE_BUCKET_NAME,
  getStoragePathFromUrl
} from '../lib/storage';
import { theme, spacing, radius } from '../theme/colors';
import { StoryBar } from '../components/StoryBar';
import { PostCard } from '../components/PostCard';
import { CommentsModal } from '../components/CommentsModal';
import { StoryViewerModal } from '../components/StoryViewerModal';
import { PostViewerModal } from '../components/PostViewerModal';
import { EditPostModal } from '../components/EditPostModal';
import { LoveQuoteLoader } from '../components/LoveQuoteLoader';
import ProfileScreen from './ProfileScreen';
import { useWebBackEntry } from '../hooks/useWebBackEntry';

const POSTS_PAGE_SIZE = 10;
const MIN_REFRESH_INTERVAL = 4000;

export default function FeedScreen({
  guest,
  onOpenComposer,
  refreshTrigger = 0,
  canManageRsvps = false,
  onManageRsvps
}) {
  const [posts, setPosts] = useState([]);
  const [storyGroups, setStoryGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commentsState, setCommentsState] = useState({
    visible: false,
    post: null
  });
  const [postViewer, setPostViewer] = useState({
    visible: false,
    post: null,
    index: 0
  });
  const [storyViewer, setStoryViewer] = useState({
    visible: false,
    groups: [],
    groupIndex: 0,
    storyIndex: 0
  });
  const [profileViewer, setProfileViewer] = useState({
    visible: false,
    guest: null
  });
  const [postActions, setPostActions] = useState({
    visible: false,
    post: null
  });
  const [deleteConfirm, setDeleteConfirm] = useState({
    visible: false,
    post: null,
    loading: false,
    error: ''
  });
  const [editState, setEditState] = useState({
    visible: false,
    post: null
  });
  const showRsvpButton = canManageRsvps && typeof onManageRsvps === 'function';
  const loadLockRef = useRef(false);
  const lastRefreshRef = useRef(0);
  const postsCursorRef = useRef(null);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const postsRequestRef = useRef(null);
  const storiesRequestRef = useRef(null);
  const closeComments = useCallback(
    () => setCommentsState({ visible: false, post: null }),
    []
  );
  const closePostViewer = useCallback(
    () => setPostViewer((prev) => ({ ...prev, visible: false })),
    []
  );
  const closeStoryViewer = useCallback(
    () => setStoryViewer((prev) => ({ ...prev, visible: false })),
    []
  );
  const closeProfileViewer = useCallback(
    () => setProfileViewer({ visible: false, guest: null }),
    []
  );
  const closePostActions = useCallback(
    () => setPostActions({ visible: false, post: null }),
    []
  );
  const closeDeleteConfirm = useCallback(
    () =>
      setDeleteConfirm({
        visible: false,
        post: null,
        loading: false,
        error: ''
      }),
    []
  );
  const closeEditModal = useCallback(
    () => setEditState({ visible: false, post: null }),
    []
  );
  const deletePostMediaFiles = useCallback(async (postRecord) => {
    if (!postRecord || !STORAGE_BUCKET_NAME) return;
    const pathSet = new Set();
    const appendFromUrl = (url) => {
      const path = getStoragePathFromUrl(url);
      if (path) {
        pathSet.add(path);
      }
    };
    appendFromUrl(postRecord.media_url);
    if (Array.isArray(postRecord.media_gallery)) {
      postRecord.media_gallery.forEach((item) => appendFromUrl(item?.media_url));
    }
    if (pathSet.size === 0) return;
    try {
      const { error } = await supabase.storage
        .from(STORAGE_BUCKET_NAME)
        .remove(Array.from(pathSet));
      if (error) {
        console.warn('Failed to delete media files', error);
      }
    } catch (err) {
      console.warn('Unexpected error deleting media files', err);
    }
  }, []);
  const openPostViewer = useCallback((post, index = 0) => {
    if (!post) return;
    setPostViewer({ visible: true, post, index });
  }, []);
  const openProfileViewer = useCallback((guestProfile) => {
    if (!guestProfile?.id) return;
    setProfileViewer({ visible: true, guest: guestProfile });
  }, []);
  const handleManagePost = useCallback((post) => {
    setPostActions({ visible: true, post });
  }, []);
  const handlePostUpdated = useCallback((updatedPost) => {
    setPosts((prev) =>
      prev.map((item) => (item.id === updatedPost.id ? updatedPost : item))
    );
  }, []);
  useWebBackEntry(commentsState.visible, closeComments, 'comments-modal');
  useWebBackEntry(postViewer.visible, closePostViewer, 'post-viewer');
  useWebBackEntry(storyViewer.visible, closeStoryViewer, 'story-viewer');
  useWebBackEntry(profileViewer.visible, closeProfileViewer, 'profile-viewer');
  const skipPostActionsHistory = useWebBackEntry(
    postActions.visible,
    closePostActions,
    'post-actions'
  );
  useWebBackEntry(deleteConfirm.visible, closeDeleteConfirm, 'delete-post');
  useWebBackEntry(editState.visible, closeEditModal, 'edit-post');

  const fetchPosts = useCallback(
    (options = {}) => {
      const reset = options.reset === true;
      if (postsRequestRef.current) {
        return postsRequestRef.current;
      }

      if (reset) {
        postsCursorRef.current = null;
      } else if (!hasMorePosts) {
        return Promise.resolve();
      }

      const cursor = !reset ? postsCursorRef.current : null;
      const request = (async () => {
        let query = supabase
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
            ),
            reactions:reactions (
              id,
              reaction_type,
              guest_id
            ),
            comments:comments (
              id,
              content,
              created_at,
              guest:guest_id (
                id,
                name,
                avatar_url
              )
            )
          `
          )
          .order('created_at', { ascending: false })
          .limit(POSTS_PAGE_SIZE);

        if (cursor) {
          query = query.lt('created_at', cursor);
        }

        const { data, error } = await query;
        if (error) {
          console.error('Posts load error', error);
          return;
        }

        const formatted = (data || []).map((post) => ({
          ...post,
          comments: (post.comments || []).sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at)
          )
        }));

        let snapshot = [];
        setPosts((prev) => {
          if (reset) {
            const incomingIds = new Set(formatted.map((item) => item.id));
            const remainder = prev.filter((item) => !incomingIds.has(item.id));
            snapshot = [...formatted, ...remainder];
          } else {
            const existingIds = new Set(prev.map((item) => item.id));
            const additions = formatted.filter((item) => !existingIds.has(item.id));
            snapshot = [...prev, ...additions];
          }
          return snapshot;
        });

        if (snapshot.length > 0) {
          postsCursorRef.current = snapshot[snapshot.length - 1]?.created_at || null;
        }

        if (reset) {
          setHasMorePosts(formatted.length === POSTS_PAGE_SIZE);
        } else if (formatted.length < POSTS_PAGE_SIZE) {
          setHasMorePosts(false);
        }
      })();

      postsRequestRef.current = request;
      request.finally(() => {
        if (postsRequestRef.current === request) {
          postsRequestRef.current = null;
        }
      });

      return request;
    },
    [hasMorePosts]
  );

  const fetchStories = useCallback(() => {
    if (storiesRequestRef.current) {
      return storiesRequestRef.current;
    }

    const request = (async () => {
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
        .limit(40);
      if (error) {
        console.error('Stories load error', error);
        return;
      }
      const activeStories = (data || []).filter((story) => {
        if (!story.expires_at) {
          const createdAt = new Date(story.created_at).getTime();
          if (!Number.isFinite(createdAt)) return true;
          return now - createdAt < 24 * 60 * 60 * 1000;
        }
        const expiresAt = new Date(story.expires_at).getTime();
        return Number.isFinite(expiresAt) && expiresAt > now;
      });
      const grouped = [];
      const guestMap = new Map();
      activeStories.forEach((story) => {
        const guestId =
          story.guest?.id || story.guest_id || `guest-${story.id || Math.random()}`;
        if (!guestMap.has(guestId)) {
          guestMap.set(guestId, {
            guest: story.guest,
            stories: []
          });
          grouped.push(guestMap.get(guestId));
        }
        guestMap.get(guestId).stories.push(story);
      });
      grouped.forEach((group) => {
        group.stories.sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
      });
      grouped.sort((a, b) => {
        const firstA = a.stories?.[0]?.created_at || 0;
        const firstB = b.stories?.[0]?.created_at || 0;
        return new Date(firstB) - new Date(firstA);
      });
      setStoryGroups(grouped);
    })();

    storiesRequestRef.current = request;
    request.finally(() => {
      if (storiesRequestRef.current === request) {
        storiesRequestRef.current = null;
      }
    });

    return request;
  }, []);

  const handleLoadMorePosts = useCallback(() => {
    if (loading || loadingMorePosts || refreshing || !hasMorePosts) return;
    setLoadingMorePosts(true);
    Promise.resolve(fetchPosts())
      .catch(() => {})
      .finally(() => setLoadingMorePosts(false));
  }, [loading, loadingMorePosts, refreshing, hasMorePosts, fetchPosts]);

  const loadData = useCallback(async (options = {}) => {
    const force = options.force === true;
    const now = Date.now();
    if (!force && now - lastRefreshRef.current < MIN_REFRESH_INTERVAL) {
      return;
    }
    lastRefreshRef.current = now;
    if (loadLockRef.current) return;
    loadLockRef.current = true;
    setRefreshing(true);
    try {
      await Promise.all([fetchPosts({ reset: true }), fetchStories()]);
    } finally {
      loadLockRef.current = false;
      setRefreshing(false);
      setLoading(false);
      setLoadingMorePosts(false);
    }
  }, [fetchPosts, fetchStories]);

  useEffect(() => {
    loadData({ force: true });
  }, [loadData]);

  useEffect(() => {
    if (!refreshTrigger) return;
    loadData({ force: true });
  }, [refreshTrigger, loadData]);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const supportsPointer = typeof window.PointerEvent === 'function';

    let startY = 0;
    let pulling = false;
    let ready = false;

    const resetPull = () => {
      startY = 0;
      pulling = false;
      ready = false;
    };

    const beginPull = (position) => {
      if (window.scrollY > 0 || refreshing) return;
      pulling = true;
      ready = false;
      startY = position ?? 0;
    };

    const updatePull = (position) => {
      if (!pulling) return;
      if (window.scrollY > 0 || refreshing) {
        resetPull();
        return;
      }
      const distance = (position ?? 0) - startY;
      ready = distance > 90;
    };

    const endPull = () => {
      if (!pulling) return;
      if (ready && !refreshing) {
        loadData();
      }
      resetPull();
    };

    const handlePointerDown = (event) => {
      if (event.pointerType === 'mouse' && event.buttons !== 1) return;
      beginPull(event.clientY);
    };
    const handlePointerMove = (event) => {
      updatePull(event.clientY);
    };
    const handlePointerUp = () => {
      endPull();
    };
    const handlePointerCancel = () => {
      resetPull();
    };

    const handleTouchStart = (event) => {
      beginPull(event.touches?.[0]?.clientY);
    };
    const handleTouchMove = (event) => {
      updatePull(event.touches?.[0]?.clientY);
    };
    const handleTouchEnd = () => {
      endPull();
    };
    const handleTouchCancel = () => {
      resetPull();
    };

    if (supportsPointer) {
      window.addEventListener('pointerdown', handlePointerDown, { passive: true });
      window.addEventListener('pointermove', handlePointerMove, { passive: true });
      window.addEventListener('pointerup', handlePointerUp, { passive: true });
      window.addEventListener('pointercancel', handlePointerCancel, { passive: true });
      return () => {
        window.removeEventListener('pointerdown', handlePointerDown);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerCancel);
      };
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [refreshing, loadData]);

  const handleRefresh = useCallback(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const channel = supabase
      .channel('wedding-mobile-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        () => fetchPosts({ reset: true })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments' },
        () => fetchPosts({ reset: true })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reactions' },
        () => fetchPosts({ reset: true })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stories' },
        fetchStories
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPosts, fetchStories]);

  const handleReaction = async (post) => {
    const existing = post.reactions?.find(
      (reaction) => reaction.guest_id === guest.id
    );
    try {
      if (existing) {
        await supabase.from('reactions').delete().eq('id', existing.id);
        setPosts((prev) =>
          prev.map((item) =>
            item.id === post.id
              ? {
                  ...item,
                  reactions: item.reactions.filter(
                    (reaction) => reaction.id !== existing.id
                  )
                }
              : item
          )
        );
      } else {
        const { data, error } = await supabase
          .from('reactions')
          .insert({
            post_id: post.id,
            guest_id: guest.id,
            reaction_type: 'love'
          })
          .select('id, reaction_type, guest_id')
          .single();
        if (error) throw error;
        setPosts((prev) =>
          prev.map((item) =>
            item.id === post.id
              ? { ...item, reactions: [...(item.reactions || []), data] }
              : item
          )
        );
      }
    } catch (err) {
      console.error('Reaction error', err);
    }
  };

  const handleCommentAppended = (comment) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === comment.post_id
          ? { ...post, comments: [...(post.comments || []), comment] }
          : post
      )
    );
  };
  const handleCommentDeleted = (commentId, postId) => {
    if (!commentId) return;
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: (post.comments || []).filter(
                (comment) => comment.id !== commentId
              )
            }
          : post
      )
    );
  };

  const openComments = (post) => {
    setCommentsState({ visible: true, post });
  };

  const openStoryViewer = (_group, index) => {
    setStoryViewer({
      visible: true,
      groups: storyGroups,
      groupIndex: index >= 0 ? index : 0,
      storyIndex: 0
    });
  };

  const handleDeletePost = useCallback(async () => {
    if (!deleteConfirm.post) return;
    setDeleteConfirm((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', deleteConfirm.post.id);
      if (error) throw error;
      setPosts((prev) =>
        prev.filter((item) => item.id !== deleteConfirm.post.id)
      );
      await deletePostMediaFiles(deleteConfirm.post);
      closeDeleteConfirm();
      closePostActions();
    } catch (err) {
      console.error('Delete post failed', err);
      setDeleteConfirm((prev) => ({
        ...prev,
        loading: false,
        error: 'Unable to delete this post. Please try again.'
      }));
    }
  }, [
    deleteConfirm.post,
    closeDeleteConfirm,
    closePostActions,
    deletePostMediaFiles
  ]);

  const FeedHeader = () => (
    <View style={styles.header}>
      {/* Compact Title Bar */}
      <View style={styles.titleBar}>
        <View style={styles.logoSection}>
          <Text style={styles.ampersand}>&</Text>
          <View style={styles.namesColumn}>
            <Text style={styles.coupleName}>Josh & Joy</Text>
            <Text style={styles.eventTag}>Wedding Moments</Text>
          </View>
        </View>
        <Text style={styles.postCount}>{posts.length} posts</Text>
      </View>
      
      {showRsvpButton && (
        <TouchableOpacity
          style={styles.manageCard}
          onPress={onManageRsvps}
          activeOpacity={0.85}
        >
          <View style={styles.manageIcon}>
            <Text style={styles.manageIconText}>RSVP</Text>
          </View>
          <View style={styles.manageCopy}>
            <Text style={styles.manageTitle}>Manage RSVPs</Text>
            <Text style={styles.manageSubtitle}>
              Keep an eye on RSVP responses and party sizes.
            </Text>
          </View>
          <Text style={styles.manageArrow}>›</Text>
        </TouchableOpacity>
      )}

      <StoryBar
        storyGroups={storyGroups}
        onAddStory={() => onOpenComposer?.('story')}
        onOpenStory={openStoryViewer}
      />
    </View>
  );

  const FeedFooter = () => {
    if (!posts.length) return null;
    if (!hasMorePosts) {
      return (
        <View style={styles.listFooter}>
          <Text style={styles.footerText}>{'You\'re all caught up.'}</Text>
        </View>
      );
    }
    return (
      <View style={styles.listFooter}>
        {loadingMorePosts ? (
          <ActivityIndicator color={theme.accent} />
        ) : (
          <Text style={styles.footerText}>Scroll down for more moments</Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LoveQuoteLoader visible={loading} />
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            currentGuestId={guest.id}
            onReactPress={handleReaction}
            onCommentPress={openComments}
            onMediaPress={openPostViewer}
            onAuthorPress={openProfileViewer}
            onManagePost={handleManagePost}
          />
        )}
        ListHeaderComponent={FeedHeader}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={FeedFooter}
        onEndReached={handleLoadMorePosts}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.accent}
          />
        }
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <View style={styles.cameraIcon} />
              </View>
              <Text style={styles.emptyTitle}>No moments yet</Text>
              <Text style={styles.emptyText}>
                Be the first to capture and share a special moment from the celebration!
              </Text>
            </View>
          )
        }
        showsVerticalScrollIndicator={false}
      />

      <CommentsModal
        visible={commentsState.visible}
        post={commentsState.post}
        guest={guest}
        onClose={closeComments}
        onComment={handleCommentAppended}
        onCommentDeleted={handleCommentDeleted}
      />

      <Modal
        visible={postActions.visible}
        transparent
        animationType="fade"
        onRequestClose={closePostActions}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.backdropPressable} onPress={closePostActions} />
          <View style={styles.actionSheet}>
            <TouchableOpacity
              style={styles.actionSheetButton}
              onPress={() => {
                skipPostActionsHistory?.();
                setEditState({ visible: true, post: postActions.post });
                closePostActions();
              }}
            >
              <Text style={styles.actionSheetText}>Edit moment</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionSheetButton, styles.deleteButton]}
              onPress={() => {
                skipPostActionsHistory?.();
                setDeleteConfirm({
                  visible: true,
                  post: postActions.post,
                  loading: false,
                  error: ''
                });
                closePostActions();
              }}
            >
              <Text style={[styles.actionSheetText, styles.deleteText]}>
                Delete moment
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionSheetButton}
              onPress={closePostActions}
            >
              <Text style={styles.actionSheetText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={deleteConfirm.visible}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteConfirm}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.backdropPressable} onPress={closeDeleteConfirm} />
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Delete this moment?</Text>
            <Text style={styles.confirmText}>
              This action cannot be undone. Your photos and videos will be
              removed from the timeline.
            </Text>
            {deleteConfirm.error ? (
              <Text style={styles.confirmError}>{deleteConfirm.error}</Text>
            ) : null}
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={closeDeleteConfirm}
                disabled={deleteConfirm.loading}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.destructiveButton,
                  deleteConfirm.loading && styles.destructiveDisabled
                ]}
                onPress={handleDeletePost}
                disabled={deleteConfirm.loading}
              >
                {deleteConfirm.loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.destructiveText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <EditPostModal
        visible={editState.visible}
        post={editState.post}
        guest={guest}
        onClose={closeEditModal}
        onUpdated={handlePostUpdated}
      />

      <StoryViewerModal
        visible={storyViewer.visible}
        groups={storyViewer.groups}
        initialGroupIndex={storyViewer.groupIndex}
        initialStoryIndex={storyViewer.storyIndex}
        guest={guest}
        onClose={closeStoryViewer}
      />

      <PostViewerModal
        visible={postViewer.visible}
        post={postViewer.post}
        initialIndex={postViewer.index}
        onClose={closePostViewer}
      />

      <Modal
        visible={profileViewer.visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeProfileViewer}
      >
        <SafeAreaView style={styles.profileModal}>
          <View style={styles.profileModalHeader}>
            <Text style={styles.profileModalTitle}>
              {profileViewer.guest?.name || 'Guest Profile'}
            </Text>
            <TouchableOpacity
              onPress={closeProfileViewer}
              style={styles.profileModalClose}
            >
              <Text style={styles.profileModalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
          {profileViewer.guest ? (
            <ProfileScreen guest={guest} viewingGuest={profileViewer.guest} />
          ) : null}
        </SafeAreaView>
      </Modal>
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
    gap: spacing.sm
  },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  ampersand: {
    fontSize: 32,
    fontWeight: '200',
    color: theme.accent,
    fontStyle: 'italic'
  },
  namesColumn: {
    gap: 0
  },
  coupleName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    letterSpacing: 1
  },
  eventTag: {
    fontSize: 11,
    color: theme.textMuted,
    letterSpacing: 0.5
  },
  postCount: {
    fontSize: 12,
    color: theme.textMuted
  },
  manageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: theme.border,
    padding: spacing.md,
    marginBottom: spacing.sm
  },
  manageIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md
  },
  manageIconText: {
    color: theme.background,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.8
  },
  manageCopy: {
    flex: 1
  },
  manageTitle: {
    color: theme.textPrimary,
    fontSize: 16,
    fontWeight: '700'
  },
  manageSubtitle: {
    color: theme.textSecondary,
    fontSize: 13,
    marginTop: 2
  },
  manageArrow: {
    color: theme.accent,
    fontSize: 28,
    fontWeight: '300',
    marginLeft: spacing.sm
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xxl,
    marginTop: spacing.xl
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md
  },
  cameraIcon: {
    width: 24,
    height: 18,
    borderWidth: 2,
    borderColor: theme.textMuted,
    borderRadius: 4
  },
  emptyTitle: {
    color: theme.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.xs
  },
  emptyText: {
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280
  },
  listFooter: {
    paddingVertical: spacing.md,
    alignItems: 'center'
  },
  footerText: {
    color: theme.textSecondary,
    fontSize: 13
  },
  profileModal: {
    flex: 1,
    backgroundColor: theme.background
  },
  profileModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider
  },
  profileModalTitle: {
    color: theme.textPrimary,
    fontSize: 16,
    fontWeight: '600'
  },
  profileModalClose: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  profileModalCloseText: {
    color: theme.accent,
    fontWeight: '600',
    fontSize: 14
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md
  },
  backdropPressable: {
    ...StyleSheet.absoluteFillObject
  },
  actionSheet: {
    backgroundColor: theme.card,
    borderRadius: radius.xl,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: theme.border
  },
  actionSheetButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg
  },
  actionSheetText: {
    color: theme.textPrimary,
    fontSize: 15,
    textAlign: 'center'
  },
  deleteButton: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.border
  },
  deleteText: {
    color: theme.error,
    fontWeight: '600'
  },
  confirmCard: {
    backgroundColor: theme.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: theme.border
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary
  },
  confirmText: {
    color: theme.textSecondary,
    lineHeight: 20
  },
  confirmError: {
    color: theme.error,
    fontSize: 13
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm
  },
  cancelButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: theme.border
  },
  cancelText: {
    color: theme.textPrimary,
    fontWeight: '600'
  },
  destructiveButton: {
    backgroundColor: theme.error,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm
  },
  destructiveDisabled: {
    opacity: 0.7
  },
  destructiveText: {
    color: '#fff',
    fontWeight: '700'
  }
});

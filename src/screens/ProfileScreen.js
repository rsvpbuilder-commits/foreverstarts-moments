import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl
} from 'react-native';
import { supabase } from '../lib/supabase';
import { theme, spacing, radius } from '../theme/colors';
import { initialsAvatar } from '../utils/avatar';
import { IconCamera, IconVideo, IconMultiple } from '../components/Icons';
import { EditProfileModal } from '../components/EditProfileModal';
import { useGuestStore } from '../store/useGuestStore';
import { useWebBackEntry } from '../hooks/useWebBackEntry';
import { getOptimizedImageUrl } from '../utils/media';
import { PostViewerModal } from '../components/PostViewerModal';
import { OptimizedImage } from '../components/OptimizedImage';

function ProfileAvatar({ avatarUrl, name, size = 100 }) {
  const fallbackAvatar = initialsAvatar(name || 'Guest');
  
  const hasValidAvatar = avatarUrl && 
    typeof avatarUrl === 'string' && 
    avatarUrl.trim().length > 0 &&
    avatarUrl.startsWith('http');
  
  const optimizedAvatar = hasValidAvatar
    ? getOptimizedImageUrl(avatarUrl, { width: size * 2, height: size * 2, quality: 65 })
    : fallbackAvatar;
  const [uri, setUri] = useState(hasValidAvatar ? optimizedAvatar : fallbackAvatar);

  useEffect(() => {
    setUri(hasValidAvatar ? optimizedAvatar : fallbackAvatar);
  }, [fallbackAvatar, hasValidAvatar, optimizedAvatar]);
  
  return (
    <View style={[styles.avatarContainer, { width: size, height: size, borderRadius: size / 2 }]}>
      <OptimizedImage 
        source={{ uri }} 
        style={[styles.avatar, { width: size - 6, height: size - 6, borderRadius: (size - 6) / 2 }]}
        onError={() => setUri(fallbackAvatar)}
      />
    </View>
  );
}

function StatItem({ value, label }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function PostThumbnail({ post, onPress }) {
  const [imageError, setImageError] = useState(false);
  const hasMultiple = post.media_gallery?.length > 0;
  
  return (
    <TouchableOpacity 
      style={styles.thumbnail} 
      onPress={() => onPress?.(post)}
      activeOpacity={0.8}
    >
      {post.media_type === 'video' ? (
        <View style={styles.videoThumbnail}>
          <IconVideo size={24} color={theme.textPrimary} />
        </View>
      ) : !imageError ? (
        <OptimizedImage 
          source={{ uri: getOptimizedImageUrl(post.media_url, { width: 600, height: 600, quality: 65 }) || post.media_url }}
          style={styles.thumbnailImage}
          onError={() => setImageError(true)}
        />
      ) : (
        <View style={styles.errorThumbnail}>
          <IconCamera size={20} color={theme.textMuted} />
        </View>
      )}
      {hasMultiple && (
        <View style={styles.multipleIndicator}>
          <IconMultiple size={16} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function ProfileScreen({ guest, viewingGuest, onSignOut }) {
  const [posts, setPosts] = useState([]);
  const [stats, setStats] = useState({ posts: 0, wishes: 0, reactions: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [postViewer, setPostViewer] = useState({ visible: false, post: null });
  const setGuestProfile = useGuestStore((state) => state.setGuest);
  const closeEditProfile = useCallback(() => setEditVisible(false), []);
  useWebBackEntry(editVisible, closeEditProfile, 'edit-profile');
  const closePostViewer = useCallback(
    () => setPostViewer((prev) => ({ ...prev, visible: false })),
    []
  );
  const openPostViewer = useCallback((post) => {
    if (!post) return;
    setPostViewer({ visible: true, post });
  }, []);
  useWebBackEntry(postViewer.visible, closePostViewer, 'profile-post-viewer');
  
  const profileGuest = viewingGuest || guest;
  const isOwnProfile = !viewingGuest || viewingGuest.id === guest.id;

  const fetchProfileData = useCallback(async () => {
    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select(`
        id,
        media_url,
        media_type,
        caption,
        is_featured,
        moment_title,
        moment_subtitle,
        moment_icon,
        created_at,
        media_gallery:post_media (id)
      `)
      .eq('guest_id', profileGuest.id)
      .order('created_at', { ascending: false });
    
    if (!postsError) {
      setPosts(postsData || []);
    }
    
    const [wishesRes, reactionsRes] = await Promise.all([
      supabase
        .from('wishes')
        .select('id', { count: 'exact', head: true })
        .eq('guest_id', profileGuest.id),
      supabase
        .from('reactions')
        .select('id', { count: 'exact', head: true })
        .eq('guest_id', profileGuest.id)
    ]);
    
    setStats({
      posts: postsData?.length || 0,
      wishes: wishesRes.count || 0,
      reactions: reactionsRes.count || 0
    });
  }, [profileGuest.id]);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    await fetchProfileData();
    setRefreshing(false);
    setLoading(false);
  }, [fetchProfileData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleProfileUpdated = useCallback(
    (updatedProfile) => {
      if (updatedProfile && isOwnProfile) {
        setGuestProfile(updatedProfile);
      }
      closeEditProfile();
      fetchProfileData();
    },
    [closeEditProfile, fetchProfileData, isOwnProfile, setGuestProfile]
  );

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      onSignOut?.();
    } catch (err) {
      console.error('Sign out error', err);
    }
  };

  return (
    <>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadData}
            tintColor={theme.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
      {/* Profile Header */}
      <View style={styles.header}>
        <ProfileAvatar 
          avatarUrl={profileGuest.avatar_url} 
          name={profileGuest.name}
          size={90}
        />
        <Text style={styles.name}>{profileGuest.name}</Text>
        {profileGuest.email && (
          <Text style={styles.email}>{profileGuest.email}</Text>
        )}
        
        {/* Stats */}
        <View style={styles.statsRow}>
          <StatItem value={stats.posts} label="Posts" />
          <View style={styles.statDivider} />
          <StatItem value={stats.wishes} label="Wishes" />
          <View style={styles.statDivider} />
          <StatItem value={stats.reactions} label="Likes" />
        </View>
        
        {/* Actions */}
        {isOwnProfile && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setEditVisible(true)}
            >
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.signOutButton}
              onPress={handleSignOut}
            >
              <Text style={styles.signOutButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      {/* Posts Grid */}
      <View style={styles.postsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Moments</Text>
        </View>
        
        {posts.length > 0 ? (
          <View style={styles.postsGrid}>
            {posts.map((post) => (
              <PostThumbnail key={post.id} post={post} onPress={openPostViewer} />
            ))}
          </View>
        ) : (
          <View style={styles.emptyPosts}>
            <View style={styles.emptyIcon}>
              <IconCamera size={24} color={theme.textMuted} />
            </View>
            <Text style={styles.emptyText}>
              {isOwnProfile 
                ? "You haven't shared any moments yet"
                : "No moments shared yet"
              }
            </Text>
          </View>
        )}
      </View>
      </ScrollView>
      <EditProfileModal
        visible={editVisible}
        guest={profileGuest}
        onClose={closeEditProfile}
        onUpdated={handleProfileUpdated}
      />
      <PostViewerModal
        visible={postViewer.visible}
        post={postViewer.post}
        initialIndex={0}
        onClose={closePostViewer}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background
  },
  content: {
    paddingBottom: 100
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider
  },
  avatarContainer: {
    borderWidth: 2,
    borderColor: theme.accent,
    padding: 3,
    marginBottom: spacing.md
  },
  avatar: {
    backgroundColor: theme.accentMuted
  },
  name: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 2
  },
  email: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: spacing.md
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary
  },
  statLabel: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 2
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: theme.border
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  editButton: {
    backgroundColor: theme.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: theme.border
  },
  editButtonText: {
    color: theme.textPrimary,
    fontWeight: '600',
    fontSize: 13
  },
  signOutButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: theme.error
  },
  signOutButtonText: {
    color: theme.error,
    fontWeight: '600',
    fontSize: 13
  },
  postsSection: {
    padding: spacing.md
  },
  sectionHeader: {
    marginBottom: spacing.md
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2
  },
  thumbnail: {
    width: '32.8%',
    aspectRatio: 1,
    backgroundColor: theme.card,
    borderRadius: radius.sm,
    overflow: 'hidden'
  },
  thumbnailImage: {
    width: '100%',
    height: '100%'
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.cardElevated,
    alignItems: 'center',
    justifyContent: 'center'
  },
  errorThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center'
  },
  multipleIndicator: {
    position: 'absolute',
    top: 6,
    right: 6
  },
  emptyPosts: {
    alignItems: 'center',
    padding: spacing.xl
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm
  },
  emptyText: {
    color: theme.textSecondary,
    textAlign: 'center',
    fontSize: 14
  }
});

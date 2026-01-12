import { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { theme, spacing, radius } from '../theme/colors';
import { initialsAvatar } from '../utils/avatar';
import { IconComment, IconSend } from '../components/Icons';
import { OptimizedImage } from './OptimizedImage';
import { getOptimizedImageUrl } from '../utils/media';

function CommentAvatar({ guest }) {
  const guestName = guest?.name || 'Guest';
  const fallbackAvatar = initialsAvatar(guestName);
  
  const hasValidAvatar = guest?.avatar_url && 
    typeof guest.avatar_url === 'string' && 
    guest.avatar_url.trim().length > 0 &&
    guest.avatar_url.startsWith('http');
  
  const optimizedAvatar = hasValidAvatar
    ? getOptimizedImageUrl(guest.avatar_url, { width: 120, height: 120, quality: 60 })
    : fallbackAvatar;
  const [avatarUri, setAvatarUri] = useState(optimizedAvatar);

  useEffect(() => {
    setAvatarUri(optimizedAvatar);
  }, [optimizedAvatar]);
  
  return (
    <OptimizedImage 
      source={{ uri: avatarUri }} 
      style={styles.commentAvatar}
      onError={() => setAvatarUri(fallbackAvatar)}
    />
  );
}

function formatTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function CommentsModal({
  visible,
  onClose,
  post,
  guest,
  onComment,
  onCommentDeleted
}) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState(post?.comments || []);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({
    visible: false,
    comment: null,
    loading: false,
    error: ''
  });

  const postId = post?.id;

  const fetchComments = useCallback(async () => {
    if (!postId) return;
    setCommentsLoading(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(
          `
          id,
          content,
          created_at,
          post_id,
          guest:guest_id (
            id,
            name,
            avatar_url
          )
        `
        )
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setComments(data || []);
    } catch (err) {
      console.error('Failed to load comments', err);
    } finally {
      setCommentsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    setComments(post?.comments || []);
  }, [post]);

  useEffect(() => {
    if (visible) {
      fetchComments();
    }
  }, [visible, fetchComments]);

  const submitComment = async () => {
    if (!message.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: post.id,
          guest_id: guest.id,
          content: message.trim()
        })
        .select(
          `
          id,
          content,
          created_at,
          post_id,
          guest:guest_id (
            id,
            name,
            avatar_url
          )
        `
        )
        .single();
      if (error) throw error;
      setMessage('');
      setComments((prev) => [...prev, data]);
      onComment?.(data);
      await fetchComments();
    } catch (err) {
      console.error('Failed to comment', err);
    } finally {
      setLoading(false);
    }
  };

  const canDeleteComment = useCallback(
    (comment) => {
      if (!guest?.id || !comment) return false;
      if (comment.guest?.id === guest.id) return true;
      return ['bride', 'groom'].includes(guest.role);
    },
    [guest]
  );

  const requestDeleteComment = useCallback(
    (comment) => {
      if (!canDeleteComment(comment)) return;
      setDeleteConfirm({ visible: true, comment, loading: false, error: '' });
    },
    [canDeleteComment]
  );

  const closeDeleteConfirm = useCallback(() => {
    setDeleteConfirm((prev) =>
      prev.loading ? prev : { visible: false, comment: null, loading: false, error: '' }
    );
  }, []);

  const handleDeleteComment = useCallback(async () => {
    if (!deleteConfirm.comment) return;
    setDeleteConfirm((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', deleteConfirm.comment.id);
      if (error) throw error;
      setComments((prev) =>
        prev.filter((item) => item.id !== deleteConfirm.comment.id)
      );
      onCommentDeleted?.(deleteConfirm.comment.id, deleteConfirm.comment.post_id);
      setDeleteConfirm({ visible: false, comment: null, loading: false, error: '' });
    } catch (err) {
      console.error('Delete comment failed', err);
      setDeleteConfirm((prev) => ({
        ...prev,
        loading: false,
        error: 'Unable to delete this comment. Please try again.'
      }));
    }
  }, [deleteConfirm.comment, onCommentDeleted]);

  if (!post) return null;

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <SafeAreaView style={styles.container}>
          <KeyboardAvoidingView 
            style={styles.keyboardView}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerHandle} />
            <Text style={styles.title}>Comments</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Comments List */}
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const guestName = item.guest?.name || 'Guest';
              const showMenu = canDeleteComment(item);
              return (
                <View style={styles.commentRow}>
                  <CommentAvatar guest={item.guest} />
                  <View style={styles.commentContent}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentAuthor}>{guestName}</Text>
                      <View style={styles.commentHeaderMeta}>
                        <Text style={styles.commentTime}>
                          {formatTime(item.created_at)}
                        </Text>
                        {showMenu ? (
                          <TouchableOpacity
                            onPress={() => requestDeleteComment(item)}
                            style={styles.commentMenuButton}
                          >
                            <Text style={styles.commentMenuText}>⋮</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                    <Text style={styles.commentText}>{item.content}</Text>
                  </View>
                </View>
              );
            }}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              commentsLoading ? null : (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <IconComment size={28} color={theme.textMuted} />
                  </View>
                  <Text style={styles.emptyText}>No comments yet</Text>
                  <Text style={styles.emptySubtext}>Be the first to comment!</Text>
                </View>
              )
            }
          />

          {/* Input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Add a comment..."
                placeholderTextColor={theme.textMuted}
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!message.trim() || loading) && styles.sendButtonDisabled
                ]}
                onPress={submitComment}
                disabled={!message.trim() || loading}
              >
                {loading ? (
                  <Text style={styles.sendLoading}>...</Text>
                ) : (
                  <IconSend size={16} color={theme.background} />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={deleteConfirm.visible}
        onRequestClose={closeDeleteConfirm}
      >
        <View style={styles.confirmBackdrop}>
          <Pressable style={styles.confirmOverlay} onPress={closeDeleteConfirm} />
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Delete comment?</Text>
            <Text style={styles.confirmText}>
              This action cannot be undone. Remove this comment from the conversation?
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
                onPress={handleDeleteComment}
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background
  },
  keyboardView: {
    flex: 1
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider
  },
  headerHandle: {
    width: 36,
    height: 4,
    backgroundColor: theme.border,
    borderRadius: 2,
    marginBottom: spacing.sm
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary
  },
  closeButton: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.lg
  },
  closeText: {
    color: theme.accent,
    fontWeight: '600',
    fontSize: 15
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.md,
    flexGrow: 1
  },
  commentRow: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  commentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.accentMuted
  },
  commentContent: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    padding: spacing.sm,
    paddingHorizontal: spacing.md
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2
  },
  commentHeaderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textPrimary
  },
  commentTime: {
    fontSize: 11,
    color: theme.textMuted
  },
  commentText: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 19
  },
  commentDeleteButton: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2
  },
  commentMenuButton: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs
  },
  commentMenuText: {
    color: theme.textSecondary,
    fontSize: 14,
    letterSpacing: 2
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary
  },
  emptySubtext: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: spacing.xs
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.divider,
    backgroundColor: theme.backgroundSecondary
  },
  input: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: theme.textPrimary,
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: theme.border
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sendButtonDisabled: {
    backgroundColor: theme.border
  },
  sendLoading: {
    color: theme.background,
    fontSize: 14,
    fontWeight: '600'
  },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg
  },
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject
  },
  confirmCard: {
    width: '100%',
    backgroundColor: theme.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: theme.border
  },
  confirmTitle: {
    fontSize: 17,
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
    paddingHorizontal: spacing.md,
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full
  },
  destructiveDisabled: {
    opacity: 0.6
  },
  destructiveText: {
    color: '#fff',
    fontWeight: '700'
  }
});

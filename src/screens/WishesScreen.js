import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  ActivityIndicator
} from 'react-native';
import { supabase } from '../lib/supabase';
import { theme, spacing, radius } from '../theme/colors';
import { initialsAvatar } from '../utils/avatar';
import { IconHeart, IconSend } from '../components/Icons';

function WishesHeader({
  wishesCount,
  newWish,
  onChangeWish,
  onSendWish,
  sending
}) {
  const canSend = newWish.trim().length > 0 && !sending;

  return (
    <View style={styles.header}>
      <View style={styles.titleBar}>
        <View style={styles.titleSection}>
          <IconHeart size={20} color={theme.accent} filled />
          <Text style={styles.title}>Wishes & Blessings</Text>
        </View>
        <Text style={styles.wishCount}>{wishesCount} wishes</Text>
      </View>

      <Text style={styles.subtitle}>
        Share your heartfelt wishes for Josh & Joy
      </Text>

      <View style={styles.composeCard}>
        <TextInput
          style={styles.composeInput}
          placeholder="Write your wishes for the newlyweds..."
          placeholderTextColor={theme.textMuted}
          value={newWish}
          onChangeText={onChangeWish}
          multiline
          maxLength={500}
        />
        <View style={styles.composeFooter}>
          <Text style={styles.charCount}>{newWish.length}/500</Text>
          <TouchableOpacity
            style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
            onPress={onSendWish}
            disabled={!canSend}
          >
            {sending ? (
              <Text style={styles.sendButtonText}>...</Text>
            ) : (
              <View style={styles.sendButtonContent}>
                <Text style={styles.sendButtonText}>Send</Text>
                <IconSend size={14} color={theme.background} />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function WishAvatar({ guest }) {
  const guestName = guest?.name || 'Guest';
  const fallbackAvatar = initialsAvatar(guestName);
  
  const hasValidAvatar = guest?.avatar_url && 
    typeof guest.avatar_url === 'string' && 
    guest.avatar_url.trim().length > 0 &&
    guest.avatar_url.startsWith('http');
  
  const [avatarUri, setAvatarUri] = useState(
    hasValidAvatar ? guest.avatar_url : fallbackAvatar
  );
  
  return (
    <Image 
      source={{ uri: avatarUri }} 
      style={styles.wishAvatar}
      onError={() => setAvatarUri(fallbackAvatar)}
    />
  );
}

function WishCard({ wish, canDelete, onDelete }) {
  const guest = wish.guest || {};
  const guestName = guest.name || 'Guest';
  
  return (
    <View style={styles.wishCard}>
      <View style={styles.wishHeader}>
        <View style={styles.wishHeaderInfo}>
          <WishAvatar guest={guest} />
          <View style={styles.wishMeta}>
            <Text style={styles.wishAuthor}>{guestName}</Text>
            <Text style={styles.wishTime}>
              {new Date(wish.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
          </View>
        </View>
        {canDelete ? (
          <TouchableOpacity
            style={styles.wishMenuButton}
            onPress={() => onDelete?.(wish)}
          >
            <Text style={styles.wishMenuText}>⋮</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={styles.wishContent}>{wish.message}</Text>
      <View style={styles.wishDecoration}>
        <Text style={styles.wishQuote}>"</Text>
      </View>
    </View>
  );
}

export default function WishesScreen({ guest }) {
  const [wishes, setWishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newWish, setNewWish] = useState('');
  const [sending, setSending] = useState(false);
  const [deleteState, setDeleteState] = useState({
    visible: false,
    wish: null,
    loading: false,
    error: ''
  });

  const fetchWishes = useCallback(async () => {
    const { data, error } = await supabase
      .from('wishes')
      .select(`
        id,
        message,
        created_at,
        guest:guest_id (
          id,
          name,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) {
      console.error('Wishes load error', error);
      return;
    }
    setWishes(data || []);
  }, []);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    await fetchWishes();
    setRefreshing(false);
    setLoading(false);
  }, [fetchWishes]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const channel = supabase
      .channel('wedding-wishes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wishes' },
        fetchWishes
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchWishes]);

  const sendWish = async () => {
    if (!newWish.trim() || sending) return;
    
    setSending(true);
    try {
      const { error } = await supabase
        .from('wishes')
        .insert({
          guest_id: guest.id,
          message: newWish.trim()
        });
      
      if (error) throw error;
      setNewWish('');
      await fetchWishes();
    } catch (err) {
      console.error('Failed to send wish', err);
    } finally {
      setSending(false);
    }
  };

  const canDeleteWish = useCallback(
    (wish) => {
      if (!guest?.id || !wish) return false;
      if (wish.guest?.id === guest.id) return true;
      return ['bride', 'groom'].includes(guest.role);
    },
    [guest]
  );

  const requestDeleteWish = useCallback(
    (wish) => {
      if (!canDeleteWish(wish)) return;
      setDeleteState({ visible: true, wish, loading: false, error: '' });
    },
    [canDeleteWish]
  );

  const closeDeleteWish = useCallback(() => {
    setDeleteState((prev) =>
      prev.loading ? prev : { visible: false, wish: null, loading: false, error: '' }
    );
  }, []);

  const handleDeleteWish = useCallback(async () => {
    if (!deleteState.wish) return;
    setDeleteState((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const { error } = await supabase
        .from('wishes')
        .delete()
        .eq('id', deleteState.wish.id);
      if (error) throw error;
      setWishes((prev) => prev.filter((wish) => wish.id !== deleteState.wish.id));
      setDeleteState({ visible: false, wish: null, loading: false, error: '' });
    } catch (err) {
      console.error('Delete wish failed', err);
      setDeleteState((prev) => ({
        ...prev,
        loading: false,
        error: 'Unable to delete this wish. Please try again.'
      }));
    }
  }, [deleteState.wish]);

  return (
    <>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={wishes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <WishCard
              wish={item}
              canDelete={canDeleteWish(item)}
              onDelete={requestDeleteWish}
            />
          )}
          ListHeaderComponent={
            <WishesHeader
              wishesCount={wishes.length}
              newWish={newWish}
              onChangeWish={setNewWish}
              onSendWish={sendWish}
              sending={sending}
            />
          }
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={loadData}
              tintColor={theme.accent}
            />
          }
          ListEmptyComponent={
            !loading && (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <IconHeart size={28} color={theme.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>No wishes yet</Text>
                <Text style={styles.emptyText}>
                  Be the first to send your blessings to the happy couple!
                </Text>
              </View>
            )
          }
          showsVerticalScrollIndicator={false}
        />
      </KeyboardAvoidingView>

      <Modal
        transparent
        animationType="fade"
        visible={deleteState.visible}
        onRequestClose={closeDeleteWish}
      >
        <View style={styles.confirmBackdrop}>
          <Pressable style={styles.confirmOverlay} onPress={closeDeleteWish} />
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Delete wish?</Text>
            <Text style={styles.confirmText}>
              This will remove the message from the list. Are you sure?
            </Text>
            {deleteState.error ? (
              <Text style={styles.confirmError}>{deleteState.error}</Text>
            ) : null}
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={closeDeleteWish}
                disabled={deleteState.loading}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.destructiveButton,
                  deleteState.loading && styles.destructiveDisabled
                ]}
                onPress={handleDeleteWish}
                disabled={deleteState.loading}
              >
                {deleteState.loading ? (
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
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 100,
    gap: spacing.md
  },
  header: {
    gap: spacing.md,
    paddingTop: spacing.sm
  },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary
  },
  wishCount: {
    fontSize: 12,
    color: theme.textMuted
  },
  subtitle: {
    fontSize: 13,
    color: theme.textSecondary
  },
  composeCard: {
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: theme.border
  },
  composeInput: {
    color: theme.textPrimary,
    fontSize: 15,
    minHeight: 72,
    textAlignVertical: 'top'
  },
  composeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.divider
  },
  charCount: {
    fontSize: 12,
    color: theme.textMuted
  },
  sendButton: {
    backgroundColor: theme.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full
  },
  sendButtonDisabled: {
    opacity: 0.5
  },
  sendButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  sendButtonText: {
    color: theme.background,
    fontWeight: '600',
    fontSize: 13
  },
  wishCard: {
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: theme.border,
    position: 'relative',
    overflow: 'hidden'
  },
  wishHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm
  },
  wishHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1
  },
  wishAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.accentMuted
  },
  wishMeta: {
    flex: 1
  },
  wishAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary
  },
  wishTime: {
    fontSize: 11,
    color: theme.textMuted
  },
  wishContent: {
    fontSize: 15,
    color: theme.textPrimary,
    lineHeight: 22,
    fontStyle: 'italic'
  },
  wishDecoration: {
    position: 'absolute',
    top: -8,
    right: 8,
    opacity: 0.08
  },
  wishQuote: {
    fontSize: 72,
    color: theme.accent,
    fontFamily: 'serif'
  },
  wishMenuButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  wishMenuText: {
    color: theme.textSecondary,
    fontWeight: '600',
    letterSpacing: 2
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xxl,
    marginTop: spacing.lg
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md
  },
  emptyTitle: {
    color: theme.textPrimary,
    fontSize: 17,
    fontWeight: '600',
    marginBottom: spacing.xs
  },
  emptyText: {
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260
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

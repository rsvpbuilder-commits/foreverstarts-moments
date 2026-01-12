import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme, spacing, radius } from '../theme/colors';
import { supabase } from '../lib/supabase';

export function EditPostModal({ visible, post, guest, onClose, onUpdated }) {
  const [caption, setCaption] = useState('');
  const [isFeaturedMoment, setIsFeaturedMoment] = useState(false);
  const [momentTitle, setMomentTitle] = useState('');
  const [momentSubtitle, setMomentSubtitle] = useState('');
  const [momentIcon, setMomentIcon] = useState('');
  const [momentDate, setMomentDate] = useState('');
  const [momentDateInput, setMomentDateInput] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isCouple = ['bride', 'groom'].includes(guest?.role);
  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    if (visible && post) {
      setCaption(post.caption || '');
      setIsFeaturedMoment(!!post.is_featured);
      setMomentTitle(post.moment_title || '');
      setMomentSubtitle(post.moment_subtitle || '');
      setMomentIcon(post.moment_icon || '');
      const iso = post.created_at
        ? new Date(post.created_at).toISOString().slice(0, 10)
        : '';
      setMomentDate(iso);
      setMomentDateInput(iso);
      setError('');
      setShowDatePicker(false);
    } else if (!visible) {
      setShowDatePicker(false);
    }
  }, [visible, post]);

  const displayDate = momentDate
    ? new Date(momentDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    : 'Select date';

  const handleDatePickerChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      if (event.type === 'dismissed') {
        setShowDatePicker(false);
        return;
      }
      setShowDatePicker(false);
    }
    if (selectedDate) {
      const iso = selectedDate.toISOString().slice(0, 10);
      setMomentDate(iso);
      setMomentDateInput(iso);
    }
  };

  const handleWebDateInputChange = (value) => {
    const sanitized = value.replace(/[^\d-]/g, '').slice(0, 10);
    setMomentDateInput(sanitized);
    if (!sanitized) {
      setMomentDate('');
      return;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(sanitized)) {
      setMomentDate(sanitized);
    }
  };

  const handleSave = async () => {
    if (!post) return;
    if (!caption.trim()) {
      setError('Caption cannot be empty.');
      return;
    }
    const wantsFeaturedMoment = isCouple && isFeaturedMoment;
    let customCreatedAt = null;
    if (momentDate.trim()) {
      const parsedDate = new Date(momentDate);
      if (Number.isNaN(parsedDate.getTime())) {
        setError('Moment date must be a valid date (e.g., 2017-01-12).');
        return;
      }
      customCreatedAt = parsedDate.toISOString();
    }
    if (wantsFeaturedMoment) {
      if (!momentTitle.trim()) {
        setError('Please add a title for this featured moment.');
        return;
      }
      if (!customCreatedAt) {
        setError('Please provide the date for this highlighted moment.');
        return;
      }
    }

    const payload = {
      caption: caption.trim(),
      is_featured: wantsFeaturedMoment,
      moment_title: wantsFeaturedMoment ? momentTitle.trim() : null,
      moment_subtitle: wantsFeaturedMoment ? momentSubtitle.trim() : null,
      moment_icon: wantsFeaturedMoment ? momentIcon.trim() : null
    };
    if (customCreatedAt) {
      payload.created_at = customCreatedAt;
    }

    setLoading(true);
    setError('');
    try {
      const { data, error: updateError } = await supabase
        .from('posts')
        .update(payload)
        .eq('id', post.id)
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
        .single();
      if (updateError) throw updateError;
      onUpdated?.(data);
      onClose?.();
    } catch (err) {
      console.error('Post update failed', err);
      setError('Could not update the post. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!post) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Edit Moment</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.label}>Caption</Text>
          <TextInput
            style={styles.captionInput}
            multiline
            value={caption}
            onChangeText={setCaption}
            placeholder="Update your caption..."
            placeholderTextColor={theme.textMuted}
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={styles.helperText}>{caption.length}/500</Text>

          {isCouple && (
            <>
              <Text style={styles.label}>Moment Date</Text>
              <View style={styles.dateRow}>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowDatePicker((prev) => !prev)}
                >
                  <Text
                    style={[
                      styles.dateText,
                      !momentDate && styles.datePlaceholder
                    ]}
                  >
                    {displayDate}
                  </Text>
                </TouchableOpacity>
                {momentDate ? (
                  <TouchableOpacity
                    style={styles.clearDate}
                    onPress={() => {
                      setMomentDate('');
                      setMomentDateInput('');
                      setShowDatePicker(false);
                    }}
                  >
                    <Text style={styles.clearText}>Clear</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {showDatePicker && (
                <View style={styles.datePickerWrapper}>
                  {isWeb ? (
                    <TextInput
                      value={momentDateInput}
                      onChangeText={handleWebDateInputChange}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={theme.textMuted}
                      autoCorrect={false}
                      autoCapitalize="none"
                      keyboardType="numbers-and-punctuation"
                      maxLength={10}
                      style={styles.webDateInput}
                    />
                  ) : (
                    <DateTimePicker
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                      value={momentDate ? new Date(momentDate) : new Date()}
                      onChange={handleDatePickerChange}
                      maximumDate={new Date()}
                    />
                  )}
                </View>
              )}

              <View style={styles.featuredToggleRow}>
                <Text style={styles.label}>Timeline Highlight</Text>
                <Switch
                  value={isFeaturedMoment}
                  onValueChange={setIsFeaturedMoment}
                  trackColor={{ false: theme.border, true: theme.accent }}
                  thumbColor={isFeaturedMoment ? theme.background : '#fff'}
                />
              </View>

              {isFeaturedMoment && (
                <View style={styles.featuredForm}>
                  <Text style={styles.label}>Moment Title</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="First Date, Proposal, etc."
                    placeholderTextColor={theme.textMuted}
                    value={momentTitle}
                    onChangeText={setMomentTitle}
                    maxLength={80}
                  />
                  <Text style={styles.label}>Moment Subtitle</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Optional details"
                    placeholderTextColor={theme.textMuted}
                    value={momentSubtitle}
                    onChangeText={setMomentSubtitle}
                    maxLength={120}
                  />
                  <Text style={styles.label}>Icon / Emoji (optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Add an emoji or leave blank"
                    placeholderTextColor={theme.textMuted}
                    value={momentIcon}
                    onChangeText={setMomentIcon}
                    maxLength={4}
                  />
                </View>
              )}
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <Text style={styles.saveText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.textPrimary
  },
  closeButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  closeText: {
    color: theme.accent,
    fontWeight: '600',
    fontSize: 14
  },
  content: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.sm
  },
  label: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  captionInput: {
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.border,
    padding: spacing.md,
    color: theme.textPrimary,
    minHeight: 120
  },
  helperText: {
    color: theme.textMuted,
    fontSize: 11,
    textAlign: 'right'
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  dateButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card
  },
  dateText: {
    color: theme.textPrimary,
    fontSize: 14,
    fontWeight: '500'
  },
  datePlaceholder: {
    color: theme.textMuted
  },
  clearDate: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  clearText: {
    color: theme.accent,
    fontWeight: '600'
  },
  datePickerWrapper: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: theme.card
  },
  webDateInput: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: theme.textPrimary,
    fontSize: 14
  },
  featuredToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm
  },
  featuredForm: {
    gap: spacing.sm
  },
  input: {
    backgroundColor: theme.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    padding: spacing.md,
    color: theme.textPrimary
  },
  error: {
    color: theme.error,
    textAlign: 'center',
    fontSize: 13
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.divider
  },
  saveButton: {
    backgroundColor: theme.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    alignItems: 'center'
  },
  saveButtonDisabled: {
    opacity: 0.6
  },
  saveText: {
    color: theme.background,
    fontSize: 15,
    fontWeight: '600'
  }
});

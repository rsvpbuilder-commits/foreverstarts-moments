import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Switch,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { uploadMediaAsync } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { theme, spacing, radius } from '../theme/colors';
import { IconCamera, IconImage, IconClose, IconVideo } from '../components/Icons';

const isVideoAsset = (asset) =>
  asset?.type === 'video' ||
  (typeof asset?.mimeType === 'string' && asset.mimeType.startsWith('video'));

function InlineVideoPreview({
  uri,
  style,
  showControls = false,
  loop = true,
  muted = true,
  pointerEvents = 'auto'
}) {
  const player = useVideoPlayer(uri ?? null, (playerInstance) => {
    playerInstance.loop = loop;
    playerInstance.muted = muted;
  });

  return (
      <VideoView
        style={style}
        player={player}
        nativeControls={showControls}
        fullscreenOptions={{ enabled: showControls }}
        contentFit="cover"
        pointerEvents={pointerEvents}
      />
  );
}

export function ComposerModal({
  visible,
  onClose,
  guest,
  type = 'post',
  onUploaded,
  onUploadStateChange
}) {
  const [assets, setAssets] = useState([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isFeaturedMoment, setIsFeaturedMoment] = useState(false);
  const [momentTitle, setMomentTitle] = useState('');
  const [momentSubtitle, setMomentSubtitle] = useState('');
  const [momentIcon, setMomentIcon] = useState('');
  const isWeb = Platform.OS === 'web';
  const [momentDate, setMomentDate] = useState('');
  const [momentDateInput, setMomentDateInput] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const currentAsset = assets[coverIndex];
  const isCurrentVideo = isVideoAsset(currentAsset);
  const isCouple = ['bride', 'groom'].includes(guest?.role);
  const canConfigureMoment = type === 'post' && isCouple;
  
  useEffect(() => {
    if (coverIndex >= assets.length) {
      setCoverIndex(assets.length ? assets.length - 1 : 0);
    }
  }, [assets.length, coverIndex]);

  const pickMedia = async (source = 'library') => {
    setError('');
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Permission denied. Please allow access to continue.');
      return;
    }

    const picker =
      source === 'camera'
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync;

    const result = await picker({
      mediaTypes: ['images', 'videos'],
      allowsEditing: source === 'camera',
      quality: 0.9,
      videoMaxDuration: 60,
      allowsMultipleSelection: source === 'library'
    });

    if (!result.canceled && result.assets?.length) {
      setAssets((prev) => [...prev, ...result.assets]);
    }
  };

  const updateMomentDate = (value) => {
    setMomentDate(value);
    setMomentDateInput(value);
  };

  const resetState = () => {
    setAssets([]);
    setCaption('');
    setError('');
    setIsFeaturedMoment(false);
    setMomentTitle('');
    setMomentSubtitle('');
    setMomentIcon('');
    updateMomentDate('');
    setShowDatePicker(false);
  };

  const removeAsset = (index) => {
    setAssets((prev) => prev.filter((_, idx) => idx !== index));
    setCoverIndex((prev) => {
      if (index === prev) {
        return 0;
      }
      if (index < prev) {
        return Math.max(0, prev - 1);
      }
      return prev;
    });
  };

  useEffect(() => {
    if (type !== 'post' && isFeaturedMoment) {
      setIsFeaturedMoment(false);
      setMomentTitle('');
      setMomentSubtitle('');
      setMomentIcon('');
      updateMomentDate('');
    } else if (type !== 'post') {
      updateMomentDate('');
      setShowDatePicker(false);
    }
  }, [type, isFeaturedMoment]);

  const handleFeaturedToggle = (value) => {
    setIsFeaturedMoment(value);
    if (value && !momentDate) {
      updateMomentDate(new Date().toISOString().slice(0, 10));
    }
    if (!value) {
      setMomentTitle('');
      setMomentSubtitle('');
      setMomentIcon('');
    }
  };

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
      updateMomentDate(iso);
    }
  };

  const handleWebDateInputChange = (value) => {
    const sanitized = value.replace(/[^\d-]/g, '').slice(0, 10);
    setMomentDateInput(sanitized);
    if (!sanitized) {
      updateMomentDate('');
      return;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(sanitized)) {
      setMomentDate(sanitized);
    }
  };

  const handleUpload = async () => {
    if (!assets.length) {
      setError('Please select at least one photo or video.');
      return;
    }
    const wantsFeaturedMoment = canConfigureMoment && isFeaturedMoment;
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
        setError('Please provide the exact date for this highlighted moment.');
        return;
      }
    }
    const orderedAssets = [
      assets[coverIndex],
      ...assets.filter((_, idx) => idx !== coverIndex)
    ];

    setLoading(true);
    setError('');
    onUploadStateChange?.({
      state: 'starting',
      total: orderedAssets.length,
      current: 0,
      type
    });
    if (visible) {
      onClose?.();
    }

    try {
      const uploadedMedia = [];

      for (let index = 0; index < orderedAssets.length; index++) {
        const media = orderedAssets[index];
        onUploadStateChange?.({
          state: 'progress',
          total: orderedAssets.length,
          current: index + 1,
          type
        });
        const resolvedMimeType =
          media.mimeType || (isVideoAsset(media) ? 'video/mp4' : 'image/jpeg');
        const mediaUrl = await uploadMediaAsync({
          uri: media.uri,
          folder: type === 'story' ? 'stories' : 'posts',
          guestId: guest.id,
          mimeType: resolvedMimeType
        });
        const record = {
          media_url: mediaUrl,
          media_type: media.type === 'video' ? 'video' : 'image'
        };
        uploadedMedia.push(record);

        if (type === 'story') {
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          const { error: storyError } = await supabase.from('stories').insert({
            guest_id: guest.id,
            media_url: record.media_url,
            media_type: record.media_type,
            expires_at: expiresAt
          });
          if (storyError) throw storyError;
        }
      }

      if (type === 'post') {
        const [primary, ...rest] = uploadedMedia;
        const featuredPayload =
          wantsFeaturedMoment
            ? {
                is_featured: true,
                moment_title: momentTitle.trim(),
                moment_subtitle: momentSubtitle.trim() || null,
                moment_icon: momentIcon.trim() || null
              }
            : {};
        const { data: postData, error: postError } = await supabase
          .from('posts')
          .insert({
            guest_id: guest.id,
            media_url: primary.media_url,
            media_type: primary.media_type,
            caption: caption.trim() || null,
            ...(customCreatedAt ? { created_at: customCreatedAt } : {}),
            ...featuredPayload
          })
          .select('id')
          .single();
        if (postError) throw postError;

        if (rest.length) {
          const galleryPayload = rest.map((item) => ({
            post_id: postData.id,
            media_url: item.media_url,
            media_type: item.media_type
          }));
          const { error: galleryError } = await supabase
            .from('post_media')
            .insert(galleryPayload);
          if (galleryError) throw galleryError;
        }
      }

      resetState();
      onUploaded?.();
      onUploadStateChange?.({
        state: 'success',
        total: orderedAssets.length,
        current: orderedAssets.length,
        type
      });
    } catch (err) {
      console.error('Upload failed', err);
      setError('Upload failed. Please try again.');
      onUploadStateChange?.({
        state: 'error',
        message: 'Upload failed. Please try again.',
        type
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerHandle} />
          <Text style={styles.title}>
            {type === 'story' ? 'Add to Story' : 'Share a Moment'}
          </Text>
          <TouchableOpacity 
            onPress={() => { resetState(); onClose(); }}
            style={styles.closeButton}
          >
            <Text style={styles.closeText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Media Preview */}
          <View style={styles.mediaPreview}>
            {assets.length ? (
              <>
                {isCurrentVideo && currentAsset?.uri ? (
                  <View style={styles.videoPreview}>
                    <InlineVideoPreview
                      uri={currentAsset.uri}
                      style={styles.previewVideo}
                      showControls
                    />
                    <View style={styles.videoBadge}>
                      <IconVideo size={22} color="#fff" />
                    </View>
                  </View>
                ) : (
                  <Image
                    source={{ uri: currentAsset?.uri }}
                    style={styles.previewImage}
                  />
                )}
                {assets.length > 1 && (
                  <View style={styles.multiBadge}>
                    <Text style={styles.multiBadgeText}>
                      {coverIndex + 1} / {assets.length}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.placeholderContent}>
                <View style={styles.placeholderIcon}>
                  <IconCamera size={32} color={theme.textMuted} />
                </View>
                <Text style={styles.placeholderText}>
                  Add photos or videos to share
                </Text>
              </View>
            )}
          </View>

          {/* Thumbnails */}
          {assets.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbRow}
            >
              {assets.map((media, index) => {
                const assetIsVideo = isVideoAsset(media);
                return (
                  <TouchableOpacity
                    key={`${media.uri}-${index}`}
                    style={[
                      styles.thumbWrapper,
                      index === coverIndex && styles.thumbSelected
                    ]}
                    onPress={() => setCoverIndex(index)}
                    activeOpacity={0.8}
                  >
                    {assetIsVideo && media?.uri ? (
                      <View style={styles.thumbVideoWrapper}>
                        <InlineVideoPreview
                          uri={media.uri}
                          style={styles.thumbVideo}
                          pointerEvents="none"
                          loop={false}
                          showControls={false}
                        />
                        <View style={styles.videoBadgeSmall}>
                          <IconVideo size={16} color="#fff" />
                        </View>
                      </View>
                    ) : (
                      <Image
                        source={{ uri: media.uri }}
                        style={styles.thumbImage}
                      />
                    )}
                    <TouchableOpacity
                      style={styles.thumbRemove}
                      onPress={() => removeAsset(index)}
                    >
                      <IconClose size={12} color="#fff" strokeWidth={2} />
                    </TouchableOpacity>
                    {index === coverIndex && (
                      <View style={styles.coverLabel}>
                        <Text style={styles.coverLabelText}>Cover</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Media Pickers */}
          <View style={styles.pickerRow}>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => pickMedia('camera')}
              activeOpacity={0.7}
            >
              <IconCamera size={22} color={theme.textPrimary} />
              <Text style={styles.pickerText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => pickMedia('library')}
              activeOpacity={0.7}
            >
              <IconImage size={22} color={theme.textPrimary} />
              <Text style={styles.pickerText}>Gallery</Text>
            </TouchableOpacity>
          </View>

          {/* Caption */}
          {type === 'post' && (
            <View style={styles.captionContainer}>
              <Text style={styles.captionLabel}>Caption</Text>
              <TextInput
                placeholder="Write a caption for your moment..."
                placeholderTextColor={theme.textMuted}
                style={styles.captionInput}
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={500}
              />
              <Text style={styles.charCount}>{caption.length}/500</Text>
            </View>
          )}

          {isCouple && type === 'post' && (
            <View style={styles.dateSection}>
              <Text style={styles.captionLabel}>Moment Date</Text>
              <View style={styles.datePickerRow}>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setShowDatePicker((prev) => !prev)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.datePickerText,
                      !momentDate && styles.datePickerPlaceholder
                    ]}
                  >
                    {displayDate}
                  </Text>
                </TouchableOpacity>
                {momentDate ? (
                  <TouchableOpacity
                    style={styles.clearDateButton}
                    onPress={() => {
                      updateMomentDate('');
                      setShowDatePicker(false);
                    }}
                  >
                    <Text style={styles.clearDateText}>Clear</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {showDatePicker && (
                <View style={styles.nativePickerWrapper}>
                  {isWeb ? (
                    <TextInput
                      value={momentDateInput}
                      onChangeText={handleWebDateInputChange}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={theme.textMuted}
                      maxLength={10}
                      autoCorrect={false}
                      autoCapitalize="none"
                      keyboardType="numbers-and-punctuation"
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
              <Text style={styles.dateHelper}>
                Set this to backdate a post (e.g., your first date). Leave blank
                to use today. Required for timeline highlights.
              </Text>
            </View>
          )}

          {canConfigureMoment && (
            <View style={styles.featuredSection}>
              <View style={styles.featuredHeader}>
                <View style={styles.featuredHeaderText}>
                  <Text style={styles.featuredTitle}>Timeline Highlight</Text>
                  <Text style={styles.featuredSubtitle}>
                    Spotlights appear at the top of the feed for your love story.
                  </Text>
                </View>
                <View style={styles.featuredToggle}>
                  <Switch
                    value={isFeaturedMoment}
                    onValueChange={handleFeaturedToggle}
                    trackColor={{ false: theme.border, true: theme.accent }}
                    thumbColor={isFeaturedMoment ? theme.background : '#fff'}
                  />
                </View>
              </View>
              {isFeaturedMoment && (
                <View style={styles.featuredForm}>
                  <View style={styles.featuredInputGroup}>
                    <Text style={styles.captionLabel}>Moment Title</Text>
                    <TextInput
                      style={styles.featuredInput}
                      placeholder="First Date, Proposal, etc."
                      placeholderTextColor={theme.textMuted}
                      value={momentTitle}
                      onChangeText={setMomentTitle}
                      maxLength={80}
                    />
                  </View>
                  <View style={styles.featuredInputGroup}>
                    <Text style={styles.captionLabel}>Moment Subtitle</Text>
                    <TextInput
                      style={styles.featuredInput}
                      placeholder="Optional details to add context"
                      placeholderTextColor={theme.textMuted}
                      value={momentSubtitle}
                      onChangeText={setMomentSubtitle}
                      maxLength={120}
                    />
                  </View>
                  <View style={styles.featuredRow}>
                    <View style={styles.featuredIconField}>
                      <Text style={styles.captionLabel}>Icon / Emoji (optional)</Text>
                      <TextInput
                        style={styles.featuredInput}
                        placeholder="Add an emoji or leave blank"
                        placeholderTextColor={theme.textMuted}
                        value={momentIcon}
                        onChangeText={setMomentIcon}
                        maxLength={4}
                      />
                    </View>
                  </View>
                  <Text style={styles.featuredHint}>
                    Only bride & groom accounts can set featured timeline
                    moments and backdate them for the love story.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Error */}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.shareButton,
              (!assets.length || loading) && styles.shareButtonDisabled
            ]}
            onPress={handleUpload}
            disabled={!assets.length || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <Text style={styles.shareText}>
                {type === 'story' ? 'Share to Story' : 'Share Moment'}
              </Text>
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
    color: theme.textPrimary,
    fontSize: 17,
    fontWeight: '600'
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
  content: {
    flex: 1
  },
  contentContainer: {
    padding: spacing.md,
    gap: spacing.lg
  },
  mediaPreview: {
    height: 280,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  },
  previewImage: {
    width: '100%',
    height: '100%'
  },
  previewVideo: {
    width: '100%',
    height: '100%'
  },
  videoPreview: {
    width: '100%',
    height: '100%',
    position: 'relative'
  },
  videoBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: radius.full,
    padding: spacing.xs
  },
  placeholderContent: {
    alignItems: 'center',
    gap: spacing.md
  },
  placeholderIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.cardElevated,
    alignItems: 'center',
    justifyContent: 'center'
  },
  placeholderText: {
    color: theme.textSecondary,
    fontSize: 14
  },
  multiBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4
  },
  multiBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600'
  },
  thumbRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs
  },
  thumbWrapper: {
    width: 68,
    height: 68,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent'
  },
  thumbSelected: {
    borderColor: theme.accent
  },
  thumbImage: {
    width: '100%',
    height: '100%'
  },
  thumbVideoWrapper: {
    width: '100%',
    height: '100%',
    borderRadius: radius.md,
    overflow: 'hidden'
  },
  thumbVideo: {
    width: '100%',
    height: '100%'
  },
  videoBadgeSmall: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  thumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  coverLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.accent,
    paddingVertical: 2
  },
  coverLabelText: {
    color: theme.background,
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center'
  },
  pickerRow: {
    flexDirection: 'row',
    gap: spacing.md
  },
  pickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border
  },
  pickerText: {
    color: theme.textPrimary,
    fontWeight: '500',
    fontSize: 14
  },
  captionContainer: {
    gap: spacing.xs
  },
  captionLabel: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginLeft: spacing.xs
  },
  captionInput: {
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.border,
    padding: spacing.md,
    color: theme.textPrimary,
    fontSize: 15,
    minHeight: 90,
    textAlignVertical: 'top'
  },
  charCount: {
    color: theme.textMuted,
    fontSize: 11,
    textAlign: 'right'
  },
  featuredSection: {
    gap: spacing.sm,
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: theme.border
  },
  featuredHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm
  },
  featuredHeaderText: {
    flex: 1
  },
  featuredTitle: {
    color: theme.textPrimary,
    fontSize: 15,
    fontWeight: '600'
  },
  featuredSubtitle: {
    color: theme.textMuted,
    fontSize: 12,
    marginTop: 2
  },
  featuredForm: {
    gap: spacing.sm
  },
  featuredToggle: {
    paddingVertical: spacing.xs,
    paddingLeft: spacing.sm,
    alignSelf: 'stretch',
    justifyContent: 'center'
  },
  featuredInputGroup: {
    gap: spacing.xs
  },
  featuredInput: {
    backgroundColor: theme.cardElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    padding: spacing.md,
    color: theme.textPrimary,
    fontSize: 14
  },
  featuredRow: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  featuredIconField: {
    flex: 1
  },
  featuredHint: {
    fontSize: 11,
    color: theme.textMuted,
    lineHeight: 16
  },
  dateSection: {
    gap: spacing.xs
  },
  dateHelper: {
    fontSize: 12,
    color: theme.textMuted,
    lineHeight: 18
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  datePickerButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card
  },
  datePickerText: {
    color: theme.textPrimary,
    fontSize: 14,
    fontWeight: '500'
  },
  datePickerPlaceholder: {
    color: theme.textMuted,
    fontWeight: '400'
  },
  clearDateButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  clearDateText: {
    color: theme.accent,
    fontWeight: '600',
    fontSize: 13
  },
  nativePickerWrapper: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: theme.card
  },
  webDateInput: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    color: theme.textPrimary,
    fontSize: 14,
    fontWeight: '500'
  },
  error: {
    color: theme.error,
    fontSize: 13,
    textAlign: 'center'
  },
  footer: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.divider
  },
  shareButton: {
    backgroundColor: theme.accent,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center'
  },
  shareButtonDisabled: {
    opacity: 0.5
  },
  shareText: {
    color: theme.background,
    fontSize: 15,
    fontWeight: '600'
  }
});

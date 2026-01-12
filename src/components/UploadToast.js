import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { theme, spacing, radius } from '../theme/colors';
import { IconCheck, IconClose } from './Icons';

export function UploadToast({
  visible,
  status = 'idle',
  current = 0,
  total = 0,
  type = 'post',
  message,
  onDismiss
}) {
  if (!visible) return null;

  const isUploading = status === 'uploading';
  const isSuccess = status === 'success';
  const isError = status === 'error';

  const resolvedMessage =
    message ||
    (isUploading
      ? `Sharing your ${type === 'story' ? 'story' : 'moment'}...`
      : isSuccess
      ? 'Shared successfully!'
      : 'Upload failed. Please try again.');

  const progressText =
    isUploading && total
      ? `${current}/${total} media uploaded`
      : null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View
        style={[
          styles.toast,
          isSuccess && styles.toastSuccess,
          isError && styles.toastError
        ]}
      >
        <View style={[
          styles.iconWrapper,
          isSuccess && styles.iconSuccess,
          isError && styles.iconError
        ]}>
          {isUploading ? (
            <ActivityIndicator color={theme.accent} size="small" />
          ) : isSuccess ? (
            <IconCheck size={16} color={theme.background} />
          ) : (
            <Text style={styles.errorIcon}>!</Text>
          )}
        </View>
        <View style={styles.textWrapper}>
          <Text style={styles.message}>{resolvedMessage}</Text>
          {progressText && <Text style={styles.progress}>{progressText}</Text>}
        </View>
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
            <IconClose size={14} color={theme.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 100,
    paddingHorizontal: spacing.md
  },
  toast: {
    backgroundColor: theme.cardElevated,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8
  },
  toastSuccess: {
    borderColor: theme.accent
  },
  toastError: {
    borderColor: theme.error
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconSuccess: {
    backgroundColor: theme.accent
  },
  iconError: {
    backgroundColor: theme.error
  },
  errorIcon: {
    color: theme.background,
    fontWeight: '700',
    fontSize: 16
  },
  textWrapper: {
    flex: 1
  },
  message: {
    color: theme.textPrimary,
    fontWeight: '600',
    fontSize: 14
  },
  progress: {
    color: theme.textSecondary,
    fontSize: 12,
    marginTop: 2
  },
  dismissButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center'
  }
});

import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { theme, spacing, radius } from '../theme/colors';
import { uploadMediaAsync } from '../lib/storage';
import { upsertGuestProfile } from '../lib/guestProfiles';
import { supabase } from '../lib/supabase';

export function EditProfileModal({ visible, guest, onClose, onUpdated }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatarAsset, setAvatarAsset] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (guest && visible) {
      setFullName(guest.name || '');
      setEmail(guest.email || '');
      setPassword('');
      setAvatarAsset(null);
      setAvatarPreview(guest.avatar_url || '');
      setError('');
    }
  }, [guest, visible]);

  const pickAvatar = async () => {
    setError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Media permissions are required to update your photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.9
    });
    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];
      setAvatarAsset(asset);
      setAvatarPreview(asset.uri);
    }
  };

  const handleSave = async () => {
    if (!guest?.id) return;
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      setError('Please enter your full name.');
      return;
    }
    if (!trimmedEmail) {
      setError('Please enter your email.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      let avatarUrl = guest.avatar_url || '';
      if (avatarAsset?.uri) {
        avatarUrl = await uploadMediaAsync({
          uri: avatarAsset.uri,
          folder: 'avatars',
          guestId: guest.id,
          mimeType: avatarAsset.mimeType || 'image/jpeg'
        });
      }

      const authUpdates = {};
      if (trimmedEmail !== guest.email) {
        authUpdates.email = trimmedEmail;
      }
      if (password.trim()) {
        authUpdates.password = password.trim();
      }
      if (Object.keys(authUpdates).length) {
        const { error: authError } = await supabase.auth.updateUser(authUpdates);
        if (authError) throw authError;
      }

      const updatedProfile = await upsertGuestProfile({
        id: guest.id,
        name: trimmedName,
        email: trimmedEmail,
        avatarUrl
      });

      onUpdated?.(updatedProfile);
    } catch (err) {
      setError(err.message || 'Failed to update profile. Please try again.');
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
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.avatarSection}>
            {avatarPreview ? (
              <Image source={{ uri: avatarPreview }} style={styles.avatarPreview} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {(guest?.name || 'G').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.avatarButton} onPress={pickAvatar}>
              <Text style={styles.avatarButtonText}>Change Photo</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
              placeholderTextColor={theme.textMuted}
              style={styles.input}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={theme.textMuted}
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Text style={styles.helpText}>
              Updating your email may require re-verification.
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={theme.textMuted}
              secureTextEntry
              style={styles.input}
            />
            <Text style={styles.helpText}>
              Leave blank to keep your current password.
            </Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider
  },
  headerTitle: {
    color: theme.textPrimary,
    fontSize: 18,
    fontWeight: '600'
  },
  closeButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  closeText: {
    color: theme.accent,
    fontSize: 14,
    fontWeight: '600'
  },
  content: {
    padding: spacing.md,
    gap: spacing.lg
  },
  avatarSection: {
    alignItems: 'center',
    gap: spacing.sm
  },
  avatarPreview: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: theme.border
  },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.card
  },
  avatarInitial: {
    fontSize: 36,
    color: theme.textPrimary,
    fontWeight: '700'
  },
  avatarButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: theme.border
  },
  avatarButtonText: {
    color: theme.textPrimary,
    fontWeight: '600'
  },
  field: {
    gap: spacing.xs
  },
  label: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: '500'
  },
  input: {
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: theme.textPrimary,
    fontSize: 15
  },
  helpText: {
    color: theme.textMuted,
    fontSize: 12
  },
  error: {
    color: theme.error,
    fontSize: 13
  },
  saveButton: {
    marginTop: spacing.sm,
    backgroundColor: theme.accent,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center'
  },
  saveButtonDisabled: {
    opacity: 0.6
  },
  saveButtonText: {
    color: theme.background,
    fontSize: 15,
    fontWeight: '600'
  }
});

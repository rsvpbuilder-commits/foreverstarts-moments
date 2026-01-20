import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { useGuestStore } from '../store/useGuestStore';
import { supabase } from '../lib/supabase';
import { uploadMediaAsync } from '../lib/storage';
import { theme, spacing, radius } from '../theme/colors';
import { initialsAvatar } from '../utils/avatar';
import { IconCamera } from '../components/Icons';
import {
  ensureGuestProfile,
  upsertGuestProfile
} from '../lib/guestProfiles';

const MODES = {
  signup: 'signup',
  login: 'login'
};

const ROLE_OPTIONS = [
  { value: 'guest', label: 'Guest' },
  { value: 'bride', label: 'Bride' },
  { value: 'groom', label: 'Groom' }
];

export default function AuthScreen() {
  const { setGuest } = useGuestStore();
  const [mode, setMode] = useState(MODES.signup);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'guest'
  });
  const [avatar, setAvatar] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const coupleProvisioningEnabled =
    (Constants?.expoConfig?.extra?.allowCoupleProvisioning ?? false) ||
    process.env.EXPO_PUBLIC_ALLOW_COUPLE_PROVISIONING === 'true';

  const pickAvatar = async () => {
    setError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Please allow photo access to select an avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9
    });
    if (!result.canceled && result.assets?.length) {
      setAvatar(result.assets[0]);
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setLoading(false);
    setAvatar(null);
    setForm((prev) => ({
      ...prev,
      password: '',
      role: 'guest'
    }));
  };

  const handleLogin = async () => {
    if (!form.email.trim() || !form.password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.email.trim().toLowerCase(),
        password: form.password
      });
      if (error) throw error;
      const profile = await ensureGuestProfile(data.user);
      setGuest(profile);
    } catch (err) {
      console.error('Login error', err);
      setError(err?.message || 'Unable to log in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      setError('Please provide your full name and email.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    setLoading(true);
    setError('');
    const email = form.email.trim().toLowerCase();
    const name = form.name.trim();
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          data: { name }
        }
      });
      if (error) throw error;
      const user = data.user;
      if (!user) {
        setError(
          'Account created. Please verify your email before signing in.'
        );
        switchMode(MODES.login);
        return;
      }
      let avatarUrl = initialsAvatar(name);
      if (avatar?.uri) {
        avatarUrl = await uploadMediaAsync({
          uri: avatar.uri,
          folder: 'avatars',
          guestId: user.id,
          mimeType: avatar.mimeType || 'image/jpeg'
        });
      }
      const selectedRole = coupleProvisioningEnabled ? form.role : 'guest';
      const profile = await upsertGuestProfile({
        id: user.id,
        name,
        email,
        avatarUrl,
        role: selectedRole
      });
      setGuest(profile);
    } catch (err) {
      console.error('Signup error', err);
      setError(err?.message || 'Unable to create your guest pass.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (mode === MODES.login) {
      handleLogin();
    } else {
      handleSignup();
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.ampersand}>&</Text>
          <Text style={styles.coupleNames}>Josh & Joy</Text>
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <View style={styles.dividerHeart} />
            <View style={styles.dividerLine} />
          </View>
          <Text style={styles.eventDate}>Wedding Celebration</Text>
        </View>

        {/* Welcome Text */}
        <View style={styles.welcomeSection}>
          <Text style={styles.title}>
            {mode === MODES.signup ? 'Join the Celebration' : 'Welcome Back'}
          </Text>
          <Text style={styles.subtitle}>
            {mode === MODES.signup
              ? 'Create your guest pass to share photos, videos, and wishes with the newlyweds.'
              : 'Sign in to continue sharing moments from the celebration.'}
          </Text>
        </View>

        {/* Avatar Picker (Signup only) */}
        {mode === MODES.signup && (
          <TouchableOpacity style={styles.avatarPicker} onPress={pickAvatar}>
            {avatar?.uri ? (
              <Image source={{ uri: avatar.uri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <IconCamera size={28} color={theme.textMuted} />
                <Text style={styles.avatarText}>Add Photo</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Form */}
        <View style={styles.form}>
          {mode === MODES.signup && (
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your name"
                placeholderTextColor={theme.textMuted}
                value={form.name}
                onChangeText={(text) =>
                  setForm((prev) => ({ ...prev, name: text }))
                }
              />
            </View>
          )}
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor={theme.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={form.email}
              onChangeText={(text) => setForm((prev) => ({ ...prev, email: text }))}
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor={theme.textMuted}
              secureTextEntry
              value={form.password}
              onChangeText={(text) =>
                setForm((prev) => ({ ...prev, password: text }))
              }
            />
          </View>
        </View>

        {coupleProvisioningEnabled && mode === MODES.signup && (
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Role</Text>
            <View style={styles.roleOptionsRow}>
              {ROLE_OPTIONS.map((option) => {
                const isActive = form.role === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.roleOption,
                      isActive && styles.roleOptionActive
                    ]}
                    onPress={() =>
                      setForm((prev) => ({ ...prev, role: option.value }))
                    }
                  >
                    <Text
                      style={[
                        styles.roleOptionText,
                        isActive && styles.roleOptionTextActive
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Error */}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={theme.background} />
          ) : (
            <Text style={styles.submitText}>
              {mode === MODES.signup ? 'Create Guest Pass' : 'Sign In'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Switch Mode */}
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>
            {mode === MODES.signup
              ? 'Already have an account?'
              : 'Need an account?'}
          </Text>
          <TouchableOpacity
            onPress={() =>
              switchMode(mode === MODES.signup ? MODES.login : MODES.signup)
            }
          >
            <Text style={styles.switchAction}>
              {mode === MODES.signup ? 'Sign In' : 'Sign Up'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background
  },
  content: {
    padding: spacing.lg,
    paddingTop: 50
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl
  },
  ampersand: {
    fontSize: 48,
    fontWeight: '200',
    color: theme.accent,
    fontStyle: 'italic',
    marginBottom: -8
  },
  coupleNames: {
    fontSize: 28,
    fontWeight: '300',
    color: theme.textPrimary,
    letterSpacing: 4,
    textTransform: 'uppercase'
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
    gap: spacing.md
  },
  dividerLine: {
    width: 40,
    height: 1,
    backgroundColor: theme.border
  },
  dividerHeart: {
    width: 8,
    height: 8,
    backgroundColor: theme.accent,
    borderRadius: 4,
    transform: [{ rotate: '45deg' }]
  },
  eventDate: {
    fontSize: 13,
    color: theme.textSecondary,
    letterSpacing: 2
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: spacing.xl
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: spacing.sm
  },
  subtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 21
  },
  avatarPicker: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignSelf: 'center',
    marginBottom: spacing.xl,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.border,
    borderStyle: 'dashed'
  },
  avatarImage: {
    width: '100%',
    height: '100%'
  },
  avatarPlaceholder: {
    flex: 1,
    backgroundColor: theme.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs
  },
  avatarText: {
    fontSize: 11,
    color: theme.textSecondary
  },
  form: {
    gap: spacing.md,
    marginBottom: spacing.lg
  },
  inputContainer: {
    gap: spacing.xs
  },
  inputLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '500',
    marginLeft: spacing.xs
  },
  input: {
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.border,
    padding: spacing.md,
    color: theme.textPrimary,
    fontSize: 15
  },
  error: {
    color: theme.error,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontSize: 13
  },
  submitButton: {
    backgroundColor: theme.accent,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg
  },
  submitButtonDisabled: {
    opacity: 0.6
  },
  submitText: {
    color: theme.background,
    fontSize: 15,
    fontWeight: '600'
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs
  },
  switchLabel: {
    color: theme.textSecondary,
    fontSize: 14
  },
  switchAction: {
    color: theme.accent,
    fontWeight: '600',
    fontSize: 14
  },
  roleOptionsRow: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  roleOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center'
  },
  roleOptionActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent
  },
  roleOptionText: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: '500'
  },
  roleOptionTextActive: {
    color: theme.background
  },
  roleHelper: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: spacing.xs
  }
});

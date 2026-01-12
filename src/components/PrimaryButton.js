import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { theme } from '../theme/colors';

export function PrimaryButton({ title, onPress, style, icon, disabled }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      disabled={disabled}
      style={[
        styles.button,
        disabled && { opacity: 0.5 },
        icon && styles.buttonRow,
        style
      ]}
    >
      {icon}
      <Text style={styles.label}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: theme.accent,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8
  },
  label: {
    color: theme.textPrimary,
    fontSize: 16,
    fontWeight: '600'
  }
});

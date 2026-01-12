import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme/colors';

export function IconGrid({ size = 24, color = theme.textPrimary }) {
  return (
    <MaterialCommunityIcons
      name="image-multiple-outline"
      size={size}
      color={color}
    />
  );
}

export function IconHeart({ size = 24, color = theme.textPrimary, filled = false }) {
  return (
    <Ionicons
      name={filled ? 'heart' : 'heart-outline'}
      size={size}
      color={color}
    />
  );
}

export function IconPlus({ size = 24, color = theme.textPrimary }) {
  return <Feather name="plus" size={size} color={color} />;
}

export function IconMessage({ size = 24, color = theme.textPrimary }) {
  return (
    <Ionicons
      name="chatbubble-ellipses-outline"
      size={size}
      color={color}
    />
  );
}

export function IconUser({ size = 24, color = theme.textPrimary }) {
  return <Feather name="user" size={size} color={color} />;
}

export function IconCamera({ size = 24, color = theme.textPrimary }) {
  return <Feather name="camera" size={size} color={color} />;
}

export function IconImage({ size = 24, color = theme.textPrimary }) {
  return <Feather name="image" size={size} color={color} />;
}

export function IconComment({ size = 24, color = theme.textPrimary }) {
  return (
    <MaterialCommunityIcons
      name="comment-text-outline"
      size={size}
      color={color}
    />
  );
}

export function IconSend({ size = 24, color = theme.textPrimary }) {
  return <Feather name="send" size={size} color={color} />;
}

export function IconClose({ size = 24, color = theme.textPrimary }) {
  return <Feather name="x" size={size} color={color} />;
}

export function IconCheck({ size = 24, color = theme.textPrimary }) {
  return <Feather name="check" size={size} color={color} />;
}

export function IconVideo({ size = 24, color = theme.textPrimary }) {
  return <Feather name="video" size={size} color={color} />;
}

export function IconMultiple({ size = 24, color = theme.textPrimary }) {
  return (
    <MaterialCommunityIcons
      name="layers-outline"
      size={size}
      color={color}
    />
  );
}

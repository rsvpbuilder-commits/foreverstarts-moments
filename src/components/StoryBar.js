import { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme, spacing } from '../theme/colors';
import { initialsAvatar } from '../utils/avatar';
import { getOptimizedImageUrl } from '../utils/media';
import { OptimizedImage } from './OptimizedImage';

function StoryAvatar({ guest }) {
  const guestName = guest?.name || 'Guest';
  const fallbackAvatar = initialsAvatar(guestName);
  
  const hasValidAvatar = guest?.avatar_url && 
    typeof guest.avatar_url === 'string' && 
    guest.avatar_url.trim().length > 0 &&
    guest.avatar_url.startsWith('http');
  
  const optimizedAvatar = hasValidAvatar
    ? getOptimizedImageUrl(guest.avatar_url, { width: 140, height: 140, quality: 60 })
    : fallbackAvatar;
  const [avatarUri, setAvatarUri] = useState(optimizedAvatar);
  
  useEffect(() => {
    setAvatarUri(optimizedAvatar);
  }, [optimizedAvatar]);
  
  return (
    <OptimizedImage 
      source={{ uri: avatarUri }} 
      style={styles.avatar}
      onError={() => setAvatarUri(fallbackAvatar)}
    />
  );
}

export function StoryBar({ storyGroups = [], onAddStory, onOpenStory }) {
  return (
    <View style={styles.container}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Add Story Button */}
        <TouchableOpacity 
          onPress={onAddStory} 
          style={styles.storyItem}
          activeOpacity={0.8}
        >
          <View style={styles.addStoryRing}>
            <View style={styles.addStoryInner}>
              <Text style={styles.addIcon}>+</Text>
            </View>
          </View>
          <Text style={styles.storyName}>Your Story</Text>
        </TouchableOpacity>
        
        {/* Stories */}
        {storyGroups.map((group, index) => {
          const guestName = group.guest?.name || 'Guest';
          return (
            <TouchableOpacity
              key={group.guest?.id || group.stories?.[0]?.id || index}
              style={styles.storyItem}
              onPress={() => onOpenStory?.(group, index)}
              activeOpacity={0.8}
            >
              <View style={styles.storyRing}>
                <StoryAvatar guest={group.guest} />
              </View>
              <Text style={styles.storyName} numberOfLines={1}>
                {guestName.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm
  },
  scrollContent: {
    paddingHorizontal: spacing.xs,
    gap: spacing.md
  },
  storyItem: {
    alignItems: 'center',
    width: 72
  },
  storyRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 3,
    borderWidth: 2,
    borderColor: theme.accent,
    marginBottom: spacing.xs
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: theme.accentMuted
  },
  addStoryRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 3,
    borderWidth: 2,
    borderColor: theme.border,
    borderStyle: 'dashed',
    marginBottom: spacing.xs
  },
  addStoryInner: {
    flex: 1,
    borderRadius: 29,
    backgroundColor: theme.cardElevated,
    alignItems: 'center',
    justifyContent: 'center'
  },
  addIcon: {
    fontSize: 28,
    color: theme.accent,
    fontWeight: '300'
  },
  storyName: {
    fontSize: 11,
    color: theme.textSecondary,
    textAlign: 'center',
    fontWeight: '500'
  }
});

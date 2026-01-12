import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { theme } from '../theme/colors';
import { IconGrid, IconHeart, IconPlus, IconCamera, IconUser } from './Icons';

const TAB_CONFIG = [
  { key: 'feed', label: 'Moments', Icon: IconGrid },
  { key: 'wishes', label: 'Wishes', Icon: IconHeart },
  { key: 'create', label: '', Icon: IconPlus, isCenter: true },
  { key: 'messages', label: 'Stories', Icon: IconCamera },
  { key: 'profile', label: 'Profile', Icon: IconUser }
];

export function BottomTabBar({ activeTab, onTabPress, guest }) {
  const avatarUri = guest?.avatar_url;
  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {TAB_CONFIG.map((tab) => {
          const isActive = activeTab === tab.key;
          const { Icon } = tab;
          
          if (tab.isCenter) {
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.centerTabWrapper}
                onPress={() => onTabPress(tab.key)}
                activeOpacity={0.8}
              >
                <View style={styles.centerTab}>
                  <Icon color={theme.background} size={26} strokeWidth={2.5} />
                </View>
              </TouchableOpacity>
            );
          }
          
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => onTabPress(tab.key)}
              activeOpacity={0.7}
            >
              {tab.key === 'profile' && avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={[
                    styles.avatar,
                    { borderColor: isActive ? theme.tabActive : 'transparent' }
                  ]}
                />
              ) : (
                <Icon 
                  color={isActive ? theme.tabActive : theme.tabInactive} 
                  size={22} 
                />
              )}
              <Text style={[
                styles.tabLabel,
                isActive && styles.tabLabelActive
              ]}>
                {tab.label}
              </Text>
              {isActive && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.tabBar,
    borderTopWidth: 1,
    borderTopColor: theme.tabBarBorder,
    paddingBottom: 20,
    paddingTop: 8
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    position: 'relative'
  },
  tabLabel: {
    fontSize: 10,
    color: theme.tabInactive,
    marginTop: 4,
    fontWeight: '500'
  },
  tabLabelActive: {
    color: theme.tabActive
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 20,
    height: 2,
    backgroundColor: theme.accent,
    borderRadius: 1
  },
  centerTabWrapper: {
    flex: 1,
    alignItems: 'center',
    marginTop: -30
  },
  centerTab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 2
  }
});

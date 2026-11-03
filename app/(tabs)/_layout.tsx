import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePendingCount } from '@/api/offers';
import { colors } from '@/theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (name: IconName, focusedName: IconName) =>
  function TabIcon({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return <Ionicons name={focused ? focusedName : name} size={size} color={color} />;
  };

// Floating pill tab bar, per the wallet reference.
export default function TabsLayout() {
  const pending = usePendingCount();
  const badge = pending.data ? (pending.data > 9 ? '9+' : pending.data) : undefined;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.accentText,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarActiveBackgroundColor: colors.accent,
        tabBarStyle: {
          position: 'absolute',
          left: 32,
          right: 32,
          bottom: 20,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.surfaceRaised,
          borderTopWidth: 0,
          paddingHorizontal: 8,
          elevation: 8,
        },
        tabBarItemStyle: { borderRadius: 24, overflow: 'hidden', marginVertical: 8, marginHorizontal: 4 },
        tabBarBadgeStyle: { backgroundColor: colors.danger, color: colors.text, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Explore', tabBarIcon: icon('compass-outline', 'compass') }} />
      <Tabs.Screen
        name="offers"
        options={{ title: 'Offers', tabBarBadge: badge, tabBarIcon: icon('swap-horizontal-outline', 'swap-horizontal') }}
      />
      <Tabs.Screen name="items" options={{ title: 'My items', tabBarIcon: icon('cube-outline', 'cube') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-outline', 'person') }} />
    </Tabs>
  );
}

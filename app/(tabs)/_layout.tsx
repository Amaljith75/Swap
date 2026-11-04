import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePendingCount } from '@/api/offers';
import { TabBar } from '@/components/TabBar';
import { colors } from '@/theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (name: IconName, focusedName: IconName) =>
  function TabIcon({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return <Ionicons name={focused ? focusedName : name} size={size} color={color} />;
  };

export default function TabsLayout() {
  const pending = usePendingCount();
  const badge = pending.data ? (pending.data > 9 ? '9+' : pending.data) : undefined;
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
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

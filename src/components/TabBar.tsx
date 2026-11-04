import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { Tabs } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme/tokens';
import { Text } from '@/ui';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export const TAB_BAR_HEIGHT = 64;
const SIDE_GAP = 24;
const MAX_WIDTH = 360;

/** Distance from the screen bottom to the bar: clears the home indicator / gesture bar on every phone. */
export function useTabBarOffset() {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 10) + 8;
}

/** Bottom padding a scrolling tab screen needs so its last row isn't hidden behind the bar. */
export function useTabBarSpace() {
  return useTabBarOffset() + TAB_BAR_HEIGHT + 16;
}

// Floating pill tab bar. Laid out by hand (instead of React Navigation's default bar)
// so the icons stay centred in their pills regardless of screen size, display scaling
// or Android gesture-bar height.
export function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const { width } = useWindowDimensions();
  const offset = useTabBarOffset();
  const barWidth = Math.min(width - SIDE_GAP * 2, MAX_WIDTH);

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: offset }]}>
      <View style={[styles.bar, { width: barWidth }]} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]!;
          const focused = state.index === index;
          const color = focused ? colors.accentText : colors.textMuted;
          const badge = options.tabBarBadge;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              void Haptics.selectionAsync();
              navigation.navigate(route.name, route.params);
            }
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.title ?? route.name}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={[styles.item, focused && styles.itemOn]}
            >
              {options.tabBarIcon?.({ focused, color, size: 24 })}
              {badge !== undefined && badge !== null && (
                <View style={styles.badge}>
                  <Text variant="caption" color={colors.text} style={styles.badgeText}>
                    {String(badge)}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bar: {
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 6,
    borderRadius: TAB_BAR_HEIGHT / 2,
    backgroundColor: colors.surfaceRaised,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  item: { flex: 1, height: '100%', borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  itemOn: { backgroundColor: colors.accent },
  badge: {
    position: 'absolute',
    top: 2,
    right: '22%',
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: '700', lineHeight: 14 },
});

import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius } from '@/theme/tokens';
import { Text } from './Text';

interface Props<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}

export function Segmented<T extends string>({ value, options, onChange }: Props<T>) {
  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[styles.item, on && styles.on]}
          >
            <Text variant="caption" color={on ? colors.accentText : colors.text} style={styles.label}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4 },
  item: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center' },
  on: { backgroundColor: colors.accent },
  label: { fontWeight: '600' },
});

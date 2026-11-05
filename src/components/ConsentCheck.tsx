import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MIN_AGE, links } from '@/lib/config';
import { colors, radius, spacing } from '@/theme/tokens';
import { Text } from '@/ui';

/** "I'm 18 or older and agree to the Terms and Privacy Policy" checkbox. */
export function ConsentCheck({ checked, onChange, error }: { checked: boolean; onChange: (v: boolean) => void; error?: boolean }) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={`I am ${MIN_AGE} or older and agree to the Terms and the Privacy Policy`}
        hitSlop={8}
        onPress={() => onChange(!checked)}
        style={[styles.box, checked && styles.boxOn, error && !checked && styles.boxError]}
      >
        {checked && <Ionicons name="checkmark" size={18} color={colors.accentText} />}
      </Pressable>
      <Text style={styles.text} muted>
        <Text onPress={() => onChange(!checked)} muted>
          I’m {MIN_AGE} or older and I agree to the{' '}
        </Text>
        <Text color={colors.accent} onPress={() => void Linking.openURL(links.terms)} accessibilityRole="link">
          Terms
        </Text>
        <Text muted> and the </Text>
        <Text color={colors.accent} onPress={() => void Linking.openURL(links.privacy)} accessibilityRole="link">
          Privacy Policy
        </Text>
        <Text muted>.</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  box: {
    width: 26,
    height: 26,
    marginTop: 1,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  boxError: { borderColor: colors.danger },
  text: { flex: 1 },
});

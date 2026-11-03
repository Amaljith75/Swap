import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, spacing } from '@/theme/tokens';
import { Text } from './Text';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<TextInput, Props>(function Input({ label, error, hint, style, multiline, ...rest }, ref) {
  return (
    <View style={styles.wrap}>
      {label && (
        <Text variant="caption" muted style={styles.label}>
          {label}
        </Text>
      )}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.accent}
        multiline={multiline}
        accessibilityLabel={label}
        style={[styles.input, multiline && styles.multiline, error ? styles.errorBorder : null, style]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" color={colors.danger}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" muted>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { marginLeft: 4 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  errorBorder: { borderColor: colors.danger },
});

import { Text as RNText, type TextProps } from 'react-native';
import { colors, type as typeScale } from '@/theme/tokens';

type Variant = keyof typeof typeScale;
interface Props extends TextProps {
  variant?: Variant;
  muted?: boolean;
  onSheet?: boolean;
  color?: string;
}

/** Respect the phone's font size, up to 1.5x (beyond that cards and buttons overflow). */
export const MAX_FONT_SCALE = 1.5;

export function Text({ variant = 'body', muted, onSheet, color, style, maxFontSizeMultiplier = MAX_FONT_SCALE, ...rest }: Props) {
  const base = onSheet
    ? muted
      ? colors.textOnSheetMuted
      : colors.textOnSheet
    : muted
      ? colors.textMuted
      : colors.text;
  return <RNText maxFontSizeMultiplier={maxFontSizeMultiplier} {...rest} style={[typeScale[variant], { color: color ?? base }, style]} />;
}

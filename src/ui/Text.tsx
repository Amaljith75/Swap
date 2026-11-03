import { Text as RNText, type TextProps } from 'react-native';
import { colors, type as typeScale } from '@/theme/tokens';

type Variant = keyof typeof typeScale;
interface Props extends TextProps {
  variant?: Variant;
  muted?: boolean;
  onSheet?: boolean;
  color?: string;
}

export function Text({ variant = 'body', muted, onSheet, color, style, ...rest }: Props) {
  const base = onSheet
    ? muted
      ? colors.textOnSheetMuted
      : colors.textOnSheet
    : muted
      ? colors.textMuted
      : colors.text;
  return <RNText {...rest} style={[typeScale[variant], { color: color ?? base }, style]} />;
}

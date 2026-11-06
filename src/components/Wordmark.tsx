import { Image } from 'react-native';
import { colors } from '@/theme/tokens';

const RATIO = 797 / 185; // assets/brand/wordmark.png

/** The SWAP title, drawn from the brand image so it looks the same on every phone. */
export function Wordmark({ height = 26, color = colors.text }: { height?: number; color?: string }) {
  return (
    <Image
      source={require('../../assets/brand/wordmark.png')}
      style={{ height, width: height * RATIO, tintColor: color }}
      resizeMode="contain"
      accessibilityRole="header"
      accessibilityLabel="Swap"
    />
  );
}

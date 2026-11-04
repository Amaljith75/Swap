import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';
import { colors } from '@/theme/tokens';

// Short lines about swapping, barter history and reuse. Facts are kept to ones
// that are well established; keep new additions short enough for one or two lines.
export const TAGLINES = [
  "One person's clutter is another person's treasure.",
  'People were swapping goods long before the first coins were minted.',
  "The greenest item is the one that's already been made.",
  'Swap it, don’t shop it.',
  'Your unused guitar could be someone’s first song.',
  'Swap a book, gain a story. Swap a tool, gain a weekend project.',
  'Every swap keeps something out of a landfill a little longer.',
  'Nothing to spend. Something to gain.',
  'Good things deserve a second home.',
  'In ancient Mesopotamia, barley was used to measure the value of goods.',
  'Trade what you have for what you need.',
  'A book read once is a book waiting for its next reader.',
  'Less buying, more swapping, same happiness.',
  'Fair trade: you both walk away happy.',
  'Declutter your shelf, fill someone else’s.',
  'Salt was once so valuable it was traded like money.',
  'Make room for new by passing on the old.',
  'Neighbours make the best marketplace.',
];

/** Fades through TAGLINES every few seconds; holds still if the user prefers reduced motion. */
export function RotatingTagline({ interval = 6000 }: { interval?: number }) {
  const [i, setI] = useState(() => Math.floor(Math.random() * TAGLINES.length));
  const opacity = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      if (reduceMotion) {
        setI((n) => (n + 1) % TAGLINES.length);
        return;
      }
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
        setI((n) => (n + 1) % TAGLINES.length);
        Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }).start();
      });
    }, interval);
    return () => clearInterval(t);
  }, [interval, opacity, reduceMotion]);

  return (
    <Animated.Text
      style={[styles.text, { opacity }]}
      numberOfLines={2}
      accessibilityLiveRegion="none"
      accessibilityLabel="Swap tagline"
    >
      {TAGLINES[i]}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  // Fixed two-line height so the layout below doesn't jump as lines change.
  text: { color: colors.textMuted, fontSize: 14, lineHeight: 19, minHeight: 38, marginTop: 2 },
});

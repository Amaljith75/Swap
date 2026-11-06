import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { colors } from '@/theme/tokens';
import { Wordmark } from './Wordmark';

const MARK = 132;
let playedThisLaunch = false;

/**
 * Opening animation, once per app launch: the two swap pieces sweep in from the
 * left and right, spin into place and lock together into the Swap mark, the title
 * rises in, then everything fades to the app. Tap to skip. Reduced motion: a short
 * fade instead.
 */
export function IntroAnimation() {
  const [done, setDone] = useState(playedThisLaunch);
  const { width } = useWindowDimensions();
  const join = useRef(new Animated.Value(0)).current; // pieces flying in (0 -> 1)
  const lock = useRef(new Animated.Value(0)).current; // small "click" when they meet
  const title = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (done) return;
    playedThisLaunch = true;
    let cancelled = false;
    const finish = () => !cancelled && setDone(true);
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        join.setValue(1);
        title.setValue(1);
        Animated.sequence([
          Animated.delay(500),
          Animated.timing(fade, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start(finish);
        return;
      }
      Animated.sequence([
        Animated.delay(120),
        Animated.spring(join, { toValue: 1, damping: 13, stiffness: 90, mass: 1, useNativeDriver: true }),
        Animated.parallel([
          Animated.sequence([
            Animated.timing(lock, { toValue: 1, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(lock, { toValue: 0, duration: 220, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          ]),
          Animated.timing(title, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
        Animated.delay(380),
        Animated.timing(fade, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start(finish);
    });
    return () => {
      cancelled = true;
    };
  }, [done, join, lock, title, fade]);

  if (done) return null;

  const travel = width * 0.62;
  const piece = (side: -1 | 1) => ({
    opacity: join.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 1] }),
    transform: [
      { translateX: join.interpolate({ inputRange: [0, 1], outputRange: [side * travel, 0] }) },
      { translateY: join.interpolate({ inputRange: [0, 1], outputRange: [side * -40, 0] }) },
      { rotate: join.interpolate({ inputRange: [0, 1], outputRange: [`${side * 150}deg`, '0deg'] }) },
      { scale: join.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
    ],
  });
  const markScale = lock.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]} pointerEvents="box-none">
      <Pressable
        style={styles.center}
        accessibilityRole="button"
        accessibilityLabel="Skip intro"
        onPress={() => {
          fade.stopAnimation();
          setDone(true);
        }}
      >
        <Animated.View style={[styles.mark, { transform: [{ scale: markScale }] }]}>
          <Animated.View style={[StyleSheet.absoluteFill, piece(-1)]}>
            <Image source={require('../../assets/brand/mark-a.png')} style={styles.img} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, piece(1)]}>
            <Image source={require('../../assets/brand/mark-b.png')} style={styles.img} />
          </Animated.View>
        </Animated.View>
        <Animated.View
          style={{
            opacity: title,
            transform: [{ translateY: title.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
          }}
        >
          <Wordmark height={34} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.bg, zIndex: 100, elevation: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 },
  mark: { width: MARK, height: MARK },
  img: { width: MARK, height: MARK },
});

import { useEffect, useRef, useState } from 'react';
import { Platform, StatusBar, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { trigger, type HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { Canvas, useThorVG } from 'thorvg-react-native';
import type { Engine, HapticKind, Host } from '@cosmo-merge/engine';
import { startCosmoMerge } from '@cosmo-merge/game';

// iOS uses 'sw': the WebGPU path still has a teardown bug when a canvas is recreated.
const renderer = Platform.OS === 'ios' ? 'sw' : 'gl';

const memory = new Map<string, string>();

const haptic: Record<HapticKind, keyof typeof HapticFeedbackTypes> = {
  light: 'impactLight',
  medium: 'impactMedium',
  heavy: 'impactHeavy',
  success: 'notificationSuccess',
  error: 'notificationError',
};

// React Native host: the same game, fed by a ThorVG view, RN touches and native haptics.
export default function App() {
  const TVG = useThorVG({ renderer });
  const view = useRef<Canvas>(null);
  const engine = useRef<Engine | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const ready = size !== null;

  useEffect(() => {
    if (!TVG || !ready || !size) return;
    // No width/height: the canvas follows the view's layout.
    const canvas = new TVG.Canvas(view);
    const host: Host = {
      TVG,
      canvas,
      requestFrame: (cb) => requestAnimationFrame(cb),
      cancelFrame: (id) => cancelAnimationFrame(id),
      now: () => performance.now(),
      haptics: { impact: (kind) => trigger(haptic[kind]) },
      storage: { get: (k) => memory.get(k) ?? null, set: (k, v) => void memory.set(k, v) },
      label: `RN ${Platform.OS} · ${canvas.renderer}`,
      debug: __DEV__,
    };
    engine.current = startCosmoMerge(host, size);
    return () => {
      engine.current?.destroy();
      engine.current = null;
      canvas.destroy();
    };
    // Recreate only when ThorVG or the first layout arrives; later sizes go through resize().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [TVG, ready]);

  useEffect(() => {
    if (size) engine.current?.resize(size.width, size.height);
  }, [size]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((s) => (s && s.width === width && s.height === height ? s : { width, height }));
  };
  const at = (e: GestureResponderEvent) => [e.nativeEvent.locationX, e.nativeEvent.locationY, Number(e.nativeEvent.identifier) || 0] as const;

  return (
    <View
      style={styles.root}
      onLayout={onLayout}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => engine.current?.pointerDown(...at(e))}
      onResponderMove={(e) => engine.current?.pointerMove(...at(e))}
      onResponderRelease={(e) => engine.current?.pointerUp(...at(e))}
      onResponderTerminate={(e) => engine.current?.pointerUp(...at(e))}
    >
      <StatusBar barStyle="light-content" />
      {TVG && <Canvas ref={view} style={StyleSheet.absoluteFill} pointerEvents="none" />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
});

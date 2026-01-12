import { memo, useRef } from 'react';
import { Animated, PanResponder } from 'react-native';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const distanceBetween = (touches) => {
  if (!touches || touches.length < 2) return 0;
  const [a, b] = touches;
  const dx = a.pageX - b.pageX;
  const dy = a.pageY - b.pageY;
  return Math.sqrt(dx * dx + dy * dy);
};

function ZoomableMediaComponent({ children, maxScale = 3, style }) {
  const scale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);
  const initialDistance = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) =>
        gestureState.numberActiveTouches >= 2,
      onMoveShouldSetPanResponderCapture: (_evt, gestureState) =>
        gestureState.numberActiveTouches >= 2,
      onPanResponderGrant: (evt, gestureState) => {
        if (gestureState.numberActiveTouches >= 2) {
          initialDistance.current = distanceBetween(evt.nativeEvent.touches);
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.numberActiveTouches < 2) return;
        const currentDistance = distanceBetween(evt.nativeEvent.touches);
        if (!initialDistance.current) {
          initialDistance.current = currentDistance;
        }
        const nextScale = clamp(
          (currentDistance / initialDistance.current) * lastScale.current,
          1,
          maxScale
        );
        scale.setValue(nextScale);
      },
      onPanResponderRelease: () => {
        lastScale.current = clamp(scale.__getValue(), 1, maxScale);
        if (lastScale.current <= 1.02) {
          lastScale.current = 1;
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true
          }).start();
        } else {
          Animated.spring(scale, {
            toValue: lastScale.current,
            useNativeDriver: true
          }).start();
        }
        initialDistance.current = 0;
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderTerminate: () => {
        lastScale.current = 1;
        initialDistance.current = 0;
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true
        }).start();
      }
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </Animated.View>
  );
}

export const ZoomableMedia = memo(ZoomableMediaComponent);

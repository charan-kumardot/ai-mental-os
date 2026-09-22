import React, { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';

export function Switch({ value, onValueChange, disabled }: { value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean }) {
  const { colors } = useTheme();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 150 });
  }, [value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: value ? colors.primary : colors.border,
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 20 }],
  }));

  return (
    <Pressable
      onPress={() => !disabled && onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      hitSlop={8}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <Animated.View
        style={[
          { width: 44, height: 26, borderRadius: 13, padding: 3, justifyContent: 'center' },
          trackStyle,
        ]}
      >
        <Animated.View
          style={[
            { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.surface },
            thumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

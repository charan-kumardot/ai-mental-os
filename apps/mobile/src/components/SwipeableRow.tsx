import React, { useRef } from 'react';
import { View, Text } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Swipe-to-resolve instead of only tap-to-resolve on the small checkbox
 * icon — a tactile micro-gesture on the two screens (Mental Inbox,
 * Decisions) whose whole job is clearing things off the user's plate, so
 * the interaction should feel like clearing them away. Swipeable already
 * animates the reveal itself; this only renders the panel content.
 */
export function SwipeableRow({
  children,
  onResolve,
  resolved,
}: {
  children: React.ReactNode;
  onResolve: () => void;
  resolved: boolean;
}) {
  const { colors, typography } = useTheme();
  const ref = useRef<Swipeable>(null);

  const renderRightActions = () => (
    <View style={{ justifyContent: 'center', alignItems: 'center', width: 84 }}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: resolved ? colors.warning + '26' : colors.success + '26',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name={resolved ? 'rotate-ccw' : 'check'} size={22} color={resolved ? colors.warning : colors.success} />
      </View>
      <Text style={[typography.micro, { color: colors.textMuted, marginTop: 4 }]}>{resolved ? 'Reopen' : 'Resolve'}</Text>
    </View>
  );

  return (
    <Swipeable
      ref={ref}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      onSwipeableOpen={() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onResolve();
        ref.current?.close();
      }}
    >
      {children}
    </Swipeable>
  );
}

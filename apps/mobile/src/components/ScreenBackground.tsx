import React from 'react';
import { View, ViewProps } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { AmbientBackground } from './AmbientBackground';

export function ScreenBackground({
  children,
  edges,
}: {
  children: React.ReactNode;
  edges?: Edge[];
}) {
  return (
    <View style={{ flex: 1 }}>
      <AmbientBackground />
      <SafeAreaView style={{ flex: 1 }} edges={edges ?? ['top']}>
        {children}
      </SafeAreaView>
    </View>
  );
}

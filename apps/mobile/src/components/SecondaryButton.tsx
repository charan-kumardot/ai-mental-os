import React from 'react';
import { ViewStyle } from 'react-native';
import { PrimaryButton } from './PrimaryButton';

/**
 * Spec §105 lists PrimaryButton and SecondaryButton as separate
 * components; this app's button already supports both visual treatments
 * via one shared implementation (`PrimaryButton`'s `variant` prop), so
 * this is a thin named wrapper rather than a duplicate implementation —
 * one fewer place button styling could drift between the two variants.
 */
export function SecondaryButton(props: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  return <PrimaryButton {...props} variant="secondary" />;
}

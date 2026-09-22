import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import Svg, { Circle, Line, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';

const AnimatedLine = Animated.createAnimatedComponent(Line);

export interface GraphNode {
  key: string;
  label: string;
  count: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  relationshipType: 'positive' | 'negative';
  confidence: number;
  onPress?: () => void;
}

/**
 * "What I've collected" + "Relationship map" merged into one interactive
 * graph (spec §78: an animated, explorable node-link diagram — not a
 * decorative dot ring next to a separate text list). Edges only ever exist
 * for real, already-detected correlations (`patterns` data); dimensions
 * with nothing found stay unconnected exactly as before, so nothing here
 * invents a relationship.
 */
/** A real, detected-pattern connection — the only thing that animates, so a genuine finding visually stands out from the plain data-collected spokes. */
function AnimatedEdge({ x1, y1, x2, y2, color, confidence }: { x1: number; y1: number; x2: number; y2: number; color: string; confidence: number }) {
  const dashOffset = useSharedValue(0);

  useEffect(() => {
    dashOffset.value = withRepeat(withTiming(-24, { duration: 1600, easing: Easing.linear }), -1, false);
  }, []);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: dashOffset.value }));

  return (
    <AnimatedLine
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={color}
      strokeWidth={1.5 + confidence * 2}
      strokeDasharray="6 6"
      animatedProps={animatedProps}
      strokeLinecap="round"
      opacity={0.85}
    />
  );
}

export function PersonalGraph({
  nodes,
  edges = [],
  size = 280,
}: {
  nodes: GraphNode[];
  edges?: GraphEdge[];
  size?: number;
}) {
  const { colors, typography } = useTheme();
  const center = size / 2;
  const orbitRadius = size * 0.34;
  const maxCount = Math.max(...nodes.map((n) => n.count), 1);

  const positioned = nodes.map((n, i) => {
    const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2;
    const x = center + orbitRadius * Math.cos(angle);
    const y = center + orbitRadius * Math.sin(angle);
    const r = 16 + (n.count / maxCount) * 20;
    return { ...n, x, y, r };
  });

  const byKey = Object.fromEntries(positioned.map((n) => [n.key, n]));

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="centerGrad" cx="35%" cy="30%" r="75%">
            <Stop offset="0%" stopColor={colors.aiAccent} stopOpacity={1} />
            <Stop offset="100%" stopColor={colors.aiAccent} stopOpacity={0.7} />
          </RadialGradient>
        </Defs>

        {/* plain, static spokes from center to every collected-data node */}
        {positioned.map((n) => (
          <Line
            key={`spoke-line-${n.key}`}
            x1={center}
            y1={center}
            x2={n.x}
            y2={n.y}
            stroke={colors.border}
            strokeWidth={1.5}
            opacity={n.count > 0 ? 0.6 : 0.25}
          />
        ))}

        {/* real, detected-pattern edges between dimension nodes — the
            actual "relationship map" the spec asks for */}
        {edges.map((e, i) => {
          const a = byKey[e.from];
          const b = byKey[e.to];
          if (!a || !b) return null;
          return (
            <AnimatedEdge
              key={`edge-${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              color={e.relationshipType === 'positive' ? colors.success : colors.warning}
              confidence={e.confidence}
            />
          );
        })}

        {positioned.map((n) => (
          <Circle
            key={`node-${n.key}`}
            cx={n.x}
            cy={n.y}
            r={n.r}
            fill={n.count > 0 ? colors.primary : colors.border}
            opacity={n.count > 0 ? 0.85 : 0.5}
          />
        ))}

        <Circle cx={center} cy={center} r={26} fill="url(#centerGrad)" />
      </Svg>

      {/* tappable overlay per node — opens evidence for that dimension when it has one */}
      {positioned.map((n) => {
        const relatedEdge = edges.find((e) => e.from === n.key || e.to === n.key);
        if (!relatedEdge?.onPress) return null;
        return (
          <Pressable
            key={`tap-${n.key}`}
            onPress={relatedEdge.onPress}
            hitSlop={8}
            style={{
              position: 'absolute',
              left: n.x - n.r,
              top: n.y - n.r,
              width: n.r * 2,
              height: n.r * 2,
              borderRadius: n.r,
            }}
          />
        );
      })}

      <View style={{ position: 'absolute', top: center - 8, alignSelf: 'center' }} pointerEvents="none">
        <Text style={[typography.micro, { color: '#fff', fontWeight: '700' }]}>Me</Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 12 }}>
        {nodes.map((n) => (
          <View key={n.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: n.count > 0 ? colors.primary : colors.border,
              }}
            />
            <Text style={[typography.micro, { color: colors.textSecondary }]}>
              {n.label} ({n.count})
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

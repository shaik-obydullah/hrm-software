import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from './theme';

export function PinDots({
  length,
  maxLength = 6,
  error,
}: {
  length: number;
  maxLength?: number;
  error?: boolean;
}) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: maxLength }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index < length && styles.dotFilled,
            error && styles.dotError,
          ]}
        />
      ))}
    </View>
  );
}

export function PinPad({
  value,
  onChange,
  maxLength = 6,
}: {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}) {
  const press = (digit: string) => {
    if (value.length < maxLength) {
      onChange(value + digit);
    }
  };
  const backspace = () => onChange(value.slice(0, -1));

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

  return (
    <View style={styles.pad}>
      {keys.map((key, index) =>
        key === '' ? (
          <View key={`blank-${index}`} style={styles.key} />
        ) : (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={key === '⌫' ? 'Delete' : key}
            onPress={() => (key === '⌫' ? backspace() : press(key))}
            style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
          >
            <Text style={styles.keyText}>{key}</Text>
          </Pressable>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginVertical: spacing.xl,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  dotFilled: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  dotError: {
    borderColor: colors.danger,
  },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 280,
    alignSelf: 'center',
  },
  key: {
    width: '33.33%',
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: {
    opacity: 0.5,
  },
  keyText: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    width: 56,
    height: 56,
    lineHeight: 56,
    textAlign: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
});

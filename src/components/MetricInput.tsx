import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, spacing } from '@/src/components/ui';
import type { Metric, MetricValueDraft } from '@/src/models/types';

type Props = {
  metric: Metric;
  value?: MetricValueDraft;
  onChange: (value: MetricValueDraft) => void;
};

export function MetricInput({ metric, value, onChange }: Props) {
  const baseValue: MetricValueDraft = value ?? { metricId: metric.id };

  if (metric.metricType === 'boolean') {
    return (
      <MetricFrame metric={metric}>
        <View style={styles.row}>
          <Choice
            label="Yes"
            selected={baseValue.valueBoolean === true}
            tone="green"
            onPress={() => onChange({ ...baseValue, valueBoolean: true })}
          />
          <Choice
            label="No"
            selected={baseValue.valueBoolean === false}
            tone="rose"
            onPress={() => onChange({ ...baseValue, valueBoolean: false })}
          />
        </View>
      </MetricFrame>
    );
  }

  if (metric.metricType === 'scale') {
    const min = metric.scaleMin ?? 1;
    const max = metric.scaleMax ?? 10;
    const numbers = Array.from({ length: max - min + 1 }, (_, index) => min + index);
    return (
      <MetricFrame metric={metric}>
        <View style={styles.scaleGrid}>
          {numbers.map((number) => (
            <Pressable
              key={number}
              accessibilityRole="button"
              onPress={() => onChange({ ...baseValue, valueNumber: number })}
              style={[styles.scaleButton, baseValue.valueNumber === number && styles.scaleButtonSelected]}
            >
              <Text style={[styles.scaleText, baseValue.valueNumber === number && styles.scaleTextSelected]}>
                {number}
              </Text>
            </Pressable>
          ))}
        </View>
      </MetricFrame>
    );
  }

  if (metric.metricType === 'enum') {
    return (
      <MetricFrame metric={metric}>
        <View style={styles.wrap}>
          {metric.options.map((option) => (
            <Choice
              key={option.id}
              label={option.label}
              selected={baseValue.valueText === option.value}
              onPress={() => onChange({ ...baseValue, valueText: option.value })}
            />
          ))}
        </View>
      </MetricFrame>
    );
  }

  return (
    <MetricFrame metric={metric}>
      <TextInput
        keyboardType={metric.metricType === 'number' ? 'numeric' : 'default'}
        multiline={metric.metricType === 'text'}
        onChangeText={(text) =>
          onChange(
            metric.metricType === 'number'
              ? { ...baseValue, valueNumber: text ? Number(text) : null }
              : { ...baseValue, valueText: text },
          )
        }
        placeholder={metric.metricType === 'number' ? 'Number' : 'Optional note'}
        placeholderTextColor={colors.muted}
        style={[styles.input, metric.metricType === 'text' && styles.textArea]}
        value={
          metric.metricType === 'number'
            ? baseValue.valueNumber == null
              ? ''
              : String(baseValue.valueNumber)
            : baseValue.valueText ?? ''
        }
      />
    </MetricFrame>
  );
}

function MetricFrame({ metric, children }: { metric: Metric; children: React.ReactNode }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.label}>
        {metric.name}
        {metric.required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      {metric.helpText ? <Text style={styles.help}>{metric.helpText}</Text> : null}
      {children}
    </View>
  );
}

function Choice({
  label,
  selected,
  onPress,
  tone = 'blue',
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  tone?: 'blue' | 'green' | 'rose';
}) {
  const selectedStyle =
    tone === 'green' ? styles.choiceGreen : tone === 'rose' ? styles.choiceRose : styles.choiceBlue;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.choice, selected && selectedStyle]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  metric: {
    gap: spacing.sm,
  },
  label: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  help: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  required: {
    color: colors.rose,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  choice: {
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  choiceBlue: {
    backgroundColor: colors.blueSoft,
    borderColor: colors.blue,
  },
  choiceGreen: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  choiceRose: {
    backgroundColor: colors.roseSoft,
    borderColor: colors.rose,
  },
  choiceText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  choiceTextSelected: {
    color: colors.ink,
  },
  scaleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  scaleButton: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  scaleButtonSelected: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  scaleText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  scaleTextSelected: {
    color: '#FFFFFF',
  },
  input: {
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  textArea: {
    minHeight: 78,
    textAlignVertical: 'top',
  },
});

import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/src/components/ui';
import type { TrendSummary } from '@/src/models/types';
import { getTrendSummary } from '@/src/services/trendsService';

export default function TrendsScreen() {
  const [summary, setSummary] = useState<TrendSummary | null>(null);

  useEffect(() => {
    getTrendSummary().then(setSummary);
  }, []);

  if (!summary) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.blue} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Trends</Text>
        <Text style={styles.subtitle}>Pattern-finding without flattening the day into one score.</Text>
      </View>

      <Section title="Domain Averages">
        {summary.domainAverages.length ? (
          summary.domainAverages.map((domain) => (
            <View key={domain.domainId} style={styles.rowCard}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{domain.domainName}</Text>
                <Text style={styles.rowMeta}>7 days: {format(domain.average7)} | 30 days: {format(domain.average30)}</Text>
              </View>
              {domain.direction === 'up' ? (
                <ArrowUpRight color={colors.green} size={22} />
              ) : domain.direction === 'down' ? (
                <ArrowDownRight color={colors.rose} size={22} />
              ) : (
                <ArrowRight color={colors.muted} size={22} />
              )}
            </View>
          ))
        ) : (
          <Empty text="Save a few reviews and this will start to fill in." />
        )}
      </Section>

      <Section title="Completion By Practice">
        {summary.completionByPractice.length ? (
          summary.completionByPractice.map((practice) => (
            <View key={practice.practiceId} style={styles.rowCard}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{practice.practiceName}</Text>
                <Text style={styles.rowMeta}>{practice.trackedCount} tracked entries</Text>
              </View>
              <Text style={styles.metricBig}>{practice.completionRate}%</Text>
            </View>
          ))
        ) : (
          <Empty text="Completion rates appear after entries are saved." />
        )}
      </Section>

      <Section title="Quality Averages">
        {summary.qualityByPractice.length ? (
          summary.qualityByPractice.map((practice) => (
            <View key={practice.practiceId} style={styles.rowCard}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{practice.practiceName}</Text>
                <Text style={styles.rowMeta}>{practice.sampleSize} quality ratings</Text>
              </View>
              <Text style={styles.metricBig}>{practice.average}</Text>
            </View>
          ))
        ) : (
          <Empty text="Quality averages use 1-10 quality metrics." />
        )}
      </Section>

      <Section title="Common Blockers">
        {summary.commonBlockers.length ? (
          summary.commonBlockers.map((blocker) => (
            <View key={blocker.blockerId} style={styles.rowCard}>
              <Text style={styles.rowTitle}>{blocker.blockerName}</Text>
              <Text style={styles.metricBig}>{blocker.count}</Text>
            </View>
          ))
        ) : (
          <Empty text="Blockers will show up once selected in reviews." />
        )}
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

function format(value: number | null) {
  return value == null ? 'n/a' : value.toFixed(1);
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    backgroundColor: colors.paper,
    gap: spacing.xl,
    padding: spacing.lg,
    paddingBottom: 96,
  },
  header: {
    gap: spacing.sm,
  },
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 22,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  sectionBody: {
    gap: spacing.sm,
  },
  rowCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 70,
    padding: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
  },
  rowTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  rowMeta: {
    color: colors.muted,
    fontSize: 13,
  },
  metricBig: {
    color: colors.blue,
    fontSize: 20,
    fontWeight: '900',
  },
  empty: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21,
  },
});

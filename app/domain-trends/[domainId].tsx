import { ArrowLeft } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TrendPracticeCard } from '@/src/components/TrendPracticeCard';
import { colors, spacing } from '@/src/components/ui';
import type { TrendSummary } from '@/src/models/types';
import { getTrendSummary } from '@/src/services/trendsService';

export default function DomainTrendsScreen() {
  const params = useLocalSearchParams<{ domainId?: string }>();
  const [summary, setSummary] = useState<TrendSummary | null>(null);

  useEffect(() => {
    getTrendSummary().then(setSummary);
  }, []);

  const domain = useMemo(() => summary?.domainInsights.find((item) => item.domainId === params.domainId) ?? null, [params.domainId, summary]);
  const practices = useMemo(
    () => summary?.practiceTrends.filter((practice) => practice.domainId === params.domainId) ?? [],
    [params.domainId, summary],
  );
  const domainName = domain?.domainName ?? practices[0]?.domainName ?? 'Domain Trends';

  if (!summary) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.blue} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable accessibilityRole="button" onPress={() => router.replace('/trends')} style={styles.backButton}>
        <ArrowLeft color={colors.ink} size={18} />
        <Text style={styles.backText}>Back to trends</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.eyebrow}>Domain</Text>
        <Text style={styles.title}>{domainName}</Text>
        <Text style={styles.subtitle}>Practice-by-practice overview for this domain.</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.statPill}>
          <Text style={styles.statLabel}>{summary.weekLabel} blend</Text>
          <Text style={styles.statValue}>{formatScore(domain?.score7 ?? null)}</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statLabel}>Month blend</Text>
          <Text style={styles.statValue}>{formatScore(domain?.score30 ?? null)}</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statLabel}>Practices</Text>
          <Text style={styles.statValue}>{domain?.trackedPractices ?? practices.length}</Text>
        </View>
      </View>

      <View style={styles.practiceList}>
        {practices.length ? (
          practices.map((practice) => <TrendPracticeCard key={`${practice.practiceId}-${practice.metricName}`} practice={practice} weekLabel={summary.weekLabel} />)
        ) : (
          <Text style={styles.empty}>No practice stats found for this domain yet.</Text>
        )}
      </View>
    </ScrollView>
  );
}

function formatScore(value: number | null) {
  return value == null ? 'n/a' : `${value.toFixed(1)}/5`;
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  backText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  center: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    backgroundColor: colors.paper,
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: 96,
  },
  empty: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'left',
  },
  eyebrow: {
    color: colors.green,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  header: {
    gap: spacing.sm,
  },
  practiceList: {
    gap: spacing.md,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  statPill: {
    backgroundColor: colors.paper,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minWidth: 120,
    padding: spacing.md,
  },
  statValue: {
    color: colors.blue,
    fontSize: 22,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'left',
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'left',
  },
});

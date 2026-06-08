import { CheckCircle2, Hash, MessageSquareText, Sparkles } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/src/components/ui';
import type { TrendPoint, TrendSummary, TrendWindow } from '@/src/models/types';
import { monthDay } from '@/src/utils/dates';

type PracticeTrend = TrendSummary['practiceTrends'][number];

export function TrendPracticeCard({ practice, weekLabel = 'Week' }: { practice: PracticeTrend; weekLabel?: string }) {
  if (practice.metricKind === 'text') {
    return (
      <View style={styles.practiceCard}>
        <View style={styles.iconTitle}>
          <MessageSquareText color={colors.blue} size={20} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{practice.practiceName}</Text>
            <Text style={styles.rowMeta}>{practice.domainName} | recent entries</Text>
          </View>
        </View>
        {practice.recentEntries.length ? (
          <View style={styles.textList}>
            {practice.recentEntries.map((entry) => (
              <View key={`${practice.practiceId}-${entry.date}-${entry.text}`} style={styles.textEntry}>
                <Text style={styles.textDate}>{monthDay(entry.date)}</Text>
                <Text style={styles.textValue}>{entry.text}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Empty text="No recent text entries yet." />
        )}
      </View>
    );
  }

  return (
    <View style={styles.practiceCard}>
      <View style={styles.rowHeader}>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{practice.practiceName}</Text>
          <Text style={styles.rowMeta}>{practice.domainName} | {practice.metricName}</Text>
        </View>
        <MetricKindBadge kind={practice.metricKind} />
      </View>
      <View style={styles.statGrid}>
        <StatPill label={weekLabel} value={formatWindowAverage(practice.week.average, practice.unitLabel)} />
        <StatPill label="Month" value={formatWindowAverage(practice.month.average, practice.unitLabel)} />
        <StatPill label="All time" value={formatWindowAverage(practice.allTime.average, practice.unitLabel)} />
      </View>
      <View style={styles.chartGrid}>
        <TrendBlock title={weekLabel} unitLabel={practice.unitLabel} window={practice.week} tight />
        <TrendBlock title="Month" unitLabel={practice.unitLabel} window={practice.month} tight />
      </View>
    </View>
  );
}

export function TrendBlock({ title, window, unitLabel, tight = false }: { title: string; window: TrendWindow; unitLabel: string; tight?: boolean }) {
  const max = unitLabel === '%' ? 100 : Math.max(5, ...window.points.map((point) => point.value ?? 0));
  return (
    <View style={[styles.trendBlock, tight && styles.trendBlockTight]}>
      <View style={styles.trendHeader}>
        <Text style={styles.trendTitle}>{title}</Text>
        <Text style={styles.trendAverage}>{formatWindowAverage(window.average, unitLabel)}</Text>
      </View>
      <MiniChart points={window.points} max={max} tight={tight} />
      <Text style={styles.rowMeta}>{window.sampleSize} entries</Text>
    </View>
  );
}

function MiniChart({ points, max, tight }: { points: TrendPoint[]; max: number; tight: boolean }) {
  if (!points.length) return <Text style={styles.emptySmall}>No graph yet</Text>;
  const maxHeight = tight ? 46 : 70;
  return (
    <View style={[styles.chart, tight && styles.chartTight]}>
      {points.map((point, index) => {
        const height = point.value == null || max <= 0 ? 4 : Math.max(4, Math.min(maxHeight, (point.value / max) * maxHeight));
        return (
          <View key={`${point.label}-${index}`} style={styles.chartColumn}>
            <View style={[styles.bar, { height }, point.value == null && styles.barEmpty]} />
            <Text style={styles.chartLabel}>{point.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function MetricKindBadge({ kind }: { kind: PracticeTrend['metricKind'] }) {
  const icon =
    kind === 'complete' ? <CheckCircle2 color={colors.green} size={17} /> :
      kind === 'number' ? <Hash color={colors.blue} size={17} /> :
        <Sparkles color={colors.amber} size={17} />;
  const label = kind === 'complete' ? 'complete' : kind === 'number' ? 'number' : 'quality';
  return (
    <View style={styles.kindBadge}>
      {icon}
      <Text style={styles.kindText}>{label}</Text>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

function formatWindowAverage(value: number | null, unitLabel: string) {
  if (value == null) return 'n/a';
  if (unitLabel === '%') return `${Math.round(value)}%`;
  return value.toFixed(1);
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.blue,
    borderRadius: 4,
    width: 12,
  },
  barEmpty: {
    backgroundColor: colors.softLine,
  },
  chart: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.xs,
    height: 76,
  },
  chartColumn: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
    justifyContent: 'flex-end',
    minWidth: 14,
  },
  chartGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chartLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  chartTight: {
    height: 58,
  },
  empty: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'left',
  },
  emptySmall: {
    color: colors.muted,
    fontSize: 12,
    minHeight: 58,
    textAlign: 'left',
  },
  iconTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  kindBadge: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.sm,
  },
  kindText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  practiceCard: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  rowHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  rowMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'left',
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
  },
  rowTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'left',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
    minWidth: 98,
    padding: spacing.sm,
  },
  statValue: {
    color: colors.blue,
    fontSize: 18,
    fontWeight: '900',
  },
  textDate: {
    color: colors.green,
    fontSize: 13,
    fontWeight: '900',
    minWidth: 74,
    textAlign: 'left',
  },
  textEntry: {
    borderTopColor: colors.softLine,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  textList: {
    gap: 0,
  },
  textValue: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'left',
  },
  trendAverage: {
    color: colors.blue,
    fontSize: 16,
    fontWeight: '900',
  },
  trendBlock: {
    backgroundColor: colors.paper,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.sm,
    minWidth: 150,
    padding: spacing.md,
  },
  trendBlockTight: {
    minWidth: 138,
  },
  trendHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trendTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
  },
});

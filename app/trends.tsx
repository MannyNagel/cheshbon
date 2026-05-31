import { ArrowDownRight, ArrowRight, ArrowUpRight, BookOpenCheck, CheckCircle2, Hash, MessageSquareText, Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DimensionValue } from 'react-native';

import { colors, spacing } from '@/src/components/ui';
import type { TrendPoint, TrendSummary, TrendWindow } from '@/src/models/types';
import { getTrendSummary } from '@/src/services/trendsService';
import { monthDay } from '@/src/utils/dates';

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

  const metricPractices = summary.practiceTrends.filter((practice) => practice.metricKind !== 'text');
  const textPractices = summary.practiceTrends.filter((practice) => practice.metricKind === 'text');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Metrics</Text>
        <Text style={styles.title}>Trends</Text>
        <Text style={styles.subtitle}>
          Blended signals without reducing the work to one score: quality stays 1-5, completion becomes a 1-5 equivalent, and text stays textual.
        </Text>
      </View>

      <Section title="Domain Signal">
        {summary.domainInsights.length ? (
          <View style={styles.domainGrid}>
            {summary.domainInsights.map((domain) => (
              <View key={domain.domainId} style={styles.domainCard}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowTitle}>{domain.domainName}</Text>
                  <DirectionIcon direction={domain.direction} />
                </View>
                <Text style={styles.scoreText}>{formatScore(domain.score7)}</Text>
                <Text style={styles.rowMeta}>
                  7 day blend | 30 day {formatScore(domain.score30)} | {domain.trackedPractices} practices
                </Text>
                <Meter value={domain.score7} max={5} />
              </View>
            ))}
          </View>
        ) : (
          <Empty text="Complete a few reviews and domain patterns will start to appear." />
        )}
      </Section>

      <Section title="Tefillah Unit">
        {summary.prayerUnit ? (
          <View style={styles.panel}>
            <View style={styles.rowHeader}>
              <View style={styles.iconTitle}>
                <BookOpenCheck color={colors.green} size={20} />
                <Text style={styles.panelTitle}>Shacharit · Mincha · Maariv</Text>
              </View>
              <Text style={styles.scoreText}>{formatScore(summary.prayerUnit.score7)}</Text>
            </View>
            <Text style={styles.rowMeta}>Combined 7 day blend | 30 day {formatScore(summary.prayerUnit.score30)}</Text>
            <MiniChart
              max={5}
              points={summary.prayerUnit.parts.map((part) => ({
                label: part.practiceName.slice(0, 3),
                value: part.score7,
              }))}
            />
            <View style={styles.prayerParts}>
              {summary.prayerUnit.parts.map((part) => (
                <View key={part.practiceId} style={styles.partPill}>
                  <Text style={styles.partName}>{part.practiceName}</Text>
                  <Text style={styles.partScore}>{formatScore(part.score7)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <Empty text="Prayer trends will appear after Shacharit, Mincha, or Maariv have entries." />
        )}
      </Section>

      <Section title="Per Practice">
        {metricPractices.length ? (
          metricPractices.map((practice) => (
            <View key={`${practice.practiceId}-${practice.metricName}`} style={styles.practiceCard}>
              <View style={styles.rowHeader}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{practice.practiceName}</Text>
                  <Text style={styles.rowMeta}>{practice.domainName} | {practice.metricName}</Text>
                </View>
                <MetricKindBadge kind={practice.metricKind} />
              </View>
              <View style={styles.windowGrid}>
                <TrendBlock title="Week" unitLabel={practice.unitLabel} window={practice.week} />
                <TrendBlock title="Month" unitLabel={practice.unitLabel} window={practice.month} />
                <TrendBlock title="All time" unitLabel={practice.unitLabel} window={practice.allTime} />
              </View>
            </View>
          ))
        ) : (
          <Empty text="Numeric, completion, and quality practice trends will appear here." />
        )}
      </Section>

      <Section title="Text Entries">
        {textPractices.length ? (
          textPractices.map((practice) => (
            <View key={`${practice.practiceId}-${practice.metricName}`} style={styles.practiceCard}>
              <View style={styles.iconTitle}>
                <MessageSquareText color={colors.blue} size={20} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{practice.practiceName}</Text>
                  <Text style={styles.rowMeta}>{practice.domainName} | recent entries</Text>
                </View>
              </View>
              <View style={styles.textList}>
                {practice.recentEntries.map((entry) => (
                  <View key={`${practice.practiceId}-${entry.date}-${entry.text}`} style={styles.textEntry}>
                    <Text style={styles.textDate}>{monthDay(entry.date)}</Text>
                    <Text style={styles.textValue}>{entry.text}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))
        ) : (
          <Empty text="Text practices will show recent entries instead of a graph." />
        )}
      </Section>

      <Section title="Common Blockers">
        {summary.commonBlockers.length ? (
          <View style={styles.blockerWrap}>
            {summary.commonBlockers.map((blocker) => (
              <View key={blocker.blockerId} style={styles.blockerPill}>
                <Text style={styles.blockerName}>{blocker.blockerName}</Text>
                <Text style={styles.blockerCount}>{blocker.count}</Text>
              </View>
            ))}
          </View>
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
      {children}
    </View>
  );
}

function TrendBlock({ title, window, unitLabel }: { title: string; window: TrendWindow; unitLabel: string }) {
  const max = unitLabel === '%' ? 100 : Math.max(5, ...window.points.map((point) => point.value ?? 0));
  return (
    <View style={styles.trendBlock}>
      <View style={styles.trendHeader}>
        <Text style={styles.trendTitle}>{title}</Text>
        <Text style={styles.trendAverage}>{formatWindowAverage(window.average, unitLabel)}</Text>
      </View>
      <MiniChart points={window.points} max={max} />
      <Text style={styles.rowMeta}>{window.sampleSize} entries</Text>
    </View>
  );
}

function MiniChart({ points, max }: { points: TrendPoint[]; max: number }) {
  if (!points.length) return <Text style={styles.emptySmall}>No graph yet</Text>;
  return (
    <View style={styles.chart}>
      {points.map((point, index) => {
        const height = point.value == null || max <= 0 ? 4 : Math.max(4, Math.min(70, (point.value / max) * 70));
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

function Meter({ value, max }: { value: number | null; max: number }) {
  const width: DimensionValue = value == null ? '0%' : `${Math.max(4, Math.min(100, (value / max) * 100))}%`;
  return (
    <View style={styles.meterTrack}>
      <View style={[styles.meterFill, { width }]} />
    </View>
  );
}

function DirectionIcon({ direction }: { direction: TrendSummary['domainInsights'][number]['direction'] }) {
  if (direction === 'up') return <ArrowUpRight color={colors.green} size={21} />;
  if (direction === 'down') return <ArrowDownRight color={colors.rose} size={21} />;
  return <ArrowRight color={colors.muted} size={21} />;
}

function MetricKindBadge({ kind }: { kind: TrendSummary['practiceTrends'][number]['metricKind'] }) {
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

function formatScore(value: number | null) {
  return value == null ? 'n/a' : `${value.toFixed(1)}/5`;
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
    width: 14,
  },
  barEmpty: {
    backgroundColor: colors.softLine,
  },
  blockerCount: {
    color: colors.blue,
    fontSize: 15,
    fontWeight: '900',
  },
  blockerName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  blockerPill: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  blockerWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  center: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    flex: 1,
    justifyContent: 'center',
  },
  chart: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.xs,
    height: 92,
  },
  chartColumn: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
    justifyContent: 'flex-end',
    minWidth: 18,
  },
  chartLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  container: {
    backgroundColor: colors.paper,
    gap: spacing.xl,
    padding: spacing.lg,
    paddingBottom: 96,
  },
  domainCard: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.sm,
    minWidth: 230,
    padding: spacing.lg,
  },
  domainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
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
    minHeight: 92,
    textAlign: 'left',
  },
  eyebrow: {
    color: colors.green,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  header: {
    gap: spacing.sm,
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
  meterFill: {
    backgroundColor: colors.green,
    borderRadius: 999,
    height: 8,
  },
  meterTrack: {
    backgroundColor: colors.softLine,
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  panelTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'left',
  },
  partName: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  partPill: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  partScore: {
    color: colors.green,
    fontSize: 16,
    fontWeight: '900',
  },
  prayerParts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  practiceCard: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.lg,
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
  scoreText: {
    color: colors.blue,
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'left',
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'left',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 22,
    maxWidth: 720,
    textAlign: 'left',
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
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'left',
  },
  trendAverage: {
    color: colors.blue,
    fontSize: 18,
    fontWeight: '900',
  },
  trendBlock: {
    backgroundColor: colors.paper,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.sm,
    minWidth: 190,
    padding: spacing.md,
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
  windowGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
});

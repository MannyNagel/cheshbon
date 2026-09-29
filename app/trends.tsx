import { ArrowDownRight, ArrowRight, ArrowUpRight, FileText, FlaskConical, RotateCcw, Search, X } from 'lucide-react-native';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { DimensionValue } from 'react-native';

import { TrendPracticeCard } from '@/src/components/TrendPracticeCard';
import { colors, spacing } from '@/src/components/ui';
import type { TrendSummary, TrendWeekMode } from '@/src/models/types';
import { listAvodahExperiments, type AvodahExperimentWithStats } from '@/src/repositories/avodahRepo';
import { updateTrendPreferences } from '@/src/repositories/cheshbonRepo';
import { pushLocalDataToCloudIfSignedIn } from '@/src/services/cloudSyncService';
import { getTrendSummary } from '@/src/services/trendsService';

type SortBy = 'domain' | 'name' | 'kind';
type KindFilter = 'all' | TrendSummary['practiceTrends'][number]['metricKind'];

export default function TrendsScreen() {
  const [summary, setSummary] = useState<TrendSummary | null>(null);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('domain');
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [selectedMetricIds, setSelectedMetricIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [experiments, setExperiments] = useState<AvodahExperimentWithStats[]>([]);

  useEffect(() => {
    Promise.all([getTrendSummary(), listAvodahExperiments()]).then(([nextSummary, nextExperiments]) => {
      setSummary(nextSummary);
      setExperiments(nextExperiments);
    });
  }, []);

  const filteredPractices = useMemo(() => {
    if (!summary) return [];
    const normalizedQuery = query.trim().toLowerCase();
    return [...summary.practiceTrends]
      .filter((practice) => domainFilter === 'all' || practice.domainId === domainFilter)
      .filter((practice) => kindFilter === 'all' || practice.metricKind === kindFilter)
      .filter((practice) => {
        if (!normalizedQuery) return true;
        return `${practice.practiceName} ${practice.domainName} ${practice.metricName}`.toLowerCase().includes(normalizedQuery);
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.practiceName.localeCompare(b.practiceName);
        if (sortBy === 'kind') return a.metricKind.localeCompare(b.metricKind) || a.practiceName.localeCompare(b.practiceName);
        return a.domainName.localeCompare(b.domainName) || a.practiceName.localeCompare(b.practiceName);
      });
  }, [domainFilter, kindFilter, query, sortBy, summary]);

  const selectedPractices = useMemo(() => {
    if (!summary) return [];
    return selectedMetricIds
      .map((metricId) => summary.practiceTrends.find((practice) => practice.metricId === metricId))
      .filter((practice): practice is TrendSummary['practiceTrends'][number] => practice != null);
  }, [selectedMetricIds, summary]);
  const domainChoices = useMemo(() => {
    if (!summary) return [];
    const map = new Map<string, { domainId: string; domainName: string }>();
    for (const domain of summary.domainInsights) {
      map.set(domain.domainId, { domainId: domain.domainId, domainName: domain.domainName });
    }
    for (const practice of summary.practiceTrends) {
      map.set(practice.domainId, { domainId: practice.domainId, domainName: practice.domainName });
    }
    return [...map.values()].sort((a, b) => a.domainName.localeCompare(b.domainName));
  }, [summary]);

  function togglePractice(metricId: string) {
    setSelectedMetricIds((current) => current.includes(metricId) ? current.filter((id) => id !== metricId) : [...current, metricId]);
  }

  async function setWeekMode(weekMode: TrendWeekMode) {
    if (!summary) return;
    if (summary.weekMode === weekMode) return;
    setMessage(null);
    try {
      await updateTrendPreferences({ weekMode });
      try {
        await pushLocalDataToCloudIfSignedIn();
      } catch {
        // The local preference still saved; the next successful app sync will carry it to cloud.
      }
      setSummary(await getTrendSummary());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update week range.');
    }
  }

  if (!summary) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.blue} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Metrics</Text>
        <Text style={styles.title}>Trends</Text>
        <Text style={styles.subtitle}>See how your practices are developing over time.</Text>
      </View>

      <Section title="Week Range">
        <View style={styles.filterPanel}>
          <Text style={styles.rowMeta}>Choose how weekly trend scores are calculated.</Text>
          <ChipRow label="Week">
            <FilterChip label="Sunday to date" selected={summary.weekMode === 'sunday_to_date'} onPress={() => setWeekMode('sunday_to_date')} />
            <FilterChip label="Past 7 days" selected={summary.weekMode === 'rolling_7_days'} onPress={() => setWeekMode('rolling_7_days')} />
          </ChipRow>
          <Pressable accessibilityRole="button" onPress={() => router.push('/weekly-report')} style={styles.reportButton}>
            <FileText color={colors.blue} size={18} />
            <Text style={styles.reportButtonText}>Open weekly report</Text>
          </Pressable>
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>
      </Section>

      <Section title="Foundation Domains">
        {summary.domainInsights.length ? (
          <View style={styles.domainGrid}>
            {summary.domainInsights.map((domain) => (
              <Pressable
                accessibilityRole="button"
                key={domain.domainId}
                onPress={() => router.push({ pathname: '/domain-trends/[domainId]', params: { domainId: domain.domainId } })}
                style={styles.domainCard}
              >
                <View style={styles.rowHeader}>
                  <Text style={styles.rowTitle}>{domain.domainName}</Text>
                  <DirectionIcon direction={domain.direction} />
                </View>
                <Text style={styles.scoreText}>{formatScore(domain.score7)}</Text>
                <Text style={styles.rowMeta}>
                  {summary.weekLabel} blend | Month {formatScore(domain.score30)} | {domain.trackedPractices} practices
                </Text>
                <Meter value={domain.score7} max={5} />
                <Text style={styles.domainLink}>Open domain</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Empty text="Complete a few non-text reviews and domain patterns will start to appear." />
        )}
      </Section>

      {experiments.length ? (
        <Section title="Avodah Experiments">
          <View style={styles.experimentIntro}>
            <Text style={styles.rowMeta}>Experiments are shown as evidence and learning, separate from Foundation scores.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/avodah')} style={styles.reportButton}>
              <FlaskConical color={colors.amber} size={18} />
              <Text style={[styles.reportButtonText, styles.avodahLinkText]}>Manage Avodah</Text>
            </Pressable>
          </View>
          <View style={styles.domainGrid}>
            {experiments.map((experiment) => (
              <Pressable accessibilityRole="button" key={experiment.id} onPress={() => router.push({ pathname: '/avodah/review', params: { id: experiment.id } })} style={styles.experimentCard}>
                <Text style={styles.experimentType}>{experiment.type === 'middah' ? 'Middah' : 'Avodah'} · {experiment.status}</Text>
                <Text style={styles.rowTitle}>{experiment.title}</Text>
                <Text style={styles.experimentBehavior}>{experiment.behavior}</Text>
                <Text style={styles.rowMeta}>{experiment.stats.opportunities} opportunities · {experiment.stats.didWell} strong · {experiment.stats.mixed} mixed · {experiment.stats.missed} missed</Text>
                <Text style={styles.domainLink}>{experiment.stats.evidence.length} reflections recorded</Text>
              </Pressable>
            ))}
          </View>
        </Section>
      ) : null}

      {summary.resetInsights.total ? (
        <Section title="Resets">
          <View style={styles.recoveryPanel}>
            <View style={styles.recoveryHeading}>
              <RotateCcw color={colors.green} size={20} />
              <View style={styles.recoveryHeadingCopy}>
                <Text style={styles.rowTitle}>Getting back on track</Text>
                <Text style={styles.rowMeta}>Reset is an intervention, not a daily goal or score.</Text>
              </View>
            </View>
            <View style={styles.recoveryStats}>
              <ResetStat label="Initiated" value={String(summary.resetInsights.total)} />
              <ResetStat label="Worked" value={String(summary.resetInsights.worked)} />
              <ResetStat label="Partially" value={String(summary.resetInsights.partially)} />
              <ResetStat label="Didn't work" value={String(summary.resetInsights.didNotWork)} />
            </View>
            {summary.resetInsights.recoveryRate != null ? (
              <Text style={styles.recoverySummary}>
                {summary.resetInsights.recoveryRate}% worked when reviewed
                {summary.resetInsights.unrated ? ` | ${summary.resetInsights.unrated} awaiting follow-up` : ''}
              </Text>
            ) : null}
            {summary.resetInsights.mostCommonTrigger ? (
              <Text style={styles.rowMeta}>
                Most common trigger: {summary.resetInsights.mostCommonTrigger}
                {summary.resetInsights.mostCommonTimeOfDay ? ` | Most often: ${summary.resetInsights.mostCommonTimeOfDay.toLowerCase()}` : ''}
              </Text>
            ) : null}
            <View style={styles.triggerWrap}>
              {summary.resetInsights.triggerCounts.map((item) => (
                <View key={item.trigger} style={styles.triggerChip}>
                  <Text style={styles.triggerChipText}>{item.trigger} {item.count}</Text>
                </View>
              ))}
            </View>
          </View>
        </Section>
      ) : null}

      <Section title="Find Practices">
        <View style={styles.filterPanel}>
          <View style={styles.searchRow}>
            <Search color={colors.muted} size={18} />
            <TextInput
              onChangeText={setQuery}
              placeholder="Search practices"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              value={query}
            />
            {query ? (
              <Pressable accessibilityRole="button" onPress={() => setQuery('')} style={styles.clearButton}>
                <X color={colors.ink} size={16} />
              </Pressable>
            ) : null}
          </View>

          <ChipRow label="Sort">
            <FilterChip label="Domain" selected={sortBy === 'domain'} onPress={() => setSortBy('domain')} />
            <FilterChip label="Name" selected={sortBy === 'name'} onPress={() => setSortBy('name')} />
            <FilterChip label="Type" selected={sortBy === 'kind'} onPress={() => setSortBy('kind')} />
          </ChipRow>

          <ChipRow label="Type">
            <FilterChip label="All" selected={kindFilter === 'all'} onPress={() => setKindFilter('all')} />
            <FilterChip label="Quality" selected={kindFilter === 'quality'} onPress={() => setKindFilter('quality')} />
            <FilterChip label="Complete" selected={kindFilter === 'complete'} onPress={() => setKindFilter('complete')} />
            <FilterChip label="Number" selected={kindFilter === 'number'} onPress={() => setKindFilter('number')} />
            <FilterChip label="Choices" selected={kindFilter === 'choice'} onPress={() => setKindFilter('choice')} />
            <FilterChip label="Text" selected={kindFilter === 'text'} onPress={() => setKindFilter('text')} />
          </ChipRow>

          <ChipRow label="Domain">
            <FilterChip label="All" selected={domainFilter === 'all'} onPress={() => setDomainFilter('all')} />
            {domainChoices.map((domain) => (
              <FilterChip key={domain.domainId} label={domain.domainName} selected={domainFilter === domain.domainId} onPress={() => setDomainFilter(domain.domainId)} />
            ))}
          </ChipRow>

          <View style={styles.practiceChipWrap}>
            {filteredPractices.map((practice) => (
              <Pressable
                accessibilityRole="button"
                key={practice.metricId}
                onPress={() => togglePractice(practice.metricId)}
                style={[styles.practiceChip, selectedMetricIds.includes(practice.metricId) && styles.practiceChipSelected]}
              >
                <Text style={[styles.practiceChipText, selectedMetricIds.includes(practice.metricId) && styles.practiceChipTextSelected]}>
                  {practice.isSubPractice ? `${practice.practiceName}: ${practice.metricName}` : practice.practiceName}
                </Text>
                <Text style={[styles.practiceChipMeta, selectedMetricIds.includes(practice.metricId) && styles.practiceChipTextSelected]}>{practice.domainName} | {kindLabel(practice.metricKind)}</Text>
              </Pressable>
            ))}
          </View>

          {selectedMetricIds.length ? (
            <Pressable accessibilityRole="button" onPress={() => setSelectedMetricIds([])} style={styles.resetButton}>
              <Text style={styles.resetText}>Clear selected</Text>
            </Pressable>
          ) : null}
        </View>
      </Section>

      <Section title="Selected Practices">
        {selectedPractices.length ? (
          <View style={styles.practiceList}>
            {selectedPractices.map((practice) => <TrendPracticeCard key={practice.metricId} practice={practice} weekLabel={summary.weekLabel} />)}
          </View>
        ) : (
          <Empty text="Select one or more practice chips to see weekly, monthly, and all-time stats. Text practices show recent entries." />
        )}
      </Section>

    </ScrollView>
  );
}

function ResetStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.recoveryStat}>
      <Text style={styles.recoveryStatValue}>{value}</Text>
      <Text style={styles.recoveryStatLabel}>{label}</Text>
    </View>
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

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.chipRow}>
      <Text style={styles.chipRowLabel}>{label}</Text>
      <View style={styles.chipWrap}>{children}</View>
    </View>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.filterChip, selected && styles.filterChipSelected]}>
      <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{label}</Text>
    </Pressable>
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

function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

function formatScore(value: number | null) {
  return value == null ? 'n/a' : `${value.toFixed(1)}/5`;
}

function kindLabel(kind: TrendSummary['practiceTrends'][number]['metricKind']) {
  if (kind === 'complete') return 'complete';
  if (kind === 'number') return 'number';
  if (kind === 'choice') return 'choices';
  if (kind === 'text') return 'text';
  return 'quality';
}

const styles = StyleSheet.create({
  avodahLinkText: {
    color: colors.amber,
  },
  center: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    flex: 1,
    justifyContent: 'center',
  },
  chipRow: {
    gap: spacing.sm,
  },
  chipRowLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'left',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  clearButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
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
  domainLink: {
    color: colors.blue,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'left',
  },
  empty: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'left',
  },
  experimentBehavior: {
    backgroundColor: colors.amberSoft,
    borderRadius: 8,
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
    padding: spacing.sm,
    textAlign: 'left',
  },
  experimentCard: {
    backgroundColor: '#FFFCF6',
    borderColor: '#E7C98E',
    borderLeftColor: colors.amber,
    borderLeftWidth: 4,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.sm,
    minWidth: 230,
    padding: spacing.lg,
  },
  experimentIntro: {
    gap: spacing.md,
  },
  experimentType: {
    color: colors.amber,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  eyebrow: {
    color: colors.green,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  filterChip: {
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterChipSelected: {
    backgroundColor: colors.blueSoft,
    borderColor: colors.blue,
  },
  filterChipText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  filterChipTextSelected: {
    color: colors.blue,
  },
  filterPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  header: {
    gap: spacing.sm,
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
  message: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'left',
  },
  practiceChip: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    minWidth: 142,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  practiceChipMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  practiceChipSelected: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  practiceChipText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'left',
  },
  practiceChipTextSelected: {
    color: colors.green,
  },
  practiceChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  practiceList: {
    gap: spacing.md,
  },
  resetButton: {
    alignSelf: 'flex-start',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  resetText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  reportButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.blueSoft,
    borderColor: colors.blue,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  reportButtonText: {
    color: colors.blue,
    fontSize: 14,
    fontWeight: '900',
  },
  recoveryHeading: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  recoveryHeadingCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  recoveryPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  recoveryStat: {
    backgroundColor: colors.paper,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minWidth: 120,
    padding: spacing.md,
  },
  recoveryStatLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'left',
  },
  recoveryStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  recoveryStatValue: {
    color: colors.green,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'left',
  },
  recoverySummary: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'left',
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
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    minHeight: 42,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  searchRow: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
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
  triggerChip: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  triggerChipText: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '800',
  },
  triggerWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'left',
  },
});

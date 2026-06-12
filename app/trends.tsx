import { ArrowDownRight, ArrowRight, ArrowUpRight, FileText, Search, Sparkles, X } from 'lucide-react-native';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { DimensionValue } from 'react-native';

import { TrendPracticeCard } from '@/src/components/TrendPracticeCard';
import { colors, spacing } from '@/src/components/ui';
import type { QualitativeTrendSummary, TrendSummary, TrendWeekMode } from '@/src/models/types';
import { updateTrendPreferences } from '@/src/repositories/cheshbonRepo';
import { pushLocalDataToCloudIfSignedIn } from '@/src/services/cloudSyncService';
import { getQualitativeTrendSummary, getTrendSummary } from '@/src/services/trendsService';

type SortBy = 'domain' | 'name' | 'kind';
type KindFilter = 'all' | TrendSummary['practiceTrends'][number]['metricKind'];
type TrendMode = 'qualitative' | 'quantitative';

export default function TrendsScreen() {
  const [summary, setSummary] = useState<TrendSummary | null>(null);
  const [qualitativeSummary, setQualitativeSummary] = useState<QualitativeTrendSummary | null>(null);
  const [mode, setMode] = useState<TrendMode>('qualitative');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('domain');
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [selectedPracticeIds, setSelectedPracticeIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getTrendSummary(), getQualitativeTrendSummary()]).then(([nextSummary, nextQualitativeSummary]) => {
      setSummary(nextSummary);
      setQualitativeSummary(nextQualitativeSummary);
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
    return selectedPracticeIds
      .map((practiceId) => summary.practiceTrends.find((practice) => practice.practiceId === practiceId))
      .filter((practice): practice is TrendSummary['practiceTrends'][number] => practice != null);
  }, [selectedPracticeIds, summary]);
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

  function togglePractice(practiceId: string) {
    setSelectedPracticeIds((current) => current.includes(practiceId) ? current.filter((id) => id !== practiceId) : [...current, practiceId]);
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

  if (!summary || !qualitativeSummary) {
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
        <Text style={styles.subtitle}>Notice how your practices are developing over time.</Text>
        <View style={styles.modeToggle}>
          <ModeButton label="Qualitative" selected={mode === 'qualitative'} onPress={() => setMode('qualitative')} />
          <ModeButton label="Quantitative" selected={mode === 'quantitative'} onPress={() => setMode('quantitative')} />
        </View>
      </View>

      {mode === 'qualitative' ? (
        <QualitativeTrends summary={qualitativeSummary} />
      ) : (
        <>
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

      <Section title="Domains">
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
                key={practice.practiceId}
                onPress={() => togglePractice(practice.practiceId)}
                style={[styles.practiceChip, selectedPracticeIds.includes(practice.practiceId) && styles.practiceChipSelected]}
              >
                <Text style={[styles.practiceChipText, selectedPracticeIds.includes(practice.practiceId) && styles.practiceChipTextSelected]}>{practice.practiceName}</Text>
                <Text style={[styles.practiceChipMeta, selectedPracticeIds.includes(practice.practiceId) && styles.practiceChipTextSelected]}>{practice.domainName} | {kindLabel(practice.metricKind)}</Text>
              </Pressable>
            ))}
          </View>

          {selectedPracticeIds.length ? (
            <Pressable accessibilityRole="button" onPress={() => setSelectedPracticeIds([])} style={styles.resetButton}>
              <Text style={styles.resetText}>Clear selected</Text>
            </Pressable>
          ) : null}
        </View>
      </Section>

      <Section title="Selected Practices">
        {selectedPractices.length ? (
          <View style={styles.practiceList}>
            {selectedPractices.map((practice) => <TrendPracticeCard key={`${practice.practiceId}-${practice.metricName}`} practice={practice} weekLabel={summary.weekLabel} />)}
          </View>
        ) : (
          <Empty text="Select one or more practice chips to see weekly, monthly, and all-time stats. Text practices show recent entries." />
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
        </>
      )}
    </ScrollView>
  );
}

function ModeButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.modeButton, selected && styles.modeButtonSelected]}>
      <Text style={[styles.modeButtonText, selected && styles.modeButtonTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function QualitativeTrends({ summary }: { summary: QualitativeTrendSummary }) {
  return (
    <>
      <View style={styles.qualitativeIntro}>
        <View style={styles.sparkleCircle}>
          <Sparkles color={colors.green} size={19} />
        </View>
        <View style={styles.qualitativeIntroText}>
          <Text style={styles.rowTitle}>A gentler read of the last month</Text>
          <Text style={styles.rowMeta}>
            This view looks for areas of steadiness, areas asking for more care, recurring blockers, and recent words you wrote.
          </Text>
          <Text style={styles.rowMeta}>Looking at {summary.rangeLabel}.</Text>
        </View>
      </View>

      <Section title="Areas Of Strength">
        {summary.succeeding.length ? (
          <View style={styles.insightGrid}>
            {summary.succeeding.map((item) => (
              <InsightCard key={item.domainId} tone="green" title={item.domainName} message={item.message} chips={item.practices} />
            ))}
          </View>
        ) : (
          <Empty text="As more reviews come in, areas of steadiness will appear here." />
        )}
      </Section>

      <Section title="Areas Asking For Attention">
        {summary.needsAttention.length ? (
          <View style={styles.insightGrid}>
            {summary.needsAttention.map((item) => (
              <InsightCard
                key={item.domainId}
                tone="amber"
                title={item.domainName}
                message={item.message}
                chips={[...item.practices, ...item.blockers.map((blocker) => `Blocker: ${blocker}`)]}
              />
            ))}
          </View>
        ) : (
          <Empty text="No clear attention pattern is showing yet. That can simply mean the data is still young." />
        )}
      </Section>

      <Section title="Recurring Blockers">
        {summary.blockerPatterns.length ? (
          <View style={styles.insightGrid}>
            {summary.blockerPatterns.map((item) => (
              <InsightCard
                key={item.blockerName}
                tone="rose"
                title={item.blockerName}
                message={`This blocker has been showing up around ${joinList(item.domainNames)}.`}
                chips={item.practiceNames}
              />
            ))}
          </View>
        ) : (
          <Empty text="Blocker patterns will appear here once blockers repeat across reviews." />
        )}
      </Section>

      <Section title="Recent Notes Worth Revisiting">
        {summary.recentNotes.length ? (
          <View style={styles.noteList}>
            {summary.recentNotes.map((entry) => (
              <View key={`${entry.date}-${entry.practiceName}-${entry.text}`} style={styles.noteCard}>
                <Text style={styles.noteMeta}>{entry.date} | {entry.domainName} | {entry.practiceName}</Text>
                <Text style={styles.noteText}>{entry.text}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Empty text="Notes and text reflections will collect here as you write them." />
        )}
      </Section>
    </>
  );
}

function InsightCard({
  title,
  message,
  chips,
  tone,
}: {
  title: string;
  message: string;
  chips: string[];
  tone: 'green' | 'amber' | 'rose';
}) {
  const toneStyle = tone === 'green' ? styles.insightGreen : tone === 'amber' ? styles.insightAmber : styles.insightRose;
  return (
    <View style={[styles.insightCard, toneStyle]}>
      <Text style={styles.insightTitle}>{title}</Text>
      <Text style={styles.insightMessage}>{message}</Text>
      {chips.length ? (
        <View style={styles.insightChipWrap}>
          {chips.slice(0, 5).map((chip) => (
            <Text key={chip} style={styles.insightChip}>{chip}</Text>
          ))}
        </View>
      ) : null}
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
  if (kind === 'text') return 'text';
  return 'quality';
}

function joinList(values: string[]) {
  if (values.length === 0) return 'several places';
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
}

const styles = StyleSheet.create({
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
  modeButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  modeButtonSelected: {
    backgroundColor: colors.surface,
    borderColor: colors.green,
    borderWidth: 1,
  },
  modeButtonText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '900',
  },
  modeButtonTextSelected: {
    color: colors.green,
  },
  modeToggle: {
    backgroundColor: colors.softLine,
    borderRadius: 8,
    flexDirection: 'row',
    gap: spacing.xs,
    maxWidth: 420,
    padding: spacing.xs,
  },
  insightAmber: {
    backgroundColor: colors.amberSoft,
    borderColor: '#F3C66B',
  },
  insightCard: {
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.md,
    minWidth: 240,
    padding: spacing.lg,
  },
  insightChip: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textAlign: 'left',
  },
  insightChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  insightGreen: {
    backgroundColor: colors.greenSoft,
    borderColor: '#AADBC8',
  },
  insightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  insightMessage: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'left',
  },
  insightRose: {
    backgroundColor: colors.roseSoft,
    borderColor: '#F5B5B0',
  },
  insightTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'left',
  },
  noteCard: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  noteList: {
    gap: spacing.md,
  },
  noteMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'left',
  },
  noteText: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'left',
    writingDirection: 'ltr',
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
  qualitativeIntro: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  qualitativeIntroText: {
    flex: 1,
    gap: spacing.xs,
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
  sparkleCircle: {
    alignItems: 'center',
    backgroundColor: colors.greenSoft,
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    width: 38,
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
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'left',
  },
});

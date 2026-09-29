import { ArrowLeft, Save } from 'lucide-react-native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, spacing } from '@/src/components/ui';
import type { AvodahDecision } from '@/src/models/types';
import {
  getWeeklyAvodahData,
  getWeeklyCheshbon,
  halachicWeekStart,
  saveWeeklyCheshbon,
  type AvodahStats,
  type WeeklyAvodahReflection,
  type WeeklyCheshbon,
} from '@/src/repositories/avodahRepo';
import { pushLocalDataToCloudIfSignedIn } from '@/src/services/cloudSyncService';
import { getWeeklyReportData, type WeeklyReportData } from '@/src/services/weeklyReportService';
import { addDaysIso, monthDay, todayIsoDate } from '@/src/utils/dates';

type ExperimentWeek = Awaited<ReturnType<typeof getWeeklyAvodahData>>[number];

export default function WeeklyCheshbonScreen() {
  const weekStart = halachicWeekStart(todayIsoDate());
  const weekEnd = addDaysIso(weekStart, 6);
  const [review, setReview] = useState<WeeklyCheshbon>({ weekStart, win: '', pattern: '', keep: '', change: '' });
  const [experiments, setExperiments] = useState<ExperimentWeek[]>([]);
  const [foundationData, setFoundationData] = useState<WeeklyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const reportThrough = todayIsoDate() < weekEnd ? todayIsoDate() : weekEnd;
    Promise.all([
      getWeeklyCheshbon(weekStart),
      getWeeklyAvodahData(weekStart),
      getWeeklyReportData({ weekStart, weekEnd, reportThrough, availableFrom: `${weekEnd}T12:00:00` }),
    ])
      .then(([nextReview, nextExperiments, nextFoundationData]) => {
        setReview(nextReview);
        setExperiments(nextExperiments);
        setFoundationData(nextFoundationData);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Could not load weekly Cheshbon.'))
      .finally(() => setLoading(false));
  }, [weekEnd, weekStart]);

  function updateExperiment(id: string, changes: Partial<Pick<ExperimentWeek, 'learning' | 'decision'>>) {
    setExperiments((current) => current.map((item) => item.experiment.id === id ? { ...item, ...changes } : item));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const experimentReviews: WeeklyAvodahReflection[] = experiments.map((item) => ({
        experimentId: item.experiment.id,
        learning: item.learning,
        decision: item.decision,
      }));
      const result = await saveWeeklyCheshbon(review, experimentReviews);
      await pushLocalDataToCloudIfSignedIn();
      if (result.successorId) router.replace({ pathname: '/avodah/edit', params: { id: result.successorId } });
      else router.replace('/');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save weekly Cheshbon.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.amber} /></View>;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}><ArrowLeft color={colors.ink} size={18} /><Text style={styles.backText}>Back</Text></Pressable>
      <View style={styles.header}><Text style={styles.eyebrow}>Weekly reflection</Text><Text style={styles.title}>Weekly Cheshbon</Text><Text style={styles.subtitle}>{monthDay(weekStart)} to {monthDay(weekEnd)}</Text></View>

      <View style={styles.foundationPanel}>
        <Text style={styles.foundationEyebrow}>Foundations</Text>
        <Text style={styles.sectionTitle}>A compact view of the week</Text>
        {foundationData?.domains.filter((domain) => domain.entries > 0).length ? (
          <View style={styles.domainGrid}>{foundationData.domains.filter((domain) => domain.entries > 0).map((domain) => <View key={domain.id} style={styles.domainCard}><Text style={styles.domainName}>{domain.name}</Text><Text style={styles.domainValue}>{domain.average == null ? 'Text only' : `${domain.average.toFixed(1)} / 5`}</Text><Text style={styles.domainMeta}>{domain.entries} entries</Text></View>)}</View>
        ) : <Text style={styles.help}>Complete reviews this week to see a compact Foundation summary.</Text>}
      </View>

      <View style={styles.reflectionPanel}>
        <Field label="A win from this week" value={review.win} onChangeText={(win) => setReview({ ...review, win })} />
        <Field label="A pattern worth noticing" value={review.pattern} onChangeText={(pattern) => setReview({ ...review, pattern })} />
        <Field label="What should I keep doing?" value={review.keep} onChangeText={(keep) => setReview({ ...review, keep })} />
        <Field label="What should I change next week?" value={review.change} onChangeText={(change) => setReview({ ...review, change })} />
      </View>

      {experiments.length ? <View style={styles.experimentSection}><Text style={styles.avodahEyebrow}>Avodah experiments</Text><Text style={styles.sectionTitle}>What did this week teach you?</Text>{experiments.map((item) => <ExperimentReflection key={item.experiment.id} item={item} onChange={(changes) => updateExperiment(item.experiment.id, changes)} />)}</View> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Pressable accessibilityRole="button" disabled={saving} onPress={save} style={styles.saveButton}><Save color="#FFFFFF" size={18} /><Text style={styles.saveText}>{saving ? 'Saving...' : 'Save weekly Cheshbon'}</Text></Pressable>
    </ScrollView>
  );
}

function ExperimentReflection({ item, onChange }: { item: ExperimentWeek; onChange: (changes: Partial<Pick<ExperimentWeek, 'learning' | 'decision'>>) => void }) {
  return <View style={styles.experimentCard}><Text style={styles.experimentType}>{item.experiment.type === 'middah' ? 'Current Middah' : 'Current Avodah'}</Text><Text style={styles.experimentTitle}>{item.experiment.title}</Text><Stats stats={item.stats} /><Field label="What did I learn this week?" value={item.learning} onChangeText={(learning) => onChange({ learning })} /><Text style={styles.label}>Decision</Text><View style={styles.choiceRow}>{(['continue', 'modify', 'graduate', 'abandon'] as AvodahDecision[]).map((decision) => <Choice key={decision} label={decision.charAt(0).toUpperCase() + decision.slice(1)} selected={item.decision === decision} onPress={() => onChange({ decision })} />)}</View></View>;
}
function Stats({ stats }: { stats: AvodahStats }) { return <Text style={styles.stats}>{stats.opportunities} opportunities · {stats.didWell} strong · {stats.mixed} mixed · {stats.missed} missed</Text>; }
function Field({ label, ...props }: { label: string; value: string; onChangeText: (value: string) => void }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} multiline placeholderTextColor={colors.muted} style={styles.input} /></View>; }
function Choice({ selected, label, onPress }: { selected: boolean; label: string; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}><Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  avodahEyebrow: { color: colors.amber, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  backButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: spacing.xs, minHeight: 40 },
  backText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  choice: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, minHeight: 38, paddingHorizontal: spacing.md, justifyContent: 'center' },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choiceSelected: { backgroundColor: colors.amberSoft, borderColor: colors.amber },
  choiceText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  choiceTextSelected: { color: colors.amber },
  container: { backgroundColor: colors.paper, gap: spacing.xl, padding: spacing.lg, paddingBottom: 100 },
  domainCard: { backgroundColor: colors.surface, borderColor: '#D8E0E8', borderRadius: 8, borderWidth: 1, flex: 1, gap: spacing.xs, minWidth: 140, padding: spacing.md },
  domainGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  domainMeta: { color: colors.muted, fontSize: 12 },
  domainName: { color: '#52677D', fontSize: 13, fontWeight: '900' },
  domainValue: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  experimentCard: { backgroundColor: '#FFFCF6', borderColor: '#E7C98E', borderLeftColor: colors.amber, borderLeftWidth: 4, borderRadius: 8, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
  experimentSection: { gap: spacing.md },
  experimentTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', textAlign: 'left' },
  experimentType: { color: colors.amber, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  field: { gap: spacing.sm },
  foundationEyebrow: { color: '#52677D', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  foundationPanel: { backgroundColor: '#F2F5F8', borderColor: '#D8E0E8', borderRadius: 8, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
  header: { gap: spacing.sm },
  help: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'left' },
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, color: colors.ink, fontSize: 15, minHeight: 76, padding: spacing.md, textAlign: 'left', textAlignVertical: 'top', writingDirection: 'ltr' },
  label: { color: colors.ink, fontSize: 14, fontWeight: '900', textAlign: 'left' },
  message: { color: colors.rose, fontSize: 14, textAlign: 'left' },
  reflectionPanel: { gap: spacing.lg },
  saveButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.green, borderRadius: 8, flexDirection: 'row', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.xl },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', textAlign: 'left' },
  stats: { color: colors.muted, fontSize: 13, fontWeight: '700', lineHeight: 19, textAlign: 'left' },
  subtitle: { color: colors.muted, fontSize: 15, textAlign: 'left' },
  title: { color: colors.ink, fontSize: 32, fontWeight: '900', textAlign: 'left' },
  eyebrow: { color: colors.green, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
});

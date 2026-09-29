import { ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, spacing } from '@/src/components/ui';
import type { AvodahDecision } from '@/src/models/types';
import {
  continueAvodahExperiment,
  getAvodahExperiment,
  getFinalAvodahReview,
  saveFinalAvodahReview,
  type AvodahExperimentWithStats,
} from '@/src/repositories/avodahRepo';
import { pushLocalDataToCloudIfSignedIn } from '@/src/services/cloudSyncService';
import { addDaysIso, monthDay, todayIsoDate } from '@/src/utils/dates';

type Helped = 'yes' | 'partially' | 'no';

export default function AvodahFinalReviewScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [experiment, setExperiment] = useState<AvodahExperimentWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [helped, setHelped] = useState<Helped | null>(null);
  const [whatChanged, setWhatChanged] = useState('');
  const [learned, setLearned] = useState('');
  const [decision, setDecision] = useState<AvodahDecision>('continue');
  const [nextReviewDate, setNextReviewDate] = useState(addDaysIso(todayIsoDate(), 14));

  useEffect(() => {
    if (!id) { setMessage('Experiment not found.'); setLoading(false); return; }
    Promise.all([getAvodahExperiment(id), getFinalAvodahReview(id)])
      .then(([nextExperiment, review]) => {
        if (!nextExperiment) throw new Error('Experiment not found.');
        setExperiment(nextExperiment);
        if (review) {
          setHelped(review.helped);
          setWhatChanged(review.whatChanged);
          setLearned(review.learned);
          setDecision(review.decision);
        }
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Could not load final review.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function save() {
    if (!id) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await saveFinalAvodahReview(id, { helped, whatChanged, learned, decision });
      if (decision === 'continue') await continueAvodahExperiment(id, nextReviewDate);
      await pushLocalDataToCloudIfSignedIn();
      if (result.successorId) router.replace({ pathname: '/avodah/edit', params: { id: result.successorId } });
      else router.replace('/avodah');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save final review.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.amber} /></View>;
  if (!experiment) return <View style={styles.center}><Text style={styles.message}>{message ?? 'Experiment not found.'}</Text></View>;

  const stats = experiment.stats;
  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
        <ArrowLeft color={colors.ink} size={18} /><Text style={styles.backText}>Back</Text>
      </Pressable>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{experiment.type === 'middah' ? 'Middah review' : 'Avodah review'}</Text>
        <Text style={styles.title}>{experiment.title}</Text>
        <Text style={styles.subtitle}>{monthDay(experiment.startDate)} to {monthDay(experiment.reviewDate)}</Text>
      </View>

      <View style={styles.summary}>
        <Stat value={stats.opportunities} label="Opportunities" />
        <Stat value={stats.didWell} label={experiment.positiveLabel} />
        <Stat value={stats.mixed} label={experiment.partialLabel} />
        <Stat value={stats.missed} label={experiment.negativeLabel} />
      </View>

      {stats.evidence.length ? (
        <View style={styles.evidencePanel}>
          <Text style={styles.sectionTitle}>Evidence you recorded</Text>
          {stats.evidence.map((item, index) => <View key={`${item.date}-${index}`} style={styles.evidenceItem}><Text style={styles.evidenceDate}>{monthDay(item.date)}</Text><Text style={styles.evidenceText}>{item.reflection}</Text></View>)}
        </View>
      ) : null}

      <View style={styles.field}><Text style={styles.label}>Did this experiment help?</Text><View style={styles.choiceRow}>{(['yes', 'partially', 'no'] as Helped[]).map((value) => <Choice key={value} label={value === 'yes' ? 'Yes' : value === 'partially' ? 'Partially' : 'No'} selected={helped === value} onPress={() => setHelped(value)} />)}</View></View>
      <Field label="What changed?" value={whatChanged} onChangeText={setWhatChanged} placeholder="Describe the evidence, even if the change was small." />
      <Field label="What did you learn?" value={learned} onChangeText={setLearned} placeholder="What would you carry into the next experiment?" />

      <View style={styles.field}>
        <Text style={styles.label}>What comes next?</Text>
        <Text style={styles.help}>Continue keeps this experiment active. Modify creates a linked draft without erasing this history.</Text>
        <View style={styles.choiceRow}>
          {(['continue', 'modify', 'graduate', 'abandon'] as AvodahDecision[]).map((value) => <Choice key={value} label={decisionLabel(value)} selected={decision === value} onPress={() => setDecision(value)} />)}
        </View>
      </View>
      {decision === 'continue' ? <View style={styles.field}><Text style={styles.label}>Next review date</Text><TextInput value={nextReviewDate} onChangeText={setNextReviewDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} style={styles.input} /></View> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Pressable accessibilityRole="button" disabled={saving} onPress={save} style={styles.saveButton}><CheckCircle2 color="#FFFFFF" size={18} /><Text style={styles.saveText}>{saving ? 'Saving...' : 'Complete review'}</Text></Pressable>
    </ScrollView>
  );
}

function Stat({ value, label }: { value: number; label: string }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function Choice({ selected, label, onPress }: { selected: boolean; label: string; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}><Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text></Pressable>; }
function Field({ label, ...props }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} multiline placeholderTextColor={colors.muted} style={[styles.input, styles.multiline]} /></View>; }
function decisionLabel(decision: AvodahDecision) { return decision.charAt(0).toUpperCase() + decision.slice(1); }

const styles = StyleSheet.create({
  backButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: spacing.xs, minHeight: 40 },
  backText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: spacing.xl },
  choice: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, justifyContent: 'center', minHeight: 40, paddingHorizontal: spacing.md },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choiceSelected: { backgroundColor: colors.amberSoft, borderColor: colors.amber },
  choiceText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  choiceTextSelected: { color: colors.amber },
  container: { backgroundColor: colors.paper, gap: spacing.xl, padding: spacing.lg, paddingBottom: 100 },
  evidenceDate: { color: colors.amber, fontSize: 13, fontWeight: '900', minWidth: 62 },
  evidenceItem: { borderTopColor: '#E7C98E', borderTopWidth: 1, flexDirection: 'row', gap: spacing.md, paddingTop: spacing.md },
  evidencePanel: { backgroundColor: '#FFFAEF', borderColor: '#E7C98E', borderRadius: 8, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
  evidenceText: { color: colors.ink, flex: 1, fontSize: 14, lineHeight: 21, textAlign: 'left' },
  eyebrow: { color: colors.amber, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  field: { gap: spacing.sm },
  header: { gap: spacing.sm },
  help: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'left' },
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, color: colors.ink, fontSize: 15, minHeight: 46, padding: spacing.md, textAlign: 'left', writingDirection: 'ltr' },
  label: { color: colors.ink, fontSize: 15, fontWeight: '900', textAlign: 'left' },
  message: { color: colors.rose, fontSize: 14, textAlign: 'left' },
  multiline: { minHeight: 86, textAlignVertical: 'top' },
  saveButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.amber, borderRadius: 8, flexDirection: 'row', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.xl },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', textAlign: 'left' },
  stat: { backgroundColor: colors.surface, borderColor: '#E7C98E', borderRadius: 8, borderWidth: 1, flex: 1, gap: spacing.xs, minWidth: 125, padding: spacing.md },
  statLabel: { color: colors.muted, fontSize: 12, fontWeight: '700', textAlign: 'left' },
  statValue: { color: colors.amber, fontSize: 26, fontWeight: '900', textAlign: 'left' },
  subtitle: { color: colors.muted, fontSize: 15, textAlign: 'left' },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  title: { color: colors.ink, fontSize: 32, fontWeight: '900', textAlign: 'left' },
});

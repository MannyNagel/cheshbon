import { ArrowLeft, Save } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, spacing } from '@/src/components/ui';
import type { AvodahExperimentStatus, AvodahExperimentType } from '@/src/models/types';
import { getAvodahExperiment, saveAvodahExperiment } from '@/src/repositories/avodahRepo';
import { pushLocalDataToCloudIfSignedIn } from '@/src/services/cloudSyncService';
import { addDaysIso, todayIsoDate } from '@/src/utils/dates';

const defaultPrompts = {
  opportunity: 'Did an opportunity arise to practice this today?',
  response: 'How did you respond?',
  reflection: 'What happened? What do you want to remember?',
};

export default function EditAvodahScreen() {
  const params = useLocalSearchParams<{ id?: string; type?: AvodahExperimentType }>();
  const [loading, setLoading] = useState(Boolean(params.id));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [type, setType] = useState<AvodahExperimentType>(params.type === 'middah' ? 'middah' : 'avodah');
  const [status, setStatus] = useState<Extract<AvodahExperimentStatus, 'draft' | 'active'>>('active');
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [behavior, setBehavior] = useState('');
  const [startDate, setStartDate] = useState(todayIsoDate());
  const [reviewDate, setReviewDate] = useState(addDaysIso(todayIsoDate(), 14));
  const [opportunityPrompt, setOpportunityPrompt] = useState(defaultPrompts.opportunity);
  const [responsePrompt, setResponsePrompt] = useState(defaultPrompts.response);
  const [reflectionPrompt, setReflectionPrompt] = useState(defaultPrompts.reflection);
  const [positiveLabel, setPositiveLabel] = useState('Did well');
  const [partialLabel, setPartialLabel] = useState('Mixed');
  const [negativeLabel, setNegativeLabel] = useState('Missed the opportunity');

  useEffect(() => {
    if (!params.id) return;
    getAvodahExperiment(params.id)
      .then((experiment) => {
        if (!experiment) throw new Error('Avodah experiment not found.');
        setType(experiment.type);
        setStatus(experiment.status === 'draft' ? 'draft' : 'active');
        setTitle(experiment.title);
        setGoal(experiment.goal);
        setHypothesis(experiment.hypothesis ?? '');
        setBehavior(experiment.behavior);
        setStartDate(experiment.startDate);
        setReviewDate(experiment.reviewDate);
        setOpportunityPrompt(experiment.opportunityPrompt);
        setResponsePrompt(experiment.responsePrompt);
        setReflectionPrompt(experiment.reflectionPrompt ?? '');
        setPositiveLabel(experiment.positiveLabel);
        setPartialLabel(experiment.partialLabel);
        setNegativeLabel(experiment.negativeLabel);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Could not load experiment.'))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      await saveAvodahExperiment({
        id: params.id,
        type,
        status,
        title,
        goal,
        hypothesis,
        behavior,
        startDate,
        reviewDate,
        opportunityPrompt,
        responsePrompt,
        reflectionPrompt,
        positiveLabel,
        partialLabel,
        negativeLabel,
      });
      await pushLocalDataToCloudIfSignedIn();
      router.replace('/avodah');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save experiment.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.amber} /></View>;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
        <ArrowLeft color={colors.ink} size={18} /><Text style={styles.backText}>Back</Text>
      </Pressable>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Deliberate growth experiment</Text>
        <Text style={styles.title}>{params.id ? 'Edit experiment' : 'Begin an experiment'}</Text>
        <Text style={styles.subtitle}>Choose one focused behavior to practice for a defined period. This is separate from your recurring Foundations.</Text>
      </View>

      <FieldLabel label="Type" />
      <View style={styles.segmentRow}>
        <Choice selected={type === 'avodah'} label="Avodah" onPress={() => setType('avodah')} />
        <Choice selected={type === 'middah'} label="Middah" onPress={() => setType('middah')} />
      </View>
      <Field label="Title" value={title} onChangeText={setTitle} placeholder="Focused learning" />
      <Field label="What is the goal?" value={goal} onChangeText={setGoal} placeholder="What do you want to strengthen or change?" multiline />
      <Field label="What do you think will help?" value={hypothesis} onChangeText={setHypothesis} placeholder="Optional hypothesis" multiline />
      <Field label="The behavior I will practice" value={behavior} onChangeText={setBehavior} placeholder="A concrete action you can recognize" multiline />

      <View style={styles.dateRow}>
        <View style={styles.dateField}><Field label="Start date" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" /></View>
        <View style={styles.dateField}><Field label="Review date" value={reviewDate} onChangeText={setReviewDate} placeholder="YYYY-MM-DD" /></View>
      </View>

      <View style={styles.promptPanel}>
        <Text style={styles.panelTitle}>Daily Cheshbon prompts</Text>
        <Text style={styles.panelCopy}>These appear only while this experiment is active. No score is calculated.</Text>
        <Field label="Opportunity question" value={opportunityPrompt} onChangeText={setOpportunityPrompt} />
        <Field label="Response question" value={responsePrompt} onChangeText={setResponsePrompt} />
        <Field label="Optional reflection question" value={reflectionPrompt} onChangeText={setReflectionPrompt} />
        <Text style={styles.fieldLabel}>Response labels</Text>
        <View style={styles.labelRow}>
          <TextInput value={positiveLabel} onChangeText={setPositiveLabel} style={styles.smallInput} />
          <TextInput value={partialLabel} onChangeText={setPartialLabel} style={styles.smallInput} />
          <TextInput value={negativeLabel} onChangeText={setNegativeLabel} style={styles.smallInput} />
        </View>
      </View>

      <FieldLabel label="Save as" />
      <View style={styles.segmentRow}>
        <Choice selected={status === 'active'} label="Active now" onPress={() => setStatus('active')} />
        <Choice selected={status === 'draft'} label="Draft" onPress={() => setStatus('draft')} />
      </View>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Pressable accessibilityRole="button" disabled={saving} onPress={save} style={styles.saveButton}>
        <Save color="#FFFFFF" size={18} /><Text style={styles.saveText}>{saving ? 'Saving...' : 'Save experiment'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field({ label, multiline = false, ...props }: { label: string; multiline?: boolean; value: string; onChangeText: (value: string) => void; placeholder?: string }) {
  return <View style={styles.field}><FieldLabel label={label} /><TextInput {...props} multiline={multiline} placeholderTextColor={colors.muted} style={[styles.input, multiline && styles.multiline]} /></View>;
}

function FieldLabel({ label }: { label: string }) { return <Text style={styles.fieldLabel}>{label}</Text>; }

function Choice({ selected, label, onPress }: { selected: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}><Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  backButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: spacing.xs, minHeight: 40 },
  backText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  choice: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, minHeight: 42, minWidth: 110, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  choiceSelected: { backgroundColor: colors.amberSoft, borderColor: colors.amber },
  choiceText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  choiceTextSelected: { color: colors.amber },
  container: { backgroundColor: colors.paper, gap: spacing.lg, padding: spacing.lg, paddingBottom: 100 },
  dateField: { flex: 1, minWidth: 150 },
  dateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  eyebrow: { color: colors.amber, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  field: { gap: spacing.sm },
  fieldLabel: { color: colors.ink, fontSize: 14, fontWeight: '900', textAlign: 'left' },
  header: { gap: spacing.sm },
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, color: colors.ink, fontSize: 15, minHeight: 46, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, textAlign: 'left', writingDirection: 'ltr' },
  labelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  message: { color: colors.rose, fontSize: 14, textAlign: 'left' },
  multiline: { minHeight: 82, textAlignVertical: 'top' },
  panelCopy: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'left' },
  panelTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', textAlign: 'left' },
  promptPanel: { backgroundColor: '#FFFAEF', borderColor: '#E7C98E', borderRadius: 8, borderWidth: 1, gap: spacing.lg, padding: spacing.lg },
  saveButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.amber, borderRadius: 8, flexDirection: 'row', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.xl },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  smallInput: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 14, minHeight: 44, minWidth: 140, paddingHorizontal: spacing.md, textAlign: 'left' },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, maxWidth: 680, textAlign: 'left' },
  title: { color: colors.ink, fontSize: 32, fontWeight: '900', textAlign: 'left' },
});

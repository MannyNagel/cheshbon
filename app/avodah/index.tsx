import { ArrowLeft, ArrowRight, CirclePlus, FlaskConical, Pencil, Sparkles } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/src/components/ui';
import { listAvodahExperiments, type AvodahExperimentWithStats } from '@/src/repositories/avodahRepo';
import { monthDay } from '@/src/utils/dates';

export default function AvodahScreen() {
  const [experiments, setExperiments] = useState<AvodahExperimentWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      listAvodahExperiments()
        .then((rows) => {
          if (active) setExperiments(rows);
        })
        .catch((error) => {
          if (active) setMessage(error instanceof Error ? error.message : 'Could not load avodah experiments.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const current = experiments.filter((experiment) => experiment.status === 'active');
  const drafts = experiments.filter((experiment) => experiment.status === 'draft' || experiment.status === 'reviewing');
  const history = experiments.filter((experiment) => ['graduated', 'modified', 'abandoned'].includes(experiment.status));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.backButton}>
        <ArrowLeft color={colors.ink} size={18} />
        <Text style={styles.backText}>Back to Today</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.eyebrow}>Deliberate growth</Text>
        <Text style={styles.title}>Avodah</Text>
        <Text style={styles.subtitle}>Foundations show how you are living. Avodah names what you are deliberately trying to change right now.</Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/avodah/edit', params: { type: 'avodah' } })} style={styles.primaryButton}>
          <CirclePlus color="#FFFFFF" size={18} />
          <Text style={styles.primaryButtonText}>New Avodah</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/avodah/edit', params: { type: 'middah' } })} style={styles.secondaryButton}>
          <Sparkles color={colors.amber} size={18} />
          <Text style={styles.secondaryButtonText}>New Middah</Text>
        </Pressable>
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}
      {loading ? <ActivityIndicator color={colors.amber} /> : null}

      <ExperimentSection title="Current" empty="No active Avodah or Middah yet." experiments={current} />
      <ExperimentSection title="Drafts and reviews" empty="No experiments waiting for attention." experiments={drafts} />
      <ExperimentSection title="History" empty="Graduated, modified, and abandoned experiments will remain here." experiments={history} />
    </ScrollView>
  );
}

function ExperimentSection({ title, empty, experiments }: { title: string; empty: string; experiments: AvodahExperimentWithStats[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {experiments.length ? (
        <View style={styles.list}>
          {experiments.map((experiment) => <ExperimentCard experiment={experiment} key={experiment.id} />)}
        </View>
      ) : <Text style={styles.empty}>{empty}</Text>}
    </View>
  );
}

function ExperimentCard({ experiment }: { experiment: AvodahExperimentWithStats }) {
  const terminal = ['graduated', 'modified', 'abandoned'].includes(experiment.status);
  return (
    <View style={[styles.card, experiment.type === 'middah' && styles.middahCard]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardEyebrow}>{experiment.type === 'middah' ? 'Current Middah' : 'Current Avodah'} · {statusLabel(experiment.status)}</Text>
          <Text style={styles.cardTitle}>{experiment.title}</Text>
        </View>
        <FlaskConical color={colors.amber} size={20} />
      </View>
      <Text style={styles.goal}>{experiment.goal}</Text>
      <View style={styles.behaviorBox}>
        <Text style={styles.behaviorLabel}>Behavior</Text>
        <Text style={styles.behavior}>{experiment.behavior}</Text>
      </View>
      <Text style={styles.meta}>{monthDay(experiment.startDate)} to {monthDay(experiment.reviewDate)} · {experiment.stats.opportunities} opportunities</Text>
      <View style={styles.cardActions}>
        {!terminal ? (
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/avodah/edit', params: { id: experiment.id } })} style={styles.smallButton}>
            <Pencil color={colors.ink} size={16} />
            <Text style={styles.smallButtonText}>Edit</Text>
          </Pressable>
        ) : null}
        {experiment.finalReviewDue || experiment.status === 'reviewing' ? (
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/avodah/review', params: { id: experiment.id } })} style={styles.reviewButton}>
            <Text style={styles.reviewButtonText}>Final review</Text>
            <ArrowRight color="#FFFFFF" size={16} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function statusLabel(status: AvodahExperimentWithStats['status']) {
  if (status === 'reviewing') return 'Ready to review';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

const styles = StyleSheet.create({
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  backButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: spacing.xs, minHeight: 40 },
  backText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  behavior: { color: colors.ink, fontSize: 15, fontWeight: '800', lineHeight: 21, textAlign: 'left' },
  behaviorBox: { backgroundColor: colors.amberSoft, borderRadius: 8, gap: spacing.xs, padding: spacing.md },
  behaviorLabel: { color: colors.amber, fontSize: 11, fontWeight: '900', textAlign: 'left', textTransform: 'uppercase' },
  card: { backgroundColor: colors.surface, borderColor: '#E7C98E', borderLeftColor: colors.amber, borderLeftWidth: 4, borderRadius: 8, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cardEyebrow: { color: colors.amber, fontSize: 12, fontWeight: '900', textAlign: 'left', textTransform: 'uppercase' },
  cardHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  cardTitle: { color: colors.ink, fontSize: 22, fontWeight: '900', textAlign: 'left' },
  cardTitleBlock: { flex: 1, gap: spacing.xs },
  container: { backgroundColor: colors.paper, gap: spacing.xl, padding: spacing.lg, paddingBottom: 100 },
  empty: { color: colors.muted, fontSize: 15, lineHeight: 21, textAlign: 'left' },
  eyebrow: { color: colors.amber, fontSize: 13, fontWeight: '900', textAlign: 'left', textTransform: 'uppercase' },
  goal: { color: colors.ink, fontSize: 16, lineHeight: 23, textAlign: 'left' },
  header: { gap: spacing.sm },
  list: { gap: spacing.md },
  message: { color: colors.rose, fontSize: 14, textAlign: 'left' },
  meta: { color: colors.muted, fontSize: 13, fontWeight: '700', textAlign: 'left' },
  middahCard: { borderLeftColor: '#D97706' },
  primaryButton: { alignItems: 'center', backgroundColor: colors.amber, borderRadius: 8, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.lg },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  reviewButton: { alignItems: 'center', backgroundColor: colors.amber, borderRadius: 8, flexDirection: 'row', gap: spacing.sm, minHeight: 40, paddingHorizontal: spacing.md },
  reviewButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  secondaryButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: '#E7C98E', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.lg },
  secondaryButtonText: { color: colors.amber, fontSize: 14, fontWeight: '900' },
  section: { gap: spacing.md },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '900', textAlign: 'left' },
  smallButton: { alignItems: 'center', borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 40, paddingHorizontal: spacing.md },
  smallButtonText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 23, maxWidth: 720, textAlign: 'left' },
  title: { color: colors.ink, fontSize: 34, fontWeight: '900', textAlign: 'left' },
});

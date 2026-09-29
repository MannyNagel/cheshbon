import { FlaskConical } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, spacing } from '@/src/components/ui';
import type { AvodahDailyEntry, AvodahExperiment, AvodahResponse } from '@/src/models/types';

type Props = {
  experiments: AvodahExperiment[];
  entries: Record<string, AvodahDailyEntry>;
  reviewDate: string;
  onChange: (entry: AvodahDailyEntry) => void;
};

export function AvodahDailyReviewSection({ experiments, entries, reviewDate, onChange }: Props) {
  if (!experiments.length) return null;
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>Deliberate growth</Text>
        <Text style={styles.title}>Current Avodah</Text>
        <Text style={styles.description}>Notice what happened today. This is evidence for learning, not a score.</Text>
      </View>
      {experiments.map((experiment) => {
        const entry = entries[experiment.id] ?? {
          id: '', experimentId: experiment.id, reviewDate, opportunity: null, response: null, reflection: null,
        };
        const update = (changes: Partial<AvodahDailyEntry>) => onChange({ ...entry, ...changes });
        return (
          <View key={experiment.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleBlock}>
                <Text style={styles.cardEyebrow}>{experiment.type === 'middah' ? 'Current Middah' : 'Current Avodah'}</Text>
                <Text style={styles.cardTitle}>{experiment.title}</Text>
              </View>
              <FlaskConical color={colors.amber} size={20} />
            </View>
            <View style={styles.behaviorBox}><Text style={styles.behaviorLabel}>Today’s practice</Text><Text style={styles.behavior}>{experiment.behavior}</Text></View>
            <Question text={experiment.opportunityPrompt} />
            <View style={styles.optionRow}>
              <Option label="Yes" selected={entry.opportunity === true} onPress={() => update({ opportunity: true })} />
              <Option label="No" selected={entry.opportunity === false} onPress={() => update({ opportunity: false, response: null, reflection: null })} />
            </View>
            {entry.opportunity === true ? (
              <>
                <Question text={experiment.responsePrompt} />
                <View style={styles.responseRow}>
                  <Option label={experiment.positiveLabel} selected={entry.response === 'did_well'} onPress={() => update({ response: 'did_well' })} />
                  <Option label={experiment.partialLabel} selected={entry.response === 'mixed'} onPress={() => update({ response: 'mixed' })} />
                  <Option label={experiment.negativeLabel} selected={entry.response === 'missed'} onPress={() => update({ response: 'missed' })} />
                </View>
                {experiment.reflectionPrompt ? (
                  <View style={styles.reflection}>
                    <Question text={experiment.reflectionPrompt} />
                    <TextInput multiline onChangeText={(reflection) => update({ reflection })} placeholder="Optional reflection" placeholderTextColor={colors.muted} style={styles.input} value={entry.reflection ?? ''} />
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function Question({ text }: { text: string }) { return <Text style={styles.question}>{text}</Text>; }
function Option({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.option, selected && styles.optionSelected]}><Text style={[styles.optionText, selected && styles.optionTextSelected]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  behavior: { color: colors.ink, fontSize: 15, fontWeight: '800', lineHeight: 21, textAlign: 'left' },
  behaviorBox: { backgroundColor: colors.amberSoft, borderRadius: 8, gap: spacing.xs, padding: spacing.md },
  behaviorLabel: { color: colors.amber, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  card: { backgroundColor: '#FFFCF6', borderColor: '#E7C98E', borderLeftColor: colors.amber, borderLeftWidth: 4, borderRadius: 8, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
  cardEyebrow: { color: colors.amber, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  cardHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  cardTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', textAlign: 'left' },
  cardTitleBlock: { flex: 1, gap: spacing.xs },
  description: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'left' },
  eyebrow: { color: colors.amber, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  heading: { gap: spacing.xs },
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, color: colors.ink, fontSize: 15, minHeight: 70, padding: spacing.md, textAlign: 'left', textAlignVertical: 'top', writingDirection: 'ltr' },
  option: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, justifyContent: 'center', minHeight: 40, paddingHorizontal: spacing.md },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  optionSelected: { backgroundColor: colors.amberSoft, borderColor: colors.amber },
  optionText: { color: colors.ink, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  optionTextSelected: { color: colors.amber },
  question: { color: colors.ink, fontSize: 15, fontWeight: '800', lineHeight: 21, textAlign: 'left' },
  reflection: { gap: spacing.sm },
  responseRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  section: { gap: spacing.md },
  title: { color: colors.ink, fontSize: 22, fontWeight: '900', textAlign: 'left' },
});

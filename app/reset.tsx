import { ArrowLeft, Check, RotateCcw } from 'lucide-react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, spacing } from '@/src/components/ui';
import type { ResetEvent } from '@/src/models/types';
import { createResetEvent } from '@/src/repositories/cheshbonRepo';
import { pushLocalDataToCloudIfSignedIn } from '@/src/services/cloudSyncService';

const triggers = ['Unstructured time', 'Phone / computer', 'Tired', 'Plans changed', 'Other'];

export default function ResetScreen() {
  const [trigger, setTrigger] = useState('');
  const [triggerDetail, setTriggerDetail] = useState('');
  const [whatMattersNext, setWhatMattersNext] = useState('');
  const [firstAction, setFirstAction] = useState('');
  const [savedReset, setSavedReset] = useState<ResetEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function startReset() {
    setSaving(true);
    setMessage(null);
    try {
      const event = await createResetEvent({ trigger, triggerDetail, whatMattersNext, firstAction });
      setSavedReset(event);
      try {
        await pushLocalDataToCloudIfSignedIn();
      } catch {
        setMessage('Reset saved locally. It will upload with the next successful sync.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start the reset.');
    } finally {
      setSaving(false);
    }
  }

  if (savedReset) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.confirmation}>
          <View style={styles.confirmIcon}>
            <Check color="#FFFFFF" size={26} strokeWidth={3} />
          </View>
          <Text style={styles.eyebrow}>{formatResetTime(savedReset.initiatedAt)}</Text>
          <Text style={styles.title}>Reset started</Text>
          <Text style={styles.confirmCopy}>The past part of the day is over. Begin again from here.</Text>
          <View style={styles.focusBox}>
            <Text style={styles.focusLabel}>What matters now</Text>
            <Text style={styles.focusText}>{savedReset.whatMattersNext}</Text>
            {savedReset.firstAction ? (
              <>
                <View style={styles.divider} />
                <Text style={styles.focusLabel}>First action</Text>
                <Text style={styles.actionText}>{savedReset.firstAction}</Text>
              </>
            ) : null}
          </View>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Begin now</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
        <ArrowLeft color={colors.ink} size={18} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={styles.resetMark}>
          <RotateCcw color={colors.green} size={22} />
        </View>
        <Text style={styles.eyebrow}>A clean next step</Text>
        <Text style={styles.title}>Reset</Text>
        <Text style={styles.subtitle}>No postmortem right now. Just choose where you are going next.</Text>
      </View>

      <View style={styles.form}>
        <Field label="What knocked me off track?">
          <View style={styles.triggerGrid}>
            {triggers.map((option) => {
              const selected = trigger === option;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={option}
                  onPress={() => setTrigger(option)}
                  style={[styles.triggerButton, selected && styles.triggerButtonSelected]}
                >
                  <Text style={[styles.triggerText, selected && styles.triggerTextSelected]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
          {trigger === 'Other' ? (
            <TextInput
              onChangeText={setTriggerDetail}
              placeholder="What happened?"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={triggerDetail}
            />
          ) : null}
        </Field>

        <Field label="What's the ONE thing that matters next?">
          <TextInput
            autoFocus={false}
            onChangeText={setWhatMattersNext}
            placeholder="Example: Get a strong learning seder in"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={whatMattersNext}
          />
        </Field>

        <Field label="First action">
          <TextInput
            onChangeText={setFirstAction}
            placeholder="Optional: the physical action that starts it"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={firstAction}
          />
        </Field>
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <Pressable accessibilityRole="button" disabled={saving} onPress={startReset} style={styles.primaryButton}>
        {saving ? <ActivityIndicator color="#FFFFFF" /> : <RotateCcw color="#FFFFFF" size={19} />}
        <Text style={styles.primaryButtonText}>{saving ? 'Starting...' : 'Start reset'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function formatResetTime(value: string) {
  return `Reset at ${new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

const styles = StyleSheet.create({
  actionText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 23,
  },
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 40,
  },
  backText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  confirmation: {
    alignItems: 'flex-start',
    gap: spacing.md,
    marginHorizontal: 'auto',
    maxWidth: 560,
    paddingTop: spacing.xl,
    width: '100%',
  },
  confirmCopy: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 23,
  },
  confirmIcon: {
    alignItems: 'center',
    backgroundColor: colors.green,
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  container: {
    backgroundColor: colors.paper,
    gap: spacing.xl,
    minHeight: '100%',
    padding: spacing.xl,
    paddingBottom: 120,
  },
  divider: {
    backgroundColor: colors.softLine,
    height: 1,
    width: '100%',
  },
  eyebrow: {
    color: colors.green,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  field: {
    gap: spacing.sm,
  },
  focusBox: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
    width: '100%',
  },
  focusLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  focusText: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: '900',
    lineHeight: 28,
  },
  form: {
    gap: spacing.xl,
    marginHorizontal: 'auto',
    maxWidth: 680,
    width: '100%',
  },
  header: {
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginHorizontal: 'auto',
    maxWidth: 680,
    width: '100%',
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    textAlign: 'left',
  },
  label: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  message: {
    color: colors.rose,
    fontSize: 14,
    marginHorizontal: 'auto',
    maxWidth: 680,
    width: '100%',
  },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.green,
    borderRadius: 8,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginHorizontal: 'auto',
    maxWidth: 680,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    width: '100%',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  resetMark: {
    alignItems: 'center',
    backgroundColor: colors.greenSoft,
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 520,
  },
  title: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: '900',
  },
  triggerButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  triggerButtonSelected: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  triggerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  triggerText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  triggerTextSelected: {
    color: colors.green,
    fontWeight: '900',
  },
});

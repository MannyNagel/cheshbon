import { Check, LogIn, ShieldCheck, Sparkles, UserPlus } from 'lucide-react-native';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, spacing } from '@/src/components/ui';
import {
  completeOnboarding,
  getOnboardingPracticeOptions,
  getOnboardingStatus,
  type OnboardingPracticeOption,
  type OnboardingStatus,
} from '@/src/repositories/cheshbonRepo';
import {
  completeOAuthRedirectIfPresent,
  getCloudStatus,
  pullCloudDataToLocalIfAvailable,
  pushLocalDataToCloudIfSignedIn,
  signInToCloud,
  signInWithGoogle,
  signUpForCloud,
  type CloudStatus,
} from '@/src/services/cloudSyncService';
import { scheduleAccessHandleBusyReload } from '@/src/utils/accessHandleRecovery';

export default function WelcomeScreen() {
  const [cloudStatus, setCloudStatus] = useState<CloudStatus | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  const [practiceOptions, setPracticeOptions] = useState<OnboardingPracticeOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [authMode, setAuthMode] = useState<'create' | 'signIn' | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const authRedirectHandledRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!authRedirectHandledRef.current) {
        authRedirectHandledRef.current = true;
        const authMessage = await completeOAuthRedirectIfPresent();
        if (authMessage) {
          setMessage(authMessage);
          await pullCloudDataToLocalIfAvailable();
        }
      }
      const [nextCloudStatus, nextOnboardingStatus, nextPracticeOptions] = await Promise.all([
        getCloudStatus().catch(() => ({ configured: true, signedIn: false, email: null, name: null, lastSyncedAt: null })),
        getOnboardingStatus(),
        getOnboardingPracticeOptions(),
      ]);
      setCloudStatus(nextCloudStatus);
      setOnboardingStatus(nextOnboardingStatus);
      setPracticeOptions(nextPracticeOptions);
      setSelectedIds((current) => {
        if (current.length) return current;
        return nextPracticeOptions.filter((practice) => practice.enabled).map((practice) => practice.routinePracticeId);
      });
      if (nextOnboardingStatus.completed && nextCloudStatus.signedIn) {
        router.replace('/');
      }
    } catch (error) {
      if (scheduleAccessHandleBusyReload(error)) return;
      setMessage(error instanceof Error ? error.message : 'Welcome could not load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groupedPractices = useMemo(() => {
    const groups: Array<{ title: string; practices: OnboardingPracticeOption[] }> = [];
    for (const practice of practiceOptions) {
      const existing = groups.find((group) => group.title === practice.routineName);
      if (existing) {
        existing.practices.push(practice);
      } else {
        groups.push({ title: practice.routineName, practices: [practice] });
      }
    }
    return groups;
  }, [practiceOptions]);

  async function runAuthAction(action: () => Promise<unknown>, successMessage: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage(successMessage);
      await pullCloudDataToLocalIfAvailable();
      await load();
    } catch (error) {
      if (scheduleAccessHandleBusyReload(error)) return;
      setMessage(error instanceof Error ? error.message : 'Account action failed.');
    } finally {
      setBusy(false);
    }
  }

  async function finishSetup() {
    setBusy(true);
    setMessage(null);
    try {
      await completeOnboarding(selectedIds);
      await pushLocalDataToCloudIfSignedIn();
      router.replace('/');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Setup could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  function togglePractice(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  if (loading || !cloudStatus || !onboardingStatus) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.blue} />
      </View>
    );
  }

  const signedIn = cloudStatus.signedIn;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <Image
          accessibilityIgnoresInvertColors
          accessible
          accessibilityLabel="Daily Cheshbon logo"
          resizeMode="contain"
          source={require('@/assets/daily-cheshbon-logo-title.png')}
          style={styles.logo}
        />
        <Text style={styles.eyebrow}>Welcome</Text>
        <Text style={styles.title}>Build a nightly cheshbon that feels honest and doable.</Text>
        <Text style={styles.subtitle}>
          Daily Cheshbon helps you pause at the end of the day, review what mattered, and notice the patterns that shape growth.
        </Text>
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      {!signedIn ? (
        <>
          <View style={styles.panel}>
            <IntroRow
              icon={<Sparkles color={colors.green} size={18} />}
              title="Start small"
              text="Begin with a few practices that matter now. You can add, remove, and rearrange later."
            />
            <IntroRow
              icon={<ShieldCheck color={colors.blue} size={18} />}
              title="Keep it with you"
              text="Create an account so your cheshbon can follow you between phone and computer."
            />
            <IntroRow
              icon={<Check color={colors.green} size={18} />}
              title="Review at night"
              text="The app is built for a calm nightly review, not constant tracking during the day."
            />
          </View>

          <View style={styles.accountPanel}>
            <Text style={styles.sectionTitle}>Get started</Text>
            <View style={styles.actions}>
              <ActionButton
                disabled={busy}
                icon={<LogIn color={colors.ink} size={17} />}
                label="Sign in with Google"
                onPress={() => runAuthAction(() => signInWithGoogle('/welcome'), 'Redirecting to Google.')}
              />
              <ActionButton
                disabled={busy}
                icon={<UserPlus color={colors.ink} size={17} />}
                label="Create account"
                onPress={() => setAuthMode('create')}
              />
              <ActionButton
                disabled={busy}
                icon={<LogIn color={colors.ink} size={17} />}
                label="Sign in"
                onPress={() => setAuthMode('signIn')}
              />
            </View>
            {authMode ? (
              <View style={styles.authForm}>
                {authMode === 'create' ? (
                  <TextInput
                    autoCapitalize="words"
                    onChangeText={setFullName}
                    placeholder="Name"
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                    value={fullName}
                  />
                ) : null}
                <TextInput
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onChangeText={setEmail}
                  placeholder="Email"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  value={email}
                />
                <TextInput
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor={colors.muted}
                  secureTextEntry
                  style={styles.input}
                  value={password}
                />
                <ActionButton
                  disabled={busy}
                  icon={authMode === 'create' ? <UserPlus color={colors.ink} size={17} /> : <LogIn color={colors.ink} size={17} />}
                  label={authMode === 'create' ? 'Create account' : 'Sign in'}
                  onPress={() =>
                    authMode === 'create'
                      ? runAuthAction(() => signUpForCloud(fullName, email, password), 'Account created. If email confirmation is required, check your inbox.')
                      : runAuthAction(() => signInToCloud(email, password), 'Signed in.')
                  }
                />
              </View>
            ) : null}
          </View>
        </>
      ) : (
        <View style={styles.setupPanel}>
          <View style={styles.setupHeader}>
            <Text style={styles.sectionTitle}>Choose your starting practices</Text>
            <Text style={styles.bodyText}>
              These are the current recommended defaults. Keep what feels useful for now. You can change everything later from Practices.
            </Text>
          </View>
          {groupedPractices.map((group) => (
            <View key={group.title} style={styles.practiceGroup}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              {group.practices.map((practice) => {
                const selected = selectedIds.includes(practice.routinePracticeId);
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    key={practice.routinePracticeId}
                    onPress={() => togglePractice(practice.routinePracticeId)}
                    style={[styles.practiceRow, selected && styles.practiceRowSelected]}
                  >
                    <View style={[styles.checkBox, selected && styles.checkBoxSelected]}>
                      {selected ? <Check color="#FFFFFF" size={14} /> : null}
                    </View>
                    <View style={styles.practiceText}>
                      <Text style={styles.practiceName}>{practice.practiceName}</Text>
                      <Text style={styles.practiceMeta}>
                        {practice.reviewSectionName} · {practice.domainName}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
          <Pressable accessibilityRole="button" disabled={busy || selectedIds.length === 0} onPress={finishSetup} style={[styles.primaryButton, (busy || selectedIds.length === 0) && styles.disabled]}>
            <Text style={styles.primaryButtonText}>{busy ? 'Saving...' : 'Finish setup'}</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function IntroRow({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <View style={styles.introRow}>
      <View style={styles.introIcon}>{icon}</View>
      <View style={styles.introText}>
        <Text style={styles.smallTitle}>{title}</Text>
        <Text style={styles.bodyText}>{text}</Text>
      </View>
    </View>
  );
}

function ActionButton({
  disabled,
  icon,
  label,
  onPress,
}: {
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.actionButton, disabled && styles.disabled]}>
      {icon}
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', backgroundColor: colors.paper, flex: 1, justifyContent: 'center' },
  container: {
    backgroundColor: colors.paper,
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: 96,
  },
  hero: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  logo: {
    alignSelf: 'flex-start',
    height: 116,
    width: 220,
  },
  eyebrow: {
    color: colors.green,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 39,
    textAlign: 'left',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 17,
    lineHeight: 25,
    textAlign: 'left',
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  accountPanel: {
    backgroundColor: colors.blueSoft,
    borderColor: '#BFD2F7',
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  setupPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  setupHeader: {
    gap: spacing.xs,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: '900',
    textAlign: 'left',
  },
  introRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  introIcon: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  introText: {
    flex: 1,
    gap: spacing.xs,
  },
  smallTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'left',
  },
  bodyText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'left',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  actionText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  authForm: {
    gap: spacing.sm,
  },
  input: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  message: {
    color: colors.green,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
    textAlign: 'left',
  },
  practiceGroup: {
    gap: spacing.sm,
  },
  groupTitle: {
    color: colors.green,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  practiceRow: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 58,
    padding: spacing.md,
  },
  practiceRowSelected: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  checkBox: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 6,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkBoxSelected: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  practiceText: {
    flex: 1,
    gap: spacing.xs,
  },
  practiceName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'left',
  },
  practiceMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'left',
  },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.green,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.55,
  },
});

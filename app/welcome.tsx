import { BarChart3, BookOpen, CalendarDays, Check, ListChecks, LogIn, Sparkles, Target, UserPlus } from 'lucide-react-native';
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
        <View style={styles.brandRow}>
          <Image
            accessibilityIgnoresInvertColors
            accessible
            accessibilityLabel="Daily Cheshbon logo"
            resizeMode="contain"
            source={require('@/assets/daily-cheshbon-logo.png')}
            style={styles.logoMark}
          />
          <View style={styles.brandText}>
            <Text style={styles.appName}>Daily Cheshbon</Text>
            <Text style={styles.tagline}>A nightly cheshbon hanefesh for intentional growth.</Text>
          </View>
        </View>
        <Text style={styles.eyebrow}>Intentional Growth</Text>
        <Text style={styles.title}>A gentle structure for self-awareness and real growth.</Text>
        <Text style={styles.subtitle}>
          Daily Cheshbon helps you pause at night, review the practices that matter, and notice the patterns that shape your avodas Hashem and daily life.
        </Text>
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      {!signedIn ? (
        <>
          <ProductTour />

          <View style={styles.accountPanel}>
            <Text style={styles.sectionTitle}>Get started</Text>
            <Text style={styles.bodyText}>
              Create your account, choose the default starter practices, and begin shaping the system around your own life.
            </Text>
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
            <Pressable accessibilityRole="button" onPress={() => router.push('/learn-more')} style={styles.learnButton}>
              <BookOpen color={colors.blue} size={17} />
              <Text style={styles.learnButtonText}>Learn more</Text>
            </Pressable>
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
        <>
          <ProductTour compact />
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
        </>
      )}
    </ScrollView>
  );
}

function ProductTour({ compact = false }: { compact?: boolean }) {
  const sections = [
    {
      icon: <Sparkles color={colors.green} size={18} />,
      title: 'Cheshbon hanefesh for self-awareness',
      text: 'Reviewing the day turns ordinary moments into information. The goal is not guilt or a score. It is honest awareness that leads to intentional growth.',
      preview: <ReviewPreview />,
    },
    {
      icon: <ListChecks color={colors.blue} size={18} />,
      title: 'Practices that match your real life',
      text: 'Practices are the questions and habits you review: tefillah, gratitude, phone use, eating, learning, middos, reflections, and anything else you want to notice.',
      preview: <PracticesPreview />,
    },
    {
      icon: <CalendarDays color={colors.green} size={18} />,
      title: 'Routines keep each day relevant',
      text: 'A regular weekday, Shabbos, vacation, work, or Rosh Chodesh can each have its own routine. You only review what actually applies.',
      preview: <RoutinePreview />,
    },
    {
      icon: <BarChart3 color={colors.blue} size={18} />,
      title: 'Trends reveal patterns over time',
      text: 'Daily entries become a longer view of growth: what is improving, what needs attention, and which patterns are worth noticing.',
      preview: <TrendsPreview />,
    },
  ];

  return (
    <View style={[styles.tour, compact && styles.tourCompact]}>
      <View style={styles.tourHeader}>
        <Text style={styles.sectionTitle}>What Daily Cheshbon helps you do</Text>
        <Text style={styles.bodyText}>
          The app is built around a simple nightly rhythm: choose meaningful practices, review honestly, and let the trends help you see your growth with more clarity.
        </Text>
      </View>
      {sections.map((section, index) => {
        if (compact && index > 1) return null;
        return (
          <FeatureSection key={section.title} icon={section.icon} title={section.title} text={section.text}>
            {section.preview}
          </FeatureSection>
        );
      })}
    </View>
  );
}

function FeatureSection({
  children,
  icon,
  title,
  text,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureCopy}>
        <View style={styles.featureTitleRow}>
          <View style={styles.introIcon}>{icon}</View>
          <Text style={styles.featureTitle}>{title}</Text>
        </View>
        <Text style={styles.featureText}>{text}</Text>
      </View>
      <View style={styles.previewColumn}>{children}</View>
    </View>
  );
}

function PreviewFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.previewFrame}>
      <View style={styles.previewTopBar}>
        <View style={styles.previewDot} />
        <Text style={styles.previewTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function ReviewPreview() {
  return (
    <PreviewFrame title="Nightly review">
      <Text style={styles.previewSectionLabel}>Morning</Text>
      <View style={styles.previewQuestion}>
        <Text style={styles.previewQuestionText}>Modeh Ani</Text>
        <View style={styles.previewPills}>
          <Text style={[styles.previewPill, styles.previewPillActive]}>Yes</Text>
          <Text style={styles.previewPill}>No</Text>
        </View>
      </View>
      <View style={styles.previewQuestion}>
        <Text style={styles.previewQuestionText}>Shacharis quality</Text>
        <View style={styles.previewRatingRow}>
          {[1, 2, 3, 4, 5].map((rating) => (
            <View key={rating} style={[styles.previewRatingDot, rating <= 4 && styles.previewRatingDotActive]} />
          ))}
        </View>
      </View>
      <View style={styles.previewNote}>
        <Text style={styles.previewNoteText}>One thing I want to work on tomorrow...</Text>
      </View>
    </PreviewFrame>
  );
}

function PracticesPreview() {
  return (
    <PreviewFrame title="Practices">
      {[
        ['Daily reflection', 'Reflection · Night'],
        ['Brachot', 'Spiritual · Overview'],
        ['Positive speech', 'Middos · Overview'],
      ].map(([name, meta]) => (
        <View key={name} style={styles.previewListRow}>
          <View style={styles.previewCheckTiny}>
            <Check color="#FFFFFF" size={10} />
          </View>
          <View style={styles.previewListText}>
            <Text style={styles.previewQuestionText}>{name}</Text>
            <Text style={styles.previewMeta}>{meta}</Text>
          </View>
        </View>
      ))}
    </PreviewFrame>
  );
}

function RoutinePreview() {
  return (
    <PreviewFrame title="Routines">
      {[
        ['Weekly Core', 'Sun-Fri · Active'],
        ['Shabbos', 'Saturday · Active'],
        ['Vacation', 'Custom dates · Inactive'],
      ].map(([name, meta]) => (
        <View key={name} style={styles.previewRoutineRow}>
          <Target color={colors.green} size={14} />
          <View style={styles.previewListText}>
            <Text style={styles.previewQuestionText}>{name}</Text>
            <Text style={styles.previewMeta}>{meta}</Text>
          </View>
        </View>
      ))}
    </PreviewFrame>
  );
}

function TrendsPreview() {
  return (
    <PreviewFrame title="Trends">
      <View style={styles.previewChartRow}>
        {[42, 64, 54, 78, 70, 86].map((height, index) => (
          <View key={`${height}-${index}`} style={[styles.previewBar, { height }]} />
        ))}
      </View>
      <View style={styles.previewStatsRow}>
        <View style={styles.previewStat}>
          <Text style={styles.previewStatValue}>4.1</Text>
          <Text style={styles.previewMeta}>week</Text>
        </View>
        <View style={styles.previewStat}>
          <Text style={styles.previewStatValue}>73%</Text>
          <Text style={styles.previewMeta}>month</Text>
        </View>
      </View>
    </PreviewFrame>
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
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  logoMark: {
    borderRadius: 8,
    height: 78,
    width: 78,
  },
  brandText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 220,
  },
  appName: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
    textAlign: 'left',
  },
  tagline: {
    color: colors.green,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
    textAlign: 'left',
  },
  eyebrow: {
    color: colors.green,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontSize: 31,
    fontWeight: '900',
    lineHeight: 37,
    textAlign: 'left',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 17,
    lineHeight: 25,
    textAlign: 'left',
  },
  tour: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  tourCompact: {
    backgroundColor: colors.blueSoft,
    borderColor: '#BFD2F7',
  },
  tourHeader: {
    gap: spacing.xs,
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
  featureRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  featureCopy: {
    flex: 1,
    gap: spacing.sm,
    minWidth: 240,
  },
  featureTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
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
  featureTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 22,
    textAlign: 'left',
  },
  featureText: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
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
  learnButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: '#BFD2F7',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  learnButtonText: {
    color: colors.blue,
    fontSize: 14,
    fontWeight: '900',
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
  previewColumn: {
    flex: 1,
    minWidth: 250,
  },
  previewFrame: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  previewTopBar: {
    alignItems: 'center',
    borderBottomColor: colors.softLine,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  previewDot: {
    backgroundColor: colors.green,
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  previewTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'left',
    textTransform: 'uppercase',
  },
  previewSectionLabel: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'left',
    textTransform: 'uppercase',
  },
  previewQuestion: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  previewQuestionText: {
    color: colors.ink,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
    textAlign: 'left',
  },
  previewPills: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  previewPill: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textAlign: 'center',
  },
  previewPillActive: {
    backgroundColor: colors.green,
    borderColor: colors.green,
    color: '#FFFFFF',
  },
  previewRatingRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  previewRatingDot: {
    backgroundColor: colors.softLine,
    borderRadius: 7,
    height: 14,
    width: 14,
  },
  previewRatingDotActive: {
    backgroundColor: colors.green,
  },
  previewNote: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.sm,
  },
  previewNoteText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'left',
  },
  previewListRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  previewCheckTiny: {
    alignItems: 'center',
    backgroundColor: colors.green,
    borderRadius: 6,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  previewListText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  previewMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    textAlign: 'left',
  },
  previewRoutineRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  previewChartRow: {
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    height: 104,
    justifyContent: 'space-between',
    padding: spacing.sm,
  },
  previewBar: {
    backgroundColor: colors.green,
    borderRadius: 6,
    flex: 1,
    maxWidth: 34,
    minWidth: 18,
  },
  previewStatsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  previewStat: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: spacing.sm,
  },
  previewStatValue: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'left',
  },
  disabled: {
    opacity: 0.55,
  },
});

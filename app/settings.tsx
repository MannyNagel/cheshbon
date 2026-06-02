import { Bell, BookOpen, ChevronDown, ChevronUp, CloudDownload, CloudUpload, LogIn, LogOut, Plus, RefreshCw, Save, Trash2, UserPlus } from 'lucide-react-native';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, spacing } from '@/src/components/ui';
import {
  deactivateDomain,
  createBlocker,
  createDomain,
  getBlockerEditorRows,
  getDomainEditorRows,
  getReminderPreferences,
  updateBlocker,
  updateDomain,
  updateReminderPreferences,
  type ReminderPreferences,
} from '@/src/repositories/cheshbonRepo';
import {
  completeOAuthRedirectIfPresent,
  getCloudStatus,
  pullCloudDataToLocal,
  pullCloudDataToLocalIfAvailable,
  pushLocalDataToCloud,
  pushLocalDataToCloudIfSignedIn,
  signInWithGoogle,
  signInToCloud,
  signOutOfCloud,
  signUpForCloud,
  type CloudStatus,
} from '@/src/services/cloudSyncService';

type DomainRow = { id: string; name: string; description: string | null; active: number; inUse: number };
type BlockerRow = { id: string; name: string; description: string | null; active: number };

export default function SettingsScreen() {
  const [cloudStatus, setCloudStatus] = useState<CloudStatus | null>(null);
  const [reminderPreferences, setReminderPreferences] = useState<ReminderPreferences | null>(null);
  const [domainRows, setDomainRows] = useState<DomainRow[]>([]);
  const [blockerRows, setBlockerRows] = useState<BlockerRow[]>([]);
  const [authMode, setAuthMode] = useState<'signIn' | 'create' | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const autoPulledAccountRef = useRef<string | null>(null);
  const authRedirectHandledRef = useRef(false);

  const load = useCallback(async () => {
    let cloudStatusMessage: string | null = null;
    let oauthCompleted = false;
    if (!authRedirectHandledRef.current) {
      authRedirectHandledRef.current = true;
      try {
        const authMessage = await completeOAuthRedirectIfPresent();
        if (authMessage) {
          oauthCompleted = true;
          setMessage(authMessage);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Google sign-in could not be completed.');
      }
    }
    const [nextCloudStatus, nextReminderPreferences, nextDomainRows, nextBlockerRows] = await Promise.all([
      getCloudStatus().catch((error) => {
        cloudStatusMessage = error instanceof Error ? error.message : 'Could not load account status.';
        return { configured: true, signedIn: oauthCompleted, email: null, name: null, lastSyncedAt: null };
      }),
      getReminderPreferences(),
      getDomainEditorRows(),
      getBlockerEditorRows(),
    ]);
    setCloudStatus(nextCloudStatus);
    setReminderPreferences(nextReminderPreferences);
    setDomainRows(nextDomainRows);
    setBlockerRows(nextBlockerRows);
    if (cloudStatusMessage) setMessage(cloudStatusMessage);
  }, []);

  useEffect(() => {
    load().catch((error) => {
      setMessage(error instanceof Error ? error.message : 'Settings could not load.');
      setCloudStatus({ configured: true, signedIn: false, email: null, name: null, lastSyncedAt: null });
      setReminderPreferences({ taskRemindersEnabled: false, morningReminderEnabled: true, morningReminderTime: '05:30' });
      setDomainRows([]);
      setBlockerRows([]);
    });
  }, [load]);

  useEffect(() => {
    if (!cloudStatus?.signedIn) {
      autoPulledAccountRef.current = null;
      return;
    }
    const accountKey = cloudStatus.email ?? 'signed-in';
    if (autoPulledAccountRef.current === accountKey) return;
    autoPulledAccountRef.current = accountKey;
    pullCloudDataToLocalIfAvailable()
      .then(async (syncedAt) => {
        if (syncedAt) setMessage(`Cloud backup restored: ${formatDateTime(syncedAt)}`);
        await load();
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : 'Cloud restore failed.');
      });
  }, [cloudStatus, load]);

  async function runCloudAction(action: () => Promise<string | null | void>, successMessage: string) {
    setBusy(true);
    setMessage(null);
    try {
      const detail = await action();
      setMessage(detail ? `${successMessage} ${formatDateTime(detail)}` : successMessage);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Cloud sync failed.');
    } finally {
      setBusy(false);
    }
  }

  if (!cloudStatus || !reminderPreferences) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.blue} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Account, tutorial, domains, blockers, and reminders.</Text>
      </View>

      <View style={styles.cloudBox}>
        <View style={styles.cloudHeader}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Text style={styles.cloudStatus}>
            {cloudStatus.configured
              ? cloudStatus.signedIn
                ? `Signed in: ${cloudStatus.name ? `${cloudStatus.name} · ` : ''}${cloudStatus.email ?? 'account'}`
                : 'Not signed in'
              : 'Not configured'}
          </Text>
          {cloudStatus.lastSyncedAt ? (
            <Text style={styles.cloudMeta}>Last cloud backup: {formatDateTime(cloudStatus.lastSyncedAt)}</Text>
          ) : null}
        </View>

        {cloudStatus.signedIn ? (
          <View style={styles.actions}>
            <ActionButton
              disabled={busy}
              icon={<CloudUpload color={colors.ink} size={17} />}
              label="Push to cloud"
              onPress={() => runCloudAction(pushLocalDataToCloud, 'Cloud backup saved:')}
            />
            <ActionButton
              disabled={busy}
              icon={<CloudDownload color={colors.ink} size={17} />}
              label="Pull from cloud"
              onPress={() => runCloudAction(pullCloudDataToLocal, 'Cloud backup restored:')}
            />
            <ActionButton
              disabled={busy}
              icon={<LogOut color={colors.ink} size={17} />}
              label="Sign out"
              onPress={() => runCloudAction(signOutOfCloud, 'Signed out.')}
            />
          </View>
        ) : (
          <View style={styles.signInBox}>
            <View style={styles.actions}>
              <ActionButton disabled={busy} icon={<LogIn color={colors.ink} size={17} />} label="Sign in with Google" onPress={() => runCloudAction(signInWithGoogle, 'Redirecting to Google.')} />
              <ActionButton disabled={busy} icon={<LogIn color={colors.ink} size={17} />} label="Sign in" onPress={() => setAuthMode('signIn')} />
              <ActionButton disabled={busy} icon={<UserPlus color={colors.ink} size={17} />} label="Create new account" onPress={() => setAuthMode('create')} />
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
                icon={authMode === 'signIn' ? <LogIn color={colors.ink} size={17} /> : <UserPlus color={colors.ink} size={17} />}
                label={authMode === 'signIn' ? 'Sign in' : 'Create account'}
                onPress={() =>
                  authMode === 'signIn'
                    ? runCloudAction(() => signInToCloud(email, password), 'Signed in and refreshed.')
                    : runCloudAction(
                        () => signUpForCloud(fullName, email, password),
                        'Account created. Check email if confirmation is required.',
                      )
                }
              />
              </View>
            ) : null}
          </View>
        )}
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <TutorialSection />
      <View style={styles.contactBox}>
        <Text style={styles.sectionTitle}>Contact</Text>
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL('mailto:dailycheshbon@gmail.com')}>
          <Text style={styles.contactEmail}>dailycheshbon@gmail.com</Text>
        </Pressable>
      </View>
      <EditableDomains rows={domainRows} onReload={load} setMessage={setMessage} />
      <EditableBlockers rows={blockerRows} onReload={load} setMessage={setMessage} />
      <ReminderSettings
        preferences={reminderPreferences}
        onChange={setReminderPreferences}
        onReload={load}
        setMessage={setMessage}
      />
    </ScrollView>
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

async function syncedMessage(baseMessage: string) {
  try {
    const syncedAt = await pushLocalDataToCloudIfSignedIn();
    return syncedAt ? `${baseMessage} Synced to cloud.` : baseMessage;
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Cloud push failed.';
    return `${baseMessage} Saved locally, but cloud push failed: ${detail}`;
  }
}

function ReminderSettings({
  preferences,
  onChange,
  onReload,
  setMessage,
}: {
  preferences: ReminderPreferences;
  onChange: (preferences: ReminderPreferences) => void;
  onReload: () => Promise<void>;
  setMessage: (message: string | null) => void;
}) {
  const [time, setTime] = useState(preferences.morningReminderTime);

  useEffect(() => {
    setTime(preferences.morningReminderTime);
  }, [preferences.morningReminderTime]);

  async function save(next: Partial<ReminderPreferences>, message: string) {
    try {
      const saved = await updateReminderPreferences(next);
      onChange(saved);
      setTime(saved.morningReminderTime);
      setMessage(await syncedMessage(message));
      await onReload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save reminder settings.');
    }
  }

  return (
    <View style={styles.section}>
      <View style={styles.reminderBox}>
        <View style={styles.reminderTitleRow}>
          <Bell color={colors.blue} size={18} />
          <Text style={styles.sectionTitle}>Reminders</Text>
        </View>
        <View style={styles.preferenceRow}>
          <View style={styles.preferenceText}>
            <Text style={styles.smallTitle}>Practice reminders</Text>
            <Text style={styles.preferenceMeta}>Show the Remember toggle on markable practices.</Text>
          </View>
          <ToggleButton
            label={preferences.taskRemindersEnabled ? 'On' : 'Off'}
            selected={preferences.taskRemindersEnabled}
            onPress={() => save({ taskRemindersEnabled: !preferences.taskRemindersEnabled }, 'Reminder setting saved.')}
          />
        </View>
        <View style={styles.preferenceRow}>
          <View style={styles.preferenceText}>
            <Text style={styles.smallTitle}>Morning reminder</Text>
            <Text style={styles.preferenceMeta}>Show the morning reminder card and browser notification.</Text>
          </View>
          <ToggleButton
            label={preferences.morningReminderEnabled ? 'On' : 'Off'}
            selected={preferences.morningReminderEnabled}
            onPress={() => save({ morningReminderEnabled: !preferences.morningReminderEnabled }, 'Morning reminder setting saved.')}
          />
        </View>
        <View style={styles.timeRow}>
          <View style={styles.preferenceText}>
            <Text style={styles.smallTitle}>Reminder time</Text>
          </View>
          <TextInput
            onChangeText={setTime}
            placeholder="05:30"
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.timeInput]}
            value={time}
          />
          <ActionButton icon={<Save color={colors.ink} size={17} />} label="Save time" onPress={() => save({ morningReminderTime: time }, 'Reminder time saved.')} />
        </View>
      </View>
    </View>
  );
}

function ToggleButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="switch" onPress={onPress} style={[styles.toggleButton, selected && styles.toggleButtonOn]}>
      <Text style={[styles.toggleButtonText, selected && styles.toggleButtonTextOn]}>{label}</Text>
    </Pressable>
  );
}

function TutorialSection() {
  const [open, setOpen] = useState(false);
  const tutorialCards = [
    {
      title: 'Welcome to Cheshbon',
      text:
        'Cheshbon is a personal reflection app for reviewing your day with honesty, structure, and purpose. The word comes from cheshbon hanefesh, an accounting of the soul: a steady look at choices, habits, priorities, growth, and areas that need attention.',
    },
    {
      title: 'The basic idea',
      text:
        'Growth usually comes from noticing patterns, making small adjustments, and returning each day to the person you want to become. A short nightly review helps ordinary days become part of a larger story.',
    },
    {
      title: 'How to review',
      text:
        'Use the Review page at night. Start with bedtime and wake time, then move through Morning, Afternoon, Night, and Overview. Answer honestly from memory. You do not need to track every moment during the day.',
    },
    {
      title: 'Practices',
      text:
        'A practice is one thing you review, such as Modeh Ani, Brachot, Eating, Gratitude, or Daily Avodah. When creating one, choose its metric, routine, part of day, domain, blockers, whether notes are allowed, whether it is active, and optional reminder settings.',
    },
    {
      title: 'Metrics',
      text:
        'The metric decides how you answer a practice. Completed is yes or no. Quality is a 1 to 5 rating. Number tracks a count. Text is for written answers like gratitude, daily avodah, or thoughts and reflections.',
    },
    {
      title: 'Review sections',
      text:
        'Review sections are the parts of the day. Morning, Afternoon, Night, and Overview keep the nightly review organized. Overview is for all-day practices like eating, brachot, phone use, middos, gratitude, and current avodah.',
    },
    {
      title: 'Routines',
      text:
        'A routine controls when practices appear. Weekly Core is the normal daily structure. Shabbos is a special overlay. You can create or edit routines, make them active or inactive, and add date ranges or days of the week when they apply.',
    },
    {
      title: 'Creating a practice',
      text:
        'Open Practices, press Add Practice, enter the name, choose the domain and review section, pick the routine it belongs to, and select the metric type. Then decide if the practice should allow notes, use blockers, be markable for tomorrow, and be active right away.',
    },
    {
      title: 'Editing practices',
      text:
        'Open Practices and select a practice to edit its name, domain, routine, review section, metric, note setting, blockers, reminder setting, or active status. Use Remove from the edit screen when you want it gone from today forward.',
    },
    {
      title: 'Rearranging practices',
      text:
        'On the Practices page, choose the review-section sort and press Reorder. Use the up and down buttons to put practices in the order you want them to appear during the review, even when they come from different routines.',
    },
    {
      title: 'Blockers',
      text:
        'Blockers explain what got in the way, like tired, rushed, phone, stress, or lack of planning. A practice can use all blockers, only some blockers, or no blockers. Edit the blocker list in Settings, and customize which blockers apply on each practice.',
    },
    {
      title: 'Notes',
      text:
        'Notes are for short context that a metric cannot capture. Some practices benefit from notes, and some become cluttered by them. Turn notes on or off when creating or editing a practice. On the review page, use Add note when you want the one-line note box.',
    },
    {
      title: 'Current Avodah',
      text:
        'Current Avodah is for the thing you want to carry forward. Daily Avodah can hold what you want to work on tomorrow. Weekly Avodah can hold a broader focus from Shabbos. The Today page shows the most recent relevant avodah when it exists.',
    },
    {
      title: 'Reminders',
      text:
        'Settings lets you opt into practice reminders and the morning reminder. If practice reminders are on, markable practices can be remembered for tomorrow. The morning reminder can show your Daily Avodah and the practices you marked.',
    },
    {
      title: 'Trends',
      text:
        'The Trends page helps you look beyond one day. It groups patterns by domain and practice, shows quality or completion over time, and lists recent text entries so you can notice what keeps showing up.',
    },
    {
      title: 'Account and cloud',
      text:
        'Use Account in Settings to sign in. Your data can sync through the cloud so the same cheshbon is available on your phone and computer. After signing in, the app pulls cloud data and saves future changes automatically.',
    },
    {
      title: 'A good starting setup',
      text:
        'Start small. Keep the practices that help you review real life, remove what feels noisy, and add specialty routines only when your schedule calls for them. The system should feel serious and honest without becoming heavy.',
    },
  ];
  return (
    <View style={styles.section}>
      <View style={styles.tutorialTopRow}>
        <Pressable accessibilityRole="button" onPress={() => setOpen((value) => !value)} style={[styles.tutorialHeader, styles.tutorialHeaderMain]}>
          <View style={styles.reminderTitleRow}>
            <BookOpen color={colors.blue} size={18} />
            <Text style={styles.sectionTitle}>Tutorial</Text>
          </View>
          {open ? <ChevronUp color={colors.ink} size={19} /> : <ChevronDown color={colors.ink} size={19} />}
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/learn-more')} style={styles.learnMoreButton}>
          <Text style={styles.learnMoreText}>Learn more</Text>
        </Pressable>
      </View>
      {open ? (
        <View style={styles.tutorialBox}>
          {tutorialCards.map((card, index) => (
            <TutorialCard
              key={card.title}
              title={card.title}
              text={card.text}
              last={index === tutorialCards.length - 1}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function TutorialCard({ title, text, last }: { title: string; text: string; last?: boolean }) {
  return (
    <View style={[styles.tutorialCard, last && styles.tutorialCardLast]}>
      <Text style={styles.smallTitle}>{title}</Text>
      <Text style={styles.tutorialText}>{text}</Text>
    </View>
  );
}

function EditableDomains({
  rows,
  onReload,
  setMessage,
}: {
  rows: DomainRow[];
  onReload: () => Promise<void>;
  setMessage: (message: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.section}>
      <DisclosureHeader open={open} title="Domains" onPress={() => setOpen((value) => !value)} />
      {open ? (
        <View style={styles.list}>
          <NewDomainEditor onReload={onReload} setMessage={setMessage} />
          {rows.map((row) => (
            <DomainEditor key={row.id} row={row} onReload={onReload} setMessage={setMessage} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function NewDomainEditor({
  onReload,
  setMessage,
}: {
  onReload: () => Promise<void>;
  setMessage: (message: string | null) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  async function add() {
    if (!name.trim()) {
      setMessage('Domain name is required.');
      return;
    }
    try {
      await createDomain({ name, description });
      setName('');
      setDescription('');
      setMessage(await syncedMessage('Domain added.'));
      await onReload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add domain.');
    }
  }
  return (
    <View style={[styles.editorRow, styles.newEditorRow]}>
      <Text style={styles.smallTitle}>Add domain</Text>
      <TextInput onChangeText={setName} placeholder="Domain name" placeholderTextColor={colors.muted} style={styles.input} value={name} />
      <TextInput onChangeText={setDescription} placeholder="Description" placeholderTextColor={colors.muted} style={styles.input} value={description} />
      <View style={styles.actions}>
        <ActionButton icon={<Plus color={colors.ink} size={17} />} label="Add domain" onPress={add} />
      </View>
    </View>
  );
}

function DomainEditor({
  row,
  onReload,
  setMessage,
}: {
  row: DomainRow;
  onReload: () => Promise<void>;
  setMessage: (message: string | null) => void;
}) {
  const [name, setName] = useState(row.name);
  const [description, setDescription] = useState(row.description ?? '');
  async function save() {
    try {
      await updateDomain({ id: row.id, name, description, active: row.active === 1 });
      setMessage(await syncedMessage('Domain updated.'));
      await onReload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update domain.');
    }
  }
  async function remove() {
    try {
      await deactivateDomain(row.id);
      setMessage(await syncedMessage('Domain deleted.'));
      await onReload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not delete domain.');
    }
  }
  return (
    <View style={styles.editorRow}>
      <TextInput onChangeText={setName} placeholder="Domain name" placeholderTextColor={colors.muted} style={styles.input} value={name} />
      <TextInput onChangeText={setDescription} placeholder="Description" placeholderTextColor={colors.muted} style={styles.input} value={description} />
      <View style={styles.actions}>
        <ActionButton icon={<Save color={colors.ink} size={17} />} label="Save" onPress={save} />
        <ActionButton disabled={row.inUse === 1} icon={<Trash2 color={colors.rose} size={17} />} label={row.inUse ? 'In use' : 'Delete'} onPress={remove} />
      </View>
    </View>
  );
}

function EditableBlockers({
  rows,
  onReload,
  setMessage,
}: {
  rows: BlockerRow[];
  onReload: () => Promise<void>;
  setMessage: (message: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.section}>
      <DisclosureHeader open={open} title="Blockers" onPress={() => setOpen((value) => !value)} />
      {open ? (
        <View style={styles.list}>
          <NewBlockerEditor onReload={onReload} setMessage={setMessage} />
          {rows.map((row) => (
            <BlockerEditor key={row.id} row={row} onReload={onReload} setMessage={setMessage} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function NewBlockerEditor({
  onReload,
  setMessage,
}: {
  onReload: () => Promise<void>;
  setMessage: (message: string | null) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  async function add() {
    if (!name.trim()) {
      setMessage('Blocker name is required.');
      return;
    }
    try {
      await createBlocker({ name, description });
      setName('');
      setDescription('');
      setMessage(await syncedMessage('Blocker added.'));
      await onReload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add blocker.');
    }
  }
  return (
    <View style={[styles.editorRow, styles.newEditorRow]}>
      <Text style={styles.smallTitle}>Add blocker</Text>
      <TextInput onChangeText={setName} placeholder="Blocker name" placeholderTextColor={colors.muted} style={styles.input} value={name} />
      <TextInput onChangeText={setDescription} placeholder="Description" placeholderTextColor={colors.muted} style={styles.input} value={description} />
      <View style={styles.actions}>
        <ActionButton icon={<Plus color={colors.ink} size={17} />} label="Add blocker" onPress={add} />
      </View>
    </View>
  );
}

function BlockerEditor({
  row,
  onReload,
  setMessage,
}: {
  row: BlockerRow;
  onReload: () => Promise<void>;
  setMessage: (message: string | null) => void;
}) {
  const [name, setName] = useState(row.name);
  const [description, setDescription] = useState(row.description ?? '');
  const [active, setActive] = useState(row.active === 1);
  async function save() {
    try {
      await updateBlocker({ id: row.id, name, description, active });
      setMessage(await syncedMessage('Blocker updated.'));
      await onReload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update blocker.');
    }
  }
  return (
    <View style={styles.editorRow}>
      <TextInput onChangeText={setName} placeholder="Blocker name" placeholderTextColor={colors.muted} style={styles.input} value={name} />
      <TextInput onChangeText={setDescription} placeholder="Description" placeholderTextColor={colors.muted} style={styles.input} value={description} />
      <View style={styles.actions}>
        <ActionButton icon={<Save color={colors.ink} size={17} />} label="Save" onPress={save} />
        <ActionButton label={active ? 'Active' : 'Hidden'} onPress={() => setActive((value) => !value)} icon={<RefreshCw color={colors.ink} size={17} />} />
      </View>
    </View>
  );
}

function DisclosureHeader({ open, title, onPress }: { open: boolean; title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.disclosureHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {open ? <ChevronUp color={colors.ink} size={19} /> : <ChevronDown color={colors.ink} size={19} />}
    </Pressable>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    backgroundColor: colors.paper,
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: 96,
  },
  header: {
    gap: spacing.sm,
  },
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cloudBox: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  cloudHeader: {
    gap: spacing.xs,
  },
  cloudStatus: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  cloudMeta: {
    color: colors.muted,
    fontSize: 13,
  },
  contactBox: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  contactEmail: {
    color: colors.blue,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'left',
  },
  signInBox: {
    gap: spacing.sm,
  },
  authForm: {
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
  disabled: {
    opacity: 0.5,
  },
  actionText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  message: {
    color: colors.green,
    fontSize: 13,
    fontWeight: '800',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '900',
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
  list: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
  },
  preferenceMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  preferenceRow: {
    alignItems: 'center',
    borderTopColor: colors.softLine,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    paddingTop: spacing.md,
  },
  preferenceText: {
    flex: 1,
    gap: spacing.xs,
  },
  reminderBox: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  reminderTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  row: {
    borderBottomColor: colors.softLine,
    borderBottomWidth: 1,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    padding: spacing.md,
  },
  editorRow: {
    borderBottomColor: colors.softLine,
    borderBottomWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  newEditorRow: {
    backgroundColor: colors.paper,
  },
  smallTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  timeInput: {
    minWidth: 94,
    width: 110,
  },
  timeRow: {
    alignItems: 'center',
    borderTopColor: colors.softLine,
    borderTopWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  toggleButton: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 38,
    minWidth: 64,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  toggleButtonOn: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  toggleButtonText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  toggleButtonTextOn: {
    color: colors.green,
  },
  tutorialBox: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  tutorialCard: {
    borderBottomColor: colors.softLine,
    borderBottomWidth: 1,
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  tutorialCardLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  tutorialHeader: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  tutorialHeaderMain: {
    flex: 1,
    minWidth: 190,
  },
  tutorialTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  learnMoreButton: {
    alignItems: 'center',
    backgroundColor: colors.blue,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  learnMoreText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  tutorialText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  disclosureHeader: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
});

import { ChevronDown, ChevronUp, CloudDownload, CloudUpload, Download, LogIn, LogOut, RefreshCw, Save, Trash2, UserPlus } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, spacing } from '@/src/components/ui';
import {
  deactivateDomain,
  exportAllData,
  getBlockerEditorRows,
  getDomainEditorRows,
  shareExportJson,
  updateBlocker,
  updateDomain,
} from '@/src/repositories/cheshbonRepo';
import {
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
  const [domainRows, setDomainRows] = useState<DomainRow[]>([]);
  const [blockerRows, setBlockerRows] = useState<BlockerRow[]>([]);
  const [exportText, setExportText] = useState('');
  const [authMode, setAuthMode] = useState<'signIn' | 'create' | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const autoPulledAccountRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const [nextCloudStatus, nextDomainRows, nextBlockerRows] = await Promise.all([
      getCloudStatus(),
      getDomainEditorRows(),
      getBlockerEditorRows(),
    ]);
    setCloudStatus(nextCloudStatus);
    setDomainRows(nextDomainRows);
    setBlockerRows(nextBlockerRows);
  }, []);

  useEffect(() => {
    load();
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

  async function previewExport() {
    setExportText(await exportAllData());
    setMessage('Export generated below.');
  }

  async function shareExport() {
    const result = await shareExportJson();
    setExportText(result.json);
    setMessage(`Export ready: ${result.path}`);
  }

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

  if (!cloudStatus) {
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
        <Text style={styles.subtitle}>Cloud sync, seeded library, and local export controls.</Text>
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

      <View style={styles.actions}>
        <ActionButton icon={<RefreshCw color={colors.ink} size={17} />} label="Preview export" onPress={previewExport} />
        <ActionButton icon={<Download color={colors.ink} size={17} />} label="Share JSON" onPress={shareExport} />
      </View>
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <EditableDomains rows={domainRows} onReload={load} setMessage={setMessage} />
      <EditableBlockers rows={blockerRows} onReload={load} setMessage={setMessage} />

      {exportText ? (
        <View style={styles.exportBox}>
          <Text style={styles.sectionTitle}>Export JSON</Text>
          <TextInput multiline editable={false} style={styles.exportText} value={exportText} />
        </View>
      ) : null}
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
          {rows.map((row) => (
            <DomainEditor key={row.id} row={row} onReload={onReload} setMessage={setMessage} />
          ))}
        </View>
      ) : null}
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
          {rows.map((row) => (
            <BlockerEditor key={row.id} row={row} onReload={onReload} setMessage={setMessage} />
          ))}
        </View>
      ) : null}
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
  exportBox: {
    gap: spacing.sm,
  },
  exportText: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: 'monospace',
    fontSize: 12,
    minHeight: 240,
    padding: spacing.md,
    textAlign: 'left',
    textAlignVertical: 'top',
    writingDirection: 'ltr',
  },
});

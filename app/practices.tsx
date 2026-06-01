import { ArrowDown, ArrowUp, CirclePlus, Pencil, Save, Trash2, X } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, spacing } from '@/src/components/ui';
import {
  createTask,
  getTaskFormOptions,
  getTasksForManagement,
  getReminderPreferences,
  moveTaskWithinReviewSection,
  removeTaskFromTodayForward,
  updateTask,
  type ReminderPreferences,
} from '@/src/repositories/cheshbonRepo';
import { pushLocalDataToCloudIfSignedIn } from '@/src/services/cloudSyncService';

type MetricKind = 'completed' | 'quality' | 'number' | 'text';
type Options = {
  domains: Array<{ id: string; name: string }>;
  routines: Array<{ id: string; name: string }>;
  reviewSections: Array<{ id: string; name: string }>;
  blockers: Array<{ id: string; name: string }>;
};
type TaskRow = {
  routinePracticeId: string;
  practiceId: string;
  name: string;
  description: string | null;
  domainId: string;
  domainName: string;
  allowNote: number;
  markable: number;
  routineId: string;
  routineName: string;
  reviewSectionId: string;
  reviewSectionName: string;
  metricId: string | null;
  metricName: string | null;
  metricType: string | null;
  enabled: number;
  sortOrder: number;
  archivedFrom: string | null;
  blockerIds: string[];
  blockersConfigured: number;
};

const metricOptions: Array<{ id: MetricKind; label: string }> = [
  { id: 'completed', label: 'Completed' },
  { id: 'quality', label: 'Quality 1-5' },
  { id: 'number', label: 'Number' },
  { id: 'text', label: 'Text' },
];

const emptyForm = {
  name: '',
  description: '',
  domainId: '',
  routineId: '',
  reviewSectionId: '',
  metricKind: 'quality' as MetricKind,
  enabled: true,
  allowNote: true,
  markable: false,
  blockersEnabled: true,
  blockerIds: [] as string[],
};

export default function PracticesScreen() {
  const params = useLocalSearchParams<{ mode?: string; routineId?: string }>();
  const [options, setOptions] = useState<Options | null>(null);
  const [reminderPreferences, setReminderPreferences] = useState<ReminderPreferences | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [mode, setMode] = useState<'list' | 'add' | 'edit'>('list');
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const handledAddParamRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextOptions, nextReminderPreferences, nextTasks] = await Promise.all([
        getTaskFormOptions(),
        getReminderPreferences(),
        getTasksForManagement(),
      ]);
      setOptions(nextOptions);
      setReminderPreferences(nextReminderPreferences);
      setTasks(nextTasks);
      setForm((current) => ({
        ...current,
        domainId: current.domainId || nextOptions.domains[0]?.id || '',
        routineId: current.routineId || params.routineId || nextOptions.routines[0]?.id || '',
        reviewSectionId: current.reviewSectionId || nextOptions.reviewSections[0]?.id || '',
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Could not load practices: ${JSON.stringify(error)}`);
      setOptions({ domains: [], routines: [], reviewSections: [], blockers: [] });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (params.mode !== 'add') {
      handledAddParamRef.current = null;
      return;
    }
    if (options) {
      const addParamKey = params.routineId ?? '__default__';
      if (handledAddParamRef.current === addParamKey) return;
      handledAddParamRef.current = addParamKey;
      setEditing(null);
      setForm({
        ...emptyForm,
        domainId: options.domains[0]?.id ?? '',
        routineId: params.routineId ?? options.routines[0]?.id ?? '',
        reviewSectionId: options.reviewSections[0]?.id ?? '',
        blockersEnabled: true,
        blockerIds: options.blockers.map((blocker) => blocker.id),
      });
      setMode('add');
      setMessage(null);
    }
  }, [options, params.mode, params.routineId]);

  const [sortBy, setSortBy] = useState<'routine' | 'domain' | 'section' | 'name'>('routine');
  const title = mode === 'add' ? 'Add Practice' : mode === 'edit' ? 'Edit Practice' : 'Practices';
  const sortedPractices = useMemo(() => {
    const copy = [...tasks];
    return copy.sort((a, b) => {
      if (sortBy === 'domain') return a.domainName.localeCompare(b.domainName) || a.name.localeCompare(b.name);
      if (sortBy === 'section') return sectionRank(a.reviewSectionName) - sectionRank(b.reviewSectionName) || a.sortOrder - b.sortOrder || a.routineName.localeCompare(b.routineName) || a.name.localeCompare(b.name);
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return a.routineName.localeCompare(b.routineName) || sectionRank(a.reviewSectionName) - sectionRank(b.reviewSectionName) || a.sortOrder - b.sortOrder;
    });
  }, [sortBy, tasks]);
  const groupedPractices = useMemo(() => {
    const groups: Array<{ title: string; practices: TaskRow[] }> = [];
    for (const practice of sortedPractices) {
      const title =
        sortBy === 'domain'
          ? practice.domainName
          : sortBy === 'section'
            ? practice.reviewSectionName
            : sortBy === 'name'
              ? practice.name[0]?.toUpperCase() || '#'
              : practice.routineName;
      const existing = groups.find((group) => group.title === title);
      if (existing) {
        existing.practices.push(practice);
      } else {
        groups.push({ title, practices: [practice] });
      }
    }
    return groups;
  }, [sortBy, sortedPractices]);

  function startAdd() {
    setEditing(null);
    setForm({
      ...emptyForm,
      domainId: options?.domains[0]?.id ?? '',
      routineId: options?.routines[0]?.id ?? '',
      reviewSectionId: options?.reviewSections[0]?.id ?? '',
      blockersEnabled: true,
      blockerIds: options?.blockers.map((blocker) => blocker.id) ?? [],
    });
    setMode('add');
    setMessage(null);
  }

  function startEdit(task: TaskRow) {
    setEditing(task);
    setForm({
      name: task.name,
      description: task.description ?? '',
      domainId: task.domainId,
      routineId: task.routineId,
      reviewSectionId: task.reviewSectionId,
      metricKind: metricTypeToKind(task.metricType),
      enabled: task.enabled === 1,
      allowNote: task.allowNote === 1,
      markable: task.markable === 1,
      blockersEnabled: task.blockersConfigured === 0 || task.blockerIds.length > 0,
      blockerIds: task.blockersConfigured === 0 ? options?.blockers.map((blocker) => blocker.id) ?? [] : task.blockerIds,
    });
    setMode('edit');
    setMessage(null);
  }

  async function save() {
    if (!form.name.trim() || !form.domainId || !form.routineId || !form.reviewSectionId) {
      setMessage('Name, routine, and part of day are required.');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      if (mode === 'edit' && editing) {
        await updateTask({
          routinePracticeId: editing.routinePracticeId,
          practiceId: editing.practiceId,
          metricId: editing.metricId,
          ...form,
        });
        setMessage(await syncedMessage('Practice updated.'));
      } else {
        await createTask(form);
        setMessage(await syncedMessage('Practice added.'));
      }
      router.replace('/practices');
      setMode('list');
      setEditing(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save practice');
    } finally {
      setSaving(false);
    }
  }

  async function removeTask(task: TaskRow) {
    setSaving(true);
    setMessage(null);
    try {
      await removeTaskFromTodayForward(task.routinePracticeId);
      setMessage(await syncedMessage('Practice removed from today onward.'));
      router.replace('/practices');
      setMode('list');
      setEditing(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not remove practice');
    } finally {
      setSaving(false);
    }
  }

  async function moveTask(task: TaskRow, direction: 'up' | 'down') {
    setSaving(true);
    setMessage(null);
    try {
      await moveTaskWithinReviewSection(task.routinePracticeId, direction);
      setMessage(await syncedMessage('Practice order updated.'));
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not move practice');
    } finally {
      setSaving(false);
    }
  }

  if (!options || !reminderPreferences) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.blue} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            {mode === 'list' ? 'View and edit the practices attached to routines.' : 'Choose the metric, routine, and part of day.'}
          </Text>
        </View>
        {mode === 'list' ? (
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const next = !reorderMode;
                setReorderMode(next);
                if (next) setSortBy('section');
              }}
              style={[styles.iconAction, reorderMode && styles.iconActionActive]}
            >
              <ArrowUp color={reorderMode ? colors.blue : colors.ink} size={17} />
              <Text style={[styles.iconActionText, reorderMode && styles.iconActionTextActive]}>{reorderMode ? 'Done' : 'Rearrange'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={startAdd} style={styles.iconAction}>
              <CirclePlus color={colors.blue} size={18} />
              <Text style={styles.iconActionText}>Add Practice</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                router.replace('/practices');
                setMode('list');
              }}
              style={styles.iconAction}
            >
              <X color={colors.ink} size={18} />
              <Text style={styles.iconActionText}>Cancel</Text>
            </Pressable>
          </View>
        )}
      </View>

      {mode === 'list' ? (
        <View style={styles.list}>
          <View style={styles.sortBar}>
            <Text style={styles.label}>Sort by</Text>
            <ChoiceGrid
              choices={[
                { id: 'routine', label: 'Routine' },
                { id: 'domain', label: 'Domain' },
                { id: 'section', label: 'Review Section' },
                { id: 'name', label: 'Name' },
              ]}
              selectedId={sortBy}
              onSelect={(id) => {
                const nextSort = id as typeof sortBy;
                setSortBy(nextSort);
                if (nextSort !== 'section') setReorderMode(false);
              }}
            />
          </View>
          {groupedPractices.map((group) => (
            <View key={group.title} style={styles.group}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              {group.practices.map((task) => (
                <View key={task.routinePracticeId} style={styles.taskCard}>
                  <View style={styles.taskMain}>
                    <Text style={styles.taskTitle}>{task.name}</Text>
                    <Text style={styles.taskMeta}>
                      {task.routineName} | {task.reviewSectionName} | {task.domainName}
                    </Text>
                    <Text style={styles.taskMeta}>
                      {task.metricName ?? 'No metric'} {task.metricType ? `(${task.metricType})` : ''} | {task.enabled ? 'active' : 'hidden'}
                    </Text>
                  </View>
                  {reorderMode && sortBy === 'section' ? (
                    <View style={styles.orderButtons}>
                      <Pressable
                        accessibilityLabel={`Move ${task.name} up`}
                        accessibilityRole="button"
                        disabled={saving}
                        onPress={() => moveTask(task, 'up')}
                        style={styles.orderButton}
                      >
                        <ArrowUp color={colors.ink} size={16} />
                      </Pressable>
                      <Pressable
                        accessibilityLabel={`Move ${task.name} down`}
                        accessibilityRole="button"
                        disabled={saving}
                        onPress={() => moveTask(task, 'down')}
                        style={styles.orderButton}
                      >
                        <ArrowDown color={colors.ink} size={16} />
                      </Pressable>
                    </View>
                  ) : null}
                  <Pressable accessibilityRole="button" onPress={() => startEdit(task)} style={styles.editButton}>
                    <Pencil color={colors.ink} size={17} />
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : (
        <TaskForm form={form} options={options} reminderPreferences={reminderPreferences} setForm={setForm} />
      )}

      {mode !== 'list' ? (
        <View style={styles.formActions}>
          <Pressable accessibilityRole="button" disabled={saving} onPress={save} style={styles.saveButton}>
            <Save color="#FFFFFF" size={18} />
            <Text style={styles.saveText}>{saving ? 'Saving...' : mode === 'edit' ? 'Save practice' : 'Add practice'}</Text>
          </Pressable>
          {mode === 'edit' && editing ? (
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => removeTask(editing)} style={styles.removeButton}>
              <Trash2 color={colors.rose} size={17} />
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </ScrollView>
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

function TaskForm({
  form,
  options,
  reminderPreferences,
  setForm,
}: {
  form: typeof emptyForm;
  options: Options;
  reminderPreferences: ReminderPreferences;
  setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>;
}) {
  const domainChoices = useMemo(() => options.domains, [options.domains]);
  return (
    <View style={styles.form}>
      <Field label="Practice name">
        <TextInput
          onChangeText={(name) => setForm((current) => ({ ...current, name }))}
          placeholder="Example: Review mishnah"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={form.name}
        />
      </Field>
      <Field label="Help text">
        <TextInput
          onChangeText={(description) => setForm((current) => ({ ...current, description }))}
          placeholder="Optional"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={form.description}
        />
      </Field>
      <Field label="Metric">
        <ChoiceGrid
          choices={metricOptions}
          selectedId={form.metricKind}
          onSelect={(metricKind) => setForm((current) => ({ ...current, metricKind: metricKind as MetricKind }))}
        />
      </Field>
      <Field label="Routine">
        <ChoiceGrid choices={options.routines} selectedId={form.routineId} onSelect={(routineId) => setForm((current) => ({ ...current, routineId }))} />
      </Field>
      <Field label="Part of day">
        <ChoiceGrid
          choices={options.reviewSections}
          selectedId={form.reviewSectionId}
          onSelect={(reviewSectionId) => setForm((current) => ({ ...current, reviewSectionId }))}
        />
      </Field>
      <Field label="Domain">
        <ChoiceGrid choices={domainChoices} selectedId={form.domainId} onSelect={(domainId) => setForm((current) => ({ ...current, domainId }))} />
      </Field>
      <Field label="Blockers for this practice">
        <View style={styles.fieldStack}>
          <Toggle
            label={form.blockersEnabled ? 'Use blockers' : 'No blockers'}
            selected={form.blockersEnabled}
            onPress={() =>
              setForm((current) => {
                const blockersEnabled = !current.blockersEnabled;
                return {
                  ...current,
                  blockersEnabled,
                  blockerIds: blockersEnabled ? options.blockers.map((blocker) => blocker.id) : [],
                };
              })
            }
          />
          {form.blockersEnabled ? (
            <MultiChoiceGrid
              choices={options.blockers}
              selectedIds={form.blockerIds}
              onChange={(blockerIds) => setForm((current) => ({ ...current, blockerIds }))}
            />
          ) : null}
        </View>
      </Field>
      <View style={styles.optionRow}>
        <Toggle label={form.allowNote ? 'Allow note' : 'No note'} selected={form.allowNote} onPress={() => setForm((current) => ({ ...current, allowNote: !current.allowNote }))} />
        {reminderPreferences.taskRemindersEnabled ? (
          <Toggle label={form.markable ? 'Can remember' : 'No reminder'} selected={form.markable} onPress={() => setForm((current) => ({ ...current, markable: !current.markable }))} />
        ) : null}
        <Toggle label={form.enabled ? 'Active' : 'Hidden'} selected={form.enabled} onPress={() => setForm((current) => ({ ...current, enabled: !current.enabled }))} />
      </View>
    </View>
  );
}

function MultiChoiceGrid({
  choices,
  selectedIds,
  onChange,
}: {
  choices: Array<{ id: string; name?: string; label?: string }>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((value) => value !== id) : [...selectedIds, id]);
  }

  return (
    <View style={styles.choiceGrid}>
      {choices.map((choice) => {
        const selected = selectedIds.includes(choice.id);
        return (
          <Pressable accessibilityRole="button" key={choice.id} onPress={() => toggle(choice.id)} style={[styles.choice, selected && styles.choiceSelected]}>
            <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{choice.label ?? choice.name}</Text>
          </Pressable>
        );
      })}
    </View>
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

function ChoiceGrid({
  choices,
  selectedId,
  onSelect,
}: {
  choices: Array<{ id: string; name?: string; label?: string }>;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.choiceGrid}>
      {choices.map((choice) => {
        const selected = selectedId === choice.id;
        return (
          <Pressable accessibilityRole="button" key={choice.id} onPress={() => onSelect(choice.id)} style={[styles.choice, selected && styles.choiceSelected]}>
            <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{choice.label ?? choice.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Toggle({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="switch" onPress={onPress} style={[styles.toggle, selected && styles.toggleOn]}>
      <Text style={[styles.toggleText, selected && styles.toggleTextOn]}>{label}</Text>
    </Pressable>
  );
}

function metricTypeToKind(metricType: string | null): MetricKind {
  if (metricType === 'boolean') return 'completed';
  if (metricType === 'number') return 'number';
  if (metricType === 'text') return 'text';
  return 'quality';
}

function sectionRank(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes('morning')) return 1;
  if (normalized.includes('afternoon')) return 2;
  if (normalized.includes('night')) return 3;
  if (normalized.includes('overview')) return 4;
  return 99;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', backgroundColor: colors.paper, flex: 1, justifyContent: 'center' },
  container: { backgroundColor: colors.paper, gap: spacing.lg, padding: spacing.lg, paddingBottom: 96 },
  header: { alignItems: 'flex-start', gap: spacing.md },
  headerRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  headerActions: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'flex-start' },
  headerText: { alignSelf: 'stretch', gap: spacing.sm },
  title: { color: colors.ink, fontSize: 32, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 22 },
  iconAction: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  iconActionActive: { backgroundColor: colors.blueSoft, borderColor: colors.blue },
  iconActionText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  iconActionTextActive: { color: colors.blue },
  list: { gap: spacing.sm },
  sortBar: { backgroundColor: colors.surface, borderColor: colors.softLine, borderRadius: 8, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  group: { gap: spacing.sm },
  groupTitle: { color: colors.green, fontSize: 15, fontWeight: '900', textTransform: 'uppercase' },
  taskCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  taskMain: { flex: 1, gap: spacing.xs },
  taskTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  taskMeta: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  editButton: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  editText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  removeButton: {
    alignItems: 'center',
    borderColor: colors.roseSoft,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  removeText: { color: colors.rose, fontSize: 14, fontWeight: '800' },
  form: { backgroundColor: colors.surface, borderColor: colors.softLine, borderRadius: 8, borderWidth: 1, gap: spacing.lg, padding: spacing.lg },
  formActions: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  field: { gap: spacing.sm },
  fieldStack: { alignItems: 'flex-start', gap: spacing.sm },
  label: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  input: { borderColor: colors.line, borderRadius: 8, borderWidth: 1, color: colors.ink, fontSize: 15, minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, textAlign: 'left', writingDirection: 'ltr' },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: { borderColor: colors.line, borderRadius: 8, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  choiceSelected: { backgroundColor: colors.blueSoft, borderColor: colors.blue },
  choiceText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  choiceTextSelected: { color: colors.blue },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  orderButton: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  orderButtons: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  toggle: { borderColor: colors.line, borderRadius: 8, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  toggleOn: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  toggleText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  toggleTextOn: { color: colors.green },
  saveButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.blue, borderRadius: 8, flexDirection: 'row', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.lg },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  message: { color: colors.green, fontSize: 14, fontWeight: '800' },
});

import { ArrowDown, ArrowUp, ChevronDown, CirclePlus, Pencil, Save, Search, SlidersHorizontal, Trash2, X } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, spacing } from '@/src/components/ui';
import {
  createTask,
  getOverviewDomainOrder,
  getTaskFormOptions,
  getTasksForManagement,
  getReminderPreferences,
  moveOverviewDomain,
  moveTaskWithinReviewSection,
  removeTaskFromTodayForward,
  updateTask,
  type EditablePracticeMetric,
  type OverviewDomainOrderItem,
  type ReminderPreferences,
} from '@/src/repositories/cheshbonRepo';
import { pushLocalDataToCloudIfSignedIn } from '@/src/services/cloudSyncService';

type MetricKind = 'completed' | 'quality' | 'number' | 'text' | 'choice';
type MetricOptionDraft = { key: string; id: string | null; label: string; value: string | null };
type PracticeMetricDraft = {
  key: string;
  id: string | null;
  name: string;
  metricKind: MetricKind;
  options: MetricOptionDraft[];
  domainId: string;
};
type Options = {
  domains: Array<{ id: string; name: string }>;
  routines: Array<{ id: string; name: string }>;
  reviewSections: Array<{ id: string; name: string }>;
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
  weeklyTarget: number | null;
  routineId: string;
  routineName: string;
  reviewSectionId: string;
  reviewSectionName: string;
  metrics: Array<{
    id: string;
    name: string;
    metricType: string;
    scaleMin: number | null;
    scaleMax: number | null;
    sortOrder: number;
    domainId: string | null;
    domainName: string | null;
    isPrimary: number;
    options: Array<{ id: string; label: string; value: string }>;
  }>;
  enabled: number;
  sortOrder: number;
  archivedFrom: string | null;
  protectedFromRemoval: number;
  parentPracticeId: string | null;
  parentPracticeName: string | null;
};

const metricOptions: Array<{ id: MetricKind; label: string }> = [
  { id: 'completed', label: 'Completed' },
  { id: 'quality', label: 'Quality 1-5' },
  { id: 'number', label: 'Number' },
  { id: 'text', label: 'Text' },
  { id: 'choice', label: 'Choices' },
];
let nextDraftKey = 0;

type PracticeFormState = {
  name: string;
  description: string;
  domainId: string;
  routineId: string;
  reviewSectionId: string;
  primaryMetricId: string | null;
  primaryMetricEnabled: boolean;
  metricKind: MetricKind;
  metricName: string;
  metricOptions: MetricOptionDraft[];
  subPractices: PracticeMetricDraft[];
  enabled: boolean;
  allowNote: boolean;
  markable: boolean;
  weeklyGoalEnabled: boolean;
  weeklyTarget: string;
};

const emptyForm: PracticeFormState = {
  name: '',
  description: '',
  domainId: '',
  routineId: '',
  reviewSectionId: '',
  primaryMetricId: null,
  primaryMetricEnabled: true,
  metricKind: 'quality' as MetricKind,
  metricName: 'Quality',
  metricOptions: [],
  subPractices: [],
  enabled: true,
  allowNote: true,
  markable: false,
  weeklyGoalEnabled: false,
  weeklyTarget: '',
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
  const [reorderTarget, setReorderTarget] = useState<'practices' | 'overview'>('practices');
  const [selectedReorderRoutineId, setSelectedReorderRoutineId] = useState('');
  const [overviewDomains, setOverviewDomains] = useState<OverviewDomainOrderItem[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'inactive'>('active');
  const handledAddParamRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextOptions, nextReminderPreferences, nextTasks, nextOverviewDomains] = await Promise.all([
        getTaskFormOptions(),
        getReminderPreferences(),
        getTasksForManagement(),
        getOverviewDomainOrder(),
      ]);
      setOptions(nextOptions);
      setReminderPreferences(nextReminderPreferences);
      setTasks(nextTasks);
      setOverviewDomains(nextOverviewDomains.filter((domain) => domain.practiceCount > 0));
      setSelectedReorderRoutineId((current) => current || nextOptions.routines[0]?.id || '');
      setForm((current) => ({
        ...current,
        domainId: current.domainId || nextOptions.domains[0]?.id || '',
        routineId: current.routineId || params.routineId || nextOptions.routines[0]?.id || '',
        reviewSectionId: current.reviewSectionId || nextOptions.reviewSections[0]?.id || '',
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Could not load practices: ${JSON.stringify(error)}`);
      setOptions({ domains: [], routines: [], reviewSections: [] });
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
        weeklyGoalEnabled: false,
        weeklyTarget: '',
      });
      setMode('add');
      setMessage(null);
    }
  }, [options, params.mode, params.routineId]);

  const [sortBy, setSortBy] = useState<'routine' | 'domain' | 'section' | 'name'>('routine');
  const title = mode === 'add' ? 'Add Practice' : mode === 'edit' ? 'Edit Practice' : 'Practices';
  const filteredPractices = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return tasks
      .filter((task) => (reorderMode && reorderTarget === 'practices' && selectedReorderRoutineId ? task.routineId === selectedReorderRoutineId : true))
      .filter((task) => {
        if (statusFilter === 'active') return task.enabled === 1;
        if (statusFilter === 'inactive') return task.enabled !== 1;
        return true;
      })
      .filter((task) => {
        if (!normalizedQuery) return true;
        return `${task.name} ${task.domainName} ${task.routineName} ${task.reviewSectionName} ${task.metrics.map((metric) => metric.name).join(' ')}`.toLowerCase().includes(normalizedQuery);
      });
  }, [query, reorderMode, reorderTarget, selectedReorderRoutineId, statusFilter, tasks]);
  const sortedPractices = useMemo(() => {
    const copy = [...filteredPractices];
    if (reorderMode && reorderTarget === 'practices') {
      return copy.sort((a, b) => sectionRank(a.reviewSectionName) - sectionRank(b.reviewSectionName) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    }
    return copy.sort((a, b) => {
      if (sortBy === 'domain') return a.domainName.localeCompare(b.domainName) || a.name.localeCompare(b.name);
      if (sortBy === 'section') return sectionRank(a.reviewSectionName) - sectionRank(b.reviewSectionName) || a.sortOrder - b.sortOrder || a.routineName.localeCompare(b.routineName) || a.name.localeCompare(b.name);
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return a.routineName.localeCompare(b.routineName) || sectionRank(a.reviewSectionName) - sectionRank(b.reviewSectionName) || a.sortOrder - b.sortOrder;
    });
  }, [filteredPractices, reorderMode, reorderTarget, sortBy]);
  const groupedPractices = useMemo(() => {
    const groups: Array<{ title: string; practices: TaskRow[] }> = [];
    for (const practice of sortedPractices) {
      const title =
        reorderMode && reorderTarget === 'practices'
          ? practice.reviewSectionName
          : sortBy === 'domain'
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
  }, [reorderMode, reorderTarget, sortBy, sortedPractices]);
  const reorderRoutineChoices = useMemo(() => {
    if (!options) return [];
    const routineIdsWithPractices = new Set(tasks.map((task) => task.routineId));
    const routinesWithPractices = options.routines.filter((routine) => routineIdsWithPractices.has(routine.id));
    return routinesWithPractices.length ? routinesWithPractices : options.routines;
  }, [options, tasks]);

  function startAdd() {
    setEditing(null);
    setForm({
      ...emptyForm,
      domainId: options?.domains[0]?.id ?? '',
      routineId: options?.routines[0]?.id ?? '',
      reviewSectionId: options?.reviewSections[0]?.id ?? '',
      weeklyGoalEnabled: false,
      weeklyTarget: '',
    });
    setMode('add');
    setMessage(null);
  }

  function startEdit(task: TaskRow) {
    const primaryMetric = task.metrics.find((metric) => metric.isPrimary === 1) ?? null;
    const subPractices = task.metrics.filter((metric) => metric.isPrimary !== 1);
    setEditing(task);
    setForm({
      name: task.name,
      description: task.description ?? '',
      domainId: task.domainId,
      routineId: task.routineId,
      reviewSectionId: task.reviewSectionId,
      primaryMetricId: primaryMetric?.id ?? null,
      primaryMetricEnabled: Boolean(primaryMetric),
      metricKind: metricTypeToKind(primaryMetric?.metricType ?? null),
      metricName: primaryMetric?.name ?? 'Quality',
      metricOptions: toMetricOptionDrafts(primaryMetric?.options ?? []),
      subPractices: subPractices.map(toPracticeMetricDraft),
      enabled: task.enabled === 1,
      allowNote: task.allowNote === 1,
      markable: task.markable === 1,
      weeklyGoalEnabled: task.weeklyTarget != null && task.weeklyTarget > 0,
      weeklyTarget: task.weeklyTarget == null ? '' : String(task.weeklyTarget),
    });
    setMode('edit');
    setMessage(null);
  }

  async function save() {
    if (!form.name.trim() || !form.domainId || !form.routineId || !form.reviewSectionId) {
      setMessage('Name, routine, and part of day are required.');
      return;
    }
    if ((form.primaryMetricEnabled && !form.metricName.trim()) || form.subPractices.some((subPractice) => !subPractice.name.trim())) {
      setMessage('Every enabled metric and sub-practice needs a name.');
      return;
    }
    const choiceWithoutOptions = [form.primaryMetricEnabled ? formMetricFromPrimary(form) : null, ...form.subPractices]
      .filter((metric): metric is PracticeMetricDraft => metric != null)
      .some((metric) => metric.metricKind === 'choice' && metric.options.filter((option) => option.label.trim()).length < 2);
    if (choiceWithoutOptions) {
      setMessage('Choice metrics need at least two options.');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      if (mode === 'edit' && editing) {
        await updateTask({
          routinePracticeId: editing.routinePracticeId,
          practiceId: editing.practiceId,
          ...form,
          metrics: metricsFromForm(form),
          weeklyTarget: weeklyTargetFromForm(form),
        });
        setMessage(await syncedMessage('Practice updated.'));
      } else {
        await createTask({ ...form, metrics: metricsFromForm(form), weeklyTarget: weeklyTargetFromForm(form) });
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

  async function moveOverviewSection(domainId: string, direction: 'up' | 'down') {
    setSaving(true);
    setMessage(null);
    try {
      await moveOverviewDomain(domainId, direction);
      setMessage(await syncedMessage('Overview section order updated.'));
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not move overview section');
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
                if (next) {
                  setSortBy('section');
                  setSelectedReorderRoutineId((current) => current || reorderRoutineChoices[0]?.id || options?.routines[0]?.id || '');
                }
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
          <View style={styles.filterPanel}>
            {!reorderMode || reorderTarget === 'practices' ? (
              <View style={styles.searchRow}>
                <Search color={colors.muted} size={18} />
                <TextInput
                  onChangeText={setQuery}
                  placeholder="Search practices"
                  placeholderTextColor={colors.muted}
                  style={styles.searchInput}
                  value={query}
                />
                {query ? (
                  <Pressable accessibilityRole="button" onPress={() => setQuery('')} style={styles.clearButton}>
                    <X color={colors.ink} size={16} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {reorderMode ? (
              <>
                <ChoiceGrid
                  choices={[
                    { id: 'practices', label: 'Practices' },
                    { id: 'overview', label: 'Overview sections' },
                  ]}
                  selectedId={reorderTarget}
                  onSelect={(id) => setReorderTarget(id as typeof reorderTarget)}
                />
                {reorderTarget === 'practices' ? (
                  <>
                    <Text style={styles.label}>Routine to rearrange</Text>
                    <ChoiceGrid
                      choices={reorderRoutineChoices}
                      selectedId={selectedReorderRoutineId}
                      onSelect={setSelectedReorderRoutineId}
                    />
                    <Text style={styles.filterHelp}>Use the arrows to reorder practices inside this routine. Each review section is ordered separately.</Text>
                  </>
                ) : (
                  <Text style={styles.filterHelp}>Arrange the domain sections shown in Overview. This order applies across all routines and syncs with your account. Reflection stays last.</Text>
                )}
              </>
            ) : (
              <>
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
              </>
            )}
            {!reorderMode || reorderTarget === 'practices' ? (
              <>
                <Text style={styles.label}>Show</Text>
                <ChoiceGrid
                  choices={[
                    { id: 'active', label: 'Active' },
                    { id: 'all', label: 'All' },
                    { id: 'inactive', label: 'Inactive' },
                  ]}
                  selectedId={statusFilter}
                  onSelect={(id) => setStatusFilter(id as typeof statusFilter)}
                />
              </>
            ) : null}
          </View>
          {reorderMode && reorderTarget === 'overview' ? (
            overviewDomains.length ? (
              <View style={styles.group}>
                <Text style={styles.groupTitle}>Overview sections</Text>
                {overviewDomains.map((domain, index) => (
                  <View key={domain.id} style={styles.taskCard}>
                    <View style={styles.taskMain}>
                      <Text style={styles.taskTitle}>{domain.name}</Text>
                      <Text style={styles.taskMeta}>
                        {domain.practiceCount} active {domain.practiceCount === 1 ? 'practice' : 'practices'} in Overview
                      </Text>
                    </View>
                    <View style={styles.orderButtons}>
                      <Pressable
                        accessibilityLabel={`Move ${domain.name} up`}
                        accessibilityRole="button"
                        disabled={saving || index === 0 || domain.id === 'domain_reflection'}
                        onPress={() => moveOverviewSection(domain.id, 'up')}
                        style={[styles.orderButton, (saving || index === 0 || domain.id === 'domain_reflection') && styles.orderButtonDisabled]}
                      >
                        <ArrowUp color={colors.ink} size={16} />
                      </Pressable>
                      <Pressable
                        accessibilityLabel={`Move ${domain.name} down`}
                        accessibilityRole="button"
                        disabled={saving || index === overviewDomains.length - 1 || overviewDomains[index + 1]?.id === 'domain_reflection'}
                        onPress={() => moveOverviewSection(domain.id, 'down')}
                        style={[styles.orderButton, (saving || index === overviewDomains.length - 1 || overviewDomains[index + 1]?.id === 'domain_reflection') && styles.orderButtonDisabled]}
                      >
                        <ArrowDown color={colors.ink} size={16} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            ) : <Text style={styles.emptyText}>No active Overview sections to arrange.</Text>
          ) : groupedPractices.length ? groupedPractices.map((group) => (
            <View key={group.title} style={styles.group}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              {group.practices.map((task) => (
                <View key={task.routinePracticeId} style={styles.taskCard}>
                  <View style={styles.taskMain}>
                    <Text style={styles.taskTitle}>{task.name}</Text>
                    <Text style={styles.taskMeta}>
                      {task.routineName} | {task.reviewSectionName} | {task.domainName}
                      {task.parentPracticeName ? ` | Sub-practice of ${task.parentPracticeName}` : ''}
                    </Text>
                    <Text style={styles.taskMeta}>
                      {task.metrics.find((metric) => metric.isPrimary === 1)?.name ?? 'No primary metric'}
                      {task.metrics.filter((metric) => metric.isPrimary !== 1).length
                        ? ` + ${task.metrics.filter((metric) => metric.isPrimary !== 1).length} sub-practice${task.metrics.filter((metric) => metric.isPrimary !== 1).length === 1 ? '' : 's'}`
                        : ''}
                      {' | '}{task.enabled ? 'active' : 'hidden'}
                      {task.weeklyTarget ? ` | weekly goal ${task.weeklyTarget}x` : ''}
                    </Text>
                  </View>
                  {reorderMode && reorderTarget === 'practices' ? (
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
          )) : <Text style={styles.emptyText}>No practices match that search.</Text>}
        </View>
      ) : (
        <TaskForm
          form={form}
          options={options}
          reminderPreferences={reminderPreferences}
          setForm={setForm}
        />
      )}

      {mode !== 'list' ? (
        <View style={styles.formActions}>
          <Pressable accessibilityRole="button" disabled={saving} onPress={save} style={styles.saveButton}>
            <Save color="#FFFFFF" size={18} />
            <Text style={styles.saveText}>{saving ? 'Saving...' : mode === 'edit' ? 'Save practice' : 'Add practice'}</Text>
          </Pressable>
          {mode === 'edit' && editing && editing.protectedFromRemoval !== 1 ? (
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => removeTask(editing)} style={styles.removeButton}>
              <Trash2 color={colors.rose} size={17} />
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          ) : null}
          {mode === 'edit' && editing?.protectedFromRemoval === 1 ? (
            <Text style={styles.protectedText}>This practice appears on Home. Mark it inactive instead of removing it.</Text>
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
  setForm: React.Dispatch<React.SetStateAction<PracticeFormState>>;
}) {
  const domainChoices = useMemo(() => options.domains, [options.domains]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const weeklyGoalAvailable = form.primaryMetricEnabled && form.metricKind === 'completed';
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
      <Field label="Primary metric">
        <Toggle
          label={form.primaryMetricEnabled ? 'Primary metric on' : 'No primary metric'}
          selected={form.primaryMetricEnabled}
          onPress={() =>
            setForm((current) => ({
              ...current,
              primaryMetricEnabled: !current.primaryMetricEnabled,
              weeklyGoalEnabled: current.primaryMetricEnabled ? false : current.weeklyGoalEnabled,
              weeklyTarget: current.primaryMetricEnabled ? '' : current.weeklyTarget,
            }))
          }
        />
        <Text style={styles.subPracticeHelp}>Turn this off when the parent is only a heading for its sub-practices.</Text>
        {form.primaryMetricEnabled ? (
          <>
            <ChoiceGrid
              choices={metricOptions}
              selectedId={form.metricKind}
              onSelect={(metricKind) =>
                setForm((current) => ({
                  ...current,
                  metricKind: metricKind as MetricKind,
                  metricName: shouldUseDefaultMetricName(current.metricName, current.metricKind)
                    ? defaultMetricName(metricKind as MetricKind)
                    : current.metricName,
                  metricOptions:
                    metricKind === 'choice' && current.metricOptions.length < 2
                      ? defaultChoiceOptions()
                      : current.metricOptions,
                  weeklyGoalEnabled: metricKind === 'completed' ? current.weeklyGoalEnabled : false,
                  weeklyTarget: metricKind === 'completed' ? current.weeklyTarget : '',
                }))
              }
            />
            <TextInput
              onChangeText={(metricName) => setForm((current) => ({ ...current, metricName }))}
              placeholder="Metric label"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={form.metricName}
            />
            {form.metricKind === 'choice' ? (
              <ChoiceOptionsEditor
                options={form.metricOptions}
                onChange={(metricOptions) => setForm((current) => ({ ...current, metricOptions }))}
              />
            ) : null}
          </>
        ) : null}
      </Field>
      <SubPracticeEditor
        domains={domainChoices}
        fallbackDomainId={form.domainId}
        subPractices={form.subPractices}
        onChange={(subPractices) => setForm((current) => ({ ...current, subPractices }))}
      />
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
      <View style={styles.fieldStack}>
        <View style={styles.optionRow}>
          <Toggle label={form.allowNote ? 'Note' : 'No note'} selected={form.allowNote} onPress={() => setForm((current) => ({ ...current, allowNote: !current.allowNote }))} />
          <Toggle label={form.enabled ? 'Active' : 'Inactive'} selected={form.enabled} onPress={() => setForm((current) => ({ ...current, enabled: !current.enabled }))} />
        </View>
      </View>
      {reminderPreferences.taskRemindersEnabled ? (
        <View style={styles.optionRow}>
          <Toggle label={form.markable ? 'Can remember' : 'No reminder'} selected={form.markable} onPress={() => setForm((current) => ({ ...current, markable: !current.markable }))} />
        </View>
      ) : null}
      <View style={styles.advancedPanel}>
        <Pressable accessibilityRole="button" onPress={() => setAdvancedOpen((value) => !value)} style={styles.advancedHeader}>
          <View style={styles.advancedTitleRow}>
            <SlidersHorizontal color={colors.ink} size={17} />
            <Text style={styles.advancedTitle}>Advanced settings</Text>
          </View>
          <ChevronDown color={colors.muted} size={18} style={advancedOpen ? styles.chevronOpen : undefined} />
        </Pressable>
        {advancedOpen ? (
          <View style={styles.advancedBody}>
            <View style={styles.weeklyGoalHeader}>
              <View style={styles.weeklyGoalText}>
                <Text style={styles.weeklyGoalTitle}>Weekly goal</Text>
                <Text style={styles.weeklyGoalCopy}>
                  Track a practice you hope to complete a set number of times each week. Weeks start on Shabbos.
                </Text>
              </View>
              <Toggle
                label={form.weeklyGoalEnabled ? 'On' : 'Off'}
                selected={form.weeklyGoalEnabled}
                onPress={() =>
                  setForm((current) => ({
                    ...current,
                    weeklyGoalEnabled: weeklyGoalAvailable ? !current.weeklyGoalEnabled : false,
                    weeklyTarget: weeklyGoalAvailable && !current.weeklyGoalEnabled ? current.weeklyTarget || '3' : current.weeklyTarget,
                  }))
                }
              />
            </View>
            {!weeklyGoalAvailable ? (
              <Text style={styles.advancedHelp}>Weekly goals are available for Completed yes/no practices.</Text>
            ) : null}
            {weeklyGoalAvailable && form.weeklyGoalEnabled ? (
              <View style={styles.weeklyTargetRow}>
                <Text style={styles.weeklyTargetLabel}>Times per week</Text>
                <TextInput
                  keyboardType="number-pad"
                  maxLength={1}
                  onChangeText={(weeklyTarget) =>
                    setForm((current) => ({
                      ...current,
                      weeklyTarget: weeklyTarget.replace(/[^1-7]/g, '').slice(0, 1),
                    }))
                  }
                  placeholder="3"
                  placeholderTextColor={colors.muted}
                  style={styles.weeklyTargetInput}
                  value={form.weeklyTarget}
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function SubPracticeEditor({
  domains,
  fallbackDomainId,
  subPractices,
  onChange,
}: {
  domains: Array<{ id: string; name: string }>;
  fallbackDomainId: string;
  subPractices: PracticeMetricDraft[];
  onChange: (subPractices: PracticeMetricDraft[]) => void;
}) {
  function update(index: number, changes: Partial<PracticeMetricDraft>) {
    onChange(subPractices.map((item, itemIndex) => (itemIndex === index ? { ...item, ...changes } : item)));
  }

  function updateKind(index: number, metricKind: MetricKind) {
    const current = subPractices[index];
    update(index, {
      metricKind,
      name: shouldUseDefaultMetricName(current.name, current.metricKind) ? defaultMetricName(metricKind) : current.name,
      options: metricKind === 'choice' && current.options.length < 2 ? defaultChoiceOptions() : current.options,
    });
  }

  function move(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= subPractices.length) return;
    const next = [...subPractices];
    [next[index], next[destination]] = [next[destination], next[index]];
    onChange(next);
  }

  return (
    <View style={styles.subPracticeSection}>
      <View style={styles.subPracticeHeader}>
        <View style={styles.subPracticeHeaderText}>
          <Text style={styles.label}>Sub-practices</Text>
          <Text style={styles.subPracticeHelp}>Optional details tracked underneath this practice, each with its own answer and trends.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange([...subPractices, newPracticeMetricDraft(fallbackDomainId)])}
          style={styles.addSubPracticeButton}
        >
          <CirclePlus color={colors.blue} size={17} />
          <Text style={styles.addSubPracticeText}>Add</Text>
        </Pressable>
      </View>

      {subPractices.map((subPractice, index) => (
        <View key={subPractice.key} style={styles.subPracticeRow}>
          <View style={styles.subPracticeTopRow}>
            <Text style={styles.subPracticeNumber}>Sub-practice {index + 1}</Text>
            <View style={styles.subPracticeActions}>
              <Pressable
                accessibilityLabel={`Move ${subPractice.name || `sub-practice ${index + 1}`} up`}
                accessibilityRole="button"
                disabled={index === 0}
                onPress={() => move(index, -1)}
                style={[styles.smallIconButton, index === 0 && styles.disabled]}
              >
                <ArrowUp color={colors.ink} size={15} />
              </Pressable>
              <Pressable
                accessibilityLabel={`Move ${subPractice.name || `sub-practice ${index + 1}`} down`}
                accessibilityRole="button"
                disabled={index === subPractices.length - 1}
                onPress={() => move(index, 1)}
                style={[styles.smallIconButton, index === subPractices.length - 1 && styles.disabled]}
              >
                <ArrowDown color={colors.ink} size={15} />
              </Pressable>
              <Pressable
                accessibilityLabel={`Remove ${subPractice.name || `sub-practice ${index + 1}`}`}
                accessibilityRole="button"
                onPress={() => onChange(subPractices.filter((_, itemIndex) => itemIndex !== index))}
                style={styles.smallIconButton}
              >
                <Trash2 color={colors.rose} size={15} />
              </Pressable>
            </View>
          </View>
          <TextInput
            onChangeText={(name) => update(index, { name })}
            placeholder="Example: On time"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={subPractice.name}
          />
          <ChoiceGrid
            choices={metricOptions}
            selectedId={subPractice.metricKind}
            onSelect={(metricKind) => updateKind(index, metricKind as MetricKind)}
          />
          <View style={styles.metricDomainField}>
            <Text style={styles.label}>Tag / domain</Text>
            <ChoiceGrid
              choices={domains}
              selectedId={subPractice.domainId || fallbackDomainId}
              onSelect={(domainId) => update(index, { domainId })}
            />
          </View>
          {subPractice.metricKind === 'choice' ? (
            <ChoiceOptionsEditor
              options={subPractice.options}
              onChange={(options) => update(index, { options })}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

function ChoiceOptionsEditor({
  options,
  onChange,
}: {
  options: MetricOptionDraft[];
  onChange: (options: MetricOptionDraft[]) => void;
}) {
  return (
    <View style={styles.choiceOptions}>
      <Text style={styles.subPracticeHelp}>Choices shown during the review</Text>
      {options.map((option, index) => (
        <View key={option.key} style={styles.choiceOptionRow}>
          <TextInput
            onChangeText={(label) => onChange(options.map((item, itemIndex) => itemIndex === index ? { ...item, label } : item))}
            placeholder={`Choice ${index + 1}`}
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.choiceOptionInput]}
            value={option.label}
          />
          <Pressable
            accessibilityLabel={`Remove choice ${index + 1}`}
            accessibilityRole="button"
            onPress={() => onChange(options.filter((_, itemIndex) => itemIndex !== index))}
            style={styles.smallIconButton}
          >
            <Trash2 color={colors.rose} size={15} />
          </Pressable>
        </View>
      ))}
      <Pressable
        accessibilityRole="button"
        onPress={() => onChange([...options, newMetricOptionDraft('')])}
        style={styles.addChoiceButton}
      >
        <CirclePlus color={colors.blue} size={16} />
        <Text style={styles.addSubPracticeText}>Add choice</Text>
      </Pressable>
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
  if (metricType === 'enum') return 'choice';
  return 'quality';
}

function metricKindToType(metricKind: MetricKind): EditablePracticeMetric['metricType'] {
  if (metricKind === 'completed') return 'boolean';
  if (metricKind === 'quality') return 'scale';
  if (metricKind === 'choice') return 'enum';
  return metricKind;
}

function defaultMetricName(metricKind: MetricKind) {
  if (metricKind === 'completed') return 'Completed';
  if (metricKind === 'quality') return 'Quality';
  if (metricKind === 'number') return 'Number';
  if (metricKind === 'text') return 'Text';
  return 'Choice';
}

function shouldUseDefaultMetricName(name: string, metricKind: MetricKind) {
  return !name.trim() || name.trim() === defaultMetricName(metricKind);
}

function draftKey(prefix: string) {
  nextDraftKey += 1;
  return `${prefix}_${nextDraftKey}`;
}

function newMetricOptionDraft(label: string, value: string | null = null, id: string | null = null): MetricOptionDraft {
  return { key: id ?? draftKey('option'), id, label, value };
}

function defaultChoiceOptions() {
  return [newMetricOptionDraft('Yes', 'yes'), newMetricOptionDraft('No', 'no')];
}

function newPracticeMetricDraft(domainId: string): PracticeMetricDraft {
  return {
    key: draftKey('subpractice'),
    id: null,
    name: '',
    metricKind: 'completed',
    options: [],
    domainId,
  };
}

function toMetricOptionDrafts(options: TaskRow['metrics'][number]['options']) {
  return options.map((option) => newMetricOptionDraft(option.label, option.value, option.id));
}

function toPracticeMetricDraft(metric: TaskRow['metrics'][number]): PracticeMetricDraft {
  return {
    key: metric.id,
    id: metric.id,
    name: metric.name,
    metricKind: metricTypeToKind(metric.metricType),
    options: toMetricOptionDrafts(metric.options),
    domainId: metric.domainId ?? '',
  };
}

function formMetricFromPrimary(form: PracticeFormState): PracticeMetricDraft {
  return {
    key: form.primaryMetricId ?? 'primary',
    id: form.primaryMetricId,
    name: form.metricName,
    metricKind: form.metricKind,
    options: form.metricOptions,
    domainId: form.domainId,
  };
}

function metricsFromForm(form: PracticeFormState): EditablePracticeMetric[] {
  const metrics = [form.primaryMetricEnabled ? formMetricFromPrimary(form) : null, ...form.subPractices]
    .filter((metric): metric is PracticeMetricDraft => metric != null);
  return metrics.map((metric, index) => ({
    id: metric.id,
    name: metric.name.trim(),
    metricType: metricKindToType(metric.metricKind),
    domainId: index === 0 && form.primaryMetricEnabled ? null : metric.domainId || form.domainId,
    isPrimary: index === 0 && form.primaryMetricEnabled,
    options: metric.options
      .filter((option) => option.label.trim())
      .map((option) => ({ id: option.id, label: option.label.trim(), value: option.value })),
  }));
}

function weeklyTargetFromForm(form: PracticeFormState) {
  if (!form.primaryMetricEnabled || form.metricKind !== 'completed' || !form.weeklyGoalEnabled) return null;
  const target = Number(form.weeklyTarget);
  if (!Number.isFinite(target) || target < 1) return null;
  return Math.min(7, Math.round(target));
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
  clearButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  emptyText: { color: colors.muted, fontSize: 15, lineHeight: 21, textAlign: 'left' },
  filterPanel: { backgroundColor: colors.surface, borderColor: colors.softLine, borderRadius: 8, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  filterHelp: { color: colors.muted, fontSize: 13, lineHeight: 18 },
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
  advancedPanel: {
    backgroundColor: colors.paper,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  advancedHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  advancedTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  advancedTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  advancedBody: {
    borderTopColor: colors.softLine,
    borderTopWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  advancedHelp: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  weeklyGoalHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  weeklyGoalText: { flex: 1, gap: spacing.xs },
  weeklyGoalTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  weeklyGoalCopy: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  weeklyTargetRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  weeklyTargetLabel: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  weeklyTargetInput: {
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
    height: 44,
    textAlign: 'center',
    width: 64,
  },
  searchInput: { color: colors.ink, flex: 1, fontSize: 15, minHeight: 42, textAlign: 'left', writingDirection: 'ltr' },
  searchRow: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: { borderColor: colors.line, borderRadius: 8, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  choiceSelected: { backgroundColor: colors.blueSoft, borderColor: colors.blue },
  choiceText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  choiceTextSelected: { color: colors.blue },
  choiceOptions: { gap: spacing.sm },
  choiceOptionRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  choiceOptionInput: { flex: 1 },
  addChoiceButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.sm,
  },
  subPracticeSection: { gap: spacing.sm },
  subPracticeHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  subPracticeHeaderText: { flex: 1, gap: spacing.xs, minWidth: 210 },
  subPracticeHelp: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  addSubPracticeButton: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  addSubPracticeText: { color: colors.blue, fontSize: 14, fontWeight: '800' },
  subPracticeRow: {
    borderLeftColor: colors.blue,
    borderLeftWidth: 3,
    borderTopColor: colors.softLine,
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingTop: spacing.md,
  },
  subPracticeTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  subPracticeNumber: { color: colors.muted, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  metricDomainField: { gap: spacing.sm },
  subPracticeActions: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  smallIconButton: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  disabled: { opacity: 0.35 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  protectedText: { color: colors.muted, flexBasis: '100%', fontSize: 13, fontWeight: '800', lineHeight: 18 },
  orderButton: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  orderButtonDisabled: { opacity: 0.3 },
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

import { Ban, Check, ChevronDown, ChevronUp, CirclePlus, Pencil, Save, Trash2, X } from 'lucide-react-native';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, spacing } from '@/src/components/ui';
import {
  addRoutineSchedule,
  createRoutine,
  deleteRoutine,
  deleteRoutineSchedule,
  getRoutinesWithSchedules,
  getRoutineTasks,
  toggleRoutineActive,
  updateRoutine,
  updateScheduleDates,
  updateScheduleDays,
} from '@/src/repositories/cheshbonRepo';
import { getActiveRoutinesForDate } from '@/src/services/activeRoutineService';
import { pushLocalDataToCloudIfSignedIn } from '@/src/services/cloudSyncService';
import { todayIsoDate } from '@/src/utils/dates';

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Shabbos'];
const allDays = [0, 1, 2, 3, 4, 5, 6];

type RoutineRow = Awaited<ReturnType<typeof getRoutinesWithSchedules>>[number];
type RoutineTask = Awaited<ReturnType<typeof getRoutineTasks>>[number];

const emptySchedule = { startDate: '', endDate: '', daysOfWeek: allDays };
const emptyRoutineForm = { name: '', description: '', active: true };

export default function RoutinesScreen() {
  const [date, setDate] = useState(todayIsoDate());
  const [data, setData] = useState<RoutineRow[]>([]);
  const [activeNames, setActiveNames] = useState<string[]>([]);
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(null);
  const [inactiveOpen, setInactiveOpen] = useState(false);
  const [tasksByRoutine, setTasksByRoutine] = useState<Record<string, RoutineTask[]>>({});
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'list' | 'add' | 'edit'>('list');
  const [editingRoutine, setEditingRoutine] = useState<RoutineRow | null>(null);
  const [form, setForm] = useState(emptyRoutineForm);
  const [newSchedule, setNewSchedule] = useState(emptySchedule);
  const [createdRoutineId, setCreatedRoutineId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [routineRows, active] = await Promise.all([getRoutinesWithSchedules(date), getActiveRoutinesForDate(date)]);
    const activeRoutineIds = active.map((routine) => routine.id);
    setData(
      routineRows.sort((a, b) => {
        const aActive = a.active ? 0 : 1;
        const bActive = b.active ? 0 : 1;
        return aActive - bActive || a.priority - b.priority || a.name.localeCompare(b.name);
      }),
    );
    setActiveNames(active.map((routine) => routine.name));
    setActiveIds(activeRoutineIds);
    setLoading(false);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  function startAdd() {
    setMode('add');
    setEditingRoutine(null);
    setForm(emptyRoutineForm);
    setNewSchedule(emptySchedule);
    setCreatedRoutineId(null);
    setMessage(null);
  }

  function startEdit(routine: RoutineRow) {
    setMode('edit');
    setEditingRoutine(routine);
    setForm({ name: routine.name, description: routine.description ?? '', active: routine.active });
    setNewSchedule(emptySchedule);
    setMessage(null);
  }

  async function saveRoutine() {
    if (!form.name.trim()) {
      setMessage('Routine name is required.');
      return;
    }
    if (mode === 'add') {
      const routineId = await createRoutine({
        name: form.name,
        description: form.description,
        startDate: newSchedule.startDate,
        endDate: newSchedule.endDate,
        daysOfWeek: newSchedule.daysOfWeek,
      });
      setCreatedRoutineId(routineId);
      setMode('edit');
      await load();
      const routine = (await getRoutinesWithSchedules(date)).find((row) => row.id === routineId) ?? null;
      setEditingRoutine(routine);
      setMessage(await syncedMessage('Routine created. Add practices below or add more date ranges.'));
      return;
    }
    if (editingRoutine) {
      await updateRoutine({ id: editingRoutine.id, ...form });
      setMessage(await syncedMessage('Routine updated.'));
      await load();
      const routine = (await getRoutinesWithSchedules(date)).find((row) => row.id === editingRoutine.id) ?? null;
      setEditingRoutine(routine);
    }
  }

  async function addScheduleRange() {
    const routineId = editingRoutine?.id ?? createdRoutineId;
    if (!routineId) return;
    await addRoutineSchedule({ routineId, ...newSchedule });
    setNewSchedule(emptySchedule);
    setMessage(await syncedMessage('Date range added.'));
    await load();
    const routine = (await getRoutinesWithSchedules(date)).find((row) => row.id === routineId) ?? null;
    setEditingRoutine(routine);
  }

  async function toggleDay(scheduleId: string, days: number[], day: number) {
    const next = days.includes(day) ? days.filter((value) => value !== day) : [...days, day].sort();
    await updateScheduleDays(scheduleId, next);
    setMessage(await syncedMessage('Schedule updated.'));
    await load();
    if (editingRoutine) {
      setEditingRoutine((await getRoutinesWithSchedules(date)).find((row) => row.id === editingRoutine.id) ?? null);
    }
  }

  function toggleNewScheduleDay(day: number) {
    setNewSchedule((current) => ({
      ...current,
      daysOfWeek: current.daysOfWeek.includes(day)
        ? current.daysOfWeek.filter((value) => value !== day)
        : [...current.daysOfWeek, day].sort(),
    }));
  }

  async function toggleRoutineOpen(routineId: string) {
    if (expandedRoutineId === routineId) {
      setExpandedRoutineId(null);
      return;
    }
    if (!tasksByRoutine[routineId]) {
      const tasks = await getRoutineTasks(routineId);
      setTasksByRoutine((current) => ({ ...current, [routineId]: tasks }));
    }
    setExpandedRoutineId(routineId);
  }

  async function removeRoutine(routineId: string) {
    try {
      await deleteRoutine(routineId);
      setMode('list');
      setExpandedRoutineId(null);
      setMessage(await syncedMessage('Routine deleted.'));
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not delete routine.');
    }
  }

  const editRoutine = editingRoutine ?? (createdRoutineId ? data.find((routine) => routine.id === createdRoutineId) ?? null : null);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Routines</Text>
        <Text style={styles.subtitle}>Routines overlay the year-round core instead of replacing it.</Text>
        <View style={styles.actions}>
          {mode === 'list' ? (
            <ActionButton icon={<CirclePlus color={colors.blue} size={16} />} label="New routine" onPress={startAdd} />
          ) : (
            <ActionButton icon={<X color={colors.ink} size={16} />} label="Back to routines" onPress={() => setMode('list')} />
          )}
        </View>
        <TextInput
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.muted}
          style={styles.dateInput}
          value={date}
        />
        <Text style={styles.activeText}>Active for {date}: {activeNames.join(', ') || 'none'}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>

      {mode === 'list' ? (
        loading ? (
          <ActivityIndicator color={colors.blue} />
        ) : (
          <>
            {data.filter((routine) => routine.active).map((routine) => (
              <RoutineCard
                activeIds={activeIds}
                expandedRoutineId={expandedRoutineId}
                key={routine.id}
                onEdit={startEdit}
                onToggleActive={async () => {
                  await toggleRoutineActive(routine.id, !routine.active);
                  setMessage(await syncedMessage('Routine updated.'));
                  await load();
                }}
                onToggleOpen={toggleRoutineOpen}
                routine={routine}
                tasks={tasksByRoutine[routine.id] ?? []}
              />
            ))}
            <View style={styles.inactiveSection}>
              <Pressable accessibilityRole="button" onPress={() => setInactiveOpen((value) => !value)} style={styles.inactiveHeader}>
                <Text style={styles.inactiveTitle}>Inactive routines ({data.filter((routine) => !routine.active).length})</Text>
                {inactiveOpen ? <ChevronUp color={colors.ink} size={18} /> : <ChevronDown color={colors.ink} size={18} />}
              </Pressable>
              {inactiveOpen
                ? data.filter((routine) => !routine.active).map((routine) => (
                    <RoutineCard
                      activeIds={activeIds}
                      expandedRoutineId={expandedRoutineId}
                      key={routine.id}
                      onEdit={startEdit}
                      onToggleActive={async () => {
                        await toggleRoutineActive(routine.id, !routine.active);
                        setMessage(await syncedMessage('Routine updated.'));
                        await load();
                      }}
                      onToggleOpen={toggleRoutineOpen}
                      routine={routine}
                      tasks={tasksByRoutine[routine.id] ?? []}
                    />
                  ))
                : null}
            </View>
          </>
        )
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{mode === 'add' ? 'Create routine' : 'Edit routine'}</Text>
          <TextInput
            onChangeText={(name) => setForm((current) => ({ ...current, name }))}
            placeholder="Routine name"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={form.name}
          />
          <TextInput
            onChangeText={(description) => setForm((current) => ({ ...current, description }))}
            placeholder="Description"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={form.description}
          />
          <View style={styles.actions}>
            <Toggle label={form.active ? 'Active' : 'Inactive'} selected={form.active} onPress={() => setForm((current) => ({ ...current, active: !current.active }))} />
            <ActionButton icon={<Save color={colors.blue} size={16} />} label={mode === 'add' ? 'Create routine' : 'Save routine'} onPress={saveRoutine} />
            {mode === 'edit' && editRoutine?.id !== 'routine_core' ? (
              <ActionButton icon={<Trash2 color={colors.rose} size={16} />} label="Delete routine" onPress={() => removeRoutine(editRoutine?.id ?? '')} />
            ) : null}
          </View>

          {mode === 'edit' && editRoutine ? (
            <>
              <View style={styles.sectionBlock}>
                <Text style={styles.panelTitle}>Date ranges</Text>
                {editRoutine.schedules.map((schedule) => (
                  <View key={schedule.id} style={styles.scheduleEditor}>
                    <View style={styles.datePair}>
                      <TextInput
                        defaultValue={schedule.startDate ?? ''}
                        onEndEditing={async (event) => {
                          await updateScheduleDates(schedule.id, event.nativeEvent.text, schedule.endDate);
                          setMessage(await syncedMessage('Date range updated.'));
                          await load();
                          setEditingRoutine((await getRoutinesWithSchedules(date)).find((row) => row.id === editRoutine.id) ?? null);
                        }}
                        placeholder="Start date"
                        placeholderTextColor={colors.muted}
                        style={styles.scheduleInput}
                      />
                      <TextInput
                        defaultValue={schedule.endDate ?? ''}
                        onEndEditing={async (event) => {
                          await updateScheduleDates(schedule.id, schedule.startDate, event.nativeEvent.text);
                          setMessage(await syncedMessage('Date range updated.'));
                          await load();
                          setEditingRoutine((await getRoutinesWithSchedules(date)).find((row) => row.id === editRoutine.id) ?? null);
                        }}
                        placeholder="End date"
                        placeholderTextColor={colors.muted}
                        style={styles.scheduleInput}
                      />
                    </View>
                    <DayChips days={schedule.daysOfWeek} onToggle={(day) => toggleDay(schedule.id, schedule.daysOfWeek, day)} />
                    <ActionButton
                      icon={<Trash2 color={colors.rose} size={16} />}
                      label="Remove range"
                      onPress={async () => {
                        await deleteRoutineSchedule(schedule.id);
                        setMessage(await syncedMessage('Date range removed.'));
                        await load();
                        setEditingRoutine((await getRoutinesWithSchedules(date)).find((row) => row.id === editRoutine.id) ?? null);
                      }}
                    />
                  </View>
                ))}
                <Text style={styles.panelTitle}>Add date range</Text>
                <ScheduleForm schedule={newSchedule} setSchedule={setNewSchedule} onToggleDay={toggleNewScheduleDay} />
                <ActionButton icon={<CirclePlus color={colors.blue} size={16} />} label="Add range" onPress={addScheduleRange} />
              </View>
              <View style={styles.sectionBlock}>
                <Text style={styles.panelTitle}>Practices</Text>
                <ActionButton
                  icon={<CirclePlus color={colors.blue} size={16} />}
                  label="Add practices"
                  onPress={() => router.push({ pathname: '/practices', params: { mode: 'add', routineId: editRoutine.id } })}
                />
                {(tasksByRoutine[editRoutine.id] ?? []).map((task) => <PracticeRow key={task.routinePracticeId} task={task} />)}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.panelTitle}>Initial date range</Text>
              <ScheduleForm schedule={newSchedule} setSchedule={setNewSchedule} onToggleDay={toggleNewScheduleDay} />
            </>
          )}
        </View>
      )}
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

function RoutineCard({
  activeIds,
  expandedRoutineId,
  onEdit,
  onToggleActive,
  onToggleOpen,
  routine,
  tasks,
}: {
  activeIds: string[];
  expandedRoutineId: string | null;
  onEdit: (routine: RoutineRow) => void;
  onToggleActive: () => Promise<void>;
  onToggleOpen: (routineId: string) => Promise<void>;
  routine: RoutineRow;
  tasks: RoutineTask[];
}) {
  const open = expandedRoutineId === routine.id;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Pressable accessibilityRole="button" onPress={() => onToggleOpen(routine.id)} style={styles.cardTitleBlock}>
          <Text style={styles.cardTitle}>{routine.name}</Text>
          <Text style={styles.cardMeta}>
            {activeIds.includes(routine.id) ? 'Applies on selected date' : 'Does not apply on selected date'} | {routine.routineType}
          </Text>
        </Pressable>
        <IconButton label="Edit routine" onPress={() => onEdit(routine)}>
          <Pencil color={colors.ink} size={18} />
        </IconButton>
        <Pressable accessibilityRole="button" onPress={() => onToggleOpen(routine.id)} style={styles.practiceButton}>
          <Text style={styles.practiceButtonText}>Practices</Text>
          {open ? <ChevronUp color={colors.ink} size={17} /> : <ChevronDown color={colors.ink} size={17} />}
        </Pressable>
        <Pressable accessibilityRole="switch" onPress={onToggleActive} style={[styles.toggle, routine.active && styles.toggleActive]}>
          {routine.active ? <Check color={colors.green} size={18} /> : <Ban color={colors.muted} size={18} />}
        </Pressable>
      </View>
      {routine.description ? <Text style={styles.description}>{routine.description}</Text> : null}
      <ScheduleSummary schedules={routine.schedules} />
      {open ? (
        <View style={styles.practicePanel}>
          <Text style={styles.panelTitle}>Practices in this routine</Text>
          {tasks.length ? tasks.map((task) => <PracticeRow key={task.routinePracticeId} task={task} />) : <Text style={styles.emptyText}>No practices yet.</Text>}
        </View>
      ) : null}
    </View>
  );
}

function ScheduleForm({
  schedule,
  setSchedule,
  onToggleDay,
}: {
  schedule: typeof emptySchedule;
  setSchedule: React.Dispatch<React.SetStateAction<typeof emptySchedule>>;
  onToggleDay: (day: number) => void;
}) {
  return (
    <>
      <View style={styles.datePair}>
        <TextInput
          onChangeText={(startDate) => setSchedule((current) => ({ ...current, startDate }))}
          placeholder="Start date YYYY-MM-DD"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={schedule.startDate}
        />
        <TextInput
          onChangeText={(endDate) => setSchedule((current) => ({ ...current, endDate }))}
          placeholder="End date YYYY-MM-DD"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={schedule.endDate}
        />
      </View>
      <DayChips days={schedule.daysOfWeek} onToggle={onToggleDay} />
    </>
  );
}

function ScheduleSummary({ schedules }: { schedules: RoutineRow['schedules'] }) {
  if (!schedules.length) return <Text style={styles.emptyText}>No dates set.</Text>;
  return (
    <View style={styles.scheduleSummary}>
      {schedules.map((schedule) => (
        <Text key={schedule.id} style={styles.scheduleLine}>
          {formatRange(schedule.startDate, schedule.endDate)} | {formatDays(schedule.daysOfWeek)}
        </Text>
      ))}
    </View>
  );
}

function PracticeRow({ task }: { task: RoutineTask }) {
  return (
    <View style={styles.practiceRow}>
      <View style={styles.practiceText}>
        <Text style={styles.practiceName}>{task.practiceName}</Text>
        <Text style={styles.practiceMeta}>
          {task.reviewSectionName} | {task.domainName} | {task.metricName ?? 'No metric'}
        </Text>
      </View>
      {!task.enabled ? <Text style={[styles.practiceBadge, styles.practiceBadgeMuted]}>Hidden</Text> : null}
    </View>
  );
}

function DayChips({ days, onToggle }: { days: number[]; onToggle: (day: number) => void }) {
  return (
    <View style={styles.days}>
      {weekdayLabels.map((label, index) => (
        <Pressable
          accessibilityRole="button"
          key={label}
          onPress={() => onToggle(index)}
          style={[styles.dayChip, days.includes(index) && styles.dayChipSelected]}
        >
          <Text style={[styles.dayText, days.includes(index) && styles.dayTextSelected]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ActionButton({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.actionButton}>
      {icon}
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function IconButton({ children, label, onPress }: { children: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={styles.iconButton}>
      {children}
    </Pressable>
  );
}

function Toggle({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="switch" onPress={onPress} style={[styles.togglePill, selected && styles.togglePillOn]}>
      <Text style={[styles.toggleText, selected && styles.toggleTextOn]}>{label}</Text>
    </Pressable>
  );
}

function formatRange(startDate: string | null, endDate: string | null) {
  if (startDate && endDate) return `${startDate} to ${endDate}`;
  if (startDate) return `From ${startDate}`;
  if (endDate) return `Until ${endDate}`;
  return 'All dates';
}

function formatDays(days: number[]) {
  if (days.length === 7) return 'Every day';
  return days.map((day) => weekdayLabels[day]).join(', ');
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.paper, gap: spacing.lg, padding: spacing.lg, paddingBottom: 96 },
  header: { gap: spacing.sm },
  title: { color: colors.ink, fontSize: 32, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 22 },
  dateInput: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
    height: 44,
    maxWidth: 180,
    paddingHorizontal: spacing.md,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  activeText: { color: colors.green, fontSize: 14, fontWeight: '800' },
  message: { color: colors.green, fontSize: 13, fontWeight: '800' },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  cardHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  cardTitleBlock: { flex: 1, gap: spacing.xs },
  cardTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  cardMeta: { color: colors.muted, fontSize: 13 },
  iconButton: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  practiceButton: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  practiceButtonText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  toggle: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  toggleActive: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  description: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  scheduleSummary: { gap: spacing.xs },
  scheduleLine: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  practicePanel: {
    backgroundColor: colors.paper,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  panelTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  practiceRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  practiceText: { flex: 1, gap: spacing.xs },
  practiceName: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  practiceMeta: { color: colors.muted, fontSize: 12 },
  practiceBadge: { color: colors.green, fontSize: 12, fontWeight: '900' },
  practiceBadgeMuted: { color: colors.muted },
  emptyText: { color: colors.muted, fontSize: 13 },
  sectionBlock: { borderTopColor: colors.softLine, borderTopWidth: 1, gap: spacing.sm, paddingTop: spacing.md },
  scheduleEditor: {
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  input: {
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    minHeight: 44,
    minWidth: 170,
    paddingHorizontal: spacing.md,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  datePair: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  scheduleInput: {
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    minHeight: 40,
    minWidth: 150,
    paddingHorizontal: spacing.md,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dayChip: { borderColor: colors.line, borderRadius: 8, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  dayChipSelected: { backgroundColor: colors.blueSoft, borderColor: colors.blue },
  dayText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  dayTextSelected: { color: colors.blue },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  inactiveSection: { gap: spacing.sm },
  inactiveHeader: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },
  inactiveTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  actionButton: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  actionText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  togglePill: { borderColor: colors.line, borderRadius: 8, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  togglePillOn: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  toggleText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  toggleTextOn: { color: colors.green },
});

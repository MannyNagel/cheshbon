import { ArrowLeft, Download, FileText, Mail, Sparkles } from 'lucide-react-native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/src/components/ui';
import { emailWeeklyReportToSelf } from '@/src/services/emailService';
import {
  exportWeeklyReportMarkdown,
  generateWeeklyReport,
  getActiveWeeklyReportPeriod,
  getSavedWeeklyReports,
  getWeeklyReportData,
  saveWeeklyReport,
  type SavedWeeklyReport,
  type WeeklyReportData,
} from '@/src/services/weeklyReportService';

export default function WeeklyReportScreen() {
  const [data, setData] = useState<WeeklyReportData | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [savedReports, setSavedReports] = useState<SavedWeeklyReport[]>([]);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    load()
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Could not load weekly report data.'))
      .finally(() => setLoading(false));
  }, []);

  async function load() {
    const activePeriod = getActiveWeeklyReportPeriod();
    const [nextData, nextSavedReports] = await Promise.all([
      getWeeklyReportData(activePeriod),
      getSavedWeeklyReports(),
    ]);
    const activeSavedReport = nextSavedReports.find((item) => item.weekStart === activePeriod.weekStart);
    setData(nextData);
    setSavedReports(nextSavedReports);
    setSelectedWeekStart(activePeriod.weekStart);
    setReport(activeSavedReport?.reportMarkdown ?? null);
  }

  async function generate() {
    if (!data) return;
    setGenerating(true);
    setMessage(null);
    try {
      const nextReport = await generateWeeklyReport(data);
      await saveWeeklyReport(nextReport, data);
      setReport(nextReport);
      setSelectedWeekStart(data.weekStart);
      setSavedReports(await getSavedWeeklyReports());
      setMessage('Weekly report generated and saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not generate weekly report.');
    } finally {
      setGenerating(false);
    }
  }

  async function exportReport() {
    if (!data || !report) return;
    setExporting(true);
    setMessage(null);
    try {
      await exportWeeklyReportMarkdown(report, selectedReportRange(data, savedReports, selectedWeekStart));
      setMessage('Weekly report exported.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not export weekly report.');
    } finally {
      setExporting(false);
    }
  }

  async function emailReport() {
    if (!data || !report) return;
    setEmailing(true);
    setMessage(null);
    try {
      const recipient = await emailWeeklyReportToSelf(report, selectedReportRange(data, savedReports, selectedWeekStart));
      setMessage(`Weekly report emailed to ${recipient}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not email weekly report.');
    } finally {
      setEmailing(false);
    }
  }

  function selectSavedReport(savedReport: SavedWeeklyReport) {
    setSelectedWeekStart(savedReport.weekStart);
    setReport(savedReport.reportMarkdown);
    setMessage(null);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.blue} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable accessibilityRole="button" onPress={() => router.replace('/trends')} style={styles.backButton}>
        <ArrowLeft color={colors.ink} size={18} />
        <Text style={styles.backText}>Back to trends</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.eyebrow}>Weekly review</Text>
        <Text style={styles.title}>Weekly Report</Text>
        <Text style={styles.subtitle}>
          {data ? `${data.currentWeekLabel} | active from Friday noon (${data.availableFrom.slice(0, 10)})` : 'Review your weekly patterns.'}
        </Text>
      </View>

      {data && data.reportThrough < data.weekEnd ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Current report period is open</Text>
          <Text style={styles.noticeText}>
            This report became available Friday at noon. If you generate it now, it will use data through {data.reportThrough}. You can regenerate it later if more review data is added before the week closes.
          </Text>
        </View>
      ) : null}

      {data ? (
        <View style={styles.summaryGrid}>
          <SummaryPill label="Domains" value={String(data.domains.length)} />
          <SummaryPill label="Practices" value={String(data.practices.length)} />
          <SummaryPill label="Days reviewed" value={String(data.daily.filter((day) => day.completed).length)} />
          <SummaryPill label="Blockers" value={String(data.blockers.reduce((sum, blocker) => sum + blocker.count, 0))} />
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <Pressable accessibilityRole="button" disabled={!data || generating} onPress={generate} style={styles.primaryButton}>
          <Sparkles color="#FFFFFF" size={18} />
          <Text style={styles.primaryButtonText}>{generating ? 'Generating...' : 'Generate current report'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={!report || exporting} onPress={exportReport} style={[styles.secondaryButton, !report && styles.disabledButton]}>
          <Download color={report ? colors.ink : colors.muted} size={18} />
          <Text style={[styles.secondaryButtonText, !report && styles.disabledText]}>{exporting ? 'Exporting...' : 'Export Markdown'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={!report || emailing} onPress={emailReport} style={[styles.secondaryButton, !report && styles.disabledButton]}>
          <Mail color={report ? colors.ink : colors.muted} size={18} />
          <Text style={[styles.secondaryButtonText, !report && styles.disabledText]}>{emailing ? 'Emailing...' : 'Email report'}</Text>
        </Pressable>
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      {savedReports.length ? (
        <View style={styles.savedCard}>
          <Text style={styles.savedTitle}>Saved reports</Text>
          <View style={styles.savedList}>
            {savedReports.map((savedReport) => (
              <Pressable
                accessibilityRole="button"
                key={savedReport.weekStart}
                onPress={() => selectSavedReport(savedReport)}
                style={[styles.savedReportButton, selectedWeekStart === savedReport.weekStart && styles.savedReportButtonSelected]}
              >
                <Text style={[styles.savedReportText, selectedWeekStart === savedReport.weekStart && styles.savedReportTextSelected]}>
                  {savedReport.weekStart} to {savedReport.weekEnd}
                </Text>
                <Text style={styles.savedReportMeta}>Generated {savedReport.generatedAt.slice(0, 10)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {report ? (
        <View style={styles.reportCard}>
          <View style={styles.reportHeader}>
            <FileText color={colors.blue} size={20} />
            <Text style={styles.reportTitle}>Generated report</Text>
          </View>
          <Text selectable style={styles.reportText}>{report}</Text>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No generated report yet</Text>
          <Text style={styles.emptyText}>
            Generate the report after your Saturday review to get an AI-written synthesis of domains, practices, notes, blockers, and reflections.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryPill}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function selectedReportRange(data: WeeklyReportData, savedReports: SavedWeeklyReport[], selectedWeekStart: string | null) {
  const savedReport = savedReports.find((item) => item.weekStart === selectedWeekStart);
  if (savedReport) {
    return { weekStart: savedReport.weekStart, weekEnd: savedReport.weekEnd };
  }
  return data;
}

const styles = StyleSheet.create({
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  backText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
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
  disabledButton: {
    opacity: 0.65,
  },
  disabledText: {
    color: colors.muted,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'left',
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'left',
  },
  eyebrow: {
    color: colors.green,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  header: {
    gap: spacing.sm,
  },
  message: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'left',
  },
  notice: {
    backgroundColor: colors.amberSoft,
    borderColor: colors.amber,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  noticeText: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'left',
  },
  noticeTitle: {
    color: colors.amber,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'left',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.blue,
    borderRadius: 8,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  reportCard: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  reportHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  reportText: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'left',
  },
  reportTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  secondaryButtonText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  savedCard: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  savedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  savedReportButton: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    minWidth: 190,
    padding: spacing.md,
  },
  savedReportButtonSelected: {
    backgroundColor: colors.blueSoft,
    borderColor: colors.blue,
  },
  savedReportMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  savedReportText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  savedReportTextSelected: {
    color: colors.blue,
  },
  savedTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'left',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 22,
    maxWidth: 720,
    textAlign: 'left',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  summaryPill: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 130,
    padding: spacing.md,
  },
  summaryValue: {
    color: colors.blue,
    fontSize: 22,
    fontWeight: '900',
  },
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'left',
  },
});

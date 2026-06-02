import { ArrowLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/src/components/ui';

const articleSections = [
  {
    title: 'Welcome to Cheshbon',
    paragraphs: [
      'Cheshbon is a personal reflection app designed to help you review your day with honesty, structure, and purpose.',
      'The word cheshbon comes from the phrase cheshbon hanefesh, which literally means “an accounting of the soul.” Just as a person might review their finances to understand where their money is going, cheshbon hanefesh means reviewing your inner life: your choices, habits, priorities, growth, and areas that need attention.',
      'The goal is not to feel guilty. The goal is to become more aware.',
      'Growth usually does not happen from one dramatic decision. It happens from noticing patterns, making small adjustments, and returning each day to the person you want to become.',
    ],
  },
  {
    title: 'What Is Cheshbon Hanefesh?',
    paragraphs: [
      'A cheshbon hanefesh is a daily self-review.',
      'At the end of the day, you pause and ask yourself:',
      'How did I live today?\nWhere did I succeed?\nWhere did I fall short?\nWhat patterns am I noticing?\nWhat do I want to improve tomorrow?',
      'This kind of reflection turns ordinary days into opportunities for growth. Without reflection, days can blur together. With reflection, each day becomes part of a larger story.',
      'In Mesilas Yesharim, the very first rung of growth is zehirus, watchfulness and awareness of one’s actions. Before a person can improve, they first need to notice how they are actually living. Self-awareness is the foundation of all future growth. A person who never pauses to reflect can go through life on autopilot, repeating the same habits without ever examining them.',
      'The daily practice of reviewing your day also changes the way you live during the day itself. When you know you will reflect on your actions at night, you naturally become more conscious of them in the moment. Knowing that you will review whether you stayed positive, used your time well, spoke kindly, or followed through on your goals helps keep those values present in your mind throughout the day. Reflection at night creates awareness in the morning.',
      'Cheshbon helps you make that process simple, consistent, and personal.',
    ],
  },
  {
    title: 'Why Use This App?',
    paragraphs: [
      'Most habit trackers focus only on whether you completed a task.',
      'Cheshbon is different.',
      'It is not just about checking boxes. It is about reviewing your day in a way that reflects your values, your routines, and your real life. It is also not just about quantity, but quality. Even the things we do every day, like having conversations with friends, can be improved through reflection. You might ask yourself: Was I an active listener today? Did I speak thoughtfully? These are not simple yes-or-no habits. They require honesty, awareness, and thought.',
      'Some practices are daily, like waking up with gratitude, davening, learning, exercising, or avoiding wasted time. Other practices depend on the season or schedule of your life. Your work routine may look different from your weekend routine. School schedules, vacations, travel, busy seasons, holidays, or periods with more free time can all change the structure of your day and the habits you want to focus on.',
      'Cheshbon is built around that reality.',
      'Instead of forcing every day into the same template, the app lets you organize your reflection around routines. You can turn different routines on or off depending on the time of year, the day of the week, or your current stage of life.',
    ],
  },
  {
    title: 'How the App Works',
    paragraphs: [],
  },
  {
    title: '1. Review Your Day at Night',
    paragraphs: [
      'Cheshbon is designed to be filled out at night.',
      'At the end of the day, you can mentally walk back through your schedule and review how the day went. This is often easier than trying to track every action in real time.',
      'The app helps you move through your day in an organized way so you can reflect without feeling overwhelmed.',
    ],
  },
  {
    title: '2. Follow a Structure That Matches Your Life',
    paragraphs: [
      'Your review is organized around habits, routines, and categories.',
      'Some items may be part of your daily life all year round. Others may only apply during certain periods.',
      'For example, you might have routines for:',
      'Regular weekdays\nYeshiva schedule\nSummer schedule\nShabbos preparation\nYamim Tovim\nPesach, Shavuos, or Sukkos\nBein hazmanim\nPersonal goals or special projects',
      'This allows your cheshbon to stay relevant. You only review what actually applies to the life you are living right now.',
    ],
  },
  {
    title: '3. Answer Honestly, Not Perfectly',
    paragraphs: [
      'The purpose of the app is not to create a perfect score.',
      'The purpose is to create honest awareness.',
      'Some days will look better than others. That is normal. The value comes from returning to the process consistently.',
      'A missed habit is not a failure. It is information.',
      'Over time, your answers help reveal patterns. You may notice that certain struggles happen at specific times of day, during certain routines, or when your schedule is less structured. That awareness is the first step toward real change.',
    ],
  },
  {
    title: '4. Track Patterns Over Time',
    paragraphs: [
      'A single day can feel random.',
      'A week, month, or season can reveal a pattern.',
      'Cheshbon helps you see more than isolated moments. It helps you understand your growth over time.',
      'You can begin to ask deeper questions:',
      'Am I becoming more consistent?\nWhich habits are improving?\nWhich areas keep slipping?\nWhat routines help me succeed?\nWhich environments make growth harder?\nWhat should I focus on next?',
      'The app turns daily reflection into long-term self-knowledge.',
    ],
  },
  {
    title: 'How to Get Started',
    paragraphs: [
      'Start simple.',
      'Choose the routines that apply to your current schedule. Then, at night, take a few minutes to review your day.',
      'Do not worry about doing it perfectly. The most important thing is to begin.',
      'As you use the app, you can adjust your habits, add routines, remove items that are not useful, and refine the system around your actual life.',
      'A good cheshbon should feel serious, but not crushing. It should be honest, but not discouraging. It should help you grow without making you feel trapped by yesterday.',
    ],
  },
  {
    title: 'The Bigger Goal',
    paragraphs: [
      'Cheshbon hanefesh is about living with intention.',
      'It reminds us that our days matter. Our habits matter. Our small choices matter.',
      'The app is a tool for becoming more awake to your own life.',
      'Not every day will be perfect. But every day can be reviewed. Every day can teach you something. And every day can become the foundation for tomorrow’s growth.',
    ],
  },
];

export default function LearnMoreScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.backButton}>
        <ArrowLeft color={colors.ink} size={18} />
        <Text style={styles.backText}>Back home</Text>
      </Pressable>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Learning</Text>
        <Text style={styles.title}>Welcome to Cheshbon</Text>
        <Text style={styles.subtitle}>A fuller introduction to cheshbon hanefesh and how the app is meant to help.</Text>
      </View>
      <View style={styles.article}>
        {articleSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.paragraphs.map((paragraph, index) => (
              <Text key={`${section.title}-${index}`} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  article: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xl,
    padding: spacing.lg,
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
  container: {
    backgroundColor: colors.paper,
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: 96,
  },
  eyebrow: {
    color: colors.green,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  hero: {
    gap: spacing.sm,
  },
  paragraph: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'left',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'left',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 22,
  },
  title: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: '900',
  },
});

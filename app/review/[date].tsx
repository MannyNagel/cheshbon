import { useLocalSearchParams } from 'expo-router';

import { NightlyReviewScreen } from '@/src/screens/NightlyReviewScreen';
import { todayIsoDate } from '@/src/utils/dates';

export default function DatedReview() {
  const params = useLocalSearchParams<{ date?: string }>();
  const date = params.date ?? todayIsoDate();
  return <NightlyReviewScreen key={date} initialDate={date} />;
}

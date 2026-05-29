import { useLocalSearchParams } from 'expo-router';

import { NightlyReviewScreen } from '@/src/screens/NightlyReviewScreen';
import { todayIsoDate } from '@/src/utils/dates';

export default function DatedReview() {
  const params = useLocalSearchParams<{ date?: string }>();
  return <NightlyReviewScreen initialDate={params.date ?? todayIsoDate()} />;
}

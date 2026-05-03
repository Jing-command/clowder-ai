import { StandupBoard } from '@/components/standup/StandupBoard';

export default function StandupPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const from = typeof searchParams.from === 'string' ? searchParams.from : null;
  return <StandupBoard initialReferrerThread={from} />;
}

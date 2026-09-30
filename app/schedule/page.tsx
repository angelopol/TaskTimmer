import ScheduleSwitcher from '../../components/schedule/ScheduleSwitcher';
import { cookies } from 'next/headers';
import Protected from '../../components/Protected';
export const metadata = { title: 'Schedule - TaskTimmer' };

export default function SchedulePage({ searchParams }: { searchParams: { ideamap?: string } }){
  const cookieStore = cookies();
  const saved = cookieStore.get('schedule_mode')?.value;
  // Coming back from IdeaMap's consent screen: show the week, where its tasks appear.
  const initialMode = saved === 'manage' && !searchParams.ideamap ? 'manage' : 'schedule';
  return <Protected><ScheduleSwitcher initialMode={initialMode} /></Protected>;
}

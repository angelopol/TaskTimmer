import ScheduleSwitcher from '../../components/schedule/ScheduleSwitcher';
import { cookies } from 'next/headers';
import Protected from '../../components/Protected';
export const metadata = { title: 'Schedule - TaskTimmer' };

export default function SchedulePage(){
  const cookieStore = cookies();
  const saved = cookieStore.get('schedule_mode')?.value;
  const initialMode = saved === 'manage' ? 'manage' : 'schedule';
  return <Protected><ScheduleSwitcher initialMode={initialMode} /></Protected>;
}

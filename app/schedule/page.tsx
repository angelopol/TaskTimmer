import ScheduleSwitcher from '../../components/schedule/ScheduleSwitcher';
import { cookies } from 'next/headers';
export const metadata = { title: 'Schedule - TaskTimmer' };

export default function SchedulePage(){
  const cookieStore = cookies();
  const saved = cookieStore.get('schedule_mode')?.value;
  const initialMode = saved === 'schedule' ? 'schedule' : 'manage';
  return <ScheduleSwitcher initialMode={initialMode} />;
}

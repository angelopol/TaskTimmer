import ShortcutGuide from '../../../components/reminders/ShortcutGuide';
import Protected from '../../../components/Protected';

export const metadata = { title: 'Apple Reminders setup - TaskTimmer' };

export default function RemindersSetupPage() {
  return <Protected><ShortcutGuide /></Protected>;
}

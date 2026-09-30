import React from 'react';
import ActivitiesClient from '@/components/activities/ActivitiesClient';
import Protected from '@/components/Protected';

export const dynamic = 'force-dynamic';

export default function ActivitiesPage() {
  return <Protected><ActivitiesClient /></Protected>;
}

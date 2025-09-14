import React from 'react';
import ScheduleSegmentsClient from '../../components/schedule/ScheduleSegmentsClient';

export const metadata = { title: 'Schedule - TaskTimmer' };

export default function SchedulePage(){
  return (
    <div>
      <ScheduleSegmentsClient />
    </div>
  );
}

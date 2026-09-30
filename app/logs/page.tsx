import React from 'react';
import LogTimeForm from '../../components/logs/LogTimeForm';
import Protected from '../../components/Protected';

export const metadata = { title: 'Log Time - TaskTimmer' };

export default function LogsPage(){
  return (
    <Protected>
      <LogTimeForm />
    </Protected>
  );
}

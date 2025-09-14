import { prisma } from '../lib/prisma';

// Helper to convert HH:MM to minute of day
function hm(str: string) {
  const [h, m] = str.split(':').map(Number); return h * 60 + m;
}

async function main() {
  // Sample user
  const email = 'demo@example.com';
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({ data: { email, passwordHash: '$2b$10$8VcxQsx8XoYf.7O8B9mAnOh9jK8uciFj.t3eztzYLeuk1ECF3F0im', name: 'Demo' } }); // password: demo123
  }

  const activityNames = ['EZPARKING', 'EDITFY', 'EZPASS', 'GIMNASIO', 'UNIVERSIDAD'];
  const activityMap: Record<string,string> = {};
  for (const name of activityNames) {
    const act = await prisma.activity.upsert({ where: { userId_name: { userId: user.id, name } }, update: {}, create: { name, userId: user.id, weeklyTargetMinutes: 0 } });
    activityMap[name] = act.id;
  }

  // Timetable segments (weekday 1=Lunes ..7=Domingo)
  interface Row { range: string; values: (string)[]; }
  const rows: Row[] = [
    { range: '08:50-09:00', values: ['EZPARKING','EDITFY','EZPASS','EZPARKING','EDITFY','LIBRE','LIBRE'] },
    { range: '09:00-09:05', values: ['EZPARKING','EDITFY','EZPASS','EZPARKING','EDITFY','LIBRE','LIBRE'] },
    { range: '09:05-10:35', values: ['EZPARKING','EDITFY','EZPASS','EZPARKING','EDITFY','GIMNASIO','LIBRE'] },
    { range: '10:35-10:50', values: ['EZPARKING','EDITFY','EZPASS','EZPARKING','EDITFY','LIBRE','LIBRE'] },
    { range: '10:50-11:05', values: ['EZPARKING','EDITFY','EZPASS','EZPARKING','EDITFY','LIBRE','LIBRE'] },
    { range: '11:05-12:30', values: ['EZPARKING','EDITFY','EZPASS','EZPARKING','EDITFY','UNIVERSIDAD','LIBRE'] },
    { range: '12:30-13:30', values: ['LIBRE','LIBRE','LIBRE','LIBRE','LIBRE','UNIVERSIDAD','LIBRE'] },
    { range: '13:30-14:00', values: ['EZPARKING','EDITFY','EZPASS','EZPARKING','EZPASS','LIBRE','EDITFY'] },
    { range: '14:00-16:00', values: ['EZPARKING','EDITFY','EZPASS','EZPARKING','EZPASS','EZPASS','EDITFY'] },
    { range: '15:40-15:45', values: ['EZPARKING','GIMNASIO','EZPASS','EZPARKING','EZPASS','EZPASS','EDITFY'] },
    { range: '15:45-15:55', values: ['EZPARKING','GIMNASIO','LIBRE','LIBRE','EZPASS','EZPASS','EDITFY'] },
    { range: '15:55-16:00', values: ['EZPARKING','GIMNASIO','LIBRE','LIBRE','EZPASS','EZPASS','EDITFY'] },
    { range: '16:00-16:30', values: ['EZPARKING','GIMNASIO','UNIVERSIDAD','UNIVERSIDAD','EZPASS','EZPASS','EDITFY'] },
    { range: '16:30-17:00', values: ['EZPARKING','GIMNASIO','UNIVERSIDAD','UNIVERSIDAD','EZPASS','EZPASS','EDITFY'] },
    { range: '17:00-17:15', values: ['LIBRE','GIMNASIO','UNIVERSIDAD','UNIVERSIDAD','LIBRE','EZPASS','EZPASS'] },
    { range: '17:15-17:25', values: ['GIMNASIO','GIMNASIO','UNIVERSIDAD','UNIVERSIDAD','GIMNASIO','EZPASS','EZPASS'] },
    { range: '17:25-17:40', values: ['GIMNASIO','LIBRE','UNIVERSIDAD','UNIVERSIDAD','GIMNASIO','EZPASS','EZPASS'] },
    { range: '17:40-18:45', values: ['GIMNASIO','UNIVERSIDAD','UNIVERSIDAD','UNIVERSIDAD','GIMNASIO','EZPASS','EZPASS'] },
    { range: '18:45-19:00', values: ['LIBRE','UNIVERSIDAD','UNIVERSIDAD','UNIVERSIDAD','EZPARKING','EZPASS','EZPASS'] },
    { range: '19:00-19:15', values: ['LIBRE','UNIVERSIDAD','UNIVERSIDAD','UNIVERSIDAD','EZPARKING','EZPASS','LIBRE'] },
    { range: '19:15-21:40', values: ['UNIVERSIDAD','UNIVERSIDAD','','UNIVERSIDAD','EZPARKING','EZPASS','LIBRE'] },
    { range: '21:40-24:00', values: ['LIBRE','LIBRE','LIBRE','LIBRE','LIBRE','LIBRE','LIBRE'] }
  ];

  for (const row of rows) {
    const [start, end] = row.range.split('-');
    const startM = hm(start); const endM = hm(end);
    for (let i=0;i<7;i++) {
      const val = row.values[i];
      if (!val) continue;
      const activityId = val === 'LIBRE' ? null : activityMap[val];
      await prisma.scheduleSegment.create({ data: { userId: user.id, weekday: i+1, startMinute: startM, endMinute: endM, activityId } });
    }
  }
  console.log('Seed complete');
}

main().catch(e=>{ console.error(e); process.exit(1); }).finally(()=>prisma.$disconnect());

"use client";
import React, { useEffect, useState, useMemo } from 'react';
import { useToast } from '../toast/ToastProvider';
import { Button, IconButton } from '../ui/Button';
import { IconAdd, IconEdit, IconTrash, IconSave, IconClose } from '../ui/icons';
import { useUnit } from '../UnitProvider';
import { fmtMinutes, fmtHoursMinutes } from '../../lib/time';

interface Activity { id: string; name: string; color: string | null; weeklyTargetMinutes: number; createdAt: string; }

export default function ActivitiesClient() {
  const { addToast } = useToast();
  const { unit, setUnit } = useUnit();
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', color: '#2563eb', weeklyTargetMinutes: 0 });
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ name: string; color: string; weeklyTargetMinutes: number }>({ name: '', color: '#000000', weeklyTargetMinutes: 0 });
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null); // two-step delete
  const [search, setSearch] = useState('');

  async function load() {
    try {
      setLoading(true);
      const res = await fetch('/api/activities');
      if (!res.ok) throw new Error('Failed loading activities');
      const json = await res.json();
      setItems(json.activities || []);
    } catch (e:any) {
      setError(e.message);
      addToast({ message: e.message || 'Load error', type: 'error' });
    } finally { setLoading(false); }
  }
  useEffect(()=>{ load(); }, []);

  async function createActivity(e: React.FormEvent) {
    e.preventDefault();
    try {
      setCreating(true);
      const res = await fetch('/api/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error('Create failed');
      setForm({ name: '', color: '#2563eb', weeklyTargetMinutes: 0 });
      load();
  } catch (e:any) { setError(e.message); addToast({ message: e.message || 'Failed to create activity', type: 'error' }); } finally { setCreating(false); }
  if(!error) addToast({ message: 'Created activity', type: 'success' });
  }

  function startEdit(it: Activity) {
    setEditingId(it.id);
    setEditData({ name: it.name, color: it.color || '#000000', weeklyTargetMinutes: it.weeklyTargetMinutes });
  }

  async function saveEdit(id: string) {
    try {
      const res = await fetch(`/api/activities?id=${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editData) });
      if (!res.ok) throw new Error('Update failed');
      setEditingId(null);
      load();
  } catch (e:any) { setError(e.message); addToast({ message: e.message || 'Failed to update activity', type: 'error' }); return; }
  addToast({ message: 'Updated activity', type: 'success' });
  }

  async function remove(id: string) {
    if(pendingDeleteId !== id){
      setPendingDeleteId(id);
      setTimeout(()=>{
        setPendingDeleteId(curr => curr === id ? null : curr);
      }, 4000);
      return;
    }
    try {
      const res = await fetch(`/api/activities?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setPendingDeleteId(null);
      load();
  } catch (e:any) { setError(e.message); addToast({ message: e.message || 'Failed to delete activity', type: 'error' }); return; }
  addToast({ message: 'Deleted activity', type: 'success' });
  }

  const filteredItems = useMemo(()=>{
    if(!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(i => i.name.toLowerCase().includes(q));
  }, [items, search]);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="tt-heading-page">Activities</h1>
        <div className="flex items-center gap-1" aria-label="Units switch">
          <Button size="sm" variant={unit==='min' ? 'primary' : 'ghost'} onClick={()=>setUnit('min')}>Min</Button>
          <Button size="sm" variant={unit==='hr' ? 'primary' : 'ghost'} onClick={()=>setUnit('hr')}>Hours</Button>
        </div>
      </header>

      <section className="tt-panel tt-panel-padding space-y-4">
        <h2 className="tt-heading-section">New Activity</h2>
        <form onSubmit={createActivity} className="grid gap-4 md:grid-cols-[1fr_auto_auto_auto] items-end">
          <div className="flex flex-col gap-1">
            <label className="uppercase tracking-wide text-gray-500 dark:text-gray-400 text-[11px]">Name</label>
            <input required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="w-full border rounded p-1 text-xs dark:bg-gray-950 dark:border-gray-700" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="uppercase tracking-wide text-gray-500 dark:text-gray-400 text-[11px]">Color</label>
            <input aria-label="Activity color" type="color" value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))} className="h-9 w-12 p-1 border rounded dark:bg-gray-950 dark:border-gray-700" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="uppercase tracking-wide text-gray-500 dark:text-gray-400 text-[11px]">Weekly Target (m)</label>
            <input type="number" min={0} value={form.weeklyTargetMinutes} onChange={e=>setForm(f=>({...f,weeklyTargetMinutes:Number(e.target.value)}))} className="w-28 border rounded p-1 text-xs dark:bg-gray-950 dark:border-gray-700" />
            <div className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <span>Used for progress metrics & weekly goal tracking.</span>
              {unit==='hr' && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  ≈ {fmtHoursMinutes(form.weeklyTargetMinutes)}
                </span>
              )}
            </div>
          </div>
          <div className="flex md:justify-end">
            <Button type="submit" loading={creating} leftIcon={<IconAdd size={14} />}>{creating ? 'Saving...' : 'Add Activity'}</Button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <h2 className="tt-heading-section">List</h2>
          <div className="flex items-center gap-2 ml-auto">
            <input
              type="text"
              placeholder="Search activities..."
              value={search}
              onChange={e=> setSearch(e.target.value)}
              className="border rounded px-2 py-1 text-xs dark:bg-gray-950 dark:border-gray-700 w-48"
              aria-label="Search activities"
            />
            {search && (
              <Button size="sm" variant="ghost" onClick={()=> setSearch('')}>Clear</Button>
            )}
          </div>
        </div>
        {loading && <p>Loading...</p>}
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {/* Mobile cards */}
        <div className="grid gap-2 sm:hidden">
          {filteredItems.map(it => {
            const editing = editingId === it.id;
            return (
              <div key={it.id} className="border border-gray-200 dark:border-gray-700 rounded p-3 bg-white dark:bg-gray-900 text-[11px] flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  {editing ? (
                    <input value={editData.name} onChange={e=>setEditData(d=>({...d,name:e.target.value}))} className="border dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-950 text-[11px]" />
                  ) : (
                    <span className="flex items-center gap-2 font-medium"><span className="w-3 h-3 rounded-full inline-block" style={{background:it.color||'#999'}} />{it.name}</span>
                  )}
                  <span className="text-[10px] text-gray-500">{unit==='min' ? fmtMinutes(it.weeklyTargetMinutes) : fmtHoursMinutes(it.weeklyTargetMinutes)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {editing ? (
                    <>
                      <input aria-label="Edit color" type="color" value={editData.color} onChange={e=>setEditData(d=>({...d,color:e.target.value}))} className="h-7 w-9 p-1 border dark:border-gray-700 rounded bg-white dark:bg-gray-950" />
                      <input aria-label="Edit weekly target (minutes)" type="number" min={0} value={editData.weeklyTargetMinutes} onChange={e=>setEditData(d=>({...d,weeklyTargetMinutes:Number(e.target.value)}))} className="w-20 border dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-950 text-[11px]" />
                    </>
                  ) : (
                    <span className="text-[10px] text-gray-500">{it.color}</span>
                  )}
                  <div className="ml-auto flex gap-2">
                    {editing ? (
                      <>
                        <Button variant="primary" size="sm" onClick={()=>saveEdit(it.id)} leftIcon={<IconSave size={14} />}>Save</Button>
                        <Button variant="ghost" size="sm" onClick={()=>setEditingId(null)} leftIcon={<IconClose size={14} />}>Cancel</Button>
                      </>
                    ) : (
                      <>
                        <Button variant="secondary" size="sm" onClick={()=>startEdit(it)} leftIcon={<IconEdit size={14} />}>Edit</Button>
                        <Button variant={pendingDeleteId===it.id? 'danger':'ghost'} size="sm" onClick={()=>remove(it.id)} leftIcon={<IconTrash size={14} />}>{pendingDeleteId===it.id? 'Confirm' : 'Delete'}</Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filteredItems.length === 0 && !loading && <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-xs">No activities found.</div>}
        </div>
        {/* Desktop table */}
        <div className="overflow-x-auto hidden sm:block">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 uppercase text-[10px] tracking-wide">
                <th className="text-left px-3 py-2 font-semibold">Activity</th>
                <th className="text-left px-3 py-2 font-semibold">Color</th>
                <th className="text-left px-3 py-2 font-semibold">Weekly Target</th>
                <th className="text-right px-3 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredItems.map(it => {
                const editing = editingId === it.id;
                return (
                  <tr key={it.id} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-3 py-2 align-middle">
                      {editing ? (
                        <input value={editData.name} onChange={e=>setEditData(d=>({...d,name:e.target.value}))} className="w-full border rounded px-2 py-1 text-xs dark:bg-gray-950 dark:border-gray-700" />
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{background:it.color||'#999'}} />
                          <span className="font-medium text-gray-800 dark:text-gray-200">{it.name}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      {editing ? (
                        <input type="color" value={editData.color} onChange={e=>setEditData(d=>({...d,color:e.target.value}))} className="h-8 w-10 p-1 border rounded dark:bg-gray-950 dark:border-gray-700" />
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[10px] font-mono text-gray-600 dark:text-gray-300">{it.color}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      {editing ? (
                        <input type="number" min={0} value={editData.weeklyTargetMinutes} onChange={e=>setEditData(d=>({...d,weeklyTargetMinutes:Number(e.target.value)}))} className="w-24 border rounded px-2 py-1 text-xs dark:bg-gray-950 dark:border-gray-700" />
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-medium">{unit==='min' ? fmtMinutes(it.weeklyTargetMinutes) : fmtHoursMinutes(it.weeklyTargetMinutes)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-middle text-right">
                      <div className="inline-flex items-center gap-2">
                        {editing ? (
                          <>
                            <Button variant="primary" size="sm" onClick={()=>saveEdit(it.id)} leftIcon={<IconSave size={14} />}>Save</Button>
                            <Button variant="ghost" size="sm" onClick={()=>setEditingId(null)} leftIcon={<IconClose size={14} />}>Cancel</Button>
                          </>
                        ) : (
                          <>
                            <Button variant="secondary" size="sm" onClick={()=>startEdit(it)} leftIcon={<IconEdit size={14} />}>Edit</Button>
                            <Button variant={pendingDeleteId===it.id? 'danger':'ghost'} size="sm" onClick={()=>remove(it.id)} leftIcon={<IconTrash size={14} />}>{pendingDeleteId===it.id? 'Confirm' : 'Delete'}</Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-500 dark:text-gray-400 text-xs">No activities yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

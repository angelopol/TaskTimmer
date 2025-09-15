"use client";
import React, { useEffect, useState } from 'react';

interface Activity { id: string; name: string; color: string | null; weeklyTargetMinutes: number; createdAt: string; }

export default function ActivitiesClient() {
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', color: '#2563eb', weeklyTargetMinutes: 0 });
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ name: string; color: string; weeklyTargetMinutes: number }>({ name: '', color: '#000000', weeklyTargetMinutes: 0 });
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null); // two-step delete

  async function load() {
    try {
      setLoading(true);
      const res = await fetch('/api/activities');
      if (!res.ok) throw new Error('Failed loading activities');
      const json = await res.json();
      setItems(json.activities || []);
    } catch (e:any) {
      setError(e.message);
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
    } catch (e:any) { setError(e.message); } finally { setCreating(false); }
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
    } catch (e:any) { setError(e.message); }
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
    } catch (e:any) { setError(e.message); }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Activities</h1>
      </header>

      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-4 shadow-sm">
        <h2 className="font-medium mb-3 text-sm tracking-wide uppercase text-gray-600 dark:text-gray-300">Create</h2>
        <form onSubmit={createActivity} className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Name</label>
            <input required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="w-full border dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-900 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Color</label>
            <input type="color" value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))} className="h-9 w-12 p-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-900" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Weekly Target (min)</label>
            <input type="number" min={0} value={form.weeklyTargetMinutes} onChange={e=>setForm(f=>({...f,weeklyTargetMinutes:Number(e.target.value)}))} className="w-28 border dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-900 text-sm" />
          </div>
          <button disabled={creating} className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded disabled:opacity-50">{creating ? 'Saving...' : 'Add'}</button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium text-sm tracking-wide uppercase text-gray-600 dark:text-gray-300">List</h2>
        {loading && <p>Loading...</p>}
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {/* Mobile cards */}
        <div className="grid gap-2 sm:hidden">
          {items.map(it => {
            const editing = editingId === it.id;
            return (
              <div key={it.id} className="border border-gray-200 dark:border-gray-700 rounded p-2 bg-white dark:bg-gray-800 text-xs flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  {editing ? (
                    <input value={editData.name} onChange={e=>setEditData(d=>({...d,name:e.target.value}))} className="border dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-900 text-xs" />
                  ) : (
                    <span className="flex items-center gap-2 font-medium"><span className="w-3 h-3 rounded-full inline-block" style={{background:it.color||'#999'}} />{it.name}</span>
                  )}
                  <span className="text-[10px] text-gray-500">{it.weeklyTargetMinutes}m</span>
                </div>
                <div className="flex items-center gap-2">
                  {editing ? (
                    <input type="color" value={editData.color} onChange={e=>setEditData(d=>({...d,color:e.target.value}))} className="h-7 w-9 p-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-900" />
                  ) : (
                    <span className="text-[10px] text-gray-500">{it.color}</span>
                  )}
                  {editing ? (
                    <input type="number" min={0} value={editData.weeklyTargetMinutes} onChange={e=>setEditData(d=>({...d,weeklyTargetMinutes:Number(e.target.value)}))} className="w-20 border dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-900 text-xs" />
                  ) : null}
                  <div className="ml-auto flex gap-2">
                    {editing ? (
                      <>
                        <button onClick={()=>saveEdit(it.id)} className="text-blue-600">Save</button>
                        <button onClick={()=>setEditingId(null)} className="text-gray-500">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={()=>startEdit(it)} className="text-blue-600">Edit</button>
                        <button onClick={()=>remove(it.id)} className={"text-red-600 " + (pendingDeleteId===it.id? 'font-bold animate-pulse' : '')}>{pendingDeleteId===it.id? 'Confirm' : 'Del'}</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {items.length === 0 && !loading && <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-xs">No activities yet.</div>}
        </div>
        {/* Desktop table */}
        <div className="overflow-x-auto hidden sm:block">
          <table className="min-w-full text-sm border-separate border-spacing-y-1">
            <thead>
              <tr className="text-left text-gray-600 dark:text-gray-300">
                <th className="py-1 pr-4">Name</th>
                <th className="py-1 pr-4">Color</th>
                <th className="py-1 pr-4">Weekly Target</th>
                <th className="py-1 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => {
                const editing = editingId === it.id;
                return (
                  <tr key={it.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                    <td className="py-2 pr-4 font-medium">
                      {editing ? (
                        <input value={editData.name} onChange={e=>setEditData(d=>({...d,name:e.target.value}))} className="border dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-900" />
                      ) : (
                        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{background:it.color||'#999'}} />{it.name}</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {editing ? (
                        <input type="color" value={editData.color} onChange={e=>setEditData(d=>({...d,color:e.target.value}))} className="h-8 w-10 p-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-900" />
                      ) : (
                        <span>{it.color}</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {editing ? (
                        <input type="number" min={0} value={editData.weeklyTargetMinutes} onChange={e=>setEditData(d=>({...d,weeklyTargetMinutes:Number(e.target.value)}))} className="w-24 border dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-900" />
                      ) : (
                        it.weeklyTargetMinutes
                      )}
                    </td>
                    <td className="py-2 pr-4 space-x-2">
                      {editing ? (
                        <>
                          <button onClick={()=>saveEdit(it.id)} className="text-blue-600 hover:underline">Save</button>
                          <button onClick={()=>setEditingId(null)} className="text-gray-500 hover:underline">Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={()=>startEdit(it)} className="text-blue-600 hover:underline">Edit</button>
                          <button onClick={()=>remove(it.id)} className={"text-red-600 hover:underline " + (pendingDeleteId===it.id? 'font-bold animate-pulse' : '')}>{pendingDeleteId===it.id? 'Confirm' : 'Delete'}</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-gray-500 dark:text-gray-400">No activities yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

"use client";
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
export type Unit = 'min' | 'hr';
const UnitContext = createContext<{ unit:Unit; setUnit:(unit:Unit)=>void } | undefined>(undefined);
export function UnitProvider({ children }: { children:React.ReactNode }) {
  const [unit, setValue] = useState<Unit>('hr');
  useEffect(() => { try { const saved = localStorage.getItem('tt_unit'); if (saved === 'hr' || saved === 'min') setValue(saved); } catch {} }, []);
  const setUnit = useCallback((value:Unit) => { setValue(value); try { localStorage.setItem('tt_unit', value); } catch {} }, []);
  const value = useMemo(() => ({ unit, setUnit }), [unit, setUnit]);
  return <UnitContext.Provider value={value}>{children}</UnitContext.Provider>;
}
export function useUnit() { const context = useContext(UnitContext); if (!context) throw new Error('Missing UnitProvider'); return context; }


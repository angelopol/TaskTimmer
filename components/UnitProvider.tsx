"use client";
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Unit = 'min' | 'hr';

type UnitContextValue = {
  unit: Unit;
  setUnit: (u: Unit) => void;
};

const UnitContext = createContext<UnitContextValue | undefined>(undefined);

export function UnitProvider({ children }: { children: React.ReactNode }){
  const [unit, setUnitState] = useState<Unit>(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('tt_unit');
      if (stored === 'min' || stored === 'hr') return stored;
    }
    // Default to Hours as requested
    return 'hr';
  });

  const setUnit = (u: Unit) => setUnitState(u);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('tt_unit', unit);
    }
  }, [unit]);

  const value = useMemo(() => ({ unit, setUnit }), [unit]);
  return (
    <UnitContext.Provider value={value}>{children}</UnitContext.Provider>
  );
}

export function useUnit(){
  const ctx = useContext(UnitContext);
  if(!ctx) throw new Error('useUnit must be used within UnitProvider');
  return ctx;
}

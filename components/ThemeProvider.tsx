"use client";
import React, { createContext, useContext, useEffect, useCallback, useState } from 'react';
export type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';
const ThemeContext = createContext<{ theme:Theme; preference:ThemePreference; toggle:()=>void; setTheme:(preference:ThemePreference)=>void } | undefined>(undefined);
const read = (): ThemePreference => {
  try { const stored = localStorage.getItem('tt_theme'); if (stored === 'dark' || stored === 'light') return stored; } catch {}
  return 'system';
};
export function ThemeProvider({ children }: { children:React.ReactNode }) {
  const [theme, setValue] = useState<Theme>('light');
  const [preference, setPreference] = useState<ThemePreference>('system');
  // Resolves the preference against the device setting; "system" follows it live.
  const apply = useCallback((pref:ThemePreference) => {
    const value = pref === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : pref;
    setPreference(pref); setValue(value);
    document.documentElement.classList.toggle('dark', value === 'dark');
  }, []);
  const setTheme = useCallback((pref:ThemePreference) => {
    try { if (pref === 'system') localStorage.removeItem('tt_theme'); else localStorage.setItem('tt_theme', pref); } catch {}
    apply(pref);
  }, [apply]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => apply(read());
    sync(); media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [apply]);
  return <ThemeContext.Provider value={{ theme, preference, setTheme, toggle:() => setTheme(theme === 'dark' ? 'light' : 'dark') }}>{children}</ThemeContext.Provider>;
}
export function useTheme() { const context = useContext(ThemeContext); if (!context) throw new Error('Missing ThemeProvider'); return context; }

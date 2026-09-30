"use client";
import React, { createContext, useContext, useEffect, useCallback, useState } from 'react';
export type Theme = 'light' | 'dark';
const ThemeContext = createContext<{ theme:Theme; toggle:()=>void; setTheme:(theme:Theme)=>void } | undefined>(undefined);
export function ThemeProvider({ children }: { children:React.ReactNode }) {
  const [theme, setValue] = useState<Theme>('light');
  const apply = useCallback((value:Theme) => { setValue(value); document.documentElement.classList.toggle('dark', value === 'dark'); }, []);
  const setTheme = useCallback((value:Theme) => { try { localStorage.setItem('tt_theme', value); } catch {} apply(value); }, [apply]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const system = () => {
      let stored:string | null = null;
      try { stored = localStorage.getItem('tt_theme'); } catch {}
      apply(stored === 'dark' || stored === 'light' ? stored : media.matches ? 'dark' : 'light');
    };
    system(); media.addEventListener('change', system);
    return () => media.removeEventListener('change', system);
  }, [apply]);
  return <ThemeContext.Provider value={{ theme, setTheme, toggle:() => setTheme(theme === 'dark' ? 'light' : 'dark') }}>{children}</ThemeContext.Provider>;
}
export function useTheme() { const context = useContext(ThemeContext); if (!context) throw new Error('Missing ThemeProvider'); return context; }


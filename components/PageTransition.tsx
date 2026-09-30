"use client";
import React from 'react';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
// Opacity only: a transform here would become the containing block for fixed children (FAB, tab bar offsets).
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  return <motion.div key={pathname} initial={reduce ? false : { opacity:0 }} animate={{ opacity:1 }} transition={{ duration:.18, ease:'easeOut' }}>{children}</motion.div>;
}

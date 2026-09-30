"use client";
import React from 'react';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  return <motion.div key={pathname} initial={false} animate={{ opacity:1, y:0 }} transition={{ duration:reduce ? 0 : .15 }}>{children}</motion.div>;
}


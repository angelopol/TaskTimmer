"use client";
import React from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

interface Props { children: React.ReactNode; }

/**
 * Provides a consistent route-level transition mimicking the schedule/manage switch:
 * fade + subtle vertical slide + slight scale. Respects reduced motion preference.
 */
export function PageTransition({ children }: Props) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const firstRef = React.useRef(true);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const prevHeightRef = React.useRef<number>(0);
  const [lockedHeight, setLockedHeight] = React.useState<number | null>(null);
  const pathRef = React.useRef(pathname);

  // Measure on each render after layout to keep the last stable height
  React.useLayoutEffect(() => {
    if (contentRef.current) {
      const h = contentRef.current.offsetHeight;
      if (h > 0) prevHeightRef.current = h;
    }
  });

  // Handle route change height locking / animation
  React.useEffect(() => {
    if (pathRef.current !== pathname) {
      // Lock container to previous height before exit/enter sequence
      const previous = prevHeightRef.current;
      if (previous > 0) setLockedHeight(previous);
      pathRef.current = pathname;
      // After next paint (new content rendered), measure target height and animate container height
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (contentRef.current) {
            const target = contentRef.current.offsetHeight;
            if (target > 0) {
              // Transition container height to new height (CSS transition on wrapper)
              setLockedHeight(target);
              // After transition completes, release to auto to allow internal growth
              setTimeout(() => setLockedHeight(null), 320);
            } else {
              setLockedHeight(null);
            }
          } else {
            setLockedHeight(null);
          }
        });
      });
    }
  }, [pathname]);

  const INITIAL = reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.985 };
  const ANIMATE = reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 };
  const EXIT = reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.985 };

  // Allow opting out of animations by placing data-transition="instant" on body or html
  const instant = typeof document !== 'undefined' && (document.body.dataset.transition === 'instant' || document.documentElement.dataset.transition === 'instant');
  const motionDuration = instant || reduce ? 0 : 0.22;
  const heightDuration = instant || reduce ? 0 : 0.30; // slightly longer for height ease

  // Disable initial animation on first SSR -> hydration to avoid flash (we render already in final state)
  const initialProp = firstRef.current ? false : INITIAL;
  React.useEffect(() => { firstRef.current = false; }, []);

  return (
    <div
      className="relative transition-[height] ease-out overflow-hidden"
      style={{
        height: lockedHeight != null ? lockedHeight : 'auto',
        transitionDuration: `${heightDuration * 1000}ms`
      }}
      data-page-transition-wrapper
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          ref={contentRef}
          key={pathname}
          initial={initialProp}
          animate={ANIMATE}
          exit={EXIT}
          transition={{ duration: motionDuration, ease: [0.4, 0.2, 0.2, 1] }}
          className="will-change-[opacity,transform]"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

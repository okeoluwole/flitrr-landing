'use client';

import { useEffect, useRef, useState } from 'react';

/** Shared motion hooks for the Considered marketing pages. */

export function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(m.matches);
    const h = () => setReduce(m.matches);
    m.addEventListener?.('change', h);
    return () => m.removeEventListener?.('change', h);
  }, []);
  return reduce;
}

/**
 * True once the element has entered the viewport; disconnects after the first
 * intersection. Without IntersectionObserver it reports true immediately.
 */
export function useInViewOnce(threshold = 0.3) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!('IntersectionObserver' in window)) {
      setSeen(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (e.isIntersecting) {
            setSeen(true);
            io.disconnect();
          }
        });
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, seen];
}

/**
 * Renders `to`, counting up from zero once `play` turns true. Server markup
 * and reduced motion both show the real number; the timeout guarantees the
 * final value even where rAF is throttled (background tabs).
 */
export function CountTo({ to, play, delay = 0, duration = 850 }) {
  const [n, setN] = useState(to);
  useEffect(() => {
    if (!play) return undefined;
    let raf;
    const t0 = performance.now() + delay;
    setN(0);
    const step = (now) => {
      const p = Math.min(Math.max((now - t0) / duration, 0), 1);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const done = setTimeout(() => setN(to), delay + duration + 400);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [play, to, delay, duration]);
  return n;
}

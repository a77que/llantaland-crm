import { useState, useEffect } from 'react';

export const BREAKPOINTS = { mobile: 768, tablet: 1024 };

function useMediaQuery(maxWidth) {
  const [matches, setMatches] = useState(() => window.innerWidth < maxWidth);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth - 1}px)`);
    const handler = (e) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [maxWidth]);
  return matches;
}

export function useIsMobile() { return useMediaQuery(BREAKPOINTS.mobile); }
export function useIsTablet() { return useMediaQuery(BREAKPOINTS.tablet); }

// true en móvil O tablet (< 1024px)
export function useIsMobileOrTablet() { return useMediaQuery(BREAKPOINTS.tablet); }

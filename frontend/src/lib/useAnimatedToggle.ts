'use client';
import { useEffect, useState } from 'react';

/** Reproduit l'animation d'ouverture/fermeture de l'original (hidden → opacity/translate après 10 ms ; masqué après 300 ms). */
export function useAnimatedToggle(open: boolean) {
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const t = setTimeout(() => setShown(true), 10);
      return () => clearTimeout(t);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), 300);
    return () => clearTimeout(t);
  }, [open]);
  return { mounted, shown };
}

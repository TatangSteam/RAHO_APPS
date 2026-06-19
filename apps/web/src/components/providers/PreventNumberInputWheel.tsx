'use client';

import { useEffect } from 'react';

export function PreventNumberInputWheel() {
  useEffect(() => {
    const preventNumberWheel = (event: WheelEvent) => {
      const target = event.target;

      if (
        target instanceof HTMLInputElement &&
        target.type === 'number' &&
        document.activeElement === target
      ) {
        event.preventDefault();
      }
    };

    document.addEventListener('wheel', preventNumberWheel, { capture: true, passive: false });

    return () => {
      document.removeEventListener('wheel', preventNumberWheel, { capture: true });
    };
  }, []);

  return null;
}

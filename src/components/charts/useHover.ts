import { useCallback, useState, type KeyboardEvent, type PointerEvent } from 'react';

/** Hover + keyboard cursor over n evenly spaced points, shared by the line-type charts. */
export function useHover(n: number) {
  const [active, setActive] = useState<number | null>(null);
  const idx = active !== null && active >= 0 && active < n ? active : null;

  const onPointerMove = useCallback((e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (!(r.width > 0) || n < 1) return;
    const k = n === 1 ? 0 : Math.round(((e.clientX - r.left) / r.width) * (n - 1));
    setActive(Math.max(0, Math.min(n - 1, k)));
  }, [n]);
  const onPointerLeave = useCallback(() => setActive(null), []);
  const onKeyDown = useCallback((e: KeyboardEvent<HTMLElement>) => {
    if (n < 1) return;
    const cur = idx ?? -1;
    let next: number | null | undefined;
    if (e.key === 'ArrowRight') next = Math.min(n - 1, cur + 1);
    else if (e.key === 'ArrowLeft') next = Math.max(0, cur < 0 ? n - 1 : cur - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    else if (e.key === 'Escape') next = null;
    else return;
    e.preventDefault();
    setActive(next);
  }, [n, idx]);
  const onBlur = useCallback(() => setActive(null), []);

  return { idx, onPointerMove, onPointerLeave, onKeyDown, onBlur };
}

import { useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';

type Size = { width: number; height: number };
type Point = { x: number; y: number };
type Camera = Point & { width: number; mode: 'follow' | 'free' | 'destination' | 'overview' };
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const DRAG_THRESHOLD = 6;

// Only presentation state lives here. Camera gestures never dispatch game actions.
export function useMapCamera(size: Size, position: readonly number[], playerId: number) {
  const viewport = useRef<HTMLDivElement>(null);
  const narrow = size.width <= 600 && size.height >= 500;
  const top = narrow ? 154 : 78;
  const bottom = size.height - (narrow ? 120 : 94);
  const center = { x: size.width / 2, y: (top + bottom) / 2 };
  // Cover the entire viewport, including the area behind the controls.
  const fitWidth = Math.max(size.width, size.height * 16 / 9);
  const normalWidth = fitWidth * 1.05;
  const bound = (c: Camera): Camera => ({ ...c,
    x: clamp(c.x, size.width - c.width, 0),
    y: clamp(c.y, size.height - c.width * 9 / 16, 0),
  });
  const centered = (point: readonly number[], width: number, mode: Camera['mode']): Camera => bound({
    width, mode, x: center.x - point[0] * width / 100, y: center.y - point[1] * width * 9 / 1600,
  });
  const [camera, setCamera] = useState<Camera>(() => centered(position, normalWidth, 'follow'));
  const live = useRef(camera);
  const update = (value: Camera) => { live.current = value; setCamera(value); };
  const prior = useRef({ ...size, playerId });
  useLayoutEffect(() => {
    const c = live.current;
    const resized = prior.current.width !== size.width || prior.current.height !== size.height;
    const changedPlayer = prior.current.playerId !== playerId;
    prior.current = { ...size, playerId };
    if (c.mode !== 'follow') {
      const width = clamp(c.width, fitWidth, normalWidth * 2.5);
      const next = resized && c.mode === 'overview' ? centered([50, 50], fitWidth, 'overview') : bound({ ...c, width });
      if (next.width !== c.width || Math.abs(next.x - c.x) > .01 || Math.abs(next.y - c.y) > .01) update(next);
      return;
    }
    if (resized || changedPlayer) { update(centered(position, resized ? normalWidth : c.width, 'follow')); return; }
    const px = c.x + position[0] * c.width / 100;
    const py = c.y + position[1] * c.width * 9 / 1600;
    const left = size.width * .3, right = size.width * .65;
    const safeTop = top + (bottom - top) * .25, safeBottom = bottom - (bottom - top) * .25;
    const next = bound({ ...c, x: c.x + (clamp(px, left, right) - px), y: c.y + (clamp(py, safeTop, safeBottom) - py) });
    // Fractional layout coordinates must not keep a layout effect updating itself.
    if (Math.abs(next.x - c.x) > .01 || Math.abs(next.y - c.y) > .01) update(next);
  });

  const zoom = (factor: number, anchor = center, base = live.current) => {
    const width = clamp(base.width * factor, fitWidth, normalWidth * 2.5);
    const ratio = width / base.width;
    update(bound({ mode: 'free', width, x: anchor.x - (anchor.x - base.x) * ratio, y: anchor.y - (anchor.y - base.y) * ratio }));
  };
  // Native non-passive wheel listener prevents the page/browser from scrolling under the map.
  const wheel = useRef<(e: WheelEvent) => void>(() => {});
  wheel.current = e => {
    e.preventDefault();
    const rect = viewport.current!.getBoundingClientRect();
    const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? size.height : 1);
    zoom(Math.exp(-clamp(delta, -200, 200) * .002), { x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const listener = (e: WheelEvent) => wheel.current(e);
    node.addEventListener('wheel', listener, { passive: false });
    return () => node.removeEventListener('wheel', listener);
  }, []);

  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ camera: Camera; center: Point; distance: number } | null>(null);
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState(false);
  const measure = () => {
    const values = [...pointers.current.values()];
    const a = values[0], b = values[1] ?? a;
    return { center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.hypot(b.x - a.x, b.y - a.y) };
  };
  const resetGesture = () => { gesture.current = pointers.current.size ? { camera: live.current, ...measure() } : null; };
  const localPoint = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (!pointers.current.size) suppressClick.current = false;
    pointers.current.set(e.pointerId, localPoint(e));
    // Capture on the original target so a stationary tap still clicks the button.
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (pointers.current.size > 1) suppressClick.current = true;
    resetGesture();
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, localPoint(e));
    const current = measure(), start = gesture.current;
    const dx = current.center.x - start.center.x, dy = current.center.y - start.center.y;
    if (!suppressClick.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    suppressClick.current = true;
    setDragging(true);
    const width = clamp(start.camera.width * (start.distance > 0 ? current.distance / start.distance : 1), fitWidth, normalWidth * 2.5);
    const ratio = width / start.camera.width;
    update(bound({ width, mode: 'free', x: current.center.x - (start.center.x - start.camera.x) * ratio,
      y: current.center.y - (start.center.y - start.camera.y) * ratio }));
  };
  const finishPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(e.pointerId)) return;
    resetGesture();
    if (!pointers.current.size) setDragging(false);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const direction: Record<string, Point> = { ArrowLeft: { x: 80, y: 0 }, ArrowRight: { x: -80, y: 0 }, ArrowUp: { x: 0, y: 80 }, ArrowDown: { x: 0, y: -80 } };
    if (direction[e.key]) {
      e.preventDefault();
      const c = live.current, d = direction[e.key];
      update(bound({ ...c, mode: 'free', x: c.x + d.x, y: c.y + d.y }));
    } else if (e.key === '+' || e.key === '=' || e.key === '-') {
      e.preventDefault(); zoom(e.key === '-' ? 1 / 1.25 : 1.25);
    }
  };
  return { ...camera, height: camera.width * 9 / 16, viewport, dragging,
    canZoomIn: camera.width < normalWidth * 2.5 - 1, canZoomOut: camera.width > fitWidth + 1,
    zoomIn: () => zoom(1.25), zoomOut: () => zoom(1 / 1.25),
    follow: () => update(centered(position, normalWidth, 'follow')),
    destination: (point: readonly number[]) => update(centered(point, normalWidth, 'destination')),
    overview: () => update(centered([50, 50], fitWidth, 'overview')),
    bindings: { onPointerDown, onPointerMove, onPointerUp: finishPointer, onPointerCancel: finishPointer, onLostPointerCapture: finishPointer, onKeyDown,
      onClickCapture: (e: ReactMouseEvent<HTMLDivElement>) => { if (suppressClick.current && e.detail !== 0) { e.preventDefault(); e.stopPropagation(); suppressClick.current = false; } },
    },
  };
}

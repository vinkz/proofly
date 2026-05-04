import { useEffect, useRef } from 'react';

export const useSignaturePad = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.style.touchAction = 'none';
    canvas.style.userSelect = 'none';
    canvas.style.webkitUserSelect = 'none';
    canvas.style.setProperty('-webkit-touch-callout', 'none');

    const configureContext = (dpr: number) => {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.scale(dpr, dpr);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.lineWidth = 2;
      context.strokeStyle = '#1f2937';
    };

    const syncCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      const cssWidth = Math.round(rect.width);
      const cssHeight = Math.round(rect.height);
      if (!cssWidth || !cssHeight) return false;

      const dpr = window.devicePixelRatio || 1;
      const nextWidth = Math.round(cssWidth * dpr);
      const nextHeight = Math.round(cssHeight * dpr);
      if (canvas.width !== nextWidth) canvas.width = nextWidth;
      if (canvas.height !== nextHeight) canvas.height = nextHeight;
      configureContext(dpr);
      return true;
    };

    syncCanvasSize();
    const frame = window.requestAnimationFrame(syncCanvasSize);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncCanvasSize);
    observer?.observe(canvas);
    window.addEventListener('resize', syncCanvasSize);

    const preventPageGesture = (event: Event) => {
      if (event.cancelable) event.preventDefault();
    };

    const getPoint = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    };

    const startDrawing = (clientX: number, clientY: number) => {
      const point = getPoint(clientX, clientY);
      isDrawingRef.current = true;
      context.beginPath();
      context.moveTo(point.x, point.y);
    };

    const draw = (clientX: number, clientY: number) => {
      if (!isDrawingRef.current) return;
      const point = getPoint(clientX, clientY);
      context.lineTo(point.x, point.y);
      context.stroke();
    };

    const finishDrawing = () => {
      if (!isDrawingRef.current) return;
      context.closePath();
      isDrawingRef.current = false;
    };

    const onPointerDown = (event: globalThis.PointerEvent) => {
      preventPageGesture(event);
      startDrawing(event.clientX, event.clientY);
      canvas.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event: globalThis.PointerEvent) => {
      preventPageGesture(event);
      draw(event.clientX, event.clientY);
    };

    const onPointerUp = (event: globalThis.PointerEvent) => {
      preventPageGesture(event);
      finishDrawing();
      canvas.releasePointerCapture?.(event.pointerId);
    };

    const onTouchStart = (event: TouchEvent) => {
      preventPageGesture(event);
      if ('PointerEvent' in window) return;
      const touch = event.touches[0];
      if (touch) startDrawing(touch.clientX, touch.clientY);
    };

    const onTouchMove = (event: TouchEvent) => {
      preventPageGesture(event);
      if ('PointerEvent' in window) return;
      const touch = event.touches[0];
      if (touch) draw(touch.clientX, touch.clientY);
    };

    const onTouchEnd = (event: TouchEvent) => {
      preventPageGesture(event);
      if ('PointerEvent' in window) return;
      finishDrawing();
    };

    const onMouseDown = (event: MouseEvent) => {
      if ('PointerEvent' in window) return;
      preventPageGesture(event);
      startDrawing(event.clientX, event.clientY);
    };

    const onMouseMove = (event: MouseEvent) => {
      if ('PointerEvent' in window) return;
      preventPageGesture(event);
      draw(event.clientX, event.clientY);
    };

    const onMouseUp = (event: MouseEvent) => {
      if ('PointerEvent' in window) return;
      preventPageGesture(event);
      finishDrawing();
    };

    const touchOptions = { passive: false };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);
    canvas.addEventListener('touchstart', onTouchStart, touchOptions);
    canvas.addEventListener('touchmove', onTouchMove, touchOptions);
    canvas.addEventListener('touchend', onTouchEnd, touchOptions);
    canvas.addEventListener('touchcancel', onTouchEnd, touchOptions);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', syncCanvasSize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();
  };

  const hasInk = () => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    if (!canvas.width || !canvas.height) return false;
    const context = canvas.getContext('2d');
    if (!context) return false;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    return pixels.some((value) => value !== 0);
  };

  const toDataUrl = () => canvasRef.current?.toDataURL('image/png') ?? '';

  return {
    canvasRef,
    handlers: {},
    clear,
    toDataUrl,
    hasInk,
  };
};

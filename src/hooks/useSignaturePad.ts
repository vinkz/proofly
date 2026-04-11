import { useEffect, useRef } from 'react';
import type { PointerEvent } from 'react';

export const useSignaturePad = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

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

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', syncCanvasSize);
    };
  }, []);

  const getPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const point = getPoint(event);
    if (!context || !point) return;
    isDrawingRef.current = true;
    context.beginPath();
    context.moveTo(point.x, point.y);
    canvas?.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const point = getPoint(event);
    if (!context || !point) return;
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const finish = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!context) return;
    context.closePath();
    isDrawingRef.current = false;
    canvas?.releasePointerCapture(event.pointerId);
  };

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
    handlers: { onPointerDown, onPointerMove, onPointerUp: finish, onPointerLeave: finish },
    clear,
    toDataUrl,
    hasInk,
  };
};

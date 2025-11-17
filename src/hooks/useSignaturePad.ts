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
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      context.scale(dpr, dpr);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.lineWidth = 2;
      context.strokeStyle = '#1f2937';
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
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
    context.clearRect(0, 0, canvas.width, canvas.height);
  };

  const hasInk = () => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
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

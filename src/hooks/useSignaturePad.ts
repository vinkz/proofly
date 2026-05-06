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

  const toDataUrl = () => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width || !canvas.height) return '';
    const context = canvas.getContext('2d');
    if (!context) return canvas.toDataURL('image/png');

    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = image;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha === 0) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    if (minX > maxX || minY > maxY) return canvas.toDataURL('image/png');

    const padding = Math.round((window.devicePixelRatio || 1) * 10);
    const cropX = Math.max(0, minX - padding);
    const cropY = Math.max(0, minY - padding);
    const cropWidth = Math.min(width - cropX, maxX - minX + 1 + padding * 2);
    const cropHeight = Math.min(height - cropY, maxY - minY + 1 + padding * 2);
    const cropped = document.createElement('canvas');
    cropped.width = cropWidth;
    cropped.height = cropHeight;
    const croppedContext = cropped.getContext('2d');
    if (!croppedContext) return canvas.toDataURL('image/png');
    croppedContext.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    return cropped.toDataURL('image/png');
  };

  return {
    canvasRef,
    handlers: {},
    clear,
    toDataUrl,
    hasInk,
  };
};

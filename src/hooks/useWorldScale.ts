
import { useState, useCallback, useRef, WheelEvent, MouseEvent, useEffect } from 'react';
import { WorldTransform } from '../types';

export const useWorldScale = (initialScale = 1.5) => {
  const [transform, setTransform] = useState<WorldTransform>({ x: 0, y: 0, scale: initialScale });
  const targetTransform = useRef<WorldTransform>({ x: 0, y: 0, scale: initialScale });
  const isPanning = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const isAutoTracking = useRef(true);

  // Smooth Camera Interpolation Loop
  useEffect(() => {
    let animationFrameId: number;
    
    const updateCamera = () => {
        if (isAutoTracking.current && !isPanning.current) {
            setTransform(prev => {
                const lerpFactor = 0.08; // Smoothness
                const dx = targetTransform.current.x - prev.x;
                const dy = targetTransform.current.y - prev.y;
                const dScale = targetTransform.current.scale - prev.scale;
                
                // Stop updating if close enough to save renders
                if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1 && Math.abs(dScale) < 0.001) {
                    return prev;
                }

                return {
                    x: prev.x + dx * lerpFactor,
                    y: prev.y + dy * lerpFactor,
                    scale: prev.scale + dScale * lerpFactor
                };
            });
        }
        animationFrameId = requestAnimationFrame(updateCamera);
    };
    
    animationFrameId = requestAnimationFrame(updateCamera);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // External control for the Camera Director
  const setCameraTarget = useCallback((x: number, y: number, scale: number) => {
      targetTransform.current = { x, y, scale };
      isAutoTracking.current = true;
  }, []);

  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    isAutoTracking.current = false; // User takes control
    const { deltaY } = event;
    const scaleFactor = 1.1;
    setTransform(prev => {
      const newScale = deltaY < 0 ? prev.scale * scaleFactor : prev.scale / scaleFactor;
      return { ...prev, scale: Math.max(0.2, Math.min(newScale, 5)) };
    });
  }, []);

  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (event.button !== 0) return;
    isPanning.current = true;
    isAutoTracking.current = false; // User takes control
    lastMousePos.current = { x: event.clientX, y: event.clientY };
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isPanning.current) return;
    const dx = event.clientX - lastMousePos.current.x;
    const dy = event.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: event.clientX, y: event.clientY };
    setTransform(prev => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy,
    }));
  }, []);

  const screenToWorld = useCallback((screenX: number, screenY: number, dimensions: {width: number, height: number}) => {
    const translatedX = screenX - dimensions.width / 2;
    const translatedY = screenY - dimensions.height / 2;
    const unpannedX = translatedX - transform.x;
    const unpannedY = translatedY - transform.y;
    const worldX = unpannedX / transform.scale;
    const worldY = unpannedY / transform.scale;

    return { x: worldX, y: worldY };
  }, [transform]);

  const zoom = useCallback((factor: number) => {
    isAutoTracking.current = false;
    setTransform(prev => {
      const newScale = prev.scale * factor;
      return { ...prev, scale: Math.max(0.2, Math.min(newScale, 5)) };
    });
  }, []);

  return {
    transform,
    handleWheel,
    handleMouseDown,
    handleMouseUp,
    handleMouseMove,
    isPanningRef: isPanning,
    screenToWorld,
    zoom,
    setCameraTarget, // Expose this for the Camera Director
  };
};

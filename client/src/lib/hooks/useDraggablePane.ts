import { useCallback, useEffect, useRef, useState } from "react";

export function useDraggablePane(initialHeight: number, storageKey?: string) {
  // Load height from localStorage if storageKey is provided
  const [height, setHeight] = useState(() => {
    if (storageKey) {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsedHeight = parseInt(stored, 10);
        if (!isNaN(parsedHeight) && parsedHeight >= 100 && parsedHeight <= 800) {
          return parsedHeight;
        }
      }
    }
    return initialHeight;
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef<number>(0);
  const dragStartHeight = useRef<number>(0);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      dragStartY.current = e.clientY;
      dragStartHeight.current = height;
      document.body.style.userSelect = "none";
      document.body.style.cursor = "row-resize";
    },
    [height],
  );

  const handleDragMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      const deltaY = dragStartY.current - e.clientY;
      const newHeight = Math.max(
        100, // Minimum height
        Math.min(Math.floor(window.innerHeight * 0.7), dragStartHeight.current + deltaY), // Maximum height (70% of viewport)
      );
      setHeight(newHeight);
      
      // Persist to localStorage if storageKey is provided
      if (storageKey) {
        localStorage.setItem(storageKey, newHeight.toString());
      }
    },
    [isDragging, storageKey],
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, []);

  const resetHeight = useCallback(() => {
    setHeight(initialHeight);
    if (storageKey) {
      localStorage.setItem(storageKey, initialHeight.toString());
    }
  }, [initialHeight, storageKey]);

  const setCustomHeight = useCallback((newHeight: number) => {
    const clampedHeight = Math.max(100, Math.min(Math.floor(window.innerHeight * 0.7), newHeight));
    setHeight(clampedHeight);
    if (storageKey) {
      localStorage.setItem(storageKey, clampedHeight.toString());
    }
  }, [storageKey]);

  // Sync height with initialHeight changes when not dragging and no stored value
  useEffect(() => {
    if (!isDragging && (!storageKey || !localStorage.getItem(storageKey))) {
      setHeight(initialHeight);
    }
  }, [initialHeight, isDragging, storageKey]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleDragMove);
      window.addEventListener("mouseup", handleDragEnd);
      return () => {
        window.removeEventListener("mousemove", handleDragMove);
        window.removeEventListener("mouseup", handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Handle window resize to adjust max height
  useEffect(() => {
    const handleResize = () => {
      const maxHeight = Math.floor(window.innerHeight * 0.7);
      if (height > maxHeight) {
        setCustomHeight(maxHeight);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [height, setCustomHeight]);

  return {
    height,
    isDragging,
    handleDragStart,
    resetHeight,
    setCustomHeight,
  };
}

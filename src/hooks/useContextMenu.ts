import { useState, useEffect, useRef } from "react";

interface ContextMenuState<T> {
  x: number;
  y: number;
  data: T;
  cardElement: HTMLElement | null;
}

export const useContextMenu = <T>() => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState<T> | null>(
    null
  );
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Close context menu when clicking outside or scrolling
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    const handleScroll = () => setContextMenu(null);

    if (contextMenu) {
      document.addEventListener("click", handleClickOutside);
      window.addEventListener("scroll", handleScroll, true);
      return () => {
        document.removeEventListener("click", handleClickOutside);
        window.removeEventListener("scroll", handleScroll, true);
      };
    }
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent, data: T) => {
    e.preventDefault();
    const cardElement = e.currentTarget as HTMLElement;
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      data,
      cardElement,
    });
  };

  const handleLongPressStart = (e: React.TouchEvent, data: T) => {
    const cardElement = e.currentTarget as HTMLElement;
    longPressTimer.current = setTimeout(() => {
      const rect = cardElement.getBoundingClientRect();
      setContextMenu({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        data,
        cardElement,
      });
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const closeContextMenu = () => setContextMenu(null);

  return {
    contextMenu,
    handleContextMenu,
    handleLongPressStart,
    handleLongPressEnd,
    closeContextMenu,
  };
};

'use client';

import * as React from 'react';

interface VirtualListProps {
  itemCount: number;
  itemHeight: number;
  /** Extra rows rendered above/below the visible window so fast scrolling doesn't flash blank rows. */
  overscan?: number;
  renderItem: (index: number) => React.ReactNode;
  className?: string;
}

/**
 * A minimal windowed list: only the rows within (and just outside) the
 * visible scroll area are ever in the DOM. Deliberately hand-rolled instead
 * of a dependency — fixed-height rows are all this app's lists need, and
 * that's a small amount of real logic to own outright.
 */
export function VirtualList({
  itemCount,
  itemHeight,
  overscan = 6,
  renderItem,
  className,
}: VirtualListProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewportHeight, setViewportHeight] = React.useState(0);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setViewportHeight(el.clientHeight);
    const observer = new ResizeObserver(() => setViewportHeight(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const totalHeight = itemCount * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleCount = Math.ceil(viewportHeight / itemHeight) + overscan * 2;
  const endIndex = Math.min(itemCount, startIndex + visibleCount);

  const rows: React.ReactNode[] = [];
  for (let index = startIndex; index < endIndex; index += 1) {
    rows.push(
      <div
        key={index}
        style={{
          position: 'absolute',
          top: index * itemHeight,
          left: 0,
          right: 0,
          height: itemHeight,
        }}
      >
        {renderItem(index)}
      </div>,
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      className={className}
    >
      <div style={{ position: 'relative', height: totalHeight }}>{rows}</div>
    </div>
  );
}

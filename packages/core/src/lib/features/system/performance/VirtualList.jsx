/**
 * OS.8: Virtual List
 */
import React from 'react';
export function VirtualList({ items, height, itemHeight, renderItem, }) {
    const [scrollTop, setScrollTop] = React.useState(0);
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(startIndex + Math.ceil(height / itemHeight) + 1, items.length);
    const visibleItems = items.slice(startIndex, endIndex);
    const offsetY = startIndex * itemHeight;
    return (<div style={{ height, overflow: 'auto' }} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, i) => (<div key={startIndex + i} style={{ height: itemHeight }}>
              {renderItem(item, startIndex + i)}
            </div>))}
        </div>
      </div>
    </div>);
}

/**
 * SolidColor Background - 纯色背景
 */

import React from 'react';

interface SolidColorProps {
  color: string;
  className?: string;
}

export default function SolidColor({ color, className = '' }: SolidColorProps) {
  return (
    <div
      className={`absolute inset-0 transition-colors duration-500 ${className}`}
      style={{ backgroundColor: color }}
    />
  );
}

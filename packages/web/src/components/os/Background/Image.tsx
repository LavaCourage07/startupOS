/**
 * Image Background - 图片背景
 */

import React from 'react';

interface ImageBackgroundProps {
  imageUrl?: string;
  className?: string;
}

export default function ImageBackground({
  imageUrl,
  className = ''
}: ImageBackgroundProps) {
  if (!imageUrl) return null;

  return (
    <div className={`absolute inset-0 ${className}`}>
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-500"
        style={{ backgroundImage: `url(${imageUrl})` }}
      />
    </div>
  );
}

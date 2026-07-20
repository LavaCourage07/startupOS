/**
 * Background Component - Desktop 统一背景
 */

import { BackgroundConfig } from '@originos/core/types';
import SolidColor from './SolidColor';
import ImageBackground from './Image';
import Particles from './Particles';

interface BackgroundProps {
  config: BackgroundConfig;
  className?: string;
}

export default function Background({ config, className = '' }: BackgroundProps) {
  return (
    <div className={`absolute inset-0 -z-10 ${className}`}>
      {config.type === 'solid' && <SolidColor color={config.color || '#0A0A0A'} />}
      {config.type === 'image' && (
        <>
          <ImageBackground imageUrl={config.imageUrl} />
          {config.particlesEnabled && <Particles />}
        </>
      )}
      {config.type === 'particles' && <Particles />}
    </div>
  );
}

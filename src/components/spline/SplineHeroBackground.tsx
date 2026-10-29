import React from 'react';
import { motion } from 'framer-motion';

export interface SplineHeroBackgroundProps {
  sceneUrl?: string;
  className?: string;
}

const DEFAULT_SCENE_URL =
  import.meta.env.VITE_SPLINE_SCENE_URL ||
  'https://prod.spline.design/u8jHuWgjRPok0WbQ/scene.splinecode';

/**
 * SplineHeroBackground
 *
 * Renders the official Spline 3D robot scene with:
 * - A large, soft blue radial glow that radiates from behind the robot and dissolves into the white background
 * - events-target="global" for full-window mouse tracking & head-following
 * - Soft edge fades for seamless blending into the White SaaS layout
 */
export const SplineHeroBackground: React.FC<SplineHeroBackgroundProps> = ({
  sceneUrl = DEFAULT_SCENE_URL,
  className = '',
}) => {
  return (
    <div
      className={`relative w-full h-full min-h-[420px] sm:min-h-[500px] lg:min-h-[580px] flex items-center justify-center overflow-hidden ${className}`}
    >
      {/* 1. Large Soft Blue Radial Glow Backdrop (Outer Aura) */}
      <motion.div
        animate={{
          scale: [1, 1.08, 1],
          opacity: [0.85, 1, 0.85],
        }}
        transition={{
          duration: 7,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute w-[440px] h-[440px] sm:w-[580px] sm:h-[580px] lg:w-[680px] lg:h-[680px] rounded-full pointer-events-none -z-1"
        style={{
          background:
            'radial-gradient(circle at center, rgba(59, 130, 246, 0.26) 0%, rgba(99, 102, 241, 0.15) 35%, rgba(147, 197, 253, 0.08) 55%, transparent 72%)',
          filter: 'blur(55px)',
          transform: 'translate3d(0, 0, 0)',
        }}
      />

      {/* 2. Concentrated Inner Core Blue/Cyan Illumination */}
      <motion.div
        animate={{
          scale: [1, 1.05, 0.98, 1],
          opacity: [0.75, 0.9, 0.75],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 0.5,
        }}
        className="absolute w-[260px] h-[260px] sm:w-[340px] sm:h-[340px] lg:w-[420px] lg:h-[420px] rounded-full pointer-events-none -z-1"
        style={{
          background:
            'radial-gradient(circle at center, rgba(37, 99, 235, 0.28) 0%, rgba(56, 189, 248, 0.18) 42%, transparent 70%)',
          filter: 'blur(38px)',
          transform: 'translate3d(0, 0, 0)',
        }}
      />

      {/* 3. Official Spline 3D Robot Viewer */}
      <div className="absolute inset-0 w-full h-full flex items-center justify-center z-0">
        {React.createElement('spline-viewer', {
          url: sceneUrl,
          'events-target': 'global',
          style: {
            width: '100%',
            height: '100%',
            display: 'block',
            outline: 'none',
          },
        })}
      </div>

      {/* 4. Subtle perimeter fades ensuring absolute seamless blend into #FFFFFF */}
      <div className="absolute inset-y-0 left-0 w-8 sm:w-16 bg-gradient-to-r from-white to-transparent pointer-events-none z-1" />
      <div className="absolute inset-y-0 right-0 w-8 sm:w-16 bg-gradient-to-l from-white to-transparent pointer-events-none z-1" />
      <div className="absolute top-0 inset-x-0 h-10 sm:h-16 bg-gradient-to-b from-white to-transparent pointer-events-none z-1" />
      <div className="absolute bottom-0 inset-x-0 h-16 sm:h-24 bg-gradient-to-t from-white to-transparent pointer-events-none z-1" />
    </div>
  );
};

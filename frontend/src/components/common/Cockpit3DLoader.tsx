import React from 'react';
import { Layers, Sparkles, RefreshCw, Zap } from 'lucide-react';

export type LoaderVariant = 'fullscreen' | 'module' | 'card' | 'inline' | 'ai' | 'sync';
export type LoaderSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface Cockpit3DLoaderProps {
  variant?: LoaderVariant;
  size?: LoaderSize;
  text?: string;
  subtitle?: string;
  className?: string;
}

export const Cockpit3DLoader: React.FC<Cockpit3DLoaderProps> = ({
  variant = 'module',
  size = 'md',
  text,
  subtitle,
  className = ''
}) => {
  // Dimension map for 3D gyroscope rings
  const dimensions = {
    xs: { outer: 'w-6 h-6', core: 'w-3 h-3', ring1: 'w-6 h-6', ring2: 'w-5 h-5', ring3: 'w-4 h-4' },
    sm: { outer: 'w-10 h-10', core: 'w-4 h-4', ring1: 'w-10 h-10', ring2: 'w-8 h-8', ring3: 'w-6 h-6' },
    md: { outer: 'w-16 h-16', core: 'w-7 h-7', ring1: 'w-16 h-16', ring2: 'w-13 h-13', ring3: 'w-10 h-10' },
    lg: { outer: 'w-24 h-24', core: 'w-10 h-10', ring1: 'w-24 h-24', ring2: 'w-20 h-20', ring3: 'w-16 h-16' },
    xl: { outer: 'w-32 h-32', core: 'w-14 h-14', ring1: 'w-32 h-32', ring2: 'w-26 h-26', ring3: 'w-20 h-20' }
  }[size];

  // Base 3D Gyroscope Element
  const render3DGyroscope = () => (
    <div className={`relative flex items-center justify-center ${dimensions.outer} perspective-800 preserve-3d select-none`}>
      {/* 3D Floor Shadow Pulse */}
      <div className="absolute -bottom-3 w-3/4 h-2 rounded-full bg-rose-500/20 dark:bg-rose-500/30 blur-xs cockpit-shadow-3d pointer-events-none" />

      {/* Outer Orbital Ring (Alpha: Crimson Gradient with Photon particle) */}
      <div className={`absolute ${dimensions.ring1} rounded-full border border-rose-500/40 dark:border-rose-500/60 cockpit-orbit-1 preserve-3d`}>
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#D62839] shadow-[0_0_10px_#D62839]" />
      </div>

      {/* Inner Equatorial Ring (Beta: Blue/Indigo Gradient counter-rotating) */}
      <div className={`absolute ${dimensions.ring2} rounded-full border border-blue-400/40 dark:border-blue-500/50 cockpit-orbit-2 preserve-3d`}>
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_#60A5FA]" />
      </div>

      {/* Tertiary Inclined Ring (Gamma: Amber/Gold accent) */}
      <div className={`absolute ${dimensions.ring3} rounded-full border border-amber-400/30 dark:border-amber-400/40 cockpit-orbit-3 preserve-3d`}>
        <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#FBBF24]" />
      </div>

      {/* Central Floating Isometric 3D AI Core */}
      <div className={`relative z-10 ${dimensions.core} rounded-xl bg-gradient-to-tr from-[#B91C2C] via-[#D62839] to-rose-400 text-white flex items-center justify-center shadow-lg shadow-[#D62839]/40 cockpit-core-3d`}>
        <Layers className="w-1/2 h-1/2 text-white animate-pulse" />
      </div>
    </div>
  );

  // Variant: Fullscreen Application Loading
  if (variant === 'fullscreen') {
    return (
      <div className={`min-h-screen bg-[#F8FAFC] dark:bg-[#07090E] flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-200 ${className}`}>
        {/* Subtle Ambient Radial Glows */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-rose-500/10 dark:bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center space-y-6 max-w-sm">
          {/* Main 3D Gyroscope in XL scale */}
          <div className="p-4">
            {render3DGyroscope()}
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center justify-center gap-2">
              <span>MY COCKPIT</span>
              <span className="text-[#D62839] dark:text-rose-400">AI</span>
            </h1>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {text || 'Initializing Business Intelligence Engine...'}
            </p>
            {subtitle && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                {subtitle}
              </p>
            )}
          </div>

          {/* Micro Progress Track */}
          <div className="w-48 h-1 bg-slate-200 dark:bg-white/[0.08] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#D62839] via-rose-400 to-[#D62839] rounded-full w-2/3 animate-[cockpit-shimmer_1.5s_infinite]" />
          </div>
        </div>
      </div>
    );
  }

  // Variant: AI Synthesis Mode
  if (variant === 'ai') {
    return (
      <div className={`p-6 flex flex-col items-center justify-center space-y-3.5 text-center ${className}`}>
        <div className="relative flex items-center justify-center w-14 h-14 perspective-800 preserve-3d">
          <div className="absolute inset-0 rounded-full border border-rose-500/40 cockpit-orbit-1" />
          <div className="absolute inset-1 rounded-full border border-blue-400/40 cockpit-orbit-2" />
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#D62839] to-indigo-500 flex items-center justify-center shadow-md shadow-rose-500/30 cockpit-core-3d">
            <Sparkles className="w-3.5 h-3.5 text-white animate-spin" style={{ animationDuration: '4s' }} />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#D62839] animate-ping" />
            <span>{text || 'Synthesizing live business telemetry...'}</span>
          </p>
          {subtitle && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">{subtitle}</p>
          )}
        </div>
      </div>
    );
  }

  // Variant: Compact Inline
  if (variant === 'inline') {
    return (
      <div className={`inline-flex items-center gap-2.5 ${className}`}>
        <div className="relative flex items-center justify-center w-5 h-5 perspective-800 preserve-3d">
          <div className="absolute inset-0 rounded-full border border-rose-500/50 cockpit-orbit-1" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#D62839] shadow-[0_0_6px_#D62839]" />
        </div>
        {text && <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{text}</span>}
      </div>
    );
  }

  // Variant: Module / Default
  return (
    <div className={`py-12 sm:py-16 flex flex-col items-center justify-center text-center space-y-4 ${className}`}>
      {render3DGyroscope()}
      <div className="space-y-1 max-w-sm px-4">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
          {text || 'Loading Operational Telemetry...'}
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {subtitle || 'Fetching synchronized records from encrypted multi-tenant storage'}
        </p>
      </div>
    </div>
  );
};


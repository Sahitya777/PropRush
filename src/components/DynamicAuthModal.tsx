import React, { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { DynamicSetupAuth } from './DynamicSetupAuth';
import { sounds } from '../utils/audio';

export const DynamicAuthModal: React.FC = () => {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const { isLight } = useTheme();

  useEffect(() => {
    const handleOpen = () => setIsConfigOpen(true);
    window.addEventListener('open_dynamic_config', handleOpen);
    return () => window.removeEventListener('open_dynamic_config', handleOpen);
  }, []);

  if (!isConfigOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          sounds.playClick();
          setIsConfigOpen(false);
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto"
    >
      <div
        className={`w-full max-w-md border rounded-3xl shadow-2xl relative overflow-hidden flex flex-col my-auto max-h-[92vh] ${
          isLight
            ? 'bg-white border-slate-200 text-slate-800'
            : 'bg-[#130f24] border-[#332958] text-white shadow-[0_10px_50px_rgba(0,0,0,0.85)]'
        }`}
      >
        <div className={`flex items-center justify-between px-5 pt-4 pb-3 border-b shrink-0 ${
          isLight ? 'border-slate-100 bg-slate-50/50' : 'border-slate-800/80 bg-[#161129]/60'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            <div>
              <span className={`font-heading font-black text-sm tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Dynamic Configuration
              </span>
              <span className="text-[10px] text-slate-400 block font-mono-code">Developer Environment Setup</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              setIsConfigOpen(false);
            }}
            className="w-8 h-8 rounded-full border flex items-center justify-center text-xs font-black cursor-pointer"
          >
            ✕
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto">
          <DynamicSetupAuth onClose={() => setIsConfigOpen(false)} />
        </div>
      </div>
    </div>
  );
};

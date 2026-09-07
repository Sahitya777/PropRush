import React, { useState } from 'react';
import { useDynamicConfig, DEFAULT_DEMO_ENVIRONMENT_ID } from '../context/DynamicIntegration';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { sounds } from '../utils/audio';

interface DynamicSetupAuthProps {
  onClose: () => void;
}

export const DynamicSetupAuth: React.FC<DynamicSetupAuthProps> = ({ onClose }) => {
  const { environmentId, setEnvironmentId, isDynamicConfigured } = useDynamicConfig();
  const { syncDynamicUser } = useUser();
  const { isLight } = useTheme();

  const [inputEnvId, setInputEnvId] = useState(environmentId && environmentId !== DEFAULT_DEMO_ENVIRONMENT_ID ? environmentId : '');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSaveEnvId = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputEnvId.trim();
    if (!trimmed) {
      setErrorMsg('Please enter your Dynamic Environment ID (UUID format from app.dynamic.xyz)');
      return;
    }
    if (trimmed.length < 16) {
      setErrorMsg('Environment ID looks too short. Verify it from app.dynamic.xyz -> Developers -> API / SDK');
      return;
    }

    setErrorMsg(null);
    setEnvironmentId(trimmed);
    setSaveSuccess(true);
    sounds.playCashRegister();
    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Informational Banner */}
      <div className={`p-4 rounded-2xl border space-y-2.5 ${
        isLight ? 'bg-indigo-50/80 border-indigo-200' : 'bg-[#15102a] border-[#382b6b]'
      }`}>
        <div className="flex items-center gap-2">
          <span className="text-xl">🌐</span>
          <div>
            <h4 className={`text-xs font-black uppercase tracking-wider ${
              isLight ? 'text-indigo-900' : 'text-indigo-300'
            }`}>
              Dynamic Web3 Configuration
            </h4>
            <span className="text-[11px] text-slate-400">
              Bring non-custodial crypto wallets & blockchain transactions to PropRush
            </span>
          </div>
        </div>

        <ol className={`text-xs space-y-2 list-decimal list-inside leading-relaxed ${
          isLight ? 'text-slate-700' : 'text-slate-300'
        }`}>
          <li>
            <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>Open Dynamic Dashboard:</span> Go to{' '}
            <a
              href="https://app.dynamic.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-500 dark:text-indigo-400 underline hover:text-indigo-600 font-bold inline-flex items-center gap-0.5"
            >
              app.dynamic.xyz ↗
            </a>
          </li>
          <li>
            <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>Find Environment ID:</span> In your Dynamic dashboard, navigate to{' '}
            <span className={`px-1.5 py-0.5 rounded font-mono-code text-[11px] ${
              isLight ? 'bg-slate-200 text-slate-800' : 'bg-slate-900 text-indigo-300'
            }`}>
              Developers &rarr; API / SDK
            </span>{' '}
            and copy your <strong className="text-purple-400">Environment ID</strong>.
          </li>
          <li>
            <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>Set Environment Variable:</span> Add to your project environment or <span className="font-mono-code text-[11px] text-emerald-400">.env.example</span>:
            <div className="mt-1.5 p-2 rounded-xl bg-slate-950 font-mono-code text-[11px] text-emerald-400 border border-slate-800 overflow-x-auto select-all">
              VITE_DYNAMIC_ENVIRONMENT_ID="your_dynamic_environment_id"
            </div>
          </li>
        </ol>
      </div>

      {/* Live In-App Setting Box */}
      <form onSubmit={handleSaveEnvId} className="flex flex-col gap-2">
        <label className={`text-xs font-bold block ${
          isLight ? 'text-slate-700' : 'text-slate-300'
        }`}>
          Activate or Test with Custom Dynamic Environment ID:
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. 2754a23a-f117-48f8-8b9f-074668b55694"
            value={inputEnvId}
            onChange={e => setInputEnvId(e.target.value)}
            className={`flex-1 px-3 py-2 rounded-xl text-xs font-mono-code border transition-all ${
              isLight 
                ? 'bg-white border-slate-300 focus:border-indigo-500 text-slate-900' 
                : 'bg-slate-900 border-slate-700 focus:border-indigo-500 text-white'
            }`}
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer active:scale-95 shrink-0"
          >
            Apply Key
          </button>
        </div>

        {errorMsg && (
          <p className="text-rose-400 text-xs mt-1 font-semibold">{errorMsg}</p>
        )}
        {saveSuccess && (
          <p className="text-emerald-400 text-xs mt-1 font-semibold">✓ Environment ID updated! Dynamic provider refreshed.</p>
        )}
      </form>
    </div>
  );
};

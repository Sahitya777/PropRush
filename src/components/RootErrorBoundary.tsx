import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class RootErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('RootErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetAndReload = () => {
    try {
      // Clear game session keys that might be corrupt
      const keysToClear = [
        'proprush_active_match',
        'proprush_user_profile',
        'proprush_active_rooms_registry_v1',
        'proprush_dynamic_env_id',
      ];
      keysToClear.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.error('Failed to clear storage:', e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0d0a1a] text-slate-100 flex items-center justify-center p-4 font-sans selection:bg-purple-500 selection:text-white">
          <div className="w-full max-w-lg rounded-3xl bg-[#16122b] border border-purple-500/30 p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center">
            {/* Icon */}
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl mb-5 shadow-inner">
              ⚡
            </div>

            {/* Title */}
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mb-2">
              PropRush Encountered a Glitch
            </h1>
            <p className="text-sm text-slate-300 max-w-sm mb-6 leading-relaxed">
              We detected a rendering interruption. You can quickly reload the game or clear cached session state to restore normal operation.
            </p>

            {/* Actions */}
            <div className="w-full flex flex-col sm:flex-row items-center gap-3 mb-6">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-purple-600/30 cursor-pointer transition-all active:scale-95"
              >
                Reload Game
              </button>
              <button
                type="button"
                onClick={this.handleResetAndReload}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10 font-bold text-sm cursor-pointer transition-all active:scale-95"
              >
                Reset Cache & Reload
              </button>
            </div>

            {/* Collapsible Error Details */}
            {this.state.error && (
              <details className="w-full text-left bg-black/40 rounded-xl border border-white/10 p-3 text-xs">
                <summary className="text-slate-400 font-semibold cursor-pointer hover:text-slate-200 transition-colors">
                  Diagnostic Information
                </summary>
                <div className="mt-2 text-rose-400 font-mono text-[11px] break-all whitespace-pre-wrap">
                  {this.state.error.toString()}
                </div>
                {this.state.errorInfo?.componentStack && (
                  <pre className="mt-2 text-slate-400 font-mono text-[10px] overflow-x-auto max-h-36 whitespace-pre-wrap leading-tight">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

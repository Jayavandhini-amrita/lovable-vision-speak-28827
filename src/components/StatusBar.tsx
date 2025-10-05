/**
 * Status Bar component
 * Shows system status indicators (model loaded, token status, etc.)
 */

import { CheckCircle2, Loader2, XCircle, Zap } from 'lucide-react';

interface StatusBarProps {
  modelLoaded: boolean;
  speechInitialized: boolean;
  cameraActive: boolean;
}

export const StatusBar = ({ modelLoaded, speechInitialized, cameraActive }: StatusBarProps) => {
  return (
    <div className="glass-panel px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Lovable AI Vision
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Camera Status */}
          <div
            className={`status-indicator ${
              cameraActive ? 'active' : 'loading'
            }`}
          >
            {cameraActive ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <Loader2 className="w-3 h-3 animate-spin" />
            )}
            <span>Camera</span>
          </div>

          {/* Model Status */}
          <div
            className={`status-indicator ${
              modelLoaded ? 'active' : 'loading'
            }`}
          >
            {modelLoaded ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <Loader2 className="w-3 h-3 animate-spin" />
            )}
            <span>AI Model</span>
          </div>

          {/* Speech Status */}
          <div
            className={`status-indicator ${
              speechInitialized ? 'active' : 'loading'
            }`}
          >
            {speechInitialized ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <Loader2 className="w-3 h-3 animate-spin" />
            )}
            <span>Voice</span>
          </div>
        </div>
      </div>
    </div>
  );
};

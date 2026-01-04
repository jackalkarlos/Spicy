import React, { useState, useEffect } from 'react';
import {
  Maximize,
  Minimize,
  X,
  Keyboard,
  MousePointer,
  RefreshCw,
  Wifi,
  WifiOff,
  Terminal as TerminalIcon,
  Layout,
  Monitor
} from 'lucide-react';
import { ConnectionConfig, Protocol, AuthType } from '../types';
import { Terminal } from './Terminal';
import { SpiceViewer } from './SpiceViewer';
import { ErrorBoundary } from './ErrorBoundary';

interface ConsoleViewProps {
  connection: ConnectionConfig;
  onClose: () => void;
}

export const ConsoleView: React.FC<ConsoleViewProps> = ({ connection, onClose }) => {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    // Basic connection simulation / handshake
    setStatus('connecting');
    const timer = setTimeout(() => {
      setStatus('connected');
    }, 800);
    return () => clearTimeout(timer);
  }, [connection.id]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const handleRdpLaunch = async () => {
    if (window.electronAPI) {
      await window.electronAPI.launchRdp(connection.host, connection.port);
    } else {
      alert("RDP Launch is only available in Desktop App mode.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-black text-gray-200 fixed inset-0 z-[100]">
      {/* Console Toolbar */}
      <div className="h-10 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 flex-shrink-0 z-50 relative">
        <div className="flex items-center gap-4">
          <span className="font-bold text-spicy-500 flex items-center gap-2">
            {status === 'connected' ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4 animate-pulse" />}
            {connection.name}
          </span>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded border border-gray-700 flex items-center gap-1">
            {connection.protocol === Protocol.SSH ? <TerminalIcon className="w-3 h-3" /> : <Layout className="w-3 h-3" />}
            {connection.protocol}
          </span>
          {connection.proxmoxVmid && (
            <span className="text-xs text-gray-500 font-mono">
              VM: {connection.proxmoxVmid}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {connection.protocol !== Protocol.SSH && (
            <>
              <button className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white" title="Send Ctrl+Alt+Del">
                <Keyboard className="w-4 h-4" />
              </button>
            </>
          )}
          <button className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white" onClick={() => setStatus('connecting')} title="Reconnect">
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-gray-700 mx-1"></div>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-red-900/50 hover:text-red-400 rounded text-gray-400 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      {/* REMOVED centering (flex items-center justify-center) to allow Terminal to stretch fully */}
      <div className="flex-1 relative overflow-hidden bg-black">

        {/* SSH VIEW */}
        {connection.protocol === Protocol.SSH && (
          <ErrorBoundary>
            <Terminal connection={connection} />
          </ErrorBoundary>
        )}

        {/* Debug Info */}
        {connection.protocol !== Protocol.SSH &&
          connection.protocol !== Protocol.SPICE &&
          connection.protocol !== Protocol.RDP && (
            <div className="text-white p-10">
              <h2 className="text-xl font-bold text-red-500">Unknown Protocol</h2>
              <pre>{JSON.stringify(connection, null, 2)}</pre>
              <p>Expected: {Protocol.SSH} ({typeof Protocol.SSH})</p>
              <p>Actual: {connection.protocol} ({typeof connection.protocol})</p>
            </div>
          )}

        {/* SPICE VIEW */}
        {connection.protocol === Protocol.SPICE && (
          <SpiceViewer connection={connection} />
        )}

        {/* RDP VIEW (LAUNCHER) */}
        {connection.protocol === Protocol.RDP && (
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-blue-600 rounded-xl flex items-center justify-center mb-6 shadow-xl shadow-blue-900/40">
              <Monitor className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Windows Remote Desktop</h2>
            <p className="text-gray-400 mb-8 max-w-sm">
              RDP sessions are launched using the native system client for best performance.
            </p>
            <button
              onClick={handleRdpLaunch}
              className="px-6 py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
            >
              Launch RDP Session
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
import React from 'react';
import { Protocol } from '../types';
import { Monitor, Terminal, Cpu, Cast } from 'lucide-react';

interface ProtocolBadgeProps {
  protocol: Protocol;
  size?: 'sm' | 'md';
}

export const ProtocolBadge: React.FC<ProtocolBadgeProps> = ({ protocol, size = 'md' }) => {
  const getStyle = () => {
    switch (protocol) {
      case Protocol.SPICE:
        return 'bg-spicy-100 text-spicy-800 border-spicy-200';
      case Protocol.RDP:
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case Protocol.SSH:
        return 'bg-slate-100 text-slate-800 border-slate-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getIcon = () => {
    switch (protocol) {
      case Protocol.SPICE: return <Monitor className="w-3 h-3 mr-1" />;
      case Protocol.RDP: return <Cast className="w-3 h-3 mr-1" />;
      case Protocol.SSH: return <Terminal className="w-3 h-3 mr-1" />;
    }
  };

  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-0.5';

  return (
    <span className={`inline-flex items-center rounded-full border font-semibold ${getStyle()} ${sizeClass}`}>
      {getIcon()}
      {protocol}
    </span>
  );
};

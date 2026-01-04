export enum Protocol {
  SPICE = 'SPICE',
  RDP = 'RDP',
  SSH = 'SSH'
}

export enum ConnectionStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  CONNECTING = 'CONNECTING',
  ERROR = 'ERROR'
}

export enum AuthType {
  NONE = 'NONE',
  PASSWORD = 'PASSWORD',
  PROXMOX_API = 'PROXMOX_API',
  KEY_FILE = 'KEY_FILE'
}

export interface ConnectionConfig {
  id: string;
  name: string;
  host: string;
  port?: number;
  protocol: Protocol;
  username?: string;
  password?: string;
  privateKey?: string; // Content of the SSH key file
  privateKeyName?: string; // Name of the file for UI display
  domain?: string; // For RDP
  tags: string[];

  // Proxmox Specific
  proxmoxNode?: string; // e.g. 'pve'
  proxmoxVmid?: number; // e.g. 100
  authType: AuthType;
}

export interface BandwidthData {
  time: string;
  mbps: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

declare global {
  interface Window {
    electronAPI: {
      launchRdp: (host: string, port?: number) => Promise<{ success: boolean }>;
      sshConnect: (config: ConnectionConfig) => Promise<{ success: boolean; error?: string }>;
      onSshData: (callback: (data: string) => void) => void;
      sendSshInput: (data: string) => void;
      sshResize: (cols: number, rows: number) => void;
      onBandwidthUpdate: (callback: (data: { rx: number, tx: number }) => void) => void;
      proxmoxApi: (config: {
        method: string;
        url: string;
        body?: any;
        headers?: any;
      }) => Promise<{ success: boolean; data?: any; error?: string; status?: number }>;
      launchSpiceVv: (content: string) => Promise<{ success: boolean }>;
      getHostCert: (host: string) => Promise<{ success: boolean; cert?: string; error?: string }>;
      saveConnections: (connections: ConnectionConfig[]) => Promise<{ success: boolean; error?: string }>;
      loadConnections: () => Promise<{ success: boolean; data?: ConnectionConfig[]; error?: string }>;
    };
  }
}
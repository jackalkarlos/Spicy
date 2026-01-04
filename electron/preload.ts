import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    launchRdp: (host: string, port?: number) => ipcRenderer.invoke('launch-rdp', { host, port }),

    // SSH
    sshConnect: (config: any) => ipcRenderer.invoke('ssh-connect', config),
    onSshData: (callback: (data: string) => void) => ipcRenderer.on('ssh-data', (_event, value) => callback(value)),
    sendSshInput: (data: string) => ipcRenderer.send('ssh-input', data),
    sshResize: (cols: number, rows: number) => ipcRenderer.send('ssh-resize', { cols, rows }),

    // Bandwidth
    onBandwidthUpdate: (callback: (data: { rx: number, tx: number }) => void) =>
        ipcRenderer.on('bandwidth-update', (_event, value) => callback(value)),

    // Proxmox
    proxmoxApi: (config: any) => ipcRenderer.invoke('proxmox-api', config),

    // Launcher
    launchSpiceVv: (content: string) => ipcRenderer.invoke('launch-spice-vv', content),

    // Helpers
    getHostCert: (host: string) => ipcRenderer.invoke('get-host-cert', host),

    // Persistence
    saveConnections: (connections: any[]) => ipcRenderer.invoke('save-connections', connections),
    loadConnections: () => ipcRenderer.invoke('load-connections')
});

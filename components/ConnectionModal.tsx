import React, { useState, useEffect } from 'react';
import { X, Save, Server, ShieldCheck, Database, Monitor, Search, CheckSquare, DownloadCloud, FileKey, Key, Trash2 } from 'lucide-react';
import { ConnectionConfig, Protocol, AuthType } from '../types';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (conn: ConnectionConfig | ConnectionConfig[]) => void;
  initialData?: ConnectionConfig | null;
}

// MOCK_PROXMOX_VMS removed

export const ConnectionModal = React.memo<ConnectionModalProps>(({ isOpen, onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState<Partial<ConnectionConfig>>({
    protocol: Protocol.SPICE,
    port: 8006,
    authType: AuthType.PROXMOX_API,
    tags: []
  });

  // State for Proxmox Import Feature
  const [importMode, setImportMode] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedVMs, setScannedVMs] = useState<{ vmid: number, name: string, status: string }[]>([]);
  const [selectedVMs, setSelectedVMs] = useState<number[]>([]);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      setImportMode(false);
    } else {
      setFormData({
        protocol: Protocol.SPICE,
        port: 8006,
        authType: AuthType.PROXMOX_API,
        tags: []
      });
      setImportMode(false);
    }
    setScannedVMs([]);
    setSelectedVMs([]);
  }, [initialData, isOpen]);

  // Reset certain fields when protocol changes
  const handleProtocolChange = (p: Protocol) => {
    const defaults: Partial<ConnectionConfig> = { protocol: p };
    if (p === Protocol.SPICE) {
      defaults.port = 8006;
      defaults.authType = AuthType.PROXMOX_API;
    } else if (p === Protocol.RDP) {
      defaults.port = 3389;
      defaults.authType = AuthType.PASSWORD;
    } else if (p === Protocol.SSH) {
      defaults.port = 22;
      defaults.authType = AuthType.PASSWORD;
    }
    setFormData(prev => ({ ...prev, ...defaults }));
  };

  const scanProxmoxNode = async () => {
    if (!formData.host || !formData.username || !formData.password) {
      alert("Please enter Host, Username, and Password/Token to scan.");
      return;
    }
    setIsScanning(true);
    setScannedVMs([]);

    try {
      const baseUrl = `https://${formData.host}:8006/api2/json`;

      // 1. Get Ticket
      const authRes = await window.electronAPI.proxmoxApi({
        method: 'POST',
        url: `${baseUrl}/access/ticket`,
        body: {
          username: formData.username,
          password: formData.password
        }
      });

      if (!authRes.success || !authRes.data?.data?.ticket) {
        throw new Error(authRes.error || 'Authentication failed');
      }

      const { ticket, CSRFPreventionToken } = authRes.data.data;
      const headers = {
        'CSRFPreventionToken': CSRFPreventionToken,
        'Cookie': `PVEAuthCookie=${ticket}`
      };

      // 2. Get Nodes
      const nodesRes = await window.electronAPI.proxmoxApi({
        method: 'GET',
        url: `${baseUrl}/nodes`,
        headers
      });

      if (!nodesRes.success) throw new Error('Failed to list nodes');

      const nodes = nodesRes.data.data;
      const allVMs: any[] = [];

      // 3. For each node, get Qemu VMs
      for (const node of nodes) {
        const vmsRes = await window.electronAPI.proxmoxApi({
          method: 'GET',
          url: `${baseUrl}/nodes/${node.node}/qemu`,
          headers
        });

        if (vmsRes.success && vmsRes.data?.data) {
          allVMs.push(...vmsRes.data.data.map((vm: any) => ({
            vmid: vm.vmid,
            name: vm.name,
            status: vm.status,
            node: node.node
          })));
        }
      }

      setScannedVMs(allVMs);

    } catch (err: any) {
      console.error("Scan error:", err);
      alert(`Scan failed: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const toggleVMSelection = (vmid: number) => {
    if (selectedVMs.includes(vmid)) {
      setSelectedVMs(selectedVMs.filter(id => id !== vmid));
    } else {
      setSelectedVMs([...selectedVMs, vmid]);
    }
  };

  const handleImport = () => {
    const newConnections: ConnectionConfig[] = selectedVMs.map(vmid => {
      const vm = scannedVMs.find(v => v.vmid === vmid);
      return {
        id: crypto.randomUUID(),
        name: vm ? `${vm.name} (${vmid})` : `VM ${vmid}`,
        host: formData.host || '',
        port: formData.port || 8006,
        protocol: Protocol.SPICE,
        authType: AuthType.PROXMOX_API,
        proxmoxNode: formData.proxmoxNode || 'pve',
        proxmoxVmid: vmid,
        username: formData.username,
        password: formData.password, // Reusing the API password
        tags: ['imported', 'proxmox']
      };
    });
    onSave(newConnections);
    onClose();
  };

  const handleKeyFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      setFormData(prev => ({
        ...prev,
        privateKey: ev.target?.result as string,
        privateKeyName: file.name
      }));
    };
    reader.readAsText(file);
  };

  const removeKey = () => {
    setFormData(prev => ({
      ...prev,
      privateKey: undefined,
      privateKeyName: undefined
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.host) return;

    onSave({
      id: formData.id || crypto.randomUUID(),
      name: formData.name,
      host: formData.host,
      port: formData.port || 0,
      protocol: formData.protocol || Protocol.SPICE,
      username: formData.username || '',
      password: formData.password,
      privateKey: formData.privateKey,
      privateKeyName: formData.privateKeyName,
      domain: formData.domain,
      tags: formData.tags || [],
      proxmoxNode: formData.proxmoxNode,
      proxmoxVmid: formData.proxmoxVmid,
      authType: formData.authType || AuthType.NONE,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
        <div className="bg-gray-900 text-white p-4 flex justify-between items-center flex-shrink-0">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Server className="w-5 h-5 text-spicy-500" />
            {importMode ? 'Import from Proxmox' : (initialData ? 'Edit Client' : 'New Client')}
          </h3>
          <button onClick={onClose} className="hover:text-spicy-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Protocol Switcher (If not importing) */}
        {!importMode && !initialData && (
          <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Protocol Type</label>
            <div className="flex gap-2">
              {Object.values(Protocol).map(p => (
                <button
                  key={p}
                  onClick={() => handleProtocolChange(p)}
                  className={`flex-1 py-2 text-sm font-medium rounded-md border transition-all ${formData.protocol === p
                    ? 'bg-white dark:bg-gray-700 border-spicy-500 text-spicy-600 dark:text-spicy-400 shadow-sm ring-1 ring-spicy-500'
                    : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">

          {/* PROXMOX IMPORT MODE UI */}
          {importMode ? (
            <div className="space-y-4">
              {/* ... (Previous import code remains same) ... */}
              <div className="p-4 bg-spicy-50 rounded-lg border border-spicy-100 text-sm text-spicy-800">
                Enter your Proxmox API details to fetch and import all available VMs.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">Host / Node IP</label>
                  <input className="w-full border dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={formData.host || ''} onChange={e => setFormData({ ...formData, host: e.target.value })} placeholder="192.168.1.10" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">User</label>
                  <input className="w-full border dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={formData.username || ''} onChange={e => setFormData({ ...formData, username: e.target.value })} placeholder="root@pam" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">Password</label>
                  <input type="password" className="w-full border dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={formData.password || ''} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                </div>
              </div>

              {scannedVMs.length === 0 ? (
                <button
                  onClick={scanProxmoxNode}
                  disabled={isScanning}
                  className="w-full py-3 bg-gray-800 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-gray-700"
                >
                  {isScanning ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Search className="w-4 h-4" />}
                  {isScanning ? 'Scanning...' : 'Scan Node'}
                </button>
              ) : (
                <div className="space-y-2 mt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-gray-700">Found {scannedVMs.length} VMs</h4>
                    <button onClick={() => setSelectedVMs(scannedVMs.map(v => v.vmid))} className="text-xs text-spicy-600 hover:underline">Select All</button>
                  </div>
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {scannedVMs.map(vm => (
                      <div key={vm.vmid} className="flex items-center p-3 hover:bg-gray-50 cursor-pointer" onClick={() => toggleVMSelection(vm.vmid)}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center mr-3 ${selectedVMs.includes(vm.vmid) ? 'bg-spicy-500 border-spicy-500' : 'border-gray-300'}`}>
                          {selectedVMs.includes(vm.vmid) && <CheckSquare className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{vm.name}</div>
                          <div className="text-xs text-gray-500">ID: {vm.vmid} • {vm.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleImport}
                    disabled={selectedVMs.length === 0}
                    className="w-full py-3 bg-spicy-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-spicy-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <DownloadCloud className="w-4 h-4" />
                    Import {selectedVMs.length} Clients
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* STANDARD MANUAL ENTRY FORM */
            <form id="connectionForm" onSubmit={handleSubmit} className="space-y-4">

              {/* Common Top Fields */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Friendly Name</label>
                <input
                  required
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-spicy-500 outline-none"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder={formData.protocol === Protocol.RDP ? "Windows Server" : "My Workstation"}
                />
              </div>

              {/* Protocol Specific Fields */}

              {/* --- RDP CONFIG --- */}
              {formData.protocol === Protocol.RDP && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Hostname / IP</label>
                      <input required className="w-full border border-gray-300 dark:border-gray-600 rounded p-2 text-sm font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={formData.host || ''} onChange={e => setFormData({ ...formData, host: e.target.value })} placeholder="192.168.1.55" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Port</label>
                      <input type="number" className="w-full border border-gray-300 dark:border-gray-600 rounded p-2 text-sm font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={formData.port || ''} onChange={e => setFormData({ ...formData, port: parseInt(e.target.value) })} />
                    </div>
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 space-y-3">
                    <h4 className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase flex items-center gap-2"><Monitor className="w-3 h-3" /> Windows Credentials</h4>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Domain (Optional)</label>
                      <input className="w-full border border-blue-200 dark:border-blue-700 rounded p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={formData.domain || ''} onChange={e => setFormData({ ...formData, domain: e.target.value })} placeholder="WORKGROUP" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Username</label>
                        <input className="w-full border border-blue-200 dark:border-blue-700 rounded p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={formData.username || ''} onChange={e => setFormData({ ...formData, username: e.target.value })} placeholder="Administrator" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Password</label>
                        <input type="password" className="w-full border border-blue-200 dark:border-blue-700 rounded p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={formData.password || ''} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* --- SSH CONFIG --- */}
              {formData.protocol === Protocol.SSH && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Hostname / IP</label>
                      <input required className="w-full border border-gray-300 dark:border-gray-600 rounded p-2 text-sm font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={formData.host || ''} onChange={e => setFormData({ ...formData, host: e.target.value })} placeholder="192.168.1.20" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Port</label>
                      <input type="number" className="w-full border border-gray-300 dark:border-gray-600 rounded p-2 text-sm font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={formData.port || ''} onChange={e => setFormData({ ...formData, port: parseInt(e.target.value) })} />
                    </div>
                  </div>

                  {/* SSH Auth Method Selection */}
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-gray-700 uppercase">Authentication Method</h4>
                      <div className="flex bg-white rounded p-0.5 border border-gray-200">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, authType: AuthType.PASSWORD })}
                          className={`px-3 py-1 text-xs rounded transition-colors ${formData.authType === AuthType.PASSWORD || !formData.authType ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                          Password
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, authType: AuthType.KEY_FILE })}
                          className={`px-3 py-1 text-xs rounded transition-colors ${formData.authType === AuthType.KEY_FILE ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                          Key File
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Username</label>
                      <input className="w-full border border-gray-300 dark:border-gray-600 rounded p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={formData.username || ''} onChange={e => setFormData({ ...formData, username: e.target.value })} placeholder="root" />
                    </div>

                    {formData.authType === AuthType.KEY_FILE ? (
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-gray-500 uppercase">Private Key</label>
                        {formData.privateKey ? (
                          <div className="flex items-center justify-between bg-white border border-green-200 rounded p-2">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <FileKey className="w-4 h-4 text-green-600 flex-shrink-0" />
                              <span className="text-sm text-green-700 truncate">{formData.privateKeyName || 'Loaded Key'}</span>
                            </div>
                            <button type="button" onClick={removeKey} className="text-red-500 hover:bg-red-50 p-1 rounded">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 hover:bg-gray-50 transition-colors text-center group">
                            <input
                              type="file"
                              onChange={handleKeyFileUpload}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <Key className="w-8 h-8 text-gray-400 mx-auto mb-2 group-hover:text-spicy-500" />
                            <p className="text-sm text-gray-500 font-medium">Click to upload private key file</p>
                            <p className="text-xs text-gray-400 mt-1">.pem, .ppk, id_rsa</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Password</label>
                        <input type="password" className="w-full border border-gray-300 dark:border-gray-600 rounded p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={formData.password || ''} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                      </div>
                    )}
                  </div>
                </div>
              )}



              {/* --- SPICE / PROXMOX CONFIG --- */}
              {formData.protocol === Protocol.SPICE && (
                <div className="space-y-4">

                  {/* Option to Switch to Import Mode */}
                  {!initialData && (
                    <div className="bg-spicy-50 p-3 rounded-lg border border-spicy-100 flex justify-between items-center">
                      <span className="text-xs text-spicy-800 font-medium">Want to import VMs automatically?</span>
                      <button type="button" onClick={() => setImportMode(true)} className="text-xs bg-spicy-600 text-white px-2 py-1 rounded hover:bg-spicy-700">
                        Switch to Import
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Proxmox Host / IP</label>
                      <input required className="w-full border border-gray-300 dark:border-gray-600 rounded p-2 text-sm font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={formData.host || ''} onChange={e => setFormData({ ...formData, host: e.target.value })} placeholder="192.168.1.10" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Port</label>
                      <input type="number" className="w-full border border-gray-300 dark:border-gray-600 rounded p-2 text-sm font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={formData.port || ''} onChange={e => setFormData({ ...formData, port: parseInt(e.target.value) })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900 p-3 rounded border border-gray-200 dark:border-gray-700">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Node Name</label>
                      <input className="w-full border border-gray-300 dark:border-gray-600 rounded p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={formData.proxmoxNode || ''} onChange={e => setFormData({ ...formData, proxmoxNode: e.target.value })} placeholder="pve" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">VM ID</label>
                      <input type="number" className="w-full border border-gray-300 dark:border-gray-600 rounded p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={formData.proxmoxVmid || ''} onChange={e => setFormData({ ...formData, proxmoxVmid: parseInt(e.target.value) })} placeholder="100" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Auth Type</label>
                      <select
                        className="w-full border border-gray-300 dark:border-gray-600 rounded p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        value={formData.authType}
                        onChange={e => setFormData({ ...formData, authType: e.target.value as AuthType })}
                      >
                        <option value={AuthType.PROXMOX_API}>Proxmox API (User/Token)</option>
                        <option value={AuthType.NONE}>None (Direct .vv)</option>
                      </select>
                    </div>
                  </div>

                  {formData.authType === AuthType.PROXMOX_API && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Username</label>
                        <input className="w-full border border-gray-300 dark:border-gray-600 rounded p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={formData.username || ''} onChange={e => setFormData({ ...formData, username: e.target.value })} placeholder="root@pam" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Password / Token</label>
                        <input type="password" className="w-full border border-gray-300 dark:border-gray-600 rounded p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={formData.password || ''} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                      </div>
                    </div>
                  )}
                </div>
              )}

            </form>
          )}

        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 dark:bg-gray-900 p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          {!importMode && (
            <button
              type="submit"
              form="connectionForm"
              className="px-6 py-2 bg-spicy-600 text-white rounded-lg hover:bg-spicy-700 shadow-md hover:shadow-lg transition-all flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
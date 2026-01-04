import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Settings,
  Trash2,
  Edit,
  Play,
  Monitor,
  Server,
  LogOut,
  ArrowLeft
} from 'lucide-react';
import { ConnectionConfig, Protocol, BandwidthData, AuthType } from './types';
import { ProtocolBadge } from './components/ProtocolBadge';
import { NetworkChart } from './components/NetworkChart';
import { ConnectionModal } from './components/ConnectionModal';
import { ConsoleView } from './components/ConsoleView';
import { SettingsView } from './components/SettingsView';

// Mock Data
// Mock Data removed
const MOCK_CHART_DATA: BandwidthData[] = Array.from({ length: 20 }, (_, i) => ({
  time: `10:${i < 10 ? '0' + i : i}`,
  mbps: Math.floor(Math.random() * 50) + 10
}));


type ViewType = 'dashboard' | 'settings';

export default function App() {
  const [connections, setConnections] = useState<ConnectionConfig[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConn, setEditingConn] = useState<ConnectionConfig | null>(null);

  // Real Bandwidth Data
  const [bandwidthData, setBandwidthData] = useState<BandwidthData[]>([]);

  // State to track if we are in "Dashboard" mode or "Console" mode
  const [activeSession, setActiveSession] = useState<ConnectionConfig | null>(null);

  // Derived state
  const filteredConnections = useMemo(() => {
    return connections.filter(c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.host.includes(searchQuery) ||
      c.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [connections, searchQuery]);

  // Real Bandwidth Listener
  React.useEffect(() => {
    // Initial empty data
    setBandwidthData(Array.from({ length: 30 }, (_, i) => ({
      time: '',
      mbps: 0
    })));

    const removeListener = window.electronAPI?.onBandwidthUpdate((data) => {
      setBandwidthData(prev => {
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        const totalMbps = data.rx + data.tx; // Show total traffic

        const newData = [...prev.slice(1), { time: timeStr, mbps: totalMbps }];
        return newData;
      });
    });

    return () => {
      // Cleanup if possible (though onBandwidthUpdate returns void currently)
    };
  }, []);

  // Handlers
  const handleSaveConnection = React.useCallback((result: ConnectionConfig | ConnectionConfig[]) => {
    if (Array.isArray(result)) {
      // Handle bulk import with deduplication
      setConnections(prev => {
        const newItems = result.filter(newItem => {
          // Check if item already exists based on Host + VMID (for Proxmox) or Host + Port (for others)
          const exists = prev.some(existing => {
            if (newItem.authType === AuthType.PROXMOX_API && existing.authType === AuthType.PROXMOX_API) {
              return newItem.host === existing.host && newItem.proxmoxVmid === existing.proxmoxVmid;
            }
            return newItem.host === existing.host && newItem.port === existing.port;
          });
          return !exists;
        });

        if (newItems.length < result.length) {
          console.log(`Skipped ${result.length - newItems.length} duplicates.`);
        }
        return [...prev, ...newItems];
      });
    } else {
      // Handle single save/edit
      // We need to use functional update to ensure we don't depend on stale 'connections' or 'editingConn' ref if possible.
      // However, editingConn is in state. Let's rely on setConnections callback pattern where possible.
      // But we need 'editingConn' to know if it's an edit.
      // For useCallback to be effective, 'editingConn' needs to be in dependency array.
      // This means modal will re-render if 'editingConn' changes (which is fine, it means we opened/closed it).
      // But we want to avoid re-rendering on 'bandwidthData' or 'statusMap' changes.

      setConnections(prev => {
        // find if we are editing. We can't use 'editingConn' from closure if we want stability.
        // Strategy: Pass the ID to check? Or just trust 'editingConn' via dependency.
        // Better: If the Saved Result has an ID that exists, its an update.
        const existingIndex = prev.findIndex(c => c.id === result.id);
        if (existingIndex >= 0) {
          const newArr = [...prev];
          newArr[existingIndex] = result;
          return newArr;
        } else {
          return [...prev, result];
        }
      });
    }
    setEditingConn(null);
  }, []); // Dependencies: empty means stable reference! logic logic above uses functional updates to avoid 'connections' dep

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this connection?')) {
      setConnections(connections.filter(c => c.id !== id));
      if (activeSession?.id === id) setActiveSession(null);
    }
  };

  const handleEdit = (conn: ConnectionConfig) => {
    setEditingConn(conn);
    setIsModalOpen(true);
  };

  const handleConnect = (conn: ConnectionConfig) => {
    setActiveSession(conn);
  };

  const [statusMap, setStatusMap] = useState<Record<string, { status: string, cpu?: number, mem?: number }>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // 1. Load Connections on Mount
  React.useEffect(() => {
    const load = async () => {
      try {
        if (window.electronAPI?.loadConnections) {
          const res = await window.electronAPI.loadConnections();
          if (res.success && res.data) {
            setConnections(res.data);
          }
        } else {
          console.warn("Electron API not found, skipping load.");
        }
      } catch (e) {
        console.error("Failed to load connections:", e);
      } finally {
        setIsLoaded(true);
      }
    };
    load();
  }, []);

  // 2. Auto-Save (only after initial load)
  React.useEffect(() => {
    if (isLoaded && window.electronAPI?.saveConnections) {
      window.electronAPI.saveConnections(connections);
    }
  }, [connections, isLoaded]);

  // 3. Polling for Status
  React.useEffect(() => {
    if (connections.length === 0) return;

    const poll = async () => {
      // Group by distinct Proxmox hosts to avoid duplicated auth/calls
      const proxmoxHosts = Array.from(new Set(
        connections
          .filter(c => c.authType === AuthType.PROXMOX_API && c.proxmoxNode)
          .map(c => c.host)
      ));

      for (const host of proxmoxHosts) {
        // Find credentials for this host (take first match)
        const creds = connections.find(c => c.host === host && c.authType === AuthType.PROXMOX_API);
        if (!creds || !creds.username || !creds.password) continue;

        try {
          const baseUrl = `https://${host}:8006/api2/json`;

          // A. Auth (ideally we cache the ticket, but for now re-auth is safer for stateless polling)
          // Optimization: Store ticket in a Ref if this becomes too heavy.
          const authRes = await window.electronAPI.proxmoxApi({
            method: 'POST', url: `${baseUrl}/access/ticket`,
            body: { username: creds.username, password: creds.password }
          });

          if (!authRes.success || !authRes.data?.data?.ticket) continue;

          const { ticket, CSRFPreventionToken } = authRes.data.data;
          const headers = { 'CSRFPreventionToken': CSRFPreventionToken, 'Cookie': `PVEAuthCookie=${ticket}` };

          // B. Fetch VM List for Node (We need to know the node... assume 'pve' or iterate known nodes from config)
          // We can iterate the nodes defined in our connections for this host
          const nodes = Array.from(new Set(connections.filter(c => c.host === host).map(c => c.proxmoxNode || 'pve')));

          for (const node of nodes) {
            const listRes = await window.electronAPI.proxmoxApi({
              method: 'GET', url: `${baseUrl}/nodes/${node}/qemu?full=1`, headers
            });

            if (listRes.success && listRes.data?.data) {
              const updates: Record<string, any> = {};
              listRes.data.data.forEach((vm: any) => {
                // Map VMID to status
                // vm structure: { vmid: 100, status: 'running', name: '...', cpus: 1, mem: ... }
                // We need to map this back to our connection IDs.
                // Since multiple connections might point to same VM (unlikely but possible),
                // we update by "Host+VMID" key conceptually, but here we just update a map keyed by ConnectionID?
                // Actually, generic map by "host-vmid" is better.
                updates[`${host}-${vm.vmid}`] = {
                  status: vm.status,
                  cpu: vm.cpu, // cpu usage (0-1)
                  mem: vm.mem,  // mem usage bytes
                  maxmem: vm.maxmem
                };
              });

              // Now update React state with this batch
              setStatusMap(prev => {
                const next = { ...prev };
                // We need to map our connections to these keys
                connections.filter(c => c.host === host && c.proxmoxNode === node).forEach(c => {
                  if (updates[`${host}-${c.proxmoxVmid}`]) {
                    next[c.id] = updates[`${host}-${c.proxmoxVmid}`];
                  }
                });
                return next;
              });
            }
          }

        } catch (e) {
          console.error("Polling error for", host, e);
        }
      }
    };

    const interval = setInterval(poll, 10000); // Poll every 10s
    poll(); // Run immediately

    return () => clearInterval(interval);
  }, [connections]);

  const handlePowerAction = async (conn: ConnectionConfig, action: 'start' | 'stop' | 'reset' | 'shutdown') => {
    if (!conn.proxmoxVmid || conn.authType !== AuthType.PROXMOX_API) return;
    if (!confirm(`Are you sure you want to ${action.toUpperCase()} ${conn.name}?`)) return;

    try {
      // Re-auth needed logic (dup from poll, should refactor to helper)
      // For expediency, repeating simplistic auth flow:
      const baseUrl = `https://${conn.host}:8006/api2/json`;
      const authRes = await window.electronAPI.proxmoxApi({
        method: 'POST', url: `${baseUrl}/access/ticket`,
        body: { username: conn.username, password: conn.password }
      });
      if (!authRes.success) throw new Error("Auth failed");

      const { ticket, CSRFPreventionToken } = authRes.data.data;
      const headers = { 'CSRFPreventionToken': CSRFPreventionToken, 'Cookie': `PVEAuthCookie=${ticket}` };

      const res = await window.electronAPI.proxmoxApi({
        method: 'POST',
        url: `${baseUrl}/nodes/${conn.proxmoxNode}/qemu/${conn.proxmoxVmid}/status/${action}`,
        headers
      });

      if (res.success) {
        alert(`Command ${action} sent successfully.`);
      } else {
        alert(`Failed: ${res.error}`);
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const closeSession = () => {
    setActiveSession(null);
  };

  /* 
     REMOVED EARLY RETURN to prevent 'Rendered fewer hooks' error
     if (activeSession) { ... } 
  */

  const handleCloseModal = React.useCallback(() => {
    setIsModalOpen(false);
    setEditingConn(null);
  }, []);

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 transition-colors duration-300">

      {/* Console Overlay - Rendered conditionally but within the main tree */}
      {activeSession ? (
        <ConsoleView connection={activeSession} onClose={closeSession} />
      ) : (
        <>
          {/* Sidebar - Client List */}
          <aside className="w-64 bg-gray-900 text-gray-300 flex-shrink-0 hidden md:flex flex-col border-r border-gray-800">
            {/* ... Sidebar Content ... */}
            <div className="p-6 flex items-center gap-3 text-white border-b border-gray-800">
              <div className="w-8 h-8 bg-gradient-to-br from-spicy-500 to-spicy-700 rounded-lg flex items-center justify-center shadow-lg shadow-spicy-900/50">
                <Monitor className="text-white w-5 h-5" />
              </div>
              <span className="text-xl font-bold tracking-tight">Spicy</span>
            </div>

            <div className="p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">
                Clients
              </h3>
              <div className="space-y-1 overflow-y-auto max-h-[60vh]">
                {connections.map(conn => (
                  <button
                    key={conn.id}
                    onClick={() => handleConnect(conn)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-gray-800 transition-colors group text-left"
                  >
                    <div className={`w-2 h-2 rounded-full ${conn.protocol === Protocol.SPICE ? 'bg-spicy-500' :
                      conn.protocol === Protocol.RDP ? 'bg-blue-500' :
                        conn.protocol === Protocol.SSH ? 'bg-slate-500' : 'bg-green-500'
                      }`} />
                    <span className="truncate flex-1">{conn.name}</span>
                    <Play className="w-3 h-3 opacity-0 group-hover:opacity-100 text-gray-400" />
                  </button>
                ))}
                {connections.length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-600 italic">No clients added</div>
                )}
              </div>
            </div>

            <div className="mt-auto p-4 border-t border-gray-800">
              <nav className="space-y-1">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className={`flex items-center gap-3 w-full px-4 py-2 rounded-lg transition-colors ${currentView === 'dashboard' ? 'text-white bg-gray-800' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span className="text-sm">Dashboard</span>
                </button>
                <button
                  onClick={() => setCurrentView('settings')}
                  className={`flex items-center gap-3 w-full px-4 py-2 rounded-lg transition-colors ${currentView === 'settings' ? 'text-white bg-gray-800' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                >
                  <Settings className="w-4 h-4" />
                  <span className="text-sm">Settings</span>
                </button>
              </nav>

              <div className="mt-8 pt-4 border-t border-gray-800 text-center">
                <p className="text-xs text-gray-500 font-mono">vibecoded with Gemini</p>
                <p className="text-xs text-spicy-500 font-bold">- karlos</p>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 flex flex-col h-screen overflow-hidden">

            {/* Top Header */}
            <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between shadow-sm z-10">
              <div className="flex items-center gap-4 flex-1">
                {currentView === 'settings' ? (
                  <button
                    onClick={() => setCurrentView('dashboard')}
                    className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    Back to Dashboard
                  </button>
                ) : (
                  <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search clients..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-spicy-500 focus:border-transparent outline-none transition-all placeholder-gray-400"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-spicy-600 hover:bg-spicy-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-spicy-500/20 transition-all active:scale-95"
                >
                  <Plus className="w-5 h-5" />
                  <span className="hidden sm:inline">Add Client</span>
                </button>
              </div>
            </header>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 scroll-smooth">

              {currentView === 'settings' ? (
                <SettingsView connections={connections} setConnections={setConnections} />
              ) : (
                <>
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">System Overview</h2>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2">
                        <NetworkChart data={bandwidthData} />
                      </div>
                      <div className="bg-gray-900 dark:bg-gray-800 rounded-lg p-6 text-white shadow-lg flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-spicy-500/20 rounded-full blur-2xl -mr-10 -mt-10"></div>
                        <div>
                          <h3 className="text-lg font-semibold mb-1 text-gray-400">Total Clients</h3>
                          <p className="text-4xl font-bold">{connections.length}</p>
                        </div>
                        <div className="mt-4 space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2"><Server className="w-4 h-4 text-spicy-500" /> SPICE / Proxmox</span>
                            <span className="font-bold">{connections.filter(c => c.protocol === Protocol.SPICE).length}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2"><Monitor className="w-4 h-4 text-blue-500" /> RDP / Windows</span>
                            <span className="font-bold">{connections.filter(c => c.protocol === Protocol.RDP).length}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">All Clients</h2>
                    <div className="flex bg-white dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700 shadow-sm">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                      >
                        <LayoutGrid className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                      >
                        <List className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {filteredConnections.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                      <div className="bg-gray-50 dark:bg-gray-700 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Search className="w-8 h-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">No clients found</h3>
                      <p className="text-gray-500 dark:text-gray-400">Add a new Proxmox or standard client to get started.</p>
                    </div>
                  ) : viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredConnections.map(conn => (
                        <div key={conn.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
                          <div className={`h-1.5 w-full ${conn.protocol === Protocol.SPICE ? 'bg-spicy-500' :
                            conn.protocol === Protocol.RDP ? 'bg-blue-500' :
                              conn.protocol === Protocol.SSH ? 'bg-slate-700' : 'bg-green-500'
                            }`}></div>
                          <div className="p-5">
                            <div className="flex justify-between items-start mb-3">
                              <ProtocolBadge protocol={conn.protocol} />
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(conn)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400">
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(conn.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-red-500">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            <h3 className="font-bold text-gray-900 dark:text-white text-lg truncate mb-1 flex items-center gap-2">
                              {statusMap[conn.id] && (
                                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusMap[conn.id].status === 'running' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-500'}`} title={statusMap[conn.id].status} />
                              )}
                              <span className="truncate" title={conn.name}>{conn.name}</span>
                            </h3>
                            <div className="flex flex-col text-sm text-gray-500 dark:text-gray-400 mb-4 font-mono bg-gray-50 dark:bg-gray-700/50 px-2 py-2 rounded relative group/info">
                              <div className="flex justify-between">
                                <span>{conn.host}:{conn.port}</span>
                                {/* Power Controls (hover only) */}
                                {conn.authType === AuthType.PROXMOX_API && (
                                  <div className="hidden group-hover/info:flex gap-1 absolute right-2 top-2 bg-gray-800 rounded p-1 shadow-lg">
                                    <button onClick={(e) => { e.stopPropagation(); handlePowerAction(conn, 'start'); }} className="p-1 hover:text-green-400 text-gray-400" title="Start"><Play className="w-3 h-3" /></button>
                                    <button onClick={(e) => { e.stopPropagation(); handlePowerAction(conn, 'shutdown'); }} className="p-1 hover:text-yellow-400 text-gray-400" title="Shutdown"><LogOut className="w-3 h-3" /></button>
                                    <button onClick={(e) => { e.stopPropagation(); handlePowerAction(conn, 'stop'); }} className="p-1 hover:text-red-500 text-gray-400" title="Force Stop"><Server className="w-3 h-3" /></button>
                                  </div>
                                )}
                              </div>
                              {conn.authType === AuthType.PROXMOX_API && (
                                <div className="flex justify-between items-end mt-1">
                                  <span className="text-xs text-spicy-600 dark:text-spicy-400">
                                    Node: {conn.proxmoxNode} | VM: {conn.proxmoxVmid}
                                  </span>
                                  {statusMap[conn.id]?.status === 'running' && statusMap[conn.id].cpu !== undefined && (
                                    <span className="text-[10px] text-gray-400">
                                      CPU: {(statusMap[conn.id].cpu! * 100).toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex gap-2 flex-wrap mb-4">
                              {conn.tags.map(tag => (
                                <span key={tag} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-600">
                                  #{tag}
                                </span>
                              ))}
                            </div>

                            <button
                              onClick={() => handleConnect(conn)}
                              className="w-full py-2.5 bg-gray-900 dark:bg-black text-white rounded-lg flex items-center justify-center gap-2 hover:bg-gray-800 dark:hover:bg-gray-800 transition-colors"
                            >
                              <Play className="w-4 h-4" />
                              Connect
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                          <tr>
                            <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Protocol</th>
                            <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                            <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Details</th>
                            <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tags</th>
                            <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {filteredConnections.map(conn => (
                            <tr key={conn.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                              <td className="px-6 py-4">
                                <ProtocolBadge protocol={conn.protocol} size="sm" />
                              </td>
                              <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{conn.name}</td>
                              <td className="px-6 py-4 text-gray-500 dark:text-gray-400 font-mono text-sm">
                                {conn.host}
                                {conn.proxmoxVmid && <span className="text-xs ml-1 bg-gray-200 dark:bg-gray-700 px-1 rounded text-gray-600 dark:text-gray-300">VM {conn.proxmoxVmid}</span>}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex gap-1 flex-wrap">
                                  {conn.tags.map(tag => (
                                    <span key={tag} className="text-xs text-gray-500 dark:text-gray-400">#{tag}</span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right space-x-2">
                                <button onClick={() => handleConnect(conn)} className="text-spicy-600 dark:text-spicy-400 hover:text-spicy-700 font-medium text-sm">
                                  Connect
                                </button>
                                <button onClick={() => handleEdit(conn)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                  <Edit className="w-4 h-4 inline" />
                                </button>
                                <button onClick={() => handleDelete(conn.id)} className="text-gray-400 hover:text-red-500">
                                  <Trash2 className="w-4 h-4 inline" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </main>

          <ConnectionModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            onSave={handleSaveConnection}
            initialData={editingConn}
          />
        </>
      )
      }
    </div >
  );
}
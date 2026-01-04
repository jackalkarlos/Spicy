import React, { useState, useEffect } from 'react';
import { 
  Moon, 
  Sun, 
  Download, 
  Upload, 
  Trash2, 
  Shield, 
  Database, 
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { ConnectionConfig } from '../types';

interface SettingsViewProps {
  connections: ConnectionConfig[];
  setConnections: (conns: ConnectionConfig[]) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ connections, setConnections }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (document.documentElement.classList.contains('dark')) {
      setIsDarkMode(true);
    }
  }, []);

  const toggleDarkMode = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(connections, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spicy_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported)) {
          // Simple validation check
          if (imported.length > 0 && !imported[0].id) throw new Error("Invalid format");
          
          if (confirm(`Replace current list with ${imported.length} connections?`)) {
            setConnections(imported);
            setImportStatus('success');
            setTimeout(() => setImportStatus('idle'), 3000);
          }
        } else {
          throw new Error("Not an array");
        }
      } catch (err) {
        setImportStatus('error');
        setTimeout(() => setImportStatus('idle'), 3000);
        alert("Failed to import: Invalid JSON file format.");
      }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  };

  const handleClearData = () => {
    if (confirm("Are you sure? This will remove ALL your saved connections locally. This cannot be undone.")) {
      setConnections([]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-10">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Settings</h2>
          <p className="text-gray-500 dark:text-gray-400">Manage application preferences and data</p>
        </div>
      </div>

      {/* Appearance Section */}
      <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold flex items-center gap-2 dark:text-white">
            <Sun className="w-5 h-5 text-spicy-500" />
            Appearance
          </h3>
        </div>
        <div className="p-6 flex items-center justify-between">
          <div>
            <div className="font-medium text-gray-900 dark:text-gray-100">Theme Mode</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Switch between light and dark interface</div>
          </div>
          <button 
            onClick={toggleDarkMode}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-spicy-500 focus:ring-offset-2 ${isDarkMode ? 'bg-spicy-600' : 'bg-gray-200'}`}
          >
            <span className={`${isDarkMode ? 'translate-x-7' : 'translate-x-1'} inline-block h-6 w-6 transform rounded-full bg-white transition-transform flex items-center justify-center`}>
              {isDarkMode ? <Moon className="w-3 h-3 text-spicy-600" /> : <Sun className="w-3 h-3 text-orange-400" />}
            </span>
          </button>
        </div>
      </section>

      {/* Data Management Section */}
      <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold flex items-center gap-2 dark:text-white">
            <Database className="w-5 h-5 text-blue-500" />
            Data Management
          </h3>
        </div>
        
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {/* Export */}
          <div className="p-6 flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">Backup Configuration</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Export all saved connections to a JSON file</div>
            </div>
            <button 
              onClick={handleExport}
              className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export JSON
            </button>
          </div>

          {/* Import */}
          <div className="p-6 flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">Restore Configuration</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Import connections from a JSON file</div>
              {importStatus === 'success' && <span className="text-green-600 text-xs font-bold mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Import Successful</span>}
              {importStatus === 'error' && <span className="text-red-600 text-xs font-bold mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Import Failed</span>}
            </div>
            <label className="cursor-pointer px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 transition-colors">
              <Upload className="w-4 h-4" />
              Import JSON
              <input type="file" accept=".json" className="hidden" onChange={handleImport} />
            </label>
          </div>

          {/* Clear Data */}
          <div className="p-6 flex items-center justify-between bg-red-50/50 dark:bg-red-900/10">
            <div>
              <div className="font-medium text-red-700 dark:text-red-400">Clear All Data</div>
              <div className="text-sm text-red-600/70 dark:text-red-400/70">Permanently delete all local connections</div>
            </div>
            <button 
              onClick={handleClearData}
              className="px-4 py-2 bg-white dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/40 flex items-center gap-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear Everything
            </button>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold flex items-center gap-2 dark:text-white">
            <Shield className="w-5 h-5 text-green-500" />
            About Spicy
          </h3>
        </div>
        <div className="p-6 text-sm text-gray-600 dark:text-gray-400 space-y-2">
           <p><strong className="text-gray-900 dark:text-white">Version:</strong> 1.2.0 (Stable)</p>
           <p><strong className="text-gray-900 dark:text-white">Build:</strong> 2024.10.27-rc</p>
           <p className="pt-2 border-t border-gray-100 dark:border-gray-700 mt-2">
             Spicy is a specialized connection manager designed for seamless Proxmox (SPICE) integration, alongside standard protocols like RDP and SSH.
           </p>
        </div>
      </section>
    </div>
  );
};
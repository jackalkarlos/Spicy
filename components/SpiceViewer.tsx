import React, { useEffect, useRef, useState } from 'react';
import { ConnectionConfig } from '../types';
import { generateVvFileContent } from '../util/proxmox';

// Mock SpiceMainConn since the package could not be installed in this environment
class SpiceMainConn {
    constructor(config: any) { console.log("SpyceMainConn init", config); }
}

interface SpiceViewerProps {
    connection: ConnectionConfig;
}

export const SpiceViewer: React.FC<SpiceViewerProps> = ({ connection }) => {
    const [debugInfo, setDebugInfo] = useState<string>('Initializing SPICE...');
    const [error, setError] = useState<string | null>(null);
    const [vvConfig, setVvConfig] = useState<string | null>(null);

    useEffect(() => {
        if (!connection.proxmoxVmid) {
            setError("Missing Proxmox VMID for SPICE connection");
            return;
        }

        const connect = async () => {
            try {
                setDebugInfo("Authenticating with Proxmox...");

                // 1. Authenticate (Get Ticket/CSRF) if needed, or assume we have credentials to do so
                // In a perfect world we'd reuse the session, but here we might need to re-auth or rely on saved creds
                // The connection object has username/password.
                if (!connection.username || !connection.password) {
                    throw new Error("Missing credentials for SPICE connection");
                }

                const baseUrl = `https://${connection.host}:8006/api2/json`;

                // A. Login
                const authRes = await window.electronAPI!.proxmoxApi({
                    method: 'POST',
                    url: `${baseUrl}/access/ticket`,
                    body: {
                        username: connection.username,
                        password: connection.password
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

                // B. Get SPICE Proxy Ticket
                setDebugInfo("Requesting SPICE Proxy Ticket...");
                const spiceRes = await window.electronAPI!.proxmoxApi({
                    method: 'POST',
                    url: `${baseUrl}/nodes/${connection.proxmoxNode}/qemu/${connection.proxmoxVmid}/spiceproxy`,
                    headers,
                    body: { proxy: connection.host } // Request proxying via host
                });

                if (!spiceRes.success) {
                    throw new Error(spiceRes.error || 'Failed to get SPICE proxy ticket');
                }

                const spiceData = spiceRes.data.data;
                // spiceData contains: { proxy: "...", ticket: "...", type: "spice", ... }

                // Proxmox usage note: The API returns 'password' which acts as the ticket for SPICE
                const spiceTicket = spiceData.ticket || spiceData.password;

                if (!spiceData || !spiceTicket) {
                    console.error("Proxmox Proxy Data:", spiceData);
                    throw new Error(`Proxmox returned success but no SPICE ticket/password.\nRaw Data: ${JSON.stringify(spiceData)}`);
                }

                // 1.5 Fetch Host Certificate (Crucial for self-signed proxies)
                setDebugInfo("Securing connection...");
                const certRes = await window.electronAPI!.getHostCert(connection.host);
                let caCert: string | undefined;

                if (certRes.success && certRes.cert) {
                    caCert = certRes.cert;
                    setDebugInfo("Certificate secured...");
                } else {
                    console.warn("Failed to fetch cert:", certRes.error);
                    setDebugInfo("Warning: proceeding without host cert...");
                }

                // 2. Generate .vv file
                // 2. Generate .vv file using RAW data from Proxmox
                // We merge our manually fetched CA if one wasn't provided by the API (though API might include it check)

                const finalConfig = {
                    ...spiceData, // Use all fields from API (host, proxy, tls-port, etc.)

                    // Fallback/Overrides
                    title: `VM ${connection.proxmoxVmid} - ${connection.host}`,

                    // If API didn't return a CA, use the one we fetched
                    ca: spiceData.ca || caCert
                };

                const vvContent = generateVvFileContent(finalConfig);

                setVvConfig(vvContent);

                // const maskedContent = vvContent.replace(/password=.*/, 'password=***');
                setDebugInfo("Ready");

                // If we had a real viewer, we would pass vvContent or parameters to it here.
                // For now, we update the UI to show success.

            } catch (e: any) {
                setError(e.message);
                setDebugInfo(prev => prev + `\nFailed: ${e.message}`);
            }
        };

        connect();

    }, [connection]);

    return (
        <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center relative overflow-hidden">

            {/* Status / Error Message - Centered and Clean */}
            {!vvConfig && !error && (
                <div className="z-10 bg-black/50 p-6 rounded-xl backdrop-blur-md flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-spicy-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-200 font-medium animate-pulse">{debugInfo || 'Initializing...'}</p>
                </div>
            )}

            {/* Launch Button - Appears when ready */}
            {vvConfig && (
                <div className="z-30 flex flex-col items-center animate-fade-in-up">
                    <button
                        onClick={() => window.electronAPI?.launchSpiceVv(vvConfig)}
                        className="bg-spicy-600 hover:bg-spicy-700 text-white px-8 py-5 rounded-2xl font-bold shadow-2xl shadow-spicy-900/50 flex items-center gap-4 text-xl transition-all hover:scale-105 active:scale-95 group"
                    >
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        Launch Remote Viewer
                    </button>
                    <p className="text-gray-400 text-sm mt-4 bg-black/40 px-3 py-1 rounded-full backdrop-blur">
                        Client is ready. Click to open separate window.
                    </p>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="z-20 bg-red-500/10 border border-red-500/50 p-6 rounded-xl max-w-md text-center backdrop-blur-md">
                    <h3 className="text-red-500 font-bold text-lg mb-2">Connection Failed</h3>
                    <p className="text-red-200 text-sm">{error}</p>
                </div>
            )}

            {/* Background Ambience */}
            <div className="absolute inset-0 -z-10 flex items-center justify-center opacity-5 pointer-events-none">
                <span className="text-[20vw] font-bold text-white select-none">SPICE</span>
            </div>
        </div>
    );
};

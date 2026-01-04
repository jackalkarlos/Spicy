import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { spawn } from 'child_process';
import si from 'systeminformation';
import axios from 'axios';
import https from 'https';

let mainWindow: BrowserWindow | null = null;
const isDev = process.env.NODE_ENV === 'development';

const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        backgroundColor: '#111827', // dark-900
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        autoHideMenuBar: true,
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        // mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Bandwidth Monitor Loop
    setInterval(async () => {
        try {
            const stats = await si.networkStats();
            if (stats && stats.length > 0) {
                // Sum up if multiple interfaces, or just take the main one (default gateway)
                // usually stats[0] is the main active one found by systeminformation
                const mainIf = stats.find(i => i.operstate === 'up') || stats[0];
                const rx_mbps = (mainIf.rx_sec / 125000) || 0; // bytes/sec -> bits/sec / 1M
                const tx_mbps = (mainIf.tx_sec / 125000) || 0;

                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('bandwidth-update', {
                        rx: parseFloat(rx_mbps.toFixed(2)),
                        tx: parseFloat(tx_mbps.toFixed(2))
                    });
                }
            }
        } catch (e) {
            console.error('Bandwidth Monitor Error:', e);
        }
    }, 1000);
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// --- IPC Handlers ---

// 1. RDP Launcher
ipcMain.handle('launch-rdp', async (event, { host, port }) => {
    console.log(`Launching RDP for ${host}:${port}`);
    // Windows built-in mstsc
    // /v:<server>[:<port>]
    const target = port ? `${host}:${port}` : host;
    spawn('mstsc', ['/v:' + target], { detached: true, stdio: 'ignore' }).unref();
    return { success: true };
});

// 2. SSH Mock Handlers (Placeholder for real SSH impl later)
// 2. SSH Handlers
import { Client } from 'ssh2';

let sshClient: Client | null = null;
let sshStream: any = null;

ipcMain.handle('ssh-connect', (event, config: any) => {
    console.log('SSH Connect requested:', config.host);
    return new Promise((resolve) => {
        if (sshClient) {
            sshClient.end();
            sshClient = null;
        }

        const conn = new Client();

        conn.on('ready', () => {
            console.log('SSH Client :: ready');
            conn.shell((err, stream) => {
                if (err) {
                    console.error('SSH Shell Error:', err);
                    resolve({ success: false, error: err.message });
                    return;
                }

                sshStream = stream;

                stream.on('close', () => {
                    console.log('SSH Stream :: close');
                    conn.end();
                    sshStream = null;
                }).on('data', (data: any) => {
                    // Send data to renderer
                    if (mainWindow) {
                        mainWindow.webContents.send('ssh-data', data.toString());
                    }
                });

                resolve({ success: true });
            });
        }).on('error', (err) => {
            console.error('SSH Client Error:', err);
            resolve({ success: false, error: err.message });
        }).on('close', () => {
            console.log('SSH Client :: close');
            if (mainWindow) mainWindow.webContents.send('ssh-data', '\r\nConnection closed.\r\n');
        });

        try {
            const connectConfig: any = {
                host: config.host,
                port: config.port || 22,
                username: config.username,
            };

            if (config.privateKey) {
                // If private key is provided content
                connectConfig.privateKey = config.privateKey;
            } else if (config.password) {
                connectConfig.password = config.password;
            }

            conn.connect(connectConfig);
            sshClient = conn;
        } catch (e: any) {
            resolve({ success: false, error: e.message });
        }
    });
});

ipcMain.on('ssh-input', (event, data) => {
    if (sshStream) {
        sshStream.write(data);
    }
});

ipcMain.on('ssh-resize', (event, { cols, rows }) => {
    if (sshStream) {
        sshStream.setWindow(rows, cols, 0, 0);
    }
});

// 3. Proxmox API Proxy
ipcMain.handle('proxmox-api', async (event, { method, url, body, headers }) => {
    try {
        console.log(`Proxmox API Request: ${method} ${url}`);
        const response = await axios({
            method,
            url,
            data: body,
            headers,
            httpsAgent, // Ignore self-signed certs
            timeout: 5000
        });
        return { success: true, data: response.data };
    } catch (error: any) {
        console.error('Proxmox API Error:', error.message);
        return {
            success: false,
            error: error.message,
            status: error.response?.status,
            data: error.response?.data
        };
    }
});

// 4. SPICE Launcher
ipcMain.handle('launch-spice-vv', async (event, content) => {
    try {
        console.log("Preparing to launch SPICE Virt-Viewer...");
        const fs = require('fs');
        const tempDir = app.getPath('temp');
        const filePath = path.join(tempDir, `spice-${Date.now()}.vv`);
        fs.writeFileSync(filePath, content);

        let viewerPath;
        if (isDev) {
            viewerPath = path.join(__dirname, '../resources/bin/virt-viewer/bin/remote-viewer.exe');
        } else {
            viewerPath = path.join(process.resourcesPath, 'bin/virt-viewer/bin/remote-viewer.exe');
        }

        console.log("Viewer Path:", viewerPath);

        if (!fs.existsSync(viewerPath)) {
            console.warn("Bundled viewer not found, trying system 'remote-viewer'...");
            viewerPath = 'remote-viewer';
        }

        const child = spawn(viewerPath, [filePath], { detached: true, stdio: 'ignore' });
        child.unref();

        return { success: true };
    } catch (e: any) {
        console.error("Launch Error:", e);
        return { success: false, error: e.message };
    }
});

// 5. Get Host Certificate
ipcMain.handle('get-host-cert', async (event, host) => {
    return new Promise((resolve) => {
        const tls = require('tls');
        const socket = tls.connect({
            host: host,
            port: 8006, // Standard Proxmox API port
            rejectUnauthorized: false
        }, () => {
            const cert = socket.getPeerCertificate(true);
            socket.end();
            if (cert && cert.raw) {
                // Return PEM encoded cert
                const prefix = '-----BEGIN CERTIFICATE-----\n';
                const postfix = '-----END CERTIFICATE-----';
                const pem = prefix + cert.raw.toString('base64').match(/.{0,64}/g)!.join('\n') + postfix;
                resolve({ success: true, cert: pem });
            } else {
                resolve({ success: false, error: 'No certificate found' });
            }
        });

        socket.on('error', (err: any) => {
            console.error('Cert fetch error:', err);
            resolve({ success: false, error: err.message });
        });
    });
});

// 6. Persistence Handlers
ipcMain.handle('save-connections', async (event, connections) => {
    try {
        const baseDir = isDev ? process.cwd() : path.dirname(app.getPath('exe'));
        const configDir = path.join(baseDir, 'config');
        const filePath = path.join(configDir, 'connections.json');
        console.log("Saving connections to:", filePath);
        const fsLib = require('fs');
        fsLib.writeFileSync(filePath, JSON.stringify(connections, null, 2));
        return { success: true };
    } catch (e: any) {
        console.error('Save Error:', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('load-connections', async (event) => {
    try {
        // User requested config in "main directory".
        // In Dev: process.cwd()
        // In Prod: path.dirname(app.getPath('exe'))
        const baseDir = isDev ? process.cwd() : path.dirname(app.getPath('exe'));
        const configDir = path.join(baseDir, 'config');
        const fsLib = require('fs');
        if (!fsLib.existsSync(configDir)) fsLib.mkdirSync(configDir, { recursive: true });

        const filePath = path.join(configDir, 'connections.json');
        console.log("Loading connections from:", filePath);

        if (fsLib.existsSync(filePath)) {
            const data = fsLib.readFileSync(filePath, 'utf-8');
            return { success: true, data: JSON.parse(data) };
        }
        return { success: true, data: [] };
    } catch (e: any) {
        console.error('Load Error:', e);
        return { success: false, error: e.message };
    }
});

import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { ConnectionConfig } from '../types';

interface TerminalProps {
    onData?: (data: string) => void;
    connection: ConnectionConfig;
}

export const Terminal: React.FC<TerminalProps> = ({ connection }) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);

    useEffect(() => {
        if (!terminalRef.current) return;

        // Initialize XTerm
        const term = new XTerm({
            cursorBlink: true,
            fontFamily: 'monospace',
            fontSize: 14,
            theme: {
                background: '#0c0c0c',
                foreground: '#ffffff',
            }
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(terminalRef.current);

        // Delay fit to allow layout to settle
        setTimeout(() => {
            fitAddon.fit();
        }, 300);

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Handle Input
        term.onData((data) => {
            if (window.electronAPI) {
                window.electronAPI.sendSshInput(data);
            } else {
                term.write(data);
            }
        });

        // Handle Incoming Data and Connect
        if (window.electronAPI) {
            window.electronAPI.onSshData((data: string) => {
                term.write(data);
            });

            term.writeln(`\x1b[32mConnecting to ${connection.host}...\x1b[0m`);

            // Initiate Connection
            if (window.electronAPI.sshConnect) {
                window.electronAPI.sshConnect(connection)
                    .then(res => {
                        if (!res.success) {
                            term.writeln(`\r\n\x1b[31mConnection Error: ${res.error}\x1b[0m`);
                        }
                    })
                    .catch(err => {
                        term.writeln(`\r\n\x1b[31mConnection Failed: ${err}\x1b[0m`);
                    });
            } else {
                term.writeln(`\r\n\x1b[33mError: SSH Client API not found. Please restart the app complete new features.\x1b[0m`);
            }

        } else {
            term.writeln('\x1b[33mWeb Mode (No SSH backend detected)\x1b[0m');
            term.writeln('Type something to test local echo...');
        }

        // Initial Fit
        setTimeout(() => {
            fitAddon.fit();
            if (window.electronAPI?.sshResize) {
                window.electronAPI.sshResize(term.cols, term.rows);
            }
        }, 300);

        // Resize Observer
        const resizeObserver = new ResizeObserver(() => {
            // We must wrap in requestAnimationFrame or setTimeout to avoid loop limit errors
            requestAnimationFrame(() => {
                if (!terminalRef.current) return;
                try {
                    fitAddon.fit();
                    if (window.electronAPI?.sshResize) {
                        window.electronAPI.sshResize(term.cols, term.rows);
                    }
                } catch (e) {
                    console.error("Resize Error:", e);
                }
            });
        });

        if (terminalRef.current) {
            resizeObserver.observe(terminalRef.current);
        }

        return () => {
            resizeObserver.disconnect();
            term.dispose();
        };
    }, [connection]);

    return (
        <div
            ref={terminalRef}
            className="w-full h-full bg-black"
        />
    );
};

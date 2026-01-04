/**
 * Generates the content of a .vv (Virt-Viewer) file from raw Proxmox API data.
 * This ensures we use the exact host, proxy, and port details returned by the server.
 */
export function generateVvFileContent(config: Record<string, any>): string {
    let content = '[virt-viewer]\n';

    // Default keys to include if present in config
    const keysToCheck = [
        'type', 'proxy', 'host', 'port', 'tls-port', 'password',
        'title', 'host-subject', 'secure-attention', 'release-cursor',
        'toggle-fullscreen', 'delete-this-file'
    ];

    // standard defaults if missing
    if (!config['type']) content += `type=spice\n`;
    if (!config['delete-this-file']) content += `delete-this-file=1\n`;
    if (!config['toggle-fullscreen']) content += `toggle-fullscreen=shift+f11\n`;
    if (!config['release-cursor']) content += `release-cursor=shift+f12\n`;

    // Process all keys provided in the config object
    for (const [key, value] of Object.entries(config)) {
        if (key === 'ca') continue; // Handle CA separately
        if (value !== undefined && value !== null && value !== '') {
            content += `${key}=${value}\n`;
        }
    }

    if (config.ca) {
        // virt-viewer INI parser requires the CA to be on a single line with \n literals
        const flatCa = config.ca.replace(/\r\n/g, '\n').replace(/\n/g, '\\n');
        content += `ca=${flatCa}\n`;
    }

    return content;
}

export function parseVvFile(content: string): Record<string, string> {
    const lines = content.split('\n');
    const config: Record<string, string> = {};
    lines.forEach(line => {
        if (line.includes('=')) {
            const [key, value] = line.split('=');
            config[key.trim()] = value.trim();
        }
    });
    return config;
}

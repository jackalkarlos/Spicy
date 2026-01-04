# ![Spicy Logo](logo.png) Spicy 🌶️

**Spicy** is a modern, Proxmox SPICE remote connection manager built with Electron, React, and TypeScript. It is designed to be the ultimate companion for Proxmox users and system administrators.

## Features

*   **🌶️ Proxmox SPICE Integration**: Seamlessly connect to Proxmox VMs with native performance.
*   **💻 SSH Terminal**: Fully functional, resizable xterm.js terminal for Linux management.
*   **🖥️ RDP Support**: One-click launch for Windows Remote Desktop sessions.
*   **📊 Live Monitoring**: Real-time bandwidth and resource usage tracking.
*   **✨ Modern UI**: A beautiful, dark-themed interface "vibecoded" for aesthetics and usability.

## Tech Stack

*   **Electron**: Cross-platform desktop runtime.
*   **React**: UI library.
*   **TypeScript**: Type safety.
*   **Vite**: Blazing fast build tool.
*   **TailwindCSS**: Styling.

## Installation

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run in development mode:
    ```bash
    npm run start:electron
    ```
4.  Build for production:
    ```bash
    npm run build
    ```

## Configuration

Spicy saves your connections in a portable `config/connections.json` file located in the application directory. You can easily back up or share this file.

## Credits

**Vibecoded with Gemini**
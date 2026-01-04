const sevenBin = require('7zip-bin');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const msiPath = path.resolve(__dirname, 'resources/bin/virt-viewer.msi');
const outDir = path.resolve(__dirname, 'resources/bin/virt-viewer');

if (!fs.existsSync(msiPath)) {
    console.error("MSI not found:", msiPath);
    process.exit(1);
}

// 7z x "file.msi" -o"out" -y
// Note: 7z usually extracts the CABS from MSI. Then we might need to extract CABS. 
// But often virt-viewer MSI just has the files structure if it's "Admin" extractable?
// Actually 7zip on MSI extracts the files usually named "File1234". 
// Wait, 7zip extraction of MSI is messy (flat files with internal IDs).
// BUT, if it contains an encapsulated generic "Data1.cab", we extract that.

// Let's try to list it first.
console.log("Extracting with 7z:", sevenBin.path7za);

const child = spawn(sevenBin.path7za, ['x', msiPath, `-o${outDir}`, '-y'], { stdio: 'inherit' });

child.on('close', (code) => {
    console.log(`7z exited with code ${code}`);

    // Check what we got.
    // If we get "tviewer.exe" or similar, we might need to find the main exe.
    // Standard MSI extraction via 7z often results in files like "File_remote_viewer.exe"
    // We might need to rename them? 
    // Let's inspect the output after run.
});

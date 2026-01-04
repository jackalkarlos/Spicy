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


// idiot gemini


console.log("Extracting with 7z:", sevenBin.path7za);

const child = spawn(sevenBin.path7za, ['x', msiPath, `-o${outDir}`, '-y'], { stdio: 'inherit' });

child.on('close', (code) => {
    console.log(`7z exited with code ${code}`);


});


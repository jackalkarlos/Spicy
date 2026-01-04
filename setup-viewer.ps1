$ErrorActionPreference = "Stop"

$binDir = "$PSScriptRoot\resources\bin"
$msiPath = "$binDir\virt-viewer.msi"
# Use a simple, short path for extraction to avoid length limits, then move
$tempExtract = "C:\vv_temp" 

if (Test-Path $tempExtract) { Remove-Item $tempExtract -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Force -Path $tempExtract | Out-Null

Write-Host "Checking MSI..."
if (-not (Test-Path $msiPath)) {
    Write-Error "MSI not found. Please run download again or check path."
}

Write-Host "Attempting extraction to $tempExtract..."

# Attempt 1: TARGETDIR
$p = Start-Process msiexec.exe -ArgumentList "/a `"$msiPath`" /qn TARGETDIR=`"$tempExtract`" /l*v `"$binDir\extract.log`"" -Wait -PassThru
Write-Host "Exit Code (TARGETDIR): $($p.ExitCode)"

if (-not (Test-Path "$tempExtract\VirtViewer")) {
    Write-Host "Attempt 2: INSTALLDIR..."
    $p = Start-Process msiexec.exe -ArgumentList "/a `"$msiPath`" /qn INSTALLDIR=`"$tempExtract`"" -Wait -PassThru
    Write-Host "Exit Code (INSTALLDIR): $($p.ExitCode)"
}

# Check for success
$exe = Get-ChildItem -Path $tempExtract -Recurse -Filter "remote-viewer.exe" | Select-Object -First 1

if ($exe) {
    Write-Host "Found executable at $($exe.FullName)"
    $dest = "$binDir\virt-viewer"
    if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
    
    # Move the parent folder of 'bin' to keep structure, or just the whole temp
    # VirtViewer usually has 'bin', 'share', etc.
    # We want to move everything under $tempExtract to $dest
    Move-Item -Path "$tempExtract\*" -Destination $dest -Force
    Write-Host "Bundled successfully to $dest"
    
    Remove-Item $tempExtract -Recurse -Force
} else {
    Write-Error "Failed to extract remote-viewer.exe. Check $binDir\extract.log"
}

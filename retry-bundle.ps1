$ErrorActionPreference = "Stop"

$msi = "$PSScriptRoot\resources\bin\virt-viewer.msi"
$extractDir = "$HOME\Desktop\vv_temp"
$destDir = "$PSScriptRoot\resources\bin\virt-viewer"

Write-Host "Unblocking MSI..."
Unblock-File -Path $msi -ErrorAction SilentlyContinue

if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Force -Path $extractDir | Out-Null

Write-Host "Attempting MSI Admin Extract to $extractDir..."
$log = "$extractDir\install.log"
$args = "/a `"$msi`" /qn TARGETDIR=`"$extractDir`" /l*v `"$log`""

$p = Start-Process msiexec.exe -ArgumentList $args -Wait -PassThru
Write-Host "Exit Code: $($p.ExitCode)"

if ($p.ExitCode -ne 0) {
    Write-Host "Admin extract failed. Trying log check..."
    Get-Content $log -Tail 10
    
    # Try per-user install?
    # Write-Host "Attempting Per-User Install..."
    # msiexec /i ...
    exit 1
}

# Check results
$exe = Get-ChildItem -Path $extractDir -Recurse -Filter "remote-viewer.exe" | Select-Object -First 1

if ($exe) {
    Write-Host "Found exe at: $($exe.FullName)"
    if (Test-Path $destDir) { Remove-Item $destDir -Recurse -Force }
    
    # Move the 'VirtViewer' folder or 'bin' parent
    # Usually structure is TARGETDIR\VirtViewer\bin...
    # We want resources/bin/virt-viewer/bin/...
    
    # Logic: If $exe is in ...\VirtViewer\bin\remote-viewer.exe
    # We move ...\VirtViewer -> $destDir
    
    $parent = $exe.Directory.Parent
    Write-Host "Moving $($parent.FullName) to $destDir"
    Move-Item -Path $parent.FullName -Destination $destDir -Force
    
    Write-Host "Success!"
    Remove-Item $extractDir -Recurse -Force
} else {
    Write-Error "Extraction finished but executable not found."
}

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Assert-Command {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command not found: $Name"
    }
}

Assert-Command -Name 'py'

$pyInstallerPresent = & py -3.12 -c "import importlib.util as u; print('1' if u.find_spec('PyInstaller') else '0')"
if ($pyInstallerPresent.Trim() -ne '1') {
    Write-Host 'Installing PyInstaller...'
    & py -3.12 -m pip install --upgrade pyinstaller
}

$ffmpeg = Get-Command ffmpeg.exe -ErrorAction Stop
$ffmpegPath = $ffmpeg.Source
if (-not (Test-Path $ffmpegPath)) {
    throw "ffmpeg.exe was found on PATH, but the resolved file does not exist: $ffmpegPath"
}

$distDir = Join-Path $root 'dist'
$buildDir = Join-Path $root 'build'

if (Test-Path $distDir) {
    Remove-Item -Recurse -Force $distDir
}
if (Test-Path $buildDir) {
    Remove-Item -Recurse -Force $buildDir
}

Write-Host 'Building transcribe.exe...'
& py -3.12 -m PyInstaller `
    --noconfirm `
    --clean `
    --onefile `
    --console `
    --name transcribe `
    --distpath $distDir `
    --workpath $buildDir `
    --specpath $buildDir `
    --collect-data whisper `
    --add-binary "$ffmpegPath;ffmpeg" `
    transcribe.py

$exePath = Join-Path $distDir 'transcribe.exe'
if (-not (Test-Path $exePath)) {
    throw "Build completed, but the executable was not created: $exePath"
}

Write-Host 'Creating shortcut...'
$shell = New-Object -ComObject WScript.Shell
$shortcutPath = Join-Path $distDir 'transcribe.lnk'
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $exePath
$shortcut.Arguments = '--pause'
$shortcut.WorkingDirectory = $distDir
$shortcut.Description = 'Transcribe an audio file with Whisper (drop a file here or double-click)'
$shortcut.IconLocation = "$exePath,0"
$shortcut.WindowStyle = 1
$shortcut.Save()

Write-Host ""
Write-Host "Done."
Write-Host "Executable: $exePath"
Write-Host "Shortcut:    $shortcutPath"

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$names = @('AVENYN_RELEASE_KEYSTORE', 'AVENYN_RELEASE_KEY_ALIAS', 'AVENYN_RELEASE_STORE_PASSWORD', 'AVENYN_RELEASE_KEY_PASSWORD')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
function Read-Password($label) {
    $secret = Read-Host $label -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $secret.Dispose() }
}
function Run-Step($program, $arguments) {
    & $program @arguments
    if ($LASTEXITCODE -ne 0) { throw "Byggsteget misslyckades: $program (kod $LASTEXITCODE)." }
}
try {
    Write-Host 'Avenyn Taxi - bygg signerad forarapp med Tap to Pay'
    if (!(Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'Installera Node.js med npm innan du bygger.' }
    if (!$env:JAVA_HOME) {
        foreach ($candidate in @("$env:ProgramFiles\Android\Android Studio3\jbr", "$env:ProgramFiles\Android\Android Studio\jbr")) {
            if (Test-Path "$candidate\bin\java.exe") { $env:JAVA_HOME = $candidate; break }
        }
    }
    $defaultKey = Join-Path $env:USERPROFILE 'OneDrive\Documents\avenyn-taxi-driver-release.jks'
    $keyPath = Read-Host "Sokvag till befintlig keystore [Enter = $defaultKey]"
    if (!$keyPath) { $keyPath = $defaultKey }
    $keyPath = $keyPath.Trim('"')
    if (!(Test-Path -LiteralPath $keyPath -PathType Leaf)) { throw 'Signeringsnyckeln hittades inte. Valj din befintliga .jks-fil.' }
    $env:AVENYN_RELEASE_KEYSTORE = (Resolve-Path -LiteralPath $keyPath).Path
    $alias = Read-Host 'Key alias [Enter = avenyn-taxi-driver]'
    if (!$alias) { $alias = 'avenyn-taxi-driver' }
    $env:AVENYN_RELEASE_KEY_ALIAS = $alias
    $env:AVENYN_RELEASE_STORE_PASSWORD = Read-Password 'Keystore-losenord'
    $env:AVENYN_RELEASE_KEY_PASSWORD = Read-Password 'Nyckellosenord (key password)'
    if (!$env:AVENYN_RELEASE_STORE_PASSWORD -or !$env:AVENYN_RELEASE_KEY_PASSWORD) { throw 'Bada losenorden behovs for signering.' }
    Run-Step 'npm.cmd' @('ci')
    Run-Step 'npx.cmd' @('cap', 'sync', 'android')
    Push-Location android
    try { Run-Step '.\gradlew.bat' @('--no-daemon', ':app:assembleRelease', ':app:bundleRelease') }
    finally { Pop-Location }
    $apk = Join-Path (Get-Location) 'android\app\build\outputs\apk\release\app-release.apk'
    $aab = Join-Path (Get-Location) 'android\app\build\outputs\bundle\release\app-release.aab'
    if (!(Test-Path $apk) -or !(Test-Path $aab)) { throw 'Signerade installationsfiler saknas efter bygget.' }
    Write-Host "Klart. APK for telefonen: $apk"
    Write-Host "AAB for Google Play: $aab"
    Write-Host 'Testa APK pa telefonen innan du publicerar i Google Play.'
    exit 0
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}

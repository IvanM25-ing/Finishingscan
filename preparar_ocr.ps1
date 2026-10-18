# CoatingScan — Instalador de OCR para Windows
# Descarga bibliotecas de código abierto y modelos OCR al proyecto.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Set-Location $PSScriptRoot
$files = @(
  @('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js','vendor/tesseract.min.js'),
  @('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js','vendor/worker.min.js'),
  @('https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0/tesseract-core.wasm.js','vendor/core/tesseract-core.wasm.js'),
  @('https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0/tesseract-core-simd.wasm.js','vendor/core/tesseract-core-simd.wasm.js'),
  @('https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0/tesseract-core-lstm.wasm.js','vendor/core/tesseract-core-lstm.wasm.js'),
  @('https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0/tesseract-core-simd-lstm.wasm.js','vendor/core/tesseract-core-simd-lstm.wasm.js'),
  @('https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz','vendor/lang/eng.traineddata.gz')
)
Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ' CoatingScan - Preparar motor OCR' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'Se descargaran siete archivos. Necesitas internet.'
Write-Host ''
$i = 0
foreach($entry in $files) {
  $i++
  $uri = $entry[0]
  $relative = $entry[1]
  $destination = Join-Path $PSScriptRoot ($relative.Replace('/','\'))
  $directory = Split-Path -Parent $destination
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
  if ((Test-Path $destination) -and ((Get-Item $destination).Length -gt 1000)) {
    Write-Host "[$i/7] Ya existe: $relative" -ForegroundColor DarkGreen
    continue
  }
  Write-Host "[$i/7] Descargando: $relative"
  try {
    Invoke-WebRequest -Uri $uri -OutFile $destination -UseBasicParsing -TimeoutSec 240
    if ((Get-Item $destination).Length -lt 1000) {throw 'Archivo vacio o incompleto'}
  } catch {
    if (Test-Path $destination) {Remove-Item $destination -Force}
    Write-Host ''
    Write-Host "ERROR al descargar: $relative" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host 'Comprueba tu conexion a internet. Ejecuta el instalador de nuevo.'
    exit 1
  }
}
Write-Host ''
Write-Host 'Listo: todos los componentes OCR estan en la carpeta vendor.' -ForegroundColor Green
Write-Host 'SIGUIENTE: publica toda esta carpeta en HTTPS (por ejemplo GitHub Pages).' -ForegroundColor Cyan
Write-Host 'Luego, en el iPhone, pulsa Preparar modo sin conexion.' -ForegroundColor Cyan
exit 0

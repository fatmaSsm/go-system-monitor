$ErrorActionPreference = 'SilentlyContinue'

Write-Host "Go System Monitor - Battery Check" -ForegroundColor Cyan
Write-Host ""

$battery = Get-CimInstance Win32_Battery | Select-Object -First 1
if (-not $battery) {
    Write-Host "No Windows battery device was detected." -ForegroundColor Yellow
    exit 0
}

Write-Host "Battery:" $battery.Name
Write-Host "Charge:" ($battery.EstimatedChargeRemaining.ToString() + "%")
Write-Host "BatteryStatus code:" $battery.BatteryStatus

$static = Get-CimInstance -Namespace root/wmi -ClassName BatteryStaticData | Select-Object -First 1
$full = Get-CimInstance -Namespace root/wmi -ClassName BatteryFullChargedCapacity | Select-Object -First 1

if ($static -and $full -and $static.DesignedCapacity -gt 0 -and $full.FullChargedCapacity -gt 0) {
    $health = [math]::Round(($full.FullChargedCapacity / $static.DesignedCapacity) * 100, 1)
    Write-Host "Design capacity:" $static.DesignedCapacity
    Write-Host "Full charge capacity:" $full.FullChargedCapacity
    Write-Host "Estimated health:" ($health.ToString() + "%") -ForegroundColor Green
} else {
    Write-Host "Battery health capacity data is not exposed by this driver." -ForegroundColor Yellow
}

# SweetHarvest - 1-Click Azure Deployment Script
# Hosts the application on Azure App Service with free HTTPS (*.azurewebsites.net)

param (
    [string]$AppName = "sweetharvest-$(Get-Random -Minimum 1000 -Maximum 9999)",
    [string]$ResourceGroup = "SweetHarvest-RG",
    [string]$Location = "centralindia",
    [string]$PlanName = "SweetHarvest-Plan"
)

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "🌾 SweetHarvest — Deploying to Microsoft Azure App Service" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green

# 1. Check Azure CLI
if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Host "Azure CLI ('az') is not installed. Please install it from https://aka.ms/installazurecliwindows" -ForegroundColor Red
    exit 1
}

# 2. Check Azure login status
Write-Host "`nChecking Azure credentials..." -ForegroundColor Cyan
$account = az account show --output json 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "Please login to your Azure account..." -ForegroundColor Yellow
    az login --output table
}

# 3. Build Project
Write-Host "`nBuilding Frontend and Backend..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\frontend"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Frontend build failed" -ForegroundColor Red; exit 1 }

Set-Location "$PSScriptRoot\backend"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Backend build failed" -ForegroundColor Red; exit 1 }
Set-Location "$PSScriptRoot"

# 4. Create Resource Group
Write-Host "`nCreating Resource Group: $ResourceGroup in $Location..." -ForegroundColor Cyan
az group create --name $ResourceGroup --location $Location --output table

# 5. Create App Service Plan (Linux)
Write-Host "`nCreating App Service Plan ($PlanName)..." -ForegroundColor Cyan
az appservice plan create --name $PlanName --resource-group $ResourceGroup --sku B1 --is-linux --output table

# 6. Create Web App
Write-Host "`nCreating Web App: $AppName..." -ForegroundColor Cyan
az webapp create --resource-group $ResourceGroup --plan $PlanName --name $AppName --runtime "NODE:20-lts" --output table

# 7. Configure Persistent Storage for SQLite Database
Write-Host "`nConfiguring persistent storage and environment variables..." -ForegroundColor Cyan
az webapp config appsettings set --resource-group $ResourceGroup --name $AppName --settings `
    WEBSITES_ENABLE_APP_SERVICE_STORAGE=true `
    NODE_ENV=production `
    PORT=80 `
    JWT_SECRET="sweetharvest-secret-$(New-Guid)" --output table

# 8. Set Startup Command
az webapp config set --resource-group $ResourceGroup --name $AppName --startup-file "node backend/dist/index.js" --output table

# 9. Create Deployment Zip
Write-Host "`nPackaging deployment zip..." -ForegroundColor Cyan
$zipFile = "$PSScriptRoot\deploy.zip"
if (Test-Path $zipFile) { Remove-Item $zipFile -Force }

# Files to include in zip: backend/, frontend/dist, package.json
Compress-Archive -Path "$PSScriptRoot\backend", "$PSScriptRoot\frontend\dist", "$PSScriptRoot\package.json" -DestinationPath $zipFile

# 10. Deploy to Azure
Write-Host "`nDeploying zip package to Azure..." -ForegroundColor Cyan
az webapp deploy --resource-group $ResourceGroup --name $AppName --src-path $zipFile --type zip --output table

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "🎉 SweetHarvest is LIVE on Azure!" -ForegroundColor Green
Write-Host "URL: https://$AppName.azurewebsites.net" -ForegroundColor Yellow
Write-Host "Default Login: admin@sweetharvest.com / admin123" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Green


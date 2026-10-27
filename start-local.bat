@echo off
echo ===================================================
echo 🌾 Starting SweetHarvest Local Server...
echo ===================================================

cd /d "%~dp0"
echo Starting Backend & Serving Frontend on http://localhost:3001
cd backend
npx tsx src/index.ts
pause


@echo off
cd /d "%~dp0"
chcp 65001 > nul

echo ===================================================
echo      Finansal Asistan Baslatiliyor
echo ===================================================

:: Backend
start "Backend" cmd /k "cd /d "%~dp0backend" && uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 4 /nobreak > nul

:: Scheduler
start "Scheduler" cmd /k "cd /d "%~dp0backend" && python -m scheduler.tasks"

:: Frontend
start "Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

:: Ilk veri cekimi
echo Ilk veriler cekiliyor (20 saniye bekleniyor)...
timeout /t 20 /nobreak > nul

start "IlkVeri" cmd /c "cd /d "%~dp0backend" && python -c "import asyncio; from scheduler.tasks import run_price_pipeline; asyncio.run(run_price_pipeline())""

echo.
echo Tarayici aciliyor...
timeout /t 5 /nobreak > nul
start http://localhost:3000

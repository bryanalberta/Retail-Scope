@echo off
cd /d "%~dp0"
echo RetailScope - buka http://127.0.0.1:4173 di browser.
echo Tutup jendela ini atau tekan Ctrl+C untuk menghentikan server.
node server.mjs
pause

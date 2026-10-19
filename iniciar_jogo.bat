@echo off
chcp 65001 >nul
title MOBA Duplinha 2.5D
cd /d "%~dp0"

echo ======================================================
echo           INICIANDO MOBA DUPLINHA 2.5D
echo ======================================================
echo.

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    where python >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo [AVISO] Node.js nao encontrado, usando Python como servidor local...
        start "" cmd /c "timeout /t 1 /nobreak >nul && start http://localhost:3000"
        python -m http.server 3000
        exit /b 0
    )
    echo [ERRO] O Node.js nao foi encontrado no seu computador!
    echo Por favor, instale o Node.js em: https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo Abrindo o jogo no seu navegador padrao...
start "" cmd /c "timeout /t 1 /nobreak >nul && start http://localhost:3000"

node server.js

pause

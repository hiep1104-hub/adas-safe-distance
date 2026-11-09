@echo off
chcp 65001 >nul
title ADAS SafeDistance Pro - Khoảng Cách Xe Hơi Theo Pháp Luật
echo =====================================================================
echo   ADAS SafeDistance Pro - Canh Bao Khoang Cach An Toan Xe Hoi
echo   Can cu: Thong tu so 31/2019/TT-BGTVT va Luat TTATGTDB 2024
echo =====================================================================
echo Dang khoi chay ung dung...
python main.py
if errorlevel 1 (
    echo.
    echo [LOI] Khong the khoi chay ung dung. Vui long kiem tra Python.
    pause
)

@echo off
chcp 65001 >nul
title ADAS SafeDistance Pro - Máy Chủ Điện Thoại Di Động
echo =====================================================================
echo   ADAS SafeDistance Pro - Máy Chủ Ứng Dụng Điện Thoại Khi Lái Xe
echo   Can cu: Thong tu so 31/2019/TT-BGTVT va Luat TTATGTDB 2024
echo =====================================================================
echo Dang khoi tao may chu HTTPS va sinh ma QR cho dien thoai...
python mobile_server.py
if errorlevel 1 (
    echo.
    echo [LOI] Khong the khoi chay may chu di dong.
    pause
)

@echo off
chcp 65001 >nul
title ADAS SafeDistance Pro - Máy Chủ Điện Thoại & Mã QR
echo =====================================================================
echo   ADAS SafeDistance Pro - Máy Chủ Ứng Dụng Điện Thoại Khi Lái Xe
echo   Căn cứ: Thông tư 38/2024/TT-BGTVT & Nghị định 168/2024/NĐ-CP
echo =====================================================================
echo Dang khoi chay may chu HTTPS hop nhat va sinh ma QR cho dien thoai...
python main.py --mobile
if errorlevel 1 (
    echo.
    echo [LOI] Khong the khoi chay may chu di dong.
    pause
)

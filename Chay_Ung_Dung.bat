@echo off
chcp 65001 >nul
title ADAS SafeDistance Pro - Bảng Điều Khiển Desktop HUD
echo =====================================================================
echo   ADAS SafeDistance Pro - Hệ Thống Trợ Lái & Cảnh Báo An Toàn Xe Hơi
echo   Căn cứ: Thông tư 38/2024/TT-BGTVT & Nghị định 168/2024/NĐ-CP
echo =====================================================================
echo Dang khoi chay giao dien Desktop Cockpit HUD...
python main.py --gui
if errorlevel 1 (
    echo.
    echo [LOI] Khong the khoi chay giao dien Desktop. Chuyen sang menu hop nhat:
    python main.py --menu
    pause
)

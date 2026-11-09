# -*- coding: utf-8 -*-
"""
Hệ thống Cảnh báo Khoảng cách Xe hơi theo Quy định Pháp luật Việt Nam
(Thông tư số 31/2019/TT-BGTVT & Luật Trật tự, An toàn Giao thông Đường bộ 2024)
ADAS SafeDistance Pro - Điểm Khởi Chạy Ứng Dụng (Application Entrypoint)
"""
import sys
import os

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

from PyQt5.QtWidgets import QApplication
from PyQt5.QtCore import Qt
from gui.main_window import MainWindow


def main():
    # Hỗ trợ hiển thị sắc nét trên màn hình High DPI / Retina
    QApplication.setAttribute(Qt.AA_EnableHighDpiScaling, True)
    QApplication.setAttribute(Qt.AA_UseHighDpiPixmaps, True)

    app = QApplication(sys.argv)
    app.setApplicationName("ADAS SafeDistance Pro")
    app.setApplicationDisplayName("ADAS SafeDistance Pro - TT 31/2019/TT-BGTVT")

    window = MainWindow()
    window.show()

    sys.exit(app.exec_())


if __name__ == "__main__":
    main()

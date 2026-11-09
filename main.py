# -*- coding: utf-8 -*-
"""
Hệ thống Giám sát & Cảnh báo Khoảng cách An toàn Xe hơi (ADAS SafeDistance Pro)
Cơ sở pháp lý thống nhất:
- Thông tư số 38/2024/TT-BGTVT (thay thế Thông tư 31/2019/TT-BGTVT từ 01/01/2025)
- Nghị định số 168/2024/NĐ-CP (Quy định xử phạt và trừ điểm GPLX từ 01/01/2025)
- Quy chuẩn kỹ thuật quốc gia QCVN 41:2019/BGTVT về báo hiệu đường bộ
ĐIỂM KHỞI CHẠY HỆ THỐNG THỐNG NHẤT (MASTER SYSTEM CONTROLLER)
"""
import sys
import os
import argparse
import webbrowser

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

ONLINE_URL = "https://hiep1104-hub.github.io/adas-safe-distance/"


def run_desktop_gui():
    """Khởi chạy Giao diện Bảng điều khiển Desktop Cockpit HUD (PyQt5)"""
    print("\n[HỆ THỐNG] Đang khởi chạy Giao diện Desktop Cockpit HUD...")
    try:
        from PyQt5.QtWidgets import QApplication
        from PyQt5.QtCore import Qt
        from gui.main_window import MainWindow

        QApplication.setAttribute(Qt.AA_EnableHighDpiScaling, True)
        QApplication.setAttribute(Qt.AA_UseHighDpiPixmaps, True)

        app = QApplication(sys.argv)
        app.setApplicationName("ADAS SafeDistance Pro")
        app.setApplicationDisplayName("ADAS SafeDistance Pro - TT 38/2024/TT-BGTVT")

        window = MainWindow()
        window.show()

        sys.exit(app.exec_())
    except ImportError as e:
        print(f"[CẢNH BÁO] Không tìm thấy PyQt5 hoặc thư viện đồ họa ({e}).")
        print("Tự động chuyển sang chế độ Máy chủ Di Động / Trình duyệt...")
        run_mobile_server()


def run_mobile_server():
    """Khởi chạy Máy chủ Di động HTTPS nội bộ (quét mã QR cho điện thoại)"""
    import mobile_server
    mobile_server.run_server(port=8443, open_browser=False)


def run_online_browser():
    """Mở trực tiếp Ứng dụng Di động Online trên trình duyệt (GitHub Pages)"""
    print(f"\n[ONLINE] Đang mở ứng dụng trực tuyến trên trình duyệt: {ONLINE_URL}")
    try:
        webbrowser.open(ONLINE_URL)
    except Exception as e:
        print(f"Lỗi mở trình duyệt: {e}")
    print(f"👉 Link truy cập: {ONLINE_URL}")


def run_self_tests():
    """Chạy kiểm thử toàn diện tính chính xác của toàn bộ hệ thống"""
    import test_system
    test_system.run_all_tests()


def interactive_menu():
    """Menu tương tác điều khiển hợp nhất toàn hệ thống"""
    while True:
        print("\n" + "=" * 70)
        print("   ADAS SAFEDISTANCE PRO — HỆ THỐNG CẢNH BÁO AN TOÀN XE HƠI HỢP NHẤT")
        print("   Căn cứ: TT 38/2024/TT-BGTVT • NĐ 168/2024/NĐ-CP • QCVN 41:2019")
        print("=" * 70)
        print(" [1] 🖥️  Khởi chạy Bảng điều khiển Desktop (Cockpit HUD PyQt5)")
        print(" [2] 📱  Khởi chạy Máy chủ Di động HTTPS (Quét mã QR kết nối)")
        print(" [3] 🌐  Mở Ứng dụng Di động Trực tuyến (GitHub Pages)")
        print(" [4] 🧪  Chạy Kiểm tra Toàn diện Hệ thống (Automated Self-Test)")
        print(" [0] 🚪  Thoát")
        print("=" * 70)

        choice = input("👉 Nhập lựa chọn của bạn (0-4) [Mặc định 1]: ").strip()
        if choice in ["", "1"]:
            run_desktop_gui()
            break
        elif choice == "2":
            run_mobile_server()
            break
        elif choice == "3":
            run_online_browser()
            break
        elif choice == "4":
            run_self_tests()
        elif choice == "0":
            print("Tạm biệt!")
            break
        else:
            print("Lựa chọn không hợp lệ. Vui lòng nhập từ 0 đến 4.")


def main():
    parser = argparse.ArgumentParser(description="ADAS SafeDistance Pro - Master Unified Controller")
    parser.add_argument("--gui", action="store_true", help="Khởi chạy Giao diện Desktop Cockpit HUD")
    parser.add_argument("--mobile", "--server", action="store_true", help="Khởi chạy Máy chủ Di động HTTPS")
    parser.add_argument("--online", "--web", action="store_true", help="Mở Ứng dụng Online trên Trình duyệt")
    parser.add_argument("--test", action="store_true", help="Chạy kiểm thử tự động toàn hệ thống")
    parser.add_argument("--menu", action="store_true", help="Hiện Menu Lựa chọn Hợp nhất")

    args = parser.parse_args()

    if args.gui:
        run_desktop_gui()
    elif args.mobile:
        run_mobile_server()
    elif args.online:
        run_online_browser()
    elif args.test:
        run_self_tests()
    elif args.menu:
        interactive_menu()
    else:
        # Mặc định khởi chạy Desktop GUI
        run_desktop_gui()


if __name__ == "__main__":
    main()

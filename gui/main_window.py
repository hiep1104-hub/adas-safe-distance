# -*- coding: utf-8 -*-
"""
Giao diện Bảng điều khiển ADAS SafeDistance Pro (PyQt5)
Hiển thị Video phân tích theo thời gian thực với AR Overlay, Đồng hồ Telemetry,
Bộ đánh giá Khoảng cách theo Thông tư 38/2024/TT-BGTVT (thay thế TT 31/2019),
Cảnh báo Tốc độ & Trừ điểm GPLX theo Nghị định 168/2024/NĐ-CP,
Cảnh báo Đường cấm xe (P.101, P.102, P.103a, P.106), Giờ cao điểm & Đỗ xe chẵn lẻ (P.131b, P.131c).
Kết nối đồng bộ 1 thể thống nhất với phiên bản di động.
"""
import os
import sys
import time
import csv
import webbrowser
from datetime import datetime
import cv2
import numpy as np

from PyQt5.QtWidgets import (
    QMainWindow, QWidget, QLabel, QPushButton, QVBoxLayout, QHBoxLayout,
    QGridLayout, QSlider, QComboBox, QCheckBox, QGroupBox, QFileDialog,
    QTableWidget, QTableWidgetItem, QHeaderView, QSplitter, QMessageBox,
    QDialog, QTabWidget, QFrame
)
from PyQt5.QtGui import QImage, QPixmap, QFont, QColor
from PyQt5.QtCore import QTimer, Qt

from core.legal_rules import (
    VietnamTrafficLegalStandards, AlertLevel, WeatherCondition, SafetyAssessment,
    VehicleType, SpeedAssessment, RoadSignAssessment
)
from core.detector import VehicleDetector, DetectedVehicle
from core.distance_estimator import MonocularDistanceEstimator
from core.audio_alert import AudioAlertManager
from core.simulation import RoadSimulator
from gui.widgets import HudDistanceBar, StatusBadge


ONLINE_APP_URL = "https://hiep1104-hub.github.io/adas-safe-distance/"


class MobileConnectDialog(QDialog):
    """Hộp thoại mã QR kết nối nhanh điện thoại từ màn hình máy tính"""
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("📱 Kết Nối ADAS SafeDistance Pro Trên Điện Thoại")
        self.setFixedSize(520, 560)
        self.setStyleSheet("""
            QDialog { background-color: #0b111e; color: #f1f5f9; }
            QLabel { color: #cbd5e1; font-family: 'Segoe UI', Arial; }
            QPushButton {
                background: linear-gradient(135deg, #2563eb, #1d4ed8);
                color: white; font-weight: bold; padding: 10px 18px;
                border-radius: 8px; border: none; font-size: 13px;
            }
            QPushButton:hover { background: #3b82f6; }
        """)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 20, 24, 20)
        layout.setSpacing(12)

        title = QLabel("🛡️ Sử Dụng Trực Tiếp Trên Điện Thoại Khi Lái Xe")
        title.setStyleSheet("font-size: 16px; font-weight: bold; color: #38bdf8;")
        title.setAlignment(Qt.AlignCenter)
        layout.addWidget(title)

        sub = QLabel("Quét mã QR dưới đây bằng Camera điện thoại (iPhone / Android)\nđể mở ứng dụng Online rảnh tay 100% không cần cài đặt:")
        sub.setStyleSheet("font-size: 12px; color: #94a3b8;")
        sub.setAlignment(Qt.AlignCenter)
        layout.addWidget(sub)

        # Hiển thị ảnh QR Code
        qr_label = QLabel()
        qr_label.setAlignment(Qt.AlignCenter)
        qr_path = "qr_code_online.png"
        if not os.path.exists(qr_path):
            qr_path = "qr_code_mobile.png"
        if os.path.exists(qr_path):
            pix = QPixmap(qr_path).scaled(220, 220, Qt.KeepAspectRatio, Qt.SmoothTransformation)
            qr_label.setPixmap(pix)
        else:
            qr_label.setText("[Mã QR Online]")
        layout.addWidget(qr_label)

        # Link trực tiếp
        link_box = QLabel(f"🌐 <b>Link Online:</b> <a style='color:#60a5fa;' href='{ONLINE_APP_URL}'>{ONLINE_APP_URL}</a>")
        link_box.setOpenExternalLinks(True)
        link_box.setAlignment(Qt.AlignCenter)
        layout.addWidget(link_box)

        guide = QLabel(
            "✓ Tự động nhận diện khoảng cách xe & tốc độ GPS<br>"
            "✓ Tự động cảnh báo đường cấm & cấm theo giờ cao điểm<br>"
            "✓ Tự động trợ lý đỗ xe ngày chẵn / ngày lẻ theo lịch hôm nay"
        )
        guide.setStyleSheet("background: rgba(255,255,255,0.05); padding: 8px; border-radius: 6px; font-size: 11px;")
        layout.addWidget(guide)

        btn_box = QHBoxLayout()
        btn_open_browser = QPushButton("🌐 Mở Trên Trình Duyệt Máy Tính")
        btn_open_browser.clicked.connect(lambda: webbrowser.open(ONLINE_APP_URL))
        btn_box.addWidget(btn_open_browser)

        btn_close = QPushButton("Đóng")
        btn_close.setStyleSheet("background: #334155;")
        btn_close.clicked.connect(self.accept)
        btn_box.addWidget(btn_close)

        layout.addLayout(btn_box)


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("ADAS SafeDistance Pro — Trợ Lái & Cảnh Báo An Toàn Xe Hơi (TT 38/2024/TT-BGTVT)")
        self.resize(1380, 870)
        self.setMinimumSize(1150, 740)

        # Trạng thái hệ thống cốt lõi
        self.detector = VehicleDetector(model_path="models/yolov8n.onnx")
        self.distance_estimator = MonocularDistanceEstimator()
        self.audio_alert = AudioAlertManager()
        self.simulator = RoadSimulator()

        # Nguồn dữ liệu video
        self.input_source = "simulation"  # "simulation", "camera", "file"
        self.cap = None
        self.video_file_path = "sample_data/dashcam_sample.mp4"
        self.webcam_index = 0

        # Thông số phương tiện & luật giao thông
        self.vehicle_type = VehicleType.CAR
        self.host_speed_kmh = 80.0
        self.speed_limit_kmh = 80.0
        self.weather = WeatherCondition.DRY
        self.active_sim_sign = "CLEAR"  # "CLEAR", "P.101", "P.102", "P.103a", "P.106"

        self.last_assessment: SafetyAssessment = VietnamTrafficLegalStandards.evaluate_safety(
            80.0, 65.0, 0.0, WeatherCondition.DRY
        )
        self.last_speed_assess: SpeedAssessment = VietnamTrafficLegalStandards.evaluate_speed_compliance(80.0, 80.0)
        self.violation_history = []
        self.flash_counter = 0

        # Khởi tạo giao diện
        self._init_theme()
        self._init_ui()

        # Timer vòng lặp xử lý frame (FPS ~30)
        self.timer = QTimer(self)
        self.timer.timeout.connect(self._process_frame)
        self.timer.start(33)

    def _init_theme(self):
        self.setStyleSheet("""
            QMainWindow { background-color: #0a0e17; }
            QWidget { color: #e2e8f0; font-family: 'Segoe UI', Arial, sans-serif; }
            QGroupBox {
                border: 1px solid #1e293b;
                border-radius: 8px;
                margin-top: 14px;
                font-weight: bold;
                font-size: 11px;
                color: #38bdf8;
                padding-top: 14px;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 6px;
            }
            QPushButton {
                background-color: #1d4ed8;
                color: white;
                border: none;
                border-radius: 6px;
                padding: 6px 12px;
                font-weight: bold;
                font-size: 11px;
            }
            QPushButton:hover { background-color: #2563eb; }
            QPushButton:pressed { background-color: #1e40af; }
            QComboBox {
                background-color: #0f172a;
                border: 1px solid #334155;
                border-radius: 5px;
                padding: 4px 8px;
                color: white;
                font-size: 11px;
            }
            QSlider::groove:horizontal { height: 6px; background: #1e293b; border-radius: 3px; }
            QSlider::sub-page:horizontal { background: #3b82f6; border-radius: 3px; }
            QSlider::handle:horizontal {
                background: #93c5fd; border: 1px solid #2563eb;
                width: 16px; margin-top: -5px; margin-bottom: -5px; border-radius: 8px;
            }
            QTableWidget {
                background-color: #0b111e;
                gridline-color: #1e293b;
                border: 1px solid #1e293b;
                border-radius: 6px;
                font-size: 11px;
            }
            QHeaderView::section {
                background-color: #0f172a;
                color: #94a3b8;
                padding: 4px;
                border: none;
                font-weight: bold;
            }
        """)

    def _init_ui(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(12, 8, 12, 8)
        main_layout.setSpacing(8)

        # 1. THANH ĐIỀU HÀNH TRÊN CÙNG (Top Bar)
        top_bar = QHBoxLayout()
        title_box = QVBoxLayout()
        title_label = QLabel("🛡️ ADAS SafeDistance Pro — Hệ Thống Trợ Lái & Cảnh Báo An Toàn Xe Hơi")
        title_label.setStyleSheet("font-size: 17px; font-weight: bold; color: #38bdf8;")
        sub_title = QLabel("Căn cứ: Thông tư 38/2024/TT-BGTVT (thay thế TT 31/2019) • Nghị định 168/2024/NĐ-CP • QCVN 41:2019/BGTVT")
        sub_title.setStyleSheet("font-size: 10px; color: #94a3b8;")
        title_box.addWidget(title_label)
        title_box.addWidget(sub_title)
        top_bar.addLayout(title_box)
        top_bar.addStretch()

        # Nút kết nối điện thoại
        btn_mobile = QPushButton("📱 Kết Nối Điện Thoại (Mã QR)")
        btn_mobile.setStyleSheet("background: linear-gradient(135deg, #059669, #047857); padding: 7px 14px;")
        btn_mobile.clicked.connect(self._show_mobile_dialog)
        top_bar.addWidget(btn_mobile)

        # Nguồn dữ liệu video
        top_bar.addWidget(QLabel("Nguồn:"))
        self.source_combo = QComboBox()
        self.source_combo.addItems([
            "🎮 Mô phỏng Kịch bản (Simulation)",
            "📁 Video Hành Trình (Dashcam File)",
            "📷 Camera Trực Tiếp (Webcam)"
        ])
        self.source_combo.currentIndexChanged.connect(self._on_source_changed)
        top_bar.addWidget(self.source_combo)

        self.btn_open_file = QPushButton("📂 Chọn File...")
        self.btn_open_file.clicked.connect(self._choose_video_file)
        self.btn_open_file.setVisible(False)
        top_bar.addWidget(self.btn_open_file)

        # Loại phương tiện
        top_bar.addWidget(QLabel("Loại xe:"))
        self.veh_combo = QComboBox()
        self.veh_combo.addItems(["🚗 Ô tô con", "🚛 Xe tải"])
        self.veh_combo.currentIndexChanged.connect(self._on_vehicle_type_changed)
        top_bar.addWidget(self.veh_combo)

        # Thời tiết
        top_bar.addWidget(QLabel("Thời tiết:"))
        self.weather_combo = QComboBox()
        self.weather_combo.addItems(["☀️ Mặt đường khô ráo", "🌧️ Mưa trơn trượt (+40%)"])
        self.weather_combo.currentIndexChanged.connect(self._on_weather_changed)
        top_bar.addWidget(self.weather_combo)

        # Checkboxes âm thanh
        self.chk_beep = QCheckBox("Còi bíp")
        self.chk_beep.setChecked(True)
        self.chk_beep.toggled.connect(lambda v: self.audio_alert.set_mute(not v))
        top_bar.addWidget(self.chk_beep)

        self.chk_voice = QCheckBox("Giọng nói")
        self.chk_voice.setChecked(True)
        self.chk_voice.toggled.connect(lambda v: self.audio_alert.set_voice_enabled(v))
        top_bar.addWidget(self.chk_voice)

        main_layout.addLayout(top_bar)

        # 2. KHU VỰC TRUNG TÂM (Splitter chia trái phải)
        content_splitter = QSplitter(Qt.Horizontal)

        # --- BÊN TRÁI: VIDEO VIEWPORT & HUD DISTANCE BAR ---
        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)
        left_layout.setContentsMargins(0, 0, 6, 0)
        left_layout.setSpacing(6)

        # Khung Video
        self.video_label = QLabel()
        self.video_label.setAlignment(Qt.AlignCenter)
        self.video_label.setMinimumSize(660, 440)
        self.video_label.setStyleSheet("background-color: #000; border-radius: 8px; border: 2px solid #1e293b;")
        left_layout.addWidget(self.video_label, stretch=4)

        # Thước đo khoảng cách HudDistanceBar
        self.distance_bar = HudDistanceBar()
        left_layout.addWidget(self.distance_bar, stretch=1)

        content_splitter.addWidget(left_panel)

        # --- BÊN PHẢI: TELEMETRY, TỐC ĐỘ, BIỂN BÁO, ĐỖ XE & GIỜ CAO ĐIỂM ---
        right_panel = QWidget()
        right_layout = QVBoxLayout(right_panel)
        right_layout.setContentsMargins(6, 0, 0, 0)
        right_layout.setSpacing(8)

        # Status Badge lớn nổi bật
        self.status_badge = StatusBadge()
        right_layout.addWidget(self.status_badge)

        # Hộp cảnh báo biển cấm / ngược chiều
        self.forbidden_banner = QLabel("🟢 TUYẾN ĐƯỜNG THÔNG THOÁNG — LƯU THÔNG AN TOÀN")
        self.forbidden_banner.setStyleSheet(
            "background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #34d399; "
            "border-radius: 6px; padding: 6px 10px; font-weight: bold; font-size: 11px;"
        )
        right_layout.addWidget(self.forbidden_banner)

        # Hộp Telemetry & Giới hạn tốc độ
        telemetry_box = QGroupBox("CHỈ SỐ TỐC ĐỘ (P.127) & CỰ LY DI CHUYỂN")
        t_layout = QGridLayout(telemetry_box)
        t_layout.setSpacing(6)

        # Giới hạn tốc độ cho phép (Biển P.127)
        t_layout.addWidget(QLabel("Giới hạn tuyến đường (P.127):"), 0, 0)
        self.speed_limit_combo = QComboBox()
        self.speed_limit_combo.addItems([
            "50 km/h (Đô thị 2 chiều)",
            "60 km/h (Đô thị đường đôi)",
            "80 km/h (Ngoài đô thị 2 chiều)",
            "90 km/h (Ngoài đô thị đường đôi)",
            "100 km/h (Đường Cao Tốc)",
            "120 km/h (Cao Tốc Tối Đa)"
        ])
        self.speed_limit_combo.setCurrentIndex(2)  # 80 km/h
        self.speed_limit_combo.currentIndexChanged.connect(self._on_speed_limit_changed)
        t_layout.addWidget(self.speed_limit_combo, 0, 1)

        # Tốc độ xe chủ
        t_layout.addWidget(QLabel("Vận tốc xe chủ:"), 1, 0)
        self.lbl_speed_val = QLabel("80 km/h")
        self.lbl_speed_val.setStyleSheet("font-size: 15px; font-weight: bold; color: #38bdf8;")
        t_layout.addWidget(self.lbl_speed_val, 1, 1)

        self.speed_slider = QSlider(Qt.Horizontal)
        self.speed_slider.setRange(20, 140)
        self.speed_slider.setValue(80)
        self.speed_slider.valueChanged.connect(self._on_speed_slider_changed)
        t_layout.addWidget(self.speed_slider, 2, 0, 1, 2)

        # Cự ly xe trước & chuẩn luật định
        t_layout.addWidget(QLabel("Khoảng cách xe trước:"), 3, 0)
        self.lbl_actual_dist = QLabel("-- m")
        self.lbl_actual_dist.setStyleSheet("font-size: 17px; font-weight: bold; color: #4ade80;")
        t_layout.addWidget(self.lbl_actual_dist, 3, 1)

        t_layout.addWidget(QLabel("Cự ly tối thiểu (TT 38):"), 4, 0)
        self.lbl_legal_dist = QLabel("55 m")
        self.lbl_legal_dist.setStyleSheet("font-size: 15px; font-weight: bold; color: #facc15;")
        t_layout.addWidget(self.lbl_legal_dist, 4, 1)

        t_layout.addWidget(QLabel("Thời gian va chạm (TTC):"), 5, 0)
        self.lbl_ttc = QLabel("-- s")
        self.lbl_ttc.setStyleSheet("font-size: 15px; font-weight: bold; color: #f472b6;")
        t_layout.addWidget(self.lbl_ttc, 5, 1)

        right_layout.addWidget(telemetry_box)

        # Hộp Trợ lý đỗ xe ngày chẵn lẻ & Giờ cao điểm
        advisor_box = QGroupBox("TRỢ LÝ ĐỖ XE CHẴN LẺ & KHUNG GIỜ CẤM")
        adv_layout = QVBoxLayout(advisor_box)
        adv_layout.setSpacing(4)

        # Đỗ xe chẵn lẻ theo lịch hôm nay
        parking_info = VietnamTrafficLegalStandards.evaluate_parking_rule()
        self.lbl_parking_rule = QLabel(
            f"📅 <b>Hôm nay: Ngày {parking_info['day_of_month']} ({parking_info['day_type']})</b><br>"
            f"• Biển P.131b (1 vạch): {'✅ ĐƯỢC ĐỖ' if parking_info['p131b_allowed'] else '⛔ CẤM ĐỖ BÊN NÀY'}<br>"
            f"• Biển P.131c (2 vạch): {'✅ ĐƯỢC ĐỖ' if parking_info['p131c_allowed'] else '⛔ CẤM ĐỖ BÊN NÀY'}"
        )
        self.lbl_parking_rule.setStyleSheet("font-size: 11px; color: #e2e8f0; line-height: 1.4;")
        adv_layout.addWidget(self.lbl_parking_rule)

        # Giờ cao điểm
        is_peak, peak_desc = VietnamTrafficLegalStandards.check_time_restricted_zone()
        self.lbl_peak_hour = QLabel(f"⏰ Giờ cao điểm cấm xe: <b>{peak_desc}</b>")
        self.lbl_peak_hour.setStyleSheet(
            f"font-size: 10px; color: {'#f87171' if is_peak else '#94a3b8'};"
        )
        adv_layout.addWidget(self.lbl_peak_hour)

        right_layout.addWidget(advisor_box)

        # Hộp Kịch bản kiểm thử tình huống
        scenario_box = QGroupBox("THỬ NGHIỆM TÌNH HUỐNG (TEST SCENARIOS)")
        s_layout = QGridLayout(scenario_box)
        s_layout.setSpacing(5)

        btn_scen1 = QPushButton("⚡ Thử Quá Tốc Độ")
        btn_scen1.clicked.connect(self._trigger_speeding_test)
        s_layout.addWidget(btn_scen1, 0, 0)

        btn_scen2 = QPushButton("⛔ Thử Biển Ngược Chiều (P.102)")
        btn_scen2.setStyleSheet("background-color: #991b1b;")
        btn_scen2.clicked.connect(lambda: self._set_sim_road_sign("P.102"))
        s_layout.addWidget(btn_scen2, 0, 1)

        btn_scen3 = QPushButton("🚫 Thử Cấm Ô Tô (P.103a)")
        btn_scen3.setStyleSheet("background-color: #991b1b;")
        btn_scen3.clicked.connect(lambda: self._set_sim_road_sign("P.103a"))
        s_layout.addWidget(btn_scen3, 1, 0)

        btn_scen4 = QPushButton("🛑 Thử Xe Phanh Gấp (18m)")
        btn_scen4.setStyleSheet("background-color: #b45309;")
        btn_scen4.clicked.connect(self._trigger_braking_test)
        s_layout.addWidget(btn_scen4, 1, 1)

        right_layout.addWidget(scenario_box)

        content_splitter.addWidget(right_panel)
        content_splitter.setStretchFactor(0, 3)
        content_splitter.setStretchFactor(1, 2)
        main_layout.addWidget(content_splitter, stretch=5)

        # 3. BẢNG NHẬT KÝ VI PHẠM & CẢNH BÁO
        bottom_box = QGroupBox("NHẬT KÝ VI PHẠM KHOẢNG CÁCH & TỐC ĐỘ (NGHỊ ĐỊNH 168/2024/NĐ-CP)")
        b_layout = QVBoxLayout(bottom_box)
        b_layout.setContentsMargins(8, 4, 8, 4)

        table_header_layout = QHBoxLayout()
        table_header_layout.addWidget(QLabel("Danh sách sự kiện vi phạm an toàn:"))
        table_header_layout.addStretch()

        btn_export = QPushButton("📥 Xuất CSV Báo Cáo")
        btn_export.clicked.connect(self._export_violation_log)
        table_header_layout.addWidget(btn_export)

        btn_clear = QPushButton("🗑️ Xóa Nhật Ký")
        btn_clear.clicked.connect(self._clear_violation_log)
        table_header_layout.addWidget(btn_clear)
        b_layout.addLayout(table_header_layout)

        self.log_table = QTableWidget()
        self.log_table.setColumnCount(7)
        self.log_table.setHorizontalHeaderLabels([
            "Thời gian", "Vận tốc (km/h)", "Cự ly thực tế (m)", "Luật định (m)",
            "Chênh lệch (m)", "TTC (s)", "Nội dung cảnh báo"
        ])
        self.log_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.log_table.setMaximumHeight(130)
        b_layout.addWidget(self.log_table)

        main_layout.addWidget(bottom_box, stretch=2)

    def _show_mobile_dialog(self):
        dlg = MobileConnectDialog(self)
        dlg.exec_()

    def _on_source_changed(self, idx):
        if self.cap is not None:
            self.cap.release()
            self.cap = None

        if idx == 0:
            self.input_source = "simulation"
            self.btn_open_file.setVisible(False)
        elif idx == 1:
            self.input_source = "file"
            self.btn_open_file.setVisible(True)
            self._load_video_file(self.video_file_path)
        elif idx == 2:
            self.input_source = "camera"
            self.btn_open_file.setVisible(False)
            self._load_webcam()

    def _on_vehicle_type_changed(self, idx):
        self.vehicle_type = VehicleType.CAR if idx == 0 else VehicleType.TRUCK
        v_name = "Ô tô con" if idx == 0 else "Xe tải"
        self.audio_alert.speak(f"Đã chọn phương tiện {v_name}")

    def _choose_video_file(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self, "Chọn Video Hành Trình", "", "Video Files (*.mp4 *.avi *.mov *.mkv);;All Files (*)"
        )
        if file_path:
            self.video_file_path = file_path
            self._load_video_file(file_path)

    def _load_video_file(self, path: str):
        if not os.path.exists(path):
            QMessageBox.warning(self, "Không tìm thấy file", f"Không tìm thấy video: {path}")
            return
        if self.cap is not None:
            self.cap.release()
        self.cap = cv2.VideoCapture(path)
        self.distance_estimator.reset_tracker()

    def _load_webcam(self):
        if self.cap is not None:
            self.cap.release()
        self.cap = cv2.VideoCapture(self.webcam_index)
        self.distance_estimator.reset_tracker()

    def _on_weather_changed(self, idx):
        self.weather = WeatherCondition.WET_RAIN if idx == 1 else WeatherCondition.DRY
        self.simulator.weather = "wet" if idx == 1 else "dry"

    def _on_speed_slider_changed(self, val):
        self.host_speed_kmh = float(val)
        self.lbl_speed_val.setText(f"{val} km/h")
        self.simulator.host_speed_kmh = float(val)

    def _on_speed_limit_changed(self, idx):
        limits = [50.0, 60.0, 80.0, 90.0, 100.0, 120.0]
        self.speed_limit_kmh = limits[idx]
        self.audio_alert.speak(f"Giới hạn tốc độ {int(self.speed_limit_kmh)} ki lô mét một giờ")

    def _set_sim_road_sign(self, sign_code: str):
        self.active_sim_sign = sign_code
        assess = VietnamTrafficLegalStandards.evaluate_road_sign(sign_code, self.vehicle_type)
        if assess.is_prohibited:
            self.forbidden_banner.setText(f"⛔ NGUY HIỂM: {assess.sign_name.upper()} ({assess.sign_code}) — {assess.action_advice}")
            self.forbidden_banner.setStyleSheet(
                "background: rgba(220, 38, 38, 0.9); border: 2px solid #ef4444; color: #ffffff; "
                "border-radius: 6px; padding: 6px 10px; font-weight: bold; font-size: 11px;"
            )
            self.audio_alert.speak(f"Nguy hiểm! Phía trước có {assess.sign_name}, không được đi vào!")
        else:
            self.forbidden_banner.setText("🟢 TUYẾN ĐƯỜNG THÔNG THOÁNG — LƯU THÔNG AN TOÀN")
            self.forbidden_banner.setStyleSheet(
                "background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #34d399; "
                "border-radius: 6px; padding: 6px 10px; font-weight: bold; font-size: 11px;"
            )

    def _trigger_speeding_test(self):
        new_speed = self.speed_limit_kmh + 16.0
        self.speed_slider.setValue(int(new_speed))
        self.audio_alert.speak(f"Cảnh báo quá tốc độ giới hạn! Vận tốc {int(new_speed)}")

    def _trigger_braking_test(self):
        self.source_combo.setCurrentIndex(0)
        self.simulator.scenario_mode = "emergency_braking"
        self.speed_slider.setValue(85)
        self.audio_alert.speak("Nguy hiểm! Xe trước phanh gấp! Đề nghị giảm tốc độ ngay!")

    def _process_frame(self):
        frame = None
        lead_vehicle = None
        raw_box = None

        if self.input_source == "simulation":
            self.simulator.update_scenario()
            self.host_speed_kmh = self.simulator.host_speed_kmh
            self.lbl_speed_val.setText(f"{int(self.host_speed_kmh)} km/h")
            self.speed_slider.blockSignals(True)
            self.speed_slider.setValue(int(self.host_speed_kmh))
            self.speed_slider.blockSignals(False)

            frame, raw_box = self.simulator.render_frame()

        elif self.input_source in ["file", "camera"]:
            if self.cap is None or not self.cap.isOpened():
                if self.input_source == "file" and os.path.exists(self.video_file_path):
                    self._load_video_file(self.video_file_path)
                else:
                    return

            ret, frame = self.cap.read()
            if not ret:
                if self.input_source == "file":
                    self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    ret, frame = self.cap.read()
                if not ret or frame is None:
                    return

        if frame is None:
            return

        h, w = frame.shape[:2]

        # 1. Nhận diện xe
        if self.input_source == "simulation" and raw_box:
            bx1, by1, bx2, by2 = raw_box
            lead_vehicle = DetectedVehicle(
                box=raw_box,
                class_id=2,
                class_name="Ô tô con",
                confidence=0.95,
                real_width_m=1.85,
                real_height_m=1.50,
                is_lead_vehicle=True
            )
            all_vehicles = [lead_vehicle]
        else:
            all_vehicles = self.detector.detect(frame)
            lead_vehicle = self.detector.select_lead_vehicle(all_vehicles, w, h)

        # 2. Ước tính khoảng cách
        actual_distance = 60.0
        v_rel_kmh = 0.0

        if lead_vehicle:
            if self.input_source == "simulation":
                actual_distance = self.simulator.lead_distance_m
                lead_vehicle.distance_m = actual_distance
                v_rel_kmh = (self.host_speed_kmh - self.simulator.lead_speed_kmh) if not self.simulator.is_braking else 22.0
            else:
                filtered_d, raw_d, v_approach = self.distance_estimator.estimate_distance(
                    lead_vehicle.box, lead_vehicle.real_width_m, w, h
                )
                actual_distance = filtered_d
                lead_vehicle.distance_m = filtered_d
                v_rel_kmh = v_approach

        # 3. Đánh giá an toàn khoảng cách & Tốc độ
        assessment = VietnamTrafficLegalStandards.evaluate_safety(
            self.host_speed_kmh, actual_distance, v_rel_kmh, self.weather
        )
        self.last_assessment = assessment

        speed_assess = VietnamTrafficLegalStandards.evaluate_speed_compliance(
            self.host_speed_kmh, self.speed_limit_kmh
        )
        self.last_speed_assess = speed_assess

        # 4. Phát tín hiệu âm thanh cảnh báo
        if speed_assess.is_overspeeding and (self.flash_counter % 90 == 0):
            self.audio_alert.speak(speed_assess.warning_text)

        self.audio_alert.set_alert_level(
            assessment.alert_level, assessment.lead_distance_m, assessment.min_legal_distance_m
        )

        # 5. Ghi nhật ký nếu vi phạm an toàn hoặc tốc độ
        if assessment.alert_level in [AlertLevel.WARNING, AlertLevel.CRITICAL] or speed_assess.is_overspeeding:
            self._log_violation_event(assessment, speed_assess)

        # 6. Vẽ AR HUD Overlay trên khung hình video
        display_frame = self._draw_hud_overlay(frame, all_vehicles, lead_vehicle, assessment, speed_assess)

        # 7. Cập nhật giao diện widgets
        self._update_ui_displays(assessment, speed_assess)

        # Chuyển đổi và hiển thị lên QLabel
        rgb_frame = cv2.cvtColor(display_frame, cv2.COLOR_BGR2RGB)
        qimg = QImage(rgb_frame.data, w, h, 3 * w, QImage.Format_RGB888)
        pixmap = QPixmap.fromImage(qimg)
        self.video_label.setPixmap(pixmap.scaled(self.video_label.size(), Qt.KeepAspectRatio, Qt.SmoothTransformation))

    def _draw_hud_overlay(self, frame: np.ndarray, vehicles, lead_vehicle,
                          assessment: SafetyAssessment, speed_assess: SpeedAssessment) -> np.ndarray:
        out = frame.copy()
        h, w = out.shape[:2]

        # Màu sắc chủ đạo theo mức cảnh báo
        if assessment.alert_level == AlertLevel.CRITICAL or speed_assess.is_overspeeding:
            hud_color = (40, 40, 255)       # Đỏ BGR
            path_color = (30, 30, 240)
            tag_bg = (30, 20, 180)
        elif assessment.alert_level == AlertLevel.WARNING:
            hud_color = (20, 180, 255)      # Vàng/Cam BGR
            path_color = (15, 150, 230)
            tag_bg = (20, 120, 180)
        else:
            hud_color = (60, 220, 90)       # Xanh lá BGR
            path_color = (40, 180, 70)
            tag_bg = (20, 120, 50)

        # 1. Vẽ dải hành lang làn đường an toàn
        horizon_y = int(h * 0.48)
        vanish_x = w // 2
        path_overlay = out.copy()
        pts = np.array([
            [vanish_x - 18, horizon_y],
            [vanish_x + 18, horizon_y],
            [w // 2 + int(w * 0.22), h],
            [w // 2 - int(w * 0.22), h]
        ], np.int32)
        cv2.fillPoly(path_overlay, [pts], path_color)
        cv2.addWeighted(path_overlay, 0.25, out, 0.75, 0, out)

        # 2. Vẽ Biển Báo Tốc Độ P.127 chuẩn viền đỏ ở góc trên bên phải
        sign_center = (w - 45, 45)
        sign_radius = 32
        cv2.circle(out, sign_center, sign_radius, (255, 255, 255), -1)
        sign_border_color = (0, 0, 255) if not speed_assess.is_overspeeding else (0, 0, 255)
        cv2.circle(out, sign_center, sign_radius, sign_border_color, 5)
        limit_text = str(int(speed_assess.speed_limit_kmh))
        text_size = cv2.getTextSize(limit_text, cv2.FONT_HERSHEY_SIMPLEX, 0.75, 2)[0]
        cv2.putText(out, limit_text,
                    (sign_center[0] - text_size[0] // 2, sign_center[1] + text_size[1] // 2),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 0, 0), 2)

        # 3. Vẽ Bounding box các xe
        for v in vehicles:
            x1, y1, x2, y2 = v.box
            is_lead = (lead_vehicle is not None and v == lead_vehicle)
            box_color = hud_color if is_lead else (180, 180, 180)
            thickness = 3 if is_lead else 1

            corner_len = min(20, (x2 - x1) // 4)
            cv2.line(out, (x1, y1), (x1 + corner_len, y1), box_color, thickness)
            cv2.line(out, (x1, y1), (x1, y1 + corner_len), box_color, thickness)
            cv2.line(out, (x2, y1), (x2 - corner_len, y1), box_color, thickness)
            cv2.line(out, (x2, y1), (x2, y1 + corner_len), box_color, thickness)
            cv2.line(out, (x1, y2), (x1 + corner_len, y2), box_color, thickness)
            cv2.line(out, (x1, y2), (x1, y2 - corner_len), box_color, thickness)
            cv2.line(out, (x2, y2), (x2 - corner_len, y2), box_color, thickness)
            cv2.line(out, (x2, y2), (x2, y2 - corner_len), box_color, thickness)

            if is_lead:
                tag_w = 270
                tag_h = 44
                tag_x1 = max(10, min(w - tag_w - 10, (x1 + x2) // 2 - tag_w // 2))
                tag_y1 = max(10, y1 - tag_h - 10)
                tag_x2 = tag_x1 + tag_w
                tag_y2 = tag_y1 + tag_h

                tag_roi = out[tag_y1:tag_y2, tag_x1:tag_x2]
                tag_bg_rect = np.full_like(tag_roi, tag_bg)
                cv2.addWeighted(tag_bg_rect, 0.85, tag_roi, 0.15, 0, tag_roi)
                cv2.rectangle(out, (tag_x1, tag_y1), (tag_x2, tag_y2), hud_color, 2)

                line1 = f"CỰ LY: {assessment.lead_distance_m:.1f}m (Chuẩn: {assessment.min_legal_distance_m:.0f}m)"
                cv2.putText(out, line1, (tag_x1 + 8, tag_y1 + 18), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (255, 255, 255), 2)

                state_str = "AN TOAN" if assessment.alert_level == AlertLevel.SAFE else (
                    "CANH BAO" if assessment.alert_level == AlertLevel.WARNING else "NGUY HIEM"
                )
                line2 = f"[{state_str}] TTC: {assessment.ttc_seconds:.1f}s | TT 38/2024"
                cv2.putText(out, line2, (tag_x1 + 8, tag_y1 + 36), cv2.FONT_HERSHEY_SIMPLEX, 0.44, (240, 240, 240), 1)
                cv2.line(out, ((tag_x1 + tag_x2) // 2, tag_y2), ((x1 + x2) // 2, y1), hud_color, 1)

        # 4. Viền cảnh báo đỏ nhấp nháy khi nguy hiểm hoặc quá tốc độ
        if assessment.alert_level == AlertLevel.CRITICAL or speed_assess.is_overspeeding:
            self.flash_counter += 1
            if (self.flash_counter // 4) % 2 == 0:
                cv2.rectangle(out, (0, 0), (w - 1, h - 1), (0, 0, 255), 8)
                msg = "CANH BAO QUA TOC DO!" if speed_assess.is_overspeeding else "NGUY HIEM: BAM DUOI QUA GAN!"
                cv2.putText(out, msg, (w // 2 - 220, 42), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 0, 255), 2)

        # Watermark
        cv2.putText(out, "ADAS SafeDistance Pro - TT 38/2024 & ND 168/2024", (15, h - 15),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (160, 160, 160), 1)

        return out

    def _update_ui_displays(self, assessment: SafetyAssessment, speed_assess: SpeedAssessment):
        self.status_badge.update_status(assessment)
        self.distance_bar.update_distances(
            assessment.lead_distance_m, assessment.min_legal_distance_m, assessment.alert_level
        )

        self.lbl_actual_dist.setText(f"{assessment.lead_distance_m:.1f} m")
        if assessment.alert_level == AlertLevel.CRITICAL:
            self.lbl_actual_dist.setStyleSheet("font-size: 20px; font-weight: bold; color: #fc8181;")
        elif assessment.alert_level == AlertLevel.WARNING:
            self.lbl_actual_dist.setStyleSheet("font-size: 20px; font-weight: bold; color: #f6ad55;")
        else:
            self.lbl_actual_dist.setStyleSheet("font-size: 20px; font-weight: bold; color: #4ade80;")

        self.lbl_legal_dist.setText(f"{assessment.min_legal_distance_m:.0f} m")
        self.lbl_ttc.setText(f"{assessment.ttc_seconds:.1f} s")

    def _log_violation_event(self, assessment: SafetyAssessment, speed_assess: SpeedAssessment):
        now_ts = time.time()
        if hasattr(self, "_last_log_time") and (now_ts - self._last_log_time < 2.5):
            return
        self._last_log_time = now_ts

        time_str = datetime.now().strftime("%H:%M:%S")
        diff = assessment.lead_distance_m - assessment.min_legal_distance_m

        if speed_assess.is_overspeeding:
            level_str = f"QUÁ TỐC ĐỘ (+{speed_assess.excess_kmh:.0f} km/h)"
            desc = f"{speed_assess.penalty_fine_desc} | Trừ {speed_assess.license_points_deducted} điểm GPLX"
        elif assessment.alert_level == AlertLevel.CRITICAL:
            level_str = "NGUY HIỂM"
            desc = f"Bám đuôi cực gần ({assessment.lead_distance_m:.1f}m < {assessment.min_legal_distance_m:.0f}m)"
        else:
            level_str = "CẢNH BÁO"
            desc = f"Dưới cự ly luật định ({assessment.lead_distance_m:.1f}m)"

        record = {
            "time": time_str,
            "speed": f"{assessment.vehicle_speed_kmh:.1f}",
            "actual_dist": f"{assessment.lead_distance_m:.1f}",
            "legal_dist": f"{assessment.min_legal_distance_m:.0f}",
            "diff": f"{diff:.1f}",
            "ttc": f"{assessment.ttc_seconds:.1f}",
            "level": level_str,
            "desc": desc
        }
        self.violation_history.append(record)

        row = self.log_table.rowCount()
        self.log_table.insertRow(row)

        items = [
            record["time"], record["speed"], record["actual_dist"],
            record["legal_dist"], record["diff"], record["ttc"], record["level"] + " — " + record["desc"]
        ]
        for col, val in enumerate(items):
            item = QTableWidgetItem(val)
            item.setTextAlignment(Qt.AlignCenter if col < 6 else Qt.AlignLeft | Qt.AlignVCenter)
            if col == 6:
                item.setForeground(QColor(255, 80, 80) if "NGUY HIỂM" in level_str or "TỐC ĐỘ" in level_str else QColor(255, 180, 40))
            self.log_table.setItem(row, col, item)

        self.log_table.scrollToBottom()

    def _export_violation_log(self):
        if not self.violation_history:
            QMessageBox.information(self, "Thông báo", "Chưa có sự kiện vi phạm nào được ghi lại.")
            return

        file_path, _ = QFileDialog.getSaveFileName(
            self, "Xuất Báo Cáo Vi Phạm An Toàn", "Nhat_ky_canh_bao_khoang_cach.csv", "CSV Files (*.csv)"
        )
        if file_path:
            try:
                with open(file_path, "w", newline="", encoding="utf-8-sig") as f:
                    writer = csv.DictWriter(f, fieldnames=[
                        "time", "speed", "actual_dist", "legal_dist", "diff", "ttc", "level", "desc"
                    ])
                    writer.writeheader()
                    for r in self.violation_history:
                        writer.writerow(r)
                QMessageBox.information(self, "Thành công", f"Đã xuất báo cáo thành công ra file:\n{file_path}")
            except Exception as e:
                QMessageBox.critical(self, "Lỗi", f"Không thể lưu file: {e}")

    def _clear_violation_log(self):
        self.violation_history.clear()
        self.log_table.setRowCount(0)

    def closeEvent(self, event):
        self.timer.stop()
        if self.cap is not None:
            self.cap.release()
        self.audio_alert.stop()
        event.accept()

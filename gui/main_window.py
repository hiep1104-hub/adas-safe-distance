# -*- coding: utf-8 -*-
"""
Giao diện Bảng điều khiển ADAS SafeDistance Pro (PyQt5)
Hiển thị Video phân tích theo thời gian thực với AR Overlay, Đồng hồ Telemetry,
Bộ đánh giá Khoảng cách theo Thông tư 31/2019/TT-BGTVT và Tín hiệu Cảnh báo đa phương tiện.
"""
import os
import sys
import time
import csv
from datetime import datetime
import cv2
import numpy as np

from PyQt5.QtWidgets import (
    QMainWindow, QWidget, QLabel, QPushButton, QVBoxLayout, QHBoxLayout,
    QGridLayout, QSlider, QComboBox, QCheckBox, QGroupBox, QFileDialog,
    QTableWidget, QTableWidgetItem, QHeaderView, QSplitter, QMessageBox, QFrame
)
from PyQt5.QtGui import QImage, QPixmap, QFont, QColor
from PyQt5.QtCore import QTimer, Qt

from core.legal_rules import (
    VietnamTrafficLegalStandards, AlertLevel, WeatherCondition, SafetyAssessment
)
from core.detector import VehicleDetector, DetectedVehicle
from core.distance_estimator import MonocularDistanceEstimator
from core.audio_alert import AudioAlertManager
from core.simulation import RoadSimulator
from gui.widgets import HudDistanceBar, StatusBadge


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("ADAS SafeDistance Pro - Đo Khoảng Cách & Cảnh Báo An Toàn Xe Hơi (TT 31/2019/TT-BGTVT)")
        self.resize(1340, 840)
        self.setMinimumSize(1100, 720)

        # Trạng thái hệ thống
        self.detector = VehicleDetector(model_path="models/yolov8n.onnx")
        self.distance_estimator = MonocularDistanceEstimator()
        self.audio_alert = AudioAlertManager()
        self.simulator = RoadSimulator()

        # Nguồn video
        self.input_source = "simulation"  # "simulation", "camera", "file"
        self.cap = None
        self.video_file_path = "sample_data/dashcam_sample.mp4"
        self.webcam_index = 0

        # Thông số xe
        self.host_speed_kmh = 80.0
        self.weather = WeatherCondition.DRY
        self.last_assessment: SafetyAssessment = VietnamTrafficLegalStandards.evaluate_safety(
            80.0, 65.0, 0.0, WeatherCondition.DRY
        )
        self.violation_history = []

        # Hiệu ứng chớp cảnh báo
        self.flash_counter = 0

        # Khởi tạo giao diện
        self._init_theme()
        self._init_ui()

        # Timer vòng lặp xử lý frame (FPS ~25-30)
        self.timer = QTimer(self)
        self.timer.timeout.connect(self._process_frame)
        self.timer.start(33)  # ~30 FPS

    def _init_theme(self):
        self.setStyleSheet("""
            QMainWindow {
                background-color: #0f141c;
            }
            QWidget {
                color: #e2e8f0;
                font-family: 'Segoe UI', Arial, sans-serif;
            }
            QGroupBox {
                border: 1px solid #2d3748;
                border-radius: 8px;
                margin-top: 14px;
                font-weight: bold;
                font-size: 12px;
                color: #63b3ed;
                padding-top: 15px;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 12px;
                padding: 0 5px;
            }
            QPushButton {
                background-color: #2b6cb0;
                color: white;
                border: none;
                border-radius: 6px;
                padding: 7px 14px;
                font-weight: bold;
                font-size: 11px;
            }
            QPushButton:hover {
                background-color: #3182ce;
            }
            QPushButton:pressed {
                background-color: #2c5282;
            }
            QComboBox {
                background-color: #1a202c;
                border: 1px solid #4a5568;
                border-radius: 5px;
                padding: 5px 10px;
                color: white;
            }
            QSlider::groove:horizontal {
                height: 6px;
                background: #2d3748;
                border-radius: 3px;
            }
            QSlider::sub-page:horizontal {
                background: #4299e1;
                border-radius: 3px;
            }
            QSlider::handle:horizontal {
                background: #bee3f8;
                border: 1px solid #3182ce;
                width: 16px;
                margin-top: -5px;
                margin-bottom: -5px;
                border-radius: 8px;
            }
            QTableWidget {
                background-color: #131924;
                gridline-color: #232c3d;
                border: 1px solid #2d3748;
                border-radius: 6px;
                font-size: 11px;
            }
            QHeaderView::section {
                background-color: #1a2233;
                color: #a0aec0;
                padding: 4px;
                border: none;
                font-weight: bold;
            }
        """)

    def _init_ui(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(14, 10, 14, 10)
        main_layout.setSpacing(10)

        # 1. THANH TIÊU ĐỀ & ĐIỀU HÀNH NHANH (Top Bar)
        top_bar = QHBoxLayout()
        title_box = QVBoxLayout()
        title_label = QLabel("🛡️ ADAS SafeDistance Pro — Hệ Thống Giám Sát & Cảnh Báo Khoảng Cách Xe")
        title_label.setStyleSheet("font-size: 18px; font-weight: bold; color: #63b3ed;")
        sub_title = QLabel("Căn cứ Pháp lý: Thông tư số 31/2019/TT-BGTVT & Luật Trật tự, An toàn Giao thông Đường bộ 2024")
        sub_title.setStyleSheet("font-size: 11px; color: #a0aec0;")
        title_box.addWidget(title_label)
        title_box.addWidget(sub_title)
        top_bar.addLayout(title_box)
        top_bar.addStretch()

        # Nút chuyển nguồn video
        top_bar.addWidget(QLabel("Nguồn dữ liệu:"))
        self.source_combo = QComboBox()
        self.source_combo.addItems([
            "🎮 Mô phỏng Kịch bản Cao tốc (Simulation)",
            "📁 Tập tin Video Hành Trình (Dashcam File)",
            "📷 Camera Trực Tiếp (Webcam/USB Dashcam)"
        ])
        self.source_combo.currentIndexChanged.connect(self._on_source_changed)
        top_bar.addWidget(self.source_combo)

        self.btn_open_file = QPushButton("📂 Chọn Video...")
        self.btn_open_file.clicked.connect(self._choose_video_file)
        self.btn_open_file.setVisible(False)
        top_bar.addWidget(self.btn_open_file)

        # Nút thời tiết
        top_bar.addWidget(QLabel("Thời tiết:"))
        self.weather_combo = QComboBox()
        self.weather_combo.addItems(["☀️ Mặt đường khô ráo", "🌧️ Trời mưa / Trơn trượt (+40% cự ly)"])
        self.weather_combo.currentIndexChanged.connect(self._on_weather_changed)
        top_bar.addWidget(self.weather_combo)

        # Checkbox âm thanh
        self.chk_beep = QCheckBox("Tiếng bíp cảnh báo")
        self.chk_beep.setChecked(True)
        self.chk_beep.toggled.connect(lambda v: self.audio_alert.set_mute(not v))
        top_bar.addWidget(self.chk_beep)

        self.chk_voice = QCheckBox("Giọng nói tiếng Việt")
        self.chk_voice.setChecked(True)
        self.chk_voice.toggled.connect(lambda v: self.audio_alert.set_voice_enabled(v))
        top_bar.addWidget(self.chk_voice)

        main_layout.addLayout(top_bar)

        # 2. KHU VỰC TRUNG TÂM (Splitter chia trái phải)
        content_splitter = QSplitter(Qt.Horizontal)

        # --- BÊN TRÁI: VIDEO VIEWPORT & HUD DISTANCE BAR ---
        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)
        left_layout.setContentsMargins(0, 0, 8, 0)
        left_layout.setSpacing(8)

        # Màn hình Video
        self.video_label = QLabel()
        self.video_label.setAlignment(Qt.AlignCenter)
        self.video_label.setMinimumSize(640, 420)
        self.video_label.setStyleSheet("background-color: #000; border-radius: 8px; border: 2px solid #232c3d;")
        left_layout.addWidget(self.video_label, stretch=4)

        # Thước đo khoảng cách trực quan HudDistanceBar
        self.distance_bar = HudDistanceBar()
        left_layout.addWidget(self.distance_bar, stretch=1)

        content_splitter.addWidget(left_panel)

        # --- BÊN PHẢI: TELEMETRY, KỊCH BẢN, VÀ THÔNG SỐ LUẬT ĐỊNH ---
        right_panel = QWidget()
        right_layout = QVBoxLayout(right_panel)
        right_layout.setContentsMargins(8, 0, 0, 0)
        right_layout.setSpacing(10)

        # Badge trạng thái lớn nổi bật
        self.status_badge = StatusBadge()
        right_layout.addWidget(self.status_badge)

        # Hộp đo lường Telemetry
        telemetry_box = QGroupBox("CHỈ SỐ DI CHUYỂN & AN TOÀN")
        t_layout = QGridLayout(telemetry_box)
        t_layout.setSpacing(8)

        # Tốc độ xe chủ (có slider điều chỉnh)
        t_layout.addWidget(QLabel("Vận tốc xe chủ (km/h):"), 0, 0)
        self.lbl_speed_val = QLabel("80 km/h")
        self.lbl_speed_val.setStyleSheet("font-size: 16px; font-weight: bold; color: #4fd1c5;")
        t_layout.addWidget(self.lbl_speed_val, 0, 1)

        self.speed_slider = QSlider(Qt.Horizontal)
        self.speed_slider.setRange(20, 140)
        self.speed_slider.setValue(80)
        self.speed_slider.valueChanged.connect(self._on_speed_slider_changed)
        t_layout.addWidget(self.speed_slider, 1, 0, 1, 2)

        # Khoảng cách thực tế
        t_layout.addWidget(QLabel("Khoảng cách tới xe trước:"), 2, 0)
        self.lbl_actual_dist = QLabel("-- m")
        self.lbl_actual_dist.setStyleSheet("font-size: 20px; font-weight: bold; color: #68d391;")
        t_layout.addWidget(self.lbl_actual_dist, 2, 1)

        # Khoảng cách tối thiểu theo luật
        t_layout.addWidget(QLabel("Khoảng cách tối thiểu luật định:"), 3, 0)
        self.lbl_legal_dist = QLabel("55 m")
        self.lbl_legal_dist.setStyleSheet("font-size: 16px; font-weight: bold; color: #ecc94b;")
        t_layout.addWidget(self.lbl_legal_dist, 3, 1)

        # Vận tốc tiếp cận & TTC
        t_layout.addWidget(QLabel("Vận tốc tiếp cận tương đối:"), 4, 0)
        self.lbl_rel_speed = QLabel("0 km/h")
        self.lbl_rel_speed.setStyleSheet("font-weight: bold;")
        t_layout.addWidget(self.lbl_rel_speed, 4, 1)

        t_layout.addWidget(QLabel("Thời gian va chạm (TTC):"), 5, 0)
        self.lbl_ttc = QLabel("-- s")
        self.lbl_ttc.setStyleSheet("font-size: 16px; font-weight: bold; color: #f687b3;")
        t_layout.addWidget(self.lbl_ttc, 5, 1)

        right_layout.addWidget(telemetry_box)

        # Hộp kịch bản kiểm thử tình huống
        scenario_box = QGroupBox("KỊCH BẢN KIỂM THỬ THỰC TẾ (DEMO SCENARIOS)")
        s_layout = QGridLayout(scenario_box)
        s_layout.setSpacing(6)

        btn_scen1 = QPushButton("1. Cao tốc 100 km/h (Đạt chuẩn 75m)")
        btn_scen1.clicked.connect(lambda: self._select_preset_scenario("highway_safe"))
        s_layout.addWidget(btn_scen1, 0, 0)

        btn_scen2 = QPushButton("2. Bám đuôi gần 80 km/h (Cảnh báo 42m)")
        btn_scen2.clicked.connect(lambda: self._select_preset_scenario("tailgating_warning"))
        s_layout.addWidget(btn_scen2, 0, 1)

        btn_scen3 = QPushButton("⚠️ 3. Xe trước Phanh Gấp (Nguy hiểm 18m)")
        btn_scen3.setStyleSheet("background-color: #c53030; color: white;")
        btn_scen3.clicked.connect(lambda: self._select_preset_scenario("emergency_braking"))
        s_layout.addWidget(btn_scen3, 1, 0)

        btn_scen4 = QPushButton("🌧️ 4. Đường Mưa Trơn Trượt 65 km/h")
        btn_scen4.setStyleSheet("background-color: #2c5282; color: white;")
        btn_scen4.clicked.connect(lambda: self._select_preset_scenario("rain_caution"))
        s_layout.addWidget(btn_scen4, 1, 1)

        right_layout.addWidget(scenario_box)

        # Hộp Bảng tham chiếu pháp luật Thông tư 31/2019
        legal_ref_box = QGroupBox("BẢNG QUY ĐỊNH KHOẢNG CÁCH (THÔNG TƯ 31/2019/TT-BGTVT)")
        l_layout = QVBoxLayout(legal_ref_box)
        table_summary = QLabel(
            "• V ≤ 60 km/h: Chủ động giữ khoảng cách phù hợp (quy tắc 2-3s: ~35m)\n"
            "• 60 < V ≤ 80 km/h: Tối thiểu 55 mét\n"
            "• 80 < V ≤ 100 km/h: Tối thiểu 70 mét\n"
            "• 100 < V ≤ 120 km/h: Tối thiểu 100 mét\n"
            "• Trời mưa/sương mù/đường trơn: Điều chỉnh cự ly lớn hơn (+40%)"
        )
        table_summary.setStyleSheet("font-size: 11px; color: #cbd5e0; line-height: 1.4;")
        l_layout.addWidget(table_summary)
        right_layout.addWidget(legal_ref_box)

        content_splitter.addWidget(right_panel)
        content_splitter.setStretchFactor(0, 3)
        content_splitter.setStretchFactor(1, 2)
        main_layout.addWidget(content_splitter, stretch=5)

        # 3. BẢNG NHẬT KÝ CẢNH BÁO & VI PHẠM (Bottom Log)
        bottom_box = QGroupBox("NHẬT KÝ VI PHẠM KHOẢNG CÁCH AN TOÀN")
        b_layout = QVBoxLayout(bottom_box)
        b_layout.setContentsMargins(8, 6, 8, 6)

        table_header_layout = QHBoxLayout()
        table_header_layout.addWidget(QLabel("Danh sách các sự kiện vi phạm dưới mức an toàn luật định:"))
        table_header_layout.addStretch()

        btn_export = QPushButton("📥 Xuất Báo Cáo CSV")
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
            "Chênh lệch (m)", "TTC (s)", "Mức cảnh báo"
        ])
        self.log_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.log_table.setMaximumHeight(140)
        b_layout.addWidget(self.log_table)

        main_layout.addWidget(bottom_box, stretch=2)

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

    def _select_preset_scenario(self, scenario_name: str):
        self.source_combo.setCurrentIndex(0)
        self.simulator.scenario_mode = scenario_name
        if scenario_name == "highway_safe":
            self.speed_slider.setValue(100)
            self.weather_combo.setCurrentIndex(0)
        elif scenario_name == "tailgating_warning":
            self.speed_slider.setValue(80)
            self.weather_combo.setCurrentIndex(0)
        elif scenario_name == "emergency_braking":
            self.speed_slider.setValue(85)
            self.weather_combo.setCurrentIndex(0)
        elif scenario_name == "rain_caution":
            self.speed_slider.setValue(65)
            self.weather_combo.setCurrentIndex(1)

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
                # Video lặp lại từ đầu
                if self.input_source == "file":
                    self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    ret, frame = self.cap.read()
                if not ret or frame is None:
                    return

        if frame is None:
            return

        h, w = frame.shape[:2]

        # 1. Nhận diện xe
        # Trong chế độ simulation, xe luôn có tọa độ chính xác từ mô phỏng vật lý
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

        # 3. Đánh giá an toàn theo quy định pháp luật
        assessment = VietnamTrafficLegalStandards.evaluate_safety(
            self.host_speed_kmh, actual_distance, v_rel_kmh, self.weather
        )
        self.last_assessment = assessment

        # 4. Phát tín hiệu âm thanh cảnh báo
        self.audio_alert.set_alert_level(
            assessment.alert_level, assessment.lead_distance_m, assessment.min_legal_distance_m
        )

        # 5. Ghi nhật ký nếu vi phạm an toàn
        if assessment.alert_level in [AlertLevel.WARNING, AlertLevel.CRITICAL]:
            self._log_violation_event(assessment)

        # 6. Vẽ AR HUD Overlay trên khung hình video
        display_frame = self._draw_hud_overlay(frame, all_vehicles, lead_vehicle, assessment)

        # 7. Cập nhật giao diện widgets
        self._update_ui_displays(assessment)

        # Chuyển đổi và hiển thị lên QLabel
        rgb_frame = cv2.cvtColor(display_frame, cv2.COLOR_BGR2RGB)
        qimg = QImage(rgb_frame.data, w, h, 3 * w, QImage.Format_RGB888)
        pixmap = QPixmap.fromImage(qimg)
        self.video_label.setPixmap(pixmap.scaled(self.video_label.size(), Qt.KeepAspectRatio, Qt.SmoothTransformation))

    def _draw_hud_overlay(self, frame: np.ndarray, vehicles, lead_vehicle, assessment: SafetyAssessment) -> np.ndarray:
        out = frame.copy()
        h, w = out.shape[:2]

        # Màu sắc chủ đạo theo mức cảnh báo
        if assessment.alert_level == AlertLevel.CRITICAL:
            hud_color = (40, 40, 255)       # Đỏ rực BGR
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

        # 1. Vẽ dải hành lang làn đường an toàn (Dynamic AR Safe Path)
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

        # 2. Vẽ Bounding box các xe
        for v in vehicles:
            x1, y1, x2, y2 = v.box
            is_lead = (lead_vehicle is not None and v == lead_vehicle)
            box_color = hud_color if is_lead else (180, 180, 180)
            thickness = 3 if is_lead else 1

            # Vẽ góc 3D hiện đại (Modern Corner HUD Bracket)
            corner_len = min(20, (x2 - x1) // 4)
            # Góc trên trái
            cv2.line(out, (x1, y1), (x1 + corner_len, y1), box_color, thickness)
            cv2.line(out, (x1, y1), (x1, y1 + corner_len), box_color, thickness)
            # Góc trên phải
            cv2.line(out, (x2, y1), (x2 - corner_len, y1), box_color, thickness)
            cv2.line(out, (x2, y1), (x2, y1 + corner_len), box_color, thickness)
            # Góc dưới trái
            cv2.line(out, (x1, y2), (x1 + corner_len, y2), box_color, thickness)
            cv2.line(out, (x1, y2), (x1, y2 - corner_len), box_color, thickness)
            # Góc dưới phải
            cv2.line(out, (x2, y2), (x2 - corner_len, y2), box_color, thickness)
            cv2.line(out, (x2, y2), (x2, y2 - corner_len), box_color, thickness)

            if is_lead:
                # Banner thông tin AR nổi trên nóc xe
                tag_w = 260
                tag_h = 44
                tag_x1 = max(10, min(w - tag_w - 10, (x1 + x2) // 2 - tag_w // 2))
                tag_y1 = max(10, y1 - tag_h - 10)
                tag_x2 = tag_x1 + tag_w
                tag_y2 = tag_y1 + tag_h

                # Nền banner
                tag_roi = out[tag_y1:tag_y2, tag_x1:tag_x2]
                tag_bg_rect = np.full_like(tag_roi, tag_bg)
                cv2.addWeighted(tag_bg_rect, 0.85, tag_roi, 0.15, 0, tag_roi)
                cv2.rectangle(out, (tag_x1, tag_y1), (tag_x2, tag_y2), hud_color, 2)

                # Dòng 1: Khoảng cách & Chuẩn luật định
                line1 = f"CỰ LY: {assessment.lead_distance_m:.1f}m (Chuẩn: {assessment.min_legal_distance_m:.0f}m)"
                cv2.putText(out, line1, (tag_x1 + 8, tag_y1 + 18), cv2.FONT_HERSHEY_SIMPLEX, 0.50, (255, 255, 255), 2)

                # Dòng 2: Trạng thái & TTC
                state_str = "AN TOAN" if assessment.alert_level == AlertLevel.SAFE else (
                    "CANH BAO" if assessment.alert_level == AlertLevel.WARNING else "NGUY HIEM"
                )
                line2 = f"[{state_str}] TTC: {assessment.ttc_seconds:.1f}s | TT31/2019"
                cv2.putText(out, line2, (tag_x1 + 8, tag_y1 + 36), cv2.FONT_HERSHEY_SIMPLEX, 0.44, (240, 240, 240), 1)

                # Đường nối từ tag xuống xe
                cv2.line(out, ((tag_x1 + tag_x2) // 2, tag_y2), ((x1 + x2) // 2, y1), hud_color, 1)

        # 3. Hiệu ứng viền nhấp nháy đỏ khi ở trạng thái NGUY HIỂM (Critical Hazard Flash)
        if assessment.alert_level == AlertLevel.CRITICAL:
            self.flash_counter += 1
            if (self.flash_counter // 4) % 2 == 0:
                cv2.rectangle(out, (0, 0), (w - 1, h - 1), (0, 0, 255), 8)
                cv2.putText(out, "CANH BAO NGUY HIEM: BAM DUOI QUA GAN!", (w // 2 - 250, 45),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 0, 255), 2)

        # Watermark
        cv2.putText(out, "ADAS SafeDistance Pro - TT 31/2019/TT-BGTVT", (15, h - 15),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (160, 160, 160), 1)

        return out

    def _update_ui_displays(self, assessment: SafetyAssessment):
        # Cập nhật status badge
        self.status_badge.update_status(assessment)

        # Cập nhật thước đo cự ly
        self.distance_bar.update_distances(
            assessment.lead_distance_m, assessment.min_legal_distance_m, assessment.alert_level
        )

        # Cập nhật số liệu Telemetry
        self.lbl_actual_dist.setText(f"{assessment.lead_distance_m:.1f} m")
        if assessment.alert_level == AlertLevel.CRITICAL:
            self.lbl_actual_dist.setStyleSheet("font-size: 22px; font-weight: bold; color: #fc8181;")
        elif assessment.alert_level == AlertLevel.WARNING:
            self.lbl_actual_dist.setStyleSheet("font-size: 22px; font-weight: bold; color: #f6ad55;")
        else:
            self.lbl_actual_dist.setStyleSheet("font-size: 22px; font-weight: bold; color: #68d391;")

        self.lbl_legal_dist.setText(f"{assessment.min_legal_distance_m:.0f} m")
        self.lbl_ttc.setText(f"{assessment.ttc_seconds:.1f} s")

    def _log_violation_event(self, assessment: SafetyAssessment):
        """
        Ghi nhật ký vi phạm (chỉ ghi với tần suất tối đa 1 lần mỗi 2.5 giây để tránh tràn bảng)
        """
        now_ts = time.time()
        if hasattr(self, "_last_log_time") and (now_ts - self._last_log_time < 2.5):
            return
        self._last_log_time = now_ts

        time_str = datetime.now().strftime("%H:%M:%S")
        diff = assessment.lead_distance_m - assessment.min_legal_distance_m
        level_str = "NGUY HIỂM" if assessment.alert_level == AlertLevel.CRITICAL else "CẢNH BÁO"

        record = {
            "time": time_str,
            "speed": f"{assessment.vehicle_speed_kmh:.1f}",
            "actual_dist": f"{assessment.lead_distance_m:.1f}",
            "legal_dist": f"{assessment.min_legal_distance_m:.0f}",
            "diff": f"{diff:.1f}",
            "ttc": f"{assessment.ttc_seconds:.1f}",
            "level": level_str
        }
        self.violation_history.append(record)

        # Thêm dòng vào QTableWidget
        row = self.log_table.rowCount()
        self.log_table.insertRow(row)

        items = [
            record["time"], record["speed"], record["actual_dist"],
            record["legal_dist"], record["diff"], record["ttc"], record["level"]
        ]
        for col, val in enumerate(items):
            item = QTableWidgetItem(val)
            item.setTextAlignment(Qt.AlignCenter)
            if col == 6:
                item.setForeground(QColor(255, 80, 80) if level_str == "NGUY HIỂM" else QColor(255, 180, 40))
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
                        "time", "speed", "actual_dist", "legal_dist", "diff", "ttc", "level"
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

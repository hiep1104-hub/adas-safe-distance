# -*- coding: utf-8 -*-
"""
Các thành phần Giao diện Ô tô Hiện đại (Automotive HUD Widgets) cho PyQt5
Bao gồm: Thước đo khoảng cách an toàn, Thẻ trạng thái cảnh báo, Đồng hồ đo vận tốc.
"""
from PyQt5.QtWidgets import QWidget, QLabel, QVBoxLayout, QHBoxLayout, QFrame
from PyQt5.QtGui import QPainter, QColor, QFont, QPen, QBrush, QLinearGradient
from PyQt5.QtCore import Qt, QRectF
from core.legal_rules import AlertLevel, SafetyAssessment


class HudDistanceBar(QWidget):
    """
    Thanh đo Khoảng cách trực quan so sánh Khoảng cách Thực tế vs Chuẩn Luật định
    """
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setMinimumHeight(65)
        self.actual_dist = 60.0
        self.legal_min_dist = 55.0
        self.max_scale = 120.0
        self.alert_level = AlertLevel.SAFE

    def update_distances(self, actual_dist: float, legal_dist: float, alert_level: AlertLevel):
        self.actual_dist = max(0.0, float(actual_dist))
        self.legal_min_dist = max(5.0, float(legal_dist))
        self.alert_level = alert_level
        self.update()

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)

        w = self.width()
        h = self.height()
        bar_y = 28
        bar_h = 18
        bar_x = 15
        bar_w = w - 30

        # Nền thanh bar
        painter.setPen(Qt.NoPen)
        painter.setBrush(QColor(30, 35, 45))
        painter.drawRoundedRect(bar_x, bar_y, bar_w, bar_h, 6, 6)

        # Vẽ các vùng an toàn theo luật
        # Vùng đỏ: từ 0 đến 0.6 * legal_dist
        red_ratio = min(1.0, (self.legal_min_dist * 0.60) / self.max_scale)
        yellow_ratio = min(1.0, self.legal_min_dist / self.max_scale)

        red_w = int(bar_w * red_ratio)
        yellow_w = int(bar_w * (yellow_ratio - red_ratio))
        green_w = bar_w - red_w - yellow_w

        painter.setBrush(QColor(220, 50, 50, 140))
        painter.drawRoundedRect(bar_x, bar_y, red_w, bar_h, 4, 4)

        painter.setBrush(QColor(230, 160, 20, 140))
        painter.drawRect(bar_x + red_w, bar_y, yellow_w, bar_h)

        if green_w > 0:
            painter.setBrush(QColor(35, 185, 95, 140))
            painter.drawRoundedRect(bar_x + red_w + yellow_w, bar_y, green_w, bar_h, 4, 4)

        # Vạch chuẩn Luật định (Legal Threshold Marker)
        legal_x = bar_x + int(bar_w * (self.legal_min_dist / self.max_scale))
        painter.setPen(QPen(QColor(255, 255, 255, 220), 2, Qt.DashLine))
        painter.drawLine(legal_x, bar_y - 6, legal_x, bar_y + bar_h + 6)

        # Nhãn chữ luật định
        painter.setPen(QColor(220, 220, 220))
        painter.setFont(QFont("Segoe UI", 8, QFont.Bold))
        painter.drawText(legal_x - 35, bar_y - 8, 70, 12, Qt.AlignCenter, f"Luật: {self.legal_min_dist:.0f}m")

        # Vạch vị trí xe phía trước thực tế (Lead Vehicle Pointer)
        actual_ratio = min(1.0, self.actual_dist / self.max_scale)
        actual_x = bar_x + int(bar_w * actual_ratio)

        pointer_color = QColor(35, 220, 105)
        if self.alert_level == AlertLevel.WARNING:
            pointer_color = QColor(255, 180, 0)
        elif self.alert_level == AlertLevel.CRITICAL:
            pointer_color = QColor(255, 45, 45)

        painter.setPen(QPen(pointer_color, 3))
        painter.drawLine(actual_x, bar_y - 2, actual_x, bar_y + bar_h + 2)

        # Vẽ con trỏ tam giác
        painter.setBrush(pointer_color)
        painter.setPen(Qt.NoPen)
        pts = [
            QRectF(actual_x - 7, bar_y + bar_h + 2, 14, 10)
        ]
        polygon = [
            (actual_x, bar_y + bar_h + 2),
            (actual_x - 6, bar_y + bar_h + 10),
            (actual_x + 6, bar_y + bar_h + 10)
        ]
        from PyQt5.QtGui import QPolygonF
        from PyQt5.QtCore import QPointF
        painter.drawPolygon(QPolygonF([QPointF(px, py) for px, py in polygon]))

        # Nhãn khoảng cách thực tế
        painter.setPen(pointer_color)
        painter.setFont(QFont("Segoe UI", 9, QFont.Bold))
        painter.drawText(actual_x - 40, bar_y + bar_h + 11, 80, 16, Qt.AlignCenter, f"{self.actual_dist:.1f} m")

        # Thang chia vạch (0, 30m, 60m, 90m, 120m)
        painter.setPen(QColor(140, 150, 170))
        painter.setFont(QFont("Segoe UI", 7))
        for mark in [0, 35, 55, 70, 100, 120]:
            mx = bar_x + int(bar_w * (mark / self.max_scale))
            painter.drawText(mx - 15, bar_y - 20, 30, 12, Qt.AlignCenter, f"{mark}m")


class StatusBadge(QFrame):
    """
    Hộp trạng thái cảnh báo nổi bật (Safe / Warning / Critical)
    """
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setFrameShape(QFrame.StyledPanel)
        self.setStyleSheet("""
            QFrame {
                background-color: #1a1f29;
                border-radius: 8px;
                border: 2px solid #2d3748;
                padding: 10px;
            }
        """)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(12, 8, 12, 8)

        self.title_label = QLabel("TRẠNG THÁI CẢNH BÁO AN TOÀN")
        self.title_label.setStyleSheet("color: #8fa0b5; font-size: 11px; font-weight: bold; letter-spacing: 1px;")
        layout.addWidget(self.title_label)

        self.status_label = QLabel("ĐANG QUAN SÁT...")
        self.status_label.setStyleSheet("color: #48bb78; font-size: 16px; font-weight: bold;")
        self.status_label.setWordWrap(True)
        layout.addWidget(self.status_label)

        self.sub_label = QLabel("Cơ sở pháp lý: Thông tư 31/2019/TT-BGTVT")
        self.sub_label.setStyleSheet("color: #a0aec0; font-size: 10px;")
        self.sub_label.setWordWrap(True)
        layout.addWidget(self.sub_label)

    def update_status(self, assessment: SafetyAssessment):
        if assessment.alert_level == AlertLevel.CRITICAL:
            self.setStyleSheet("""
                QFrame {
                    background-color: #381212;
                    border-radius: 8px;
                    border: 2px solid #e53e3e;
                    padding: 10px;
                }
            """)
            self.status_label.setStyleSheet("color: #fc8181; font-size: 16px; font-weight: bold;")
        elif assessment.alert_level == AlertLevel.WARNING:
            self.setStyleSheet("""
                QFrame {
                    background-color: #34250e;
                    border-radius: 8px;
                    border: 2px solid #dd6b20;
                    padding: 10px;
                }
            """)
            self.status_label.setStyleSheet("color: #f6ad55; font-size: 16px; font-weight: bold;")
        else:
            self.setStyleSheet("""
                QFrame {
                    background-color: #0f291e;
                    border-radius: 8px;
                    border: 2px solid #38a169;
                    padding: 10px;
                }
            """)
            self.status_label.setStyleSheet("color: #68d391; font-size: 16px; font-weight: bold;")

        self.status_label.setText(assessment.status_text)
        self.sub_label.setText(assessment.rule_citation)

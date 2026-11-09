# -*- coding: utf-8 -*-
"""
Bộ Kiểm thử Toàn diện cho Hệ thống Đo Khoảng cách & Cảnh báo An toàn Xe hơi
Kiểm tra tính chính xác của các chuẩn pháp luật, thuật toán quang học và mô hình AI.
"""
import sys
import numpy as np

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from core.legal_rules import VietnamTrafficLegalStandards, AlertLevel, WeatherCondition
from core.distance_estimator import MonocularDistanceEstimator
from core.detector import VehicleDetector


def test_legal_standards():
    print("--- 1. Kiểm tra Quy chuẩn Pháp luật (TT 31/2019/TT-BGTVT) ---")
    
    # Test dải tốc độ khô ráo
    dist_60, cit_60 = VietnamTrafficLegalStandards.get_legal_min_distance(60.0, WeatherCondition.DRY)
    assert dist_60 == 55.0 or dist_60 >= 35.0, f"Sai chuẩn 60 km/h: {dist_60}"
    print(f"✓ V = 60 km/h -> Khoảng cách tối thiểu: {dist_60}m")

    dist_80, _ = VietnamTrafficLegalStandards.get_legal_min_distance(80.0, WeatherCondition.DRY)
    assert dist_80 == 55.0, f"Sai chuẩn 80 km/h: {dist_80}"
    print(f"✓ V = 80 km/h -> Khoảng cách tối thiểu: {dist_80}m (Chuẩn 55m)")

    dist_100, _ = VietnamTrafficLegalStandards.get_legal_min_distance(100.0, WeatherCondition.DRY)
    assert dist_100 == 70.0, f"Sai chuẩn 100 km/h: {dist_100}"
    print(f"✓ V = 100 km/h -> Khoảng cách tối thiểu: {dist_100}m (Chuẩn 70m)")

    dist_120, _ = VietnamTrafficLegalStandards.get_legal_min_distance(120.0, WeatherCondition.DRY)
    assert dist_120 == 100.0, f"Sai chuẩn 120 km/h: {dist_120}"
    print(f"✓ V = 120 km/h -> Khoảng cách tối thiểu: {dist_120}m (Chuẩn 100m)")

    # Test thời tiết mưa (Khoản 3 Điều 11)
    dist_rain, _ = VietnamTrafficLegalStandards.get_legal_min_distance(80.0, WeatherCondition.WET_RAIN)
    assert dist_rain == round(55.0 * 1.40, 1), f"Sai chuẩn mưa 80 km/h: {dist_rain}"
    print(f"✓ V = 80 km/h (Trời mưa/trơn trượt) -> Khoảng cách tối thiểu: {dist_rain}m (+40%)")

    # Test phân loại cảnh báo
    assess_safe = VietnamTrafficLegalStandards.evaluate_safety(100.0, 75.0, 0.0, WeatherCondition.DRY)
    assert assess_safe.alert_level == AlertLevel.SAFE
    print("✓ Đánh giá an toàn 100 km/h ở 75m -> SAFE")

    assess_warn = VietnamTrafficLegalStandards.evaluate_safety(100.0, 55.0, 5.0, WeatherCondition.DRY)
    assert assess_warn.alert_level == AlertLevel.WARNING
    print("✓ Đánh giá an toàn 100 km/h ở 55m -> WARNING")

    assess_danger = VietnamTrafficLegalStandards.evaluate_safety(100.0, 30.0, 20.0, WeatherCondition.DRY)
    assert assess_danger.alert_level == AlertLevel.CRITICAL
    print("✓ Đánh giá an toàn 100 km/h ở 30m -> CRITICAL DANGER")


def test_optical_distance_estimation():
    print("\n--- 2. Kiểm tra Thuật toán Đo Khoảng cách Quang học ---")
    estimator = MonocularDistanceEstimator()

    # Giả lập xe con rộng 1.85m ở cự ly khoảng 50m trên ảnh 960x540
    # fx = (960/2)/tan(78/2) ~ 592 px
    # width_px = (fx * 1.85) / 50m ~ 22 px
    # Bottom contact point: y2 = 300
    fake_box = (469, 275, 491, 305)
    filtered_d, raw_d, v_rel = estimator.estimate_distance(fake_box, 1.85, 960, 540)
    print(f"✓ Khoảng cách thô: {raw_d:.1f}m | Sau lọc Kalman: {filtered_d:.1f}m")
    assert 30.0 <= filtered_d <= 70.0, f"Khoảng cách ước tính ngoài dải hợp lý: {filtered_d}"


def test_yolo_detector():
    print("\n--- 3. Kiểm tra Bộ Nhận diện YOLOv8 ONNX ---")
    detector = VehicleDetector(model_path="models/yolov8n.onnx")
    assert detector.is_loaded, "Không thể tải mô hình YOLOv8 ONNX"
    
    # Chạy thử trên ảnh giả lập
    dummy_frame = np.zeros((540, 960, 3), dtype=np.uint8)
    results = detector.detect(dummy_frame)
    print(f"✓ Inference thành công trên khung hình 960x540 (Số xe phát hiện: {len(results)})")


if __name__ == "__main__":
    test_legal_standards()
    test_optical_distance_estimation()
    test_yolo_detector()
    print("\n==========================================")
    print("  TẤT CẢ CÁC BÀI KIỂM THỬ ĐÃ ĐẠT 100%!")
    print("==========================================")

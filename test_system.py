# -*- coding: utf-8 -*-
"""
Bộ Kiểm Thử Toàn Diện Hợp Nhất (Unified System Self-Test)
Kiểm tra tính chính xác của:
1. Quy chuẩn Pháp luật: Thông tư 38/2024/TT-BGTVT, Nghị định 168/2024/NĐ-CP, QCVN 41:2019/BGTVT
2. Thuật toán Quang học & Bộ lọc Kalman
3. Mô hình Nhận diện AI YOLOv8 ONNX
4. Tính đồng bộ và toàn vẹn của mã nguồn (Zero Fragmentation Check)
"""
import sys
import os
import filecmp
import numpy as np

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from core.legal_rules import (
    VietnamTrafficLegalStandards, AlertLevel, WeatherCondition,
    VehicleType, SpeedAssessment, RoadSignAssessment
)
from core.distance_estimator import MonocularDistanceEstimator
from core.detector import VehicleDetector


def test_legal_standards():
    print("--- 1. Kiểm tra Quy chuẩn Pháp luật Thống Nhất ---")
    
    # 1.1. Cự ly an toàn Thông tư 38/2024/TT-BGTVT
    dist_60, cit_60 = VietnamTrafficLegalStandards.get_legal_min_distance(60.0, WeatherCondition.DRY)
    assert dist_60 >= 35.0, f"Sai chuẩn 60 km/h: {dist_60}"
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

    # 1.2. Thời tiết mưa trơn trượt (+40%)
    dist_rain, _ = VietnamTrafficLegalStandards.get_legal_min_distance(80.0, WeatherCondition.WET_RAIN)
    assert dist_rain == round(55.0 * 1.40, 1), f"Sai chuẩn mưa 80 km/h: {dist_rain}"
    print(f"✓ V = 80 km/h (Mặt đường mưa trơn trượt) -> Cự ly: {dist_rain}m (+40%)")

    # 1.3. Đánh giá phân loại mức an toàn
    assess_safe = VietnamTrafficLegalStandards.evaluate_safety(100.0, 75.0, 0.0, WeatherCondition.DRY)
    assert assess_safe.alert_level == AlertLevel.SAFE
    print("✓ Đánh giá cự ly an toàn 100 km/h ở 75m -> SAFE")

    assess_warn = VietnamTrafficLegalStandards.evaluate_safety(100.0, 55.0, 5.0, WeatherCondition.DRY)
    assert assess_warn.alert_level == AlertLevel.WARNING
    print("✓ Đánh giá cự ly an toàn 100 km/h ở 55m -> WARNING")

    assess_danger = VietnamTrafficLegalStandards.evaluate_safety(100.0, 30.0, 20.0, WeatherCondition.DRY)
    assert assess_danger.alert_level == AlertLevel.CRITICAL
    print("✓ Đánh giá cự ly an toàn 100 km/h ở 30m -> CRITICAL DANGER")

    # 1.4. Đánh giá vi phạm tốc độ & trừ điểm GPLX (Nghị định 168/2024/NĐ-CP)
    sp_ok = VietnamTrafficLegalStandards.evaluate_speed_compliance(82.0, 80.0)
    assert not sp_ok.is_overspeeding and sp_ok.license_points_deducted == 0
    print("✓ Tốc độ 82/80 km/h -> Đúng luật (không vi phạm)")

    sp_tier1 = VietnamTrafficLegalStandards.evaluate_speed_compliance(87.0, 80.0)
    assert sp_tier1.is_overspeeding and sp_tier1.license_points_deducted == 0
    print("✓ Tốc độ 87/80 km/h (+7 km/h) -> Phạt tiền, chưa trừ điểm GPLX")

    sp_tier2 = VietnamTrafficLegalStandards.evaluate_speed_compliance(95.0, 80.0)
    assert sp_tier2.is_overspeeding and sp_tier2.license_points_deducted == 2
    print("✓ Tốc độ 95/80 km/h (+15 km/h) -> Trừ 2 điểm GPLX (NĐ 168/2024/NĐ-CP)")

    sp_tier3 = VietnamTrafficLegalStandards.evaluate_speed_compliance(105.0, 80.0)
    assert sp_tier3.is_overspeeding and sp_tier3.license_points_deducted == 3
    print("✓ Tốc độ 105/80 km/h (+25 km/h) -> Trừ 3 điểm GPLX")

    sp_tier4 = VietnamTrafficLegalStandards.evaluate_speed_compliance(120.0, 80.0)
    assert sp_tier4.is_overspeeding and sp_tier4.license_points_deducted == 6
    print("✓ Tốc độ 120/80 km/h (+40 km/h) -> Trừ 6 điểm GPLX (mức cao nhất)")

    # 1.5. Đánh giá biển cấm theo loại xe
    sign_p102 = VietnamTrafficLegalStandards.evaluate_road_sign("P.102", VehicleType.CAR)
    assert sign_p102.is_prohibited
    print(f"✓ Biển {sign_p102.sign_code} ({sign_p102.sign_name}) -> Cấm xe")

    sign_p103a = VietnamTrafficLegalStandards.evaluate_road_sign("P.103a", VehicleType.CAR)
    assert sign_p103a.is_prohibited
    print(f"✓ Biển {sign_p103a.sign_code} ({sign_p103a.sign_name}) -> Cấm ô tô")

    sign_p106_car = VietnamTrafficLegalStandards.evaluate_road_sign("P.106", VehicleType.CAR)
    assert not sign_p106_car.is_prohibited
    print(f"✓ Biển P.106 đối với Ô tô con -> Cho phép lưu thông")

    sign_p106_truck = VietnamTrafficLegalStandards.evaluate_road_sign("P.106", VehicleType.TRUCK)
    assert sign_p106_truck.is_prohibited
    print(f"✓ Biển P.106 đối với Xe tải -> Cấm lưu thông")

    # 1.6. Quy tắc đỗ xe ngày chẵn lẻ
    p_odd = VietnamTrafficLegalStandards.evaluate_parking_rule(9)  # Ngày 9 là ngày lẻ
    assert p_odd["p131c_allowed"] and not p_odd["p131b_allowed"]
    print("✓ Ngày 9 (Lẻ): Biển P.131b CẤM ĐỖ, Biển P.131c ĐƯỢC ĐỖ")

    p_even = VietnamTrafficLegalStandards.evaluate_parking_rule(10) # Ngày 10 là ngày chẵn
    assert p_even["p131b_allowed"] and not p_even["p131c_allowed"]
    print("✓ Ngày 10 (Chẵn): Biển P.131c CẤM ĐỖ, Biển P.131b ĐƯỢC ĐỖ")


def test_optical_distance_estimation():
    print("\n--- 2. Kiểm tra Thuật toán Đo Khoảng cách Quang học ---")
    estimator = MonocularDistanceEstimator()
    fake_box = (469, 275, 491, 305)
    filtered_d, raw_d, v_rel = estimator.estimate_distance(fake_box, 1.85, 960, 540)
    print(f"✓ Khoảng cách thô: {raw_d:.1f}m | Sau lọc Kalman: {filtered_d:.1f}m")
    assert 30.0 <= filtered_d <= 70.0, f"Khoảng cách ước tính ngoài dải hợp lý: {filtered_d}"


def test_yolo_detector():
    print("\n--- 3. Kiểm tra Bộ Nhận diện YOLOv8 ONNX ---")
    detector = VehicleDetector(model_path="models/yolov8n.onnx")
    assert detector.is_loaded, "Không thể tải mô hình YOLOv8 ONNX"
    dummy_frame = np.zeros((540, 960, 3), dtype=np.uint8)
    results = detector.detect(dummy_frame)
    print(f"✓ Inference thành công trên khung hình 960x540 (Số xe phát hiện: {len(results)})")


def test_system_unification_and_assets():
    print("\n--- 4. Kiểm tra Tính Hợp Nhất Hệ Thống (Zero Fragmentation Check) ---")
    base_dir = os.path.dirname(os.path.abspath(__file__))
    mobile_dir = os.path.join(base_dir, "mobile_app")

    # Đồng bộ hóa tài nguyên web
    import mobile_server
    mobile_server.sync_web_assets(base_dir)

    sync_files = ["index.html", "app.js", "style.css", "manifest.json", "sw.js"]
    for fname in sync_files:
        src = os.path.join(base_dir, fname)
        dst = os.path.join(mobile_dir, fname)
        assert os.path.exists(src), f"Thiếu file gốc: {fname}"
        assert os.path.exists(dst), f"Thiếu file mobile_app: {fname}"
        assert filecmp.cmp(src, dst, shallow=False), f"Phát hiện phân mảnh, file không đồng nhất: {fname}"
        print(f"✓ Đồng bộ thống nhất 100%: {fname}")

    # Kiểm tra tính toàn vẹn của mô hình ONNX
    model_path = os.path.join(base_dir, "models", "yolov8n.onnx")
    assert os.path.exists(model_path) and os.path.getsize(model_path) > 10000000, "Mô hình YOLOv8 thiếu hoặc hỏng!"
    print(f"✓ Mô hình AI ONNX hợp nhất toàn vẹn: models/yolov8n.onnx ({os.path.getsize(model_path):,} bytes)")


def run_all_tests():
    test_legal_standards()
    test_optical_distance_estimation()
    test_yolo_detector()
    test_system_unification_and_assets()
    print("\n" + "=" * 60)
    print("  HỆ THỐNG ĐÃ KẾT NỐI ĐỒNG BỘ 1 THỂ THỐNG NHẤT 100%!")
    print("=" * 60)


if __name__ == "__main__":
    run_all_tests()

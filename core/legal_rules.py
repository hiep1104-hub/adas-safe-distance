# -*- coding: utf-8 -*-
"""
Hệ thống Cảnh báo Khoảng cách An toàn Xe hơi theo Quy định Pháp luật Việt Nam
Cơ sở pháp lý: Thông tư số 31/2019/TT-BGTVT & Luật Trật tự, An toàn giao thông đường bộ 2024.
"""
from dataclasses import dataclass
from enum import Enum
from typing import Tuple, Dict, Any


class WeatherCondition(Enum):
    DRY = "dry"          # Mặt đường khô ráo, thời tiết bình thường
    WET_RAIN = "wet"     # Trời mưa, đường trơn trượt, sương mù, tầm nhìn hạn chế


class AlertLevel(Enum):
    SAFE = "safe"           # An toàn (Xanh lá)
    WARNING = "warning"     # Chú ý / Cảnh báo (Vàng/Cam) - dưới khoảng cách an toàn
    CRITICAL = "critical"   # Nguy hiểm / Khẩn cấp (Đỏ) - nguy cơ đâm va cao (TTC nhỏ hoặc khoảng cách cực gần)


@dataclass
class SafetyAssessment:
    vehicle_speed_kmh: float       # Vận tốc xe chủ (km/h)
    lead_distance_m: float         # Khoảng cách thực tế đo được tới xe trước (m)
    min_legal_distance_m: float    # Khoảng cách an toàn tối thiểu theo luật (m)
    recommended_distance_m: float  # Khoảng cách khuyến nghị an toàn thực tế (m)
    ttc_seconds: float             # Thời gian va chạm Time-To-Collision (s)
    alert_level: AlertLevel        # Mức cảnh báo
    status_text: str               # Dòng thông báo trạng thái
    rule_citation: str             # Trích dẫn quy định pháp luật tương ứng
    weather: WeatherCondition      # Điều kiện thời tiết


class VietnamTrafficLegalStandards:
    """
    Quy chuẩn khoảng cách an toàn phương tiện theo Pháp luật Việt Nam:
    - Thông tư số 31/2019/TT-BGTVT (Điều 11)
    - Luật Trật tự, An toàn Giao thông Đường bộ 2024
    """

    # Bảng khoảng cách tối thiểu ở điều kiện mặt đường khô ráo (Điều 11 Thông tư 31/2019/TT-BGTVT)
    # Dải tốc độ: (V_min, V_max, Khoang_cach_toi_thieu_m)
    SPEED_DISTANCE_TABLE = [
        (0.0, 60.0, 35.0),      # V <= 60 km/h: Chủ động giữ khoảng cách phù hợp (tham chiếu tối thiểu 35m ở 60km/h, quy tắc 2-3s)
        (60.0, 80.0, 55.0),     # 60 < V <= 80 km/h: Tối thiểu 55m
        (80.0, 100.0, 70.0),    # 80 < V <= 100 km/h: Tối thiểu 70m
        (100.0, 120.0, 100.0),  # 100 < V <= 120 km/h: Tối thiểu 100m
        (120.0, 200.0, 120.0),  # V > 120 km/h: Tối thiểu 120m+
    ]

    # Hệ số nhân khoảng cách khi thời tiết xấu (trời mưa, đường trơn trượt, sương mù, dốc quanh co)
    # Khoản 3 Điều 11 Thông tư 31/2019/TT-BGTVT yêu cầu phải điều chỉnh khoảng cách an toàn lớn hơn
    WET_ROAD_MULTIPLIER = 1.40  # Tăng 40% khoảng cách hoặc tương đương quy tắc 4 giây

    @classmethod
    def get_legal_min_distance(cls, speed_kmh: float, weather: WeatherCondition = WeatherCondition.DRY) -> Tuple[float, str]:
        """
        Trả về: (khoảng cách tối thiểu mét, trích dẫn quy định pháp luật)
        """
        speed = max(0.0, float(speed_kmh))
        
        if speed <= 10.0:
            # Xe di chuyển rất chậm, kẹt xe / bò trên đường
            base_dist = 5.0
            citation = "Vận tốc rất thấp (<10 km/h): Giữ khoảng cách dừng tối thiểu 3-5m tránh trôi xe"
        elif speed < 60.0:
            # Khoản 2 Điều 11: V < 60 km/h: Người lái xe phải chủ động giữ khoảng cách an toàn phù hợp
            # Áp dụng quy tắc 2.5 giây thực nghiệm chuẩn ADAS đô thị
            time_gap = 2.5
            calc_dist = (speed * 1000.0 / 3600.0) * time_gap
            base_dist = max(15.0, min(35.0, calc_dist))
            citation = f"Khoản 2 Điều 11 TT 31/2019/TT-BGTVT (V < 60 km/h: Chủ động giữ khoảng cách an toàn phù hợp, khuyến nghị quy tắc 2.5s: {base_dist:.0f}m)"
        elif 60.0 <= speed <= 80.0:
            base_dist = 55.0
            citation = "Khoản 1 Điều 11 TT 31/2019/TT-BGTVT: 60 < V <= 80 km/h -> Tối thiểu 55m"
        elif 80.0 < speed <= 100.0:
            base_dist = 70.0
            citation = "Khoản 1 Điều 11 TT 31/2019/TT-BGTVT: 80 < V <= 100 km/h -> Tối thiểu 70m"
        elif 100.0 < speed <= 120.0:
            base_dist = 100.0
            citation = "Khoản 1 Điều 11 TT 31/2019/TT-BGTVT: 100 < V <= 120 km/h -> Tối thiểu 100m"
        else:
            base_dist = 120.0
            citation = "V > 120 km/h (Vượt tốc độ cao tốc tối đa): Khoảng cách an toàn tối thiểu khuyến nghị >= 120m"

        if weather == WeatherCondition.WET_RAIN:
            adjusted_dist = base_dist * cls.WET_ROAD_MULTIPLIER
            citation += " | Khoản 3 Điều 11: Trời mưa/trơn trượt -> Tăng cự ly an toàn (+40%)"
            return round(adjusted_dist, 1), citation

        return round(base_dist, 1), citation

    @classmethod
    def evaluate_safety(
        cls,
        speed_kmh: float,
        actual_distance_m: float,
        relative_speed_kmh: float = 0.0,
        weather: WeatherCondition = WeatherCondition.DRY
    ) -> SafetyAssessment:
        """
        Đánh giá an toàn toàn diện dựa trên luật pháp và chỉ số Time-To-Collision (TTC)
        - relative_speed_kmh = V_xe_minh - V_xe_truoc (nếu dương là đang áp sát xe trước)
        """
        legal_min, citation = cls.get_legal_min_distance(speed_kmh, weather)
        rec_dist = legal_min * 1.15  # Khuyến nghị giữ dư 15% làm biên an toàn

        # Tính toán Time-To-Collision (TTC)
        # Nếu xe mình đang lao vào xe trước với vận tốc tương đối v_rel (m/s)
        v_approach_mps = (relative_speed_kmh * 1000.0 / 3600.0)
        if v_approach_mps > 0.5:
            ttc = actual_distance_m / v_approach_mps
        else:
            # Nếu xe trước chạy cùng tốc độ hoặc đang xa dần, dùng vận tốc tuyệt đối xe mình để ước tính phanh khẩn cấp
            v_host_mps = max(1.0, speed_kmh * 1000.0 / 3600.0)
            ttc = actual_distance_m / v_host_mps

        # Phân loại mức cảnh báo:
        # Ngưỡng khẩn cấp: Khoảng cách < 60% mức luật định HOẶC TTC < 1.8s
        # Ngưỡng cảnh báo: Khoảng cách < mức luật định HOẶC TTC < 2.8s
        if actual_distance_m < (0.60 * legal_min) or (ttc < 1.8 and v_approach_mps > 0):
            level = AlertLevel.CRITICAL
            status_text = f"NGUY HIỂM: BÁM ĐUÔI QUÁ GẦN! ({actual_distance_m:.1f}m < {legal_min:.0f}m quy định)"
        elif actual_distance_m < legal_min or (ttc < 2.8 and v_approach_mps > 0):
            level = AlertLevel.WARNING
            status_text = f"CẢNH BÁO: DƯỚI KHOẢNG CÁCH LUẬT ĐỊNH ({actual_distance_m:.1f}m / chuẩn {legal_min:.0f}m)"
        else:
            level = AlertLevel.SAFE
            status_text = f"AN TOÀN: Khoảng cách đạt chuẩn ({actual_distance_m:.1f}m >= {legal_min:.0f}m)"

        return SafetyAssessment(
            vehicle_speed_kmh=round(speed_kmh, 1),
            lead_distance_m=round(actual_distance_m, 1),
            min_legal_distance_m=legal_min,
            recommended_distance_m=round(rec_dist, 1),
            ttc_seconds=round(ttc, 2),
            alert_level=level,
            status_text=status_text,
            rule_citation=citation,
            weather=weather
        )

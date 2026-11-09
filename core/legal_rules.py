# -*- coding: utf-8 -*-
"""
Hệ thống Cảnh báo Khoảng cách An toàn & Luật Giao thông Đường bộ Việt Nam
Cơ sở pháp lý thống nhất:
- Thông tư số 38/2024/TT-BGTVT (Điều 11) - Ban hành 15/11/2024, có hiệu lực 01/01/2025 (thay thế Thông tư 31/2019/TT-BGTVT)
- Luật Trật tự, An toàn Giao thông Đường bộ 2024 (Luật số 36/2024/QH15)
- Nghị định số 168/2024/NĐ-CP (Quy định xử phạt vi phạm hành chính và cơ chế trừ điểm GPLX từ 01/01/2025)
- Quy chuẩn kỹ thuật quốc gia QCVN 41:2019/BGTVT về báo hiệu đường bộ (Biển P.127, P.101, P.102, P.103a, P.106, P.131b, P.131c)
"""
from dataclasses import dataclass
from enum import Enum
from typing import Tuple, Dict, Any, Optional
import datetime


class VehicleType(Enum):
    CAR = "car"        # Ô tô con, xe du lịch, xe dưới 9 chỗ
    TRUCK = "truck"    # Ô tô tải, xe chuyên dùng


class WeatherCondition(Enum):
    DRY = "dry"          # Mặt đường khô ráo, thời tiết bình thường
    WET_RAIN = "wet"     # Trời mưa, đường trơn trượt, sương mù, tầm nhìn hạn chế


class AlertLevel(Enum):
    SAFE = "safe"           # An toàn (Xanh lá)
    WARNING = "warning"     # Chú ý / Cảnh báo (Vàng/Cam) - dưới khoảng cách an toàn
    CRITICAL = "critical"   # Nguy hiểm / Khẩn cấp (Đỏ) - nguy cơ đâm va cao


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


@dataclass
class SpeedAssessment:
    current_speed_kmh: float       # Vận tốc hiện tại (km/h)
    speed_limit_kmh: float         # Giới hạn tốc độ cho phép (km/h)
    is_overspeeding: bool          # Đang vượt quá tốc độ
    excess_kmh: float              # Vận tốc vượt quá (km/h)
    penalty_fine_desc: str         # Mức phạt tiền theo Nghị định 168/2024/NĐ-CP
    license_points_deducted: int   # Số điểm GPLX bị trừ (0, 2, 3, 6 điểm)
    warning_text: str              # Lời cảnh báo


@dataclass
class RoadSignAssessment:
    sign_code: str                 # Mã biển (P.101, P.102, P.103a, P.106, P.127, P.131b, P.131c)
    sign_name: str                 # Tên biển báo
    is_prohibited: bool            # Tuyến đường cấm xe hiện tại
    action_advice: str             # Hướng dẫn xử lý cho tài xế
    penalty_citation: str          # Căn cứ xử phạt theo NĐ 168/2024/NĐ-CP


class VietnamTrafficLegalStandards:
    """
    Quy chuẩn thống nhất toàn bộ hệ thống ADAS SafeDistance Pro
    """
    # Bảng khoảng cách an toàn tối thiểu ở điều kiện mặt đường khô ráo (Điều 11 Thông tư 38/2024/TT-BGTVT)
    SPEED_DISTANCE_TABLE = [
        (0.0, 60.0, 35.0),      # V <= 60 km/h: Chủ động giữ khoảng cách phù hợp (tham chiếu 35m)
        (60.0, 80.0, 55.0),     # 60 < V <= 80 km/h: Tối thiểu 55m
        (80.0, 100.0, 70.0),    # 80 < V <= 100 km/h: Tối thiểu 70m
        (100.0, 120.0, 100.0),  # 100 < V <= 120 km/h: Tối thiểu 100m
        (120.0, 200.0, 120.0),  # V > 120 km/h: Tối thiểu 120m+
    ]

    # Hệ số tăng cự ly khi thời tiết mưa/trơn trượt (Khoản 3 Điều 11 Thông tư 38/2024/TT-BGTVT)
    WET_ROAD_MULTIPLIER = 1.40  # +40% khoảng cách an toàn

    # Khung giờ cao điểm cấm xe đô thị (Hà Nội, TP.HCM, Đà Nẵng...)
    PEAK_HOURS_MORNING = (6, 0, 9, 0)     # 06:00 đến 09:00
    PEAK_HOURS_EVENING = (16, 0, 19, 30)  # 16:00 đến 19:30

    @classmethod
    def get_legal_min_distance(cls, speed_kmh: float, weather: WeatherCondition = WeatherCondition.DRY) -> Tuple[float, str]:
        """Tính cự ly an toàn tối thiểu mét và trích dẫn Thông tư 38/2024/TT-BGTVT"""
        speed = max(0.0, float(speed_kmh))
        
        if speed <= 10.0:
            base_dist = 5.0
            citation = "Vận tốc rất thấp (<10 km/h): Giữ khoảng cách dừng tối thiểu 3-5m tránh trôi xe"
        elif speed < 60.0:
            time_gap = 2.5
            calc_dist = (speed * 1000.0 / 3600.0) * time_gap
            base_dist = max(15.0, min(35.0, calc_dist))
            citation = f"Điều 11 TT 38/2024/TT-BGTVT (V < 60 km/h: Giữ cự ly chủ động an toàn, quy tắc 2.5s: {base_dist:.0f}m)"
        elif 60.0 <= speed <= 80.0:
            base_dist = 55.0
            citation = "Điều 11 TT 38/2024/TT-BGTVT: 60 < V <= 80 km/h -> Cự ly tối thiểu 55m"
        elif 80.0 < speed <= 100.0:
            base_dist = 70.0
            citation = "Điều 11 TT 38/2024/TT-BGTVT: 80 < V <= 100 km/h -> Cự ly tối thiểu 70m"
        elif 100.0 < speed <= 120.0:
            base_dist = 100.0
            citation = "Điều 11 TT 38/2024/TT-BGTVT: 100 < V <= 120 km/h -> Cự ly tối thiểu 100m"
        else:
            base_dist = 120.0
            citation = "V > 120 km/h (Vượt tốc độ cao tốc tối đa): Cự ly an toàn tối thiểu khuyến nghị >= 120m"

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
        """Đánh giá toàn diện mức độ an toàn khoảng cách và TTC"""
        legal_min, citation = cls.get_legal_min_distance(speed_kmh, weather)
        rec_dist = legal_min * 1.15

        v_approach_mps = (relative_speed_kmh * 1000.0 / 3600.0)
        if v_approach_mps > 0.5:
            ttc = actual_distance_m / v_approach_mps
        else:
            v_host_mps = max(1.0, speed_kmh * 1000.0 / 3600.0)
            ttc = actual_distance_m / v_host_mps

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

    @classmethod
    def evaluate_speed_compliance(cls, current_speed_kmh: float, speed_limit_kmh: float) -> SpeedAssessment:
        """
        Đánh giá vi phạm tốc độ và cơ chế trừ điểm GPLX theo Nghị định số 168/2024/NĐ-CP (thay thế NĐ 100/2019)
        """
        excess = current_speed_kmh - speed_limit_kmh
        if excess < 5.0:
            return SpeedAssessment(
                current_speed_kmh=round(current_speed_kmh, 1),
                speed_limit_kmh=round(speed_limit_kmh, 1),
                is_overspeeding=False,
                excess_kmh=0.0,
                penalty_fine_desc="Đúng tốc độ quy định",
                license_points_deducted=0,
                warning_text="Tốc độ xe an toàn, trong giới hạn cho phép."
            )

        # Các khung xử phạt theo Nghị định 168/2024/NĐ-CP
        if 5.0 <= excess < 10.0:
            fine = "Phạt tiền 800.000đ - 1.000.000đ"
            points = 0
            warn = f"Vượt tốc độ +{excess:.0f} km/h (Mức 5 - dưới 10 km/h): Phạt tiền, chưa trừ điểm."
        elif 10.0 <= excess <= 20.0:
            fine = "Phạt tiền 4.000.000đ - 6.000.000đ"
            points = 2
            warn = f"Vượt tốc độ +{excess:.0f} km/h (Mức 10 - 20 km/h): Trừ 2 điểm Giấy phép lái xe!"
        elif 20.0 < excess <= 35.0:
            fine = "Phạt tiền 6.000.000đ - 8.000.000đ"
            points = 3
            warn = f"Vượt tốc độ +{excess:.0f} km/h (Mức 20 - 35 km/h): Trừ 3 điểm Giấy phép lái xe!"
        else:
            fine = "Phạt tiền 10.000.000đ - 12.000.000đ"
            points = 6
            warn = f"Vượt tốc độ đặc biệt nghiêm trọng +{excess:.0f} km/h (>35 km/h): Trừ 6 điểm GPLX!"

        return SpeedAssessment(
            current_speed_kmh=round(current_speed_kmh, 1),
            speed_limit_kmh=round(speed_limit_kmh, 1),
            is_overspeeding=True,
            excess_kmh=round(excess, 1),
            penalty_fine_desc=fine,
            license_points_deducted=points,
            warning_text=warn
        )

    @classmethod
    def evaluate_road_sign(cls, sign_code: str, vehicle_type: VehicleType = VehicleType.CAR) -> RoadSignAssessment:
        """
        Đánh giá biển báo cấm theo Quy chuẩn QCVN 41:2019/BGTVT
        """
        code = sign_code.strip().upper()
        if code == "P.101":
            return RoadSignAssessment(
                sign_code="P.101",
                sign_name="Đường cấm",
                is_prohibited=True,
                action_advice="Cấm tất cả phương tiện cơ giới đi vào. Vui lòng chuyển hướng ngay!",
                penalty_citation="Nghị định 168/2024/NĐ-CP: Phạt tiền 4-6 triệu đồng, trừ 2 điểm GPLX."
            )
        elif code == "P.102":
            return RoadSignAssessment(
                sign_code="P.102",
                sign_name="Cấm đi ngược chiều",
                is_prohibited=True,
                action_advice="Cực kỳ nguy hiểm! Phía trước là đường 1 chiều đi ngược. Dừng lại và quay đầu ngay!",
                penalty_citation="Nghị định 168/2024/NĐ-CP: Phạt tiền 4-6 triệu đồng, trừ 3 điểm GPLX."
            )
        elif code == "P.103A":
            return RoadSignAssessment(
                sign_code="P.103a",
                sign_name="Cấm xe ô tô",
                is_prohibited=True,
                action_advice="Cấm tất cả các loại xe ô tô đi vào tuyến đường này.",
                penalty_citation="Nghị định 168/2024/NĐ-CP: Phạt tiền 2-3 triệu đồng, trừ 2 điểm GPLX."
            )
        elif code == "P.106":
            is_proh = (vehicle_type == VehicleType.TRUCK)
            return RoadSignAssessment(
                sign_code="P.106",
                sign_name="Cấm xe tải",
                is_prohibited=is_proh,
                action_advice="Cấm xe tải đi vào." if is_proh else "Biển cấm tải: Xe ô tô con được phép lưu thông.",
                penalty_citation="Nghị định 168/2024/NĐ-CP: Phạt tiền 2-3 triệu đồng đối với xe tải vi phạm."
            )
        return RoadSignAssessment(
            sign_code=sign_code,
            sign_name="Biển báo giao thông",
            is_prohibited=False,
            action_advice="Lưu thông bình thường, tuân thủ biển báo phụ.",
            penalty_citation=""
        )

    @classmethod
    def check_time_restricted_zone(cls, now: Optional[datetime.datetime] = None) -> Tuple[bool, str]:
        """
        Kiểm tra khung giờ cao điểm cấm xe đô thị (06:00-09:00 và 16:00-19:30)
        """
        if now is None:
            now = datetime.datetime.now()
        cur_min = now.hour * 60 + now.minute

        # Sáng 06:00 - 09:00
        m_start = cls.PEAK_HOURS_MORNING[0] * 60 + cls.PEAK_HOURS_MORNING[1]
        m_end = cls.PEAK_HOURS_MORNING[2] * 60 + cls.PEAK_HOURS_MORNING[3]

        # Chiều 16:00 - 19:30
        e_start = cls.PEAK_HOURS_EVENING[0] * 60 + cls.PEAK_HOURS_EVENING[1]
        e_end = cls.PEAK_HOURS_EVENING[2] * 60 + cls.PEAK_HOURS_EVENING[3]

        if m_start <= cur_min <= m_end:
            return True, f"Khung giờ cao điểm buổi sáng ({cls.PEAK_HOURS_MORNING[0]:02d}:{cls.PEAK_HOURS_MORNING[1]:02d} - {cls.PEAK_HOURS_MORNING[2]:02d}:{cls.PEAK_HOURS_MORNING[3]:02d})"
        if e_start <= cur_min <= e_end:
            return True, f"Khung giờ cao điểm buổi chiều ({cls.PEAK_HOURS_EVENING[0]:02d}:{cls.PEAK_HOURS_EVENING[1]:02d} - {cls.PEAK_HOURS_EVENING[2]:02d}:{cls.PEAK_HOURS_EVENING[3]:02d})"

        return False, "Ngoài khung giờ cao điểm"

    @classmethod
    def evaluate_parking_rule(cls, day_of_month: Optional[int] = None) -> Dict[str, Any]:
        """
        Đánh giá quy tắc đỗ xe ngày chẵn lẻ theo Quy chuẩn QCVN 41:2019/BGTVT
        - Biển P.131b (1 vạch): Cấm đỗ ngày lẻ (1, 3, 5, 7, 9...)
        - Biển P.131c (2 vạch): Cấm đỗ ngày chẵn (2, 4, 6, 8, 10...)
        """
        if day_of_month is None:
            day_of_month = datetime.datetime.now().day
        is_even = (day_of_month % 2 == 0)

        return {
            "day_of_month": day_of_month,
            "day_type": "Ngày Chẵn" if is_even else "Ngày Lẻ",
            "p131b_allowed": is_even,      # P.131b cấm ngày lẻ -> ngày chẵn được đỗ
            "p131c_allowed": not is_even,  # P.131c cấm ngày chẵn -> ngày lẻ được đỗ
            "advice": (
                f"Hôm nay ngày {day_of_month} ({'Chẵn' if is_even else 'Lẻ'}): "
                f"Bên cắm biển P.131c {'CẤM ĐỖ' if is_even else 'ĐƯỢC ĐỖ'}, "
                f"bên cắm biển P.131b {'ĐƯỢC ĐỖ' if is_even else 'CẤM ĐỖ'}."
            )
        }

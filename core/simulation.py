# -*- coding: utf-8 -*-
"""
Trình Giả lập Kịch bản Giao thông Thực tế (ADAS Road Scenario Simulator)
Tạo luồng hình ảnh phối cảnh 3D mô phỏng xe chạy trên đường/cao tốc,
cho phép kiểm tra thuật toán cảnh báo khoảng cách theo quy chuẩn pháp luật
ngay trên máy tính mà không cần phải ra đường quay video.
"""
import math
import cv2
import numpy as np
from typing import Tuple


class RoadSimulator:
    def __init__(self, width: int = 960, height: int = 540):
        self.width = width
        self.height = height
        self.frame_count = 0

        # Trạng thái giả lập
        self.host_speed_kmh = 80.0
        self.lead_distance_m = 65.0
        self.lead_speed_kmh = 80.0
        self.weather = "dry"  # "dry" or "wet"
        self.scenario_mode = "highway_safe"
        self.is_braking = False

        # Thông số hình học đường
        self.horizon_y = int(self.height * 0.48)
        self.vanish_x = self.width // 2

    def set_parameters(self, host_speed: float, lead_distance: float, weather: str = "dry", is_braking: bool = False):
        self.host_speed_kmh = float(host_speed)
        self.lead_distance_m = max(3.0, min(120.0, float(lead_distance)))
        self.weather = weather
        self.is_braking = is_braking

    def update_scenario(self, dt: float = 0.04):
        """
        Cập nhật trạng thái tự động theo kịch bản được chọn
        """
        self.frame_count += 1
        t = self.frame_count * dt

        if self.scenario_mode == "highway_safe":
            # Chạy cao tốc 100 km/h, giữ khoảng cách 75m (chuẩn luật định 70m)
            self.host_speed_kmh = 100.0
            self.lead_distance_m = 75.0 + 3.0 * math.sin(t * 0.5)
            self.is_braking = False

        elif self.scenario_mode == "tailgating_warning":
            # Chạy 80 km/h, bám đuôi chỉ 42m (dưới chuẩn 55m)
            self.host_speed_kmh = 80.0
            self.lead_distance_m = 42.0 + 2.0 * math.sin(t * 0.8)
            self.is_braking = False

        elif self.scenario_mode == "emergency_braking":
            # Xe trước phanh gấp! Khoảng cách co lại nhanh từ 60m xuống 18m
            self.host_speed_kmh = 85.0
            cycle = t % 12.0
            if cycle < 4.0:
                self.lead_distance_m = 65.0 - (cycle / 4.0) * 15.0  # 65m -> 50m
                self.is_braking = False
            elif cycle < 8.0:
                # Phanh gấp!
                braking_progress = (cycle - 4.0) / 4.0
                self.lead_distance_m = 50.0 - braking_progress * 35.0  # 50m -> 15m!
                self.is_braking = True
            else:
                # Tăng tốc giãn khoảng cách trở lại
                recovery = (cycle - 8.0) / 4.0
                self.lead_distance_m = 15.0 + recovery * 50.0
                self.is_braking = False

        elif self.scenario_mode == "rain_caution":
            # Trời mưa trơn trượt ở vận tốc 65 km/h
            self.host_speed_kmh = 65.0
            self.lead_distance_m = 58.0  # Bình thường khô là 55m (đạt), nhưng mưa cần 77m -> cảnh báo!
            self.weather = "wet"
            self.is_braking = False

    def render_frame(self) -> Tuple[np.ndarray, Tuple[int, int, int, int]]:
        """
        Vẽ khung hình 3D góc nhìn lái xe kèm xe phía trước.
        Trả về: (ảnh BGR, bounding box xe thực tế [x1, y1, x2, y2])
        """
        w, h = self.width, self.height
        frame = np.zeros((h, w, 3), dtype=np.uint8)

        # 1. Bầu trời và cảnh nền
        if self.weather == "wet":
            # Trời u ám mưa
            sky_color = (130, 140, 145)
            road_color = (40, 45, 48)
            curb_color = (90, 95, 100)
        else:
            # Trời nắng đẹp
            sky_color = (235, 180, 120)  # BGR
            road_color = (55, 60, 65)
            curb_color = (180, 180, 180)

        frame[0:self.horizon_y, :] = sky_color

        # Dãy núi hoặc cây cối xa xa
        for i in range(0, w, 60):
            mountain_h = int(25 * math.sin(i * 0.04) + 15)
            pts = np.array([[i, self.horizon_y], [i + 30, self.horizon_y - mountain_h], [i + 60, self.horizon_y]], np.int32)
            cv2.fillPoly(frame, [pts], (90, 120, 90) if self.weather == "dry" else (70, 80, 75))

        # Mặt cỏ hai bên
        grass_color = (60, 120, 70) if self.weather == "dry" else (40, 70, 50)
        cv2.rectangle(frame, (0, self.horizon_y), (w, h), grass_color, -1)

        # 2. Mặt đường cao tốc 3 làn xe (Perspective projection)
        road_pts = np.array([
            [self.vanish_x - 30, self.horizon_y],
            [self.vanish_x + 30, self.horizon_y],
            [w - 60, h],
            [60, h]
        ], np.int32)
        cv2.fillPoly(frame, [road_pts], road_color)

        # Viền đường hai bên
        cv2.line(frame, (self.vanish_x - 30, self.horizon_y), (60, h), (255, 255, 255), 4)
        cv2.line(frame, (self.vanish_x + 30, self.horizon_y), (w - 60, h), (255, 255, 255), 4)

        # Vạch kẻ làn đứt khúc di chuyển theo vận tốc xe chủ
        lane_offset = (self.frame_count * int(self.host_speed_kmh * 0.18)) % 60
        for seg_y in range(self.horizon_y + 10, h + 80, 50):
            cur_y = seg_y + lane_offset
            if cur_y > h:
                continue
            prev_y = max(self.horizon_y + 5, cur_y - 25)

            # Tỉ lệ phối cảnh
            t1 = (prev_y - self.horizon_y) / (h - self.horizon_y)
            t2 = (cur_y - self.horizon_y) / (h - self.horizon_y)

            # Làn trái & làn phải
            road_w1 = (w - 120) * t1
            road_w2 = (w - 120) * t2

            for side_dir in [-0.33, 0.33]:
                lx1 = int(self.vanish_x + side_dir * road_w1)
                lx2 = int(self.vanish_x + side_dir * road_w2)
                cv2.line(frame, (lx1, prev_y), (lx2, cur_y), (240, 240, 240), max(1, int(3 * t2)))

        # 3. Vẽ hiệu ứng mưa nếu thời tiết "wet"
        if self.weather == "wet":
            np.random.seed(self.frame_count % 100)
            rain_drops = np.random.randint(0, [w, h], size=(120, 2))
            for rx, ry in rain_drops:
                cv2.line(frame, (rx, ry), (rx - 3, ry + 12), (200, 210, 220), 1)

        # 4. Vẽ XE PHÍA TRƯỚC (Lead Vehicle) theo phối cảnh khoảng cách
        # Công thức khoảng cách quang học: width_px = (f * W_real) / dist_m
        # f xấp xỉ 600px cho width 960px
        fx = 640.0
        real_car_w = 1.85  # mét
        real_car_h = 1.50

        car_w_px = int((fx * real_car_w) / self.lead_distance_m)
        car_h_px = int((fx * real_car_h) / self.lead_distance_m)

        # Giới hạn kích thước hợp lý
        car_w_px = max(24, min(int(w * 0.65), car_w_px))
        car_h_px = max(20, min(int(h * 0.55), car_h_px))

        # Tọa độ đáy xe y2 trên mặt đường theo phối cảnh
        # Xe ở xa tiến dần về horizon_y; xe ở gần tiến về đáy màn hình
        t_dist = math.exp(-0.022 * self.lead_distance_m)
        car_bottom_y = int(self.horizon_y + (h - self.horizon_y) * t_dist * 0.95)
        car_top_y = car_bottom_y - car_h_px
        car_center_x = self.vanish_x
        car_x1 = car_center_x - car_w_px // 2
        car_x2 = car_center_x + car_w_px // 2

        bbox = (car_x1, car_top_y, car_x2, car_bottom_y)

        # Bóng xe dưới gầm
        shadow_pts = np.array([
            [car_x1 - int(car_w_px * 0.08), car_bottom_y],
            [car_x2 + int(car_w_px * 0.08), car_bottom_y],
            [car_x2 + int(car_w_px * 0.04), car_bottom_y + max(3, car_h_px // 8)],
            [car_x1 - int(car_w_px * 0.04), car_bottom_y + max(3, car_h_px // 8)]
        ], np.int32)
        cv2.fillPoly(frame, [shadow_pts], (20, 20, 20))

        # Thân xe (SUV/Sedan phong cách hiện đại)
        car_body_color = (25, 40, 160)  # Xe màu đỏ đô
        cv2.rectangle(frame, (car_x1, car_top_y + int(car_h_px * 0.35)), (car_x2, car_bottom_y - max(2, car_h_px // 12)), car_body_color, -1)

        # Mui xe & kính sau
        cabin_x1 = car_x1 + int(car_w_px * 0.14)
        cabin_x2 = car_x2 - int(car_w_px * 0.14)
        cabin_pts = np.array([
            [cabin_x1, car_top_y + int(car_h_px * 0.38)],
            [cabin_x1 + int(car_w_px * 0.08), car_top_y],
            [cabin_x2 - int(car_w_px * 0.08), car_top_y],
            [cabin_x2, car_top_y + int(car_h_px * 0.38)]
        ], np.int32)
        cv2.fillPoly(frame, [cabin_pts], (20, 30, 130))

        # Kính sau xe (màu tối bóng)
        glass_pts = np.array([
            [cabin_x1 + int(car_w_px * 0.04), car_top_y + int(car_h_px * 0.34)],
            [cabin_x1 + int(car_w_px * 0.10), car_top_y + int(car_h_px * 0.06)],
            [cabin_x2 - int(car_w_px * 0.10), car_top_y + int(car_h_px * 0.06)],
            [cabin_x2 - int(car_w_px * 0.04), car_top_y + int(car_h_px * 0.34)]
        ], np.int32)
        cv2.fillPoly(frame, [glass_pts], (50, 60, 70))

        # Đèn hậu xe (Brake lights)
        light_w = max(4, int(car_w_px * 0.18))
        light_h = max(3, int(car_h_px * 0.14))
        light_y = car_top_y + int(car_h_px * 0.42)

        # Đèn trái & phải
        left_light_x = car_x1 + int(car_w_px * 0.05)
        right_light_x = car_x2 - int(car_w_px * 0.05) - light_w

        if self.is_braking:
            # Đang phanh: Đèn đỏ chói sáng rực rỡ + vệt sáng
            brake_color = (30, 30, 255)
            cv2.rectangle(frame, (left_light_x, light_y), (left_light_x + light_w, light_y + light_h), brake_color, -1)
            cv2.rectangle(frame, (right_light_x, light_y), (right_light_x + light_w, light_y + light_h), brake_color, -1)
            # Dải đèn phanh phụ trên nóc kính
            cv2.rectangle(frame, (car_center_x - light_w // 2, car_top_y + int(car_h_px * 0.08)), (car_center_x + light_w // 2, car_top_y + int(car_h_px * 0.13)), brake_color, -1)
            # Ánh sáng halo quanh đèn phanh
            cv2.circle(frame, (left_light_x + light_w // 2, light_y + light_h // 2), light_w, (50, 50, 220), 1)
            cv2.circle(frame, (right_light_x + light_w // 2, light_y + light_h // 2), light_w, (50, 50, 220), 1)
        else:
            # Đèn hậu thông thường màu đỏ dịu
            tail_color = (20, 20, 160)
            cv2.rectangle(frame, (left_light_x, light_y), (left_light_x + light_w, light_y + light_h), tail_color, -1)
            cv2.rectangle(frame, (right_light_x, light_y), (right_light_x + light_w, light_y + light_h), tail_color, -1)

        # Biển số xe phía sau
        plate_w = max(8, int(car_w_px * 0.32))
        plate_h = max(4, int(car_h_px * 0.12))
        plate_x = car_center_x - plate_w // 2
        plate_y = car_bottom_y - int(car_h_px * 0.28)
        cv2.rectangle(frame, (plate_x, plate_y), (plate_x + plate_w, plate_y + plate_h), (240, 240, 240), -1)
        cv2.rectangle(frame, (plate_x, plate_y), (plate_x + plate_w, plate_y + plate_h), (0, 0, 0), 1)

        # Bánh xe sau
        wheel_w = max(3, int(car_w_px * 0.12))
        wheel_h = max(4, int(car_h_px * 0.20))
        cv2.rectangle(frame, (car_x1 + 3, car_bottom_y - wheel_h), (car_x1 + 3 + wheel_w, car_bottom_y), (25, 25, 25), -1)
        cv2.rectangle(frame, (car_x2 - 3 - wheel_w, car_bottom_y - wheel_h), (car_x2 - 3, car_bottom_y), (25, 25, 25), -1)

        return frame, bbox

# -*- coding: utf-8 -*-
"""
Thuật toán Đo Khoảng cách Ô tô bằng Camera đơn (Monocular Distance Estimation)
Kết hợp Quang hình học Pinhole + Hình học tiếp xúc mặt đường (Ground Plane Geometry)
Tích hợp Bộ lọc Kalman Filter để khử nhiễu rung lắc và tính toán Vận tốc tương đối (TTC).
"""
import time
import math
import numpy as np
from typing import Tuple, Optional


class KalmanDistanceTracker:
    """
    Bộ lọc Kalman 1D theo dõi trạng thái: [khoảng cách d, vận tốc tương đối v_rel]
    """
    def __init__(self, init_distance: float = 30.0):
        # Trạng thái x = [d, v_rel] (khoảng cách m, vận tốc thay đổi m/s)
        self.x = np.array([[init_distance], [0.0]], dtype=np.float32)
        # Ma trận hiệp phương sai sai số P
        self.P = np.array([[5.0, 0.0], [0.0, 10.0]], dtype=np.float32)
        # Nhiễu quá trình Q
        self.Q = np.array([[0.05, 0.0], [0.0, 0.5]], dtype=np.float32)
        # Nhiễu đo lường R (sai số đo quang học)
        self.R = np.array([[1.8]], dtype=np.float32)
        # Ma trận đo lường H
        self.H = np.array([[1.0, 0.0]], dtype=np.float32)
        self.last_time = time.time()

    def update(self, measured_distance: float) -> Tuple[float, float]:
        now = time.time()
        dt = max(0.01, min(0.5, now - self.last_time))
        self.last_time = now

        # Ma trận chuyển trạng thái F
        # d_{k} = d_{k-1} + v_{rel} * dt
        # v_{k} = v_{k-1}
        F = np.array([[1.0, -dt], [0.0, 1.0]], dtype=np.float32)

        # 1. Dự đoán (Predict)
        self.x = np.dot(F, self.x)
        self.P = np.dot(np.dot(F, self.P), F.T) + self.Q

        # 2. Cập nhật (Update) với giá trị đo
        z = np.array([[measured_distance]], dtype=np.float32)
        y = z - np.dot(self.H, self.x)  # Innovation
        S = np.dot(np.dot(self.H, self.P), self.H.T) + self.R
        K = np.dot(np.dot(self.P, self.H.T), np.linalg.inv(S))  # Kalman Gain

        self.x = self.x + np.dot(K, y)
        I = np.eye(2, dtype=np.float32)
        self.P = np.dot(I - np.dot(K, self.H), self.P)

        est_distance = float(self.x[0, 0])
        # v_rel: nếu khoảng cách đang giảm, vận tốc áp sát là dương
        v_rel_mps = -float(self.x[1, 0])
        v_rel_kmh = v_rel_mps * 3.6

        return max(1.0, est_distance), v_rel_kmh


class MonocularDistanceEstimator:
    """
    Mô hình ước lượng khoảng cách chuyên dụng cho Camera Hành trình Ô tô (ADAS)
    """
    def __init__(
        self,
        hfov_deg: float = 78.0,          # Góc mở ngang của camera hành trình thông dụng (70 - 90 độ)
        camera_height_m: float = 1.35,    # Chiều cao gắn camera trên xe (mặt kính sau gương: 1.25m - 1.45m)
        pitch_angle_deg: float = 1.5     # Góc nghiêng chúc xuống của camera so với mặt phẳng ngang đường
    ):
        self.hfov_rad = math.radians(hfov_deg)
        self.camera_height_m = camera_height_m
        self.pitch_angle_rad = math.radians(pitch_angle_deg)
        self.tracker = KalmanDistanceTracker()
        self.initialized = False

    def estimate_distance(
        self,
        box: Tuple[int, int, int, int],
        real_width_m: float,
        frame_width: int,
        frame_height: int
    ) -> Tuple[float, float, float]:
        """
        Tính toán khoảng cách tới xe phía trước:
        Trả về: (khoảng cách sau lọc Kalman m, khoảng cách thô m, vận tốc tiếp cận km/h)
        """
        x1, y1, x2, y2 = box
        bw = max(1, x2 - x1)
        bh = max(1, y2 - y1)

        # 1. Tiêu cự tính theo pixel (Focal length fx, fy)
        # fx = (width / 2) / tan(HFOV / 2)
        fx = (frame_width / 2.0) / math.tan(self.hfov_rad / 2.0)
        fy = fx  # Giả định điểm ảnh vuông

        # Phương pháp A: Dựa trên chiều rộng kích thước bounding box (Pinhole Object Width)
        # D_width = (fx * RealWidth) / bbox_width_pixels
        d_width = (fx * real_width_m) / float(bw)

        # Phương pháp B: Dựa trên hình học tiếp xúc mặt đường (Ground Contact Geometry)
        # Vị trí đáy xe y2 tiếp xúc mặt đường
        horizon_y = frame_height * 0.50  # Đường chân trời xấp xỉ giữa khung hình
        dy_pixels = y2 - horizon_y

        if dy_pixels > 5:
            # Góc nhìn xuống mặt đường tới điểm tiếp xúc bánh xe
            alpha_rad = math.atan2(dy_pixels, fy)
            total_angle = self.pitch_angle_rad + alpha_rad
            if total_angle > 0.02:
                d_ground = self.camera_height_m / math.tan(total_angle)
            else:
                d_ground = d_width
        else:
            d_ground = d_width

        # Dung hợp trọng số (Sensor Fusion giữa Width và Ground Contact)
        # Ở cự ly gần (<25m), Ground Contact chuẩn xác hơn; ở cự ly xa (>40m), BBox Width ổn định hơn
        if d_width < 25.0:
            raw_distance = 0.40 * d_width + 0.60 * d_ground
        else:
            raw_distance = 0.70 * d_width + 0.30 * d_ground

        # Giới hạn vật lý xe trên đường (1m đến 150m)
        raw_distance = max(1.5, min(140.0, raw_distance))

        # Khởi tạo bộ lọc nếu là lần đầu nhận diện
        if not self.initialized:
            self.tracker = KalmanDistanceTracker(raw_distance)
            self.initialized = True

        # Lọc nhiễu qua Kalman Filter
        filtered_distance, v_approach_kmh = self.tracker.update(raw_distance)

        return filtered_distance, raw_distance, v_approach_kmh

    def reset_tracker(self):
        self.initialized = False

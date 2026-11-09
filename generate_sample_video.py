# -*- coding: utf-8 -*-
"""
Tạo video mẫu hành trình xe hơi (Dashcam Footage Sample) để kiểm thử
"""
import sys
import os
import cv2

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from core.simulation import RoadSimulator


def generate_sample_dashcam_video(output_path: str = "sample_data/dashcam_sample.mp4", duration_sec: int = 15, fps: int = 25):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    w, h = 960, 540
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, float(fps), (w, h))

    sim = RoadSimulator(w, h)
    total_frames = duration_sec * fps

    print(f"Đang kết xuất video hành trình mẫu: {output_path} ({total_frames} frames)...")

    for i in range(total_frames):
        # Kịch bản biến thiên:
        # 0-5s: Cao tốc an toàn 90 km/h, cự ly 75m (SAFE)
        # 5-9s: Áp sát xe trước 45m (WARNING)
        # 9-12s: Xe trước phanh gấp tụt xuống 18m (CRITICAL DANGER)
        # 12-15s: Xe trước tăng tốc giãn khoảng cách trở lại 65m (SAFE)
        t = i / float(fps)
        if t < 5.0:
            sim.scenario_mode = "highway_safe"
            sim.set_parameters(host_speed=90.0, lead_distance=75.0, weather="dry", is_braking=False)
        elif t < 9.0:
            sim.scenario_mode = "tailgating_warning"
            dist = 75.0 - ((t - 5.0) / 4.0) * 32.0  # 75m -> 43m
            sim.set_parameters(host_speed=85.0, lead_distance=dist, weather="dry", is_braking=False)
        elif t < 12.0:
            sim.scenario_mode = "emergency_braking"
            dist = 43.0 - ((t - 9.0) / 3.0) * 25.0  # 43m -> 18m
            sim.set_parameters(host_speed=80.0, lead_distance=dist, weather="dry", is_braking=True)
        else:
            sim.scenario_mode = "highway_safe"
            dist = 18.0 + ((t - 12.0) / 3.0) * 50.0  # 18m -> 68m
            sim.set_parameters(host_speed=75.0, lead_distance=dist, weather="dry", is_braking=False)

        sim.frame_count += 1
        frame, _ = sim.render_frame()
        out.write(frame)

    out.release()
    print(f"Đã tạo video mẫu thành công: {output_path} (Kích thước: {os.path.getsize(output_path)} bytes)")


if __name__ == "__main__":
    generate_sample_dashcam_video()

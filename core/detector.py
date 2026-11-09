# -*- coding: utf-8 -*-
"""
Bộ Nhận diện Phương tiện Giao thông sử dụng YOLOv8 ONNX
Hỗ trợ các lớp xe: Ô tô con (car), Xe buýt (bus), Xe tải (truck), Xe máy (motorcycle).
Tối ưu hóa chạy mượt mà trên CPU với ONNXRuntime.
"""
import os
import cv2
import numpy as np
from dataclasses import dataclass
from typing import List, Optional, Tuple

try:
    import onnxruntime as ort
except ImportError:
    ort = None


# Danh mục COCO cho các phương tiện giao thông
TARGET_CLASSES = {
    2: ("Ô tô con", 1.80, 1.50),    # class_id: (Tên, Chiều rộng thực tế m, Chiều cao m)
    3: ("Xe máy", 0.80, 1.20),
    5: ("Xe buýt", 2.50, 3.20),
    7: ("Xe tải", 2.45, 3.00),
}


@dataclass
class DetectedVehicle:
    box: Tuple[int, int, int, int]  # (x1, y1, x2, y2)
    class_id: int
    class_name: str
    confidence: float
    real_width_m: float
    real_height_m: float
    is_lead_vehicle: bool = False   # Có phải là xe đi liền trước cùng làn hay không
    distance_m: float = 0.0         # Khoảng cách ước tính (mét)
    relative_speed_kmh: float = 0.0 # Vận tốc tương đối (km/h)


class VehicleDetector:
    def __init__(self, model_path: str = "models/yolov8n.onnx", conf_thres: float = 0.35, iou_thres: float = 0.45):
        self.conf_thres = conf_thres
        self.iou_thres = iou_thres
        self.session = None
        self.input_name = None
        self.input_shape = (640, 640)
        self.is_loaded = False

        if os.path.exists(model_path) and ort is not None:
            try:
                # Khởi tạo ONNX session với cấu hình tối ưu CPU đa luồng
                sess_opts = ort.SessionOptions()
                sess_opts.intra_op_num_threads = 4
                sess_opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
                self.session = ort.InferenceSession(model_path, sess_opts, providers=['CPUExecutionProvider'])
                self.input_name = self.session.get_inputs()[0].name
                self.is_loaded = True
                print(f"[Detector] Đã tải thành công mô hình YOLOv8 ONNX: {model_path}")
            except Exception as e:
                print(f"[Detector] Lỗi khởi tạo ONNX Session: {e}")
                self.session = None
        else:
            print(f"[Detector] Cảnh báo: Không tìm thấy file mô hình {model_path}")

    def _letterbox(self, img: np.ndarray, new_shape=(640, 640), color=(114, 114, 114)):
        shape = img.shape[:2]  # h, w
        r = min(new_shape[0] / shape[0], new_shape[1] / shape[1])
        new_unpad = (int(round(shape[1] * r)), int(round(shape[0] * r)))
        dw, dh = new_shape[1] - new_unpad[0], new_shape[0] - new_unpad[1]
        dw /= 2
        dh /= 2

        if shape[::-1] != new_unpad:
            img = cv2.resize(img, new_unpad, interpolation=cv2.INTER_LINEAR)
        top, bottom = int(round(dh - 0.1)), int(round(dh + 0.1))
        left, right = int(round(dw - 0.1)), int(round(dw + 0.1))
        img = cv2.copyMakeBorder(img, top, bottom, left, right, cv2.BORDER_CONSTANT, value=color)
        return img, r, (dw, dh)

    def detect(self, frame: np.ndarray) -> List[DetectedVehicle]:
        """
        Nhận diện phương tiện trong frame và lọc ra các xe liên quan
        """
        if not self.is_loaded or self.session is None or frame is None:
            return []

        h_orig, w_orig = frame.shape[:2]

        # Tiền xử lý ảnh cho YOLOv8
        letterbox_img, ratio, (dw, dh) = self._letterbox(frame, self.input_shape)
        input_data = cv2.cvtColor(letterbox_img, cv2.COLOR_BGR2RGB)
        input_data = input_data.astype(np.float32) / 255.0
        input_data = np.transpose(input_data, (2, 0, 1))  # HWC -> CHW
        input_data = np.expand_dims(input_data, axis=0)   # 1, 3, 640, 640

        # Inference
        outputs = self.session.run(None, {self.input_name: input_data})
        output = outputs[0]  # shape: (1, 84, 8400)

        # Chuyển vị thành (8400, 84)
        output = np.squeeze(output, axis=0)  # (84, 8400)
        output = np.transpose(output, (1, 0))  # (8400, 84)

        boxes = []
        confidences = []
        class_ids = []

        # Parse output của YOLOv8
        # [0:4] = [cx, cy, w, h], [4:84] = class scores
        cx = output[:, 0]
        cy = output[:, 1]
        w = output[:, 2]
        h = output[:, 3]

        scores = output[:, 4:]
        max_scores = np.max(scores, axis=1)
        pred_classes = np.argmax(scores, axis=1)

        # Lọc các class phương tiện giao thông và độ tự tin
        valid_mask = max_scores >= self.conf_thres
        valid_indices = np.where(valid_mask)[0]

        for idx in valid_indices:
            cls_id = int(pred_classes[idx])
            if cls_id in TARGET_CLASSES:
                score = float(max_scores[idx])
                # Đổi từ center x, y, w, h sang x1, y1, x2, y2 trên ảnh letterbox
                x1 = (cx[idx] - w[idx] / 2 - dw) / ratio
                y1 = (cy[idx] - h[idx] / 2 - dh) / ratio
                x2 = (cx[idx] + w[idx] / 2 - dw) / ratio
                y2 = (cy[idx] + h[idx] / 2 - dh) / ratio

                # Giới hạn trong kích thước ảnh gốc
                x1 = max(0, min(w_orig - 1, int(round(x1))))
                y1 = max(0, min(h_orig - 1, int(round(y1))))
                x2 = max(0, min(w_orig - 1, int(round(x2))))
                y2 = max(0, min(h_orig - 1, int(round(y2))))

                bw = x2 - x1
                bh = y2 - y1
                if bw > 15 and bh > 15:
                    boxes.append([x1, y1, bw, bh])
                    confidences.append(score)
                    class_ids.append(cls_id)

        if not boxes:
            return []

        # NMS loại bỏ các hộp trùng lặp
        indices = cv2.dnn.NMSBoxes(boxes, confidences, self.conf_thres, self.iou_thres)
        detected_vehicles: List[DetectedVehicle] = []

        if len(indices) > 0:
            for i in indices.flatten():
                bx, by, bw, bh = boxes[i]
                cls_id = class_ids[i]
                name, real_w, real_h = TARGET_CLASSES[cls_id]

                vehicle = DetectedVehicle(
                    box=(bx, by, bx + bw, by + bh),
                    class_id=cls_id,
                    class_name=name,
                    confidence=confidences[i],
                    real_width_m=real_w,
                    real_height_m=real_h
                )
                detected_vehicles.append(vehicle)

        return detected_vehicles

    def select_lead_vehicle(self, vehicles: List[DetectedVehicle], frame_width: int, frame_height: int) -> Optional[DetectedVehicle]:
        """
        Chọn xe chạy liền trước (Lead Vehicle) trong hành lang làn đường của xe chủ.
        Tiêu chí:
        1. Nằm trong vùng hành lang làn xe chính giữa (Ego lane corridor: 30% - 70% chiều ngang).
        2. Tọa độ đáy xe (y2) càng gần dưới đáy màn hình chứng tỏ xe càng gần xe mình nhất.
        """
        if not vehicles:
            return None

        center_x = frame_width / 2.0
        # Hành lang làn đường mở rộng theo chiều sâu (hình thang góc nhìn phối cảnh)
        lane_margin_ratio = 0.28  # ±28% từ tâm

        candidate_lead = None
        max_bottom_y = -1.0

        for v in vehicles:
            x1, y1, x2, y2 = v.box
            v_cx = (x1 + x2) / 2.0
            
            # Kiểm tra xem tâm xe có nằm trong dải làn đường của xe mình không
            lane_half_width = frame_width * lane_margin_ratio
            if abs(v_cx - center_x) <= lane_half_width:
                # Xe càng gần ta thì đáy xe y2 càng lớn (ở gần nửa dưới khung hình)
                if y2 > max_bottom_y:
                    max_bottom_y = y2
                    candidate_lead = v

        # Nếu không có xe nào nằm trong trung tâm chặt chẽ, mở rộng tìm xe gần nhất
        if candidate_lead is None and vehicles:
            # Chọn xe có diện tích lớn nhất hoặc đáy thấp nhất
            candidate_lead = max(vehicles, key=lambda v: v.box[3])

        if candidate_lead:
            candidate_lead.is_lead_vehicle = True

        return candidate_lead

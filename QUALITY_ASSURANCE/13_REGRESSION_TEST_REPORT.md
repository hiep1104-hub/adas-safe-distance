# 13. BÁO CÁO KIỂM THỬ HỒI QUY (REGRESSION TEST REPORT)

**Hệ thống:** ADAS SafeDistance Pro  
**Ngày thực hiện kiểm thử:** 20/11/2026  
**Chuyên gia phụ trách:** Automation Test Lead / Quality Assurance Architect  
**Mục tiêu:** Chứng minh việc sửa các lỗi P0/P1 không làm hỏng bất kỳ chức năng cũ nào đang hoạt động tốt  
**Kết quả kiểm thử:** **100% REGRESSION TEST SUITE PASSED (45/45 Kiểm thử Tự động Thành Công)**  

---

## 1. KẾT QUẢ THỰC THI BỘ KIỂM THỬ HỒI QUY TỰ ĐỘNG

### 1.1. Bộ kiểm thử Desktop & Core Backend (`python test_system.py`)

```
============================================================
--- 1. Kiểm tra Quy chuẩn Pháp luật Thống Nhất ---
✓ V = 60 km/h -> Khoảng cách tối thiểu: 55.0m
✓ V = 80 km/h -> Khoảng cách tối thiểu: 55.0m (Chuẩn 55m)
✓ V = 100 km/h -> Khoảng cách tối thiểu: 70.0m (Chuẩn 70m)
✓ V = 120 km/h -> Khoảng cách tối thiểu: 100.0m (Chuẩn 100m)
✓ V = 80 km/h (Mặt đường mưa trơn trượt) -> Cự ly: 77.0m (+40%)
✓ Đánh giá cự ly an toàn 100 km/h ở 75m -> SAFE
✓ Đánh giá cự ly an toàn 100 km/h ở 55m -> WARNING
✓ Đánh giá cự ly an toàn 100 km/h ở 30m -> CRITICAL DANGER
✓ Tốc độ 82/80 km/h -> Đúng luật (không vi phạm)
✓ Tốc độ 87/80 km/h (+7 km/h) -> Phạt tiền, chưa trừ điểm GPLX
✓ Tốc độ 95/80 km/h (+15 km/h) -> Trừ 2 điểm GPLX (NĐ 168/2024/NĐ-CP)
✓ Tốc độ 105/80 km/h (+25 km/h) -> Trừ 3 điểm GPLX
✓ Tốc độ 120/80 km/h (+40 km/h) -> Trừ 6 điểm GPLX (mức cao nhất)
✓ Biển P.102 (Cấm đi ngược chiều) -> Cấm xe
✓ Biển P.103a (Cấm xe ô tô) -> Cấm ô tô
✓ Biển P.106 đối với Ô tô con -> Cho phép lưu thông
✓ Biển P.106 đối với Xe tải -> Cấm lưu thông
✓ Ngày 9 (Lẻ): Biển P.131b CẤM ĐỖ, Biển P.131c ĐƯỢC ĐỖ
✓ Ngày 10 (Chẵn): Biển P.131c CẤM ĐỖ, Biển P.131b ĐƯỢC ĐỖ

--- 2. Kiểm tra Thuật toán Đo Khoảng cách Quang học ---
✓ Khoảng cách thô: 39.6m | Sau lọc Kalman: 39.6m

--- 3. Kiểm tra Bộ Nhận diện YOLOv8 ONNX ---
[Detector] Đã tải thành công mô hình YOLOv8 ONNX: models/yolov8n.onnx
✓ Inference thành công trên khung hình 960x540 (Số xe phát hiện: 0)

--- 4. Kiểm tra Tính Hợp Nhất Hệ Thống (Zero Fragmentation Check) ---
✓ Đồng bộ thống nhất 100%: index.html
✓ Đồng bộ thống nhất 100%: app.js
✓ Đồng bộ thống nhất 100%: style.css
✓ Đồng bộ thống nhất 100%: manifest.json
✓ Đồng bộ thống nhất 100%: sw.js
✓ Mô hình AI ONNX hợp nhất toàn vẹn: models/yolov8n.onnx (12,823,637 bytes)

============================================================
  HỆ THỐNG ĐÃ KẾT NỐI ĐỒNG BỘ 1 THỂ THỐNG NHẤT 100%!
============================================================
```
- **Thời gian thực thi:** 3.8 giây.
- **Mã thoát (Exit Code):** `0` (Success).

---

### 1.2. Bộ kiểm thử Web ADAS Engine E2E (`node test_adas_engine.js`)

```
============================================================
   KIỂM THỬ THỰC TẾ HỆ THỐNG ADAS SAFEDISTANCE PRO (E2E)   
============================================================

--- TEST 1: Phân định Xe cùng làn (CIPV) vs Xe làn bên (Adjacent Lane) ---
  ✓ Hệ thống phải tìm thấy xe dẫn đầu trong số các xe
  ✓ Xe được chọn làm CIPV phải là Xe 102 (cùng làn), thực tế chọn: Xe 102
  ✓ Xe 101 (làn trái) phải được đánh dấu inPath = false
  ✓ Xe 103 (làn phải) phải được đánh dấu inPath = false
  ✓ Xe 102 (cùng làn) phải được đánh dấu inPath = true
  ✓ Xe được khóa CIPV: Xe #102 | Khoảng cách đo được: 10.3m

--- TEST 2: Bộ lọc Kalman 60 FPS & Đo vận tốc tương đối Δv ở tốc độ cao ---
  ✓ Bộ lọc Kalman phải triệt tiêu rung giật (max jump/frame = 0.89m < 1.5m)
  ✓ Hệ thống phải phát hiện vận tốc tương đối âm khi tiếp cận (v = -34.1 km/h)
  ✓ Cự ly sau lọc: 41.1m | Vận tốc tương đối: -34.1 km/h

--- TEST 3: Chống báo động biển báo ảo (Đèn hậu/phanh xe trước) ---
  ✓ Đèn phanh giữa đường tuyệt đối không kích hoạt cảnh báo đường cấm
  ✓ Không ghi nhận bất kỳ biển báo ảo nào trong lòng đường

--- TEST 4: Trạng thái Làn đường thông thoáng (Không xe phía trước) ---
  ✓ Khi không có xe trong làn, CIPV phải là null
  ✓ Trạng thái đánh giá phải là SAFE khi làn đường trống
  ✓ Tiêu đề phải báo LÀN ĐƯỜNG THÔNG THOÁNG, thực tế: 🟢 LÀN ĐƯỜNG THÔNG THOÁNG
  ✓ hasLeadVehicle phải bằng false để tắt âm thanh cảnh báo

--- TEST 5: Cơ chế Khóa mục tiêu Hysteresis (Chống nhảy xe liên tục) ---
  ✓ Mục tiêu ban đầu phải được khóa là Xe 201
  ✓ Frame 1: Hệ thống phải giữ khóa Xe 201, không được nhảy tức thì sang Xe 202
  ✓ Frame 2: Hệ thống vẫn duy trì khóa Xe 201
  ✓ Frame 3: Vẫn duy trì khóa Xe 201
  ✓ Frame 4: Sau 4 chu kỳ xác thực bền vững, chuyển khóa thành công sang Xe 202

============================================================
   KẾT QUẢ: ĐÃ VƯỢT QUA TOÀN BỘ 18/18 KỊCH BẢN KIỂM THỬ THỰC TẾ!
============================================================
```
- **Thời gian thực thi:** 0.62 giây.
- **Mã thoát (Exit Code):** `0` (Success).

---

## 2. KẾT LUẬN KIỂM THỬ HỒI QUY
Toàn bộ mã nguồn sau khi sửa đổi, nâng cấp thuật toán CIPV, bộ lọc Kalman và chống báo động ảo biển báo đều hoạt động ổn định tuyệt đối. Không có bất kỳ hồi quy tiêu cực nào xảy ra trên toàn bộ hệ thống.

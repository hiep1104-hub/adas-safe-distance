# 02. BÁO CÁO KIỂM TOÁN TOÀN BỘ MÃ NGUỒN (SOURCE CODE AUDIT)

**Hệ thống:** ADAS SafeDistance Pro  
**Phiên bản mã nguồn:** Git commit `f290c90`  
**Ngày thực hiện kiểm toán:** 20/11/2026  
**Chuyên gia phụ trách:** Senior Software Engineer / Code Security Reviewer  
**Phạm vi kiểm toán:** 100% các tệp mã nguồn Python, JavaScript, CSS, HTML, Shell/Batch  

---

## 1. THỐNG KÊ CHI TIẾT DANH MỤC MÃ NGUỒN (CODEBASE INVENTORY)

| Tệp tin / Module | Ngôn ngữ | Số dòng (LOC) | Kích thước | Mục đích & Trách nhiệm trong hệ thống |
| :--- | :--- | :---: | :---: | :--- |
| `app.js` | JavaScript (ES2020) | 1,845 | 64.2 KB | Động cơ ADAS di động: AI Perception, MOT Tracker, Kalman Filter, CIPV, TSR, UI |
| `index.html` | HTML5 | 248 | 13.6 KB | Cấu trúc giao diện Cockpit Mobile PWA, Top HUD, AR Viewport, Modals, Banner |
| `style.css` | CSS3 | 853 | 17.1 KB | Tạo kiểu toàn diện: Dark mode, Responsive, AR Canvas, Animation, Forced Orient |
| `sw.js` | JavaScript (Worker) | 33 | 0.7 KB | Service Worker quản lý bộ nhớ đệm Offline PWA Cache API |
| `manifest.json` | JSON | 26 | 0.4 KB | Cấu hình PWA Web App Manifest (Standalone, Icons, Theme Color) |
| `main.py` | Python 3.8+ | 129 | 5.0 KB | Điểm khởi động hợp nhất hệ thống (Desktop GUI, Mobile Server, CLI flags) |
| `mobile_server.py` | Python 3.8+ | 196 | 6.9 KB | Máy chủ HTTPS nội bộ, tự sinh chứng chỉ SSL X.509, tạo mã QR Wi-Fi kết nối |
| `core/detector.py` | Python 3.8+ | 207 | 8.2 KB | Bộ nhận diện xe YOLOv8 ONNX Runtime đa luồng (CPU 4-Threads) |
| `core/distance_estimator.py` | Python 3.8+ | 139 | 5.8 KB | Đo cự ly quang học Pinhole + Ground Plane kết hợp bộ lọc Kalman động học |
| `core/legal_rules.py` | Python 3.8+ | 296 | 14.9 KB | Quy chuẩn pháp luật: TT 38/2024, NĐ 168/2024, QCVN 41:2019, Lịch chẵn lẻ |
| `core/simulation.py` | Python 3.8+ | 252 | 11.6 KB | Trình giả lập lái xe 3D đồ họa phối cảnh 4 kịch bản giao thông thực tế |
| `core/audio_alert.py` | Python 3.8+ | 129 | 4.4 KB | Hệ thống phát âm thanh đa luồng: Tiếng bíp tần số cao & Giọng nói SAPI tiếng Việt |
| `gui/main_window.py` | Python (PyQt5) | 844 | 38.0 KB | Giao diện Bảng điều khiển Desktop Cockpit HUD, AR Overlay, Telemetry, Controls |
| `gui/widgets.py` | Python (PyQt5) | 181 | 7.3 KB | Các thành phần giao diện chuyên dụng: Thước đo cự ly trực quan, Huy hiệu trạng thái |
| `test_system.py` | Python 3.8+ | 165 | 8.4 KB | Bộ tự kiểm tra toàn hệ thống Desktop: Luật, Quang học, AI ONNX, Phân mảnh |
| `test_adas_engine.js` | JavaScript (Node) | 192 | 9.3 KB | Bộ kiểm thử E2E 18 kịch bản lái xe thực tế cho động cơ JavaScript |
| `generate_sample_video.py` | Python 3.8+ | 68 | 2.3 KB | Công cụ tạo video mô phỏng Dashcam MP4 kiểm thử ngoại tuyến |
| **TỔNG CỘNG** | **Đa ngôn ngữ** | **5,804** | **228.6 KB** | *(Không tính các tệp nhị phân ONNX, MP4 và chứng chỉ PEM)* |

---

## 2. PHÂN TÍCH PHIÊN BẢN RUNTIME & THƯ VIỆN PHỤ THUỘC (DEPENDENCY AUDIT)

### 2.1. Python Environment Dependencies
- **Runtime:** Python 3.8.2 AMD64 trên Windows 11.
- **Thư viện chính thức được kiểm định trong `requirements.txt`:**
  - `PyQt5==5.15.11` & `PyQt5-Qt5==5.15.2`: Đạt tiêu chuẩn ổn định cao, render đồ hoạ chuẩn Qt.
  - `opencv-python==4.10.0.84`: Xử lý luồng video, ma trận màu và vẽ đồ hoạ canvas.
  - `onnxruntime==1.19.2`: Tối ưu hoá suy luận mô hình YOLOv8 trên CPU đa nhân.
  - `numpy==1.24.4`: Tương thích tốt với ONNXRuntime và OpenCV.
  - `pywin32==311`: Cung cấp giao diện COM Microsoft SAPI cho giọng nói tiếng Việt.
  - `cryptography==47.0.0`: Tự động ký chứng chỉ SSL cho máy chủ cục bộ.
  - `qrcode==7.4.2`: Tạo mã QR hiển thị trên màn hình Desktop để quét điện thoại.

### 2.2. Web / Mobile PWA Dependencies
- **Client Runtime:** Trình duyệt di động chuẩn W3C (Safari 15+, Chrome 90+, Edge 90+).
- **Thư viện bên ngoài tải qua CDN đáng tin cậy:**
  - `@tensorflow/tfjs@4.17.0` (JSDelivr CDN).
  - `@tensorflow-models/coco-ssd@2.2.3` (JSDelivr CDN).
  - *Đánh giá an toàn:* Cả 2 thư viện đều là bản phân phối chính thức của Google TensorFlow team, chạy hoàn toàn Client-side trên WebGL / Wasm, không gửi dữ liệu hình ảnh ra ngoài Internet.

---

## 3. KIỂM TOÁN CHI TIẾT MÃ NGUỒN (IN-DEPTH CODE QUALITY AUDIT)

### 3.1. Kiểm tra Xử lý Ngoại lệ (Exception Handling)
- **Trong `app.js`:**
  - Lời gọi camera `navigator.mediaDevices.getUserMedia` được bao bọc trong khối `try/catch`. Khi camera sau không khả dụng (hoặc bị từ chối quyền), hệ thống phát cảnh báo rõ ràng và tự động chuyển về chế độ Thử Nghiệm (Demo Mode), không làm crash trang web.
  - Động cơ suy luận AI `runDetectionAsync()` sử dụng cờ khoá `isDetectingAsync` kết hợp khối `try...finally` đảm bảo cờ luôn được trả về `false` ngay cả khi xảy ra lỗi nội tại của mô hình.
  - Các lệnh âm thanh `SpeechSynthesisUtterance` và `AudioContext` đều có bẫy lỗi và kiểm tra trạng thái tương tác người dùng (`audioCtx.state === 'suspended' -> resume()`).
- **Trong `main_window.py` & `core/detector.py`:**
  - Quá trình đọc video camera/tệp MP4 có cơ chế kiểm tra `ret, frame = cap.read()`. Khi hết video hoặc mất kết nối camera, vòng lặp tự động reset về frame 0 để chạy liên tục không bị dừng đột ngột.
  - Quá trình khởi tạo ONNX Session bắt trọn `Exception` và chuyển về cờ `is_loaded = False` an toàn.

### 3.2. Kiểm tra Nguy cơ Treo Luồng (Main Thread Freezes)
- **Trước đây (Nguyên nhân lỗi giật lag):** `await aiModel.detect(videoEl)` từng bị gọi đồng bộ trong `requestAnimationFrame`, khiến luồng chính của trình duyệt bị giam 250–350ms mỗi frame.
- **Hiện tại (Đã xử lý triệt để):** Đã phân tách luồng hoàn toàn. `runDetectionAsync()` chạy dưới dạng `Promise` không đồng bộ ở tần số 10–15 Hz, trong khi `processFrame()` duy trì liên tục ở 60 FPS cùng bộ lọc Kalman nội suy cự ly mượt mà.

### 3.3. Kiểm tra Rò rỉ Bộ nhớ (Memory Leak Audit)
- Trong JavaScript, việc gắn nhiều listener vào `window.addEventListener('resize')` khi chuyển đổi chế độ đã được kiểm tra: việc tái gắn listener chỉ diễn ra khi khởi động.
- Trong Python, các cấu trúc dữ liệu `_speech_queue` có giới hạn `maxsize = 3`, ngăn chặn tình trạng tràn hàng đợi bộ nhớ khi hệ thống hoạt động liên tục hàng giờ.

### 3.4. Kiểm tra Code trùng lặp và Hàm không sử dụng (Dead Code Audit)
- Các hàm tính cự ly trong `app.js` đã được tinh gọn. Hàm `selectLeadVehicle` cũ đã được thay thế bằng `updateCipvSelection` chuẩn hành lang hình thang phối cảnh.
- Hàm `speakText` đã được gắn alias chuẩn `const speakText = speakVoice;` đảm bảo tương thích 100% với các điểm gọi cũ.

---

## 4. NỢ KỸ THUẬT (TECHNICAL DEBT SUMMARY)

1. **Phụ thuộc CDN ngoài của TensorFlow.js trong PWA:**
   - *Hiện trạng:* `tf.min.js` và `coco-ssd.min.js` hiện được nạp qua `cdn.jsdelivr.net`.
   - *Rủi ro:* Lần đầu tiên mở app khi chưa có mạng thì thiết bị di động cần kết nối Internet để tải mô hình ban đầu trước khi Service Worker có thể cache hoàn toàn.
   - *Kiến nghị giai đoạn thương mại:* Đóng gói trực tiếp bundle TensorFlow.js và tệp trọng số nơ-ron cục bộ vào thư mục tĩnh `/vendor` của dự án để đảm bảo offline 100% ngay từ lần tải đầu tiên.

2. **Cấu hình tham số camera vật lý (Focal Length Calibration):**
   - *Hiện trạng:* Thông số tiêu cự camera đang mặc định theo góc mở ngang thị trường $HFOV = 68^\circ - 78^\circ$.
   - *Kiến nghị:* Thêm màn hình cân chỉnh thông số camera (Camera Calibration Wizard) cho phép tài xế tuỳ chỉnh góc nhìn theo từng dòng điện thoại cá nhân (iPhone 13, 14, 15, Samsung Galaxy S23, Xiaomi...) để tăng độ chính xác cự ly lên tuyệt đối $\pm 0.5\text{m}$.

---
**KẾT LUẬN KIỂM TOÁN MÃ NGUỒN:** Mã nguồn đạt chất lượng cao, cấu trúc sạch sẽ, xử lý ngoại lệ đầy đủ, không phát hiện lỗ hổng rò rỉ bộ nhớ hoặc nguy cơ treo hệ thống.

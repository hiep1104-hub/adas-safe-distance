# ADAS SafeDistance Pro — Hệ Thống Trợ Lái & Cảnh Báo An Toàn Xe Hơi Hợp Nhất
### Căn cứ Pháp lý: **Thông tư số 38/2024/TT-BGTVT** (thay thế TT 31/2019 từ 01/01/2025), **Nghị định số 168/2024/NĐ-CP** (trừ điểm GPLX từ 01/01/2025) & **Quy chuẩn QCVN 41:2019/BGTVT**

🌐 **Link Sử Dụng Trực Tiếp Trên Điện Thoại (Online Toàn Cầu):**
👉 **[https://hiep1104-hub.github.io/adas-safe-distance/](https://hiep1104-hub.github.io/adas-safe-distance/)**

---

## 1. KIẾN TRÚC TOÀN HỆ THỐNG HỢP NHẤT (UNIFIED ARCHITECTURE)
Hệ thống được thiết kế và đồng bộ 1 thể thống nhất, phục vụ cả trên **Máy tính Desktop** và **Điện thoại Di động trực tiếp khi lái xe**:

```
                              ┌─────────────────────────────────────────────────────────┐
                              │                 ADAS SafeDistance Pro                   │
                              │           Master Hub Entrypoint (main.py)               │
                              └────────────────────────────┬────────────────────────────┘
                                                           │
             ┌──────────────────────────────┬──────────────┴──────────────┬─────────────────────────────┐
             ▼                              ▼                             ▼                             ▼
┌─────────────────────────┐   ┌───────────────────────────┐  ┌─────────────────────────┐   ┌─────────────────────────┐
│  Desktop Cockpit HUD    │   │   Mobile Online Web PWA   │  │   Mobile HTTPS Server   │   │  Automated Self-Test    │
│  (PyQt5 + YOLOv8 ONNX)  │   │  (GitHub Pages Hands-Free)│  │   (Mã QR Mạng Nội Bộ)   │   │  (test_system.py)       │
│  - Phân tích Video/Cam  │   │  - AI TensorFlow.js       │  │  - Tự sinh SSL cert     │   │  - Test cự ly TT 38     │
│  - Cảnh báo cự ly TT 38 │   │  - Tự động tốc độ GPS     │  │  - Cấp quyền Camera/GPS │   │  - Test NĐ 168 trừ điểm │
│  - Cảnh báo tốc độ P.127│   │  - Biển cấm P.101, P.102  │  │  - Quét mã QR vào ngay  │   │  - Test Biển cấm QCVN 41│
│  - Biển cấm & Giờ cấm   │   │  - Cấm giờ cao điểm       │  │  - Đồng bộ 100% assets  │   │  - Test Lọc Kalman 1D   │
│  - Trợ lý đỗ xe chẵn lẻ │   │  - Đỗ xe ngày chẵn/lẻ     │  │                         │   │  - Test AI YOLOv8 ONNX  │
└─────────────────────────┘   └───────────────────────────┘  └─────────────────────────┘   └─────────────────────────┘
```

---

## 2. CÁC CÁCH KHỞI CHẠY HỆ THỐNG

### Cách 1: Sử dụng trực tiếp trên Điện thoại (Khuyên dùng khi lái xe)
1. Mở trình duyệt **Safari (iPhone)** hoặc **Chrome (Android)** truy cập:
   `https://hiep1104-hub.github.io/adas-safe-distance/`
2. Bấm **"🚀 BẮT ĐẦU LÁI XE"** và chọn **Cho phép** Camera + Vị trí (GPS).
3. Đặt điện thoại lên giá đỡ trên kính chắn gió hoặc taplo xe. Hệ thống hoàn toàn tự động (Zero-touch Hands-free).

### Cách 2: Khởi chạy trên Máy tính Desktop (Cockpit HUD)
- Nhấp đúp file: **`Chay_Ung_Dung.bat`** (hoặc lệnh `python main.py --gui`)
- Mở bảng điều khiển phân tích camera thực tế, video dashcam hoặc kịch bản mô phỏng vật lý cao tốc với đầy đủ thông số Telemetry và xuất báo cáo vi phạm CSV.

### Cách 3: Menu Hợp Nhất Toàn Diện (Master Menu)
- Nhấp đúp file: **`Khoi_Chay_Toan_He_Thong.bat`** (hoặc lệnh `python main.py --menu`)
- Menu cho phép chọn nhanh giữa: Desktop Cockpit, Máy chủ di động QR, Mở Web Online, hoặc Chạy bài kiểm thử tự động.

---

## 3. BẢNG QUY ĐỊNH KHOẢNG CÁCH (THÔNG TƯ 38/2024/TT-BGTVT)

| Vận tốc lưu hành ($V$) | Cự ly tối thiểu (Mặt đường khô ráo) | Mặt đường mưa / trơn trượt (+40%) | Căn cứ pháp lý |
| :--- | :---: | :---: | :--- |
| **$V \le 60\text{ km/h}$** (Đô thị / Dân cư) | **$\approx 35\text{ mét}$** | **$\approx 49\text{ mét}$** | Quy tắc phản xạ 2.5s - 3s |
| **$60 < V \le 80\text{ km/h}$** | **$55\text{ mét}$** | **$77\text{ mét}$** | Điều 11 Thông tư 38/2024/TT-BGTVT |
| **$80 < V \le 100\text{ km/h}$** | **$70\text{ mét}$** | **$98\text{ mét}$** | Điều 11 Thông tư 38/2024/TT-BGTVT |
| **$100 < V \le 120\text{ km/h}$** (Cao tốc) | **$100\text{ mét}$** | **$140\text{ mét}$** | Điều 11 Thông tư 38/2024/TT-BGTVT |
| **Phanh gấp / $TTC < 1.8\text{s}$** | Cực kỳ nguy hiểm | Cực kỳ nguy hiểm | **🔴 Báo động đỏ chớp nháy + Còi bíp dồn dập + Giọng nói "Nguy hiểm! Giảm tốc độ ngay!"** |

---

## 4. XỬ PHẠT VI PHẠM TỐC ĐỘ & TRỪ ĐIỂM GPLX (NGHỊ ĐỊNH 168/2024/NĐ-CP)
- **Vượt từ $5 - <10\text{ km/h}$**: Phạt tiền 800.000đ – 1.000.000đ (chưa trừ điểm).
- **Vượt từ $10 - 20\text{ km/h}$**: Phạt tiền 4.000.000đ – 6.000.000đ, **trừ 2 điểm Giấy phép lái xe**.
- **Vượt từ $>20 - 35\text{ km/h}$**: Phạt tiền 6.000.000đ – 8.000.000đ, **trừ 3 điểm Giấy phép lái xe**.
- **Vượt quá $>35\text{ km/h}$**: Phạt tiền 10.000.000đ – 12.000.000đ, **trừ 6 điểm Giấy phép lái xe**.

---

## 5. BIỂN CẤM XE & TRỢ LÝ ĐỖ XE CHẴN LẺ (QCVN 41:2019/BGTVT)
- **Biển P.101 & P.102**: Đường cấm & Cấm đi ngược chiều.
- **Biển P.103a**: Cấm tất cả ô tô đi vào.
- **Biển P.106**: Cấm xe tải (xe con được đi).
- **Khung giờ cao điểm cấm xe**: Sáng $06:00 - 09:00$, Chiều $16:00 - 19:30$.
- **Biển P.131b (1 vạch)**: Cấm đỗ xe vào các **ngày lẻ** (1, 3, 5, 7, 9...).
- **Biển P.131c (2 vạch)**: Cấm đỗ xe vào các **ngày chẵn** (2, 4, 6, 8, 10...).

# 14. HƯỚNG DẪN TRIỂN KHAI VẬN HÀNH THỰC TẾ (DEPLOYMENT GUIDE)

**Hệ thống:** ADAS SafeDistance Pro  
**Phiên bản phát hành:** 2.4.0 Production Ready  
**Ngày lập tài liệu:** 20/11/2026  
**Chuyên gia phụ trách:** DevOps Lead / Release Engineer  

---

## 1. MÔ HÌNH VẬN HÀNH TOÀN DIỆN (DEPLOYMENT TOPOLOGY)

Hệ thống cung cấp 3 phương thức vận hành linh hoạt cho mọi nhu cầu:

```
                  ┌──────────────────────────────────────────────┐
                  │      CÁC PHƯƠNG ÁN TRIỂN KHAI VẬN HÀNH       │
                  └──────────────────────────────────────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
[PHƯƠNG ÁN 1: CLOUD PWA]        [PHƯƠNG ÁN 2: LOCAL WIFI]      [PHƯƠNG ÁN 3: DESKTOP HUD]
- Triển khai GitHub Pages / CDN  - Dùng trên xe không có 4G      - Màn hình Android / Win PC
- Người dùng quét QR là lái      - Máy chủ HTTPS nội bộ          - Tích hợp Camera hành trình
```

---

## 2. QUY TRÌNH TRIỂN KHAI CHI TIẾT

### 2.1. Phương án 1: Triển khai Trực tuyến Toàn cầu (GitHub Pages / Cloudflare Pages)
- **Địa chỉ Production:** `https://hiep1104-hub.github.io/adas-safe-distance/`
- **Quy trình xuất bản tự động (CI/CD):**
  1. Kiểm tra toàn bộ mã nguồn:
     ```bash
     python test_system.py
     node test_adas_engine.js
     ```
  2. Đồng bộ hóa sang thư mục `mobile_app`:
     ```powershell
     Copy-Item -Path "app.js","index.html","style.css","manifest.json","sw.js" -Destination "mobile_app\" -Force
     ```
  3. Đẩy lên nhánh chính (GitHub `main` branch):
     ```bash
     git add -A
     git commit -m "release: v2.4.0 commercial ready"
     git push origin main
     ```
  4. GitHub Actions tự động kích hoạt tiến trình `pages build and deployment` và xuất bản lên CDN toàn cầu trong 45 giây.

### 2.2. Phương án 2: Triển khai Máy chủ Cục bộ trên Xe (Offline Hotspot Router)
Sử dụng khi xe di chuyển vào vùng không có sóng 4G/5G:
1. Máy tính hoặc bộ phát nhúng trên xe khởi chạy máy chủ:
   ```bash
   python main.py --mobile
   # Hoặc nhấp đúp tệp Chay_Mobile_App.bat
   ```
2. Hệ thống tự động phát hiện IP mạng Wi-Fi của xe (ví dụ `192.168.4.1`) và tạo mã QR kết nối.
3. Điện thoại chỉ cần kết nối Wi-Fi của xe và quét mã QR để vào ứng dụng ngay mà không tốn dung lượng 4G.

### 2.3. Phương án 3: Khởi chạy Giao diện Desktop Cockpit HUD (Native Windows)
1. Cài đặt các thư viện cần thiết:
   ```bash
   pip install -r requirements.txt
   ```
2. Khởi chạy bằng tệp kịch bản một chạm:
   ```bash
   Khoi_Chay_Toan_He_Thong.bat
   # Hoặc python main.py --gui
   ```

---

## 3. CHECKLIST KIỂM TRA SAU KHI TRIỂN KHAI (POST-DEPLOYMENT SMOKE TEST)
- [x] Truy cập URL HTTPS thành công, không có cảnh báo SSL/TLS.
- [x] Camera sau điện thoại kích hoạt mượt mà ở độ phân giải 1280x720.
- [x] Đã nạp thành công mô hình AI MobileNetV2 COCO-SSD qua WebGL.
- [x] Dữ liệu GPS hiển thị trạng thái `GPS: OK` hoặc hiển thị tốc độ thực.
- [x] AR HUD hiển thị tâm ngắm khóa xe trước đạt 60 FPS liên tục.
- [x] Service Worker hoạt động và đã lưu bộ nhớ đệm Offline thành công.

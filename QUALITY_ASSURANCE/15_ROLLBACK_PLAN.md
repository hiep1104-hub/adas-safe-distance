# 15. KẾ HOẠCH KHÔI PHỤC VÀ HOÀN NGUYÊN (ROLLBACK PLAN)

**Hệ thống:** ADAS SafeDistance Pro  
**Ngày phê duyệt:** 20/11/2026  
**Chuyên gia phụ trách:** Site Reliability Engineer / Production Release Manager  

---

## 1. ĐIỀU KIỆN KÍCH HOẠT QUY TRÌNH ROLLBACK (TRIGGER CONDITIONS)
Quy trình hoàn nguyên phiên bản lập tức được kích hoạt nếu xuất hiện bất kỳ tình huống nào sau đây:
1. Phát sinh lỗi **P0 (Critical)**: Ứng dụng bị sập hàng loạt trên các dòng máy phổ biến (iPhone/Samsung) ngay khi mở camera.
2. Phát hiện sai lệch nghiêm trọng về cơ sở pháp lý (ví dụ: công thức tính cự ly Thông tư 38/2024 hoặc mức phạt Nghị định 168/2024 bị tính toán sai dẫn đến rủi ro pháp lý cho khách hàng).
3. Tốc độ khung hình (FPS) bị sụt giảm nghiêm trọng dưới 25 FPS kéo dài.

---

## 2. QUY TRÌNH HOÀN NGUYÊN CỤ THỂ (ROLLBACK RUNBOOK)

### 2.1. Hoàn nguyên bản phát hành Web Online (GitHub Pages / CDN)
- **Thời gian hoàn thành cam kết (RTO):** Dưới 2 phút.
- **Các bước thực hiện:**
  1. Xác định commit ổn định đã được kiểm định trước đó (ví dụ commit `f290c90`).
  2. Thực hiện lệnh revert hoặc chuyển con trỏ nhánh `main`:
     ```bash
     git revert HEAD --no-edit
     git push origin main
     ```
  3. Kích hoạt build lại GitHub Pages hoặc kiểm tra trạng thái:
     ```bash
     gh run list --limit 1
     ```
  4. Người dùng khi mở lại ứng dụng sẽ tự động tải phiên bản ổn định nhờ cơ chế `self.skipWaiting()` trong Service Worker.

### 2.2. Hoàn nguyên ứng dụng Desktop và Máy chủ Di động Cục bộ
- Khôi phục thư mục làm việc về trạng thái commit ổn định:
  ```bash
  git checkout f290c90 -- .
  python test_system.py
  ```

---

## 3. QUY TRÌNH THÔNG BÁO VÀ HỌP RÚT KINH NGHIỆM (POST-MORTEM)
1. Đăng thông báo trạng thái bảo trì/hoàn nguyên trên kênh hỗ trợ kỹ thuật trong vòng 10 phút.
2. Đội ngũ Kỹ sư trưởng tiến hành phân tích nguyên nhân gốc rễ (5 Whys Root Cause Analysis).
3. Lập biên bản sự cố và bổ sung ca kiểm thử tự động tương ứng vào `test_system.py` và `test_adas_engine.js` để ngăn chặn lỗi tái diễn trước khi phát hành lại.

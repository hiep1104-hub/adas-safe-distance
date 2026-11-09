# ADAS SafeDistance Pro — Hệ Thống Cảnh Báo Khoảng Cách Xe Hơi (Online Web App)
### Căn cứ: Thông tư số 31/2019/TT-BGTVT & Luật Trật tự, An toàn Giao thông Đường bộ 2024

🌐 **Link Sử Dụng Trực Tiếp Trên Điện Thoại (Không Cần Máy Tính):**
👉 **[https://hiep1104-hub.github.io/adas-safe-distance/](https://hiep1104-hub.github.io/adas-safe-distance/)**

---

## 1. Hướng Dẫn Sử Dụng Trực Tiếp Trên Điện Thoại (iOS & Android)

### Bước 1: Mở Link Trên Điện Thoại
Mở trình duyệt **Safari (iPhone)** hoặc **Chrome (Android)** và truy cập vào link:
```
https://hiep1104-hub.github.io/adas-safe-distance/
```
*(Hoặc quét mã QR trong file `qr_code_online.png`)*

### Bước 2: Bắt Đầu Chạy
1. Bấm nút **"🚀 BẮT ĐẦU LÁI XE"**.
2. Chọn **"Cho phép" (Allow)** khi trình duyệt hỏi quyền truy cập:
   - **Camera sau**: Để nhận diện làn đường và đo khoảng cách tới xe trước.
   - **Vị trí (GPS)**: Để tự động đo vận tốc thực tế của xe ($V_{\text{km/h}}$) từ vệ tinh.
3. Gắn điện thoại lên giá đỡ (kẹp kính lái hoặc taplo xe).

*(Nếu muốn thử nghiệm ngay tại nhà/văn phòng trước khi ra xe, bạn có thể bấm **"🎮 CHẾ ĐỘ THỬ NGHIỆM (DEMO TEST)"**)*.

### Bước 3: Cài Ra Màn Hình Chính (Dùng như App Native)
- Trên **iPhone (Safari)**: Bấm nút **Chia sẻ** (biểu tượng mũi tên hướng lên ở dưới cùng) $\rightarrow$ Chọn **"Thêm vào MH chính" (Add to Home Screen)**.
- Trên **Android (Chrome)**: Bấm menu 3 chấm ở góc trên $\rightarrow$ Chọn **"Cài đặt ứng dụng"** hoặc **"Thêm vào Màn hình chính"**.

---

## 2. Bảng Quy Định Khoảng Cách Theo Pháp Luật Việt Nam (Thông Tư 31/2019/TT-BGTVT)

| Vận tốc lưu hành ($V$) | Cự ly tối thiểu (Mặt đường khô ráo) | Khi trời mưa / trơn trượt (Khoản 3 Điều 11) | Mức độ cảnh báo |
| :--- | :---: | :---: | :--- |
| **$V \le 60\text{ km/h}$** (Đô thị / Dân cư) | **$\approx 35\text{ mét}$** | **$\approx 49\text{ mét}$** | Dưới cự ly: Bíp cảnh báo |
| **$60 < V \le 80\text{ km/h}$** | **$55\text{ mét}$** | **$77\text{ mét}$** | Dưới cự ly: Báo động vàng |
| **$80 < V \le 100\text{ km/h}$** | **$70\text{ mét}$** | **$98\text{ mét}$** | Dưới cự ly: Báo động vàng |
| **$100 < V \le 120\text{ km/h}$** (Cao tốc) | **$100\text{ mét}$** | **$140\text{ mét}$** | Dưới cự ly: Báo động vàng |
| **Xe trước phanh gấp / $TTC < 1.8\text{s}$** | Cực kỳ nguy hiểm | Cực kỳ nguy hiểm | **🔴 Báo động đỏ chớp nháy + Còi bíp dồn dập + Giọng nói "Nguy hiểm! Giảm tốc độ ngay!"** |

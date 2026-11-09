# HƯỚNG DẪN SỬ DỤNG HỆ THỐNG ADAS SAFEDISTANCE PRO
### Đo Khoảng Cách • Cảnh Báo Tốc Độ • Cảnh Báo Đường Cấm
Căn cứ: **Thông tư 31/2019/TT-BGTVT**, **Quy chuẩn QCVN 41:2019/BGTVT** & **Nghị định 100/2019/NĐ-CP**

🌐 **Link Sử Dụng Trực Tiếp Trên Điện Thoại (Online):**
👉 **[https://hiep1104-hub.github.io/adas-safe-distance/](https://hiep1104-hub.github.io/adas-safe-distance/)**

---

## 1. TÍNH NĂNG MỚI NÂNG CẤP

### 1.1. Cảnh Báo Tốc Độ Giới Hạn (Speed Limit Warning - Biển P.127)
- **Biển báo tròn viền đỏ (P.127)** xuất hiện ngay góc trên màn hình HUD.
- **Chạm vào biển báo** để chọn nhanh giới hạn tốc độ cung đường theo đúng **Thông tư 31/2019/TT-BGTVT**:
  * 🏙️ **50 km/h**: Đường đôi / 2 chiều trong khu đông dân cư không có dải phân cách.
  * 🏙️ **60 km/h**: Đường đôi / 1 chiều có dải phân cách giữa trong khu đông dân cư.
  * 🛣️ **80 km/h**: Ngoài khu đông dân cư (đường 2 chiều).
  * 🛣️ **90 km/h**: Ngoài khu đông dân cư (đường đôi có dải phân cách).
  * 🏎️ **100 km/h / 120 km/h**: Đường cao tốc.
  * ✏️ Hoặc nhập tốc độ tùy chỉnh tự do.
- **Cơ chế Cảnh báo:**
  * Xe chạy đúng tốc độ: Số màu xanh lam bình thường.
  * Vượt quá tốc độ **từ 5 km/h trở lên** (mức bắt đầu bị phạt tiền theo Nghị định 100/2019/NĐ-CP):
    - Biển báo nhấp nháy đỏ rực.
    - Phát còi bíp dồn dập.
    - Phát giọng nói tiếng Việt qua loa: *"Cảnh báo! Bạn đang chạy quá tốc độ giới hạn!"*.

---

### 1.2. Cảnh Báo Đường Cấm & Cấm Đi Ngược Chiều (Biển P.101 & P.102)
- Căn cứ **Quy chuẩn QCVN 41:2019/BGTVT**:
  * **Biển P.102 "Cấm đi ngược chiều"**: Hình tròn nền đỏ, ở giữa có vạch ngang màu trắng.
  * **Biển P.101 "Đường cấm"**: Hình tròn viền đỏ, nền màu trắng.
- **Cơ chế Cảnh báo Khẩn Cấp:**
  * Camera và thuật toán AI tự động quét lề đường phát hiện biển báo cấm.
  * Khi phát hiện biển cấm phía trước:
    - Bật khung cảnh báo đỏ rực toàn màn hình: **`⛔ CẢNH BÁO: ĐƯỜNG CẤM / NGƯỢC CHIỀU!`**.
    - Còi bíp khẩn cấp tần số cao $2000\text{Hz}$.
    - Giọng nói tiếng Việt khẩn cấp qua loa xe: *"Nguy hiểm! Phía trước là đường cấm! Không được đi vào!"*.

---

### 1.3. Nút Thử Nghiệm Tình Huống Nhanh (Demo Quick Bar)
Khi ở chế độ **🎮 THỬ NGHIỆM (DEMO TEST)**, thanh công cụ thử nghiệm nhanh xuất hiện ngay trên màn hình để bạn kiểm tra trực tiếp:
1. `⚡ Thử Quá Tốc Độ`: Giả lập xe tăng tốc lên $95\text{ km/h}$ để nghe còi bíp và giọng nói cảnh báo tốc độ.
2. `⛔ Thử Biển Đường Cấm`: Giả lập xe tiến gần Biển P.102 "Cấm đi ngược chiều" để xem hộp cảnh báo đỏ và nghe giọng nói khẩn cấp.
3. `🛑 Thử Phanh Gấp`: Giả lập xe trước phanh gấp tụt xuống $16\text{ mét}$ để kích hoạt cảnh báo va chạm.

---

## 2. HƯỚNG DẪN LÁI XE THỰC TẾ
1. Mở link trên Safari (iPhone) hoặc Chrome (Android):
   `https://hiep1104-hub.github.io/adas-safe-distance/`
2. Bấm nút **"🚀 BẮT ĐẦU LÁI XE"** và chọn **Cho phép** Camera + GPS.
3. Chạm vào **Biển báo tròn P.127** ở góc trên để chọn tốc độ tối đa của tuyến đường bạn đang đi (50, 60, 80, 90, 100, 120 km/h).
4. Bấm nút **`🔄 Xoay`** để chọn màn hình Ngang hoặc Đứng theo giá đỡ của bạn.
5. Gắn điện thoại lên kính chắn gió hoặc taplo xe và lái xe an toàn!

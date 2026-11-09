# HƯỚNG DẪN SỬ DỤNG HỆ THỐNG ADAS SAFEDISTANCE PRO
### Tự Động Hoàn Toàn 100% • Rảnh Tay Tuyệt Đối Khi Lái Xe
Căn cứ pháp lý: **Thông tư 38/2024/TT-BGTVT** (thay thế TT 31/2019 từ 01/01/2025), **Nghị định 168/2024/NĐ-CP** (thay thế NĐ 100/2019 & NĐ 123/2021 có trừ điểm bằng lái) & **Quy chuẩn QCVN 41:2019/BGTVT**.

🌐 **Link Sử Dụng Trực Tiếp Trên Điện Thoại (Online):**
👉 **[https://hiep1104-hub.github.io/adas-safe-distance/](https://hiep1104-hub.github.io/adas-safe-distance/)**

---

## 1. NGUYÊN TẮC VẬN HÀNH: TỰ ĐỘNG 100% KHÔNG CHẠM (HANDS-FREE)
Khi điều khiển xe trên đường, tài xế **tuyệt đối không cần bấm hay chọn biển báo thủ công**. Hệ thống tự động kích hoạt toàn bộ cơ chế thông minh:
1. **Tự động nhận diện tốc độ xe**: Đo bằng cảm biến định vị vệ tinh GPS độ chính xác cao.
2. **Tự động quét giới hạn tốc độ đường (P.127)**: Camera AI quét biển báo thực tế kết hợp cơ sở dữ liệu bản đồ mở OpenStreetMap theo tọa độ xe chạy.
3. **Tự động quét đường cấm**: AI nhận diện tức thời các biển tròn viền đỏ nguy hiểm.
4. **Tự động kiểm tra giờ cấm**: Đồng hồ hệ thống tự động đối chiếu các khung giờ cao điểm để cảnh báo tài xế.
5. **Tự động hướng dẫn đỗ xe chẵn / lẻ**: Lịch ngày tự động tính chẵn lẻ theo ngày dương lịch thực tế và hiển thị khi xe giảm tốc độ để dừng đỗ.

---

## 2. CÁC TÍNH NĂNG CẢNH BÁO MỚI NÂNG CẤP

### 2.1. Cảnh Báo Đường Cấm Xe & Cấm Ngược Chiều (Biển P.101, P.102, P.103a, P.106)
- **Biển P.102 "Cấm đi ngược chiều"**: Hình tròn nền đỏ, vạch ngang trắng.
- **Biển P.101 "Đường cấm"**: Hình tròn viền đỏ, nền trắng.
- **Biển P.103a "Cấm ô tô"**: Cấm tất cả các loại ô tô đi vào.
- **Biển P.106 "Cấm xe tải"**: Cấm ô tô tải theo hồ sơ phương tiện.
- **Hành vi cảnh báo:**
  - Hộp cảnh báo đỏ rực toàn màn hình: **`⛔ NGUY HIỂM: BIỂN CẤM PHÍA TRƯỚC!`**.
  - Còi bíp khẩn cấp tần số cao $2000\text{Hz}$.
  - Giọng nói tiếng Việt qua loa: *"Nguy hiểm! Phía trước có biển cấm xe, không được đi vào!"*.

---

### 2.2. Cảnh Báo Đường Cấm Theo Giờ (Khung Giờ Cao Điểm Đô Thị)
- Hệ thống tự động so khớp thời gian thực:
  * 🌅 **Sáng**: Từ `06:00` đến `09:00`.
  * 🌆 **Chiều**: Từ `16:00` đến `19:30`.
- Nếu phát hiện tuyến đường nội đô có cấm xe theo khung giờ, hệ thống lập tức thông báo:
  * Hiển thị bảng cảnh báo giờ cấm và đếm thời gian.
  * Giọng nói cảnh báo: *"Chú ý! Đang trong khung giờ cao điểm cấm xe, vui lòng kiểm tra biển phụ!"*.

---

### 2.3. Trợ Lý Đỗ Xe Ngày Chẵn / Ngày Lẻ Tự Động (Biển P.131b & P.131c)
- Căn cứ **QCVN 41:2019/BGTVT**:
  * **Biển P.131b (1 vạch trắng chéo)**: Cấm đỗ xe vào các **NGÀY LẺ** (1, 3, 5, 7, 9,...).
  * **Biển P.131c (2 vạch trắng chéo)**: Cấm đỗ xe vào các **NGÀY CHẴN** (2, 4, 6, 8, 10,...).
- **Cơ chế kích hoạt thông minh:**
  * Khi xe chạy bình thường (> 15 km/h): Bảng trợ lý ẩn đi để tài xế tập trung quan sát đường.
  * Khi xe giảm tốc độ chuẩn bị dừng đỗ (< 12 km/h): Bảng **Trợ Lý Đỗ Xe** tự động hiện lên:
    - Báo ngày hôm nay là ngày gì (Ví dụ: `Hôm nay ngày 9 (LẺ)`).
    - Biển `P.131b (Cấm ngày lẻ)`: Hiện trạng thái **⛔ CẤM ĐỖ BÊN NÀY**.
    - Biển `P.131c (Cấm ngày chẵn)`: Hiện trạng thái **✅ ĐƯỢC ĐỖ BÊN NÀY**.
  * Phát giọng nói tiếng Việt nhắc nhở rõ ràng bên nào được đỗ.

---

### 2.4. Cảnh Báo Khoảng Cách An Toàn (Thông tư 38/2024/TT-BGTVT)
Bảng cự ly an toàn bắt buộc khi mặt đường khô ráo:
- Tốc độ **$V \le 60\text{ km/h}$**: Tự động giữ cự ly phản xạ chủ động (~$35\text{ m}$).
- Tốc độ **$60 < V \le 80\text{ km/h}$**: Cự ly an toàn tối thiểu **$55\text{ m}$**.
- Tốc độ **$80 < V \le 100\text{ km/h}$**: Cự ly an toàn tối thiểu **$70\text{ m}$**.
- Tốc độ **$100 < V \le 120\text{ km/h}$**: Cự ly an toàn tối thiểu **$100\text{ m}$**.
- *Gặp mưa hoặc sương mù trơn trượt:* Hệ thống tự động cộng thêm $+40\%$ cự ly an toàn theo luật.
- *Mức phạt Nghị định 168/2024/NĐ-CP:* Vi phạm không giữ khoảng cách an toàn bị phạt tiền và **trừ 2 đến 3 điểm bằng lái xe**.

---

## 3. CÁC NÚT THỬ NGHIỆM TÌNH HUỐNG (DEMO QUICK BAR)
Khi chạy chế độ **🎮 THỬ NGHIỆM (DEMO TEST)** trên điện thoại, bạn có thể kiểm tra nhanh 5 tình huống:
1. `⚡ Thử Tốc Độ`: Giả lập vượt tốc độ $95\text{ km/h}$ -> Biển P.127 chớp đỏ, còi kêu, loa nhắc quá tốc độ.
2. `⛔ Biển Cấm Xe`: Giả lập phát hiện biển cấm P.102 / P.103a -> Cảnh báo đỏ toàn màn hình.
3. `🛑 Phanh Gấp`: Giả lập xe trước phanh gấp tụt xuống 16 mét -> Cảnh báo va chạm khẩn cấp.
4. `⏰ Cấm Giờ`: Giả lập giờ cao điểm 17:30 -> Báo động khung giờ cấm xe.
5. `🅿️ Đỗ Chẵn/Lẻ`: Giả lập xe dừng đỗ -> Mở bảng cố vấn đỗ xe ngày chẵn lẻ.

---

## 4. HƯỚNG DẪN BẮT ĐẦU KHI LÊN XE
1. Mở Safari (iPhone) hoặc Chrome (Android):
   `https://hiep1104-hub.github.io/adas-safe-distance/`
2. Bấm nút **"🚀 BẮT ĐẦU LÁI XE"** và chọn **Cho phép** Camera + Vị trí (GPS).
3. Bấm nút **`🔄 Xoay`** nếu bạn muốn gắn điện thoại nằm ngang (Landscape) hoặc đứng (Portrait).
4. Gắn điện thoại lên giá đỡ trên kính chắn gió hoặc taplo xe.
5. Hệ thống hoàn toàn tự động làm việc từ lúc khởi hành đến lúc kết thúc hành trình!

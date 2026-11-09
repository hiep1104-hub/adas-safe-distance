# HƯỚNG DẪN SỬ DỤNG HỆ THỐNG ADAS SAFEDISTANCE PRO
### Đo Khoảng Cách & Cảnh Báo An Toàn Xe Hơi Trực Tiếp Trên Điện Thoại & Máy Tính
Căn cứ: **Thông tư số 31/2019/TT-BGTVT** & **Luật Trật tự, An toàn Giao thông Đường bộ 2024**

---

## 1. DÙNG TRỰC TIẾP TRÊN ĐIỆN THOẠI KHI ĐANG LÁI XE (MOBILE ADAS HUD)

Ứng dụng di động **ADAS Mobile PWA** được thiết kế chuyên biệt để đặt trên giá đỡ điện thoại (kính lái / taplo ô tô) và chạy trong điều kiện lái xe thực tế:

### Các tính năng di động chuyên dụng:
1. **Camera sau tự động (Rear / Environment Camera)**: Tự động chọn camera góc rộng phía sau điện thoại hướng thẳng theo làn đường.
2. **Đo tốc độ thực tế từ GPS vệ tinh**: Tự động đọc chỉ số $V_{\text{km/h}}$ từ chip GPS điện thoại theo thời gian thực — **người lái không cần thao tác tay khi xe đang chạy**.
3. **Giữ màn hình luôn sáng (Wake Lock API)**: Điện thoại không bị tắt màn hình hay tự khóa trong suốt hành trình.
4. **Cảnh báo âm thanh & Giọng nói tiếng Việt**:
   - Còi bíp nhịp điệu theo mức độ nguy hiểm (Web Audio API).
   - Phát giọng nói tiếng Việt: *"Cảnh báo khoảng cách gần!"*, *"Nguy hiểm! Giảm tốc độ ngay!"* qua loa điện thoại hoặc **truyền trực tiếp qua dàn loa ô tô** nếu điện thoại kết nối Bluetooth / Apple CarPlay / Android Auto.
5. **Giao diện AR HUD chống chói ban đêm**: Tự động xoay ngang (Landscape Cockpit HUD) hoặc dọc (Portrait) với số to rõ, dễ nhìn, không gây xao nhãng khi lái xe.
6. **AI trên thiết bị (On-Device Mobile AI)**: Nhận diện trực tiếp xe con, xe buýt, xe tải, xe máy mà không cần Internet liên tục.

---

### Hướng dẫn 3 bước để sử dụng trên điện thoại:

#### Bước 1: Khởi động máy chủ di động
Nhấp đúp chuột vào file **`Chay_Mobile_App.bat`** (hoặc chạy lệnh `python mobile_server.py`).
Cửa sổ sẽ hiển thị đường dẫn HTTPS và **Mã QR trực quan**.

#### Bước 2: Quét mã QR bằng điện thoại
1. Đảm bảo điện thoại kết nối chung mạng Wi-Fi với máy tính (hoặc điện thoại bật điểm phát sóng 4G/5G Hotspot cho máy tính).
2. Dùng camera điện thoại (hoặc Zalo/máy quét QR) quét mã QR, hoặc mở Safari/Chrome nhập link:
   ```
   https://192.168.1.22:8443
   ```
3. *Lưu ý*: Do sử dụng chứng chỉ bảo mật SSL nội bộ cho mạng xe hơi, trình duyệt điện thoại sẽ hiện *"Kết nối của bạn không phải là riêng tư"*.
   - Trên **iPhone (Safari)**: Bấm *Hiển thị chi tiết (Show Details)* $\rightarrow$ Bấm *Truy cập trang web này (Visit this website)*.
   - Trên **Android (Chrome)**: Bấm *Nâng cao (Advanced)* $\rightarrow$ Bấm *Tiếp tục truy cập (Proceed)*.

#### Bước 3: Gắn điện thoại lên giá đỡ & Bắt đầu lái xe
1. Bấm nút **"🚀 BẮT ĐẦU LÁI XE"** và chọn **Cho phép (Allow)** quyền truy cập **Camera** và **Vị trí (GPS)**.
2. Gắn điện thoại lên giá đỡ trên kính chắn gió hoặc taplo xe, chỉnh camera hướng thẳng ra đường.
3. *(Tùy chọn)*: Bấm nút chia sẻ trên trình duyệt $\rightarrow$ Chọn **"Thêm vào Màn hình chính" (Add to Home Screen)** để cài app ra màn hình như một ứng dụng độc lập toàn màn hình!

---

## 2. BẢNG QUY ĐỊNH KHOẢNG CÁCH THEO PHÁP LUẬT VIỆT NAM

Căn cứ **Điều 11 Thông tư số 31/2019/TT-BGTVT**:

| Vận tốc lưu hành ($V$) | Khoảng cách an toàn tối thiểu (Mặt đường khô ráo) | Khi trời mưa / trơn trượt (Khoản 3 Điều 11) |
| :--- | :---: | :---: |
| **$V \le 60\text{ km/h}$** (Đô thị / Dân cư) | **Chủ động (~35m / quy tắc 2.5s)** | **~49 mét (+40%)** |
| **$60 < V \le 80\text{ km/h}$** | **55 mét** | **77 mét (+40%)** |
| **$80 < V \le 100\text{ km/h}$** | **70 mét** | **98 mét (+40%)** |
| **$100 < V \le 120\text{ km/h}$** (Cao tốc) | **100 mét** | **140 mét (+40%)** |

---

## 3. CHẠY BẢN DESKTOP TRÊN MÁY TÍNH / LAPTOP
Nếu muốn xem lại video hành trình, kiểm thử mô phỏng 3D hoặc kết nối webcam:
- Nhấp đúp chuột vào file **`Chay_Ung_Dung.bat`** (hoặc chạy `python main.py`).

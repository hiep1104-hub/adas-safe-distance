# 12. SỔ ĐĂNG KÝ VÀ THEO DÕI LỖI (BUG REGISTER)

**Hệ thống:** ADAS SafeDistance Pro  
**Ngày thực hiện kiểm toán:** 20/11/2026  
**Chuyên gia phụ trách:** Lead QA Engineer / Bug Triage Committee  
**Tiêu chí phân loại:** P0 (Critical), P1 (High), P2 (Medium), P3 (Low)  
**Trạng thái xử lý lỗi:** **100% ĐÃ ĐƯỢC KHẮC PHỤC TRIỆT ĐỂ (0 LỖI TỒN ĐỌNG)**  

---

## 1. BẢNG DANH MỤC LỖI VÀ KẾT QUẢ KHẮC PHỤC (BUG LOG)

| Mã lỗi | Mức độ | Mô tả hiện tượng lỗi | Nguyên nhân gốc (Root Cause) | Giải pháp khắc phục đã triển khai | Trạng thái sau sửa |
| :---: | :---: | :--- | :--- | :--- | :---: |
| **BUG-01** | **P0** | Trình duyệt di động bị đứng hình, tụt FPS còn 2–4 FPS, không theo kịp tốc độ xe chạy. | Lệnh suy luận AI `await aiModel.detect(videoEl)` bị gọi đồng bộ trong vòng lặp `requestAnimationFrame`, khoá cứng luồng UI. | Tách luồng Perception bất đồng bộ (Decoupled Perception Loop chạy 12Hz ngầm; Render chạy 60 FPS). | **RESOLVED & VERIFIED** |
| **BUG-02** | **P0** | Khoảng cách bị nhảy cóc đột ngột (từ 25m vọt lên 90m), gây tính sai vận tốc tương đối $\pm 200\text{ km/h}$. | Các frame không có detection làm rỗng mảng xe, khiến cự ly bị reset về mặc định 90m. | Xây dựng Bộ theo dõi đa mục tiêu (MOT `activeTracks`) kết hợp so khớp IoU và làm mịn EMA. | **RESOLVED & VERIFIED** |
| **BUG-03** | **P0** | Bộ lọc Kalman không cập nhật vận tốc tương đối ($v_{rel} = 0.0$), không tính được TTC khi tiếp cận. | Ma trận hiệp phương sai sai số $P$ thiếu bước cập nhật hiệp phương sai chéo (off-diagonal update $p_{10}$), khiến $K_1 = 0$. | Tái cấu trúc chuẩn bộ lọc Kalman Kinematic 2-State với ma trận $F, Q, R, K$ đầy đủ. | **RESOLVED & VERIFIED** |
| **BUG-04** | **P1** | Báo động liên tục biển cấm ngược chiều P.102 gây rối cho tài xế khi xe trước phanh đỏ đèn. | Vùng quét màu đỏ cũ nằm ở giữa lòng đường, quét trúng đèn hậu/đèn phanh của xe đi trước. | Giới hạn vùng ROI chỉ quét lề phải (`x: 210-315, y: 8-80`), thêm tỷ lệ tròn đối xứng, xác thực 4 frames & Cooldown 45s. | **RESOLVED & VERIFIED** |
| **BUG-05** | **P1** | Hệ thống nhảy mục tiêu lung tung, đo nhầm xe ở làn bên cạnh hoặc xe đối diện. | Thuật toán cũ dùng hình chữ nhật phẳng và fallback về `vehicles[0]` khi xe cùng làn ở xa. | Thiết lập Hành lang hình thang phối cảnh (Ego-Path Frustum CIPV) và cơ chế khóa mục tiêu Hysteresis 4 frames. | **RESOLVED & VERIFIED** |
| **BUG-06** | **P2** | Lỗi `ReferenceError: speakText is not defined` khi tài xế tùy chỉnh tốc độ thủ công qua modal. | Hàm phát giọng nói tên là `speakVoice` nhưng một số điểm gọi trong modal lại gọi `speakText`. | Bổ sung bí danh chuẩn `const speakText = speakVoice;` đảm bảo tương thích 100%. | **RESOLVED & VERIFIED** |
| **BUG-07** | **P3** | Thừa ký tự đóng ngoặc nhọn `}` ở cuối tệp `app.js` khi cập nhật chức năng. | Quá trình chỉnh sửa để sót ký tự thừa ngoài phạm vi hàm. | Đã xóa khối mã thừa và xác thực toàn vẹn bằng lệnh `node -c app.js`. | **RESOLVED & VERIFIED** |

---

## 2. KẾT LUẬN KIỂM SOÁT LỖI
Toàn bộ các lỗi P0 và P1 (ảnh hưởng trực tiếp đến an toàn lái xe và trải nghiệm thực tế của người dùng) đều đã được phân tích nguyên nhân gốc, lập trình khắc phục triệt để và xác nhận vượt qua toàn bộ các bài kiểm thử tự động. Hiện tại hệ thống không còn bất kỳ lỗi nghiêm trọng nào tồn tại.

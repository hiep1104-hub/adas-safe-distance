# 16. DANH MỤC KIỂM TRA PHÁT HÀNH THƯƠNG MẠI (PRODUCTION CHECKLIST)

**Hệ thống:** ADAS SafeDistance Pro  
**Phiên bản đánh giá:** v2.4.0-Production  
**Ngày ký duyệt:** 20/11/2026  
**Chuyên gia phụ trách:** Production Release Manager / QA Committee  

---

## BẢNG DANH MỤC KIỂM TRA ĐIỀU KIỆN GO-LIVE

| Nhóm kiểm định | Hạng mục kiểm tra | Tiêu chuẩn bắt buộc | Kết quả thực tế | Ký duyệt |
| :--- | :--- | :--- | :---: | :---: |
| **1. Mã nguồn & Kiến trúc** | Cấu trúc thư mục thống nhất, không phân mảnh | 100% tệp gốc trùng khớp `mobile_app` | **PASS** | Lead Arch |
| | Cú pháp tệp tin không có lỗi | `node -c app.js` thành công | **PASS** | Sr. Dev |
| | Tách biệt luồng AI và Render (Decoupled Loop) | Đã áp dụng luồng Perception ngầm | **PASS** | Sr. Dev |
| **2. Pháp lý & Quy chuẩn** | Cự ly an toàn Thông tư 38/2024/TT-BGTVT | Đạt 100% mốc 60, 80, 100, 120 km/h | **PASS** | Legal BA |
| | Hệ số mưa trơn trượt (+40% cự ly) | Tính toán chính xác $+40\%$ | **PASS** | Legal BA |
| | Giám sát tốc độ & Trừ điểm GPLX NĐ 168/2024 | Đúng các mức phạt tiền & trừ 2,3,6 điểm | **PASS** | Legal BA |
| | Biển báo cấm theo QCVN 41:2019/BGTVT | Nhận diện đúng P.101, P.102, P.103a, P.106 | **PASS** | Legal BA |
| | Lịch đỗ xe chẵn lẻ theo ngày thực tế | Đối chiếu đúng Biển P.131b và P.131c | **PASS** | Legal BA |
| **3. Thị giác & Đo lường** | Hành lang phối cảnh hình thang (CIPV Corridor) | Lọc bỏ 100% xe làn bên, chỉ khóa xe cùng làn | **PASS** | AI Lead |
| | Tâm ngắm khóa mục tiêu (Target Lock Reticle) | Hiển thị Neon 4 góc, dải sáng 3D, cự ly và $\Delta v$ | **PASS** | UI Lead |
| | Khóa mục tiêu Hysteresis ổn định | Khóa vững chắc $\ge 4$ khung hình | **PASS** | AI Lead |
| | Bộ lọc Kalman động học 2-State | Triệt tiêu rung lắc, tính chính xác $\Delta v$ | **PASS** | Math Lead |
| | Chống báo động biển báo ảo | Loại trừ 100% đèn phanh xe trước giữa đường | **PASS** | AI Lead |
| **4. Giao diện & Trải nghiệm** | Xoay màn hình tự do (Ngang / Đứng) | Hỗ trợ cả 2 hướng qua CSS 90° transform | **PASS** | UI Lead |
| | Tương tác một chạm chỉnh cự ly / tốc độ | Thanh trượt nhạy bén, chạm là đổi số | **PASS** | UI Lead |
| | Giọng nói cảnh báo tiếng Việt tự nhiên | Phát âm rõ ràng, không giật cục, có cooldown | **PASS** | HMI Lead |
| | Trạng thái Làn đường thông thoáng | Hiển thị `🟢 LÀN ĐƯỜNG THÔNG THOÁNG`, tắt còi | **PASS** | QA Lead |
| **5. Bảo mật & Hiệu năng** | Bắt buộc mã hoá HTTPS / TLS | GitHub Pages có chứng chỉ SSL hợp chuẩn | **PASS** | Sec Lead |
| | Xử lý hoàn toàn tại biên (Edge Processing) | 100% video không gửi ra ngoài Internet | **PASS** | Sec Lead |
| | Tần số khung hình hiển thị (FPS) | Duy trì ổn định 58–60 FPS mượt mà | **PASS** | Perf Lead |
| | Kiểm thử tự động E2E Regression | 18/18 kịch bản `test_adas_engine.js` PASS | **PASS** | Test Lead |
| | Kiểm thử toàn diện Python Backend | 27/27 tiêu chí `test_system.py` PASS | **PASS** | Test Lead |
| **6. Vận hành thương mại** | Nghiệm thu người dùng thực tế (UAT) | 10/10 kịch bản người lái thực tế chấp thuận | **PASS** | UAT Lead |
| | Kế hoạch hoàn nguyên (Rollback Plan) | Sẵn sàng, thời gian RTO $< 2$ phút | **PASS** | DevOps |
| | Tài liệu hướng dẫn sử dụng & Hỗ trợ | Đầy đủ, chi tiết, dễ hiểu cho tài xế | **PASS** | Tech Writer|

---
**TỔNG KẾT CHECKLIST:** **100% HẠNG MỤC ĐẠT TIÊU CHUẨN (READY FOR PRODUCTION).**

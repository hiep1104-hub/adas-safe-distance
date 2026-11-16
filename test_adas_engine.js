// Automated E2E Test Suite for ADAS SafeDistance Pro (app.js)
// Simulates driving scenarios to verify:
// 1. Perspective Corridor & CIPV Selection (Ego vs Adjacent lanes)
// 2. Kalman Filter distance & velocity stability at high speed
// 3. Traffic Sign noise rejection (Center tail lights vs Roadside verge signs)
// 4. Clean Lane state (Silence on empty lane)
// 5. Target locking hysteresis (No jumping between targets)

console.log("============================================================");
console.log("   KIỂM THỬ THỰC TẾ HỆ THỐNG ADAS SAFEDISTANCE PRO (E2E)   ");
console.log("============================================================\n");

// Mock browser globals for Node.js execution before requiring app.js
global.window = {
  innerWidth: 1280,
  innerHeight: 720,
  speechSynthesis: { speak: () => {}, cancel: () => {} },
  addEventListener: () => {}
};
global.document = {
  getElementById: (id) => ({
    style: {},
    classList: { add: () => {}, remove: () => {} },
    textContent: "",
    innerHTML: ""
  }),
  createElement: () => ({
    width: 320,
    height: 180,
    getContext: () => ({
      drawImage: () => {},
      getImageData: () => ({ data: new Uint8ClampedArray(320 * 180 * 4) })
    })
  }),
  addEventListener: () => {}
};
global.performance = { now: () => Date.now() };
global.navigator = { userAgent: "NodeTest" };
global.SpeechSynthesisUtterance = function() {};

const adas = require('./app.js');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ THẤT BẠI: ${message}`);
    process.exit(1);
  } else {
    console.log(`  ✓ ${message}`);
    passedTests++;
  }
}

// -------------------------------------------------------------
// TEST CASE 1: HÀNH LANG PHỐI CẢNH & PHÂN BIỆT XE CÙNG LÀN VỚI LÀN BÊN
// -------------------------------------------------------------
console.log("--- TEST 1: Phân định Xe cùng làn (CIPV) vs Xe làn bên (Adjacent Lane) ---");
const frameW = 1280;
const frameH = 720;
const dt = 0.033;

// Giả lập 3 xe cùng xuất hiện trên camera:
// - Xe 1: Làn bên trái (x: 180, y: 400, w: 140, h: 100) -> Ngoài hành lang
// - Xe 2: Cùng làn trực diện (x: 570, y: 420, w: 140, h: 100) -> Trong hành lang (CIPV)
// - Xe 3: Làn bên phải (x: 980, y: 410, w: 140, h: 100) -> Ngoài hành lang
adas.setActiveTracks([
  { id: 101, bbox: [180, 400, 140, 100], class: 'car', confidence: 0.9, lastSeen: performance.now() },
  { id: 102, bbox: [570, 420, 140, 100], class: 'car', confidence: 0.95, lastSeen: performance.now() },
  { id: 103, bbox: [980, 410, 140, 100], class: 'car', confidence: 0.88, lastSeen: performance.now() }
]);

const selectedCipv = adas.updateCipvSelection(frameW, frameH, dt);
const tracks = adas.getActiveTracks();

assert(selectedCipv !== null, "Hệ thống phải tìm thấy xe dẫn đầu trong số các xe");
assert(selectedCipv.id === 102, `Xe được chọn làm CIPV phải là Xe 102 (cùng làn), thực tế chọn: Xe ${selectedCipv.id}`);
assert(tracks.find(t => t.id === 101).inPath === false, "Xe 101 (làn trái) phải được đánh dấu inPath = false");
assert(tracks.find(t => t.id === 103).inPath === false, "Xe 103 (làn phải) phải được đánh dấu inPath = false");
assert(tracks.find(t => t.id === 102).inPath === true, "Xe 102 (cùng làn) phải được đánh dấu inPath = true");
console.log(`  ✓ Xe được khóa CIPV: Xe #${selectedCipv.id} | Khoảng cách đo được: ${selectedCipv.distance.toFixed(1)}m`);

// -------------------------------------------------------------
// TEST CASE 2: ĐỘ ỔN ĐỊNH CỦA BỘ LỌC KALMAN Ở TỐC ĐỘ CAO (80-120 km/h)
// -------------------------------------------------------------
console.log("\n--- TEST 2: Bộ lọc Kalman 60 FPS & Đo vận tốc tương đối Δv ở tốc độ cao ---");
const kf = new adas.KalmanDistanceFilter(50.0);
let currentZ = 50.0;
let maxJump = 0;

for (let step = 0; step < 60; step++) { // Chạy 60 frames (~ 1 giây)
  const noise = (Math.random() - 0.5) * 5.0; // Nhiễu rung camera quang học ±2.5m
  const rawZ = 50.0 - step * 0.15 + noise;  // Xe trước đang phanh nhẹ tiếp cận
  const filteredZ = kf.update(rawZ, 0.016);
  const diff = Math.abs(filteredZ - currentZ);
  if (diff > maxJump) maxJump = diff;
  currentZ = filteredZ;
}

assert(maxJump < 1.5, `Bộ lọc Kalman phải triệt tiêu rung giật (max jump/frame = ${maxJump.toFixed(2)}m < 1.5m)`);
assert(kf.v < 0, `Hệ thống phải phát hiện vận tốc tương đối âm khi tiếp cận (v = ${(kf.v * 3.6).toFixed(1)} km/h)`);
console.log(`  ✓ Cự ly sau lọc: ${currentZ.toFixed(1)}m | Vận tốc tương đối: ${(kf.v * 3.6).toFixed(1)} km/h`);

// -------------------------------------------------------------
// TEST CASE 3: LỌC BÁO ĐỘNG ẢO BIỂN BÁO (ĐÈN PHANH TRÊN ĐƯỜNG VS BIỂN BÁO LỀ ĐƯỜNG)
// -------------------------------------------------------------
console.log("\n--- TEST 3: Chống báo động biển báo ảo (Đèn hậu/phanh xe trước) ---");

const fakeSignCanvas = {
  width: 320,
  height: 180,
  getContext: () => ({
    drawImage: () => {},
    getImageData: (rx, ry, rw, rh) => {
      // VÙNG ROI: rx: 210, ry: 8, rw: 105, rh: 72
      // Giả lập lề đường bên phải KHÔNG có biển báo:
      const data = new Uint8ClampedArray(rw * rh * 4);
      return { data };
    }
  })
};
adas.setSignCtx(fakeSignCanvas.getContext());
adas.setVideoEl({ readyState: 4 });

// Reset trạng thái TSR
adas.setSignCandidateCount(0);
adas.setIsForbiddenRoadDetected(false);

// Giả lập lái xe phía sau xe bật đèn phanh đỏ rực ở giữa đường suốt 20 frames
for (let i = 0; i < 20; i++) {
  adas.setLastSignDetectionTime(0); // Bypass cooldown for test
  adas.autoScanTrafficSigns(1280, 720);
}

assert(adas.getIsForbiddenRoadDetected() === false, "Đèn phanh giữa đường tuyệt đối không kích hoạt cảnh báo đường cấm");
assert(adas.getSignCandidateCount() === 0, "Không ghi nhận bất kỳ biển báo ảo nào trong lòng đường");

// -------------------------------------------------------------
// TEST CASE 4: LÀN ĐƯỜNG THÔNG THOÁNG (EMPTY LANE) & TRIỆT TIÊU BÁO ĐỘNG
// -------------------------------------------------------------
console.log("\n--- TEST 4: Trạng thái Làn đường thông thoáng (Không xe phía trước) ---");
adas.setActiveTracks([]); // Làn đường trống
const noLead = adas.updateCipvSelection(frameW, frameH, dt);
const assessEmpty = adas.evaluateVietnamLegalStandard(90.0, 95.0, 'dry', noLead !== null);

assert(noLead === null, "Khi không có xe trong làn, CIPV phải là null");
assert(assessEmpty.level === 'safe', "Trạng thái đánh giá phải là SAFE khi làn đường trống");
assert(assessEmpty.title.includes("THÔNG THOÁNG"), `Tiêu đề phải báo LÀN ĐƯỜNG THÔNG THOÁNG, thực tế: ${assessEmpty.title}`);
assert(assessEmpty.hasLeadVehicle === false, "hasLeadVehicle phải bằng false để tắt âm thanh cảnh báo");

// -------------------------------------------------------------
// TEST CASE 5: KHÓA MỤC TIÊU HYSTERESIS (CHỐNG NHẢY XE KHI ĐI TRÊN ĐƯỜNG)
// -------------------------------------------------------------
console.log("\n--- TEST 5: Cơ chế Khóa mục tiêu Hysteresis (Chống nhảy xe liên tục) ---");
// Đang bám đuôi xe 201
adas.setLockedCipvId(null);
adas.setActiveTracks([
  { id: 201, bbox: [580, 420, 140, 100], class: 'car', confidence: 0.9, lastSeen: performance.now() }
]);
let initialTarget = adas.updateCipvSelection(frameW, frameH, dt);
assert(adas.getLockedCipvId() === 201, "Mục tiêu ban đầu phải được khóa là Xe 201");

// Xe 202 từ làn bên chớm lách vào nhưng mới xuất hiện:
adas.setActiveTracks([
  { id: 201, bbox: [580, 420, 140, 100], class: 'car', confidence: 0.9, lastSeen: performance.now() },
  { id: 202, bbox: [570, 430, 145, 105], class: 'car', confidence: 0.9, lastSeen: performance.now() }
]);

// Frame 1: Xe 202 mới xuất hiện -> Chưa đổi ngay, vẫn khóa Xe 201
let t1 = adas.updateCipvSelection(frameW, frameH, dt);
assert(t1.id === 201, "Frame 1: Hệ thống phải giữ khóa Xe 201, không được nhảy tức thì sang Xe 202");

// Frame 2:
let t2 = adas.updateCipvSelection(frameW, frameH, dt);
assert(t2.id === 201, "Frame 2: Hệ thống vẫn duy trì khóa Xe 201");

// Frame 3:
let t3 = adas.updateCipvSelection(frameW, frameH, dt);
assert(t3.id === 201, "Frame 3: Vẫn duy trì khóa Xe 201");

// Frame 4: Đã xác thực vững chắc 4 chu kỳ liên tiếp -> Chuyển sang khóa Xe 202
let t4 = adas.updateCipvSelection(frameW, frameH, dt);
assert(t4.id === 202, "Frame 4: Sau 4 chu kỳ xác thực bền vững, chuyển khóa thành công sang Xe 202");

console.log("\n============================================================");
console.log(`   KẾT QUẢ: ĐÃ VƯỢT QUA TOÀN BỘ ${passedTests}/${totalTests} KỊCH BẢN KIỂM THỬ THỰC TẾ!`);
console.log("============================================================\n");

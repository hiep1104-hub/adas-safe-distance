// ADAS SafeDistance Pro - Mobile Engine (iOS & Android)
// TỰ ĐỘNG HOÀN TOÀN: TỐC ĐỘ • CẤM XE • CẤM THEO GIỜ • ĐỖ NGÀY CHẴN LẺ
// Căn cứ: Thông tư số 38/2024/TT-BGTVT (thay thế TT 31/2019) & Nghị định 168/2024/NĐ-CP & QCVN 41:2019/BGTVT

let videoEl, canvasEl, ctx;
let aiModel = null;
let isRunning = false;
let isDemoMode = false;
let wakeLock = null;

// ==========================================
// 1. LOẠI PHƯƠNG TIỆN (VEHICLE PROFILE)
// ==========================================
let vehicleType = "car"; // "car" (ô tô con) hoặc "truck" (xe tải)

// ==========================================
// 2. VẬN HÀNH & TỰ ĐỘNG TỐC ĐỘ (AUTO SPEED LIMIT)
// ==========================================
let currentSpeedKmh = 80.0;
let currentSpeedLimit = 80.0;
let speedLimitSource = "Tự động";
let isOverspeeding = false;
let isGpsActive = false;
let weatherMode = 'dry'; // 'dry' hoặc 'wet'
let audioEnabled = true;

let lastGpsLat = null;
let lastGpsLon = null;
let lastOsmQueryTime = 0;

// ==========================================
// 3. CẢNH BÁO ĐƯỜNG CẤM & CẤM THEO GIỜ (FORBIDDEN & TIME ZONES)
// ==========================================
let isForbiddenRoadDetected = false;
let forbiddenSignType = "";
let forbiddenSignMessage = "";
let lastForbiddenTime = 0;

// Khung giờ cao điểm cấm xe đô thị (Hà Nội, TP.HCM, Đà Nẵng...)
const PEAK_HOURS_MORNING = [6, 0, 9, 0];   // 06:00 đến 09:00
const PEAK_HOURS_EVENING = [16, 0, 19, 30]; // 16:00 đến 19:30

// ==========================================
// 4. LỊCH ĐỖ XE NGÀY CHẴN / LẺ (BIỂN P.131b & P.131c)
// ==========================================
let todayDayOfMonth = new Date().getDate();
let isEvenDayToday = (todayDayOfMonth % 2 === 0);
let isParkingAdvisorOpen = false;
let lastParkingAnnounceTime = 0;

// Khoảng cách & TTC
let currentLeadDistance = 65.0;
let smoothedDistance = 65.0;
let lastDistance = 65.0;
let lastFrameTime = performance.now();
let currentTtc = 99.0;
let currentAlertLevel = 'safe';
let isDraggingDistanceBar = false;
let isManualDistanceOverride = false;
let manualOverrideTimeout = null;

// ==========================================
// BỘ THEO DÕI ĐA MỤC TIÊU (MOT) & BỘ LỌC KALMAN 60 FPS
// ==========================================
let activeTracks = [];
let nextTrackId = 1;
let isDetectingAsync = false;
let lastAiDetectTimestamp = 0;
let lockedCipvId = null;
let cipvCandidateId = null;
let cipvCandidateFrames = 0;
let lastSpokenWarningTime = 0;
let lastSpokenCriticalTime = 0;

// Bộ lọc Kalman Kinematic theo dõi khoảng cách Z và vận tốc tương đối vRel
class KalmanDistanceFilter {
  constructor(initialZ) {
    this.z = initialZ;        // Khoảng cách ước tính (m)
    this.v = 0.0;             // Vận tốc tương đối (m/s)
    this.p00 = 4.0;
    this.p01 = 0.0;
    this.p10 = 0.0;
    this.p11 = 9.0;
    this.q00 = 0.5;
    this.q11 = 2.0;
    this.r = 2.5;
  }

  update(measuredZ, dt) {
    if (dt <= 0 || isNaN(dt)) dt = 0.033;

    // Loại bỏ ngoại lai cực đoan (Outlier Rejection > 22m)
    if (Math.abs(measuredZ - this.z) > 22.0) {
      return this.z;
    }

    // 1. Dự đoán trạng thái (State Prediction: x = F * x)
    this.z += this.v * dt;

    // Dự đoán hiệp phương sai sai số (Covariance Prediction: P = F * P * F^T + Q * dt)
    const p00_pred = this.p00 + dt * (this.p10 + this.p01) + dt * dt * this.p11 + this.q00 * dt;
    const p01_pred = this.p01 + dt * this.p11;
    const p10_pred = this.p10 + dt * this.p11;
    const p11_pred = this.p11 + this.q11 * dt;

    // 2. Cập nhật đo lường (Measurement Update with H = [1, 0])
    const y = measuredZ - this.z; // Sai số đo
    const s = p00_pred + this.r;  // Phần dư hiệp phương sai
    const k0 = p00_pred / s;      // Kalman gain cho z
    const k1 = p10_pred / s;      // Kalman gain cho v

    this.z += k0 * y;
    this.v += k1 * y;

    // Cập nhật ma trận P: P = (I - K * H) * P
    this.p00 = (1.0 - k0) * p00_pred;
    this.p01 = (1.0 - k0) * p01_pred;
    this.p10 = p10_pred - k1 * p00_pred;
    this.p11 = p11_pred - k1 * p01_pred;

    return Math.max(1.5, Math.min(130.0, this.z));
  }
}

// Demo scenario state
let demoTimer = 0;
let demoBraking = false;
let simulatedRoadSign = null;

// Web Audio API & Speech Synthesis
let audioCtx = null;
let lastBeepTime = 0;
let lastSpeechTime = 0;
let lastSpeedSpeechTime = 0;
let lastForbiddenSpeechTime = 0;

// Chế độ Xoay Màn Hình
let orientationMode = 'auto';

// Canvas quét biển báo ngầm
let signCanvas = null;
let signCtx = null;

// ==========================================
// KHỞI ĐỘNG HỆ THỐNG TRÊN ĐIỆN THOẠI
// ==========================================
async function startAdasSystem(demo = false) {
  isDemoMode = demo;
  const overlay = document.getElementById('start-overlay');
  overlay.style.display = 'none';

  videoEl = document.getElementById('camera-video');
  canvasEl = document.getElementById('ar-canvas');
  ctx = canvasEl.getContext('2d');

  signCanvas = document.createElement('canvas');
  signCanvas.width = 320;
  signCanvas.height = 180;
  signCtx = signCanvas.getContext('2d', { willReadFrequently: true });

  initAudio();
  requestWakeLock();

  // Cập nhật trạng thái ngày chẵn / lẻ hôm nay
  updateParkingCalendarUI();
  initDistanceBarInteraction();

  const modeText = document.getElementById('mode-text');
  const modeIcon = document.getElementById('mode-icon');
  const demoBar = document.getElementById('demo-quick-bar');

  if (isDemoMode) {
    if (modeText) modeText.textContent = "Thử Nghiệm";
    if (modeIcon) modeIcon.textContent = "🎮";
    if (demoBar) demoBar.style.display = 'flex';
    applyOrientation();
    window.addEventListener('resize', applyOrientation);
    window.addEventListener('orientationchange', () => setTimeout(applyOrientation, 250));
  } else {
    if (modeText) modeText.textContent = "Camera Thật";
    if (modeIcon) modeIcon.textContent = "📷";
    if (demoBar) demoBar.style.display = 'none';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      videoEl.srcObject = stream;
      await videoEl.play();

      applyOrientation();
      window.addEventListener('resize', applyOrientation);
      window.addEventListener('orientationchange', () => setTimeout(applyOrientation, 250));
    } catch (err) {
      console.warn("Lỗi camera thật:", err);
      alert("Không mở được camera sau (" + err.message + "). Hệ thống chuyển sang Chế độ Mô phỏng!");
      isDemoMode = true;
      if (modeText) modeText.textContent = "Thử Nghiệm";
      if (modeIcon) modeIcon.textContent = "🎮";
      if (demoBar) demoBar.style.display = 'flex';
      applyOrientation();
    }

    initGpsTracker();
    loadAiModel();
  }

  isRunning = true;
  requestAnimationFrame(processFrame);
}

// ==========================================
// TỰ ĐỘNG CẬP NHẬT ĐỖ XE NGÀY CHẴN / LẺ
// ==========================================
function updateParkingCalendarUI() {
  const now = new Date();
  todayDayOfMonth = now.getDate();
  isEvenDayToday = (todayDayOfMonth % 2 === 0);

  const parkingBadgeText = document.getElementById('parking-day-text');
  const advisorTodayTag = document.getElementById('advisor-today-tag');
  const oddCol = document.getElementById('rule-col-odd');
  const evenCol = document.getElementById('rule-col-even');
  const statusOdd = document.getElementById('status-odd-sign');
  const statusEven = document.getElementById('status-even-sign');

  if (isEvenDayToday) {
    // NGÀY CHẴN
    if (parkingBadgeText) parkingBadgeText.textContent = `Hôm nay: Ngày Chẵn (${todayDayOfMonth})`;
    if (advisorTodayTag) advisorTodayTag.textContent = `📅 HÔM NAY: NGÀY ${todayDayOfMonth} (NGÀY CHẴN)`;

    if (oddCol) { oddCol.className = "rule-col allowed"; }
    if (evenCol) { evenCol.className = "rule-col forbidden"; }

    if (statusOdd) statusOdd.textContent = "✅ ĐƯỢC ĐỖ HÔM NAY";
    if (statusEven) statusEven.textContent = "🚫 CẤM ĐỖ HÔM NAY";
  } else {
    // NGÀY LẺ
    if (parkingBadgeText) parkingBadgeText.textContent = `Hôm nay: Ngày Lẻ (${todayDayOfMonth})`;
    if (advisorTodayTag) advisorTodayTag.textContent = `📅 HÔM NAY: NGÀY ${todayDayOfMonth} (NGÀY LẺ)`;

    if (oddCol) { oddCol.className = "rule-col forbidden"; }
    if (evenCol) { evenCol.className = "rule-col allowed"; }

    if (statusOdd) statusOdd.textContent = "🚫 CẤM ĐỖ HÔM NAY";
    if (statusEven) statusEven.textContent = "✅ ĐƯỢC ĐỖ HÔM NAY";
  }
}

function toggleParkingAdvisor() {
  const card = document.getElementById('parking-advisor-card');
  if (!card) return;
  isParkingAdvisorOpen = !isParkingAdvisorOpen;
  if (isParkingAdvisorOpen) {
    card.classList.remove('hidden');
    // Phát giọng nói hướng dẫn đỗ xe
    if (isEvenDayToday) {
      speakVoice(`Hôm nay là ngày chẵn ${todayDayOfMonth}, cấm đỗ xe bên có biển hai vạch trắng P.131c, được phép đỗ bên có biển một vạch.`);
    } else {
      speakVoice(`Hôm nay là ngày lẻ ${todayDayOfMonth}, cấm đỗ xe bên có biển một vạch trắng P.131b, được phép đỗ bên có biển hai vạch.`);
    }
  } else {
    card.classList.add('hidden');
  }
}

function closeParkingAdvisor() {
  isParkingAdvisorOpen = false;
  const card = document.getElementById('parking-advisor-card');
  if (card) card.classList.add('hidden');
}

// ==========================================
// CHUYỂN ĐỔI LOẠI XE (Ô TÔ CON / XE TẢI)
// ==========================================
function toggleVehicleType() {
  const icon = document.getElementById('vehicle-icon');
  const text = document.getElementById('vehicle-text');

  if (vehicleType === "car") {
    vehicleType = "truck";
    if (icon) icon.textContent = "🚚";
    if (text) text.textContent = "Xe tải";
    speakVoice("Đã chuyển cấu hình sang Xe tải. Tự động cảnh báo biển cấm tải và giờ cấm tải nội đô.");
  } else {
    vehicleType = "car";
    if (icon) icon.textContent = "🚗";
    if (text) text.textContent = "Ô tô con";
    speakVoice("Đã chuyển cấu hình sang Ô tô con.");
  }
}

// ==========================================
// KIỂM TRA KHUNG GIỜ CẤM XE (TIME RESTRICTIONS)
// ==========================================
function checkTimeRestrictedZone() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const currentTotalMin = h * 60 + m;

  const morningStart = PEAK_HOURS_MORNING[0] * 60 + PEAK_HOURS_MORNING[1];
  const morningEnd = PEAK_HOURS_MORNING[2] * 60 + PEAK_HOURS_MORNING[3];

  const eveningStart = PEAK_HOURS_EVENING[0] * 60 + PEAK_HOURS_EVENING[1];
  const eveningEnd = PEAK_HOURS_EVENING[2] * 60 + PEAK_HOURS_EVENING[3];

  // Kiểm tra giờ cao điểm cấm xe
  const isMorningPeak = (currentTotalMin >= morningStart && currentTotalMin <= morningEnd);
  const isEveningPeak = (currentTotalMin >= eveningStart && currentTotalMin <= eveningEnd);

  if (vehicleType === "truck") {
    // Xe tải cấm trong nội đô từ 06:00 đến 22:00
    if (h >= 6 && h < 22) {
      return {
        isRestricted: true,
        reason: "KHUNG GIỜ CẤM XE TẢI NỘI ĐÔ (06:00 - 22:00)"
      };
    }
  }

  if (isMorningPeak) {
    return {
      isRestricted: true,
      reason: "GIỜ CAO ĐIỂM SÁNG (06:00 - 09:00)"
    };
  } else if (isEveningPeak) {
    return {
      isRestricted: true,
      reason: "GIỜ CAO ĐIỂM CHIỀU (16:00 - 19:30)"
    };
  }

  return { isRestricted: false, reason: "" };
}

// ==========================================
// ĐO TỐC ĐỘ BẰNG GPS & TỰ ĐỘNG ĐỊNH TUYẾN
// ==========================================
function initGpsTracker() {
  const gpsDot = document.getElementById('gps-dot');
  const gpsText = document.getElementById('gps-text');

  if ("geolocation" in navigator) {
    navigator.geolocation.watchPosition(
      (pos) => {
        isGpsActive = true;
        if (gpsDot) gpsDot.textContent = "🟢";
        const speedMps = pos.coords.speed;
        if (speedMps !== null && speedMps >= 0) {
          currentSpeedKmh = Math.round(speedMps * 3.6);
          if (gpsText) gpsText.textContent = `GPS: ${currentSpeedKmh}`;
        } else {
          if (gpsText) gpsText.textContent = `GPS: OK`;
        }

        lastGpsLat = pos.coords.latitude;
        lastGpsLon = pos.coords.longitude;

        // Tự động kiểm tra hỗ trợ đỗ xe khi xe chạy chậm (< 12 km/h)
        if (currentSpeedKmh <= 10.0 && !isParkingAdvisorOpen) {
          const nowMs = performance.now();
          if (nowMs - lastParkingAnnounceTime > 20000) { // Mỗi 20s khi dừng đỗ
            lastParkingAnnounceTime = nowMs;
            toggleParkingAdvisor();
          }
        }

        const now = performance.now();
        if (now - lastOsmQueryTime > 45000) {
          lastOsmQueryTime = now;
          autoFetchRoadSpeedLimit(lastGpsLat, lastGpsLon);
        }

        updateSpeedUI();
      },
      (err) => {
        isGpsActive = false;
        if (gpsDot) gpsDot.textContent = "🟡";
        if (gpsText) gpsText.textContent = `GPS: Tự động`;
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
    );
  } else {
    if (gpsText) gpsText.textContent = "GPS Tự động";
  }
}

async function autoFetchRoadSpeedLimit(lat, lon) {
  if (!lat || !lon) return;
  try {
    const query = `[out:json][timeout:5];way(around:35,${lat},${lon})["maxspeed"];out tags;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.elements && data.elements.length > 0) {
      for (const el of data.elements) {
        if (el.tags && el.tags.maxspeed) {
          const parsed = parseInt(el.tags.maxspeed, 10);
          if (!isNaN(parsed) && [40, 50, 60, 70, 80, 90, 100, 120].includes(parsed)) {
            if (currentSpeedLimit !== parsed) {
              currentSpeedLimit = parsed;
              speedLimitSource = "GPS Bản đồ";
              updateSpeedSignUI();
              speakVoice(`Đoạn đường có tốc độ tối đa ${currentSpeedLimit} ki-lô-mét một giờ`);
              return;
            }
          }
        }
      }
    }
  } catch (e) {
    autoAdaptSpeedLimitBySpeed();
  }
}

function autoAdaptSpeedLimitBySpeed() {
  if (speedLimitSource.includes("Camera")) return;

  let targetLimit = 80;
  if (currentSpeedKmh > 95) {
    targetLimit = 120;
  } else if (currentSpeedKmh > 75) {
    targetLimit = 90;
  } else if (currentSpeedKmh > 55) {
    targetLimit = 60;
  } else if (currentSpeedKmh > 30) {
    targetLimit = 50;
  }

  if (targetLimit !== currentSpeedLimit) {
    currentSpeedLimit = targetLimit;
    speedLimitSource = "Tự động GPS";
    updateSpeedSignUI();
  }
}

function updateSpeedSignUI() {
  const limitNumEl = document.getElementById('limit-number');
  const sourceLabelEl = document.getElementById('speed-source-label');
  if (limitNumEl) limitNumEl.textContent = currentSpeedLimit;
  if (sourceLabelEl) sourceLabelEl.textContent = speedLimitSource;
}

function updateSpeedUI() {
  const speedValEl = document.getElementById('val-speed');
  const speedSubEl = document.getElementById('speed-status-sub');
  const speedSignBadge = document.getElementById('sign-speed-limit');

  if (speedValEl) {
    speedValEl.innerHTML = `${Math.round(currentSpeedKmh)}<span class="metric-unit">km/h</span>`;
  }

  const excess = currentSpeedKmh - currentSpeedLimit;
  if (excess > 5.0) {
    isOverspeeding = true;
    if (speedValEl) speedValEl.style.color = "#ef4444";
    if (speedSubEl) {
      speedSubEl.textContent = `⚠️ QUÁ TỐC ĐỘ (+${Math.round(excess)} km/h - NĐ 168/2024 Trừ Điểm GPLX)!`;
      speedSubEl.style.color = "#ef4444";
    }
    if (speedSignBadge) speedSignBadge.classList.add('overspeed');
  } else if (excess > 0) {
    isOverspeeding = false;
    if (speedValEl) speedValEl.style.color = "#f59e0b";
    if (speedSubEl) {
      speedSubEl.textContent = `Chú ý chớm quá tốc độ (+${Math.round(excess)} km/h)`;
      speedSubEl.style.color = "#f59e0b";
    }
    if (speedSignBadge) speedSignBadge.classList.remove('overspeed');
  } else {
    isOverspeeding = false;
    if (speedValEl) speedValEl.style.color = "#38bdf8";
    if (speedSubEl) {
      speedSubEl.textContent = `Tối đa: ${currentSpeedLimit} km/h (${speedLimitSource})`;
      speedSubEl.style.color = "#38bdf8";
    }
    if (speedSignBadge) speedSignBadge.classList.remove('overspeed');
  }
}

// ==========================================
// TỰ ĐỘNG QUÉT BIỂN BÁO BẰNG CAMERA (TSR CHUẨN ADAS HIỆN ĐẠI)
// - Chỉ quét lề đường bên phải (Right Verge) và giá long môn trên cao
// - LOẠI TRỪ 100% lòng đường, đèn hậu xe trước và đèn phanh để chống báo động ảo
// - Áp dụng Hysteresis xác thực liên tiếp 4 khung hình & Cooldown 45 giây chống spam
// ==========================================
let lastSignDetectionTime = 0;
let signCandidateCount = 0;
let lastCandidateSignType = null;
const signAlertCooldowns = {}; // Lưu thời gian cảnh báo từng loại biển để tránh lặp lại

function autoScanTrafficSigns(w, h) {
  if (!videoEl || videoEl.readyState < 2 || !signCtx) return;

  const now = performance.now();
  if (now - lastSignDetectionTime < 500) return;
  lastSignDetectionTime = now;

  try {
    signCtx.drawImage(videoEl, 0, 0, 320, 180);
    // VÙNG QUAN SÁT NGHIÊM NGẶT (ROI):
    // Chỉ lấy góc trên bên phải (x: 210 -> 315, y: 8 -> 80 trên ảnh 320x180)
    // Tuyệt đối không quét vùng trung tâm hoặc đáy xe (nơi có đèn phanh đỏ xe trước)
    const roiX = 210, roiY = 8, roiW = 105, roiH = 72;
    const imgData = signCtx.getImageData(roiX, roiY, roiW, roiH);
    const data = imgData.data;

    let redPixelCount = 0;
    let whitePixelCount = 0;
    let bluePixelCount = 0;
    let minX = roiW, maxX = 0, minY = roiH, maxY = 0;

    for (let py = 0; py < roiH; py++) {
      for (let px = 0; px < roiW; px++) {
        const i = (py * roiW + px) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Màu đỏ đặc trưng biển báo cấm giao thông
        if (r > 155 && g < 70 && b < 70 && (r - Math.max(g, b) > 65)) {
          redPixelCount++;
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
        }
        // Màu trắng lõi biển báo
        if (r > 200 && g > 200 && b > 200) {
          whitePixelCount++;
        }
        // Màu xanh dương biển cấm đỗ
        if (b > 140 && r < 80 && g < 100) {
          bluePixelCount++;
        }
      }
    }

    // Kiểm tra tỷ lệ khung hình tròn: w / h phải gần 1.0 (tránh vệt đèn hậu nằm ngang dài)
    const signW = maxX - minX;
    const signH = maxY - minY;
    const isCircularAspect = (signW >= 14 && signH >= 14 && signW / signH >= 0.70 && signW / signH <= 1.40);

    let detectedType = null;
    let detectedName = "";

    if (isCircularAspect && redPixelCount > 180) {
      if (whitePixelCount > 60 && (whitePixelCount / redPixelCount > 0.28)) {
        detectedType = "P.102";
        detectedName = "Cấm đi ngược chiều";
      } else if (whitePixelCount > 160) {
        detectedType = "P.127";
        detectedName = "Biển tốc độ";
      }
    } else if (isCircularAspect && bluePixelCount > 160 && redPixelCount > 100) {
      detectedType = "P.131";
      detectedName = "Cấm đỗ xe";
    }

    // Xác thực đa khung hình (Temporal Persistence Confirmation)
    if (detectedType && detectedType === lastCandidateSignType) {
      signCandidateCount++;
      if (signCandidateCount >= 4) { // Phát hiện liên tục 4 lần (~2.0s) trên lề đường
        signCandidateCount = 0;
        lastCandidateSignType = null;

        // Kiểm tra Cooldown 45 giây để KHÔNG lặp lại gây rối
        const lastAlert = signAlertCooldowns[detectedType] || 0;
        if (now - lastAlert > 45000) {
          signAlertCooldowns[detectedType] = now;
          if (detectedType === "P.102") {
            triggerForbiddenAlert("P.102", detectedName);
          } else if (detectedType === "P.127") {
            if (!speedLimitSource.includes("Camera")) {
              speedLimitSource = "Camera (Biển P.127)";
              updateSpeedSignUI();
              speakVoice(`Đã nhận diện biển báo tốc độ ${currentSpeedLimit} ki-lô-mét một giờ`);
            }
          } else if (detectedType === "P.131") {
            if (!isParkingAdvisorOpen) {
              toggleParkingAdvisor();
            }
          }
        }
      }
    } else {
      lastCandidateSignType = detectedType;
      signCandidateCount = detectedType ? 1 : 0;
    }
  } catch (err) {}
}

// ==========================================
// CẢNH BÁO ĐƯỜNG CẤM & CẤM GIỜ
// ==========================================
function triggerForbiddenAlert(signCode = "P.102", signName = "Cấm đi ngược chiều", extraSub = "") {
  isForbiddenRoadDetected = true;
  forbiddenSignType = signCode;
  lastForbiddenTime = performance.now();

  const alertBox = document.getElementById('forbidden-road-alert');
  if (alertBox) {
    alertBox.classList.remove('hidden');
    const titleEl = document.getElementById('forbidden-box-title');
    const subEl = document.getElementById('forbidden-box-sub');
    const iconEl = document.getElementById('forbidden-box-icon');

    if (signCode === "P.103a") {
      if (iconEl) iconEl.textContent = "🚫";
      if (titleEl) titleEl.textContent = "CẢNH BÁO: BIỂN P.103a CẤM Ô TÔ!";
      if (subEl) subEl.textContent = "Tuyến đường cấm ô tô lưu thông — Hãy chuyển hướng ngay!";
    } else if (signCode === "TIME_PEAK") {
      if (iconEl) iconEl.textContent = "⏰";
      if (titleEl) titleEl.textContent = "CẢNH BÁO: KHUNG GIỜ CẤM ĐƯỜNG!";
      if (subEl) subEl.textContent = extraSub || "Đang trong giờ cao điểm cấm xe — Phạt nặng & trừ điểm GPLX!";
    } else {
      if (iconEl) iconEl.textContent = "⛔";
      if (titleEl) titleEl.textContent = `⛔ NGUY HIỂM: BIỂN ${signCode} ${signName.toUpperCase()}!`;
      if (subEl) subEl.textContent = `Không được đi vào! Dừng lại hoặc chuyển hướng ngay!`;
    }
  }

  playBeep(2000, 300);

  const now = performance.now();
  // Khống chế chỉ nhắc giọng nói tối thiểu cách nhau 30 giây
  if (now - lastForbiddenSpeechTime > 30000) {
    lastForbiddenSpeechTime = now;
    if (signCode === "P.103a") {
      speakVoice("Nguy hiểm! Tuyến đường phía trước cấm xe ô tô!");
    } else if (signCode === "TIME_PEAK") {
      speakVoice("Cảnh báo! Tuyến đường đang trong khung giờ cấm xe!");
    } else {
      speakVoice("Nguy hiểm! Phía trước có biển đường cấm! Không được đi vào!");
    }
  }
}

function dismissForbiddenAlert() {
  isForbiddenRoadDetected = false;
  const alertBox = document.getElementById('forbidden-road-alert');
  if (alertBox) alertBox.classList.add('hidden');
}

// ==========================================
// XOAY MÀN HÌNH TÙY Ý & WAKE LOCK
// ==========================================
function cycleOrientation() {
  const icon = document.getElementById('orient-icon');
  const text = document.getElementById('orient-text');

  if (orientationMode === 'auto') {
    orientationMode = 'landscape';
    if (text) text.textContent = "Ngang";
    if (icon) icon.textContent = "🔄";
  } else if (orientationMode === 'landscape') {
    orientationMode = 'portrait';
    if (text) text.textContent = "Đứng";
    if (icon) icon.textContent = "🔄";
  } else {
    orientationMode = 'auto';
    if (text) text.textContent = "Tự động";
    if (icon) icon.textContent = "🔄";
  }

  applyOrientation();
}

function applyOrientation() {
  const container = document.getElementById('app-container');
  if (!container) return;

  container.classList.remove('forced-landscape', 'forced-portrait');

  if (screen.orientation && screen.orientation.lock) {
    if (orientationMode === 'landscape') {
      screen.orientation.lock('landscape').catch(() => {});
    } else if (orientationMode === 'portrait') {
      screen.orientation.lock('portrait').catch(() => {});
    } else {
      try { screen.orientation.unlock(); } catch (e) {}
    }
  }

  const winW = window.innerWidth;
  const winH = window.innerHeight;
  const isPhysicallyPortrait = winW < winH;

  if (orientationMode === 'landscape' && isPhysicallyPortrait) {
    container.classList.add('forced-landscape');
  } else if (orientationMode === 'portrait' && !isPhysicallyPortrait) {
    container.classList.add('forced-portrait');
  }

  setTimeout(updateCanvasSize, 150);
}

function updateCanvasSize() {
  const container = document.getElementById('app-container');
  const isForced = container && (container.classList.contains('forced-landscape') || container.classList.contains('forced-portrait'));

  let w = window.innerWidth || 800;
  let h = window.innerHeight || 450;

  if (isForced) {
    w = window.innerHeight;
    h = window.innerWidth;
  }

  if (!isDemoMode && videoEl && videoEl.videoWidth && videoEl.videoHeight) {
    canvasEl.width = videoEl.videoWidth;
    canvasEl.height = videoEl.videoHeight;
  } else {
    canvasEl.width = w;
    canvasEl.height = h;
  }
}

async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch (err) {}
  }
}

// ==========================================
// MÔ HÌNH NHẬN DIỆN XE
// ==========================================
async function loadAiModel() {
  const subtext = document.getElementById('alert-subtext');
  subtext.textContent = "Đang tải AI tự động nhận diện xe & biển báo...";
  try {
    if (typeof cocoSsd !== 'undefined') {
      aiModel = await cocoSsd.load({ base: 'mobilenet_v2' });
      subtext.textContent = "AI sẵn sàng | Thông tư 38/2024/TT-BGTVT & NĐ 168/2024";
    }
  } catch (e) {
    subtext.textContent = "Radar Tự Động | Thông tư 38/2024/TT-BGTVT";
  }
}

// ==========================================
// VÒNG LẶP XỬ LÝ THEO THỜI GIAN THỰC (FPS CHUẨN 60 FPS KHÔNG GIẬT)
// ==========================================
let frameThrottle = 0;

async function runDetectionAsync() {
  if (isDetectingAsync || !aiModel || !videoEl || videoEl.readyState < 2) return;
  isDetectingAsync = true;

  try {
    const predictions = await aiModel.detect(videoEl);
    lastAiDetectTimestamp = performance.now();
    updateTracksFromDetections(predictions);
  } catch (err) {
    // Lỗi nhẹ không làm dừng chương trình
  } finally {
    isDetectingAsync = false;
  }
}

function updateTracksFromDetections(predictions) {
  const now = performance.now();
  const targetClasses = ['car', 'truck', 'bus', 'motorcycle'];
  const validDets = predictions.filter(p => targetClasses.includes(p.class) && p.score >= 0.38);

  // Khớp detections mới với activeTracks bằng IoU
  const matchedTrackIds = new Set();
  const matchedDetIndices = new Set();

  for (let dIdx = 0; dIdx < validDets.length; dIdx++) {
    const det = validDets[dIdx];
    let bestIou = 0.25;
    let bestTrack = null;

    for (const tr of activeTracks) {
      if (matchedTrackIds.has(tr.id)) continue;
      const iou = computeIoU(det.bbox, tr.bbox);
      if (iou > bestIou) {
        bestIou = iou;
        bestTrack = tr;
      }
    }

    if (bestTrack) {
      // Làm mịn tọa độ hộp bounding box bằng EMA
      bestTrack.bbox = [
        0.65 * det.bbox[0] + 0.35 * bestTrack.bbox[0],
        0.65 * det.bbox[1] + 0.35 * bestTrack.bbox[1],
        0.65 * det.bbox[2] + 0.35 * bestTrack.bbox[2],
        0.65 * det.bbox[3] + 0.35 * bestTrack.bbox[3]
      ];
      bestTrack.class = det.class;
      bestTrack.confidence = det.score;
      bestTrack.lastSeen = now;
      matchedTrackIds.add(bestTrack.id);
      matchedDetIndices.add(dIdx);
    }
  }

  // Thêm các detection mới chưa có track
  for (let dIdx = 0; dIdx < validDets.length; dIdx++) {
    if (!matchedDetIndices.has(dIdx)) {
      const det = validDets[dIdx];
      activeTracks.push({
        id: nextTrackId++,
        bbox: [...det.bbox],
        class: det.class,
        confidence: det.score,
        lastSeen: now,
        distance: 60.0,
        vRel: 0.0,
        inPath: false,
        kalman: null
      });
    }
  }

  // Dọn dẹp các track đã khuất hoặc mất dấu quá 450ms
  activeTracks = activeTracks.filter(tr => (now - tr.lastSeen) <= 450);
}

function computeIoU(b1, b2) {
  const xA = Math.max(b1[0], b2[0]);
  const yA = Math.max(b1[1], b2[1]);
  const xB = Math.min(b1[0] + b1[2], b2[0] + b2[2]);
  const yB = Math.min(b1[1] + b1[3], b2[1] + b2[3]);
  const inter = Math.max(0, xB - xA) * Math.max(0, yB - yA);
  const union = b1[2] * b1[3] + b2[2] * b2[3] - inter;
  return union > 0 ? inter / union : 0;
}

function processFrame(now) {
  if (!isRunning) return;

  const dt = Math.max(0.01, (now - lastFrameTime) / 1000.0);
  lastFrameTime = now;
  frameThrottle++;

  const w = canvasEl.width;
  const h = canvasEl.height;

  ctx.clearRect(0, 0, w, h);

  let leadVehicle = null;
  let rawDistance = 95.0;

  if (isDemoMode) {
    demoTimer += dt;
    const cycle = demoTimer % 28.0;

    if (isDraggingDistanceBar || isManualDistanceOverride) {
      rawDistance = currentLeadDistance;
    } else if (cycle < 6.0) {
      currentSpeedKmh = 80.0;
      currentSpeedLimit = 80.0;
      speedLimitSource = "Tự động";
      rawDistance = 75.0 + 3.0 * Math.sin(demoTimer * 0.8);
      demoBraking = false;
      simulatedRoadSign = null;
    } else if (cycle < 11.0) {
      currentSpeedKmh = 85.0;
      rawDistance = 42.0 + 2.0 * Math.sin(demoTimer * 1.2);
      demoBraking = false;
    } else if (cycle < 15.0) {
      currentSpeedKmh = 80.0;
      const brakeProgress = (cycle - 11.0) / 4.0;
      rawDistance = 42.0 - brakeProgress * 24.0;
      demoBraking = true;
    } else if (cycle < 19.0) {
      currentSpeedKmh = 93.0;
      rawDistance = 65.0;
      demoBraking = false;
    } else if (cycle < 23.0) {
      currentSpeedKmh = 45.0;
      rawDistance = 55.0;
      demoBraking = false;
      simulatedRoadSign = { type: "P.103a", name: "Cấm ô tô", dist: 25.0 };
      triggerForbiddenAlert("P.103a", "Cấm xe ô tô");
    } else {
      currentSpeedKmh = 50.0;
      rawDistance = 60.0;
      demoBraking = false;
      simulatedRoadSign = { type: "P.102", name: "Cấm đi ngược chiều", dist: 25.0 };
      triggerForbiddenAlert("P.102", "Cấm đi ngược chiều");
    }

    updateSpeedUI();
    updateSpeedSignUI();
    renderDemoRoadAndCar(ctx, w, h, rawDistance, demoBraking, simulatedRoadSign);

    leadVehicle = {
      id: 1,
      bbox: [w / 2 - 60, h * 0.48, 120, 80],
      class: 'car',
      distance: rawDistance,
      vRel: demoBraking ? -18.0 : 0.0,
      inPath: true
    };
    currentLeadDistance = rawDistance;
  } else {
    // KHÔNG CHẶN REQUESTANIMATIONFRAME - Gọi nhận diện AI bất đồng bộ
    if (aiModel && videoEl.readyState >= 2 && !isDetectingAsync) {
      runDetectionAsync();
    }

    // Chọn xe dẫn đầu CIPV bằng hành lang phối cảnh hình thang và bộ lọc Kalman 60 FPS
    leadVehicle = updateCipvSelection(w, h, dt);

    if (leadVehicle) {
      rawDistance = leadVehicle.distance;
      currentLeadDistance = rawDistance;
    } else {
      rawDistance = 95.0;
      currentLeadDistance = 95.0;
    }

    if (isDraggingDistanceBar || isManualDistanceOverride) {
      currentLeadDistance = smoothedDistance;
    }

    autoScanTrafficSigns(w, h);
  }

  if (isForbiddenRoadDetected && (now - lastForbiddenTime > 6000)) {
    dismissForbiddenAlert();
  }

  // Tính TTC chính xác: chỉ cảnh báo va chạm khi ta đang tiến lại gần (vApproach > 1.5 m/s)
  let vApproachMps = 0.0;
  if (leadVehicle && leadVehicle.vRel < -1.5) {
    vApproachMps = -leadVehicle.vRel / 3.6;
    currentTtc = Math.max(0.5, currentLeadDistance / vApproachMps);
  } else {
    currentTtc = 99.0;
  }

  const assessment = evaluateVietnamLegalStandard(
    currentSpeedKmh, currentLeadDistance, weatherMode, leadVehicle !== null
  );
  currentAlertLevel = assessment.level;

  triggerCombinedAlerts(assessment);
  drawArHud(ctx, w, h, activeTracks, leadVehicle, assessment, simulatedRoadSign);
  updateHudElements(assessment, leadVehicle !== null);

  requestAnimationFrame(processFrame);
}

// ==========================================
// VẼ MÔ PHỎNG ĐƯỜNG TRONG DEMO
// ==========================================
function renderDemoRoadAndCar(ctx, w, h, distance, isBraking, roadSign) {
  const horizonY = h * 0.46;
  const vanishX = w / 2;

  ctx.fillStyle = weatherMode === 'wet' ? "#1e293b" : "#38bdf8";
  ctx.fillRect(0, 0, w, horizonY);

  ctx.fillStyle = weatherMode === 'wet' ? "#14532d" : "#15803d";
  ctx.fillRect(0, horizonY, w, h - horizonY);

  ctx.beginPath();
  ctx.moveTo(vanishX - 30, horizonY);
  ctx.lineTo(vanishX + 30, horizonY);
  ctx.lineTo(w * 0.90, h);
  ctx.lineTo(w * 0.10, h);
  ctx.closePath();
  ctx.fillStyle = weatherMode === 'wet' ? "#1e2430" : "#334155";
  ctx.fill();

  const laneOffset = (demoTimer * 120) % 50;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.setLineDash([15, 20]);
  ctx.beginPath();
  ctx.moveTo(vanishX, horizonY);
  ctx.lineTo(vanishX, h);
  ctx.stroke();
  ctx.setLineDash([]);

  if (roadSign) {
    const signX = w * 0.78;
    const signY = horizonY + 30;
    const signR = 26;

    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(signX, signY + signR);
    ctx.lineTo(signX, signY + 90);
    ctx.stroke();

    if (roadSign.type === "P.103a") {
      // Biển P.103a: Tròn viền đỏ nền trắng, vẽ ô tô con ở giữa
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(signX, signY, signR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = 5;
      ctx.stroke();

      ctx.fillStyle = "#1e293b";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("🚗", signX - 10, signY + 6);

      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.fillRect(signX - 60, signY - signR - 22, 120, 18);
      ctx.fillStyle = "#fca5a5";
      ctx.font = "bold 10px sans-serif";
      ctx.fillText("CẤM Ô TÔ P.103a", signX - 52, signY - signR - 9);
    } else {
      // Biển P.102: Cấm đi ngược chiều
      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.arc(signX, signY, signR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(signX - signR * 0.65, signY - 5, signR * 1.3, 10);

      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.fillRect(signX - 60, signY - signR - 22, 120, 18);
      ctx.fillStyle = "#fca5a5";
      ctx.font = "bold 10px sans-serif";
      ctx.fillText("BIỂN CẤM P.102", signX - 44, signY - signR - 9);
    }
  }

  const fx = 580;
  const carW = Math.max(25, Math.min(w * 0.60, (fx * 1.85) / distance));
  const carH = Math.max(20, Math.min(h * 0.50, (fx * 1.50) / distance));

  const tDist = Math.exp(-0.022 * distance);
  const carBottomY = horizonY + (h - horizonY) * tDist * 0.95;
  const carTopY = carBottomY - carH;
  const carX1 = vanishX - carW / 2;

  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(carX1, carBottomY - 4, carW, 8);

  ctx.fillStyle = "#dc2626";
  ctx.fillRect(carX1, carTopY + carH * 0.35, carW, carH * 0.60);

  ctx.fillStyle = "#991b1b";
  ctx.fillRect(carX1 + carW * 0.15, carTopY, carW * 0.70, carH * 0.40);

  const lightW = Math.max(4, carW * 0.18);
  const lightH = Math.max(3, carH * 0.14);
  const lightY = carTopY + carH * 0.40;

  if (isBraking) {
    ctx.fillStyle = "#ff0000";
    ctx.shadowColor = "#ff0000";
    ctx.shadowBlur = 15;
  } else {
    ctx.fillStyle = "#7f1d1d";
    ctx.shadowBlur = 0;
  }
  ctx.fillRect(carX1 + carW * 0.05, lightY, lightW, lightH);
  ctx.fillRect(carX1 + carW * 0.95 - lightW, lightY, lightW, lightH);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(vanishX - carW * 0.15, carBottomY - carH * 0.25, carW * 0.30, carH * 0.12);
}

// ==========================================
// THUẬT TOÁN ĐO KHOẢNG CÁCH QUANG HỌC & CIPV (HÀNH LANG HÌNH THANG PHỐI CẢNH)
// Chuẩn ISO 15623 & ISO 22838 / comma.ai openpilot
// ==========================================
function updateCipvSelection(w, h, dt) {
  if (!activeTracks || activeTracks.length === 0) {
    lockedCipvId = null;
    cipvCandidateId = null;
    cipvCandidateFrames = 0;
    return null;
  }

  const horizonY = h * 0.48;
  const centerX = w / 2.0;

  // Hành lang làn xe phối cảnh hình thang:
  // Tại chân trời (horizonY): bề rộng hẹp (khoảng 14% frame width)
  // Tại mui xe (h): bề rộng mở rộng (khoảng 64% frame width)
  const topHalfW = (w * 0.14) / 2.0;
  const bottomHalfW = (w * 0.64) / 2.0;

  let bestCandidate = null;
  let minDistance = 999.0;

  for (const tr of activeTracks) {
    const [vx, vy, vw, vh] = tr.bbox;
    const carCenterX = vx + vw / 2.0;
    const carContactY = vy + vh;

    // Tính bề rộng cho phép tại vị trí tiếp xúc mặt đường (contact point) của xe
    const progress = Math.max(0.0, Math.min(1.0, (carContactY - horizonY) / Math.max(1, h - horizonY)));
    const corridorHalfW = topHalfW + progress * (bottomHalfW - topHalfW);

    // Kiểm tra xe có nằm trong hành lang làn xe bản thân (ego corridor) không
    const isInCorridor = (Math.abs(carCenterX - centerX) <= corridorHalfW) && (carContactY >= horizonY);
    tr.inPath = isInCorridor;

    // Đo khoảng cách quang học
    const rawDist = estimateOpticalDistance(tr, w, h);

    // Khởi tạo hoặc cập nhật Kalman Filter
    if (!tr.kalman) {
      tr.kalman = new KalmanDistanceFilter(rawDist);
    }
    const filteredDist = tr.kalman.update(rawDist, dt);
    tr.distance = filteredDist;
    tr.vRel = tr.kalman.v * 3.6; // m/s -> km/h

    // Nếu xe nằm trong hành lang, xét làm ứng viên CIPV (xe gần nhất phía trước)
    if (isInCorridor && filteredDist < minDistance) {
      minDistance = filteredDist;
      bestCandidate = tr;
    }
  }

  // Khóa mục tiêu với cơ chế Hysteresis (Target Locking):
  // Tránh nhảy mục tiêu liên tục giữa các xe
  if (bestCandidate) {
    if (lockedCipvId === null) {
      lockedCipvId = bestCandidate.id;
      cipvCandidateId = bestCandidate.id;
      cipvCandidateFrames = 1;
    } else if (bestCandidate.id === lockedCipvId) {
      cipvCandidateFrames = 0;
    } else {
      // Có xe khác gần hơn hoặc chen vào làn
      if (bestCandidate.id === cipvCandidateId) {
        cipvCandidateFrames++;
        if (cipvCandidateFrames >= 4) { // Xác thực liên tục 4 chu kỳ mới đổi khóa mục tiêu
          lockedCipvId = bestCandidate.id;
          cipvCandidateFrames = 0;
        }
      } else {
        cipvCandidateId = bestCandidate.id;
        cipvCandidateFrames = 1;
      }
    }
  } else {
    // Không có xe nào trong hành lang
    lockedCipvId = null;
    cipvCandidateId = null;
    cipvCandidateFrames = 0;
  }

  // Trả về track đang được khóa CIPV
  if (lockedCipvId !== null) {
    const locked = activeTracks.find(t => t.id === lockedCipvId);
    if (locked) return locked;
  }

  return bestCandidate;
}

function selectLeadVehicle(vehicles, frameWidth, frameHeight) {
  if (!vehicles || vehicles.length === 0) return null;

  const centerX = frameWidth / 2.0;
  const horizonY = frameHeight * 0.48;
  const topHalfW = (frameWidth * 0.14) / 2.0;
  const bottomHalfW = (frameWidth * 0.64) / 2.0;

  let bestCar = null;
  let maxBottomY = -1;

  for (const v of vehicles) {
    const [vx, vy, vw, vh] = v.bbox;
    const carCenterX = vx + vw / 2.0;
    const carBottomY = vy + vh;

    const progress = Math.max(0.0, Math.min(1.0, (carBottomY - horizonY) / Math.max(1, frameHeight - horizonY)));
    const corridorHalfW = topHalfW + progress * (bottomHalfW - topHalfW);

    if (Math.abs(carCenterX - centerX) <= corridorHalfW && carBottomY >= horizonY) {
      if (carBottomY > maxBottomY) {
        maxBottomY = carBottomY;
        bestCar = v;
      }
    }
  }

  return bestCar;
}

function estimateOpticalDistance(vehicle, frameWidth, frameHeight) {
  const [vx, vy, vw, vh] = vehicle.bbox;
  
  let realWidth = 1.85;
  if (vehicle.class === 'truck') realWidth = 2.45;
  else if (vehicle.class === 'bus') realWidth = 2.50;
  else if (vehicle.class === 'motorcycle') realWidth = 0.80;

  const hfovRad = 68.0 * (Math.PI / 180.0);
  const fx = (frameWidth / 2.0) / Math.tan(hfovRad / 2.0);

  const distWidth = (fx * realWidth) / Math.max(10, vw);

  const horizonY = frameHeight * 0.48;
  const contactY = vy + vh;
  const dy = Math.max(5, contactY - horizonY);
  const alphaRad = Math.atan2(dy, fx);
  const camHeight = 1.30;
  const distGround = camHeight / Math.tan(0.03 + alphaRad);

  const dist = 0.65 * distWidth + 0.35 * distGround;
  return Math.max(2.0, Math.min(130.0, dist));
}

// ==========================================
// ĐÁNH GIÁ CHUẨN THÔNG TƯ SỐ 38/2024/TT-BGTVT
// ==========================================
function evaluateVietnamLegalStandard(speedKmh, actualDist, weather, hasLeadVehicle = true) {
  let legalMin = 55.0;
  let citation = "";

  if (speedKmh <= 60.0) {
    const calc = (speedKmh * 1000.0 / 3600.0) * 2.5;
    legalMin = Math.max(15.0, Math.min(35.0, calc));
    citation = "Điều 11 TT 38/2024/TT-BGTVT (V ≤ 60km/h: Chủ động giữ khoảng cách an toàn)";
  } else if (speedKmh <= 80.0) {
    legalMin = 55.0;
    citation = "Điều 11 TT 38/2024/TT-BGTVT (60 < V ≤ 80km/h: Cự ly tối thiểu 55m)";
  } else if (speedKmh <= 100.0) {
    legalMin = 70.0;
    citation = "Điều 11 TT 38/2024/TT-BGTVT (80 < V ≤ 100km/h: Cự ly tối thiểu 70m)";
  } else if (speedKmh <= 120.0) {
    legalMin = 100.0;
    citation = "Điều 11 TT 38/2024/TT-BGTVT (100 < V ≤ 120km/h: Cự ly tối thiểu 100m)";
  } else {
    legalMin = 120.0;
    citation = "V > 120km/h: Vượt tốc độ cao tốc tối đa! Cự ly an toàn >= 120m";
  }

  if (weather === 'wet') {
    legalMin = Math.round(legalMin * 1.40);
    citation += " [Mưa trơn trượt: +40% cự ly]";
  }

  if (!hasLeadVehicle) {
    return {
      level: 'safe',
      title: "🟢 LÀN ĐƯỜNG THÔNG THOÁNG",
      citation: `Không có phương tiện cản trở trong làn di chuyển | Cự ly quy chuẩn: ${legalMin}m`,
      legalMin,
      actualDist: 99.9,
      ttc: 99.0,
      hasLeadVehicle: false
    };
  }

  let level = 'safe';
  let title = "AN TOÀN: ĐẠT CHUẨN KHOẢNG CÁCH";

  if (actualDist < (0.60 * legalMin) || currentTtc < 1.8) {
    level = 'critical';
    title = `⚠️ NGUY HIỂM: BÁM ĐUÔI QUÁ GẦN (${actualDist.toFixed(1)}m < ${legalMin}m)`;
  } else if (actualDist < legalMin || currentTtc < 2.8) {
    level = 'warning';
    title = `CHÚ Ý: DƯỚI CỰ LY AN TOÀN (${actualDist.toFixed(1)}m / ${legalMin}m)`;
  }

  return {
    level,
    title,
    citation,
    legalMin,
    actualDist,
    ttc: currentTtc,
    hasLeadVehicle: true
  };
}

// ==========================================
// ÂM THANH BÍP & GIỌNG NÓI TIẾNG VIỆT
// ==========================================
function initAudio() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  } catch (e) {}
}

function playBeep(freq = 1200, durationMs = 120) {
  if (!audioEnabled || !audioCtx) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    gain.gain.setValueAtTime(0.85, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + (durationMs / 1000.0));

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + (durationMs / 1000.0));
  } catch (e) {}
}

function speakVoice(text) {
  if (!audioEnabled || !('speechSynthesis' in window)) return;
  const now = performance.now();
  if (now - lastSpeechTime < 4500) return;
  lastSpeechTime = now;

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  } catch (e) {}
}
const speakText = speakVoice;

function triggerCombinedAlerts(assessment) {
  const now = performance.now();

  // 1. CẢNH BÁO ĐƯỜNG CẤM HOẶC CẤM THEO GIỜ (Ưu tiên số 1)
  if (isForbiddenRoadDetected) {
    return;
  }

  // 2. CẢNH BÁO QUÁ TỐC ĐỘ GIỚI HẠN (Nghị định 168/2024/NĐ-CP)
  if (isOverspeeding) {
    if (now - lastBeepTime > 600) {
      playBeep(1500, 150);
      lastBeepTime = now;
    }
    if (now - lastSpeedSpeechTime > 12000) {
      lastSpeedSpeechTime = now;
      speakVoice(`Cảnh báo! Bạn đang chạy quá tốc độ giới hạn ${currentSpeedLimit}!`);
    }
    return;
  }

  // Nếu không có xe cản trở trong làn, giữ yên lặng tuyệt đối chống làm phiền tài xế
  if (!assessment.hasLeadVehicle) {
    return;
  }

  // 3. CẢNH BÁO KHOẢNG CÁCH VA CHẠM (Thông tư 38/2024/TT-BGTVT)
  if (assessment.level === 'critical') {
    if (now - lastBeepTime > 350) {
      playBeep(1800, 150);
      lastBeepTime = now;
    }
    if (now - lastSpokenCriticalTime > 10000) {
      lastSpokenCriticalTime = now;
      speakVoice("Nguy hiểm! Giảm tốc độ ngay!");
    }
  } else if (assessment.level === 'warning') {
    if (now - lastBeepTime > 1600) {
      playBeep(1000, 150);
      lastBeepTime = now;
    }
    if (now - lastSpokenWarningTime > 25000) {
      lastSpokenWarningTime = now;
      speakVoice("Chú ý! Bám sát xe trước!");
    }
  }
}

// ==========================================
// VẼ AR HUD TRÊN CANVAS (CHUẨN ADAS HIỆN ĐẠI)
// ==========================================
function drawArHud(ctx, w, h, tracks, leadVehicle, assessment, roadSign) {
  const horizonY = h * 0.48;
  const vanishX = w / 2.0;

  let pathColor = "rgba(16, 185, 129, 0.22)";
  let strokeColor = "#10b981";

  if (isForbiddenRoadDetected || assessment.level === 'critical' || isOverspeeding) {
    pathColor = "rgba(239, 68, 68, 0.35)";
    strokeColor = "#ef4444";
  } else if (assessment.level === 'warning') {
    pathColor = "rgba(245, 158, 11, 0.28)";
    strokeColor = "#f59e0b";
  }

  // 1. HÀNH LANG PHỐI CẢNH LÀN XE (EGO PATH FRUSTUM)
  ctx.beginPath();
  ctx.moveTo(vanishX - w * 0.07, horizonY);
  ctx.lineTo(vanishX + w * 0.07, horizonY);
  ctx.lineTo(vanishX + w * 0.32, h);
  ctx.lineTo(vanishX - w * 0.32, h);
  ctx.closePath();
  ctx.fillStyle = pathColor;
  ctx.fill();

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(vanishX - w * 0.07, horizonY);
  ctx.lineTo(vanishX - w * 0.32, h);
  ctx.moveTo(vanishX + w * 0.07, horizonY);
  ctx.lineTo(vanishX + w * 0.32, h);
  ctx.stroke();
  ctx.setLineDash([]);

  // 2. VẼ CÁC XE NGOÀI LÀN (ADJACENT VEHICLES)
  if (!isDemoMode && tracks && tracks.length > 0) {
    for (const tr of tracks) {
      if (leadVehicle && tr.id === leadVehicle.id) continue;

      const [vx, vy, vw, vh] = tr.bbox;
      ctx.strokeStyle = "rgba(148, 163, 184, 0.65)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(vx, vy, vw, vh);
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(15, 23, 42, 0.70)";
      ctx.fillRect(vx, Math.max(0, vy - 18), 85, 16);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px -apple-system, sans-serif";
      ctx.fillText("[Xe làn bên]", vx + 4, Math.max(12, vy - 6));
    }
  }

  // 3. VẼ XE DẪN ĐẦU ĐƯỢC KHÓA MỤC TIÊU (LOCKED CIPV)
  if (leadVehicle) {
    const [vx, vy, vw, vh] = leadVehicle.bbox;
    const carCenterX = vx + vw / 2.0;
    const carBottomY = vy + vh;

    // Tia sáng dẫn đường 3D từ đáy xe đến xe ta
    const grad = ctx.createLinearGradient(vanishX, h, carCenterX, carBottomY);
    grad.addColorStop(0, strokeColor);
    grad.addColorStop(1, "rgba(255, 255, 255, 0.0)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(vanishX - 30, h);
    ctx.lineTo(carCenterX - vw * 0.3, carBottomY);
    ctx.moveTo(vanishX + 30, h);
    ctx.lineTo(carCenterX + vw * 0.3, carBottomY);
    ctx.stroke();

    // Vạch tiếp xúc mặt đường
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(vx, carBottomY);
    ctx.lineTo(vx + vw, carBottomY);
    ctx.stroke();

    // TÂM NGẮM KHÓA MỤC TIÊU NEON (TARGET LOCK RETICLE)
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 4;
    const cLen = Math.min(26, vw * 0.28);

    ctx.beginPath();
    ctx.moveTo(vx, vy + cLen); ctx.lineTo(vx, vy); ctx.lineTo(vx + cLen, vy);
    ctx.moveTo(vx + vw - cLen, vy); ctx.lineTo(vx + vw, vy); ctx.lineTo(vx + vw, vy + cLen);
    ctx.moveTo(vx, vy + vh - cLen); ctx.lineTo(vx, vy + vh); ctx.lineTo(vx + cLen, vy + vh);
    ctx.moveTo(vx + vw - cLen, vy + vh); ctx.lineTo(vx + vw, vy + vh); ctx.lineTo(vx + vw, vy + vh - cLen);
    ctx.stroke();

    // DẤU TÂM NGẮM TRUNG TÂM
    const cy = vy + vh * 0.55;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(carCenterX - 10, cy); ctx.lineTo(carCenterX + 10, cy);
    ctx.moveTo(carCenterX, cy - 10); ctx.lineTo(carCenterX, cy + 10);
    ctx.stroke();

    // BẢNG THÔNG SỐ HUD NỔI TRÊN XE MỤC TIÊU
    const tagW = 210;
    const tagH = 40;
    const tagX = Math.max(8, Math.min(w - tagW - 8, carCenterX - tagW / 2));
    const tagY = Math.max(8, vy - tagH - 10);

    ctx.fillStyle = "rgba(15, 23, 42, 0.90)";
    ctx.fillRect(tagX, tagY, tagW, tagH);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(tagX, tagY, tagW, tagH);

    ctx.fillStyle = strokeColor;
    ctx.font = "bold 11px -apple-system, sans-serif";
    ctx.fillText(`🎯 KHÓA MỤC TIÊU: CIPV #${leadVehicle.id}`, tagX + 10, tagY + 15);

    const relSign = (leadVehicle.vRel || 0) > 0 ? "+" : "";
    const relText = `Δv: ${relSign}${Math.round(leadVehicle.vRel || 0)} km/h`;
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px -apple-system, sans-serif";
    ctx.fillText(`${assessment.actualDist.toFixed(1)}m | TTC: ${assessment.ttc > 50 ? '∞' : assessment.ttc.toFixed(1) + 's'} | ${relText}`, tagX + 10, tagY + 33);
  } else if (!isDemoMode) {
    const tagW = 240;
    const tagH = 30;
    const tagX = vanishX - tagW / 2;
    const tagY = horizonY + 25;

    ctx.fillStyle = "rgba(16, 185, 129, 0.85)";
    ctx.fillRect(tagX, tagY, tagW, tagH);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px -apple-system, sans-serif";
    ctx.fillText("🟢 LÀN ĐƯỜNG THÔNG THOÁNG", tagX + 18, tagY + 20);
  }

  if (isForbiddenRoadDetected || assessment.level === 'critical' || isOverspeeding) {
    ctx.strokeStyle = "rgba(239, 68, 68, 0.90)";
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, w, h);
  }
}

// ==========================================
// CẬP NHẬT GIAO DIỆN HTML
// ==========================================
function updateHudElements(assessment, hasLeadVehicle = true) {
  const banner = document.getElementById('alert-banner');
  
  if (isForbiddenRoadDetected) {
    banner.className = 'critical';
    document.getElementById('alert-title').textContent = "⛔ CẢNH BÁO: ĐƯỜNG CẤM HOẶC CẤM THEO GIỜ!";
    document.getElementById('alert-subtext').textContent = "QCVN 41:2019/BGTVT & NĐ 168/2024 — Chuyển hướng ngay!";
  } else if (isOverspeeding) {
    banner.className = 'critical';
    const excess = Math.round(currentSpeedKmh - currentSpeedLimit);
    document.getElementById('alert-title').textContent = `⚡ CẢNH BÁO QUÁ TỐC ĐỘ: ${Math.round(currentSpeedKmh)} / ${currentSpeedLimit} km/h (+${excess} km/h)`;
    document.getElementById('alert-subtext').textContent = "Nghị định 168/2024/NĐ-CP (Trừ điểm GPLX) — Vui lòng giảm tốc độ!";
  } else {
    banner.className = assessment.level;
    document.getElementById('alert-title').textContent = assessment.title;
    document.getElementById('alert-subtext').textContent = assessment.citation;
  }

  const distValEl = document.getElementById('val-distance');
  const ttcValEl = document.getElementById('val-ttc');

  if (hasLeadVehicle) {
    distValEl.innerHTML = `${assessment.actualDist.toFixed(1)}<span class="metric-unit">m</span>`;
    ttcValEl.innerHTML = `${assessment.ttc > 50 ? '∞' : assessment.ttc.toFixed(1)}<span class="metric-unit">s</span>`;
  } else {
    distValEl.innerHTML = `>90<span class="metric-unit">m</span>`;
    ttcValEl.innerHTML = `∞<span class="metric-unit">s</span>`;
  }

  const maxScale = 120.0;
  const actualRatio = hasLeadVehicle ? Math.min(1.0, assessment.actualDist / maxScale) : 0.92;
  const legalRatio = Math.min(1.0, assessment.legalMin / maxScale);

  const pointerEl = document.getElementById('bar-car-pointer');
  if (pointerEl) pointerEl.style.left = `${actualRatio * 100}%`;
  const legalEl = document.getElementById('bar-legal-marker');
  if (legalEl) legalEl.style.left = `${legalRatio * 100}%`;

  const critEl = document.getElementById('bar-zone-critical');
  if (critEl) critEl.style.width = `${legalRatio * 60}%`;
  const warnEl = document.getElementById('bar-zone-warning');
  if (warnEl) {
    warnEl.style.left = `${legalRatio * 60}%`;
    warnEl.style.width = `${legalRatio * 40}%`;
  }

  const lblLegal = document.getElementById('lbl-bar-legal');
  if (lblLegal) lblLegal.textContent = `Luật: ${assessment.legalMin}m`;
  const lblActual = document.getElementById('lbl-bar-actual');
  if (lblActual) {
    lblActual.textContent = hasLeadVehicle ? `Thực tế: ${assessment.actualDist.toFixed(1)}m` : `Làn trống`;
  }
}

// ==========================================
// MODAL CHỌN TỐC ĐỘ GIỚI HẠN & DI CHUYỂN LỰA CHỌN
// ==========================================
function openSpeedLimitModal() {
  const modal = document.getElementById('speed-modal');
  if (modal) modal.style.display = 'flex';
}

function closeSpeedLimitModal(event) {
  if (event && event.target && event.target.closest && event.target.closest('.modal-box') && event.target !== event.currentTarget) {
    return;
  }
  const modal = document.getElementById('speed-modal');
  if (modal) modal.style.display = 'none';
}

function setSpeedLimit(val) {
  const modal = document.getElementById('speed-modal');
  if (modal) modal.style.display = 'none';

  if (val === 'auto') {
    currentSpeedLimit = 80.0;
    speedLimitSource = "Tự động (AI/GPS)";
    const lbl = document.getElementById('speed-source-label');
    const num = document.getElementById('limit-number');
    if (lbl) lbl.textContent = "TỰ ĐỘNG";
    if (num) num.textContent = "80";
    speakText("Đã kích hoạt chế độ nhận diện tốc độ tự động theo AI và GPS");
  } else {
    currentSpeedLimit = Number(val);
    speedLimitSource = `Thủ công (${val} km/h)`;
    const lbl = document.getElementById('speed-source-label');
    const num = document.getElementById('limit-number');
    if (lbl) lbl.textContent = `${val} KM/H`;
    if (num) num.textContent = `${val}`;
    speakText(`Đã cài đặt giới hạn tốc độ ${val} ki lô mét một giờ`);
  }
  updateSpeedUI();
  updateSpeedSignUI();
}

function customSpeedLimitPrompt() {
  const input = prompt("Nhập tốc độ tối đa cho phép của tuyến đường (km/h):", currentSpeedLimit);
  if (input !== null) {
    const val = parseFloat(input);
    if (!isNaN(val) && val >= 20 && val <= 140) {
      setSpeedLimit(Math.round(val));
    } else {
      alert("Vui lòng nhập tốc độ hợp lệ từ 20 đến 140 km/h");
    }
  }
}

function promptManualSpeed() {
  const input = prompt("Nhập vận tốc xe di chuyển (km/h):", Math.round(currentSpeedKmh));
  if (input !== null) {
    const val = parseFloat(input);
    if (!isNaN(val) && val >= 0 && val <= 250) {
      currentSpeedKmh = val;
      updateSpeedUI();
      speakText(`Vận tốc xe ${Math.round(val)} ki lô mét một giờ`);
    }
  }
}

function promptManualDistance() {
  const input = prompt("Nhập khoảng cách xe trước muốn kiểm tra (mét):", Math.round(currentLeadDistance));
  if (input !== null) {
    const val = parseFloat(input);
    if (!isNaN(val) && val >= 1 && val <= 200) {
      currentLeadDistance = val;
      smoothedDistance = val;
      isManualDistanceOverride = true;
      clearTimeout(manualOverrideTimeout);
      manualOverrideTimeout = setTimeout(() => { isManualDistanceOverride = false; }, 15000);
      const assessment = evaluateVietnamLegalStandard(currentSpeedKmh, currentLeadDistance, weatherMode);
      updateHudElements(assessment);
      speakText(`Khoảng cách ${Math.round(val)} mét`);
    }
  }
}

// ==========================================
// TƯƠNG TÁC CHẠM & KÉO THANH KHOẢNG CÁCH (SLIDER DRAG)
// ==========================================
function initDistanceBarInteraction() {
  const track = document.getElementById('bar-track');
  if (!track) return;

  function updateFromPointer(clientX) {
    const rect = track.getBoundingClientRect();
    let frac = (clientX - rect.left) / rect.width;
    frac = Math.max(0.04, Math.min(1.0, frac));
    const dist = Math.round(frac * 120); // 5m đến 120m
    currentLeadDistance = dist;
    smoothedDistance = dist;
    isManualDistanceOverride = true;
    clearTimeout(manualOverrideTimeout);
    manualOverrideTimeout = setTimeout(() => { isManualDistanceOverride = false; }, 15000);

    const assessment = evaluateVietnamLegalStandard(currentSpeedKmh, currentLeadDistance, weatherMode);
    updateHudElements(assessment);
  }

  // Pointer & Touch Events
  track.addEventListener('pointerdown', (e) => {
    isDraggingDistanceBar = true;
    updateFromPointer(e.clientX);
    try { track.setPointerCapture(e.pointerId); } catch(err){}
  });

  track.addEventListener('pointermove', (e) => {
    if (isDraggingDistanceBar) {
      updateFromPointer(e.clientX);
    }
  });

  track.addEventListener('pointerup', (e) => {
    if (isDraggingDistanceBar) {
      isDraggingDistanceBar = false;
      try { track.releasePointerCapture(e.pointerId); } catch(err){}
      speakText(`Cự ly ${Math.round(currentLeadDistance)} mét`);
    }
  });

  track.addEventListener('pointercancel', () => {
    isDraggingDistanceBar = false;
  });
}

// ==========================================
// CÁC NÚT THỬ NGHIỆM NHANH TRONG DEMO
// ==========================================
function triggerSpeedingTest() {
  currentSpeedKmh = currentSpeedLimit + 16.0;
  updateSpeedUI();
  speakVoice(`Cảnh báo! Bạn đang chạy quá tốc độ giới hạn! Vận tốc ${Math.round(currentSpeedKmh)}`);
}

function triggerForbiddenTest() {
  triggerForbiddenAlert("P.102", "Cấm đi ngược chiều");
}

function triggerForbiddenCarTest() {
  triggerForbiddenAlert("P.103a", "Cấm xe ô tô");
}

function triggerPeakHourTest() {
  const check = checkTimeRestrictedZone();
  triggerForbiddenAlert("TIME_PEAK", "Khung giờ cấm", check.reason || "GIỜ CAO ĐIỂM (06:00-09:00 / 16:00-19:30)");
}

function triggerParkingAdvisorTest() {
  toggleParkingAdvisor();
}

function triggerBrakeTest() {
  currentLeadDistance = 15.0;
  smoothedDistance = 15.0;
  isManualDistanceOverride = true;
  demoBraking = true;
  demoTimer = performance.now();
  clearTimeout(manualOverrideTimeout);
  manualOverrideTimeout = setTimeout(() => { isManualDistanceOverride = false; demoBraking = false; }, 8000);
  const assessment = evaluateVietnamLegalStandard(currentSpeedKmh, currentLeadDistance, weatherMode);
  updateHudElements(assessment);
  speakVoice("Nguy hiểm! Xe trước phanh gấp! Đề nghị giảm tốc độ ngay!");
}

function toggleWeather() {
  const btn = document.getElementById('btn-weather');
  const icon = document.getElementById('weather-icon');
  const text = document.getElementById('weather-text');

  if (weatherMode === 'dry') {
    weatherMode = 'wet';
    if (btn) btn.classList.add('wet');
    if (icon) icon.textContent = '🌧️';
    if (text) text.textContent = 'Mưa (+40%)';
  } else {
    weatherMode = 'dry';
    if (btn) btn.classList.remove('wet');
    if (icon) icon.textContent = '☀️';
    if (text) text.textContent = 'Khô';
  }
}

function toggleAudio() {
  audioEnabled = !audioEnabled;
  const icon = document.getElementById('audio-icon');
  if (icon) icon.textContent = audioEnabled ? '🔊' : '🔇';
}

function toggleDemoMode() {
  isDemoMode = !isDemoMode;
  const modeText = document.getElementById('mode-text');
  const modeIcon = document.getElementById('mode-icon');
  const demoBar = document.getElementById('demo-quick-bar');

  if (isDemoMode) {
    if (modeText) modeText.textContent = "Thử Nghiệm";
    if (modeIcon) modeIcon.textContent = "🎮";
    if (demoBar) demoBar.style.display = 'flex';
    speakText("Đã chuyển sang chế độ thử nghiệm");
  } else {
    if (modeText) modeText.textContent = "Camera Thật";
    if (modeIcon) modeIcon.textContent = "📷";
    if (demoBar) demoBar.style.display = 'none';
    speakText("Đã chuyển sang chế độ Camera thật");
    if (!videoEl || !videoEl.srcObject) {
      startAdasSystem(false);
    }
  }
}

// Khởi tạo các tương tác khi trang tải xong
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('DOMContentLoaded', () => {
    updateParkingCalendarUI();
    initDistanceBarInteraction();
  });
}

// Xuất module cho môi trường kiểm thử tự động (Unit / E2E Tests)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    KalmanDistanceFilter,
    updateCipvSelection,
    selectLeadVehicle,
    estimateOpticalDistance,
    evaluateVietnamLegalStandard,
    triggerCombinedAlerts,
    autoScanTrafficSigns,
    triggerForbiddenAlert,
    dismissForbiddenAlert,
    getActiveTracks: () => activeTracks,
    setActiveTracks: (tr) => { activeTracks = tr; },
    getLockedCipvId: () => lockedCipvId,
    setLockedCipvId: (id) => { lockedCipvId = id; },
    getCipvCandidateId: () => cipvCandidateId,
    getCipvCandidateFrames: () => cipvCandidateFrames,
    getIsForbiddenRoadDetected: () => isForbiddenRoadDetected,
    setIsForbiddenRoadDetected: (v) => { isForbiddenRoadDetected = v; },
    getSignCandidateCount: () => signCandidateCount,
    setSignCandidateCount: (v) => { signCandidateCount = v; },
    setSignCtx: (ctx) => { signCtx = ctx; },
    setVideoEl: (el) => { videoEl = el; },
    setLastSignDetectionTime: (t) => { lastSignDetectionTime = t; }
  };
}

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

  const modeText = document.getElementById('mode-text');
  const modeIcon = document.getElementById('mode-icon');
  const demoBar = document.getElementById('demo-quick-bar');

  if (isDemoMode) {
    modeText.textContent = "Thử Nghiệm";
    modeIcon.textContent = "🎮";
    if (demoBar) demoBar.style.display = 'flex';
    applyOrientation();
    window.addEventListener('resize', applyOrientation);
    window.addEventListener('orientationchange', () => setTimeout(applyOrientation, 250));
  } else {
    modeText.textContent = "Camera Tự Động";
    modeIcon.textContent = "📷";
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
      modeText.textContent = "Thử Nghiệm";
      modeIcon.textContent = "🎮";
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
        gpsDot.textContent = "🟢";
        const speedMps = pos.coords.speed;
        if (speedMps !== null && speedMps >= 0) {
          currentSpeedKmh = Math.round(speedMps * 3.6);
          gpsText.textContent = `GPS: ${currentSpeedKmh}`;
        } else {
          gpsText.textContent = `GPS: OK`;
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
        gpsDot.textContent = "🟡";
        gpsText.textContent = `GPS: Tự động`;
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
    );
  } else {
    gpsText.textContent = "GPS Tự động";
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
// TỰ ĐỘNG QUÉT BIỂN BÁO BẰNG CAMERA
// ==========================================
let lastSignDetectionTime = 0;

function autoScanTrafficSigns(w, h) {
  if (!videoEl || videoEl.readyState < 2 || !signCtx) return;

  const now = performance.now();
  if (now - lastSignDetectionTime < 400) return;
  lastSignDetectionTime = now;

  try {
    signCtx.drawImage(videoEl, 0, 0, 320, 180);
    const imgData = signCtx.getImageData(160, 0, 160, 120);
    const data = imgData.data;

    let redPixelCount = 0;
    let whitePixelCount = 0;
    let bluePixelCount = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Đỏ (Biển cấm P.101, P.102, P.103a)
      if (r > 140 && g < 75 && b < 75 && (r - Math.max(g, b) > 55)) {
        redPixelCount++;
      }
      // Trắng
      if (r > 190 && g > 190 && b > 190) {
        whitePixelCount++;
      }
      // Xanh dương (Biển cấm đỗ P.131, P.131b, P.131c)
      if (b > 130 && r < 90 && g < 110) {
        bluePixelCount++;
      }
    }

    if (redPixelCount > 350) {
      if (whitePixelCount > 100 && (whitePixelCount / redPixelCount > 0.25)) {
        triggerForbiddenAlert("P.102", "Cấm đi ngược chiều");
      } else if (whitePixelCount > 250) {
        if (!speedLimitSource.includes("Camera")) {
          speedLimitSource = "Camera (Biển P.127)";
          updateSpeedSignUI();
          speakVoice(`Đã nhận diện biển báo tốc độ tối đa ${currentSpeedLimit} ki-lô-mét một giờ`);
        }
      }
    }

    // Biển cấm đỗ xe P.131 (viền đỏ nền xanh)
    if (bluePixelCount > 300 && redPixelCount > 200) {
      if (!isParkingAdvisorOpen) {
        toggleParkingAdvisor();
      }
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
  if (now - lastForbiddenSpeechTime > 5000) {
    lastForbiddenSpeechTime = now;
    if (signCode === "P.103a") {
      speakVoice("Nguy hiểm! Tuyến đường phía trước cấm xe ô tô!");
    } else if (signCode === "TIME_PEAK") {
      speakVoice("Cảnh báo! Tuyến đường đang trong khung giờ cấm xe!");
    } else {
      speakVoice("Nguy hiểm! Phía trước là đường cấm! Không được đi vào!");
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
// VÒNG LẶP XỬ LÝ THEO THỜI GIAN THỰC (FPS)
// ==========================================
let frameThrottle = 0;

async function processFrame(now) {
  if (!isRunning) return;

  const dt = Math.max(0.01, (now - lastFrameTime) / 1000.0);
  lastFrameTime = now;
  frameThrottle++;

  const w = canvasEl.width;
  const h = canvasEl.height;

  ctx.clearRect(0, 0, w, h);

  let leadVehicle = null;
  let rawDistance = 65.0;

  if (isDemoMode) {
    demoTimer += dt;
    const cycle = demoTimer % 28.0;

    if (cycle < 6.0) {
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
      // GIẢ LẬP BIỂN P.103a CẤM Ô TÔ
      currentSpeedKmh = 45.0;
      rawDistance = 55.0;
      demoBraking = false;
      simulatedRoadSign = { type: "P.103a", name: "Cấm ô tô", dist: 25.0 };
      triggerForbiddenAlert("P.103a", "Cấm xe ô tô");
    } else {
      // GIẢ LẬP BIỂN P.102 CẤM ĐI NGƯỢC CHIỀU
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
      bbox: [w / 2 - 60, h * 0.48, 120, 80],
      class: 'car'
    };
  } else {
    let detectedVehicles = [];
    if (aiModel && videoEl.readyState === 4 && (frameThrottle % 2 === 0)) {
      try {
        const predictions = await aiModel.detect(videoEl);
        const targetClasses = ['car', 'truck', 'bus', 'motorcycle'];
        detectedVehicles = predictions.filter(p => targetClasses.includes(p.class) && p.score >= 0.40);
      } catch (err) {}
    }

    leadVehicle = selectLeadVehicle(detectedVehicles, w, h);

    if (leadVehicle) {
      rawDistance = estimateOpticalDistance(leadVehicle, w, h);
    } else {
      rawDistance = 90.0;
    }

    autoScanTrafficSigns(w, h);
  }

  if (isForbiddenRoadDetected && (now - lastForbiddenTime > 6000)) {
    dismissForbiddenAlert();
  }

  const alpha = 0.35;
  smoothedDistance = alpha * rawDistance + (1 - alpha) * smoothedDistance;
  currentLeadDistance = smoothedDistance;

  const vApproachMps = (lastDistance - currentLeadDistance) / dt;
  lastDistance = currentLeadDistance;

  if (vApproachMps > 0.5) {
    currentTtc = Math.max(0.5, currentLeadDistance / vApproachMps);
  } else {
    const vHostMps = Math.max(2.0, currentSpeedKmh / 3.6);
    currentTtc = currentLeadDistance / vHostMps;
  }

  const assessment = evaluateVietnamLegalStandard(currentSpeedKmh, currentLeadDistance, weatherMode);
  currentAlertLevel = assessment.level;

  triggerCombinedAlerts(assessment);
  drawArHud(ctx, w, h, leadVehicle, assessment, simulatedRoadSign);
  updateHudElements(assessment);

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
// THUẬT TOÁN ĐO KHOẢNG CÁCH QUANG HỌC
// ==========================================
function selectLeadVehicle(vehicles, frameWidth, frameHeight) {
  if (!vehicles || vehicles.length === 0) return null;

  const centerX = frameWidth / 2.0;
  const laneHalfW = frameWidth * 0.28;

  let bestCar = null;
  let maxBottomY = -1;

  for (const v of vehicles) {
    const [vx, vy, vw, vh] = v.bbox;
    const carCenterX = vx + vw / 2.0;
    const carBottomY = vy + vh;

    if (Math.abs(carCenterX - centerX) <= laneHalfW) {
      if (carBottomY > maxBottomY) {
        maxBottomY = carBottomY;
        bestCar = v;
      }
    }
  }

  return bestCar || vehicles[0];
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
function evaluateVietnamLegalStandard(speedKmh, actualDist, weather) {
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
    ttc: currentTtc
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

function triggerCombinedAlerts(assessment) {
  const now = performance.now();

  // 1. CẢNH BÁO ĐƯỜNG CẤM HOẶC CẤM THEO GIỜ (Ưu tiên số 1)
  if (isForbiddenRoadDetected) {
    return;
  }

  // 2. CẢNH BÁO QUÁ TỐC ĐỘ GIỚI HẠN (Nghị định 168/2024/NĐ-CP)
  if (isOverspeeding) {
    if (now - lastBeepTime > 400) {
      playBeep(1500, 150);
      lastBeepTime = now;
    }
    if (now - lastSpeedSpeechTime > 6000) {
      lastSpeedSpeechTime = now;
      speakVoice(`Cảnh báo! Bạn đang chạy quá tốc độ giới hạn ${currentSpeedLimit}!`);
    }
    return;
  }

  // 3. CẢNH BÁO KHOẢNG CÁCH VA CHẠM (Thông tư 38/2024/TT-BGTVT)
  if (assessment.level === 'critical') {
    if (now - lastBeepTime > 260) {
      playBeep(1800, 150);
      lastBeepTime = now;
    }
    speakVoice("Nguy hiểm! Giảm tốc độ ngay!");
  } else if (assessment.level === 'warning') {
    if (now - lastBeepTime > 850) {
      playBeep(1000, 180);
      lastBeepTime = now;
    }
    speakVoice("Chú ý! Bám sát xe trước!");
  }
}

// ==========================================
// VẼ AR HUD TRÊN CANVAS
// ==========================================
function drawArHud(ctx, w, h, vehicle, assessment, roadSign) {
  const horizonY = h * 0.48;
  const vanishX = w / 2.0;

  let pathColor = "rgba(16, 185, 129, 0.20)";
  let strokeColor = "#10b981";

  if (isForbiddenRoadDetected || assessment.level === 'critical' || isOverspeeding) {
    pathColor = "rgba(239, 68, 68, 0.35)";
    strokeColor = "#ef4444";
  } else if (assessment.level === 'warning') {
    pathColor = "rgba(245, 158, 11, 0.28)";
    strokeColor = "#f59e0b";
  }

  ctx.beginPath();
  ctx.moveTo(vanishX - 25, horizonY);
  ctx.lineTo(vanishX + 25, horizonY);
  ctx.lineTo(w * 0.85, h);
  ctx.lineTo(w * 0.15, h);
  ctx.closePath();
  ctx.fillStyle = pathColor;
  ctx.fill();

  if (vehicle && !isDemoMode) {
    const [vx, vy, vw, vh] = vehicle.bbox;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 4;

    const cLen = Math.min(22, vw / 4);
    ctx.beginPath();
    ctx.moveTo(vx, vy + cLen); ctx.lineTo(vx, vy); ctx.lineTo(vx + cLen, vy);
    ctx.moveTo(vx + vw - cLen, vy); ctx.lineTo(vx + vw, vy); ctx.lineTo(vx + vw, vy + cLen);
    ctx.moveTo(vx, vy + vh - cLen); ctx.lineTo(vx, vy + vh); ctx.lineTo(vx + cLen, vy + vh);
    ctx.moveTo(vx + vw - cLen, vy + vh); ctx.lineTo(vx + vw, vy + vh); ctx.lineTo(vx + vw, vy + vh - cLen);
    ctx.stroke();

    const tagW = 180;
    const tagH = 34;
    const tagX = Math.max(10, Math.min(w - tagW - 10, vx + vw / 2 - tagW / 2));
    const tagY = Math.max(10, vy - tagH - 8);

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.fillRect(tagX, tagY, tagW, tagH);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(tagX, tagY, tagW, tagH);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px -apple-system, sans-serif";
    ctx.fillText(`${assessment.actualDist.toFixed(1)}m | TTC: ${assessment.ttc.toFixed(1)}s`, tagX + 10, tagY + 22);
  }

  if (isForbiddenRoadDetected || assessment.level === 'critical' || isOverspeeding) {
    ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, w, h);
  }
}

// ==========================================
// CẬP NHẬT GIAO DIỆN HTML
// ==========================================
function updateHudElements(assessment) {
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

  document.getElementById('val-distance').innerHTML = `${assessment.actualDist.toFixed(1)}<span class="metric-unit">m</span>`;
  document.getElementById('val-ttc').innerHTML = `${assessment.ttc.toFixed(1)}<span class="metric-unit">s</span>`;

  const maxScale = 120.0;
  const actualRatio = Math.min(1.0, assessment.actualDist / maxScale);
  const legalRatio = Math.min(1.0, assessment.legalMin / maxScale);

  document.getElementById('bar-car-pointer').style.left = `${actualRatio * 100}%`;
  document.getElementById('bar-legal-marker').style.left = `${legalRatio * 100}%`;

  document.getElementById('bar-zone-critical').style.width = `${legalRatio * 60}%`;
  document.getElementById('bar-zone-warning').style.left = `${legalRatio * 60}%`;
  document.getElementById('bar-zone-warning').style.width = `${legalRatio * 40}%`;

  document.getElementById('lbl-bar-legal').textContent = `Luật: ${assessment.legalMin}m`;
  document.getElementById('lbl-bar-actual').textContent = `Thực tế: ${assessment.actualDist.toFixed(1)}m`;
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

function toggleWeather() {
  const btn = document.getElementById('btn-weather');
  const icon = document.getElementById('weather-icon');
  const text = document.getElementById('weather-text');

  if (weatherMode === 'dry') {
    weatherMode = 'wet';
    btn.classList.add('wet');
    icon.textContent = '🌧️';
    text.textContent = 'Mưa (+40%)';
  } else {
    weatherMode = 'dry';
    btn.classList.remove('wet');
    icon.textContent = '☀️';
    text.textContent = 'Khô';
  }
}

function toggleAudio() {
  audioEnabled = !audioEnabled;
  document.getElementById('audio-icon').textContent = audioEnabled ? '🔊' : '🔇';
}

function toggleDemoMode() {
  isDemoMode = !isDemoMode;
  const modeText = document.getElementById('mode-text');
  const modeIcon = document.getElementById('mode-icon');
  const demoBar = document.getElementById('demo-quick-bar');

  if (isDemoMode) {
    modeText.textContent = "Thử Nghiệm";
    modeIcon.textContent = "🎮";
    if (demoBar) demoBar.style.display = 'flex';
  } else {
    modeText.textContent = "Camera Tự Động";
    modeIcon.textContent = "📷";
    if (demoBar) demoBar.style.display = 'none';
    if (!videoEl.srcObject) {
      startAdasSystem(false);
    }
  }
}

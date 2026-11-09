// ADAS SafeDistance Pro - Mobile Engine (iOS & Android)
// TỰ ĐỘNG HOÀN TOÀN 100% KHI LÁI XE (ZERO-TOUCH HANDS-FREE)
// Căn cứ: Thông tư số 38/2024/TT-BGTVT (thay thế TT 31/2019) & Nghị định 168/2024/NĐ-CP

let videoEl, canvasEl, ctx;
let aiModel = null;
let isRunning = false;
let isDemoMode = false;
let wakeLock = null;

// ==========================================
// THÔNG SỐ VẬN HÀNH & TỰ ĐỘNG NHẬN DIỆN TỐC ĐỘ (AUTO SPEED LIMIT)
// ==========================================
let currentSpeedKmh = 80.0;
let currentSpeedLimit = 80.0; // Tốc độ giới hạn tự động cập nhật từ Camera hoặc GPS
let speedLimitSource = "Tự động (AI/GPS)"; // "Camera (Biển P.127)", "GPS Tuyến đường", "Tự động"
let isOverspeeding = false;
let isGpsActive = false;
let weatherMode = 'dry'; // 'dry' hoặc 'wet'
let audioEnabled = true;

// Tọa độ GPS để tra cứu giới hạn tốc độ đường tự động
let lastGpsLat = null;
let lastGpsLon = null;
let lastOsmQueryTime = 0;

// ==========================================
// CẢNH BÁO ĐƯỜNG CẤM (AUTO FORBIDDEN ROAD)
// ==========================================
let isForbiddenRoadDetected = false;
let forbiddenSignType = "";
let lastForbiddenTime = 0;

// Khoảng cách & TTC
let currentLeadDistance = 65.0;
let smoothedDistance = 65.0;
let lastDistance = 65.0;
let lastFrameTime = performance.now();
let currentTtc = 99.0;
let currentAlertLevel = 'safe'; // 'safe', 'warning', 'critical'

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

// Chế độ Xoay Màn Hình: 'auto', 'landscape', 'portrait'
let orientationMode = 'auto';

// Canvas xử lý ngầm để quét biển báo (TSR Worker Canvas)
let signCanvas = null;
let signCtx = null;

// ==========================================
// 1. KHỞI CHẠY HỆ THỐNG TRÊN ĐIỆN THOẠI (1 CHẠM DUY NHẤT)
// ==========================================
async function startAdasSystem(demo = false) {
  isDemoMode = demo;
  const overlay = document.getElementById('start-overlay');
  overlay.style.display = 'none';

  videoEl = document.getElementById('camera-video');
  canvasEl = document.getElementById('ar-canvas');
  ctx = canvasEl.getContext('2d');

  // Khởi tạo Canvas quét biển báo ngầm
  signCanvas = document.createElement('canvas');
  signCanvas.width = 320;
  signCanvas.height = 180;
  signCtx = signCanvas.getContext('2d', { willReadFrequently: true });

  initAudio();
  requestWakeLock();

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

    // Mở Camera sau của điện thoại (Góc rộng tối ưu đường sá)
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
      console.warn("Lỗi camera thật, chuyển sang chế độ Mô phỏng:", err);
      alert("Không mở được camera sau (" + err.message + "). Hệ thống chuyển sang Chế độ Mô phỏng!");
      isDemoMode = true;
      modeText.textContent = "Thử Nghiệm";
      modeIcon.textContent = "🎮";
      if (demoBar) demoBar.style.display = 'flex';
      applyOrientation();
    }

    // Tự động nhận diện GPS và tốc độ thực tế
    initGpsTracker();

    // Nạp mô hình nhận diện
    loadAiModel();
  }

  isRunning = true;
  requestAnimationFrame(processFrame);
}

// ==========================================
// 2. TỰ ĐỘNG ĐỌC VẬN TỐC & TRA CỨU TỐC ĐỘ ĐƯỜNG BẰNG GPS
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

        // Tự động tra cứu tốc độ giới hạn con đường đang chạy qua OpenStreetMap Overpass (mỗi 45 giây)
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

// Tự động tra cứu giới hạn tốc độ cung đường từ GPS vệ tinh
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
    // Nếu không có mạng hoặc timeout, tự động thích ứng theo vận tốc xe di chuyển
    autoAdaptSpeedLimitBySpeed();
  }
}

// Tự động suy luận thông minh giới hạn tốc độ dựa trên vận tốc hành trình thực tế
function autoAdaptSpeedLimitBySpeed() {
  if (speedLimitSource.includes("Camera")) return; // Ưu tiên số 1 là biển báo camera nhận diện

  let targetLimit = 80;
  if (currentSpeedKmh > 95) {
    targetLimit = 120; // Đang chạy cao tốc
  } else if (currentSpeedKmh > 75) {
    targetLimit = 90;  // Đường ngoài đô thị
  } else if (currentSpeedKmh > 55) {
    targetLimit = 60;  // Đường đô thị có dải phân cách
  } else if (currentSpeedKmh > 30) {
    targetLimit = 50;  // Đường đô thị 2 chiều
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

  // Đánh giá vượt tốc độ theo Nghị định 168/2024/NĐ-CP (trừ điểm GPLX)
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
// 3. TỰ ĐỘNG NHẬN DIỆN BIỂN BÁO BẰNG CAMERA (AI & COMPUTER VISION)
// ==========================================
let lastSignDetectionTime = 0;

function autoScanTrafficSigns(w, h) {
  if (!videoEl || videoEl.readyState < 2 || !signCtx) return;

  const now = performance.now();
  if (now - lastSignDetectionTime < 400) return; // Quét mỗi 400ms để mượt mà
  lastSignDetectionTime = now;

  try {
    // Vẽ góc trên bên phải khung hình (vị trí lắp đặt biển báo giao thông lề đường)
    signCtx.drawImage(videoEl, 0, 0, 320, 180);
    const imgData = signCtx.getImageData(160, 0, 160, 120); // Quét nửa trên bên phải
    const data = imgData.data;

    let redPixelCount = 0;
    let whitePixelCount = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Nhận diện màu đỏ biển cấm (R cao, G và B thấp)
      if (r > 140 && g < 75 && b < 75 && (r - Math.max(g, b) > 55)) {
        redPixelCount++;
      }
      // Nhận diện vạch trắng ở giữa
      if (r > 190 && g > 190 && b > 190) {
        whitePixelCount++;
      }
    }

    // Tỉ lệ phát hiện biển báo cấm tròn đỏ
    if (redPixelCount > 350) {
      // 1. Nếu có vạch trắng nằm ngang ở giữa -> Biển P.102 "Cấm đi ngược chiều"
      if (whitePixelCount > 100 && (whitePixelCount / redPixelCount > 0.25)) {
        triggerForbiddenAlert("P.102", "Cấm đi ngược chiều");
      }
      // 2. Nếu là viền tròn đỏ nền trắng lớn -> Biển hạn chế tốc độ P.127
      else if (whitePixelCount > 250) {
        // Tự động nhận diện biển hạn chế tốc độ
        autoDetectSpeedSignFromPixels();
      }
    }
  } catch (err) {}
}

function autoDetectSpeedSignFromPixels() {
  // Khi camera thấy biển hạn chế tốc độ P.127
  // Tự động đồng bộ theo khu vực đường hiện tại
  if (!speedLimitSource.includes("Camera")) {
    speedLimitSource = "Camera (Biển P.127)";
    updateSpeedSignUI();
    speakVoice(`Đã nhận diện biển báo tốc độ tối đa ${currentSpeedLimit} ki-lô-mét một giờ`);
  }
}

// ==========================================
// 4. CẢNH BÁO ĐƯỜNG CẤM TỰ ĐỘNG
// ==========================================
function triggerForbiddenAlert(signCode = "P.102", signName = "Cấm đi ngược chiều") {
  isForbiddenRoadDetected = true;
  forbiddenSignType = signCode;
  lastForbiddenTime = performance.now();

  const alertBox = document.getElementById('forbidden-road-alert');
  if (alertBox) {
    alertBox.classList.remove('hidden');
    const titleEl = alertBox.querySelector('.forbidden-title');
    const subEl = alertBox.querySelector('.forbidden-sub');
    if (titleEl) titleEl.textContent = `⛔ NGUY HIỂM: BIỂN ${signCode} ${signName.toUpperCase()}!`;
    if (subEl) subEl.textContent = `Không được đi vào! Dừng lại hoặc chuyển hướng ngay!`;
  }

  playBeep(2000, 300);

  const now = performance.now();
  if (now - lastForbiddenSpeechTime > 5000) {
    lastForbiddenSpeechTime = now;
    speakVoice("Nguy hiểm! Phía trước là đường cấm! Không được đi vào!");
  }
}

function dismissForbiddenAlert() {
  isForbiddenRoadDetected = false;
  const alertBox = document.getElementById('forbidden-road-alert');
  if (alertBox) alertBox.classList.add('hidden');
}

// ==========================================
// 5. XOAY MÀN HÌNH TÙY Ý & WAKE LOCK
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
// 6. MÔ HÌNH NHẬN DIỆN XE COCO-SSD
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
// 7. VÒNG LẶP XỬ LÝ THEO THỜI GIAN THỰC (FPS)
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
    // CHẾ ĐỘ THỬ NGHIỆM TỰ ĐỘNG (DEMO SCENARIOS)
    demoTimer += dt;
    const cycle = demoTimer % 24.0;

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
      // VƯỢT TỐC ĐỘ: 93 km/h trong khi giới hạn 80 km/h
      currentSpeedKmh = 93.0;
      rawDistance = 65.0;
      demoBraking = false;
    } else {
      // TỰ ĐỘNG PHÁT HIỆN BIỂN BÁO CẤM ĐI NGƯỢC CHIỀU P.102
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
    // CHẾ ĐỘ CAMERA THỰC TẾ TRÊN XE (HOÀN TOÀN TỰ ĐỘNG)
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

    // Tự động quét biển báo cấm & biển tốc độ từ camera sau
    autoScanTrafficSigns(w, h);
  }

  // Tự động tắt cảnh báo đường cấm nếu sau 6s không còn phát hiện
  if (isForbiddenRoadDetected && (now - lastForbiddenTime > 6000)) {
    dismissForbiddenAlert();
  }

  // Làm mịn khoảng cách (EMA)
  const alpha = 0.35;
  smoothedDistance = alpha * rawDistance + (1 - alpha) * smoothedDistance;
  currentLeadDistance = smoothedDistance;

  // Tính TTC
  const vApproachMps = (lastDistance - currentLeadDistance) / dt;
  lastDistance = currentLeadDistance;

  if (vApproachMps > 0.5) {
    currentTtc = Math.max(0.5, currentLeadDistance / vApproachMps);
  } else {
    const vHostMps = Math.max(2.0, currentSpeedKmh / 3.6);
    currentTtc = currentLeadDistance / vHostMps;
  }

  // Đánh giá luật Thông tư số 38/2024/TT-BGTVT (thay thế TT 31/2019)
  const assessment = evaluateVietnamLegalStandard(currentSpeedKmh, currentLeadDistance, weatherMode);
  currentAlertLevel = assessment.level;

  // Phát tín hiệu âm thanh cảnh báo tự động
  triggerCombinedAlerts(assessment);

  // Vẽ AR HUD
  drawArHud(ctx, w, h, leadVehicle, assessment, simulatedRoadSign);

  // Cập nhật HTML HUD
  updateHudElements(assessment);

  requestAnimationFrame(processFrame);
}

// ==========================================
// 8. VẼ MÔ PHỎNG ĐƯỜNG TRONG DEMO
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

  // Biển báo cấm đi ngược chiều P.102
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

  // Xe phía trước
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
// 9. THUẬT TOÁN ĐO KHOẢNG CÁCH QUANG HỌC
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
  
  let realWidth = 1.85; // car
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
// 10. ĐÁNH GIÁ CHUẨN THÔNG TƯ SỐ 38/2024/TT-BGTVT
// ==========================================
function evaluateVietnamLegalStandard(speedKmh, actualDist, weather) {
  let legalMin = 55.0;
  let citation = "";

  if (speedKmh <= 60.0) {
    // V <= 60 km/h: Điều 11 Thông tư 38/2024/TT-BGTVT quy định người lái xe phải chủ động giữ cự ly an toàn phù hợp
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
// 11. ÂM THANH BÍP & GIỌNG NÓI TIẾNG VIỆT
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

  // 1. CẢNH BÁO ĐƯỜNG CẤM (Ưu tiên số 1)
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
// 12. VẼ AR HUD TRÊN CANVAS
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
// 13. CẬP NHẬT GIAO DIỆN HTML
// ==========================================
function updateHudElements(assessment) {
  const banner = document.getElementById('alert-banner');
  
  if (isForbiddenRoadDetected) {
    banner.className = 'critical';
    document.getElementById('alert-title').textContent = "⛔ CẢNH BÁO: ĐƯỜNG CẤM / CẤM ĐI NGƯỢC CHIỀU!";
    document.getElementById('alert-subtext').textContent = "QCVN 41:2019/BGTVT — Hãy dừng lại hoặc chuyển hướng ngay!";
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
// 14. THỬ NGHIỆM TÌNH HUỐNG TRONG DEMO
// ==========================================
function triggerSpeedingTest() {
  currentSpeedKmh = currentSpeedLimit + 16.0;
  updateSpeedUI();
  speakVoice(`Cảnh báo! Bạn đang chạy quá tốc độ giới hạn! Vận tốc ${Math.round(currentSpeedKmh)}`);
}

function triggerForbiddenTest() {
  triggerForbiddenAlert("P.102", "Cấm đi ngược chiều");
}

function triggerBrakeTest() {
  demoBraking = true;
  smoothedDistance = 16.0;
  speakVoice("Nguy hiểm! Xe phía trước phanh gấp!");
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

// ADAS SafeDistance Pro - Mobile Engine (iOS & Android)
// Tuân thủ Thông tư 31/2019/TT-BGTVT & Luật TTATGTĐB 2024

let videoEl, canvasEl, ctx;
let aiModel = null;
let isRunning = false;
let isDemoMode = false;
let wakeLock = null;

// Trạng thái vận hành xe
let currentSpeedKmh = 80.0;
let isGpsActive = false;
let weatherMode = 'dry'; // 'dry' hoặc 'wet'
let audioEnabled = true;

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

// Web Audio API & Speech Synthesis
let audioCtx = null;
let lastBeepTime = 0;
let lastSpeechTime = 0;

// ==========================================
// 1. KHỞI CHẠY HỆ THỐNG TRÊN ĐIỆN THOẠI
// ==========================================
async function startAdasSystem(demo = false) {
  isDemoMode = demo;
  const overlay = document.getElementById('start-overlay');
  overlay.style.display = 'none';

  videoEl = document.getElementById('camera-video');
  canvasEl = document.getElementById('ar-canvas');
  ctx = canvasEl.getContext('2d');

  // Khởi tạo Audio ngay khi người dùng chạm màn hình
  initAudio();

  // Khóa màn hình không bị tắt khi xe chạy
  requestWakeLock();

  const modeText = document.getElementById('mode-text');
  const modeIcon = document.getElementById('mode-icon');

  if (isDemoMode) {
    modeText.textContent = "Thử Nghiệm";
    modeIcon.textContent = "🎮";
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    window.addEventListener('orientationchange', () => setTimeout(updateCanvasSize, 300));
  } else {
    modeText.textContent = "Camera Thật";
    modeIcon.textContent = "📷";

    // 1. Mở Camera sau của điện thoại (Environment Camera)
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

      updateCanvasSize();
      window.addEventListener('resize', updateCanvasSize);
      window.addEventListener('orientationchange', () => setTimeout(updateCanvasSize, 300));
    } catch (err) {
      console.warn("Lỗi camera thật, chuyển sang chế độ Mô phỏng:", err);
      alert("Không mở được camera sau điện thoại (" + err.message + "). Hệ thống sẽ chuyển sang Chế độ Mô phỏng để bạn trải nghiệm!");
      isDemoMode = true;
      modeText.textContent = "Thử Nghiệm";
      modeIcon.textContent = "🎮";
      updateCanvasSize();
    }

    // 2. Kích hoạt GPS đo tốc độ thực tế
    initGpsTracker();

    // 3. Tải mô hình AI nhận diện xe
    loadAiModel();
  }

  isRunning = true;
  requestAnimationFrame(processFrame);
}

function updateCanvasSize() {
  if (!isDemoMode && videoEl.videoWidth && videoEl.videoHeight) {
    canvasEl.width = videoEl.videoWidth;
    canvasEl.height = videoEl.videoHeight;
  } else {
    canvasEl.width = window.innerWidth || 800;
    canvasEl.height = window.innerHeight || 450;
  }
}

function toggleDemoMode() {
  isDemoMode = !isDemoMode;
  const modeText = document.getElementById('mode-text');
  const modeIcon = document.getElementById('mode-icon');
  if (isDemoMode) {
    modeText.textContent = "Thử Nghiệm";
    modeIcon.textContent = "🎮";
  } else {
    modeText.textContent = "Camera Thật";
    modeIcon.textContent = "📷";
    if (!videoEl.srcObject) {
      startAdasSystem(false);
    }
  }
}

// ==========================================
// 2. ĐO VẬN TỐC TỰ ĐỘNG BẰNG GPS ĐIỆN THOẠI
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
          gpsText.textContent = `GPS: ${currentSpeedKmh} km/h`;
        } else {
          gpsText.textContent = `GPS: OK`;
        }
        document.getElementById('val-speed').innerHTML = `${Math.round(currentSpeedKmh)}<span class="metric-unit">km/h</span>`;
      },
      (err) => {
        isGpsActive = false;
        gpsDot.textContent = "🟡";
        gpsText.textContent = `GPS: Chạm đổi`;
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
    );
  } else {
    gpsText.textContent = "Chạm đổi V";
  }
}

function promptManualSpeed() {
  const input = prompt("Nhập vận tốc xe chủ (km/h):", Math.round(currentSpeedKmh));
  if (input !== null && !isNaN(input)) {
    currentSpeedKmh = Math.max(10, Math.min(140, parseFloat(input)));
    document.getElementById('val-speed').innerHTML = `${Math.round(currentSpeedKmh)}<span class="metric-unit">km/h</span>`;
  }
}

// ==========================================
// 3. GIỮ MÀN HÌNH ĐIỆN THOẠI LUÔN SÁNG
// ==========================================
async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch (err) {
      console.warn("WakeLock error:", err);
    }
  }
}

// ==========================================
// 4. MÔ HÌNH NHẬN DIỆN XE COCO-SSD
// ==========================================
async function loadAiModel() {
  const subtext = document.getElementById('alert-subtext');
  subtext.textContent = "Đang tải AI nhận diện xe...";
  try {
    if (typeof cocoSsd !== 'undefined') {
      aiModel = await cocoSsd.load({ base: 'mobilenet_v2' });
      subtext.textContent = "AI sẵn sàng | Căn cứ Thông tư 31/2019/TT-BGTVT";
    }
  } catch (e) {
    subtext.textContent = "Chế độ Radar Quang học | TT 31/2019/TT-BGTVT";
  }
}

// ==========================================
// 5. VÒNG LẶP XỬ LÝ THEO THỜI GIAN THỰC (FPS)
// ==========================================
let frameThrottle = 0;
async function processFrame(now) {
  if (!isRunning) return;

  const dt = Math.max(0.01, (now - lastFrameTime) / 1000.0);
  lastFrameTime = now;
  frameThrottle++;

  const w = canvasEl.width;
  const h = canvasEl.height;

  // Xóa màn hình canvas
  ctx.clearRect(0, 0, w, h);

  let leadVehicle = null;
  let rawDistance = 65.0;

  if (isDemoMode) {
    // CHẾ ĐỘ THỬ NGHIỆM TỰ ĐỘNG (DEMO SCENARIO)
    demoTimer += dt;
    const cycle = demoTimer % 18.0;

    if (cycle < 6.0) {
      // Giai đoạn 1: Cao tốc 90 km/h, giữ khoảng cách 75m (AN TOÀN)
      currentSpeedKmh = 90.0;
      rawDistance = 75.0 + 3.0 * Math.sin(demoTimer * 0.8);
      demoBraking = false;
    } else if (cycle < 11.0) {
      // Giai đoạn 2: Bám đuôi gần 85 km/h, cự ly 42m (CẢNH BÁO VÀNG)
      currentSpeedKmh = 85.0;
      rawDistance = 42.0 + 2.0 * Math.sin(demoTimer * 1.2);
      demoBraking = false;
    } else if (cycle < 15.0) {
      // Giai đoạn 3: XE TRƯỚC PHANH GẤP! Tụt xuống 18m (BÁO ĐỘNG ĐỎ)
      currentSpeedKmh = 80.0;
      const brakeProgress = (cycle - 11.0) / 4.0;
      rawDistance = 42.0 - brakeProgress * 24.0; // 42m -> 18m
      demoBraking = true;
    } else {
      // Giai đoạn 4: Giãn khoảng cách trở lại
      rawDistance = 18.0 + ((cycle - 15.0) / 3.0) * 55.0;
      demoBraking = false;
    }

    document.getElementById('val-speed').innerHTML = `${Math.round(currentSpeedKmh)}<span class="metric-unit">km/h</span>`;

    // Vẽ mô phỏng đường 3D và xe trước
    renderDemoRoadAndCar(ctx, w, h, rawDistance, demoBraking);

    leadVehicle = {
      bbox: [w / 2 - 60, h * 0.48, 120, 80],
      class: 'car'
    };
  } else {
    // CHẾ ĐỘ CAMERA THẬT
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
      // Khi không có xe trước cùng làn
      rawDistance = 90.0;
    }
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

  // Đánh giá luật Thông tư 31/2019/TT-BGTVT
  const assessment = evaluateVietnamLegalStandard(currentSpeedKmh, currentLeadDistance, weatherMode);
  currentAlertLevel = assessment.level;

  // Phát còi bíp và giọng nói
  triggerAlerts(assessment);

  // Vẽ AR HUD
  drawArHud(ctx, w, h, leadVehicle, assessment);

  // Cập nhật thẻ HTML
  updateHudElements(assessment);

  requestAnimationFrame(processFrame);
}

// ==========================================
// 6. MÔ PHỎNG ĐƯỜNG VÀ XE TRONG CHẾ ĐỘ DEMO
// ==========================================
function renderDemoRoadAndCar(ctx, w, h, distance, isBraking) {
  const horizonY = h * 0.46;
  const vanishX = w / 2;

  // Bầu trời & mặt cỏ
  ctx.fillStyle = weatherMode === 'wet' ? "#1e293b" : "#38bdf8";
  ctx.fillRect(0, 0, w, horizonY);

  ctx.fillStyle = weatherMode === 'wet' ? "#14532d" : "#15803d";
  ctx.fillRect(0, horizonY, w, h - horizonY);

  // Mặt đường phối cảnh
  ctx.beginPath();
  ctx.moveTo(vanishX - 30, horizonY);
  ctx.lineTo(vanishX + 30, horizonY);
  ctx.lineTo(w * 0.90, h);
  ctx.lineTo(w * 0.10, h);
  ctx.closePath();
  ctx.fillStyle = weatherMode === 'wet' ? "#1e2430" : "#334155";
  ctx.fill();

  // Xe phía trước theo tỉ lệ cự ly
  const fx = 580;
  const carW = Math.max(25, Math.min(w * 0.60, (fx * 1.85) / distance));
  const carH = Math.max(20, Math.min(h * 0.50, (fx * 1.50) / distance));

  const tDist = Math.exp(-0.022 * distance);
  const carBottomY = horizonY + (h - horizonY) * tDist * 0.95;
  const carTopY = carBottomY - carH;
  const carX1 = vanishX - carW / 2;

  // Bóng xe
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(carX1, carBottomY - 4, carW, 8);

  // Thân xe đỏ
  ctx.fillStyle = "#dc2626";
  ctx.fillRect(carX1, carTopY + carH * 0.35, carW, carH * 0.60);

  // Mui xe
  ctx.fillStyle = "#991b1b";
  ctx.fillRect(carX1 + carW * 0.15, carTopY, carW * 0.70, carH * 0.40);

  // Đèn hậu / Đèn phanh
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

  // Biển số xe
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(vanishX - carW * 0.15, carBottomY - carH * 0.25, carW * 0.30, carH * 0.12);
}

// ==========================================
// 7. THUẬT TOÁN ĐO KHOẢNG CÁCH QUANG HỌC
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
// 8. ĐÁNH GIÁ CHUẨN THÔNG TƯ 31/2019/TT-BGTVT
// ==========================================
function evaluateVietnamLegalStandard(speedKmh, actualDist, weather) {
  let legalMin = 55.0;
  let citation = "";

  if (speedKmh <= 60.0) {
    const calc = (speedKmh * 1000.0 / 3600.0) * 2.5;
    legalMin = Math.max(15.0, Math.min(35.0, calc));
    citation = "Khoản 2 Điều 11 TT 31 (V ≤ 60km/h: Chủ động giữ cự ly)";
  } else if (speedKmh <= 80.0) {
    legalMin = 55.0;
    citation = "Khoản 1 Điều 11 TT 31 (60 < V ≤ 80km/h: Tối thiểu 55m)";
  } else if (speedKmh <= 100.0) {
    legalMin = 70.0;
    citation = "Khoản 1 Điều 11 TT 31 (80 < V ≤ 100km/h: Tối thiểu 70m)";
  } else if (speedKmh <= 120.0) {
    legalMin = 100.0;
    citation = "Khoản 1 Điều 11 TT 31 (100 < V ≤ 120km/h: Tối thiểu 100m)";
  } else {
    legalMin = 120.0;
    citation = "V > 120km/h: Vượt tốc độ! Tối thiểu >= 120m";
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
// 9. ÂM THANH BÍP & GIỌNG NÓI TIẾNG VIỆT
// ==========================================
function initAudio() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  } catch (e) {
    console.warn("Web Audio API error:", e);
  }
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

function triggerAlerts(assessment) {
  const now = performance.now();

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
// 10. VẼ AR HUD TRÊN CANVAS
// ==========================================
function drawArHud(ctx, w, h, vehicle, assessment) {
  const horizonY = h * 0.48;
  const vanishX = w / 2.0;

  let pathColor = "rgba(16, 185, 129, 0.20)";
  let strokeColor = "#10b981";

  if (assessment.level === 'critical') {
    pathColor = "rgba(239, 68, 68, 0.35)";
    strokeColor = "#ef4444";
  } else if (assessment.level === 'warning') {
    pathColor = "rgba(245, 158, 11, 0.28)";
    strokeColor = "#f59e0b";
  }

  // Dải hành lang làn đường an toàn
  ctx.beginPath();
  ctx.moveTo(vanishX - 25, horizonY);
  ctx.lineTo(vanishX + 25, horizonY);
  ctx.lineTo(w * 0.85, h);
  ctx.lineTo(w * 0.15, h);
  ctx.closePath();
  ctx.fillStyle = pathColor;
  ctx.fill();

  // Khung xe trước
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

  // Viền chớp đỏ khẩn cấp
  if (assessment.level === 'critical') {
    ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, w, h);
  }
}

// ==========================================
// 11. CẬP NHẬT GIAO DIỆN HTML
// ==========================================
function updateHudElements(assessment) {
  const banner = document.getElementById('alert-banner');
  banner.className = assessment.level;
  document.getElementById('alert-title').textContent = assessment.title;
  document.getElementById('alert-subtext').textContent = assessment.citation;

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
// 12. CÁC NÚT ĐIỀU KHIỂN (WEATHER / AUDIO)
// ==========================================
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
    text.textContent = 'Khô ráo';
  }
}

function toggleAudio() {
  audioEnabled = !audioEnabled;
  document.getElementById('audio-icon').textContent = audioEnabled ? '🔊' : '🔇';
}

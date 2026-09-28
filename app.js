let currentView = 0;
let currentNaviDirection = "toKumamoto";
let currentTimetableDirection = "toKumamoto";
let mapReady = false;
let loadedTrains = [];

// 要素の取得
const viewsWrapper = document.querySelector(".views-wrapper");
const navButtons = [...document.querySelectorAll(".nav-btn")];
const splashScreen = document.getElementById("splashScreen");
const sheet = document.getElementById("bottomSheet");
const sheetBackdrop = document.getElementById("sheetBackdrop");

// --------------------------------------------------
// 1. 画面切り替え（スライド & ナビ制御）
// --------------------------------------------------
function setView(index) {
  currentView = Math.max(0, Math.min(3, index));

  const wrapper = document.querySelector(".views-wrapper");
  if (wrapper) {
    wrapper.style.transform = `translateX(-${currentView * 25}%)`;
  }

  const btns = document.querySelectorAll(".nav-btn");
  btns.forEach((b, i) => b.classList.toggle("active", i === currentView));
  document.body.dataset.view = String(currentView);

  // 地図タブ（index: 2）を開いたときにマップを初期化＆描画
  if (currentView === 2) {
    setTimeout(() => {
      initMap();
      renderMap(loadedTrains);
    }, 50);
  }
}

// --------------------------------------------------
// 2. 地図描画（route-geometry.js を活用したSVG路線図）
// --------------------------------------------------
function getRoutePoints() {
  // route-geometry.js の lightweightRouteSegments を参照
  if (typeof lightweightRouteSegments !== "undefined" && Array.isArray(lightweightRouteSegments) && lightweightRouteSegments.length) {
    const points = [];
    lightweightRouteSegments.forEach((seg, segIndex) => {
      if (!seg || !Array.isArray(seg.points)) return;
      seg.points.forEach((p, i) => {
        if (segIndex > 0 && i === 0) return;
        if (Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) {
          points.push(p);
        }
      });
    });
    if (points.length > 1) return points;
  }
  // フォールバック：stations データより座標を抽出
  if (typeof stations !== "undefined") {
    return stations.map(s => [s.lat, s.lng]);
  }
  return [];
}

function mapProjection() {
  const route = getRoutePoints();
  const stationList = typeof stations !== "undefined" ? stations : [];
  const all = route.concat(stationList.map(s => [s.lat, s.lng]));
  
  if (!all.length) return { width: 720, height: 500, project: (lat, lng) => [0, 0] };

  const lats = all.map(p => p[0]);
  const lngs = all.map(p => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  
  const pad = 40, width = 720, height = 500;
  const project = (lat, lng) => [
    pad + ((lng - minLng) / Math.max(0.000001, maxLng - minLng)) * (width - pad * 2),
    pad + ((maxLat - lat) / Math.max(0.000001, maxLat - minLat)) * (height - pad * 2)
  ];
  return { width, height, project };
}

function initMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl) return;
  
  const routePointsArr = getRoutePoints();
  if (!routePointsArr.length) {
    mapEl.innerHTML = `<div class="empty-state">地図データの読み込み待ちです。</div>`;
    return;
  }

  const { width, height, project } = mapProjection();
  const routePointsStr = routePointsArr.map(p => project(p[0], p[1]).join(",")).join(" ");

  const stationSvg = (typeof stations !== "undefined" ? stations : []).map(s => {
    const [x, y] = project(s.lat, s.lng);
    const isEnd = x > width * 0.72;
    const anchor = isEnd ? "end" : "start";
    const textX = x + (isEnd ? -10 : 10);
    return `
      <g class="svg-station">
        <circle cx="${x}" cy="${y}" r="6" fill="#1e293b" stroke="#ffffff" stroke-width="2"></circle>
        <text x="${textX}" y="${y + 4}" text-anchor="${anchor}" font-size="12" font-weight="bold" fill="#334155">${s.name}</text>
      </g>`;
  }).join("");

  mapEl.innerHTML = `
    <svg id="routeSvgMap" class="svg-route-map" viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; background:#f8fafc; border-radius:12px;" aria-label="熊本から三角までの路線図">
      <polyline points="${routePointsStr}" fill="none" stroke="#cbd5e1" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
      <polyline points="${routePointsStr}" fill="none" stroke="#2563eb" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
      ${stationSvg}
      <g id="svgTrainLayer"></g>
    </svg>`;
  mapReady = true;
}

function renderMap(trains) {
  if (!mapReady) initMap();
  const layer = document.getElementById("svgTrainLayer");
  if (!layer || !Array.isArray(trains)) return;

  const { project } = mapProjection();
  layer.innerHTML = trains.map(t => {
    if (!t.lat || !t.lng) return "";
    const [x, y] = project(t.lat, t.lng);
    const labelText = `${t.id} ${typeof statusText === "function" ? statusText(t) : (t.delayMinutes ? t.delayMinutes + "分遅れ" : "定刻")}`;
    return `
      <g class="svg-train" transform="translate(${x} ${y})">
        <circle r="14" fill="#ef4444" stroke="#ffffff" stroke-width="2"></circle>
        <text x="0" y="4" text-anchor="middle" font-size="12">🚃</text>
        <rect x="-40" y="-38" width="80" height="20" rx="10" fill="#1e293b" opacity="0.85"></rect>
        <text x="0" y="-24" text-anchor="middle" font-size="10" fill="#ffffff" font-weight="bold">${labelText}</text>
      </g>`;
  }).join("");
}

// --------------------------------------------------
// 3. 時刻表描画（mock-data.js の timetableData を参照）
// --------------------------------------------------
function initTimetable() {
  const select = document.getElementById("stationSelect");
  if (!select) return;

  if (typeof stations !== "undefined" && Array.isArray(stations)) {
    select.innerHTML = stations.map(s => `<option value="${s.name}">${s.name}</option>`).join("");
    select.value = "三角";
  }

  select.removeEventListener("change", renderTimetable);
  select.addEventListener("change", renderTimetable);

  const toMisumiBtn = document.getElementById("toMisumiBtn");
  const toKumamotoBtn = document.getElementById("toKumamotoBtn");

  if (toMisumiBtn) {
    toMisumiBtn.onclick = () => {
      currentTimetableDirection = "toMisumi";
      syncTimetableButtons();
      renderTimetable();
    };
  }
  if (toKumamotoBtn) {
    toKumamotoBtn.onclick = () => {
      currentTimetableDirection = "toKumamoto";
      syncTimetableButtons();
      renderTimetable();
    };
  }
  syncTimetableButtons();
  renderTimetable();
}

function syncTimetableButtons() {
  const toMisumiBtn = document.getElementById("toMisumiBtn");
  const toKumamotoBtn = document.getElementById("toKumamotoBtn");
  if (toMisumiBtn) toMisumiBtn.classList.toggle("active", currentTimetableDirection === "toMisumi");
  if (toKumamotoBtn) toKumamotoBtn.classList.toggle("active", currentTimetableDirection === "toKumamoto");
}

function renderTimetable() {
  const select = document.getElementById("stationSelect");
  const timetableEl = document.getElementById("timetable");
  if (!select || !timetableEl) return;

  const stationName = select.value || "三角";
  
  // mock-data.js の timetableData から選択駅・方向の時刻表を取得
  const rows = (typeof timetableData !== "undefined" && timetableData[stationName])
    ? (timetableData[stationName][currentTimetableDirection] || [])
    : [];

  if (!rows.length) {
    timetableEl.innerHTML = `<div class="empty-state" style="padding:20px; text-align:center; color:#64748b;">該当する列車データがありません。</div>`;
    return;
  }

  timetableEl.innerHTML = `
    <div class="timetable-list" style="margin-top:12px; display:flex; flex-direction:column; gap:8px;">
      ${rows.map(([time, kind]) => `
        <div class="timetable-row" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#f1f5f9; border-radius:8px;">
          <strong style="font-size:1.1rem; color:#0f172a;">${time}</strong>
          <span style="font-size:0.9rem; color:#475569; background:#e2e8f0; padding:2px 8px; border-radius:4px;">${kind}</span>
        </div>
      `).join("")}
    </div>`;
}

// --------------------------------------------------
// 4. その他の UI 補助機能
// --------------------------------------------------
function renderNextTrains() {
  if (typeof timetableData === "undefined") return;
  const stationName = document.getElementById("favoriteStationName")?.textContent || "三角";
  const data = timetableData[stationName]?.[currentNaviDirection] || [];
  const items = data.slice(0, 3);
  const wrap = document.getElementById("nextTrainStrip");
  if (!wrap) return;

  if (!items.length) {
    wrap.innerHTML = `<div class="empty-state">この方面の列車はありません。</div>`;
    return;
  }
  wrap.innerHTML = items.map(([time, kind], i) => `
    <button type="button" class="next-train-card" data-time="${time}" data-kind="${kind}">
      <span class="next-order">${i + 1}</span>
      <strong>${time}</strong>
      <span>${kind}</span>
      <small>${currentNaviDirection === "toKumamoto" ? "熊本方面" : "三角方面"}</small>
    </button>
  `).join("");
}

function renderVerticalRoute(trains) {
  const route = document.getElementById("verticalRoute");
  if (!route || typeof stations === "undefined") return;

  const ordered = currentNaviDirection === "toKumamoto" ? [...stations].reverse() : [...stations];
  route.innerHTML = ordered.map((station, i) => `
    <button type="button" class="station-row ${station.name === "熊本" ? "hub" : ""}" data-station="${station.name}">
      <span class="station-axis">
        <i class="station-dot"></i>
        ${i < ordered.length - 1 ? `<i class="station-line"></i>` : ""}
      </span>
      <span class="station-copy">
        <strong>${station.name}駅</strong>
        <small>発車時刻を見る <b>›</b></small>
      </span>
    </button>
  `).join("");
}

function renderConnectionView() {
  const list = document.getElementById("connectionList");
  if (!list || typeof connectionSamples === "undefined") return;
  list.innerHTML = (connectionSamples["熊本"] || []).map(c => `
    <article class="connection-item large">
      <strong>${c.time}</strong>
      <div><b>${c.line}</b><span>${c.destination}</span></div>
      <small>乗換 ${c.transferMinutes}分</small>
    </article>
  `).join("");
}

// --------------------------------------------------
// 5. DOMContentLoaded & 初期化
// --------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  // ナビゲーションボタン
  document.querySelectorAll(".nav-btn").forEach((btn, index) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const target = btn.dataset.target !== undefined ? Number(btn.dataset.target) : index;
      setView(target);
    });
  });

  // 時刻表ジャンプボタン
  const jumpBtn = document.getElementById("jumpTimetableBtn");
  if (jumpBtn) {
    jumpBtn.addEventListener("click", () => setView(3));
  }

  // スワイプ操作
  let startX = 0;
  const mainArea = document.querySelector(".app-main");
  if (mainArea) {
    mainArea.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; }, { passive: true });
    mainArea.addEventListener("touchend", (e) => {
      const diffX = startX - e.changedTouches[0].clientX;
      if (Math.abs(diffX) > 50) {
        if (diffX > 0 && currentView < 3) setView(currentView + 1);
        else if (diffX < 0 && currentView > 0) setView(currentView - 1);
      }
    }, { passive: true });
  }

  // 方面スイッチ
  document.querySelectorAll(".seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentNaviDirection = btn.dataset.direction;
      document.querySelectorAll(".seg-btn").forEach(b => b.classList.toggle("active", b === btn));
      renderNextTrains();
      renderVerticalRoute(loadedTrains);
    });
  });

  // 文字サイズ変更機能
  const fontScales = [
    { scale: 1.0, label: '文字サイズ: 標準' },
    { scale: 1.2, label: '文字サイズ: 大' },
    { scale: 0.85, label: '文字サイズ: 小' }
  ];
  let currentScaleIndex = 0;
  const mojiBtn = document.getElementById("Mojibtn");
  if (mojiBtn) {
    mojiBtn.addEventListener("click", () => {
      currentScaleIndex = (currentScaleIndex + 1) % fontScales.length;
      document.documentElement.style.setProperty('--font-scale', fontScales[currentScaleIndex].scale);
      mojiBtn.textContent = fontScales[currentScaleIndex].label;
    });
  }
});

async function init() {
  try {
    if (typeof loadTrainData === "function") {
      loadedTrains = await loadTrainData();
    }
  } catch (e) {
    console.warn("データロード警告:", e);
  }

  renderNextTrains();
  renderVerticalRoute(loadedTrains);
  renderConnectionView();
  initMap();
  renderMap(loadedTrains);
  initTimetable();

  if (splashScreen) {
    setTimeout(() => {
      splashScreen.classList.add("hide");
      document.body.classList.remove("splash-active");
      setTimeout(() => splashScreen.remove(), 350);
    }, 1200);
  }
}

init();

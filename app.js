// ==========================================================================
// 状態管理変数
// ==========================================================================
let currentView = 0;
let currentNaviDirection = "toKumamoto";
let currentTimetableDirection = "toKumamoto";
let mapReady = false;
let loadedTrains = [];

// DOM要素の保持
let viewsWrapper, navButtons, splashScreen, sheet, sheetBackdrop;

// ==========================================================================
// 1. 画面切り替え（スライド & ナビ制御）
// ==========================================================================
function setView(index) {
  currentView = Math.max(0, Math.min(3, index));

  if (viewsWrapper) {
    viewsWrapper.style.transform = `translateX(-${currentView * 25}%)`;
  }

  // ナビゲーションボタンのアクティブ状態切替
  if (navButtons && navButtons.length) {
    navButtons.forEach((btn) => {
      const target = Number(btn.dataset.target);
      btn.classList.toggle("active", target === currentView);
    });
  }

  document.body.dataset.view = String(currentView);

  // 地図タブ（index: 2）を開いたときにマップを初期化＆描画
  if (currentView === 2) {
    setTimeout(() => {
      initMap();
      renderMap(loadedTrains);
    }, 100);
  }
}

// ==========================================================================
// 2. 地図描画（SVG路線図 & リアルタイム位置）
// ==========================================================================
function getRoutePoints() {
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
  if (typeof stations !== "undefined" && Array.isArray(stations)) {
    return stations.map(s => [s.lat, s.lng]);
  }
  return [];
}

function mapProjection() {
  const route = getRoutePoints();
  const stationList = (typeof stations !== "undefined" && Array.isArray(stations)) ? stations : [];
  const all = route.concat(stationList.map(s => [s.lat, s.lng]));
  
  if (!all.length) return { width: 720, height: 500, project: () => [0, 0] };

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

  const stationSvg = (typeof stations !== "undefined" && Array.isArray(stations) ? stations : []).map(s => {
    const [x, y] = project(s.lat, s.lng);
    const isEnd = x > width * 0.72;
    const anchor = isEnd ? "end" : "start";
    const textX = x + (isEnd ? -10 : 10);
    return `
      <g class="svg-station">
        <circle cx="${x}" cy="${y}" r="6"></circle>
        <text x="${textX}" y="${y + 4}" text-anchor="${anchor}">${s.name}</text>
      </g>`;
  }).join("");

  mapEl.innerHTML = `
    <svg id="routeSvgMap" class="svg-route-map" viewBox="0 0 ${width} ${height}" aria-label="熊本から三角までの路線図">
      <polyline class="svg-route-halo" points="${routePointsStr}" />
      <polyline class="svg-route-line" points="${routePointsStr}" />
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
    if (!t || !t.lat || !t.lng) return "";
    const [x, y] = project(t.lat, t.lng);
    const labelText = `${t.id || ''} ${typeof statusText === "function" ? statusText(t) : (t.delayMinutes ? t.delayMinutes + "分遅れ" : "定刻")}`;
    return `
      <g class="svg-train" transform="translate(${x} ${y})">
        <circle class="svg-train-circle" r="14"></circle>
        <text x="0" y="5" text-anchor="middle">🚃</text>
        <rect class="svg-train-label-bg" x="-40" y="-38" width="80" height="20" rx="10"></rect>
        <text class="svg-train-label" x="0" y="-24" text-anchor="middle">${labelText}</text>
      </g>`;
  }).join("");
}

// ==========================================================================
// 3. 時刻表描画
// ==========================================================================
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
  const rows = (typeof timetableData !== "undefined" && timetableData[stationName])
    ? (timetableData[stationName][currentTimetableDirection] || [])
    : [];

  if (!rows.length) {
    timetableEl.innerHTML = `<div class="empty-state">該当する列車データがありません。</div>`;
    return;
  }

  timetableEl.innerHTML = `
    <div class="timetable-list">
      ${rows.map(([time, kind]) => `
        <div class="timetable-row">
          <strong>${time}</strong>
          <span>${kind}</span>
        </div>
      `).join("")}
    </div>`;
}

// ==========================================================================
// 4. その他の UI 補助機能（接近表示・路線図・乗り換え案内）
// ==========================================================================
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
  if (!route || typeof stations === "undefined" || !Array.isArray(stations)) return;

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

// ==========================================================================
// 5. スプラッシュ画面を閉じる安全関数
// ==========================================================================
function dismissSplashScreen() {
  const splash = splashScreen || document.getElementById("splashScreen");
  if (splash) {
    splash.classList.add("hide");
    document.body.classList.remove("splash-active");
    setTimeout(() => {
      if (splash.parentNode) splash.parentNode.removeChild(splash);
    }, 350);
  }
}

// ==========================================================================
// 6. DOMContentLoaded & アプリ初期化
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  // 主要要素の取得
  viewsWrapper = document.querySelector(".views-wrapper");
  navButtons = [...document.querySelectorAll(".nav-btn")];
  splashScreen = document.getElementById("splashScreen");
  sheet = document.getElementById("bottomSheet");
  sheetBackdrop = document.getElementById("sheetBackdrop");

  // ナビゲーションボタンのイベント登録
  navButtons.forEach((btn, index) => {
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

  // タッチスワイプ操作による画面切り替え
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
    { scale: 1.0, label: '文字の大きさ' },
    { scale: 1.18, label: '文字: 大' },
    { scale: 0.88, label: '文字: 小' }
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

  // 初期化開始
  init();
});

// アプリ全体の非同期データロード＆起動処理
async function init() {
  // 安全装置：データロードや各種エラーに関わらず、2.5秒後には絶対にロード画面を解除する
  const forceDismissTimer = setTimeout(() => {
    dismissSplashScreen();
  }, 2500);

  try {
    if (typeof loadTrainData === "function") {
      loadedTrains = await loadTrainData();
    }
  } catch (e) {
    console.warn("データロード警告:", e);
  }

  try {
    renderNextTrains();
    renderVerticalRoute(loadedTrains);
    renderConnectionView();
    initMap();
    renderMap(loadedTrains);
    initTimetable();
  } catch (e) {
    console.error("UI初期化中のエラー:", e);
  }

  // 1秒待機後に正常解除
  setTimeout(() => {
    clearTimeout(forceDismissTimer);
    dismissSplashScreen();
  }, 1000);
}

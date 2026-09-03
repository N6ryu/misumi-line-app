
let currentPage = 0;
let mapReady = false;
let currentTimetableDirection = "toMisumi";

const pager = document.getElementById("pager");
const navButtons = [...document.querySelectorAll(".nav-btn")];
const splashScreen = document.getElementById("splashScreen");

function setPage(index) {
  currentPage = Math.max(0, Math.min(3, index));
  pager.style.transform = `translateX(-${currentPage * 25}%)`;
  navButtons.forEach((b, i) => b.classList.toggle("active", i === currentPage));
  document.body.dataset.page = String(currentPage);
  if (currentPage === 2) {
    setTimeout(() => {
      try { initMap(); } catch (error) { console.error("地図の再描画に失敗:", error); }
    }, 120);
  }
}
navButtons.forEach(btn => btn.addEventListener("click", () => setPage(Number(btn.dataset.target))));

let touchStartX = null;
let touchStartY = null;
let pageSwipeBlocked = false;

function isInteractiveHorizontalArea(target) {
  return Boolean(target.closest(".route-scroll, #map, .leaflet-container, select, button, .train-summary-item, #timetable"));
}

pager.addEventListener("touchstart", e => {
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  pageSwipeBlocked = isInteractiveHorizontalArea(e.target);
}, {passive:true});

pager.addEventListener("touchend", e => {
  if (touchStartX === null || touchStartY === null) return;
  const touch = e.changedTouches[0];
  const dx = touch.clientX - touchStartX;
  const dy = touch.clientY - touchStartY;
  if (!pageSwipeBlocked && Math.abs(dx) >= 90 && Math.abs(dx) >= Math.abs(dy) * 1.4) {
    setPage(currentPage + (dx < 0 ? 1 : -1));
  }
  touchStartX = null;
  touchStartY = null;
  pageSwipeBlocked = false;
}, {passive:true});

function trainIllustration(train) {
  if (train.serviceKind === "ds" || /A列車/.test(train.serviceName || "")) {
    return `<div class="train-visual"><img src="./assets/atrain-photo.png" alt="A列車で行こう" /></div>`;
  }
  return `<div class="train-visual train-visual-generic" aria-hidden="true">🚃</div>`;
}

function statusClass(train) {
  if (isTerminalStopped(train)) return "arrived";
  if ((train.delayMinutes || 0) > 0) return "delay";
  return "normal";
}

function renderStatus(trains) {
  document.getElementById("trainCount").textContent = `${trains.length}列車`;
  document.getElementById("serviceStatus").textContent = "列車運行情報";
  document.getElementById("serviceMessage").textContent =
    "時刻表との照合を前提に、現在位置・次駅・到着予定を分かりやすく表示します。";

  const cards = document.getElementById("trainCards");
  cards.innerHTML = trains.map(t => {
    const terminal = isTerminalStopped(t);
    return `
      <article class="train-card">
        <div class="train-card-top">
          <div class="train-identify">
            ${trainIllustration(t)}
            <div>
              <div class="train-name">${t.id}</div>
              ${t.serviceName ? `<div class="train-service-name">${t.serviceName}</div>` : ""}
            </div>
          </div>
          <span class="badge">${t.rawDirection}・${t.direction}</span>
        </div>
        <div class="info-grid ${terminal ? 'terminal-grid' : ''}">
          <div><small>運行状況</small><strong>${statusText(t)}</strong></div>
          <div><small>現在位置</small><strong>${locationText(t)}</strong></div>
          ${terminal ? '' : `<div><small>次駅</small><strong>${t.nextStation}</strong></div>
          <div><small>${nextTimeLabel(t)}</small><strong>${nextTimeValue(t)}</strong></div>`}
        </div>
      </article>
    `;
  }).join("");
}

function renderRoute(trains) {
  const stationLayer = document.getElementById("stationLayer");
  const trainLayer = document.getElementById("trainLayer");

  const displayStations = [...stations].reverse();
  const start = 60;
  const usableWidth = 707;

  stationLayer.innerHTML = displayStations.map((s, i) => {
    const x = start + usableWidth * (i / (displayStations.length - 1));
    return `<div class="station" style="left:${x}px">
      <div class="station-name">${s.name}</div>
    </div>`;
  }).join("");

  trainLayer.innerHTML = trains.map(t => {
    const displayIndex = (stations.length - 1) - t.positionIndex;
    const x = start + usableWidth * (displayIndex / (stations.length - 1));
    const cls = t.direction === "三角方面" ? "outbound" : "inbound";
    const terminal = isTerminalStopped(t);
    const labelText = terminal ? "終点到着" : statusText(t);
    return `<div class="train-marker ${cls}${terminal ? " stopped" : ""}" style="left:${x}px">
      <div class="train-status-label ${statusClass(t)}">${labelText}</div>
      <div class="train-icon">🚃</div>
      <span>${t.id}</span>
    </div>`;
  }).join("");

  const summary = document.getElementById("trainSummary");
  summary.innerHTML = trains.map(t => {
    const cls = t.direction === "三角方面" ? "outbound" : "inbound";
    const terminal = isTerminalStopped(t);
    return `<article class="train-summary-item ${cls}">
      <div class="train-summary-main">
        <div class="train-summary-title">
          <strong>${t.id}</strong>
          ${t.serviceName ? `<span class="train-service">${t.serviceName}</span>` : ""}
        </div>
        <div class="train-summary-location">${locationText(t)}</div>
        <div class="train-summary-meta">
          ${terminal ? "終点到着のため、次駅表示はありません。" : `次駅：${t.nextStation}`}
        </div>
      </div>
      <div class="train-summary-side">
        <span class="train-summary-status ${statusClass(t)}">${statusText(t)}</span>
        ${terminal ? '' : `<span class="train-summary-eta"><small>${nextTimeLabel(t)}</small><strong>${nextTimeValue(t)}</strong></span>`}
      </div>
    </article>`;
  }).join("");
}

function getRoutePoints() {
  if (Array.isArray(lightweightRouteSegments) && lightweightRouteSegments.length) {
    const points = [];
    lightweightRouteSegments.forEach((seg, segIndex) => {
      if (!seg || !Array.isArray(seg.points)) return;
      seg.points.forEach((p, i) => {
        if (segIndex > 0 && i === 0) return;
        if (Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) points.push(p);
      });
    });
    if (points.length > 1) return points;
  }
  return stations.map(s => [s.lat, s.lng]);
}

function mapProjection() {
  const route = getRoutePoints();
  const all = route.concat(stations.map(s => [s.lat, s.lng]));
  const lats = all.map(p => p[0]);
  const lngs = all.map(p => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const pad = 34, width = 720, height = 500;
  const usableW = width - pad * 2, usableH = height - pad * 2;
  const project = (lat, lng) => {
    const x = pad + ((lng - minLng) / Math.max(0.000001, maxLng - minLng)) * usableW;
    const y = pad + ((maxLat - lat) / Math.max(0.000001, maxLat - minLat)) * usableH;
    return [x, y];
  };
  return { width, height, project };
}

function initMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl) return;

  const { width, height, project } = mapProjection();
  const route = getRoutePoints();
  const routePoints = route.map(p => project(p[0], p[1]).join(",")).join(" ");

  const stationSvg = stations.map((s, i) => {
    const [x, y] = project(s.lat, s.lng);
    const anchor = x > width * .72 ? "end" : "start";
    const tx = anchor === "end" ? x - 9 : x + 9;
    const ty = y + (i % 2 ? -8 : 16);
    return `<g class="svg-station">
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5"></circle>
      <text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${anchor}">${s.name}</text>
    </g>`;
  }).join("");

  mapEl.innerHTML = `
    <div class="svg-map-shell">
      <svg id="routeSvgMap" class="svg-route-map" viewBox="0 0 ${width} ${height}" role="img" aria-label="熊本駅から三角駅までの路線図">
        <defs>
          <filter id="trainShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity=".22"/>
          </filter>
        </defs>
        <polyline class="svg-route-halo" points="${routePoints}"></polyline>
        <polyline class="svg-route-line" points="${routePoints}"></polyline>
        ${stationSvg}
        <g id="svgTrainLayer"></g>
      </svg>
      <div class="svg-map-note">熊本〜三角の軽量路線データ（各駅間10中間点）</div>
    </div>`;
  mapReady = true;
}

function renderMap(trains) {
  if (!mapReady || !document.getElementById("routeSvgMap")) initMap();
  const layer = document.getElementById("svgTrainLayer");
  if (!layer) return;

  const { project } = mapProjection();
  layer.innerHTML = trains.map(t => {
    if (!Number.isFinite(t.lat) || !Number.isFinite(t.lng)) return "";
    const [x, y] = project(t.lat, t.lng);
    const terminal = isTerminalStopped(t);
    const status = statusText(t);
    const dir = t.direction === "三角方面" ? "→" : "←";
    return `<g class="svg-train ${terminal ? "stopped" : ""}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
      <rect class="svg-train-label-bg" x="-48" y="-45" width="96" height="24" rx="12"></rect>
      <text class="svg-train-label" x="0" y="-29" text-anchor="middle">${t.id} ${status}</text>
      <g class="svg-train-icon" filter="url(#trainShadow)">
        <rect x="-18" y="-18" width="36" height="29" rx="7"></rect>
        <rect class="svg-train-window" x="-11" y="-12" width="8" height="7" rx="1"></rect>
        <rect class="svg-train-window" x="3" y="-12" width="8" height="7" rx="1"></rect>
        <circle cx="-10" cy="13" r="4"></circle><circle cx="10" cy="13" r="4"></circle>
        <text class="svg-train-dir" x="0" y="3" text-anchor="middle">${dir}</text>
      </g>
    </g>`;
  }).join("");
}

function initTimetable() {
  const select = document.getElementById("stationSelect");
  select.innerHTML = stations.map(s => `<option value="${s.name}">${s.name}</option>`).join("");
  select.addEventListener("change", renderTimetable);

  document.getElementById("toMisumiBtn").addEventListener("click", () => {
    currentTimetableDirection = "toMisumi";
    syncDirectionButtons();
    renderTimetable();
  });
  document.getElementById("toKumamotoBtn").addEventListener("click", () => {
    currentTimetableDirection = "toKumamoto";
    syncDirectionButtons();
    renderTimetable();
  });

  syncDirectionButtons();
  renderTimetable();
}

function syncDirectionButtons() {
  document.getElementById("toMisumiBtn").classList.toggle("active", currentTimetableDirection === "toMisumi");
  document.getElementById("toKumamotoBtn").classList.toggle("active", currentTimetableDirection === "toKumamoto");
}

function trainTypeBadge(type) {
  const isA = /A列車/.test(type);
  return `<span class="train-type ${isA ? 'ds' : 'local'}">${type}</span>`;
}

function renderTimetable() {
  const station = document.getElementById("stationSelect").value || stations[0].name;
  const stationData = timetableData?.[station];
  const rows = stationData?.[currentTimetableDirection] || [];
  const label = currentTimetableDirection === "toMisumi" ? "三角方面" : "熊本方面";
  const timetable = document.getElementById("timetable");

  if (!rows.length) {
    const message = station === "熊本" && currentTimetableDirection === "toKumamoto"
      ? `
        <div class="empty-state">
          <strong>熊本駅はこの画面で扱う熊本方面列車の終点です。</strong>
          <p>会議メモを踏まえ、熊本駅での鹿児島本線接続表示は今後の拡張候補として整理します。</p>
        </div>`
      : `<div class="empty-state"><strong>${station}駅から${label}の列車はありません。</strong></div>`;
    timetable.innerHTML = message;
    return;
  }

  timetable.innerHTML = `
    <div class="timetable-head">
      <div>
        <p class="muted timetable-label">${station}駅</p>
        <h3>${label}</h3>
      </div>
      <span class="timetable-hint">下へスクロール</span>
    </div>
    <div class="timetable-list">
      ${rows.map(([time, type]) => `
        <div class="time-row">
          <strong class="time-value">${time}</strong>
          ${trainTypeBadge(type)}
        </div>
      `).join("")}
    </div>
  `;
}

function hideSplash() {
  if (!splashScreen) return;
  splashScreen.classList.add("hidden");
  document.body.classList.remove("splash-active");
  setTimeout(() => splashScreen.remove(), 650);
}

async function refresh() {
  const data = await loadTrainData();
  renderStatus(data);
  renderRoute(data);
  renderMap(data);
}

document.addEventListener("DOMContentLoaded", () => {
  // スプラッシュ画面は、地図や外部ライブラリの読み込み状況に関係なく必ず閉じる。
  // モバイル回線等で地図処理に時間がかかっても起動画面で止まらないようにする。
  setTimeout(hideSplash, 2500);

  try {
    setPage(0);
    initTimetable();
  } catch (error) {
    console.error("初期画面の初期化に失敗しました:", error);
  }

  try {
    initMap();
  } catch (error) {
    console.error("地図の初期化に失敗しました:", error);
    const mapEl = document.getElementById("map");
    if (mapEl) {
      mapEl.innerHTML = '<div class="map-fallback-message">路線図の描画に失敗しました。ページを再読み込みしてください。</div>';
    }
  }

  // データ描画に失敗しても、アプリ本体への遷移は止めない。
  refresh().catch(error => {
    console.error("列車データの描画に失敗しました:", error);
  });
});

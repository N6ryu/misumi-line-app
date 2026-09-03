
let currentPage = 0;
let map;
let mapMarkers = {};
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
      if (!map) {
        try { initMap(); } catch (error) { console.error("地図の再初期化に失敗:", error); }
      }
      if (map) map.invalidateSize();
    }, 250);
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

function initMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl) return;
  if (!window.L) {
    mapEl.innerHTML = '<div class="map-fallback-message">地図ライブラリを読み込めませんでした。通信環境を確認して再読み込みしてください。</div>';
    return;
  }
  if (map) { setTimeout(() => map.invalidateSize(), 100); return; }

  map = L.map("map", { zoomControl: true, preferCanvas: true });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18, attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  const routeGroup = L.featureGroup().addTo(map);
  try {
    if (!Array.isArray(lightweightRouteSegments)) throw new Error("軽量路線データがありません");
    lightweightRouteSegments.forEach(seg => {
      if (!seg || !Array.isArray(seg.points) || seg.points.length < 2) return;
      L.polyline(seg.points, {
        weight: 5, opacity: .88,
        color: seg.from === "熊本" || seg.from === "西熊本" || seg.from === "川尻" || seg.from === "富合" ? "#4d7c9b" : "#1675c1",
        lineJoin: "round", lineCap: "round",
        smoothFactor: 1.25
      }).addTo(routeGroup);
    });
  } catch (error) {
    console.error("軽量路線の描画に失敗。駅間簡易線へ切り替えます:", error);
    L.polyline(stations.map(s => [s.lat, s.lng]), {
      weight: 5, opacity: .85, color: "#1675c1", lineJoin: "round", lineCap: "round"
    }).addTo(routeGroup);
  }

  stations.forEach(s => {
    L.circleMarker([s.lat, s.lng], { radius: 5, weight: 2, fillOpacity: 1 })
      .addTo(map).bindTooltip(s.name);
  });

  const bounds = routeGroup.getBounds();
  if (bounds && bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28] });
  setTimeout(() => map.invalidateSize(), 250);
}

function trainDivIcon(t) {
  const dirClass = t.direction === "三角方面" ? "to-misumi" : "to-kumamoto";
  return L.divIcon({
    className: "train-leaflet-icon",
    iconSize: [104, 72],
    iconAnchor: [52, 58],
    popupAnchor: [0, -48],
    html: `<div class="map-train-wrap">
      <div class="map-train-status ${statusClass(t)}">${statusText(t)}</div>
      <div class="map-train-icon ${dirClass}${isTerminalStopped(t) ? " stopped" : ""}">🚃</div>
    </div>`
  });
}

function renderMap(trains) {
  if (!map) return;
  const activeIds = new Set(trains.map(t => t.id));
  Object.keys(mapMarkers).forEach(id => {
    if (!activeIds.has(id)) {
      map.removeLayer(mapMarkers[id]);
      delete mapMarkers[id];
    }
  });

  trains.forEach(t => {
    if (!mapMarkers[t.id]) {
      mapMarkers[t.id] = L.marker([t.lat, t.lng], {icon: trainDivIcon(t)}).addTo(map);
    } else {
      mapMarkers[t.id].setLatLng([t.lat, t.lng]);
      mapMarkers[t.id].setIcon(trainDivIcon(t));
    }

    const terminal = isTerminalStopped(t);
    mapMarkers[t.id].bindPopup(
      `<strong>${t.id}${t.serviceName ? " " + t.serviceName : ""}</strong><br>` +
      `${locationText(t)}<br>` +
      `${terminal ? "終点到着" : `次駅：${t.nextStation}<br>${nextTimeLabel(t)}：${nextTimeValue(t)}`}`
    );
  });
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
      mapEl.innerHTML = '<div style="padding:20px">地図の読み込みに失敗しました。通信環境を確認して再読み込みしてください。</div>';
    }
  }

  // データ描画に失敗しても、アプリ本体への遷移は止めない。
  refresh().catch(error => {
    console.error("列車データの描画に失敗しました:", error);
  });
});

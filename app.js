let currentPage = 0;
let map;
let mapMarkers = {};
let currentTimetableDirection = "toMisumi";

const pager = document.getElementById("pager");
const navButtons = [...document.querySelectorAll(".nav-btn")];

function setPage(index) {
  currentPage = Math.max(0, Math.min(3, index));
  pager.style.transform = `translateX(-${currentPage * 25}%)`;
  navButtons.forEach((b, i) => b.classList.toggle("active", i === currentPage));
  document.body.dataset.page = String(currentPage);
  if (currentPage === 2 && map) setTimeout(() => map.invalidateSize(), 250);
}
navButtons.forEach(btn => btn.addEventListener("click", () => setPage(Number(btn.dataset.target))));

// ページ切替スワイプ。
// 列車位置の横スクロールと地図操作は、外側のページ切替より優先する。
let touchStartX = null;
let touchStartY = null;
let pageSwipeBlocked = false;

function isInteractiveHorizontalArea(target) {
  return Boolean(target.closest(".route-scroll, #map, .leaflet-container, select, button, .train-summary-item"));
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

  // 誤操作防止：
  // 1) 子要素の横操作・地図操作中は切り替えない
  // 2) 90px以上の明確な横スワイプのみ
  // 3) 横移動が縦移動の1.4倍以上の場合のみ
  if (!pageSwipeBlocked && Math.abs(dx) >= 90 && Math.abs(dx) >= Math.abs(dy) * 1.4) {
    setPage(currentPage + (dx < 0 ? 1 : -1));
  }

  touchStartX = null;
  touchStartY = null;
  pageSwipeBlocked = false;
}, {passive:true});

function formatTime(d) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleTimeString("ja-JP", { hour:"2-digit", minute:"2-digit", second:"2-digit" });
}

function renderStatus(trains) {
  const latest = trains
    .map(t => t.acquiredAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  document.getElementById("trainCount").textContent = `${trains.length}列車`;
  document.getElementById("lastUpdated").textContent = latest ? `取得 ${latest.slice(5)}` : "取得 --";
  document.getElementById("serviceStatus").textContent = "運行データ表示中";
  document.getElementById("serviceMessage").textContent =
    "遅延は正式な時刻表データとの照合後に判定します。";

  const cards = document.getElementById("trainCards");
  cards.innerHTML = trains.map(t => `
    <article class="train-card">
      <div class="train-card-top">
        <div class="train-name">${t.id}</div>
        <span class="badge">${t.rawDirection}・${t.direction}</span>
      </div>
      <div class="info-grid">
        <div><small>運行状況</small><strong>${statusText(t)}</strong></div>
        <div><small>現在位置</small><strong>${locationText(t)}</strong></div>
        <div><small>次駅</small><strong>${t.nextStation}</strong></div>
        <div><small>次駅到着予定</small><strong>${nextStationEta(t)}</strong></div>
      </div>
      <div class="source-row">
        <span>速度 ${speedText(t)}</span>
        <span>取得 ${t.acquiredAt}</span>
      </div>
    </article>
  `).join("");
}

function renderRoute(trains) {
  const stationLayer = document.getElementById("stationLayer");
  const trainLayer = document.getElementById("trainLayer");

  // 左：三角、右：熊本
  const displayStations = [...stations].reverse();
  const start = 60;
  const usableWidth = 1060;

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
    const stopped = isTerminalStopped(t);
    const markerClass = stopped ? " stopped" : "";
    return `<div class="train-marker ${cls}${markerClass}" style="left:${x}px">
      <div class="train-status-label">${stopped ? "停車中" : speedText(t)}</div>
      <div class="train-icon">🚃</div>
      <span>${t.id}</span>
    </div>`;
  }).join("");

  const summary = document.getElementById("trainSummary");
  summary.innerHTML = trains.map(t => {
    const cls = t.direction === "三角方面" ? "outbound" : "inbound";
    return `<article class="train-summary-item ${cls}">
      <div class="train-summary-main">
        <div class="train-summary-title">
          <strong>${t.id}</strong>
          <span class="badge">${t.rawDirection}・${t.direction}</span>
        </div>
        <div class="train-summary-location">${locationText(t)}</div>
        <div class="train-summary-meta">次駅：${t.nextStation}　速度：${speedText(t)}</div>
      </div>
      <div class="train-summary-side">
        <span class="train-summary-status pending">${statusText(t)}</span>
        <span class="train-summary-eta"><small>到着予定</small><strong>${nextStationEta(t)}</strong></span>
      </div>
    </article>`;
  }).join("");
}

function initMap() {
  if (!window.L) {
    document.getElementById("map").innerHTML = '<div style="padding:20px">地図ライブラリを読み込めませんでした。</div>';
    return;
  }
  map = L.map("map", { zoomControl:true });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18, attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  const line = stations.map(s => [s.lat, s.lng]);
  L.polyline(line, { weight: 5, opacity: .75 }).addTo(map);

  stations.forEach(s => {
    L.circleMarker([s.lat, s.lng], { radius:5, weight:2, fillOpacity:1 })
      .addTo(map).bindTooltip(s.name);
  });

  map.fitBounds(L.latLngBounds(line), { padding:[30,30] });
}

function trainDivIcon(t) {
  const dirClass = t.direction === "三角方面" ? "to-misumi" : "to-kumamoto";
  const delayCls = t.delayMinutes > 0 ? "delay" : "";

  // Leaflet側の iconAnchor のみで位置決めし、
  // CSS transform は使わない。これにより緯度経度の地点に
  // アイコン下端中央が正確に乗る。
  return L.divIcon({
    className: "train-leaflet-icon",
    iconSize: [92, 62],
    iconAnchor: [46, 50],
    popupAnchor: [0, -48],
    html: `<div class="map-train-wrap">
      <div class="map-train-status ${delayCls}">${isTerminalStopped(t) ? "停車中" : speedText(t)}</div>
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
    mapMarkers[t.id].bindPopup(
      `<strong>${t.id}</strong><br>${t.rawDirection}・${t.direction}<br>${locationText(t)}<br>次駅：${t.nextStation}<br>速度：${speedText(t)}<br>取得：${t.acquiredAt}`
    );
  });
}

function initTimetable() {
  const select = document.getElementById("stationSelect");
  select.innerHTML = stations.map(s => `<option>${s.name}</option>`).join("");
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

  renderTimetable();
}

function syncDirectionButtons() {
  document.getElementById("toMisumiBtn").classList.toggle("active", currentTimetableDirection === "toMisumi");
  document.getElementById("toKumamotoBtn").classList.toggle("active", currentTimetableDirection === "toKumamoto");
}

function renderTimetable() {
  const station = document.getElementById("stationSelect").value || stations[0].name;
  const rows = (timetableData[station] && timetableData[station][currentTimetableDirection]) || [];
  const label = currentTimetableDirection === "toMisumi" ? "三角方面" : "熊本方面";

  if (!rows.length) {
    document.getElementById("timetable").innerHTML = `<p class="muted">${station}駅から${label}の列車はありません。</p>`;
    return;
  }
  document.getElementById("timetable").innerHTML =
    `<p class="muted">${station}駅・${label}</p>` +
    rows.map(([time, type]) =>
      `<div class="time-row"><strong>${time}</strong><span class="train-type">${type}</span></div>`
    ).join("");
}

async function refresh() {
  const data = await loadTrainData();
  renderStatus(data);
  renderRoute(data);
  renderMap(data);
}

document.addEventListener("DOMContentLoaded", async () => {
  initMap();
  initTimetable();
  await refresh();
});

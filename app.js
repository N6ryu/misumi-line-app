// 三角線リアルタイムナビゲーション - app.js

const TARGET_STATIONS = [
  "宇土", "緑川", "住吉", "肥後長浜", "網田", "赤瀬", "石打ダム", "波多浦", "三角"
];

let currentMyStation = localStorage.getItem("myStation") || "宇土";
let mapInstance = null;
let trainMarkers = [];

document.addEventListener("DOMContentLoaded", async () => {
  initMyStationSelector();
  initMap();
  await refreshAppUI();

  setInterval(async () => {
    await refreshAppUI();
  }, 15000);
});

function initMyStationSelector() {
  const selectEl = document.getElementById("station-select");
  if (!selectEl) return;

  selectEl.value = currentMyStation;

  selectEl.addEventListener("change", async (e) => {
    currentMyStation = e.target.value;
    localStorage.setItem("myStation", currentMyStation);
    await refreshAppUI();
  });
}

async function refreshAppUI() {
  const currentTrains = typeof loadTrainData === "function" ? await loadTrainData() : (typeof trains !== "undefined" ? trains : []);

  updateMyStationHeader(currentMyStation);
  renderApproachInfo(currentMyStation, currentTrains);
  renderTimetable(currentMyStation);
  updateMapMarkers(currentTrains);
}

function updateMyStationHeader(stationName) {
  const labelEl = document.getElementById("my-station-name-display");
  if (labelEl) {
    labelEl.textContent = `${stationName}駅`;
  }
}

function renderApproachInfo(stationName, trainList) {
  const container = document.getElementById("approach-info-container");
  if (!container) return;

  const myIdx = typeof stationIndex === "function" ? stationIndex(stationName) : -1;
  if (myIdx < 0) {
    container.innerHTML = `<p>対象駅の情報がありません。</p>`;
    return;
  }

  const trainStatuses = trainList.map(train => {
    const pIdx = typeof train.positionIndex === "number" ? train.positionIndex : (typeof routePositionIndex === "function" ? routePositionIndex(train) : 0);
    const distance = Math.abs(pIdx - myIdx);

    return {
      ...train,
      distanceStations: distance,
      locationStr: typeof locationText === "function" ? locationText(train) : `${train.currentStation}付近`,
      statusStr: typeof statusText === "function" ? statusText(train) : "定刻",
      nextTimeStr: typeof nextTimeValue === "function" ? nextTimeValue(train) : ""
    };
  }).sort((a, b) => a.distanceStations - b.distanceStations);

  if (trainStatuses.length === 0) {
    container.innerHTML = `<p>現在運行中の列車はありません。</p>`;
    return;
  }

  let html = `<div class="approach-summary-card">`;
  html += `<h3 class="card-title">${stationName}駅 周辺の走行状況</h3>`;

  trainStatuses.forEach(t => {
    const isATrain = t.serviceKind === "ds" || t.serviceName.includes("A列車");

    html += `
      <div class="train-card ${isATrain ? 'train-ds' : ''}">
        <div><strong>${t.serviceName}</strong> (${t.trainNo}) - ${t.statusStr}</div>
        <div>現在地: ${t.locationStr}</div>
        <div>進行方向: ${t.direction}</div>
        ${t.nextTimeStr ? `<div>次駅予定: ${t.nextStop}${t.nextTimeStr}</div>` : ''}
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function renderTimetable(stationName) {
  const container = document.getElementById("timetable-container");
  if (!container || typeof timetableData === "undefined") return;

  const data = timetableData[stationName];
  if (!data) {
    container.innerHTML = `<p>${stationName}駅の時刻表データはありません。</p>`;
    return;
  }

  const toMisumi = data.toMisumi || [];
  const toKumamoto = data.toKumamoto || [];

  let html = `
    <div class="timetable-card">
      <h3 class="card-title">${stationName}駅 時刻表</h3>
      <div class="timetable-grid">
        <div class="timetable-column">
          <h4>下り (三角方面)</h4>
          ${renderTimeList(toMisumi)}
        </div>
        <div class="timetable-column">
          <h4>上り (熊本方面)</h4>
          ${renderTimeList(toKumamoto)}
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function renderTimeList(list) {
  if (!list || list.length === 0) {
    return `<p>発車予定なし</p>`;
  }

  return `
    <ul class="time-list">
      ${list.map(([time, type]) => {
        const isLimited = type.includes("A列車");
        return `
          <li class="time-item ${isLimited ? 'is-limited' : ''}">
            <span>${time}</span>
            <span>${type}</span>
          </li>
        `;
      }).join('')}
    </ul>
  `;
}

function initMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl || typeof L === "undefined") return;

  mapInstance = L.map('map').setView([32.65, 130.55], 11);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(mapInstance);

  if (typeof getRoutePolylineCoordinates === "function") {
    const latLngs = getRoutePolylineCoordinates();
    if (latLngs.length > 0) {
      L.polyline(latLngs, { color: '#005a9c', weight: 4 }).addTo(mapInstance);
    }
  }
}

function updateMapMarkers(trainList) {
  if (!mapInstance || typeof getLatLngFromPositionIndex !== "function") return;

  trainMarkers.forEach(m => mapInstance.removeLayer(m));
  trainMarkers = [];

  trainList.forEach(t => {
    const pIdx = typeof t.positionIndex === "number" ? t.positionIndex : (typeof routePositionIndex === "function" ? routePositionIndex(t) : 0);
    const coords = getLatLngFromPositionIndex(pIdx);

    if (coords && coords.lat && coords.lng) {
      const marker = L.circleMarker([coords.lat, coords.lng], {
        radius: 7,
        color: '#fff',
        fillColor: t.serviceKind === 'ds' ? '#d32f2f' : '#005a9c',
        fillOpacity: 1,
        weight: 2
      }).addTo(mapInstance);

      if (typeof locationText === "function") {
        marker.bindPopup(`<b>${t.serviceName}</b><br>${locationText(t)}`);
      }
      trainMarkers.push(marker);
    }
  });
}

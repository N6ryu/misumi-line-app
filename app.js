// 三角線リアルタイムナビゲーション - app.js
// マイ駅選択（宇土〜三角）・接近表示・時刻表統合モジュール

// --- 宇土〜三角の選択対象駅リスト ---
const TARGET_STATIONS = [
  "宇土", "緑川", "住吉", "肥後長浜", "網田", "赤瀬", "石打ダム", "波多浦", "三角"
];

// 現在選択されているマイ駅（初期値: 宇土 / localStorage保持）
let currentMyStation = localStorage.getItem("myStation") || "宇土";
let mapInstance = null;
let trainMarkers = [];

// DOMロード完了時の初期化処理
document.addEventListener("DOMContentLoaded", async () => {
  initMyStationSelector();
  initMap();
  await refreshAppUI();

  // 定期自動更新（15秒ごとに列車位置および接近状況をリフレッシュ）
  setInterval(async () => {
    await refreshAppUI();
  }, 15000);
});

/**
 * 1. マイ駅選択ドロップダウンの初期化とイベント設定
 */
function initMyStationSelector() {
  const selectEl = document.getElementById("station-select");
  if (!selectEl) return;

  // 宇土〜三角駅のドロップダウン要素を自動生成
  selectEl.innerHTML = TARGET_STATIONS.map(st => 
    `<option value="${st}" ${st === currentMyStation ? "selected" : ""}>${st}駅</option>`
  ).join("");

  // 駅変更時のイベントハンドラ
  selectEl.addEventListener("change", async (e) => {
    currentMyStation = e.target.value;
    localStorage.setItem("myStation", currentMyStation);
    await refreshAppUI();
  });
}

/**
 * 2. 画面全体の表示リフレッシュ関数
 */
async function refreshAppUI() {
  // mock-data.js から最新データ取得
  const currentTrains = typeof loadTrainData === "function" ? await loadTrainData() : (typeof trains !== "undefined" ? trains : []);

  updateMyStationHeader(currentMyStation);
  renderApproachInfo(currentMyStation, currentTrains);
  renderTimetable(currentMyStation);
  updateMapMarkers(currentTrains);
}

/**
 * 3. マイ駅表示ヘッダーの更新
 */
function updateMyStationHeader(stationName) {
  const labelEl = document.getElementById("my-station-name-display");
  if (labelEl) {
    labelEl.textContent = `${stationName}駅`;
  }
}

/**
 * 4. 接近情報パネルの判定・描画
 */
function renderApproachInfo(stationName, trainList) {
  const container = document.getElementById("approach-info-container");
  if (!container) return;

  const myIdx = typeof stationIndex === "function" ? stationIndex(stationName) : -1;
  if (myIdx < 0) {
    container.innerHTML = `<div class="info-card">対象駅の情報が見つかりません</div>`;
    return;
  }

  // マイ駅との駅数距離を計算して昇順ソート（最寄りの列車を上に表示）
  const trainStatuses = trainList.map(train => {
    const pIdx = typeof train.positionIndex === "number" ? train.positionIndex : (typeof routePositionIndex === "function" ? routePositionIndex(train) : 0);
    const distance = Math.abs(pIdx - myIdx);

    return {
      ...train,
      currentPosIdx: pIdx,
      distanceStations: distance,
      locationStr: typeof locationText === "function" ? locationText(train) : `${train.currentStation}付近`,
      statusStr: typeof statusText === "function" ? statusText(train) : "定刻",
      nextTimeStr: typeof nextTimeValue === "function" ? nextTimeValue(train) : ""
    };
  }).sort((a, b) => a.distanceStations - b.distanceStations);

  if (trainStatuses.length === 0) {
    container.innerHTML = `<div class="info-card"><p>現在運行中の列車はありません。</p></div>`;
    return;
  }

  // 接近カードのHTML組み立て
  let html = `<div class="approach-summary-card">`;
  html += `<h3 class="card-title">${stationName}駅 周辺の走行状況</h3>`;

  trainStatuses.forEach(t => {
    const isDelay = t.delayMinutes > 0;
    const isATrain = t.serviceKind === "ds" || t.serviceName.includes("A列車");

    html += `
      <div class="train-card ${isATrain ? 'train-ds' : 'train-local'}">
        <div class="train-header">
          <span class="service-name">${t.serviceName}</span>
          <span class="train-no">${t.trainNo}</span>
          <span class="badge-status ${isDelay ? 'status-delay' : 'status-normal'}">${t.statusStr}</span>
        </div>
        <div class="train-body">
          <p class="train-location"><strong>現在地:</strong> ${t.locationStr}</p>
          <p class="train-direction"><strong>行先/方向:</strong> ${t.direction}</p>
          ${t.nextTimeStr ? `<p class="train-next"><strong>次駅予定:</strong> ${t.nextStop}${t.nextTimeStr}</p>` : ''}
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

/**
 * 5. マイ駅の上下線時刻表の描画
 */
function renderTimetable(stationName) {
  const container = document.getElementById("timetable-container");
  if (!container || typeof timetableData === "undefined") return;

  const data = timetableData[stationName];
  if (!data) {
    container.innerHTML = `<p class="no-data">※ ${stationName}駅の時刻表データはありません。</p>`;
    return;
  }

  const toMisumi = data.toMisumi || [];
  const toKumamoto = data.toKumamoto || [];

  let html = `
    <div class="timetable-card">
      <h3 class="card-title">${stationName}駅 時刻表</h3>
      <div class="timetable-grid">
        <div class="timetable-column">
          <h4 class="direction-title">下り (三角方面)</h4>
          ${renderTimeList(toMisumi)}
        </div>
        <div class="timetable-column">
          <h4 class="direction-title">上り (熊本方面)</h4>
          ${renderTimeList(toKumamoto)}
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

/**
 * 時刻表リスト表示ヘルパー
 */
function renderTimeList(list) {
  if (!list || list.length === 0) {
    return `<p class="no-data">発車予定なし</p>`;
  }

  return `
    <ul class="time-list">
      ${list.map(([time, type]) => {
        const isLimited = type.includes("A列車");
        return `
          <li class="time-item ${isLimited ? 'is-limited' : ''}">
            <span class="time">${time}</span>
            <span class="type">${type}</span>
          </li>
        `;
      }).join('')}
    </ul>
  `;
}

/**
 * 6. Leaflet マップ初期化と描画
 */
function initMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl || typeof L === "undefined") return;

  // 宇土〜三角の中心付近に初期マップを設置
  mapInstance = L.map('map').setView([32.65, 130.55], 11);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(mapInstance);

  // route-geometry.js の線形描画連携
  if (typeof getRoutePolylineCoordinates === "function") {
    const latLngs = getRoutePolylineCoordinates();
    if (latLngs.length > 0) {
      L.polyline(latLngs, { color: '#005A9C', weight: 4, opacity: 0.8 }).addTo(mapInstance);
    }
  }
}

/**
 * マップ上の列車マーカー更新
 */
function updateMapMarkers(trainList) {
  if (!mapInstance || typeof getLatLngFromPositionIndex !== "function") return;

  // 既存マーカー消去
  trainMarkers.forEach(m => mapInstance.removeLayer(m));
  trainMarkers = [];

  trainList.forEach(t => {
    const pIdx = typeof t.positionIndex === "number" ? t.positionIndex : routePositionIndex(t);
    const coords = getLatLngFromPositionIndex(pIdx);

    if (coords && coords.lat && coords.lng) {
      const marker = L.circleMarker([coords.lat, coords.lng], {
        radius: 8,
        color: '#FFFFFF',
        fillColor: t.serviceKind === 'ds' ? '#D32F2F' : '#005A9C',
        fillOpacity: 1,
        weight: 2
      }).addTo(mapInstance);

      marker.bindPopup(`<b>${t.serviceName}</b><br>${locationText(t)}`);
      trainMarkers.push(marker);
    }
  });
}

// 三角線リアルタイムナビゲーション - app.js
// マイ駅（宇土〜三角）動的切り替え・接近情報・時刻表統合モジュール

// --- 宇土〜三角の選択対象駅リスト ---
const TARGET_STATIONS = [
  "宇土", "緑川", "住吉", "肥後長浜", "網田", "赤瀬", "石打ダム", "波多浦", "三角"
];

// 現在選択されているマイ駅（初期値: 宇土 / localStorage保持）
let currentMyStation = localStorage.getItem("myStation") || "宇土";

// DOMロード完了時の初期化
document.addEventListener("DOMContentLoaded", async () => {
  initMyStationSelector();
  await refreshAppUI();

  // 定期自動更新（例: 30秒ごとに列車位置と接近表示をリフレッシュ）
  setInterval(async () => {
    await refreshAppUI();
  }, 30000);
});

/**
 * 1. マイ駅選択ドロップダウンの初期化とイベント設定
 */
function initMyStationSelector() {
  const selectEl = document.getElementById("station-select");
  if (!selectEl) return;

  // セレクトボックスの選択肢を生成（宇土〜三角）
  selectEl.innerHTML = TARGET_STATIONS.map(st => 
    `<option value="${st}" ${st === currentMyStation ? "selected" : ""}>${st}駅</option>`
  ).join("");

  // 選択変更時のイベントリスナー
  selectEl.addEventListener("change", async (e) => {
    currentMyStation = e.target.value;
    localStorage.setItem("myStation", currentMyStation);
    await refreshAppUI();
  });
}

/**
 * 2. 画面全体の表示リフレッシュ
 */
async function refreshAppUI() {
  // 列車データのロード（mock-data.js 連携）
  const currentTrains = typeof loadTrainData === "function" ? await loadTrainData() : trains;

  // 各エリアの表示更新
  updateMyStationHeader(currentMyStation);
  renderApproachInfo(currentMyStation, currentTrains);
  renderTimetable(currentMyStation);
}

/**
 * 3. マイ駅ヘッダー表示の更新
 */
function updateMyStationHeader(stationName) {
  const labelEl = document.getElementById("my-station-name-display");
  if (labelEl) {
    labelEl.textContent = `${stationName}駅`;
  }
}

/**
 * 4. 接近情報パネルの描画（マイ駅への最寄り列車判定）
 */
function renderApproachInfo(stationName, trainList) {
  const container = document.getElementById("approach-info-container");
  if (!container) return;

  const myIdx = stationIndex(stationName);
  if (myIdx < 0) {
    container.innerHTML = `<div class="info-card">駅情報が見つかりません</div>`;
    return;
  }

  // マイ駅に向かっている（または最寄りの）列車を抽出
  const trainStatuses = trainList.map(train => {
    const pIdx = typeof train.positionIndex === "number" ? train.positionIndex : routePositionIndex(train);
    const diff = pIdx - myIdx; // 正: 三角側 / 負: 熊本側
    const distance = Math.abs(diff);

    return {
      ...train,
      currentPosIdx: pIdx,
      distanceStations: distance,
      locationStr: locationText(train),
      statusStr: statusText(train),
      nextTimeStr: nextTimeValue(train)
    };
  }).sort((a, b) => a.distanceStations - b.distanceStations);

  if (trainStatuses.length === 0) {
    container.innerHTML = `<div class="info-card"><p>現在走行中の列車はありません</p></div>`;
    return;
  }

  // 最寄り列車の情報を生成
  let html = `<div class="approach-summary-card">`;
  html += `<h3>${stationName}駅 周辺の運行状況</h3>`;

  trainStatuses.forEach(t => {
    const isStoppedAtMyStation = isTerminalStopped(t) && t.currentStation === stationName;
    
    html += `
      <div class="train-card service-${t.serviceKind}">
        <div class="train-header">
          <span class="service-name">${t.serviceName}</span>
          <span class="train-no">(${t.trainNo})</span>
          <span class="badge-status ${t.delayMinutes > 0 ? 'delay' : 'normal'}">${t.statusStr}</span>
        </div>
        <div class="train-details">
          <p><strong>現在地:</strong> ${t.locationStr}</p>
          <p><strong>進行方向:</strong> ${t.direction}</p>
          ${t.scheduledNextArrival ? `<p><strong>次駅予定:</strong> ${t.nextStop}${t.nextTimeStr}</p>` : ''}
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

/**
 * 5. マイ駅の時刻表描画
 */
function renderTimetable(stationName) {
  const container = document.getElementById("timetable-container");
  if (!container || typeof timetableData === "undefined") return;

  const data = timetableData[stationName];
  if (!data) {
    container.innerHTML = `<p>時刻表データがありません。</p>`;
    return;
  }

  const toMisumi = data.toMisumi || [];
  const toKumamoto = data.toKumamoto || [];

  let html = `
    <div class="timetable-card">
      <h3>${stationName}駅 時刻表</h3>
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

/**
 * 時刻表リストのHTML生成ヘルパー
 */
function renderTimeList(list) {
  if (list.length === 0) return `<p class="no-data">運行なし</p>`;
  
  return `
    <ul class="time-list">
      ${list.map(([time, type]) => `
        <li class="time-item ${type.includes('A列車') ? 'limited-express' : ''}">
          <span class="time">${time}</span>
          <span class="type">${type}</span>
        </li>
      `).join('')}
    </ul>
  `;
}

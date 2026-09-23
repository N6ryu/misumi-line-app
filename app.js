
let currentView = 0;
let currentNaviDirection = "toKumamoto";
let currentTimetableDirection = "toKumamoto";
let mapReady = false;
let loadedTrains = [];

const views = [...document.querySelectorAll(".view")];
const navButtons = [...document.querySelectorAll(".nav-btn")];
const splashScreen = document.getElementById("splashScreen");
const sheet = document.getElementById("bottomSheet");
const sheetBackdrop = document.getElementById("sheetBackdrop");

function setView(index) {
  currentView = Math.max(0, Math.min(3, index));
  views.forEach((v, i) => v.classList.toggle("active", i === currentView));
  navButtons.forEach((b, i) => b.classList.toggle("active", i === currentView));
  document.body.dataset.view = String(currentView);
  if (currentView === 2) setTimeout(() => { initMap(); renderMap(loadedTrains); }, 40);
}
navButtons.forEach(btn => btn.addEventListener("click", () => setView(Number(btn.dataset.target))));
document.getElementById("jumpTimetableBtn").addEventListener("click", () => setView(3));

function trainIllustration(train) {
  if (train.serviceKind === "ds" || /A列車/.test(train.serviceName || "")) {
    return `<img src="./assets/atrain-photo.png" alt="A列車で行こう" class="mini-train-photo" />`;
  }
  return `<span class="mini-train-emoji" aria-hidden="true">🚃</span>`;
}

function statusClass(train) {
  if (isTerminalStopped(train)) return "arrived";
  if ((train.delayMinutes || 0) > 0) return "delay";
  return "normal";
}

function getVisibleOrder() {
  return currentNaviDirection === "toKumamoto" ? [...stations].reverse() : [...stations];
}

function matchingTimetableKey() {
  return currentNaviDirection;
}

function renderNextTrains() {
  const stationName = document.getElementById("favoriteStationName").textContent || "三角";
  const data = timetableData[stationName]?.[matchingTimetableKey()] || [];
  const items = data.slice(0, 3);
  const wrap = document.getElementById("nextTrainStrip");

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

function trainPlacement(train, orderedStations) {
  const currentIndex = orderedStations.findIndex(s => s.name === train.currentStation);
  const nextIndex = orderedStations.findIndex(s => s.name === train.nextStation);
  if (currentIndex < 0) return null;
  if (isTerminalStopped(train) || nextIndex < 0 || currentIndex === nextIndex) {
    return { stationIndex: currentIndex, progress: 0 };
  }
  // routePositionIndex は熊本→三角の順。表示順に合わせて割合へ変換。
  const base = train.positionIndex;
  const displayPos = currentNaviDirection === "toKumamoto"
    ? (stations.length - 1) - base
    : base;
  const nearest = Math.floor(displayPos);
  return { stationIndex: nearest, progress: Math.max(0.12, Math.min(0.88, displayPos - nearest)) };
}

function trainTimeText(train) {
  if (isTerminalStopped(train)) return `${train.currentStation} 終点到着`;
  const time = nextTimeValue(train);
  return `${train.nextStation} ${time}`;
}

function renderVerticalRoute(trains) {
  const route = document.getElementById("verticalRoute");
  const ordered = getVisibleOrder();
  const moving = trains.filter(t => {
    if (currentNaviDirection === "toKumamoto") return t.direction === "熊本方面" || isTerminalStopped(t);
    return t.direction === "三角方面";
  });

  let html = "";
  ordered.forEach((station, i) => {
    const isKumamoto = station.name === "熊本";
    const hasConnection = Boolean(connectionSamples[station.name]);

    html += `
      <button type="button" class="station-row ${isKumamoto ? "hub" : ""}" data-station="${station.name}">
        <span class="station-axis">
          <i class="station-dot"></i>
          ${i < ordered.length - 1 ? `<i class="station-line"></i>` : ""}
        </span>
        <span class="station-copy">
          <strong>${station.name}</strong>
          ${hasConnection ? `<small>${isKumamoto ? "接続列車を見る" : "乗換情報あり"} <b>›</b></small>` : `<small>発車時刻を見る <b>›</b></small>`}
        </span>
      </button>
    `;

    if (i < ordered.length - 1) {
      const between = moving.filter(t => {
        const p = trainPlacement(t, ordered);
        return p && p.stationIndex === i && !isTerminalStopped(t);
      });
      between.forEach(t => {
        html += `
          <button type="button" class="train-on-route ${t.serviceKind === "ds" ? "ds" : ""}" data-train="${t.id}">
            <span class="train-axis-icon">🚃</span>
            <span class="train-route-card">
              <span class="train-route-top">
                <strong>${t.id}</strong>
                ${t.serviceName ? `<em>${t.serviceName}</em>` : ""}
                <b class="${statusClass(t)}">${statusText(t)}</b>
              </span>
              <span class="train-route-time">${trainTimeText(t)}</span>
              <small>${locationText(t)}</small>
            </span>
          </button>
        `;
      });
    }

    const atStation = moving.filter(t => isTerminalStopped(t) && t.currentStation === station.name);
    atStation.forEach(t => {
      html += `
        <button type="button" class="train-on-route stopped" data-train="${t.id}">
          <span class="train-axis-icon">🚃</span>
          <span class="train-route-card">
            <span class="train-route-top">
              <strong>${t.id}</strong><b class="arrived">終点到着</b>
            </span>
            <span class="train-route-time">${t.currentStation}駅</span>
            <small>この列車の表示は正式運用時の条件に合わせて調整します。</small>
          </span>
        </button>
      `;
    });
  });
  route.innerHTML = html;

  route.querySelectorAll("[data-station]").forEach(btn =>
    btn.addEventListener("click", () => openStationSheet(btn.dataset.station))
  );
  route.querySelectorAll("[data-train]").forEach(btn =>
    btn.addEventListener("click", () => openTrainSheet(btn.dataset.train))
  );
}

function openSheet({kicker, title, body}) {
  document.getElementById("sheetKicker").textContent = kicker;
  document.getElementById("sheetTitle").textContent = title;
  document.getElementById("sheetBody").innerHTML = body;
  sheet.hidden = false;
  sheetBackdrop.hidden = false;
  requestAnimationFrame(() => {
    sheet.classList.add("open");
    sheetBackdrop.classList.add("open");
  });
}

function closeSheet() {
  sheet.classList.remove("open");
  sheetBackdrop.classList.remove("open");
  setTimeout(() => {
    sheet.hidden = true;
    sheetBackdrop.hidden = true;
  }, 180);
}
document.getElementById("sheetClose").addEventListener("click", closeSheet);
sheetBackdrop.addEventListener("click", closeSheet);

function connectionCards(stationName) {
  const items = connectionSamples[stationName] || [];
  if (!items.length) return "";
  return `
    <div class="sheet-section-title">つながる列車 <span>サンプル</span></div>
    <div class="connection-list compact">
      ${items.map(c => `
        <div class="connection-item">
          <strong>${c.time}</strong>
          <div><b>${c.line}</b><span>${c.destination}</span></div>
          <small>乗換 ${c.transferMinutes}分</small>
        </div>
      `).join("")}
    </div>
  `;
}

function stationDepartures(stationName) {
  const key = currentNaviDirection;
  const rows = (timetableData[stationName]?.[key] || []).slice(0, 4);
  if (!rows.length) return `<div class="empty-state">この方面の発車時刻はありません。</div>`;
  return `
    <div class="sheet-section-title">この駅からの次の列車</div>
    <div class="departure-list">
      ${rows.map(([time, kind]) => `<div><strong>${time}</strong><span>${kind}</span></div>`).join("")}
    </div>
  `;
}

function openStationSheet(stationName) {
  const special = stationName === "熊本";
  openSheet({
    kicker: special ? "CONNECTION HUB" : "STATION",
    title: `${stationName}駅`,
    body: `
      ${special ? `<div class="sheet-callout"><strong>熊本駅は「終点」ではなく、その先への入口。</strong><span>三角線の到着予定から、接続できる列車まで同じ画面で確認する想定です。</span></div>` : ""}
      ${stationDepartures(stationName)}
      ${connectionCards(stationName)}
      ${special ? `<button type="button" class="primary-sheet-btn" id="openConnectionView">接続画面を開く</button>` : ""}
    `
  });
  const c = document.getElementById("openConnectionView");
  if (c) c.addEventListener("click", () => { closeSheet(); setView(1); });
}

function openTrainSheet(trainId) {
  const t = loadedTrains.find(x => x.id === trainId);
  if (!t) return;
  openSheet({
    kicker: "TRAIN",
    title: `${t.id}${t.serviceName ? ` ${t.serviceName}` : ""}`,
    body: `
      <div class="train-sheet-hero">
        ${trainIllustration(t)}
        <div>
          <span class="status-pill ${statusClass(t)}">${statusText(t)}</span>
          <strong>${locationText(t)}</strong>
        </div>
      </div>
      <div class="detail-grid">
        <div><small>方面</small><strong>${t.direction}</strong></div>
        <div><small>次駅</small><strong>${isTerminalStopped(t) ? "—" : t.nextStation}</strong></div>
        <div><small>次駅到着予定</small><strong>${isTerminalStopped(t) ? "—" : nextTimeValue(t)}</strong></div>
        <div><small>列車番号</small><strong>${t.id}</strong></div>
      </div>
      <div class="sheet-callout subtle">
        <strong>時刻と位置を同時に表示</strong>
        <span>「今どこ？」と「何時に来る？」を別画面で確認しなくて済む設計です。</span>
      </div>
    `
  });
}

function renderConnectionView() {
  const list = document.getElementById("connectionList");
  list.innerHTML = (connectionSamples["熊本"] || []).map(c => `
    <article class="connection-item large">
      <strong>${c.time}</strong>
      <div>
        <b>${c.line}</b>
        <span>${c.destination}</span>
      </div>
      <small>乗換 ${c.transferMinutes}分</small>
    </article>
  `).join("");
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
  const lats = all.map(p => p[0]), lngs = all.map(p => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const pad = 34, width = 720, height = 500;
  const project = (lat, lng) => [
    pad + ((lng - minLng) / Math.max(.000001, maxLng - minLng)) * (width - pad * 2),
    pad + ((maxLat - lat) / Math.max(.000001, maxLat - minLat)) * (height - pad * 2)
  ];
  return {width, height, project};
}

function initMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl) return;
  const {width, height, project} = mapProjection();
  const routePoints = getRoutePoints().map(p => project(p[0], p[1]).join(",")).join(" ");
  const stationSvg = stations.map(s => {
    const [x,y] = project(s.lat, s.lng);
    const anchor = x > width * .72 ? "end" : "start";
    return `<g class="svg-station"><circle cx="${x}" cy="${y}" r="5.5"></circle>
      <text x="${x + (anchor === "end" ? -9 : 9)}" y="${y + 15}" text-anchor="${anchor}">${s.name}</text></g>`;
  }).join("");
  mapEl.innerHTML = `<svg id="routeSvgMap" class="svg-route-map" viewBox="0 0 ${width} ${height}" aria-label="熊本から三角までの路線図">
    <polyline class="svg-route-halo" points="${routePoints}"></polyline>
    <polyline class="svg-route-line" points="${routePoints}"></polyline>
    ${stationSvg}<g id="svgTrainLayer"></g></svg>`;
  mapReady = true;
}

function renderMap(trains) {
  if (!mapReady) initMap();
  const layer = document.getElementById("svgTrainLayer");
  if (!layer) return;
  const {project} = mapProjection();
  layer.innerHTML = trains.map(t => {
    const [x,y] = project(t.lat, t.lng);
    return `<g class="svg-train" transform="translate(${x} ${y})">
      <circle r="15" class="svg-train-circle"></circle>
      <text x="0" y="5" text-anchor="middle">🚃</text>
      <rect class="svg-train-label-bg" x="-43" y="-42" width="86" height="22" rx="11"></rect>
      <text class="svg-train-label" x="0" y="-27" text-anchor="middle">${t.id} ${statusText(t)}</text>
    </g>`;
  }).join("");
}

function initTimetable() {
  const select = document.getElementById("stationSelect");
  select.innerHTML = stations.map(s => `<option value="${s.name}">${s.name}</option>`).join("");
  select.value = "三角";
  select.addEventListener("change", renderTimetable);
  document.getElementById("toMisumiBtn").addEventListener("click", () => {
    currentTimetableDirection = "toMisumi"; syncDirectionButtons(); renderTimetable();
  });
  document.getElementById("toKumamotoBtn").addEventListener("click", () => {
    currentTimetableDirection = "toKumamoto"; syncDirectionButtons(); renderTimetable();
  });
  syncDirectionButtons();
  renderTimetable();
}

function syncDirectionButtons() {
  document.getElementById("toMisumiBtn").classList.toggle("active", currentTimetableDirection === "toMisumi");
  document.getElementById("toKumamotoBtn").classList.toggle("active", currentTimetableDirection === "toKumamoto");
}

function renderTimetable() {
  const station = document.getElementById("stationSelect").value;
  const rows = timetableData[station]?.[currentTimetableDirection] || [];
  document.getElementById("timetable").innerHTML = rows.length
    ? `<div class="timetable-list">${rows.map(([time,kind]) => `<div class="timetable-row"><strong>${time}</strong><span>${kind}</span></div>`).join("")}</div>`
    : `<div class="empty-state">この方面の列車はありません。</div>`;
}

document.querySelectorAll(".seg-btn").forEach(btn => btn.addEventListener("click", () => {
  currentNaviDirection = btn.dataset.direction;
  document.querySelectorAll(".seg-btn").forEach(b => b.classList.toggle("active", b === btn));
  renderNextTrains();
  renderVerticalRoute(loadedTrains);
}));

document.getElementById("favoriteStationBtn").addEventListener("click", () => openStationSheet(document.getElementById("favoriteStationName").textContent));

async function init() {
  loadedTrains = await loadTrainData();
  renderNextTrains();
  renderVerticalRoute(loadedTrains);
  renderConnectionView();
  initMap();
  renderMap(loadedTrains);
  initTimetable();

  setTimeout(() => {
    splashScreen.classList.add("hide");
    document.body.classList.remove("splash-active");
    setTimeout(() => splashScreen.remove(), 350);
  }, 1800);
}

init().catch(err => {
  console.error(err);
  document.body.classList.remove("splash-active");
});

// 切り替えるサイズとボタンの表示テキストのリスト
const fontScales = [
  { scale: 1.0,  label: '文字サイズ: 標準' },
  { scale: 1.2,  label: '文字サイズ: 大' },
  { scale: 0.85, label: '文字サイズ: 小' }
];

let currentScaleIndex = 0; // 初期状態（0 = 標準）

// ボタンとクリックイベントの設定
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('Mojibtn');

  if (btn) {
    btn.addEventListener('click', () => {
      // 次のサイズにインデックスを進める（最後までいったら0に戻る）
      currentScaleIndex = (currentScaleIndex + 1) % fontScales.length;

      const current = fontScales[currentScaleIndex];

      // 1. CSS変数を書き換えて文字サイズを変更
      document.documentElement.style.setProperty('--font-scale', current.scale);

      // 2. ボタンの表示テキストを変更
      btn.textContent = current.label;
    });
  }
});

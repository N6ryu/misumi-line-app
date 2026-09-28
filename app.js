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
// 1. 画面切り替え（スライド & アクティブ判定）
// --------------------------------------------------
function setView(index) {
  currentView = Math.max(0, Math.min(3, index));

  // 横スライド (-0%, -25%, -50%, -75%)
  const wrapper = document.querySelector(".views-wrapper");
  if (wrapper) {
    wrapper.style.transform = `translateX(-${currentView * 25}%)`;
  }

  // 下部ナビボタンの見た目更新
  const btns = document.querySelectorAll(".nav-btn");
  btns.forEach((b, i) => {
    b.classList.toggle("active", i === currentView);
  });

  document.body.dataset.view = String(currentView);

  // 3番目（地図）を開いたときは安全にマップ更新
  if (currentView === 2) {
    setTimeout(() => {
      if (typeof initMap === "function") initMap();
      if (typeof renderMap === "function") renderMap(loadedTrains);
    }, 40);
  }
}

// --------------------------------------------------
// 2. イベントリスナーの設定
// --------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  // ナビボタンタップ
  const btns = document.querySelectorAll(".nav-btn");
  btns.forEach((btn, index) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const target = btn.dataset.target !== undefined ? Number(btn.dataset.target) : index;
      setView(target);
    });
  });

  // 時刻表へジャンプボタン
  const jumpBtn = document.getElementById("jumpTimetableBtn");
  if (jumpBtn) {
    jumpBtn.addEventListener("click", () => setView(3));
  }

  // スワイプ移動
  let startX = 0;
  const mainArea = document.querySelector(".app-main");
  if (mainArea) {
    mainArea.addEventListener("touchstart", (e) => {
      startX = e.touches[0].clientX;
    }, { passive: true });

    mainArea.addEventListener("touchend", (e) => {
      const endX = e.changedTouches[0].clientX;
      const diffX = startX - endX;
      if (Math.abs(diffX) > 50) {
        if (diffX > 0 && currentView < 3) {
          setView(currentView + 1);
        } else if (diffX < 0 && currentView > 0) {
          setView(currentView - 1);
        }
      }
    }, { passive: true });
  }

  // 方面切り替えボタン
  document.querySelectorAll(".seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentNaviDirection = btn.dataset.direction;
      document.querySelectorAll(".seg-btn").forEach(b => b.classList.toggle("active", b === btn));
      if (typeof renderNextTrains === "function") renderNextTrains();
      if (typeof renderVerticalRoute === "function") renderVerticalRoute(loadedTrains);
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
      const current = fontScales[currentScaleIndex];
      document.documentElement.style.setProperty('--font-scale', current.scale);
      mojiBtn.textContent = current.label;
    });
  }
});

// --------------------------------------------------
// 3. 描画・補助関数（エラー防止ガード付き）
// --------------------------------------------------
function trainIllustration(train) {
  if (train.serviceKind === "ds" || /A列車/.test(train.serviceName || "")) {
    return `<img src="./assets/atrain-photo.png" alt="A列車で行こう" class="mini-train-photo" onerror="this.outerHTML='🚃'" />`;
  }
  return `<span class="mini-train-emoji" aria-hidden="true">🚃</span>`;
}

function statusClass(train) {
  if (typeof isTerminalStopped === "function" && isTerminalStopped(train)) return "arrived";
  if ((train.delayMinutes || 0) > 0) return "delay";
  return "normal";
}

function getVisibleOrder() {
  if (typeof stations === "undefined") return [];
  return currentNaviDirection === "toKumamoto" ? [...stations].reverse() : [...stations];
}

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

  const ordered = getVisibleOrder();
  let html = "";
  ordered.forEach((station, i) => {
    const isKumamoto = station.name === "熊本";
    html += `
      <button type="button" class="station-row ${isKumamoto ? "hub" : ""}" data-station="${station.name}">
        <span class="station-axis">
          <i class="station-dot"></i>
          ${i < ordered.length - 1 ? `<i class="station-line"></i>` : ""}
        </span>
        <span class="station-copy">
          <strong>${station.name}</strong>
          <small>発車時刻を見る <b>›</b></small>
        </span>
      </button>
    `;
  });
  route.innerHTML = html;
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

function initMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl || typeof stations === "undefined") return;
  mapEl.innerHTML = `<div style="padding:20px; text-anchor:middle;">🗺️ 三角線 路線図（表示準備完了）</div>`;
  mapReady = true;
}

function renderMap(trains) {}

function initTimetable() {
  const select = document.getElementById("stationSelect");
  if (!select || typeof stations === "undefined") return;
  select.innerHTML = stations.map(s => `<option value="${s.name}">${s.name}</option>`).join("");
}

// --------------------------------------------------
// 4. 初期化（データの読み込みエラーでも止まらない構造）
// --------------------------------------------------
async function init() {
  try {
    if (typeof loadTrainData === "function") {
      loadedTrains = await loadTrainData();
    }
  } catch (e) {
    console.warn("データファイルのロードに失敗しましたが処理を継続します", e);
  }

  // 安全に初期描画関数を呼び出し
  try { renderNextTrains(); } catch(e){}
  try { renderVerticalRoute(loadedTrains); } catch(e){}
  try { renderConnectionView(); } catch(e){}
  try { initMap(); } catch(e){}
  try { initTimetable(); } catch(e){}

  // スプラッシュ画面の非表示処理
  if (splashScreen) {
    setTimeout(() => {
      splashScreen.classList.add("hide");
      document.body.classList.remove("splash-active");
      setTimeout(() => splashScreen.remove(), 350);
    }, 1200);
  }
}

init();

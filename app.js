let selectedStation = null, loadedTrains = [], currentView = 0;
let currentSubView = "position"; // ★追加：1P内のサブビュー状態

// (中略... 変数宣言などはそのまま)

// ★追加：1P内のサブ切り替え設定
const subNavBtns = document.querySelectorAll('.sub-nav-btn');
const subViews = {
  position: document.getElementById('subViewPosition'),
  map: document.getElementById('subViewMap')
};

subNavBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    currentSubView = btn.dataset.sub;
    
    // タブの見た目更新
    subNavBtns.forEach(b => b.classList.toggle('active', b.dataset.sub === currentSubView));
    // 表示内容更新
    Object.keys(subViews).forEach(k => {
      if(subViews[k]) subViews[k].style.display = k === currentSubView ? 'block' : 'none';
    });
    
    updateDynamicBg(currentView); // 背景も連動して切り替え

    // 地図が開かれたときの再描画
    if (currentSubView === "map") {
      setTimeout(() => {
        resetSimpleMapToRoute();
        renderSimpleMap();
      }, 80);
    } else {
      if(selectedStation) setTimeout(()=>scrollToSelectedStation(false),80);
    }
  });
});

// 背景切り替えロジックの修正
function updateDynamicBg(viewType) {
  if (!fixedBg) return;
  fixedBg.className = "gate-fixed-bg"; 
  if (viewType === "gate") {
    fixedBg.classList.add("bg-gate");
  } else if (viewType === 0) {
    // 1Pはサブビューによって背景を変える
    if (currentSubView === "position") {
      fixedBg.classList.add("bg-position");
    } else {
      fixedBg.classList.add("bg-map");
    }
  } else if (viewType === 1) {
    fixedBg.classList.add("bg-timetable"); // 2Pが時刻表
  } else if (viewType === 2) {
    fixedBg.classList.add("bg-board");     // 3Pが掲示板
  }
}

// setView関数の修正
function setView(i){
  currentView = Math.max(0, Math.min(2, i));
  gate.hidden = true;
  views.forEach((v, n) => v.classList.toggle("active", n === currentView));
  navButtons.forEach((b, n) => b.classList.toggle("active", n === currentView));
  
  updateDynamicBg(currentView);

  // 1P表示時
  if(currentView === 0) {
    if(currentSubView === "position" && selectedStation) {
      setTimeout(()=>scrollToSelectedStation(false),80);
    } else if (currentSubView === "map") {
      setTimeout(()=>{
        resetSimpleMapToRoute();
        renderSimpleMap();
      },80);
    }
  }
  // 2P表示時（時刻表）
  if(currentView === 1){
    if(selectedStation) setTimetableStation(selectedStation);
    renderTimetable();
  }
  // 3P表示時（掲示板）は特別な処理なし
}

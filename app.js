let selectedStation=null,loadedTrains=[],currentView=0;
let positionDisplayMode = "list"; // "list" または "map"
let simpleMapState={
  zoom:10,
  centerLat:32.700,
  centerLng:130.585,
  dragging:false,
  startX:0,
  startY:0,
  startCenterPx:null
};

/* 各メニュー（タブ）ごとのスポット・注釈説明データ */
const menuSpotData = {
  0: {
    icon: "📍",
    title: "三角駅",
    desc: "海に面した終着駅。海と一緒に電車を待てる。"
  },
  1: {
    icon: "🖼️",
    title: "あじさいとA列車で行こう",
    desc: "沿線に咲く綺麗なあじさいを見に、A列車で行こう。"
  },
  2: {
    icon: "📍",
    title: "長部田海床路",
    desc: "潮の満ち引きで姿を変える、海へ続く道。"
  }
};

/* 各駅の周辺情報データ（image に assets 内の写真パスを指定） */
const stationAreaInfo = {
  "三角": {
    image: "./assets/spot-misumi.jpg",
    tag: "終着駅・海辺の港町",
    spot: "三角駅・三角西港・海のピラミッド",
    desc: "海に面した終着駅。駅前すぐの「海のピラミッド」からは天草の海が一望でき、世界文化遺産の「三角西港」へもバスや徒歩でアクセスできます。",
    access: "駅前すぐ三角港フェリー乗り場・バス停あり"
  },
  "波多浦": {
    image: "./assets/spot-hataura.jpg",
    tag: "海沿いの無人駅",
    spot: "波多浦海岸・三角東港エリア",
    desc: "三角の町並みと海に近い静かな駅。駅から少し歩くと穏やかな入り江が広がり、潮風を感じながら散策できます。",
    access: "三角港・三角市街地まで徒歩圏内"
  },
  "石打ダム": {
    image: "./assets/spot-ishiuchidam.jpg",
    tag: "自然とダムの駅",
    spot: "石打ダム・石打ダム資料館",
    desc: "緑豊かな山あいに位置する駅。春は桜、初夏は新緑やあじさいが美しく、のんびりとした風景が広がります。",
    access: "石打ダム公園まで徒歩約15分"
  },
  "赤瀬": {
    image: "./assets/spot-akase.jpg",
    tag: "海と山の絶景駅",
    spot: "赤瀬海水浴場・御輿来海岸方面",
    desc: "山と海に挟まれた小さな駅。すぐそばに海が迫り、天気が良い日は有明海越しに雲仙普賢岳を望めます。",
    access: "赤瀬海岸まで徒歩すぐ"
  },
  "網田": {
    image: "./assets/spot-oda.jpg",
    tag: "県内最古の木造駅舎",
    spot: "網田駅舎（登録有形文化財）・御輿来海岸",
    desc: "明治32年建築の熊本県内最古の木造駅舎が残るレトロな駅。日本の渚百選「御輿来（おこしき）海岸」の干潟絶景への最寄り駅です。",
    access: "御輿来海岸展望所まで車で約5分（徒歩約25分）"
  },
  "肥後長浜": {
    image: "./assets/spot-higonagahama.jpg",
    tag: "有明海沿いの駅",
    spot: "長浜海岸・国道57号沿線",
    desc: "ホームから有明海を間近に望める海辺の駅。夕暮れ時には海面に沈む美しい夕日を見ることができます。",
    access: "海沿いの散策やサイクリングの拠点"
  },
  "住吉": {
    image: "./assets/spot-sumiyoshi.jpg",
    tag: "長部田海床路の最寄り駅",
    spot: "長部田海床路・住吉自然公園",
    desc: "海の中に電柱が立ち並ぶ絶景スポット「長部田海床路（ながべたかいしょうろ）」の最寄り駅。初夏には住吉自然公園のあじさいも見頃を迎えます。",
    access: "長部田海床路まで徒歩約15〜20分"
  },
  "緑川": {
    image: "./assets/spot-midorikawa.jpg",
    tag: "緑川河口ののどかな駅",
    spot: "緑川河口・田園エリア",
    desc: "一級河川・緑川の近くにある落ち着いた住宅・田園エリアの駅。広々とした空と田畑の風景が続きます。",
    access: "緑川堤防沿いの散策ルート近く"
  },
  "宇土": {
    image: "./assets/spot-uto.jpg",
    tag: "鹿児島本線との接続駅",
    spot: "宇土シティモール・宇土市街地",
    desc: "JR鹿児島本線と三角線が分岐する交通の要所。駅周辺には商業施設や飲食店が揃い、熊本駅方面への乗り換えもスムーズです。",
    access: "JR鹿児島本線（熊本・八代方面）乗り換え駅"
  }
};

/* 各メニューのカード文面を更新する関数 */
function updateMenuSpotCards() {
  const setIfExist = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  const pData = menuSpotData[0];
  if (pData) {
    setIfExist("spotIconPosition", pData.icon);
    setIfExist("spotTitlePosition", pData.title);
    setIfExist("spotDescPosition", pData.desc);
  }
  const tData = menuSpotData[1];
  if (tData) {
    setIfExist("spotIconTimetable", tData.icon);
    setIfExist("spotTitleTimetable", tData.title);
    setIfExist("spotDescTimetable", tData.desc);
  }
  const eData = menuSpotData[2];
  if (eData) {
    setIfExist("spotIconEvent", eData.icon);
    setIfExist("spotTitleEvent", eData.title);
    setIfExist("spotDescEvent", eData.desc);
  }
}

const gate=document.getElementById("stationGate");
const views=[...document.querySelectorAll(".view")];
const navButtons=[...document.querySelectorAll(".nav-btn[data-target]")];
const bottomNav=document.getElementById("bottomNav");
const stationFab=document.getElementById("stationFab");
const sheet=document.getElementById("bottomSheet");
const backdrop=document.getElementById("sheetBackdrop");
const stationModal=document.getElementById("stationModal");
const stationModalBackdrop=document.getElementById("stationModalBackdrop");
const fixedBg=document.getElementById("fixedBg");

const toggleListBtn = document.getElementById("toggleListBtn");
const toggleMapBtn = document.getElementById("toggleMapBtn");
const dualRoute = document.getElementById("dualRoute");
const routeColumnsHead = document.getElementById("routeColumnsHead");
const mapContainer = document.getElementById("mapContainer");

// 表示切替（リスト ↔ 地図）
function setPositionDisplayMode(mode) {
  positionDisplayMode = mode;
  if (mode === "list") {
    toggleListBtn?.classList.add("active");
    toggleMapBtn?.classList.remove("active");
    if (dualRoute) dualRoute.hidden = false;
    if (routeColumnsHead) routeColumnsHead.style.display = "grid";
    if (mapContainer) mapContainer.hidden = true;
    if (selectedStation) setTimeout(() => scrollToSelectedStation(false), 80);
  } else {
    toggleMapBtn?.classList.add("active");
    toggleListBtn?.classList.remove("active");
    if (dualRoute) dualRoute.hidden = true;
    if (routeColumnsHead) routeColumnsHead.style.display = "none";
    if (mapContainer) mapContainer.hidden = false;

    const scroller = document.getElementById("positionScroller");
    if (scroller) scroller.scrollTo({ top: 0, behavior: "auto" });

    setTimeout(() => {
      resetSimpleMapToRoute();
      renderSimpleMap();
    }, 80);
  }
}

if (toggleListBtn && toggleMapBtn) {
  toggleListBtn.addEventListener("click", () => setPositionDisplayMode("list"));
  toggleMapBtn.addEventListener("click", () => setPositionDisplayMode("map"));
}

function updateDynamicBg(viewType) {
  if (!fixedBg) return;
  fixedBg.className = "gate-fixed-bg";
  if (viewType === "gate" || viewType === 0) {
    fixedBg.classList.add("bg-gate");
  } else if (viewType === 1) {
    fixedBg.classList.add("bg-timetable");
  } else if (viewType === 2) {
    fixedBg.classList.add("bg-event");
  }
}

function setView(i){
  currentView=Math.max(0,Math.min(2,i));
  if (gate) gate.hidden=true;
  views.forEach((v,n)=>v.classList.toggle("active",n===currentView));
  navButtons.forEach((b,n)=>b.classList.toggle("active",n===currentView));
  
  updateDynamicBg(currentView);

  if(currentView===0){
    if(positionDisplayMode==="list" && selectedStation) setTimeout(()=>scrollToSelectedStation(false),80);
    if(positionDisplayMode==="map"){
      const scroller = document.getElementById("positionScroller");
      if (scroller) scroller.scrollTo({ top: 0, behavior: "auto" });
      setTimeout(()=>{ resetSimpleMapToRoute(); renderSimpleMap(); },80);
    }
  }
  if(currentView===1){
    if(selectedStation) setTimetableStation(selectedStation);
    renderTimetable();
  }
}
navButtons.forEach(b=>b.addEventListener("click",()=>setView(Number(b.dataset.target))));

function showGate(){
  views.forEach(v=>v.classList.remove("active"));
  document.querySelectorAll("#stationGrid .station-picked").forEach(b=>b.classList.remove("station-picked"));
  if (gate) {
    gate.classList.remove("gate-leaving");
    gate.hidden=false;
  }
  if (bottomNav) bottomNav.hidden=true;
  if (stationFab) stationFab.hidden=true;
  updateDynamicBg("gate");
}

function stationButtonHTML(s){
  return `<button class="station-pick-btn" data-station="${s.name}">
    <span class="station-mark"></span><strong>${s.name}</strong>
  </button>`;
}

function renderStationGrid(){
  if (typeof stations === "undefined") return;
  const e=document.getElementById("stationGrid");
  if (e) {
    e.innerHTML=stations.map(stationButtonHTML).join("");
    e.querySelectorAll("[data-station]").forEach(b=>b.addEventListener("click",()=>selectStation(b.dataset.station)));
  }

  const tt=document.getElementById("ttStationGrid");
  if (tt) {
    tt.innerHTML=stations.map(stationButtonHTML).join("");
    tt.querySelectorAll("[data-station]").forEach(b=>b.addEventListener("click",()=>{
      const stationName = b.dataset.station;
      setTimetableStation(stationName);

      tt.querySelectorAll(".station-picked").forEach(btn=>btn.classList.remove("station-picked"));
      b.classList.add("station-picked");

      setTimeout(()=>{
        closeStationModal();
      },150);
    }));
  }
}

function selectStation(name){
  selectedStation=name;
  setTimetableStation(name);
  renderDualRoute();
  if(positionDisplayMode==="map") renderSimpleMap();

  document.querySelectorAll("#stationGrid .station-picked").forEach(b=>b.classList.remove("station-picked"));
  const selectedBtn=document.querySelector(`#stationGrid [data-station="${name}"]`);
  if(selectedBtn) selectedBtn.classList.add("station-picked");

  if(gate && gate.hidden) return;

  // 0.15秒だけ青色のボタンを表示してから、1.2秒かけてゆっくり切り替え
  setTimeout(()=>{
    if (bottomNav) bottomNav.hidden=false;
    if (stationFab) stationFab.hidden=false;

    currentView=0;
    views.forEach((v,n)=>v.classList.toggle("active",n===0));
    navButtons.forEach((b,n)=>b.classList.toggle("active",n===0));
    updateDynamicBg(0);

    const positionView=document.getElementById("viewPosition");
    positionView?.classList.add("view-arriving");

    if(positionDisplayMode==="list"){
      scrollToSelectedStation(false);
    }else if(positionDisplayMode==="map"){
      const scroller = document.getElementById("positionScroller");
      if (scroller) scroller.scrollTo({ top: 0, behavior: "auto" });
      resetSimpleMapToRoute();
      renderSimpleMap();
    }

    gate?.classList.add("gate-leaving");
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>positionView?.classList.add("view-arriving-active"));
    });

    setTimeout(()=>{
      if (gate) {
        gate.hidden=true;
        gate.classList.remove("gate-leaving");
      }
      positionView?.classList.remove("view-arriving","view-arriving-active");
      if(selectedBtn) selectedBtn.classList.remove("station-picked");
    },1250);
  },150);
}

function scrollToSelectedStation(smooth=true){
  if(!selectedStation)return;
  const scroller=document.getElementById("positionScroller");
  const target=document.querySelector(`.route-node[data-station="${selectedStation}"]`);
  if(!scroller||!target)return;
  const sr=scroller.getBoundingClientRect(),tr=target.getBoundingClientRect();
  const desired=tr.top-sr.top+scroller.scrollTop-(scroller.clientHeight*.46)+(tr.height/2);
  scroller.scrollTo({top:Math.max(0,desired),behavior:smooth?"smooth":"auto"});
}

const routeSide=t=>(t.derivedDirection||t.rawDirection)==="上り"?"up":"down";

function trainChip(t){
  const side=routeSide(t);
  const icon=side==="up"?"./assets/student_train.gif?v=40":"./assets/student_train.gif?v=40";
  const state=t.operationalState==="出発待ち"?`出発待ち ${t.inferredDeparture||""}`.trim():t.nickname;
  return `<button class="track-train ${side} ${t.operationalState==="出発待ち"?"waiting":""}" data-train="${t.id}">
    <img class="train-gif" src="${icon}" alt="${side==="up"?"上り":"下り"}列車">
    <span class="train-chip-copy"><strong>${t.id}</strong><small>${state}</small></span>
  </button>`;
}

function renderDualRoute(){
  const e=document.getElementById("dualRoute");
  if (!e || typeof stations === "undefined") return;
  let h="";
  stations.forEach((s,i)=>{
    const at=loadedTrains.filter(t=>{
      if(t.currentStation===t.nextStation)return t.currentStation===s.name;
      return t.positionIndex>=i&&t.positionIndex<i+1;
    });
    const left=at.filter(t=>routeSide(t)==="up");
    const right=at.filter(t=>routeSide(t)==="down");
    h+=`<div class="route-node ${s.name===selectedStation?"selected":""}" data-station="${s.name}">
      <div class="side left">${left.map(trainChip).join("")}</div>
      <button class="center-station" data-station-button="${s.name}"><i></i><strong>${s.name}</strong></button>
      <div class="side right">${right.map(trainChip).join("")}</div>
    </div>`;
  });
  e.innerHTML=h;
  e.querySelectorAll("[data-train]").forEach(b=>b.addEventListener("click",()=>openTrainDetail(b.dataset.train)));
  e.querySelectorAll("[data-station-button]").forEach(b=>b.addEventListener("click",()=>openStationInfo(b.dataset.stationButton)));
}

function openSheet(title,body){
  const titleEl = document.getElementById("sheetTitle");
  const bodyEl = document.getElementById("sheetBody");
  if (!titleEl || !bodyEl || !sheet || !backdrop) return;
  titleEl.textContent=title;
  bodyEl.innerHTML=body;
  sheet.hidden=false;backdrop.hidden=false;
  requestAnimationFrame(()=>{sheet.classList.add("open");backdrop.classList.add("open")});
}
function closeSheet(){
  if (!sheet || !backdrop) return;
  sheet.classList.remove("open");backdrop.classList.remove("open");
  setTimeout(()=>{sheet.hidden=true;backdrop.hidden=true},180);
}
document.getElementById("sheetClose")?.addEventListener("click",closeSheet);
backdrop?.addEventListener("click",closeSheet);

/* 各駅の丸いアイコンを押したときの周辺情報シート（一番上に風景写真） */
function openStationInfo(name){
  const info = stationAreaInfo[name] || {
    image: "",
    tag: "JR三角線（あまくさみすみ線）",
    spot: `${name}駅周辺エリア`,
    desc: `${name}駅の周辺情報です。`,
    access: "JR三角線"
  };

  const photoHtml = info.image ? `
    <div class="station-spot-photo-wrap">
      <img class="station-spot-photo" src="${info.image}" alt="${name}駅周辺の風景" onerror="this.parentElement.style.display='none'">
    </div>
  ` : "";

  openSheet(`${name}駅 周辺情報`, `
    ${photoHtml}
    <div class="station-spot-box">
      <span class="station-spot-tag">${info.tag}</span>
      <h3>📍 ${info.spot}</h3>
      <p>${info.desc}</p>
    </div>
    <div class="train-detail-summary">
      <div><span>アクセス・特徴</span><strong>${info.access}</strong></div>
    </div>
    <div class="station-action-row">
      <button class="station-action-btn primary" id="sheetSelectStationBtn">この駅を現在地に設定</button>
      <button class="station-action-btn secondary" id="sheetTimetableStationBtn">この駅の時刻表を見る</button>
    </div>
  `);

  document.getElementById("sheetSelectStationBtn")?.addEventListener("click", () => {
    selectedStation = name;
    setTimetableStation(name);
    renderDualRoute();
    if (positionDisplayMode === "map") renderSimpleMap();
    closeSheet();
    if (positionDisplayMode === "list") setTimeout(() => scrollToSelectedStation(true), 200);
  });

  document.getElementById("sheetTimetableStationBtn")?.addEventListener("click", () => {
    selectedStation = name;
    setTimetableStation(name);
    renderDualRoute();
    closeSheet();
    setTimeout(() => setView(1), 180);
  });
}

function openTrainDetail(id){
  const t=loadedTrains.find(x=>x.id===id);if(!t)return;
  const rows=t.timetable.map((r,i)=>{
    const isStart=i===0&&t.operationalState==="出発待ち";
    const final=i===t.timetable.length-1&&!isStart;
    const time=isStart?(r.departure||r.arrival):(final?(r.arrival||r.departure):(r.departure||r.arrival));
    return `<div class="schedule-row ${final?"final":""}">
      <span class="schedule-dot"></span>
      <div><strong>${r.station}</strong><small>${isStart?"出発待ち":(final?"終着":"停車駅")}</small></div>
      <b>${time||"—"}</b><em>${isStart?"発":(final?"着":"発")}</em>
    </div>`;
  }).join("");
  openSheet(`${t.id} ${t.nickname}`,`
    <div class="train-detail-summary">
      <div><span>現在位置</span><strong>${t.currentStation===t.nextStation?t.currentStation+"駅":t.currentStation+" → "+t.nextStation}</strong></div>
      <div><span>方面</span><strong>${t.displayDirection}</strong></div>
      <div><span>状態</span><strong>${t.operationalState}</strong></div>
    </div>
    <h3 class="sheet-subtitle">ここから終着駅までの予定</h3>
    <div class="remaining-schedule">${rows}</div>
    ${t.operationalState==="出発待ち"?'<div class="inference-note"><strong>判定：</strong>ビーコン発信から5分以上経過し、三角駅に停車したままのため「上り・出発待ち」と判定しています。</div>':""}
    <p class="source-note">${t.timetableNote}</p>`);
}

// Simple Map
const TILE_SIZE=256;
function lonToWorldX(lon,zoom){ return ((lon+180)/360)*TILE_SIZE*Math.pow(2,zoom); }
function latToWorldY(lat,zoom){ const sin=Math.sin(lat*Math.PI/180); return (0.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*TILE_SIZE*Math.pow(2,zoom); }
function worldXToLon(x,zoom){ return x/(TILE_SIZE*Math.pow(2,zoom))*360-180; }
function worldYToLat(y,zoom){ const n=Math.PI-2*Math.PI*y/(TILE_SIZE*Math.pow(2,zoom)); return 180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n))); }

function routeBounds(){
  if (typeof stations === "undefined") return { minLat:32.6, maxLat:32.8, minLng:130.4, maxLng:130.7 };
  const lats=stations.map(s=>s.lat), lngs=stations.map(s=>s.lng);
  return { minLat:Math.min(...lats), maxLat:Math.max(...lats), minLng:Math.min(...lngs), maxLng:Math.max(...lngs) };
}

function resetSimpleMapToRoute(){
  const el=document.getElementById("simpleMap");
  if(!el)return;
  const b=routeBounds(), width=Math.max(280,el.clientWidth), height=Math.max(360,el.clientHeight), pad=34;
  let chosen=9;
  for(let z=13;z>=7;z--){
    const x1=lonToWorldX(b.minLng,z),x2=lonToWorldX(b.maxLng,z);
    const y1=latToWorldY(b.maxLat,z),y2=latToWorldY(b.minLat,z);
    if((x2-x1)<=width-pad*2 && (y2-y1)<=height-pad*2){ chosen=z;break; }
  }
  simpleMapState.zoom=chosen;
  simpleMapState.centerLat=(b.minLat+b.maxLat)/2;
  simpleMapState.centerLng=(b.minLng+b.maxLng)/2;
}

function mapScreenPoint(lat,lng){
  const el=document.getElementById("simpleMap");
  const z=simpleMapState.zoom;
  const cx=lonToWorldX(simpleMapState.centerLng,z), cy=latToWorldY(simpleMapState.centerLat,z);
  return { x:lonToWorldX(lng,z)-cx+el.clientWidth/2, y:latToWorldY(lat,z)-cy+el.clientHeight/2 };
}

function renderTiles(){
  const el=document.getElementById("simpleMap"), layer=document.getElementById("mapTiles");
  if(!el||!layer)return;
  const z=simpleMapState.zoom;
  const cx=lonToWorldX(simpleMapState.centerLng,z), cy=latToWorldY(simpleMapState.centerLat,z);
  const left=cx-el.clientWidth/2, top=cy-el.clientHeight/2, right=cx+el.clientWidth/2, bottom=cy+el.clientHeight/2;
  const minTX=Math.floor(left/TILE_SIZE)-1, maxTX=Math.floor(right/TILE_SIZE)+1;
  const minTY=Math.floor(top/TILE_SIZE)-1, maxTY=Math.floor(bottom/TILE_SIZE)+1;
  const maxTile=Math.pow(2,z);
  let html="";
  for(let tx=minTX;tx<=maxTX;tx++){
    for(let ty=minTY;ty<=maxTY;ty++){
      if(ty<0||ty>=maxTile)continue;
      const wrappedX=((tx%maxTile)+maxTile)%maxTile;
      const x=tx*TILE_SIZE-left, y=ty*TILE_SIZE-top;
      html+=`<img class="osm-tile" src="https://tile.openstreetmap.org/${z}/${wrappedX}/${ty}.png" style="left:${x}px;top:${y}px" alt="">`;
    }
  }
  layer.innerHTML=html;
}

function renderRouteAndMarkers(){
  const svg=document.getElementById("mapRouteSvg"), markers=document.getElementById("mapMarkers"), map=document.getElementById("simpleMap");
  if(!svg||!markers||!map||typeof stations==="undefined")return;
  svg.setAttribute("viewBox",`0 0 ${map.clientWidth} ${map.clientHeight}`);
  svg.setAttribute("width",map.clientWidth);
  svg.setAttribute("height",map.clientHeight);

  const defs = `
    <defs>
      <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0b72d9" />
        <stop offset="52%" stop-color="#2497f1" />
        <stop offset="100%" stop-color="#58b8f6" />
      </linearGradient>
    </defs>
  `;

  const stationSvg=stations.map(s=>{
    const p=mapScreenPoint(s.lat,s.lng);
    const isSelected = s.name === selectedStation;
    return `<g class="map-station-group ${isSelected ? "selected" : ""}" data-station-map="${s.name}">
      <circle cx="${p.x}" cy="${p.y}" r="${isSelected ? 12 : 9}" class="map-station-icon-ring"></circle>
      <circle cx="${p.x}" cy="${p.y}" r="${isSelected ? 5.5 : 4.5}" class="map-station-icon-core"></circle>
      <text x="${p.x + (isSelected ? 14 : 11)}" y="${p.y - 7}" class="map-station-label">${s.name}</text>
    </g>`;
  }).join("");

  svg.innerHTML = defs + stationSvg;

  // 地図上の駅丸マーカーをクリックしたときも周辺情報を表示
  svg.querySelectorAll("[data-station-map]").forEach(g => {
    g.addEventListener("click", e => {
      e.stopPropagation();
      openStationInfo(g.dataset.stationMap);
    });
  });

  markers.innerHTML=loadedTrains.map(t=>{
    const p=mapScreenPoint(t.latitude,t.longitude);
    const side=routeSide(t);
    const icon=side==="up"?"./assets/student_train.gif?v=40":"./assets/student_train.gif?v=40";
    const label=t.operationalState==="出発待ち" ? `出発待ち ${t.inferredDeparture||""}`.trim() : t.id;
    return `<button class="simple-train-marker" data-train="${t.id}" style="left:${p.x}px;top:${p.y}px">
      <img src="${icon}" alt="${t.id}">
      <span>${label}</span>
    </button>`;
  }).join("");

  markers.querySelectorAll("[data-train]").forEach(b=>b.addEventListener("click",e=>{
    e.stopPropagation();
    openTrainDetail(b.dataset.train);
  }));
}

function renderSimpleMap(){ renderTiles(); renderRouteAndMarkers(); }
function zoomSimpleMap(delta){ simpleMapState.zoom=Math.max(7,Math.min(15,simpleMapState.zoom+delta)); renderSimpleMap(); }

function getTouchDistance(t1, t2) {
  return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
}

function setupSimpleMapInteraction(){
  const map=document.getElementById("simpleMap");
  if(!map)return;

  let pinchStartDist = 0;
  let isPinching = false;

  // 二本指（ピンチイン・ピンチアウト）ズーム処理
  map.addEventListener("touchstart", e => {
    if (e.touches.length === 2) {
      isPinching = true;
      simpleMapState.dragging = false;
      pinchStartDist = getTouchDistance(e.touches[0], e.touches[1]);
    }
  }, { passive: true });

  map.addEventListener("touchmove", e => {
    if (isPinching && e.touches.length === 2) {
      e.preventDefault();
      const currentDist = getTouchDistance(e.touches[0], e.touches[1]);
      if (pinchStartDist > 0) {
        const ratio = currentDist / pinchStartDist;
        if (ratio >= 1.25) {
          zoomSimpleMap(1);
          pinchStartDist = currentDist;
        } else if (ratio <= 0.8) {
          zoomSimpleMap(-1);
          pinchStartDist = currentDist;
        }
      }
    }
  }, { passive: false });

  map.addEventListener("touchend", e => {
    if (e.touches.length < 2) {
      isPinching = false;
      pinchStartDist = 0;
    }
  }, { passive: true });

  // 1本指・マウスでのドラッグ移動処理
  map.addEventListener("pointerdown",e=>{
    if (isPinching || e.target.closest(".map-controls, button, .map-station-group")) return;
    simpleMapState.dragging=true;
    simpleMapState.startX=e.clientX; simpleMapState.startY=e.clientY;
    simpleMapState.startCenterPx={
      x:lonToWorldX(simpleMapState.centerLng,simpleMapState.zoom),
      y:latToWorldY(simpleMapState.centerLat,simpleMapState.zoom)
    };
    map.setPointerCapture(e.pointerId);
  });
  map.addEventListener("pointermove",e=>{
    if(!simpleMapState.dragging || isPinching)return;
    const dx=e.clientX-simpleMapState.startX, dy=e.clientY-simpleMapState.startY;
    const cx=simpleMapState.startCenterPx.x-dx, cy=simpleMapState.startCenterPx.y-dy;
    simpleMapState.centerLng=worldXToLon(cx,simpleMapState.zoom);
    simpleMapState.centerLat=worldYToLat(cy,simpleMapState.zoom);
    renderSimpleMap();
  });
  map.addEventListener("pointerup",()=>simpleMapState.dragging=false);
  map.addEventListener("pointercancel",()=>simpleMapState.dragging=false);
  map.addEventListener("wheel",e=>{ e.preventDefault(); zoomSimpleMap(e.deltaY<0?1:-1); },{passive:false});

  document.getElementById("mapZoomIn")?.addEventListener("click",e=>{ e.stopPropagation(); zoomSimpleMap(1); });
  document.getElementById("mapZoomOut")?.addEventListener("click",e=>{ e.stopPropagation(); zoomSimpleMap(-1); });
  document.getElementById("mapReset")?.addEventListener("click",e=>{ e.stopPropagation(); resetSimpleMapToRoute(); renderSimpleMap(); });

  window.addEventListener("resize",()=>{
    if(currentView===0 && positionDisplayMode==="map"){ resetSimpleMapToRoute(); renderSimpleMap(); }
  });
}

// 時刻表
let timetableStation="三角";
function setTimetableStation(name){
  timetableStation=name;
  const el = document.getElementById("ttStationName");
  if (el) el.textContent=name;
  renderTimetable();
}
function renderTimetable(){
  const ttRowsEl = document.getElementById("timetableRows");
  if (!ttRowsEl) return;
  const data=(typeof timetableData !== 'undefined' && timetableData[timetableStation]) ? timetableData[timetableStation] : {up:[],down:[]};
  const hours={};
  for(let h=5;h<=23;h++) hours[h]={up:[],down:[]};

  function pushItems(items,side){
    if(!items) return;
    for(const item of items){
      const [hh,mm]=item.time.split(":");
      const h=Number(hh);
      if(!hours[h]) hours[h]={up:[],down:[]};
      hours[h][side].push({minute:mm,label:item.label||""});
    }
  }
  pushItems(data.up,"up"); pushItems(data.down,"down");

  const rows=Object.entries(hours)
    .filter(([,v])=>v.up.length||v.down.length)
    .map(([hour,v])=>`
      <div class="hour-row">
        <div class="minute-side up">
          ${v.up.length ? v.up.map(x=>`
            <div class="minute-entry" title="${x.label}">
              <strong>${x.minute}</strong>${x.label ? `<small>${x.label}</small>` : ""}
            </div>`).join("") : '<span class="no-train">—</span>'}
        </div>
        <div class="hour-center">${hour}</div>
        <div class="minute-side down">
          ${v.down.length ? v.down.map(x=>`
            <div class="minute-entry" title="${x.label}">
              <strong>${x.minute}</strong>${x.label ? `<small>${x.label}</small>` : ""}
            </div>`).join("") : '<span class="no-train">—</span>'}
        </div>
      </div>`).join("");

  ttRowsEl.innerHTML=rows || '<div class="tt-empty">表示できる時刻がありません。</div>';
}

function openStationModal(){
  if (!stationModal || !stationModalBackdrop) return;
  const tt=document.getElementById("ttStationGrid");
  if(tt){
    tt.querySelectorAll(".station-picked").forEach(btn=>btn.classList.remove("station-picked"));
    const currentBtn=tt.querySelector(`[data-station="${timetableStation}"]`);
    if(currentBtn) currentBtn.classList.add("station-picked");
  }
  stationModal.hidden=false;stationModalBackdrop.hidden=false;
  requestAnimationFrame(()=>{stationModal.classList.add("open");stationModalBackdrop.classList.add("open")});
}
function closeStationModal(){
  if (!stationModal || !stationModalBackdrop) return;
  stationModal.classList.remove("open");stationModalBackdrop.classList.remove("open");
  setTimeout(()=>{stationModal.hidden=true;stationModalBackdrop.hidden=true},160);
}
document.getElementById("ttStationButton")?.addEventListener("click",openStationModal);
document.getElementById("stationModalClose")?.addEventListener("click",closeStationModal);
stationModalBackdrop?.addEventListener("click",closeStationModal);

let swipeStartX=0,swipeStartY=0,swipeTracking=false;
function shouldIgnoreSwipe(target){
  return !!target.closest(".simple-map,.bottom-sheet,.station-modal,button,a,input,select,textarea");
}
function setupContentSwipe(){
  const main=document.querySelector(".app-main");
  if(!main)return;
  main.addEventListener("touchstart",e=>{
    if(gate && !gate.hidden)return;
    if(e.touches.length!==1 || shouldIgnoreSwipe(e.target)){swipeTracking=false;return;}
    swipeTracking=true;
    swipeStartX=e.touches[0].clientX;
    swipeStartY=e.touches[0].clientY;
  },{passive:true});
  main.addEventListener("touchend",e=>{
    if(!swipeTracking || !e.changedTouches.length)return;
    swipeTracking=false;
    const dx=e.changedTouches[0].clientX-swipeStartX;
    const dy=e.changedTouches[0].clientY-swipeStartY;
    if(Math.abs(dx)<70 || Math.abs(dx)<Math.abs(dy)*1.25)return;
    if(dx<0 && currentView<2) animateSwipeTo(currentView+1,"left");
    if(dx>0 && currentView>0) animateSwipeTo(currentView-1,"right");
  },{passive:true});
}
function animateSwipeTo(next,direction){
  const current=views[currentView];
  current.classList.add(direction==="left"?"swipe-exit-left":"swipe-exit-right");
  setTimeout(()=>{
    current.classList.remove("swipe-exit-left","swipe-exit-right");
    setView(next);
    const incoming=views[next];
    incoming.classList.add(direction==="left"?"swipe-enter-right":"swipe-enter-left");
    requestAnimationFrame(()=>incoming.classList.add("swipe-enter-active"));
    setTimeout(()=>incoming.classList.remove("swipe-enter-right","swipe-enter-left","swipe-enter-active"),320);
  },150);
}

stationFab?.addEventListener("click",showGate);

const scales=[{s:1,l:"文字：標準"},{s:1.3,l:"文字：大"},{s:.9,l:"文字：小"}];
let scaleIndex=0;
document.getElementById("fontBtn")?.addEventListener("click",()=>{
  scaleIndex=(scaleIndex+1)%scales.length;
  document.documentElement.style.setProperty("--font-scale",scales[scaleIndex].s);
  const btn = document.getElementById("fontBtn");
  if (btn) btn.textContent=scales[scaleIndex].l;
});

function hideSplashScreen() {
  const s = document.getElementById("splashScreen");
  if (s) {
    s.classList.add("hide");
    document.body.classList.remove("splash-active");
    setTimeout(() => s.remove(), 1250);
  }
}

async function init(){
  setTimeout(hideSplashScreen, 2800);

  try {
    if (typeof loadTrainData === "function") {
      loadedTrains = await loadTrainData();
    }
  } catch (err) {
    console.error("列車データの読み込みに失敗しました:", err);
  }

  renderStationGrid();
  renderDualRoute();
  renderTimetable();
  updateMenuSpotCards();
  setupSimpleMapInteraction();
  setupContentSwipe();
  updateDynamicBg("gate");
}
init().catch(console.error);

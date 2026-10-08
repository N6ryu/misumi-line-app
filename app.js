let selectedStation=null,loadedTrains=[],currentView=0;
let simpleMapState={
  zoom:10,
  centerLat:32.700,
  centerLng:130.585,
  dragging:false,
  startX:0,
  startY:0,
  startCenterPx:null
};

const gate=document.getElementById("stationGate");
const views=[...document.querySelectorAll(".view")];
const navButtons=[...document.querySelectorAll(".nav-btn[data-target]")];
const bottomNav=document.getElementById("bottomNav");
const stationFab=document.getElementById("stationFab");
const sheet=document.getElementById("bottomSheet");
const backdrop=document.getElementById("sheetBackdrop");
const stationModal=document.getElementById("stationModal");
const stationModalBackdrop=document.getElementById("stationModalBackdrop");

function setView(i){
  currentView=Math.max(0,Math.min(2,i));
  gate.hidden=true;
  views.forEach((v,n)=>v.classList.toggle("active",n===currentView));
  navButtons.forEach((b,n)=>b.classList.toggle("active",n===currentView));
  if(currentView===0&&selectedStation)setTimeout(()=>scrollToSelectedStation(false),80);
  if(currentView===1){
    setTimeout(()=>{
      resetSimpleMapToRoute();
      renderSimpleMap();
    },80);
  }
  if(currentView===2){
    if(selectedStation) setTimetableStation(selectedStation);
    renderTimetable();
  }
}
navButtons.forEach(b=>b.addEventListener("click",()=>setView(Number(b.dataset.target))));

function showGate(){
  views.forEach(v=>v.classList.remove("active"));
  gate.hidden=false;
  bottomNav.hidden=true;
  stationFab.hidden=true;
}

function stationButtonHTML(s){
  return `<button class="station-pick-btn" data-station="${s.name}">
    <span class="station-mark"></span><strong>${s.name}</strong>
  </button>`;
}

function renderStationGrid(){
  const e=document.getElementById("stationGrid");
  e.innerHTML=stations.map(stationButtonHTML).join("");
  e.querySelectorAll("[data-station]").forEach(b=>b.addEventListener("click",()=>selectStation(b.dataset.station)));

  const tt=document.getElementById("ttStationGrid");
  tt.innerHTML=stations.map(stationButtonHTML).join("");
  tt.querySelectorAll("[data-station]").forEach(b=>b.addEventListener("click",()=>{
    setTimetableStation(b.dataset.station);
    closeStationModal();
  }));
}

function selectStation(name){
  selectedStation=name;
  setTimetableStation(name);
  renderDualRoute();

  const selectedBtn=document.querySelector(`#stationGrid [data-station="${name}"]`);
  if(selectedBtn) selectedBtn.classList.add("station-picked");

  gate.classList.add("gate-leaving");
  setTimeout(()=>{
    bottomNav.hidden=false;
    stationFab.hidden=false;
    setView(0);
    const positionView=document.getElementById("viewPosition");
    positionView.classList.add("view-arriving");
    requestAnimationFrame(()=>positionView.classList.add("view-arriving-active"));
    setTimeout(()=>{
      positionView.classList.remove("view-arriving","view-arriving-active");
      gate.classList.remove("gate-leaving");
      if(selectedBtn) selectedBtn.classList.remove("station-picked");
      scrollToSelectedStation(true);
    },520);
  },380);
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
  const icon=side==="up"?"./assets/train-up.gif?v=38":"./assets/train-down.gif?v=38";
  const state=t.operationalState==="出発待ち"?`出発待ち ${t.inferredDeparture||""}`.trim():t.nickname;
  return `<button class="track-train ${side} ${t.operationalState==="出発待ち"?"waiting":""}" data-train="${t.id}">
    <img class="train-gif" src="${icon}" alt="${side==="up"?"上り":"下り"}列車">
    <span class="train-chip-copy"><strong>${t.id}</strong><small>${state}</small></span>
  </button>`;
}

function renderDualRoute(){
  const e=document.getElementById("dualRoute");
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
  e.querySelectorAll("[data-station-button]").forEach(b=>b.addEventListener("click",()=>selectStation(b.dataset.stationButton)));
}

function openSheet(title,body){
  document.getElementById("sheetTitle").textContent=title;
  document.getElementById("sheetBody").innerHTML=body;
  sheet.hidden=false;backdrop.hidden=false;
  requestAnimationFrame(()=>{sheet.classList.add("open");backdrop.classList.add("open")});
}
function closeSheet(){
  sheet.classList.remove("open");backdrop.classList.remove("open");
  setTimeout(()=>{sheet.hidden=true;backdrop.hidden=true},180);
}
document.getElementById("sheetClose").addEventListener("click",closeSheet);
backdrop.addEventListener("click",closeSheet);

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

// Simple OSM map: external libraryなしでタイルと緯度経度を同期
const TILE_SIZE=256;

function lonToWorldX(lon,zoom){
  return ((lon+180)/360)*TILE_SIZE*Math.pow(2,zoom);
}
function latToWorldY(lat,zoom){
  const sin=Math.sin(lat*Math.PI/180);
  return (0.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*TILE_SIZE*Math.pow(2,zoom);
}
function worldXToLon(x,zoom){
  return x/(TILE_SIZE*Math.pow(2,zoom))*360-180;
}
function worldYToLat(y,zoom){
  const n=Math.PI-2*Math.PI*y/(TILE_SIZE*Math.pow(2,zoom));
  return 180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n)));
}

function routeBounds(){
  const lats=stations.map(s=>s.lat);
  const lngs=stations.map(s=>s.lng);
  return {
    minLat:Math.min(...lats), maxLat:Math.max(...lats),
    minLng:Math.min(...lngs), maxLng:Math.max(...lngs)
  };
}

function resetSimpleMapToRoute(){
  const el=document.getElementById("simpleMap");
  if(!el)return;
  const b=routeBounds();
  const width=Math.max(280,el.clientWidth);
  const height=Math.max(360,el.clientHeight);
  const pad=34;

  let chosen=9;
  for(let z=13;z>=7;z--){
    const x1=lonToWorldX(b.minLng,z),x2=lonToWorldX(b.maxLng,z);
    const y1=latToWorldY(b.maxLat,z),y2=latToWorldY(b.minLat,z);
    if((x2-x1)<=width-pad*2 && (y2-y1)<=height-pad*2){
      chosen=z;break;
    }
  }
  simpleMapState.zoom=chosen;
  simpleMapState.centerLat=(b.minLat+b.maxLat)/2;
  simpleMapState.centerLng=(b.minLng+b.maxLng)/2;
}

function mapScreenPoint(lat,lng){
  const el=document.getElementById("simpleMap");
  const z=simpleMapState.zoom;
  const cx=lonToWorldX(simpleMapState.centerLng,z);
  const cy=latToWorldY(simpleMapState.centerLat,z);
  return {
    x:lonToWorldX(lng,z)-cx+el.clientWidth/2,
    y:latToWorldY(lat,z)-cy+el.clientHeight/2
  };
}

function renderTiles(){
  const el=document.getElementById("simpleMap");
  const layer=document.getElementById("mapTiles");
  if(!el||!layer)return;

  const z=simpleMapState.zoom;
  const cx=lonToWorldX(simpleMapState.centerLng,z);
  const cy=latToWorldY(simpleMapState.centerLat,z);
  const left=cx-el.clientWidth/2;
  const top=cy-el.clientHeight/2;
  const right=cx+el.clientWidth/2;
  const bottom=cy+el.clientHeight/2;

  const minTX=Math.floor(left/TILE_SIZE)-1;
  const maxTX=Math.floor(right/TILE_SIZE)+1;
  const minTY=Math.floor(top/TILE_SIZE)-1;
  const maxTY=Math.floor(bottom/TILE_SIZE)+1;
  const maxTile=Math.pow(2,z);

  let html="";
  for(let tx=minTX;tx<=maxTX;tx++){
    for(let ty=minTY;ty<=maxTY;ty++){
      if(ty<0||ty>=maxTile)continue;
      const wrappedX=((tx%maxTile)+maxTile)%maxTile;
      const x=tx*TILE_SIZE-left;
      const y=ty*TILE_SIZE-top;
      html+=`<img class="osm-tile" src="https://tile.openstreetmap.org/${z}/${wrappedX}/${ty}.png"
        style="left:${x}px;top:${y}px" alt="">`;
    }
  }
  layer.innerHTML=html;
}

function renderRouteAndMarkers(){
  const svg=document.getElementById("mapRouteSvg");
  const markers=document.getElementById("mapMarkers");
  const map=document.getElementById("simpleMap");
  if(!svg||!markers||!map)return;

  svg.setAttribute("viewBox",`0 0 ${map.clientWidth} ${map.clientHeight}`);
  svg.setAttribute("width",map.clientWidth);
  svg.setAttribute("height",map.clientHeight);

  const stationSvg=stations.map(s=>{
    const p=mapScreenPoint(s.lat,s.lng);
    return `<g class="map-station-group ${s.name===selectedStation?"selected":""}">
      <circle cx="${p.x}" cy="${p.y}" r="9" class="map-station-icon-ring"></circle>
      <circle cx="${p.x}" cy="${p.y}" r="4.5" class="map-station-icon-core"></circle>
      <text x="${p.x+11}" y="${p.y-7}" class="map-station-label">${s.name}</text>
    </g>`;
  }).join("");

  svg.innerHTML=stationSvg;

  markers.innerHTML=loadedTrains.map(t=>{
    const p=mapScreenPoint(t.latitude,t.longitude);
    const side=routeSide(t);
    const icon=side==="up"?"./assets/train-up.gif?v=38":"./assets/train-down.gif?v=38";
    const label=t.operationalState==="出発待ち" ? `出発待ち ${t.inferredDeparture||""}`.trim() : t.id;
    return `<button class="simple-train-marker" data-train="${t.id}"
      style="left:${p.x}px;top:${p.y}px">
      <img src="${icon}" alt="${t.id}">
      <span>${label}</span>
    </button>`;
  }).join("");

  markers.querySelectorAll("[data-train]").forEach(b=>
    b.addEventListener("click",e=>{
      e.stopPropagation();
      openTrainDetail(b.dataset.train);
    })
  );
}

function renderSimpleMap(){
  renderTiles();
  renderRouteAndMarkers();
}

function zoomSimpleMap(delta){
  simpleMapState.zoom=Math.max(7,Math.min(15,simpleMapState.zoom+delta));
  renderSimpleMap();
}

function setupSimpleMapInteraction(){
  const map=document.getElementById("simpleMap");
  if(!map)return;

  map.addEventListener("pointerdown",e=>{
    simpleMapState.dragging=true;
    simpleMapState.startX=e.clientX;
    simpleMapState.startY=e.clientY;
    simpleMapState.startCenterPx={
      x:lonToWorldX(simpleMapState.centerLng,simpleMapState.zoom),
      y:latToWorldY(simpleMapState.centerLat,simpleMapState.zoom)
    };
    map.setPointerCapture(e.pointerId);
  });

  map.addEventListener("pointermove",e=>{
    if(!simpleMapState.dragging)return;
    const dx=e.clientX-simpleMapState.startX;
    const dy=e.clientY-simpleMapState.startY;
    const cx=simpleMapState.startCenterPx.x-dx;
    const cy=simpleMapState.startCenterPx.y-dy;
    simpleMapState.centerLng=worldXToLon(cx,simpleMapState.zoom);
    simpleMapState.centerLat=worldYToLat(cy,simpleMapState.zoom);
    renderSimpleMap();
  });

  map.addEventListener("pointerup",()=>simpleMapState.dragging=false);
  map.addEventListener("pointercancel",()=>simpleMapState.dragging=false);

  map.addEventListener("wheel",e=>{
    e.preventDefault();
    zoomSimpleMap(e.deltaY<0?1:-1);
  },{passive:false});

  document.getElementById("mapZoomIn")?.addEventListener("click",()=>zoomSimpleMap(1));
  document.getElementById("mapZoomOut")?.addEventListener("click",()=>zoomSimpleMap(-1));
  document.getElementById("mapReset")?.addEventListener("click",()=>{
    resetSimpleMapToRoute();
    renderSimpleMap();
  });

  window.addEventListener("resize",()=>{
    if(currentView===1){
      resetSimpleMapToRoute();
      renderSimpleMap();
    }
  });
}

// timetable
let timetableStation="三角";
function setTimetableStation(name){
  timetableStation=name;
  document.getElementById("ttStationName").textContent=name;
  renderTimetable();
}
function renderTimetable(){
  const data=timetableData[timetableStation]||{up:[],down:[]};

  const hours={};
  for(let h=5;h<=23;h++) hours[h]={up:[],down:[]};

  function pushItems(items,side){
    for(const item of items){
      const [hh,mm]=item.time.split(":");
      const h=Number(hh);
      if(!hours[h]) hours[h]={up:[],down:[]};
      hours[h][side].push({minute:mm,label:item.label||""});
    }
  }

  pushItems(data.up,"up");
  pushItems(data.down,"down");

  const rows=Object.entries(hours)
    .filter(([,v])=>v.up.length||v.down.length)
    .map(([hour,v])=>`
      <div class="hour-row">
        <div class="minute-side up">
          ${v.up.length ? v.up.map(x=>`
            <div class="minute-entry" title="${x.label}">
              <strong>${x.minute}</strong>
              ${x.label ? `<small>${x.label}</small>` : ""}
            </div>`).join("") : '<span class="no-train">—</span>'}
        </div>

        <div class="hour-center">${hour}</div>

        <div class="minute-side down">
          ${v.down.length ? v.down.map(x=>`
            <div class="minute-entry" title="${x.label}">
              <strong>${x.minute}</strong>
              ${x.label ? `<small>${x.label}</small>` : ""}
            </div>`).join("") : '<span class="no-train">—</span>'}
        </div>
      </div>`).join("");

  document.getElementById("timetableRows").innerHTML=
    rows || '<div class="tt-empty">表示できる時刻がありません。</div>';
}

function openStationModal(){
  stationModal.hidden=false;stationModalBackdrop.hidden=false;
  requestAnimationFrame(()=>{stationModal.classList.add("open");stationModalBackdrop.classList.add("open")});
}
function closeStationModal(){
  stationModal.classList.remove("open");stationModalBackdrop.classList.remove("open");
  setTimeout(()=>{stationModal.hidden=true;stationModalBackdrop.hidden=true},160);
}
document.getElementById("ttStationButton").addEventListener("click",openStationModal);
document.getElementById("stationModalClose").addEventListener("click",closeStationModal);
stationModalBackdrop.addEventListener("click",closeStationModal);

// 横スワイプで 列車位置 ⇄ 地図 ⇄ 時刻表 を移動
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

stationFab.addEventListener("click",showGate);

const scales=[{s:1,l:"文字：標準"},{s:1.3,l:"文字：大"},{s:.9,l:"文字：小"}];
let scaleIndex=0;
document.getElementById("fontBtn").addEventListener("click",()=>{
  scaleIndex=(scaleIndex+1)%scales.length;
  document.documentElement.style.setProperty("--font-scale",scales[scaleIndex].s);
  document.getElementById("fontBtn").textContent=scales[scaleIndex].l;
});

async function init(){
  loadedTrains=await loadTrainData();
  renderStationGrid();
  renderDualRoute();
  renderTimetable();
  setupSimpleMapInteraction();
  setupContentSwipe();
  setTimeout(()=>{
    const s=document.getElementById("splashScreen");
    s.classList.add("hide");
    document.body.classList.remove("splash-active");
    setTimeout(()=>s.remove(),350);
  },1400);
}
init().catch(console.error);

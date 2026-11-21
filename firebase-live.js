import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';
import { getFirestore, doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

// 学校側のWebアプリ設定。JR九州側の設定や秘密鍵は入れない。
const app = initializeApp({
  apiKey: 'YOUR_API_KEY',
  authDomain: 'jrtest-c7e49.firebaseapp.com',
  projectId: 'jrtest-c7e49',
  appId: '1:141244589484:web:cb0e829f08e6cff6c84609',
  messagingSenderId: '141244589484'
});
const db = getFirestore(app);
let timer;
function status(message) {
  document.getElementById('liveStatus').textContent = message;
  document.getElementById('liveBadge').textContent = message;
}
function redraw(rows) {
  loadedTrains = rows;
  renderDualRoute();
  if (positionDisplayMode === 'map') renderRouteAndMarkers();
  if (!sheet.hidden && document.querySelector('#sheetBody .remaining-schedule')) { const id=document.getElementById('sheetTitle')?.textContent.split(' ')[0]; if(rows.some(t=>t.id===id)) openTrainDetail(id); else closeSheet(); }
}
function clear(message) {
  clearTimeout(timer);
  redraw([]);
  status(message);
}
// APIの駅名・時刻を既存の描画形式に変換
function convert(t) {
  if (!t || !/^[0-9]{1,6}[A-Z]{0,2}$/.test(t.trainNo) || !Number.isFinite(t.latitude) || !Number.isFinite(t.longitude) || !['上り','下り'].includes(t.direction)) return null;
  const names = stations.map(s=>s.name);
  const loc = String(t.locationStatus ?? '');
  const parts = loc.endsWith(' 停車中') ? [loc.slice(0,-4)] : loc.split('～');
  if(parts.length>2 || !parts.every(s=>names.includes(s)) || !names.includes(t.endStation)) return null;
  const [a,b=a]=parts;
  const stops=t.timetable?.stops;
  if(!Array.isArray(stops)) return null;
  const idx=stops.findIndex(s=>s.station===b);
  if(idx<0) return null;
  const time=v=>typeof v==='string' && /^([01]\d|2[0-9]):[0-5]\d$/.test(v)?v:null;
  const timetable=stops.slice(idx).filter(s=>names.includes(s.station)).map(s=>({station:s.station,arrival:time(s.arr),departure:time(s.dep)}));
  const row={id:t.trainNo,nickname:'列車',latitude:t.latitude,longitude:t.longitude,currentStation:a,nextStation:b,nextStop:b,rawDirection:t.direction,derivedDirection:t.direction,displayDirection:t.direction==='上り'?'熊本方面':'三角方面',operationalState:a===b?'停車中':'走行中',terminal:t.endStation,timetable,timetableNote:'時刻は所定の時刻表です。遅延・到着予測ではありません。位置の測定時刻は未取得です。'};
  row.positionIndex=routePositionIndex(row);
  return row;
}
clear('列車情報・受信待ち');
onSnapshot(doc(db,'publicLive','latest'), {includeMetadataChanges:true}, snap => {
    const data = snap.data();
    const time = data?.updatedAt?.toMillis?.();
    if (snap.metadata.fromCache || data?.status !== 'live' || !Number.isFinite(time)) {
      clear('列車情報・受信待ち'); return;
    }
    const remaining = 180000 - (Date.now()-time);
    if (remaining <= 0 || remaining > 240000) { clear('列車情報・更新停止／時刻要確認'); return; }
    clearTimeout(timer);
    const rows = (Array.isArray(data.trains)?data.trains:[]).map(convert).filter(Boolean);
    redraw(rows);
    status(new Date(time).toLocaleTimeString('ja-JP', {hour:'2-digit', minute:'2-digit', hour12:false}) + '現在');
    timer = setTimeout(()=>clear('列車情報・更新停止'),remaining);
  }, e => clear('受信エラー：'+e.code));

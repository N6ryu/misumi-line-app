import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';
import { getFirestore, doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

// 学校側のFirebase Webアプリ設定。JR九州側の鍵や認証情報は入れない。
// 現在のリポジトリと同様、学校側Web APIキーはGitHub上で設定する。
const app = initializeApp({
  apiKey: 'AIzaSyAohrIJyQ2xbwmu2nrpXgNxf11vdy0IZ8g',
  authDomain: 'jrtest-c7e49.firebaseapp.com',
  projectId: 'jrtest-c7e49',
  appId: '1:141244589484:web:cb0e829f08e6cff6c84609',
  messagingSenderId: '141244589484'
});
const db = getFirestore(app);
const MAX_MEASUREMENT_AGE_MS = 3 * 60 * 1000;
let timer;

function status(message) {
  const a=document.getElementById('liveStatus');
  const b=document.getElementById('liveBadge');
  if(a) a.textContent=message;
  if(b) b.textContent=message;
}
function redraw(rows) {
  loadedTrains=rows;
  renderDualRoute();
  if(positionDisplayMode==='map') renderRouteAndMarkers();
  if(!sheet.hidden && document.querySelector('#sheetBody .remaining-schedule')) {
    const id=document.getElementById('sheetTitle')?.textContent.split(' ')[0];
    if(rows.some(t=>t.id===id)) openTrainDetail(id);
    else closeSheet();
  }
}
function clear(message) {
  clearTimeout(timer);
  redraw([]);
  status(message);
}
function jstClock(iso) {
  const date=new Date(iso);
  if(!Number.isFinite(date.getTime()))return null;
  return new Intl.DateTimeFormat('ja-JP',{
    timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false
  }).format(date);
}
// 遅延・到着予測は自宅PC側で計算した結果のみを表示。
// 公開Firestoreに速度の生値は保存しない。
function safeLabel(v,fallback) {
  return typeof v==='string'&&v.length<=60&&!/[<>]/.test(v)?v:fallback;
}
function convert(t) {
  if(!t||!/^[0-9]{1,6}[A-Z]{0,2}$/.test(t.trainNo)||
     !Number.isFinite(t.latitude)||!Number.isFinite(t.longitude)||
     !['上り','下り'].includes(t.direction)) return null;
  const names=stations.map(s=>s.name);
  const loc=String(t.locationStatus??'');
  const parts=loc.endsWith(' 停車中')?[loc.slice(0,-4)]:loc.split('～');
  if(parts.length>2||!parts.every(s=>names.includes(s))||!names.includes(t.endStation)) return null;
  const [a,b=a]=parts;
  const stops=t.timetable?.stops;
  if(!Array.isArray(stops)) return null;
  const idx=stops.findIndex(s=>s.station===b);
  if(idx<0) return null;
  const time=v=>typeof v==='string'&&/^([01]\d|2\d):[0-5]\d$/.test(v)?v:null;
  const timetable=stops.slice(idx).filter(s=>names.includes(s.station))
    .map(s=>({station:s.station,arrival:time(s.arr),departure:time(s.dep)}));
  const measuredMs=typeof t.measuredAt==='string'?Date.parse(t.measuredAt):NaN;
  const hasMeasuredAt=Number.isFinite(measuredMs);
  const ageMs=hasMeasuredAt?Date.now()-measuredMs:null;
  // 古い位置を最新として描画しない。測位時刻のない旧データは移行中のみ表示。
  if(hasMeasuredAt && (ageMs>MAX_MEASUREMENT_AGE_MS||ageMs < -60000)) return null;
  const clock=hasMeasuredAt?jstClock(t.measuredAt):null;
  const row={
    id:t.trainNo,nickname:'列車',latitude:t.latitude,longitude:t.longitude,
    currentStation:a,nextStation:b,nextStop:b,rawDirection:t.direction,
    derivedDirection:t.direction,displayDirection:t.direction==='上り'?'熊本方面':'三角方面',
    operationalState:a===b?'停車中':'走行中',terminal:t.endStation,
    timetable,measureTimeLabel:clock||'未取得',delayLabel:safeLabel(t.delayLabel,'判定保留'),
    timetableNote:'所定時刻と線路上の距離、速度を自宅PC側で処理した参考予測です。JR九州公式の遅延情報・到着予測ではありません。計算に用いた速度の単位・係数は検証段階です。',
    etaStation:names.includes(t.nextStationName)?t.nextStationName:null,
    etaLabel:safeLabel(t.etaLabel,'予測できません'),
    predictedArrival:typeof t.predictedArrival==='string'&&/^([01]\d|2[0-3]):[0-5]\dごろ$/.test(t.predictedArrival)?t.predictedArrival:null,
    delayKind:safeLabel(t.delayKind,'unknown'),
    delayMinutes:Number.isFinite(t.delayMinutes)&&t.delayMinutes>=0?t.delayMinutes:null,
  };
  const proj=projectOnRoute(row);
  if(!proj||proj.offsetMeters>1000) return null;
  row.positionIndex=proj.index;
  // 近傍の実測点を線路形状に投影。元座標はデータに保持する。
  row.rawLatitude=t.latitude;
  row.rawLongitude=t.longitude;
  row.latitude=proj.latitude;
  row.longitude=proj.longitude;
  row.nickname=(row.delayKind==='missed'||row.delayKind==='departure-missed'||row.delayKind==='estimated') ? row.delayLabel : (row.etaLabel!=='予測できません' ? row.etaLabel : '列車');
  if(clock) row.timetableNote+=` 位置測位 ${clock}。`;
  if(t.predictionNote) row.timetableNote+=' '+safeLabel(t.predictionNote,'');
  else row.timetableNote+=' 測位時刻が未取得のため、遅延判定は保留しています。';
  return row;
}

clear('列車情報・受信待ち');
onSnapshot(doc(db,'publicLive','latest'),{includeMetadataChanges:true},snap=>{
  const data=snap.data();
  const time=data?.updatedAt?.toMillis?.();
  if(snap.metadata.fromCache||data?.status!=='live'||!Number.isFinite(time)){
    clear('列車情報・受信待ち');return;
  }
  const remaining=180000-(Date.now()-time);
  if(remaining<=0||remaining>240000){
    clear('列車情報・更新停止／時刻要確認');return;
  }
  clearTimeout(timer);
  const rows=(Array.isArray(data.trains)?data.trains:[]).map(convert).filter(Boolean);
  redraw(rows);
  const updated=new Date(time).toLocaleTimeString('ja-JP',{
    timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hour12:false
  });
  status(`情報更新 ${updated}現在`);
  timer=setTimeout(()=>clear('列車情報・更新停止'),remaining);
},e=>clear('受信エラー：'+e.code));

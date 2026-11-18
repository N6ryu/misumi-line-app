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
  if (!sheet.hidden && document.querySelector('#sheetBody .remaining-schedule')) closeSheet();
}
function clear(message) {
  clearTimeout(timer);
  redraw([]);
  status(message);
}
// 今回の仮データは駅間情報を持たないため、最寄りの駅間に投影する。
// 実際の走行位置の判定には使用しない。
function convert(t) {
  if (t?.trainNo !== 'TEST001' || !Number.isFinite(t.latitude) || !Number.isFinite(t.longitude)) return null;
  const lat = t.latitude, lng = t.longitude;
  if (lat < 32.5 || lat > 32.9 || lng < 130.3 || lng > 130.8) return null;
  const c = Math.cos(lat * Math.PI / 180);
  let best = { d: Infinity, i: 0, q: 0 };
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i], b = stations[i+1];
    const dx = (b.lng-a.lng)*c, dy = b.lat-a.lat;
    const x = (lng-a.lng)*c, y = lat-a.lat;
    const q = Math.max(0, Math.min(1, (x*dx+y*dy)/(dx*dx+dy*dy || 1)));
    const d = (x-q*dx)**2+(y-q*dy)**2;
    if (d < best.d) best = { d, i, q };
  }
  const up = t.direction === '上り';
  const a = stations[best.i].name, b = stations[best.i+1].name;
  return { id:'TEST001', nickname:'仮データ', latitude:lat, longitude:lng,
    currentStation:up?b:a, nextStation:up?a:b, nextStop:up?a:b,
    rawDirection:up?'上り':'下り', derivedDirection:up?'上り':'下り',
    displayDirection:up?'熊本方面':'三角方面', operationalState:'テスト走行中',
    positionIndex:Math.min(stations.length-1.00001,best.i+best.q),
    terminal:up?'熊本':'三角', timetable:[],
    timetableNote:'仮データです。駅間は座標からの簡易推定で、実際の運行・時刻・遅延を示しません。' };
}
clear('仮データ・受信待ち');
onSnapshot(doc(db,'publicDemo','latest'), {includeMetadataChanges:true}, snap => {
    const data = snap.data();
    const time = data?.updatedAt?.toMillis?.();
    if (snap.metadata.fromCache || data?.status !== 'test' || !Number.isFinite(time)) {
      clear('仮データ・受信待ち'); return;
    }
    const remaining = 180000 - (Date.now()-time);
    if (remaining <= 0 || remaining > 240000) { clear('仮データ・更新停止／時刻要確認'); return; }
    clearTimeout(timer);
    const rows = (Array.isArray(data.trains)?data.trains:[]).map(convert).filter(Boolean);
    redraw(rows);
    status('仮データ '+new Date(time).toLocaleTimeString('ja-JP')+' / '+(Number.isInteger(data.updateCount)?data.updateCount:'?')+'回');
    timer = setTimeout(()=>clear('仮データ・更新停止'),remaining);
  }, e => clear('受信エラー：'+e.code));
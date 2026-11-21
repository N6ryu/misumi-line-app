const stations=[
{name:"熊本",lat:32.7898759,lng:130.6886784},
{name:"西熊本",lat:32.7622048,lng:130.6830044},
{name:"川尻",lat:32.7432967,lng:130.6797},
{name:"富合",lat:32.7137924,lng:130.6728748},
{name:"宇土",lat:32.6939373,lng:130.6689895},
{name:"緑川",lat:32.69408,lng:130.63122},
{name:"住吉",lat:32.7020569,lng:130.5978974},
{name:"肥後長浜",lat:32.6906325,lng:130.5602429},
{name:"網田",lat:32.6676218,lng:130.5468003},
{name:"赤瀬",lat:32.6533333,lng:130.5100028},
{name:"石打ダム",lat:32.6425269,lng:130.5068254},
{name:"波多浦",lat:32.6153747,lng:130.4879955},
{name:"三角",lat:32.60775,lng:130.46968}
];

const trains=[
{
 id:"8031D",nickname:"A列車で行こう 1号",
 currentStation:"富合",nextStation:"宇土",nextStop:"宇土",
 rawDirection:"下り",derivedDirection:"下り",displayDirection:"三角方面",operationalState:"走行中",
 latitude:32.71283416,longitude:130.6727855,speed:75,
 beaconAt:"10:28",acquiredAt:"10:28",formation:"キハ185-4",cabCarNo:"キハ185-4",
 terminal:"三角",
 timetable:[
  {station:"宇土",arrival:"10:31",departure:"10:31"},
  {station:"網田",arrival:"10:52",departure:"11:17"},
  {station:"三角",arrival:"11:30",departure:null}
 ],
 timetableNote:"A列車で行こう1号の時刻表を参照"
},
{
 id:"527D",nickname:"普通",
 currentStation:"三角",nextStation:"三角",nextStop:"三角",
 rawDirection:"下り",derivedDirection:"上り",displayDirection:"熊本方面",operationalState:"出発待ち",
 latitude:32.60767861,longitude:130.4699545,speed:-3.6,
 beaconAt:"10:02",acquiredAt:"10:28",formation:"キハ147-106",cabCarNo:"キハ147-106",
 terminal:"熊本",inferredDeparture:"11:00",
 timetable:[{station:"三角",arrival:null,departure:"11:00"}],
 timetableNote:"三角駅時刻表の11:00 熊本行を参照。ビーコン発信から5分以上経過し三角駅停車中のため、表示上は上り・出発待ちと判定"
}
];

function stationIndex(name){return stations.findIndex(s=>s.name===name)}

// 実測座標を線路形状の折れ線に投影し、路線図の表示位置を求める。
// 直線的な駅間補間と異なり、曲線区間でも進行率を計算できる。
function projectOnRoute(t) {
 const a=stationIndex(t.currentStation), b=stationIndex(t.nextStation);
 if (a<0 || !Number.isFinite(t.latitude) || !Number.isFinite(t.longitude)) return null;
 if (b<0 || a===b) {
   const st=stations[a];
   const dLat=(t.latitude-st.lat)*111320;
   const dLng=(t.longitude-st.lng)*111320*Math.cos(t.latitude*Math.PI/180);
   return {index:a,latitude:st.lat,longitude:st.lng,offsetMeters:Math.hypot(dLat,dLng),progress:0};
 }
 const lo=Math.min(a,b), hi=Math.max(a,b);
 const geom=typeof lightweightRouteSegments!=="undefined"
   ? lightweightRouteSegments.find(s=>s.from===stations[lo].name && s.to===stations[hi].name)
   : null;
 const points=geom?.points || [
   [stations[lo].lat,stations[lo].lng],
   [stations[hi].lat,stations[hi].lng]
 ];
 if(points.length<2) return null;
 const latScale=111320;
 const lonScale=latScale*Math.cos(t.latitude*Math.PI/180);
 const xy=([lat,lng])=>[lng*lonScale,lat*latScale];
 const [px,py]=xy([t.latitude,t.longitude]);
 let total=0,bestDistance2=Infinity,bestAlong=0,bestPoint=null;
 const segments=[];
 for(let i=0;i<points.length-1;i++){
   const [x1,y1]=xy(points[i]),[x2,y2]=xy(points[i+1]);
   const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy);
   segments.push({x1,y1,dx,dy,len,along:total});
   total+=len;
 }
 for(const seg of segments){
   const q=seg.len>0?Math.max(0,Math.min(1,
     ((px-seg.x1)*seg.dx+(py-seg.y1)*seg.dy)/(seg.len*seg.len))):0;
   const x=seg.x1+seg.dx*q,y=seg.y1+seg.dy*q;
   const d2=(px-x)**2+(py-y)**2;
   if(d2<bestDistance2){
     bestDistance2=d2;
     bestAlong=seg.along+seg.len*q;
     bestPoint={latitude:y/latScale,longitude:x/lonScale};
   }
 }
 const fromLow=total>0?bestAlong/total:0;
 const progress=a<b?fromLow:1-fromLow;
 return {
   index:a+(b-a)*progress,
   latitude:bestPoint.latitude,
   longitude:bestPoint.longitude,
   offsetMeters:Math.sqrt(bestDistance2),
   progress
 };
}
function routePositionIndex(t){
 return projectOnRoute(t)?.index ?? 0;
}

async function loadTrainData(){
 const source = window.MISUMI_LOCAL_SNAPSHOT || trains;
 return source.map(t=>({...t,positionIndex:routePositionIndex(t)}));
}

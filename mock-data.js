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

function routePositionIndex(t){
 const a=stationIndex(t.currentStation),b=stationIndex(t.nextStation);
 if(a<0)return 0;
 if(b<0||a===b)return a;
 const A=stations[a],B=stations[b],c=Math.cos(((A.lat+B.lat)/2)*Math.PI/180);
 const ax=A.lng*c,ay=A.lat,bx=B.lng*c,by=B.lat,px=t.longitude*c,py=t.latitude;
 const dx=bx-ax,dy=by-ay,d=dx*dx+dy*dy;
 const q=d?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/d)):0;
 return a+(b-a)*q;
}

async function loadTrainData(){
 return trains.map(t=>({...t,positionIndex:routePositionIndex(t)}));
}

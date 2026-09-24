'use strict';
const $=id=>document.getElementById(id);
const cards=window.SILVER_CARDS;
const edition=window.SILVER_EDITION||{};
const key=edition.storageKey||'silver-garage-v1',W=420,H=315;
const foil=$('foil'),ctx=foil.getContext('2d',{willReadFrequently:true}),dust=$('dust'),dc=dust.getContext('2d');
let db={owned:{},days:{}},storageOK=true;
try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved&&typeof saved.owned==='object'&&saved.owned&&typeof saved.days==='object'&&saved.days)db=saved;}catch{storageOK=false;}
const dateKey=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
let day=dateKey(),card,progress=0,claimed=false,replaying=false,ready=false,pointer=null,previous=null,handPoint={x:W*.6,y:H*.65},keyboardDown=false,particles=[],lastT=0,saveTimer,storing=false;
let audio,muted=false,noiseNode,noiseGain,stream,analyser,micData,micFreq,calibrateUntil=0,noiseFloor=.008,lastGust=0,micStarting=false,micBlocked=false;
const message=t=>$('instruction').textContent=t;
function persist(){try{localStorage.setItem(key,JSON.stringify(db));storageOK=true;}catch{storageOK=false;$('micHelp').textContent='保存領域を使えません。この画面を閉じるとコレクションが失われる場合があります。';}}
function saveScratch(){clearTimeout(saveTimer);if(!ready||claimed||replaying)return;saveTimer=setTimeout(()=>{db.days[day]={...(db.days[day]||{}),cardId:card.id,mask:foil.toDataURL('image/png'),progress};persist();},350);}
function initFoil(){ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,W,H);const g=ctx.createLinearGradient(0,0,W,H);[[0,'#e9edef'],[.18,'#bbc4c8'],[.38,'#f1f4f4'],[.55,'#9da9ae'],[.77,'#dae0e2'],[1,'#b0b9be']].forEach(([s,c])=>g.addColorStop(s,c));ctx.fillStyle=g;ctx.fillRect(0,0,W,H);for(let i=0;i<16000;i++){const n=Math.random();ctx.fillStyle=n>.5?'rgba(255,255,255,.12)':'rgba(39,52,60,.09)';ctx.fillRect(Math.random()*W,Math.random()*H,Math.random()*2.5+.3,.5);}ctx.save();ctx.translate(W/2,H/2);ctx.rotate(-Math.PI/4);ctx.fillStyle='#ffffff16';for(let y=-H;y<H;y+=38){ctx.font='bold 11px Arial';ctx.fillText('SILVER GARAGE ADVENT  ·  SILVER GARAGE ADVENT',-W,y);}ctx.restore();ctx.textAlign='center';ctx.fillStyle='#3e4b55';ctx.font='italic 900 34px Arial';ctx.fillText(edition.foilTitle?.[0]||'SILVER GARAGE',W/2,H*.38);ctx.fillText(edition.foilTitle?.[1]||'ADVENT',W/2,H*.51);ctx.font='12px monospace';ctx.fillText('DAILY SCRATCH CARD',W/2,H*.60);ctx.strokeStyle='#53616c66';ctx.lineWidth=1;ctx.strokeRect(37,43,W-74,H-86);ctx.font='12px Arial';ctx.fillText('コインで削ってください',W/2,H*.83);ctx.textAlign='start';progress=0;updateProgress();}
function updateProgress(){ $('percent').textContent=claimed&&!replaying?'COLLECTED':''; }
function loadDay(){day=dateKey();const ordinal=d=>Math.floor(Date.UTC(...d.split('-').map((v,i)=>+v-(i===1?1:0)))/86400000);if(!db.seriesStart){db.seriesStart=day;persist();}const serial=Math.max(0,ordinal(day)-ordinal(db.seriesStart));card=cards[serial%cards.length];const entry=db.days[day]||{};const saved=entry.cardId===card.id?entry:{};claimed=!!saved.claimed;replaying=false;ready=false;particles=[];$('storeCard').hidden=false;$('storeCard').disabled=true;$('date').textContent=day.replaceAll('-','.');$('country').textContent=card.country;$('number').textContent=`NO. ${String(cards.indexOf(card)+1).padStart(3,'0')}`;$('kind').textContent=card.type;$('carName').textContent=card.name;$('specs').textContent=card.spec;const art=$('art');art.alt=`${card.name} — 架空の${edition.label||"HOT ROD"}`;art.onload=()=>{ready=true;$('storeCard').disabled=false;};art.onerror=()=>message('画像を読み込めませんでした。接続を確認して再読み込みしてください。');art.src=card.image;if(art.complete&&art.naturalWidth){ready=true;$('storeCard').disabled=false;}initFoil();if(claimed){ctx.clearRect(0,0,W,H);progress=1;onCollectedUI();}else if(typeof saved.mask==='string'&&saved.mask.startsWith('data:image/png;base64,')){const img=new Image();const expectedDay=day;img.onload=()=>{if(day!==expectedDay||claimed)return;ctx.clearRect(0,0,W,H);ctx.drawImage(img,0,0,W,H);measure();};img.src=saved.mask;}else{message('好きなところまで削って、ガレージへ。');$('replay').hidden=true;$('tomorrow').hidden=true;}renderCollection();updateProgress();requestAnimationFrame(()=>moveHand(handPoint,!claimed));}
function measure(){const a=ctx.getImageData(0,0,W,H).data;let clear=0,total=0;for(let y=3;y<H;y+=7)for(let x=3;x<W;x+=7){total++;if(a[(y*W+x)*4+3]<100)clear++;}progress=clear/total;updateProgress();saveScratch();}
function scratch(from,to){
 if(!ready||storing||claimed&&!replaying)return;
 const dx=to.x-from.x,dy=to.y-from.y,dist=Math.hypot(dx,dy),steps=Math.max(1,Math.ceil(dist/4));
 ctx.globalCompositeOperation='destination-out';
 for(let i=0;i<=steps;i++){
  const x=from.x+dx*i/steps,y=from.y+dy*i/steps;if(x<0||y<0||x>=W||y>=H)continue;
  const bx=Math.max(0,Math.floor(x-19)),by=Math.max(0,Math.floor(y-15)),bw=Math.min(W-bx,39),bh=Math.min(H-by,31);
  const before=ctx.getImageData(bx,by,bw,bh).data;
  ctx.beginPath();ctx.ellipse(x,y,17,7,-.45,0,Math.PI*2);ctx.fill();
  const after=ctx.getImageData(bx,by,bw,bh).data;
  let removed=0;for(let k=3;k<before.length;k+=16)if(before[k]-after[k]>80)removed++;
  const expected=Math.min(16,Math.ceil(removed/4))/3;
  const count=Math.floor(expected)+(Math.random()<expected%1?1:0);
  for(let k=0;k<count;k++){
   particles.push({x:x+(Math.random()-.5)*27,y:y+(Math.random()-.5)*16,vx:(Math.random()-.5)*32+dx*.04,vy:Math.random()*20,angle:Math.random()*6.28,spin:(Math.random()-.5)*4,size:2.3+Math.random()*3.7,shade:Math.floor(170+Math.random()*70),air:false});
  }
 }
 ctx.globalCompositeOperation='source-over';if(dist>0)playScratch(Math.min(1,dist/18));
}
function point(e){const r=foil.getBoundingClientRect();return{x:Math.max(0,Math.min(W-1,(e.clientX-r.left)/r.width*W)),y:Math.max(0,Math.min(H-1,(e.clientY-r.top)/r.height*H))};}
function moveHand(p,show=true){handPoint=p;const table=document.querySelector('.table'),rect=table.getBoundingClientRect(),r=foil.getBoundingClientRect(),hand=$('hand');hand.style.left=`${(r.left-rect.left)+p.x/W*r.width-hand.clientWidth*.11}px`;hand.style.top=`${(r.top-rect.top)+p.y/H*r.height-hand.clientWidth*.37}px`;hand.style.transform=`rotate(${pointer!==null?(Math.sin(p.x/9)*1.4):0}deg)`;hand.style.opacity=show&&(!claimed||replaying)?'1':'0';}
foil.addEventListener('pointerdown',e=>{if(!ready||storing||claimed&&!replaying)return;e.preventDefault();pointer=e.pointerId;foil.setPointerCapture(e.pointerId);previous=point(e);moveHand(previous);scratch(previous,previous);ensureAudio();if(!stream&&!micStarting&&!micBlocked)startMic();});
foil.addEventListener('pointermove',e=>{if(pointer!==null&&pointer!==e.pointerId)return;const p=point(e);moveHand(p);if(pointer===e.pointerId){scratch(previous,p);previous=p;}});
function release(e){if(pointer!==e.pointerId)return;pointer=null;previous=null;stopScratch();measure();if(e.pointerType==='touch')moveHand(handPoint,false);}
foil.addEventListener('pointerup',release);foil.addEventListener('pointercancel',release);foil.addEventListener('pointerleave',()=>{if(pointer===null)moveHand(handPoint,false);});
foil.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))return;e.preventDefault();const p={...handPoint};if(e.key===' ')keyboardDown=true;if(e.key==='ArrowLeft')p.x-=13;if(e.key==='ArrowRight')p.x+=13;if(e.key==='ArrowUp')p.y-=13;if(e.key==='ArrowDown')p.y+=13;p.x=Math.max(5,Math.min(W-5,p.x));p.y=Math.max(5,Math.min(H-5,p.y));if(keyboardDown){scratch(handPoint,p);if(!stream&&!micStarting&&!micBlocked)startMic();}moveHand(p);});foil.addEventListener('keyup',e=>{if(e.key===' '){keyboardDown=false;stopScratch();measure();}});foil.addEventListener('blur',()=>{keyboardDown=false;stopScratch();moveHand(handPoint,false);});
function gust(strength=1){if(ready&&(!claimed||replaying))measure();lastGust=performance.now();for(const p of particles){p.air=true;p.vx+=(100+Math.random()*250)*strength;p.vy-=(140+Math.random()*230)*strength;p.spin=(Math.random()-.5)*15;}if(particles.length===0&&progress===0)message('まず銀の膜を削ってみてください。');}

async function storeCard(){
 if(refreshDay())return;
 if(!ready||storing||claimed&&!replaying)return;
 storing=true;pointer=null;previous=null;stopScratch();stopMic();moveHand(handPoint,false);clearTimeout(saveTimer);
 $('storeCard').disabled=true;message('残りの銀を剥がして、ガレージへ。');
 const shell=document.querySelector('.card-shell');shell.classList.add('putting-away');
 const duration=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?1:750;
 await new Promise(resolve=>{let start;function peel(t){start??=t;const f=Math.min(1,(t-start)/duration);const edge=W*(1-Math.pow(1-f,2));ctx.clearRect(0,0,edge,H);if(f<1)requestAnimationFrame(peel);else resolve();}requestAnimationFrame(peel);});
 ctx.clearRect(0,0,W,H);progress=1;particles=[];
 if(!claimed)claim();else{replaying=false;onCollectedUI();}
 shell.classList.remove('putting-away');storing=false;$('storeCard').disabled=false;if(!refreshDay())showCollection(true);
}
$('storeCard').onclick=storeCard;
function claim(){clearTimeout(saveTimer);claimed=true;replaying=false;db.days[day]={cardId:card.id,claimed:true};db.owned[card.id]={count:(Number(db.owned[card.id]?.count)||0)+1,last:day};const days=Object.keys(db.days).sort();days.slice(0,Math.max(0,days.length-14)).forEach(d=>delete db.days[d]);persist();renderCollection();onCollectedUI();}
function onCollectedUI(){message('今日の一枚をコレクションに追加しました。');$('storeCard').hidden=true;$('replay').hidden=false;$('tomorrow').hidden=false;$('tomorrow').textContent=cards.length===1?'試作版は全1種。次の配布は明日0時です。':'次の一枚は、明日0時。';moveHand(handPoint,false);updateProgress();}
$('replay').addEventListener('click',()=>{replaying=true;particles=[];initFoil();$('percent').textContent='';$('storeCard').hidden=false;$('replay').hidden=true;message('同じカードで、もう一度。');});
function renderCollection(){$('count').textContent=`${cards.filter(c=>db.owned[c.id]).length} / ${cards.length}`;$('collectionGrid').replaceChildren();for(const c of cards){const got=db.owned[c.id],b=document.createElement(got?'button':'div');b.className=got?'col-card':'col-card locked';if(got){const im=document.createElement('img');im.src=c.image;im.alt=c.name;const info=document.createElement('span');info.className='col-info';info.textContent=c.name;const sm=document.createElement('small');sm.textContent=`${c.country} · ${got.count}枚`;info.append(sm);b.append(im,info);b.onclick=()=>{$('detailArt').src=c.image;$('detailArt').alt=c.name;$('detailName').textContent=c.name;$('detailSpecs').textContent=c.spec;$('detail').showModal();};}else{const title=document.createElement('strong');title.textContent='?';const desc=document.createElement('span');desc.textContent='まだ手に入れていません';b.append(title,desc);}$('collectionGrid').append(b);}}
function showCollection(show){if(!show&&refreshDay())return;$('playView').hidden=show;$('collectionView').hidden=!show;$('collectionToggle').setAttribute('aria-expanded',String(show));if(show){stopScratch();stopMic();renderCollection();$('back').focus?.();}else resizeDust();}
$('collectionToggle').onclick=()=>showCollection($('collectionView').hidden);$('back').onclick=()=>showCollection(false);document.querySelector('.brand').onclick=e=>{e.preventDefault();showCollection(false);};$('closeDetail').onclick=()=>$('detail').close();$('detail').addEventListener('click',e=>{if(e.target===$('detail')){const r=$('detail').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('detail').close();}});
function ensureAudio(){if(muted)return;try{audio||=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();if(!noiseNode){const b=audio.createBuffer(1,audio.sampleRate,audio.sampleRate),a=b.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;noiseNode=audio.createBufferSource();noiseNode.buffer=b;noiseNode.loop=true;const filter=audio.createBiquadFilter();filter.type='bandpass';filter.frequency.value=2300;filter.Q.value=.8;noiseGain=audio.createGain();noiseGain.gain.value=0;noiseNode.connect(filter).connect(noiseGain).connect(audio.destination);noiseNode.start();}}catch{muted=true;}}
function playScratch(intensity){if(muted||stream)return;ensureAudio();if(noiseGain){noiseGain.gain.cancelScheduledValues(audio.currentTime);noiseGain.gain.setTargetAtTime(.06*intensity,audio.currentTime,.012);noiseGain.gain.setTargetAtTime(0,audio.currentTime+.045,.025);}}
function stopScratch(){if(noiseGain)noiseGain.gain.setTargetAtTime(0,audio.currentTime,.015);}
async function startMic(){
 if(micStarting||micBlocked)return;
 if(!navigator.mediaDevices?.getUserMedia){micBlocked=true;$('micHelp').textContent='この環境ではマイクを使えません。マイク対応のブラウザで開いてください。';return;}
 micStarting=true;
 try{
  const s=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
  if(document.hidden||$('playView').hidden||storing){s.getTracks().forEach(t=>t.stop());return;}
  stream=s;audio||=new(window.AudioContext||window.webkitAudioContext)();await audio.resume();
  analyser=audio.createAnalyser();analyser.fftSize=1024;audio.createMediaStreamSource(stream).connect(analyser);
  micData=new Float32Array(analyser.fftSize);micFreq=new Uint8Array(analyser.frequencyBinCount);calibrateUntil=performance.now()+1000;noiseFloor=.005;
  $('micHelp').textContent='息を吹きかけて、ゴミを飛ばしてください';stopScratch();
 }catch(e){
  stopMic();micBlocked=true;$('micHelp').textContent=e.name==='NotAllowedError'?'息でカスを飛ばすには、ブラウザでマイクを許可して再読み込みしてください。':'マイクを開始できませんでした。マイクの接続を確認して再読み込みしてください。';
 }finally{micStarting=false;}
}
function stopMic(){stream?.getTracks().forEach(t=>t.stop());stream=null;analyser=null;}
function resizeDust(){const r=document.querySelector('.table').getBoundingClientRect();if(!r.width)return;dust.width=Math.round(r.width*1.3*Math.min(devicePixelRatio||1,2));dust.height=Math.round(r.height*1.3*Math.min(devicePixelRatio||1,2));}
function frame(t){const dt=Math.min((t-lastT)/1000||.016,.035);lastT=t;if(!document.hidden&&!$('playView').hidden){dc.setTransform(dust.width/(W*1.3),0,0,dust.height/(H*1.3),dust.width*.15/1.3,dust.height*.15/1.3);dc.clearRect(-W*.2,-H*.2,W*1.4,H*1.4);for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.air){p.vy+=75*dt;p.angle+=p.spin*dt;}else{p.vx*=.86;p.vy*=.84;p.angle+=p.spin*dt*.05;}if(p.air&&(p.x>W*1.3||p.x<-W*.3||p.y<-H*.3||p.y>H*1.3)){particles.splice(i,1);continue;}dc.save();dc.translate(p.x,p.y);dc.rotate(p.angle);dc.fillStyle='rgba(0,0,0,.28)';dc.fillRect(1.2,1.7,p.size*1.9,p.size*.7);dc.fillStyle=`rgb(${p.shade},${p.shade+2},${p.shade+3})`;dc.beginPath();dc.moveTo(-p.size,0);dc.lineTo(p.size*.7,-p.size*.45);dc.lineTo(p.size,p.size*.2);dc.lineTo(-p.size*.5,p.size*.65);dc.fill();dc.strokeStyle='#485159';dc.lineWidth=.65;dc.stroke();dc.beginPath();dc.moveTo(-p.size*.65,0);dc.lineTo(p.size*.65,-p.size*.2);dc.strokeStyle='#f3f6f8';dc.lineWidth=.9;dc.stroke();dc.restore();}if(analyser){analyser.getFloatTimeDomainData(micData);let sum=0;for(const n of micData)sum+=n*n;const rms=Math.sqrt(sum/micData.length);if(t<calibrateUntil)noiseFloor=noiseFloor*.9+rms*.1;else{analyser.getByteFrequencyData(micFreq);let occupied=0;for(let i=2;i<100;i++)if(micFreq[i]>80)occupied++;if(rms>Math.max(.025,noiseFloor*3)&&occupied>12&&t-lastGust>280){gust(Math.max(.6,Math.min(2,rms*9)));}}}}requestAnimationFrame(frame);}
function refreshDay(){
 if(storing||dateKey()===day)return false;
 clearTimeout(saveTimer);stopMic();stopScratch();
 if(pointer!==null&&foil.hasPointerCapture?.(pointer))foil.releasePointerCapture(pointer);
 pointer=null;previous=null;keyboardDown=false;
 loadDay();$('detail').close();showCollection(false);
 return true;
}
window.addEventListener('resize',resizeDust);
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopMic();stopScratch();}else refreshDay();});
window.addEventListener('pageshow',refreshDay);
window.addEventListener('focus',refreshDay);
window.addEventListener('pagehide',()=>{stopMic();if(!claimed&&!replaying&&ready){clearTimeout(saveTimer);db.days[day]={cardId:card.id,mask:foil.toDataURL(),progress};persist();}});
setInterval(refreshDay,1000);
loadDay();resizeDust();requestAnimationFrame(frame);
if(document.modelContext?.registerTool){for(const tool of [{name:'get_garage',description:'Read the locally collected cards and today’s scratch progress.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({date:day,progress,claimed,collection:cards.filter(c=>db.owned[c.id]).map(c=>({id:c.id,name:c.name,count:db.owned[c.id].count}))})},{name:'open_garage',description:'Open the collection view. Does not grant cards.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(input&&Object.keys(input).length)throw new Error('No arguments expected');showCollection(true);return{view:'collection'};}}]){try{Promise.resolve(document.modelContext.registerTool(tool)).catch(()=>{});}catch{}}}
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});

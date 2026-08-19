"use strict";
(function(){
const cv=document.getElementById('scope'), ctx=cv.getContext('2d',{alpha:false});
const stage=document.getElementById('stage');
let DPR=Math.min(window.devicePixelRatio||1,2), W=0,H=0, CX=0,CY=0, R=0;

// --- reduced motion ---
const RM = window.matchMedia('(prefers-reduced-motion: reduce)');
let reduceMotion = RM.matches;
RM.addEventListener?.('change', e=>{reduceMotion=e.matches;});

// ---------- state ----------
const WAVES=['sine','triangle','square','sawtooth'];
function osc(f,a,p,w){return{freq:f,amp:a,phase:p,wave:w};}
const S={
  mode:'lissajous',
  running:false, muted:false, frozen:false, gallery:false,
  crt:true, bloom:true, persist:0.90,
  drift:0, rot:0, damp:0.20,
  modType:'off', modDepth:0.30,
  phos:{name:'P1 Green', core:[210,255,190], edge:[40,255,120]},
  vol:0.6,
  // X pair + Y pair (2 osc per axis available; second amp 0 = single)
  X:[osc(3,1,0,'sine'), osc(6,0,Math.PI/2,'sine')],
  Y:[osc(2,1,0,'sine'), osc(4,0,0,'sine')],
};

const PHOS=[
  {name:'P1 Green',core:[210,255,190],edge:[40,255,120]},
  {name:'White',   core:[255,255,255],edge:[180,210,255]},
  {name:'Amber',   core:[255,230,170],edge:[255,150,40]},
  {name:'Blue',    core:[200,225,255],edge:[60,140,255]},
];

const RATIOS=[
  {r:'1:1',x:1,y:1},{r:'1:2',x:1,y:2},{r:'2:3',x:2,y:3},{r:'3:4',x:3,y:4},
  {r:'3:2',x:3,y:2},{r:'5:4',x:5,y:4},{r:'4:5',x:4,y:5},{r:'5:6',x:5,y:6},
  {r:'FREE',x:0,y:0},
];

const PRESETS=[
  {n:'Circle',       s:{mode:'lissajous',X:[[3,1,Math.PI/2,'sine']],Y:[[3,1,0,'sine']],damp:0}},
  {n:'Trefoil',      s:{mode:'lissajous',X:[[3,1,0,'sine']],Y:[[2,1,0,'sine']],damp:0}},
  {n:'Weave 3:4',    s:{mode:'lissajous',X:[[3,1,Math.PI/4,'sine']],Y:[[4,1,0,'sine']],damp:0}},
  {n:'Star 5:4',     s:{mode:'lissajous',X:[[5,1,0,'sine']],Y:[[4,1,Math.PI/2,'sine']],damp:0}},
  {n:'Franke Ribbon',s:{mode:'lissajous',X:[[2,1,0,'triangle']],Y:[[3,1,0.6,'sine']],damp:0}},
  {n:'Pendulum',     s:{mode:'harmonograph',X:[[3.01,1,0,'sine'],[6.02,.5,1.1,'sine']],Y:[[2.99,1,.7,'sine'],[4.0,.4,0,'sine']],damp:0.28}},
  {n:'Spiral Rose',  s:{mode:'harmonograph',X:[[4,1,0,'sine'],[8.01,.3,.5,'sine']],Y:[[5.01,1,1.2,'sine']],damp:0.35}},
  {n:'Laposky VII',  s:{mode:'harmonograph',X:[[5,1,0,'sine'],[7.02,.6,2.0,'sine']],Y:[[6.01,1,.4,'sine'],[3,.5,1,'sine']],damp:0.22}},
];

// ---------- audio ----------
let AC=null, master=null, aX=null, aY=null, aXg=null, aYg=null, modGain=null;
const AX_BASE_GAIN=0.5;
function initAudio(){
  if(AC) return;
  AC=new (window.AudioContext||window.webkitAudioContext)();
  master=AC.createGain(); master.gain.value=S.muted?0:S.vol; master.connect(AC.destination);
  const merger=AC.createChannelMerger(2);
  aX=AC.createOscillator(); aXg=AC.createGain(); aX.connect(aXg); aXg.connect(merger,0,0);
  aY=AC.createOscillator(); aYg=AC.createGain(); aY.connect(aYg); aYg.connect(merger,0,1);
  merger.connect(master);
  aXg.gain.value=AX_BASE_GAIN; aYg.gain.value=0.5;
  // modulator tap: aY's own direct output is unaffected by this second
  // connection. modGain's output is routed onto whichever AudioParam the
  // current modulation type targets (see syncAudioModulation), so the
  // audio you hear tracks the same FM/AM the eye sees on the trace,
  // rather than modulation being a visual-only effect.
  modGain=AC.createGain(); modGain.gain.value=0;
  aY.connect(modGain);
  aX.start(); aY.start();
  syncAudioModulation();
}
const BASE=110; // Hz for freq index 1
function audioFreq(idx){return BASE*idx;}
function syncAudioModulation(){
  if(!AC) return;
  try{ modGain.disconnect(); }catch(e){ /* not connected yet, fine */ }
  const now=AC.currentTime;
  if(S.modType==='am'){
    modGain.gain.setTargetAtTime(S.modDepth*0.4, now, 0.02);
    modGain.connect(aXg.gain);
  }else if(S.modType==='fm'){
    modGain.gain.setTargetAtTime(S.modDepth*audioFreq(S.X[0].freq)*0.8, now, 0.02);
    modGain.connect(aX.frequency);
  }else{
    modGain.gain.setTargetAtTime(0, now, 0.02);
  }
}
function updateAudio(){
  if(!AC) return;
  const fx=audioFreq(S.X[0].freq), fy=audioFreq(S.Y[0].freq);
  aX.frequency.setTargetAtTime(fx,AC.currentTime,0.02);
  aY.frequency.setTargetAtTime(fy,AC.currentTime,0.02);
  aX.type=S.X[0].wave; aY.type=S.Y[0].wave;
  master.gain.setTargetAtTime(S.muted||!S.running?0:S.vol,AC.currentTime,0.02);
  syncAudioModulation();
}

// ---------- waveforms ----------
function wf(type,ph){
  const t=ph/(2*Math.PI), x=t-Math.floor(t);
  switch(type){
    case 'sine': return Math.sin(ph);
    case 'square': return x<0.5?1:-1;
    case 'sawtooth': return 2*x-1;
    case 'triangle': return 4*Math.abs(x-0.5)-1;
    default: return Math.sin(ph);
  }
}
function axisVal(pair,t,driftPh,damp){
  let v=0;
  for(const o of pair){
    if(o.amp===0) continue;
    const d = S.mode==='harmonograph' ? Math.exp(-damp*t) : 1;
    v += o.amp*d*wf(o.wave, o.freq*t + o.phase + driftPh);
  }
  return v;
}

// ---------- sizing ----------
function resize(){
  const r=stage.getBoundingClientRect();
  W=Math.max(2,Math.floor(r.width)); H=Math.max(2,Math.floor(r.height));
  cv.width=W*DPR; cv.height=H*DPR; cv.style.width=W+'px'; cv.style.height=H+'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
  CX=W/2; CY=H/2; R=Math.min(W,H)*0.40;
  ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
}
// Debounced resize with a brief fade, so an orientation change (or a
// browser window drag) does not read as a hard cut of the trace. Canvas
// dimension changes always clear pixel content per spec, so the fade is
// camouflage for an unavoidable clear rather than an attempt to prevent it.
let resizeDebounce=null, resizeRAF=null;
function scheduleResize(){
  clearTimeout(resizeDebounce);
  resizeDebounce=setTimeout(()=>{
    cv.style.opacity='0';
    resizeRAF=requestAnimationFrame(()=>{
      resize();
      requestAnimationFrame(()=>{ cv.style.opacity='1'; });
    });
  },80);
}
window.addEventListener('resize',scheduleResize);
window.addEventListener('orientationchange',scheduleResize);

// ---------- render ----------
// driftPhase and rotAngle are wrapped modulo 2*PI each frame rather than
// accumulated forever. Both only ever feed additive phase into periodic
// trig calls (Math.sin/cos), so wrapping is exact and avoids the
// floating-point precision loss an unbounded accumulator would eventually
// hit on a long-running gallery-mode session.
let driftPhase=0, rotAngle=0;
const TWO_PI=Math.PI*2;
function fade(){
  // accumulate with low-alpha black => phosphor trail
  ctx.globalCompositeOperation='source-over';
  ctx.fillStyle='rgba(0,0,0,'+(1-S.persist)+')';
  ctx.fillRect(0,0,W,H);
}
function drawFrame(dt){
  const c=S.phos.core, e=S.phos.edge;
  const cycles = S.mode==='harmonograph'?1:1;
  const N = 1400;
  // one full period for lissajous; a long sweep for harmonograph
  const span = S.mode==='harmonograph' ? 26 : 2*Math.PI;
  let px=null,py=null;
  ctx.globalCompositeOperation='lighter';
  ctx.lineCap='round';
  for(let i=0;i<=N;i++){
    const t = (i/N)*span;
    let dp = driftPhase;
    let xv=axisVal(S.X,t,dp,S.damp);
    let yv=axisVal(S.Y,t,0,S.damp);
    // modulation
    if(S.modType==='fm'){ xv=axisVal(S.X,t + S.modDepth*yv, dp, S.damp); }
    else if(S.modType==='am'){ xv*=(1+S.modDepth*yv); }
    // rotation
    if(S.rot!==0){ const a=S.rot*Math.PI + rotAngle;
      const cs=Math.cos(a),sn=Math.sin(a); const nx=xv*cs-yv*sn, ny=xv*sn+yv*cs; xv=nx; yv=ny; }
    const X=CX+xv*R, Y=CY-yv*R;
    if(px!==null){
      // velocity => intensity (slow=bright)
      const seg=Math.hypot(X-px,Y-py);
      const inten=Math.max(0.10, Math.min(1, 2.2/(seg+1.2)));
      const w = S.bloom? 1.6:1.1;
      // outer bloom
      if(S.bloom){
        ctx.strokeStyle='rgba('+e[0]+','+e[1]+','+e[2]+','+(0.06*inten)+')';
        ctx.lineWidth=w*5; ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(X,Y);ctx.stroke();
        ctx.strokeStyle='rgba('+e[0]+','+e[1]+','+e[2]+','+(0.12*inten)+')';
        ctx.lineWidth=w*2.4; ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(X,Y);ctx.stroke();
      }
      // core
      ctx.strokeStyle='rgba('+c[0]+','+c[1]+','+c[2]+','+(0.9*inten)+')';
      ctx.lineWidth=w; ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(X,Y);ctx.stroke();
    }
    px=X;py=Y;
  }
}

// CRT overlay drawn to a separate layer once (cached)
let crtCanvas=null;
function buildCRT(){
  crtCanvas=document.createElement('canvas'); crtCanvas.width=W; crtCanvas.height=H;
  const g=crtCanvas.getContext('2d');
  // scanlines
  g.globalAlpha=1;
  for(let y=0;y<H;y+=3){ g.fillStyle='rgba(0,0,0,0.20)'; g.fillRect(0,y,W,1); }
  // vignette
  const grad=g.createRadialGradient(CX,CY,R*0.6,CX,CY,Math.max(W,H)*0.75);
  grad.addColorStop(0,'rgba(0,0,0,0)'); grad.addColorStop(1,'rgba(0,0,0,0.7)');
  g.fillStyle=grad; g.fillRect(0,0,W,H);
}
function loop(ts){
  if(!loop.last) loop.last=ts;
  let dt=(ts-loop.last)/1000; loop.last=ts; if(dt>0.1)dt=0.1;
  if(S.running && !S.frozen){
    if(!reduceMotion){
      driftPhase += S.drift*dt*0.8;
      if(driftPhase>TWO_PI) driftPhase-=TWO_PI; else if(driftPhase<-TWO_PI) driftPhase+=TWO_PI;
      rotAngle += S.rot*0.3*dt;
      if(rotAngle>TWO_PI) rotAngle-=TWO_PI; else if(rotAngle<-TWO_PI) rotAngle+=TWO_PI;
    }
    fade();
    drawFrame(dt);
    if(S.crt){
      if(!crtCanvas||crtCanvas.width!==W||crtCanvas.height!==H) buildCRT();
      ctx.globalCompositeOperation='source-over';
      ctx.drawImage(crtCanvas,0,0);
    }
  }
  updateReadout();
  requestAnimationFrame(loop);
}

// ---------- musical interval ----------
function gcd(a,b){a=Math.round(a);b=Math.round(b);while(b){[a,b]=[b,a%b];}return a||1;}
const INTERVALS={ '1/1':'Unison','2/1':'Octave','3/2':'Perfect 5th','4/3':'Perfect 4th',
  '5/4':'Major 3rd','6/5':'Minor 3rd','5/3':'Major 6th','8/5':'Minor 6th',
  '9/8':'Major 2nd','16/9':'Minor 7th','15/8':'Major 7th','3/1':'Octave+5th','4/1':'2 Octaves'};
function intervalName(fx,fy){
  const hi=Math.max(fx,fy), lo=Math.min(fx,fy); const g=gcd(hi,lo);
  const n=hi/g, d=lo/g; return INTERVALS[n+'/'+d]||(n+':'+d+' ratio');
}

// ---------- readouts ----------
const readoutEl=document.getElementById('readout');
const signalNote=document.getElementById('signalNote');
function updateReadout(){
  const fx=S.X[0].freq, fy=S.Y[0].freq;
  const g=gcd(fx,fy);
  readoutEl.innerHTML=
    '<span class="k">X</span> '+audioFreq(fx).toFixed(1)+' Hz &nbsp; '+S.X[0].wave+'<br>'+
    '<span class="k">Y</span> '+audioFreq(fy).toFixed(1)+' Hz &nbsp; '+S.Y[0].wave+'<br>'+
    '<span class="k">RATIO</span> '+(fx/g)+':'+(fy/g)+
    (S.mode==='harmonograph'?'<br><span class="k">MODE</span> harmonograph':'');
  let note='X and Y oscillators are the same signals you hear and see. '+
    'Ratio <b style="color:var(--ink)">'+(fx/g)+':'+(fy/g)+'</b> → interval '+
    '<span class="interval">'+intervalName(audioFreq(fx),audioFreq(fy))+'</span>.';
  if(S.modType!=='off'){
    note+=' Modulation ('+S.modType.toUpperCase()+') is applied to both the trace and the audio.';
  }
  signalNote.innerHTML=note;
}

// ---------- UI build ----------
function buildOscUI(){
  const host=document.getElementById('oscHost'); host.innerHTML='';
  const make=(axis,label,cls)=>{
    const pair=S[axis];
    const box=document.createElement('div'); box.className='osc';
    box.innerHTML='<div class="osc-head"><b class="'+cls+'">'+label+'</b></div>';
    pair.forEach((o,i)=>{
      const sub=document.createElement('div');
      sub.style.cssText='margin-bottom:'+(i===0?'8px':'0')+
        (i>0?';opacity:.85':'');
      sub.innerHTML=
        '<div class="row" style="margin-bottom:6px">'+
        '<label class="field"><span class="lab">FREQ <b>'+o.freq.toFixed(2)+'</b></span>'+
        '<input type="range" min="0.25" max="12" step="0.01" value="'+o.freq+'" data-a="'+axis+'" data-i="'+i+'" data-p="freq"></label>'+
        '<label class="field"><span class="lab">AMP <b>'+o.amp.toFixed(2)+'</b></span>'+
        '<input type="range" min="0" max="1" step="0.01" value="'+o.amp+'" data-a="'+axis+'" data-i="'+i+'" data-p="amp"></label>'+
        '</div>'+
        '<div class="row" style="margin-bottom:6px">'+
        '<label class="field"><span class="lab">PHASE <b>'+o.phase.toFixed(2)+'</b></span>'+
        '<input type="range" min="0" max="6.28" step="0.01" value="'+o.phase+'" data-a="'+axis+'" data-i="'+i+'" data-p="phase"></label>'+
        '<label class="field"><span class="lab">WAVE</span>'+
        '<select data-a="'+axis+'" data-i="'+i+'" data-p="wave">'+
        WAVES.map(w=>'<option '+(w===o.wave?'selected':'')+'>'+w+'</option>').join('')+
        '</select></label></div>';
      box.appendChild(sub);
    });
    host.appendChild(box);
  };
  make('X','X · HORIZONTAL','');
  make('Y','Y · VERTICAL','y');
  host.querySelectorAll('input[type=range]').forEach(inp=>{
    inp.addEventListener('input',()=>{
      const a=inp.dataset.a,i=+inp.dataset.i,p=inp.dataset.p,v=+inp.value;
      S[a][i][p]=v;
      inp.parentElement.querySelector('b').textContent=v.toFixed(2);
      if(p==='freq'||p==='wave') updateAudio();
    });
  });
  host.querySelectorAll('select').forEach(sel=>{
    sel.addEventListener('change',()=>{
      S[sel.dataset.a][+sel.dataset.i][sel.dataset.p]=sel.value; updateAudio();
    });
  });
}

// presets / ratios / colours
function buildChips(){
  const pw=document.getElementById('presets');
  PRESETS.forEach(p=>{const c=document.createElement('div');c.className='chip';c.textContent=p.n;
    c.onclick=()=>{applyPreset(p);};pw.appendChild(c);});
  const rw=document.getElementById('ratios');
  RATIOS.forEach(rt=>{const c=document.createElement('div');c.className='chip';c.textContent=rt.r;
    c.dataset.r=rt.r;
    c.onclick=()=>{ if(rt.x){ S.X[0].freq=rt.x; S.Y[0].freq=rt.y; }
      buildOscUI(); markRatio(); updateAudio();};rw.appendChild(c);});
  const cw=document.getElementById('colours');
  PHOS.forEach((ph,i)=>{const s=document.createElement('div');s.className='swatch'+(i===0?' on':'');
    s.style.background='rgb('+ph.edge.join(',')+')';s.title=ph.name;
    s.onclick=()=>{S.phos=ph;document.documentElement.style.setProperty('--phos','rgb('+ph.core.join(',')+')');
      cw.querySelectorAll('.swatch').forEach(x=>x.classList.remove('on'));s.classList.add('on');};
    cw.appendChild(s);});
}
function markRatio(){
  const fx=S.X[0].freq,fy=S.Y[0].freq,g=gcd(fx,fy);
  const str=(fx/g)+':'+(fy/g);
  document.getElementById('ratioVal').textContent=(fx/g)+' : '+(fy/g);
  document.querySelectorAll('#ratios .chip').forEach(c=>{
    c.classList.toggle('on', c.dataset.r===str);
  });
}
function applyPreset(p){
  S.mode=p.s.mode;
  const pack=arr=>arr.map(a=>osc(a[0],a[1],a[2],a[3]));
  S.X=pack(p.s.X); while(S.X.length<2)S.X.push(osc(1,0,0,'sine'));
  S.Y=pack(p.s.Y); while(S.Y.length<2)S.Y.push(osc(1,0,0,'sine'));
  if(p.s.damp!==undefined){S.damp=p.s.damp;
    document.getElementById('damp').value=S.damp;
    document.getElementById('dampV').textContent=S.damp.toFixed(2);}
  syncMode(); buildOscUI(); markRatio(); updateAudio();
}
function syncMode(){
  document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('on',b.dataset.mode===S.mode));
  document.getElementById('dampWrap').style.opacity=S.mode==='harmonograph'?1:.4;
}

// ---------- controls wiring ----------
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{S.mode=b.dataset.mode;syncMode();updateReadout();});
const link=(id,key,fmt,fx)=>{const el=document.getElementById(id);const lab=document.getElementById(id+'V');
  el.addEventListener('input',()=>{S[key]=+el.value; if(lab)lab.textContent=(fmt?fmt(+el.value):(+el.value).toFixed(2)); fx&&fx();});};
link('drift','drift'); link('rot','rot'); link('damp','damp'); link('pers','persist');
link('modDepth','modDepth',null,syncAudioModulation);
link('vol','vol',v=>Math.round(v*100)+'%',updateAudio);
document.getElementById('modType').onchange=e=>{S.modType=e.target.value;syncAudioModulation();};

const powerBtn=document.getElementById('power');
powerBtn.onclick=()=>{
  S.running=!S.running;
  powerBtn.classList.toggle('on',S.running);
  powerBtn.textContent=S.running?'◉ POWER ON':'○ POWER OFF';
  if(S.running){
    initAudio();
    AC.resume().catch(()=>{ /* resume can be rejected if the gesture was lost; audio simply stays silent */ });
  }
  updateAudio();
};
const muteBtn=document.getElementById('mute');
muteBtn.onclick=()=>{S.muted=!S.muted;muteBtn.classList.toggle('on',S.muted);
  muteBtn.textContent=S.muted?'UNMUTE':'MUTE';updateAudio();};
const freezeBtn=document.getElementById('freeze');
freezeBtn.onclick=()=>{S.frozen=!S.frozen;freezeBtn.classList.toggle('on',S.frozen);
  freezeBtn.textContent=S.frozen?'RESUME':'FREEZE';};
document.getElementById('snap').onclick=()=>{
  const a=document.createElement('a');
  a.download='oscillon-'+Date.now()+'.png'; a.href=cv.toDataURL('image/png'); a.click();
};
document.getElementById('crt').onclick=e=>{S.crt=!S.crt;e.target.classList.toggle('on',S.crt);};
document.getElementById('bloom').onclick=e=>{S.bloom=!S.bloom;e.target.classList.toggle('on',S.bloom);};

// randomise
document.getElementById('rand').onclick=()=>{
  const rr=RATIOS[Math.floor(Math.random()*(RATIOS.length-1))];
  S.mode=Math.random()<0.4?'harmonograph':'lissajous';
  S.X=[osc(rr.x||(1+Math.floor(Math.random()*6)),1,Math.random()*6.28,WAVES[Math.floor(Math.random()*4)]),
       osc((rr.x||3)*2,Math.random()<0.5?0:0.4,Math.random()*6.28,'sine')];
  S.Y=[osc(rr.y||(1+Math.floor(Math.random()*6)),1,Math.random()*6.28,WAVES[Math.floor(Math.random()*4)]),
       osc((rr.y||2)*2,Math.random()<0.5?0:0.4,Math.random()*6.28,'sine')];
  S.damp=0.15+Math.random()*0.3;
  document.getElementById('damp').value=S.damp;
  document.getElementById('dampV').textContent=S.damp.toFixed(2);
  syncMode();buildOscUI();markRatio();updateAudio();
};

// gallery mode
let galleryTimer=null;
const galleryTag=document.getElementById('gallery-tag');
document.getElementById('gallery').onclick=e=>{
  S.gallery=!S.gallery; e.target.classList.add('amber'); e.target.classList.toggle('on',S.gallery);
  galleryTag.classList.toggle('on',S.gallery);
  if(S.gallery){ if(!S.running)powerBtn.click();
    cycleGallery(); galleryTimer=setInterval(cycleGallery, reduceMotion?12000:9000);
  } else { clearInterval(galleryTimer); }
};
function cycleGallery(){
  const p=PRESETS[Math.floor(Math.random()*PRESETS.length)];
  applyPreset(p);
  S.phos=PHOS[Math.floor(Math.random()*PHOS.length)];
  document.documentElement.style.setProperty('--phos','rgb('+S.phos.core.join(',')+')');
  document.querySelectorAll('#colours .swatch').forEach((x,i)=>x.classList.toggle('on',PHOS[i]===S.phos));
  if(!reduceMotion){ S.drift=0.1+Math.random()*0.3; S.rot=(Math.random()-0.5)*0.4;
    document.getElementById('drift').value=S.drift; document.getElementById('rot').value=S.rot; }
}

// ---------- boot ----------
resize(); buildOscUI(); buildChips(); markRatio(); syncMode(); updateReadout();
document.documentElement.style.setProperty('--phos','rgb('+S.phos.core.join(',')+')');
requestAnimationFrame(loop);
})();

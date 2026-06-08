import { buildSegments, relMinToAngle } from './scheduleUtils';

const PIE_PAL = [
  'rgba(255,182,213,0.92)','rgba(220,190,255,0.92)','rgba(180,225,255,0.92)',
  'rgba(200,245,210,0.92)','rgba(255,235,160,0.92)','rgba(255,205,185,0.92)',
  'rgba(185,245,235,0.92)','rgba(235,205,255,0.92)','rgba(255,215,225,0.92)'
];

const dogSVG_ = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <ellipse cx="32" cy="30" rx="11" ry="15" fill="#d4956a" transform="rotate(-15,32,30)"/>
  <ellipse cx="68" cy="30" rx="11" ry="15" fill="#d4956a" transform="rotate(15,68,30)"/>
  <ellipse cx="32" cy="31" rx="7" ry="11" fill="#e8b090" transform="rotate(-15,32,31)"/>
  <ellipse cx="68" cy="31" rx="7" ry="11" fill="#e8b090" transform="rotate(15,68,31)"/>
  <circle cx="50" cy="55" r="31" fill="#f0c896"/>
  <circle cx="40" cy="48" r="5.5" fill="#2a1a08"/>
  <circle cx="60" cy="48" r="5.5" fill="#2a1a08"/>
  <circle cx="42" cy="46" r="2.2" fill="white"/>
  <circle cx="62" cy="46" r="2.2" fill="white"/>
  <ellipse cx="50" cy="59" rx="7.5" ry="5.5" fill="#2a1a08"/>
  <ellipse cx="48" cy="58" rx="2.2" ry="1.6" fill="rgba(255,255,255,0.45)"/>
  <path d="M43,65 Q50,72 57,65" stroke="#2a1a08" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <ellipse cx="35" cy="64" rx="7.5" ry="5" fill="rgba(255,120,120,0.35)"/>
  <ellipse cx="65" cy="64" rx="7.5" ry="5" fill="rgba(255,120,120,0.35)"/>
</svg>`;

export const dogImg = new Image();
dogImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(dogSVG_);

function _drawStar(ctx, x, y, r, color) {
  ctx.save(); ctx.translate(x,y);
  ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 8;
  ctx.beginPath();
  for(let i = 0; i < 5; i++){
    const a = (i*4*Math.PI/5)-Math.PI/2, ai = (i*4*Math.PI/5+2*Math.PI/5)-Math.PI/2;
    if(i===0) ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r);
    else ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
    ctx.lineTo(Math.cos(ai)*(r*0.42), Math.sin(ai)*(r*0.42));
  }
  ctx.closePath(); ctx.fill(); ctx.restore();
}

// childPhotoImg 캐시 (모듈 레벨)
let _childPhotoImg = null;
let _childPhotoSrc = null;

export function drawPie(canvas, SCH, curD, curAP, childPhotoUrl, setNow) {
  if(!canvas) return;
  const ALL = SCH[curD] || [];
  const isFree = false; // FREE 지원 필요 시 파라미터 추가
  const ctx = canvas.getContext('2d');
  const W=300, cx=150, cy=150;
  const R=105, outerR=134, numR=120, innerR=46;
  ctx.clearRect(0,0,W,W);

  const nowH = new Date().getHours()+new Date().getMinutes()/60+new Date().getSeconds()/3600;

  ctx.beginPath(); ctx.arc(cx,cy,outerR,0,Math.PI*2);
  ctx.fillStyle='rgba(242,246,255,0.55)'; ctx.fill();
  ctx.strokeStyle='rgba(195,210,238,0.7)'; ctx.lineWidth=2; ctx.stroke();

  if(!ALL.length){
    ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2);
    ctx.fillStyle='rgba(240,248,255,0.8)'; ctx.fill();
    ctx.strokeStyle='rgba(180,210,240,0.6)'; ctx.lineWidth=2.5; ctx.stroke();
    setNow && setNow('스케쥴을 설정해주세요!','','👨‍👩‍👧');
  } else {
    const segs = buildSegments(ALL, curAP);
    let ci=0;
    segs.forEach(seg=>{
      if(seg._overnight) return;
      const sa=relMinToAngle(seg.relMin);
      const ea=relMinToAngle(seg.relMin+seg.durMin);
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,R,sa,ea); ctx.closePath();
      ctx.fillStyle=seg.isEmpty?'rgba(240,248,255,0.5)':PIE_PAL[ci%PIE_PAL.length];
      ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,0.98)'; ctx.lineWidth=2.8; ctx.stroke();
      if(!seg.isEmpty) ci++;
    });

    ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2);
    ctx.strokeStyle='rgba(175,190,225,0.75)'; ctx.lineWidth=2.5; ctx.stroke();

    const apBase=curAP==='am'?0:12;
    segs.forEach(seg=>{
      if(seg.isEmpty||seg._overnight) return;
      const sH=apBase+seg.relMin/60, eH=apBase+(seg.relMin+seg.durMin)/60;
      if(nowH>=sH&&nowH<eH){
        const sa=relMinToAngle(seg.relMin), ea=relMinToAngle(seg.relMin+seg.durMin);
        ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,R,sa,ea); ctx.closePath();
        ctx.strokeStyle='rgba(255,140,40,0.75)'; ctx.lineWidth=4; ctx.stroke();
      }
    });

    ci=0;
    segs.forEach(seg=>{
      if(seg.isEmpty||seg._overnight||!seg.emoji){if(!seg.isEmpty)ci++;return;}
      const midA=relMinToAngle(seg.relMin+seg.durMin/2);
      const er=R*0.75;
      const ex=cx+Math.cos(midA)*er, ey=cy+Math.sin(midA)*er;
      const durH=seg.durMin/60;
      const sz=Math.min(28,Math.max(14,durH*7));
      const bgR=sz*0.7;
      ctx.beginPath(); ctx.arc(ex,ey,bgR,0,Math.PI*2);
      ctx.fillStyle='rgba(255,255,255,0.72)'; ctx.fill();
      ctx.strokeStyle='rgba(220,225,245,0.8)'; ctx.lineWidth=1.2; ctx.stroke();
      ctx.font=`${sz}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(seg.emoji,ex,ey);
      if(durH>=1.2){
        const ny2=ey+bgR+8;
        ctx.font='bold 8.5px Nunito,-apple-system,Malgun Gothic,sans-serif';
        ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.lineWidth=3.5; ctx.strokeText(seg.name,ex,ny2);
        ctx.fillStyle='rgba(30,45,100,0.85)'; ctx.fillText(seg.name,ex,ny2);
      }
      ci++;
    });

    let curItem=ALL[ALL.length-1], nextItem=null;
    for(let i=0;i<ALL.length;i++){
      if(nowH>=ALL[i].start&&nowH<ALL[i].start+ALL[i].dur){curItem=ALL[i];nextItem=ALL[i+1]||null;break;}
    }
    setNow && setNow(
      '지금은 · ' + curItem.name + ' 중',
      nextItem ? '다음: ' + nextItem.name + ' · ' + formatH(nextItem.start) : '오늘도 수고했어요! 🎉',
      curItem.emoji || '📌'
    );
  }

  for(let i=0;i<12;i++){
    const a=(i/12)*Math.PI*2-Math.PI/2;
    ctx.beginPath();
    ctx.moveTo(cx+Math.cos(a)*(R+3),cy+Math.sin(a)*(R+3));
    ctx.lineTo(cx+Math.cos(a)*(R+13),cy+Math.sin(a)*(R+13));
    ctx.strokeStyle='rgba(150,170,215,0.75)'; ctx.lineWidth=2; ctx.stroke();
  }

  const labels = curAP==='am'
    ?['12','1','2','3','4','5','6','7','8','9','10','11']
    :['12','13','14','15','16','17','18','19','20','21','22','23'];
  for(let i=0;i<12;i++){
    const a=(i/12)*Math.PI*2-Math.PI/2;
    const nx=cx+Math.cos(a)*numR, ny=cy+Math.sin(a)*numR;
    ctx.font='bold 11px Nunito,-apple-system,Malgun Gothic,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.strokeStyle='rgba(255,255,255,0.92)'; ctx.lineWidth=3.5; ctx.strokeText(labels[i],nx,ny);
    ctx.fillStyle='rgba(130,50,110,0.9)'; ctx.fillText(labels[i],nx,ny);
  }

  drawH(canvas, curAP, childPhotoUrl);
}

function formatH(h) {
  return String(Math.floor(h)).padStart(2,'0') + ':' + String(Math.round((h%1)*60)).padStart(2,'0');
}

export function drawH(canvas, curAP, childPhotoUrl) {
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const cx=150, cy=150, innerR=46;
  const now = new Date();
  const nowH = now.getHours()+now.getMinutes()/60+now.getSeconds()/3600;
  const from = curAP==='am'?0:12, to = curAP==='am'?12:24;

  ctx.save(); ctx.shadowColor='rgba(200,100,200,0.25)'; ctx.shadowBlur=12;
  ctx.beginPath(); ctx.arc(cx,cy,innerR,0,Math.PI*2); ctx.fillStyle='white'; ctx.fill();
  ctx.restore();
  const pg=ctx.createRadialGradient(cx-3,cy-4,0,cx,cy,innerR);
  pg.addColorStop(0,'#ffffff'); pg.addColorStop(1,'#fdf0ff');
  ctx.beginPath(); ctx.arc(cx,cy,innerR,0,Math.PI*2); ctx.fillStyle=pg; ctx.fill();

  ctx.save();
  ctx.beginPath(); ctx.arc(cx,cy,innerR-2,0,Math.PI*2); ctx.clip();
  if(childPhotoUrl) {
    if(!_childPhotoImg || _childPhotoSrc !== childPhotoUrl) {
      _childPhotoImg = new Image();
      _childPhotoSrc = childPhotoUrl;
      _childPhotoImg.src = childPhotoUrl;
    }
    if(_childPhotoImg.complete && _childPhotoImg.naturalWidth > 0) {
      ctx.drawImage(_childPhotoImg, cx-innerR+2, cy-innerR+2, (innerR-2)*2, (innerR-2)*2);
    }
  } else if(dogImg.complete && dogImg.naturalWidth > 0){
    ctx.drawImage(dogImg, cx-innerR+2, cy-innerR+2, (innerR-2)*2, (innerR-2)*2);
  } else {
    ctx.font=`${innerR*1.1}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('🐶',cx,cy+3);
  }
  ctx.restore();

  ctx.beginPath(); ctx.arc(cx,cy,innerR,0,Math.PI*2);
  ctx.strokeStyle='rgba(255,160,210,0.85)'; ctx.lineWidth=2.8; ctx.stroke();

  const hA=((nowH-from)/(to-from))*Math.PI*2-Math.PI/2;
  const handStart = innerR + 4;
  const handEnd = 72;
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,0.15)'; ctx.shadowBlur=3;
  ctx.beginPath();
  ctx.moveTo(cx+Math.cos(hA)*handStart, cy+Math.sin(hA)*handStart);
  ctx.lineTo(cx+Math.cos(hA)*handEnd,   cy+Math.sin(hA)*handEnd);
  ctx.strokeStyle='rgba(20,20,20,0.92)'; ctx.lineWidth=2.5; ctx.lineCap='round'; ctx.stroke();
  ctx.restore();
  _drawStar(ctx, cx+Math.cos(hA)*(handEnd+5), cy+Math.sin(hA)*(handEnd+5), 6, 'rgba(20,20,20,0.9)');

  if(!childPhotoUrl) {
    ctx.beginPath(); ctx.arc(cx,cy,5,0,Math.PI*2); ctx.fillStyle='rgba(180,30,120,0.85)'; ctx.fill();
  }
}

export function drawPreviewPie(canvas, items, ap) {
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const sz=100, cx=50, cy=50, ro=44, ri=26;
  ctx.clearRect(0,0,sz,sz);
  const segs = buildSegments(items, ap);
  segs.forEach(seg => {
    const sa = relMinToAngle(seg.relMin);
    const ea = relMinToAngle(seg.relMin + seg.durMin);
    ctx.globalAlpha = seg.isEmpty ? 0.2 : seg._overnight ? 0.35 : 1.0;
    ctx.beginPath();
    ctx.arc(cx,cy,ro,sa,ea);
    ctx.arc(cx,cy,ri,ea,sa,true);
    ctx.closePath();
    ctx.fillStyle = seg.isEmpty ? '#c8dce8' : seg.color||'#ccc';
    ctx.fill();
    if(!seg.isEmpty){
      ctx.globalAlpha=0.6;
      ctx.strokeStyle='rgba(255,255,255,0.8)';
      ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(cx,cy,ro,sa,ea);ctx.arc(cx,cy,ri,ea,sa,true);ctx.closePath();ctx.stroke();
    }
  });
  ctx.globalAlpha=1.0;
  [0,6].forEach(relH=>{
    const angle=relMinToAngle(relH*60);
    ctx.beginPath();
    ctx.moveTo(cx+Math.cos(angle)*(ri-2),cy+Math.sin(angle)*(ri-2));
    ctx.lineTo(cx+Math.cos(angle)*(ri+3),cy+Math.sin(angle)*(ri+3));
    ctx.strokeStyle='rgba(255,255,255,0.85)';ctx.lineWidth=1.5;ctx.stroke();
  });
}

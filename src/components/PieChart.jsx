import { useRef, useEffect, useCallback } from 'react';
import { buildSegments, relMinToAngle, H } from '../utils/scheduleUtils';

const PIE_PAL = [
  'rgba(255,182,213,0.92)','rgba(220,190,255,0.92)','rgba(180,225,255,0.92)',
  'rgba(200,245,210,0.92)','rgba(255,235,160,0.92)','rgba(255,205,185,0.92)',
  'rgba(185,245,235,0.92)','rgba(235,205,255,0.92)','rgba(255,215,225,0.92)'
];

// ── 아이콘 PNG 사전 로드 ──
const _BASE = (process.env.PUBLIC_URL || '') + '/icons/';

const ICON_FILE_MAP = {
  '기상':               '13_기상.png',
  '학교':               '1_학교.png',
  '영어학원':           '2_영어학원.png',
  '수학학원':           '3_수학학원.png',
  '점심':               '3_점심.png',
  '스포츠':             '4_스포츠.png',
  '피아노':             '5_피아노.png',
  '수영':               '6_수영장.png',
  '숙제':               '7_숙제.png',
  '독서':               '8_독서.png',
  '자유시간':           '9_자유시간.png',
  '꿈나라':             '10_꿈나라.png',
  '직접입력(도착알림)': '11_직접입력_도착알림.png',
  '직접입력':           '12_직접입력.png',
};

const _iconCache = {};
let isShowingClickInfo = false;

const centerImg = new Image();
centerImg.src = _BASE + '0_파이차트 가운데.png';

let _childPhotoImg = null;
let _childPhotoSrcCache = null;


export default function PieChart({ SCH, curD, curAP, childPhotoUrl, onNowChange }) {
  const canvasRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if(!canvas) return;
    const ALL = SCH[curD] || [];
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W=300, cx=150, cy=150;
    const R=105, outerR=134, numR=120;
    ctx.clearRect(0,0,W,W);

    const nowH = new Date().getHours()+new Date().getMinutes()/60+new Date().getSeconds()/3600;

    ctx.beginPath(); ctx.arc(cx,cy,outerR,0,Math.PI*2);
    ctx.fillStyle='rgba(242,246,255,0.55)'; ctx.fill();
    ctx.strokeStyle='rgba(195,210,238,0.7)'; ctx.lineWidth=2; ctx.stroke();

    if(!ALL.length){
      ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2);
      ctx.fillStyle='rgba(240,248,255,0.8)'; ctx.fill();
      ctx.strokeStyle='rgba(180,210,240,0.6)'; ctx.lineWidth=2.5; ctx.stroke();
      onNowChange && onNowChange('스케쥴을 설정해주세요!','','👨‍👩‍👧');
    } else {
      const segs = buildSegments(ALL, curAP);
      let ci=0;
      segs.forEach(seg=>{
        const sa=relMinToAngle(seg.relMin), ea=relMinToAngle(seg.relMin+seg.durMin);
        ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,R,sa,ea); ctx.closePath();
        if(seg._overnight){
          ctx.fillStyle='rgba(180,220,255,0.88)';
        } else {
          ctx.fillStyle=seg.isEmpty?'rgba(240,248,255,0.5)':PIE_PAL[ci%PIE_PAL.length];
        }
        ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,0.98)'; ctx.lineWidth=2.8; ctx.stroke();
        if(!seg.isEmpty && !seg._overnight) ci++;
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
        if(seg.isEmpty||!seg.emoji){if(!seg.isEmpty)ci++;return;}
        if(!seg._overnight && seg.durMin < 60){ci++;return;}
        const midA=relMinToAngle(seg.relMin+seg.durMin/2);
        const imgSz = seg._overnight
          ? (seg.durMin >= 240 ? 84 : 42)
          : (seg.name === '기상' ? 62 : 42);
        const er = seg._overnight ? (R - imgSz/2) : R*0.72;
        const ex=cx+Math.cos(midA)*er, ey=cy+Math.sin(midA)*er;

        // catId 기반 조회: custom 항목은 seg.name이 사용자 입력값이므로 catId로 대체
        const iconKey = ICON_FILE_MAP[seg.name] ? seg.name
          : seg.catId === 'custom_arrive' ? '직접입력(도착알림)'
          : seg.catId === 'custom' ? '직접입력'
          : seg.name;
        let img = _iconCache[iconKey];
        if(!img && ICON_FILE_MAP[iconKey]) {
          img = new Image();
          img.onload = draw;
          img.src = _BASE + ICON_FILE_MAP[iconKey];
          _iconCache[iconKey] = img;
        }

        if(seg._overnight) {
          // overnight 전용: 달 PNG가 이미지 좌측 편향이므로 우측으로 보정
          const ix = Math.round(ex - imgSz/2 + imgSz * 0.12);
          const iy = Math.round(ey - imgSz/2);
          if(img && img.complete && img.naturalWidth > 0) {
            ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, ix, iy, imgSz, imgSz);
          } else {
            ctx.font=`${imgSz}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText(seg.emoji, ex, ey);
          }
          ctx.font='bold 9px Malgun Gothic,sans-serif';
          ctx.textAlign='center'; ctx.textBaseline='top';
          ctx.fillStyle='#1a1a3c';
          ctx.fillText(seg.name, ex, ey + imgSz/2 - 10);
        } else {
          if(img && img.complete && img.naturalWidth > 0) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, Math.round(ex - imgSz/2), Math.round(ey - imgSz/2), imgSz, imgSz);
          } else {
            ctx.font=`${imgSz}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText(seg.emoji, ex, ey);
          }
          if(seg.durMin >= 90) {
            const ny2 = ey + imgSz/2 - 8;
            ctx.font='bold 9px Malgun Gothic,sans-serif';
            ctx.textAlign='center'; ctx.textBaseline='top';
            ctx.fillStyle='#1a1a3c'; ctx.fillText(seg.name, ex, ny2);
          }
        }
        ci++;
      });

      const _fallback={name:'쉬는시간',emoji:'🍃'};
      let curItem=_fallback, nextItem=null;
      for(let i=0;i<ALL.length;i++){
        if(nowH>=ALL[i].start&&nowH<ALL[i].start+ALL[i].dur){curItem=ALL[i];nextItem=ALL[i+1]||null;break;}
      }
      if(curItem===_fallback&&nextItem===null){
        nextItem=ALL.filter(ev=>ev.start>nowH).sort((a,b)=>a.start-b.start)[0]||null;
      }
      const mainTxt='지금은 · '+curItem.name+' 중';
      const nextTxt=nextItem?'다음: '+nextItem.name+' · '+H(nextItem.start):'오늘도 수고했어요! 🎉';
      console.log('[draw onNowChange] main:', mainTxt, '/ blocked:', isShowingClickInfo);
      if(!isShowingClickInfo) onNowChange && onNowChange(mainTxt, nextTxt, curItem.emoji||'📌');
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

    drawHInner(ctx, curAP, childPhotoUrl);
  }, [SCH, curD, curAP, childPhotoUrl, onNowChange]);

  const handleCanvasClick = useCallback((e) => {
    const cx = 150, cy = 150, R = 105;
    const ox = e.nativeEvent.offsetX, oy = e.nativeEvent.offsetY;
    const dx = ox - cx, dy = oy - cy;
    if (Math.sqrt(dx*dx + dy*dy) > R) return;

    let clickAngle = Math.atan2(dy, dx);
    if (clickAngle < -Math.PI/2) clickAngle += 2 * Math.PI;

    console.log('[PieClick] offsetX:', ox, 'offsetY:', oy);
    console.log('[PieClick] clickAngle (rad):', clickAngle, '→', (clickAngle * 180 / Math.PI).toFixed(1) + '°');

    const ALL = SCH[curD] || [];
    if (!ALL.length) return;
    const segs = buildSegments(ALL, curAP);
    console.log('[PieClick] segs:', segs);

    const seg = segs.find(s => {
      if (s.isEmpty || s._overnight) return false;
      return clickAngle >= relMinToAngle(s.relMin) && clickAngle < relMinToAngle(s.relMin + s.durMin);
    });
    console.log('[PieClick] found seg:', seg);
    if (!seg) return;

    const apBase = curAP === 'am' ? 0 : 12;
    const t1 = H(apBase + seg.relMin / 60);
    const t2 = H(apBase + (seg.relMin + seg.durMin) / 60);
    isShowingClickInfo = true;
    console.log('[PieClick onNowChange] main:', `${seg.name}  ${t1}~${t2}`, '/ next: "" / emoji:', seg.emoji || '📌');
    onNowChange && onNowChange(`${seg.name}  ${t1}~${t2}`, '', seg.emoji || '📌');

    setTimeout(() => {
      isShowingClickInfo = false;
      const nowH = new Date().getHours() + new Date().getMinutes()/60 + new Date().getSeconds()/3600;
      const _fallback2={name:'쉬는시간',emoji:'🍃'};
      let curItem = _fallback2, nextItem = null;
      for (let i = 0; i < ALL.length; i++) {
        if (nowH >= ALL[i].start && nowH < ALL[i].start + ALL[i].dur) {
          curItem = ALL[i]; nextItem = ALL[i+1] || null; break;
        }
      }
      if(curItem===_fallback2&&nextItem===null){
        nextItem=ALL.filter(ev=>ev.start>nowH).sort((a,b)=>a.start-b.start)[0]||null;
      }
      onNowChange && onNowChange(
        '지금은 · ' + curItem.name + ' 중',
        nextItem ? '다음: ' + nextItem.name + ' · ' + H(nextItem.start) : '오늘도 수고했어요! 🎉',
        curItem.emoji || '📌'
      );
    }, 1500);
  }, [SCH, curD, curAP, onNowChange]);

  function drawHInner(ctx, curAP, childPhotoUrl) {
    const cx=150, cy=150, innerR=46;
    const now = new Date();
    const nowH = now.getHours()+now.getMinutes()/60+now.getSeconds()/3600;
    const from = curAP==='am'?0:12, to = curAP==='am'?12:24;

    ctx.save(); ctx.shadowColor='transparent'; ctx.shadowBlur=0;
    ctx.beginPath(); ctx.arc(cx,cy,innerR,0,Math.PI*2); ctx.fillStyle='white'; ctx.fill();
    ctx.restore();
    const pg=ctx.createRadialGradient(cx-3,cy-4,0,cx,cy,innerR);
    pg.addColorStop(0,'#ffffff'); pg.addColorStop(1,'#fdf0ff');
    ctx.beginPath(); ctx.arc(cx,cy,innerR,0,Math.PI*2); ctx.fillStyle=pg; ctx.fill();

    ctx.save();
    ctx.beginPath(); ctx.arc(cx,cy,innerR-2,0,Math.PI*2); ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if(childPhotoUrl) {
      if(!_childPhotoImg || _childPhotoSrcCache !== childPhotoUrl) {
        _childPhotoImg = new Image();
        _childPhotoSrcCache = childPhotoUrl;
        _childPhotoImg.onload = () => draw();
        _childPhotoImg.src = childPhotoUrl;
      }
      if(_childPhotoImg.complete && _childPhotoImg.naturalWidth > 0) {
        const d=(innerR-2)*3, p=cx-d/2;
        ctx.drawImage(_childPhotoImg, p, p, d, d);
      }
    } else if(centerImg.complete && centerImg.naturalWidth > 0){
      const diam=(innerR-2)*2;
      const ar=centerImg.naturalWidth/centerImg.naturalHeight;
      const dw=diam, dh=diam/ar;
      ctx.drawImage(centerImg, cx-dw/2, cy-dh/2+3, dw, dh);
    } else {
      ctx.font=`${innerR*1.1}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('🐶',cx,cy+3);
    }
    ctx.restore();

    ctx.beginPath(); ctx.arc(cx,cy,innerR,0,Math.PI*2);
    ctx.strokeStyle='rgba(255,160,210,0.85)'; ctx.lineWidth=2.8; ctx.stroke();

    const hA=((nowH-from)/(to-from))*Math.PI*2-Math.PI/2;
    const handStart = innerR + 4;
    const handEnd = 109;
    const hx1=cx+Math.cos(hA)*handStart, hy1=cy+Math.sin(hA)*handStart;
    const hx2=cx+Math.cos(hA)*handEnd,   hy2=cy+Math.sin(hA)*handEnd;
    const grad=ctx.createLinearGradient(hx1,hy1,hx2,hy2);
    grad.addColorStop(0,'rgba(220,40,40,0.05)');
    grad.addColorStop(0.5,'rgba(220,40,40,0.05)');
    grad.addColorStop(1,'rgba(220,40,40,0.96)');
    ctx.save();
    ctx.shadowColor='transparent'; ctx.shadowBlur=0;
    ctx.beginPath();
    ctx.moveTo(hx1,hy1); ctx.lineTo(hx2,hy2);
    ctx.strokeStyle=grad; ctx.lineWidth=2.5; ctx.lineCap='round'; ctx.stroke();
    ctx.beginPath(); ctx.arc(hx2,hy2,4,0,Math.PI*2);
    ctx.fillStyle='rgba(220,40,40,0.96)'; ctx.fill();
    ctx.restore();

    if(!childPhotoUrl) {
      ctx.beginPath(); ctx.arc(cx,cy,5,0,Math.PI*2); ctx.fillStyle='rgba(180,30,120,0.85)'; ctx.fill();
    }
  }

  // canvas DPR 설정 후 그리기 시작
  useEffect(() => {
    const canvas = canvasRef.current;
    if(canvas) {
      const dpr = window.devicePixelRatio || 2;
      canvas.width = 300 * dpr;
      canvas.height = 300 * dpr;
      canvas.style.width = '300px';
      canvas.style.height = '300px';
    }
    draw();
    const tick = setInterval(draw, 1000);
    return () => clearInterval(tick);
  }, [draw]);

  return (
    <div className="chart-outer" style={{marginTop:14}}>
      <canvas ref={canvasRef} id="pieC" width="300" height="300" onClick={handleCanvasClick} style={{cursor:'pointer'}} />
    </div>
  );
}

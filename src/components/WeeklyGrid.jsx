import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { DN, DS, WK_CATS, H, T, buildSegments, relMinToAngle } from '../utils/scheduleUtils';

const WK_END_H = 24;
const SLOT_MIN = 10;
const SLOT_PX = 7;

function wkStartH(amView) { return amView ? 7 : 13; }
function wkSlotCount(amView) { return (WK_END_H - wkStartH(amView)) * 60 / SLOT_MIN; }
function wkTotalPx(amView) { return wkSlotCount(amView) * SLOT_PX; }
function wkHtoY(h, amView) { return (h - wkStartH(amView)) * 60 / SLOT_MIN * SLOT_PX; }
function wkYtoH(y, amView) { return wkStartH(amView) + y / SLOT_PX * SLOT_MIN / 60; }

function PreviewPie({ items, ap }) {
  const canvasRef = useRef(null);
  const sz=100, cx=50, cy=50, ro=44, ri=26;

  const draw = (canvas) => {
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
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
  };

  return <canvas ref={c=>{if(c)draw(c)}} width={sz} height={sz} />;
}

export default function WeeklyGrid() {
  const { SCH, saveSCH, FREE, toast } = useApp();
  const [amView, setAmView] = useState(true);
  const [selDay, setSelDay] = useState(-1);
  const [popup, setPopup] = useState(null); // {dayIdx, startH, editIdx}
  const [selCat, setSelCat] = useState(null);
  const [longMenu, setLongMenu] = useState(null);
  const longTapTimer = useRef(null);

  const totalPx = wkTotalPx(amView);
  const startH = wkStartH(amView);

  const showPreview = (dayIdx) => {
    setSelDay(dayIdx);
  };

  const openPopup = (dayIdx, startH, editIdx) => {
    const existing = editIdx >= 0 ? (SCH[dayIdx]||[])[editIdx] : null;
    setPopup({ dayIdx, startH, editIdx, existing });
    if(existing) {
      const matched = WK_CATS.find(c=>c.n===existing.name);
      setSelCat(matched || WK_CATS.find(c=>c.id==='custom') || null);
    } else {
      setSelCat(null);
    }
  };

  const confirmBlock = () => {
    if(!popup) return;
    const {dayIdx, editIdx, existing} = popup;
    const sEl = document.getElementById('wkS');
    const eEl = document.getElementById('wkE');
    if(!sEl||!eEl) return;
    const s = T(sEl.value), e = T(eEl.value);
    if(e<=s){toast('종료 시간이 시작보다 늦어야 해요!');return;}
    if(!selCat){toast('일정을 선택해주세요!');return;}

    let name = selCat.n;
    if(selCat.id==='custom'||selCat.id==='custom_arrive'){
      const cn = document.getElementById('wkCustomName');
      name = cn?cn.value.trim():'';
      if(!name){toast('일정 이름을 입력해주세요!');return;}
    }

    const items = JSON.parse(JSON.stringify(SCH[dayIdx]||[]));
    const overlap = items.some((it,idx)=>{
      if(idx===editIdx) return false;
      return s < it.start+it.dur && e > it.start;
    });
    if(overlap){toast('다른 일정과 시간이 겹쳐요! ⚠️');return;}

    const ev = {name,emoji:selCat.e,color:selCat.c,catId:selCat.id,start:s,dur:Math.max(0.1667,e-s),time:H(s)+'~'+H(e)};
    if(editIdx>=0) items[editIdx]=ev;
    else items.push(ev);
    items.sort((a,b)=>a.start-b.start);

    const newSCH = {...SCH, [dayIdx]:items};
    saveSCH(newSCH, FREE);
    setPopup(null);
    setSelCat(null);
    toast('저장됐어요! 홈에 바로 반영됐어요 🎉');
  };

  const deleteBlock = () => {
    if(!popup||popup.editIdx<0) return;
    const {dayIdx, editIdx} = popup;
    const items = JSON.parse(JSON.stringify(SCH[dayIdx]||[]));
    items.splice(editIdx,1);
    const newSCH = {...SCH,[dayIdx]:items};
    saveSCH(newSCH, FREE);
    setPopup(null);
    toast('삭제됐어요! 🗑️');
  };

  const copyBlock = (fromDay, idx, toDay) => {
    const ev = JSON.parse(JSON.stringify((SCH[fromDay]||[])[idx]));
    const items = JSON.parse(JSON.stringify(SCH[toDay]||[]));
    const overlap = items.some(it=>ev.start<it.start+it.dur&&ev.start+ev.dur>it.start);
    if(overlap){toast(`⚠️ ${DN[toDay]}요일에 겹치는 일정이 있어요!`);return;}
    items.push(ev);
    items.sort((a,b)=>a.start-b.start);
    const newSCH = {...SCH,[toDay]:items};
    saveSCH(newSCH, FREE);
    setLongMenu(null);
    toast(`${DN[toDay]}요일 복사 완료! ✓`);
  };

  const deleteFromMenu = (dayIdx, idx) => {
    const items = JSON.parse(JSON.stringify(SCH[dayIdx]||[]));
    items.splice(idx,1);
    const newSCH = {...SCH,[dayIdx]:items};
    saveSCH(newSCH, FREE);
    setLongMenu(null);
    toast('삭제됐어요!');
  };

  const selItems = selDay >= 0 ? (SCH[selDay]||[]) : [];

  return (
    <div>
      {/* 헤더 */}
      <div style={{margin:'10px 14px 6px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{fontSize:13,fontWeight:800,color:'#0d5a7a'}}>📅 주간 스케쥴</div>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <span style={{fontSize:11,color:'#8aaac8'}}>오전포함</span>
          <div onClick={()=>setAmView(!amView)}
            style={{width:36,height:20,borderRadius:10,background:amView?'#3a9bd5':'#d4eaf5',cursor:'pointer',position:'relative',transition:'background 0.2s'}}>
            <div style={{position:'absolute',top:2,left:amView?18:2,width:16,height:16,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}} />
          </div>
        </div>
      </div>

      {/* 그리드 */}
      <div id="wkGrid">
        {/* 헤더 빈칸 */}
        <div style={{background:'#f0f8ff',borderBottom:'1.5px solid #ddeef8',borderRight:'1px solid #e8f0f8',height:30}} />
        {DS.map((d, i)=>{
          const hasData = SCH[i]&&SCH[i].length>0;
          const isSel = i===selDay;
          return (
            <div key={d} onClick={()=>showPreview(i)}
              style={{background:isSel?'#e8f3ff':'#f0f8ff',borderBottom:isSel?'2.5px solid #3a9bd5':'1.5px solid #ddeef8',borderRight:'1px solid #e8f0f8',height:30,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',boxShadow:isSel?'inset 0 -2px 0 #3a9bd5':'none'}}>
              <span style={{fontSize:11,fontWeight:800,color:isSel?'#3a9bd5':i>=5?'#ff8fab':'#5a8aa8'}}>{d}</span>
              {hasData&&<span style={{width:5,height:5,borderRadius:'50%',background:isSel?'#3a9bd5':'#b0d4f0',marginLeft:2,display:'inline-block'}} />}
            </div>
          );
        })}

        {/* 시간 컬럼 */}
        <div style={{position:'relative',height:totalPx+10,borderRight:'1px solid #e8f0f8',background:'white'}}>
          {Array.from({length:wkSlotCount(amView)+1},(_,s)=>{
            const h = startH + s * SLOT_MIN / 60;
            if(Math.round(h*60)%60===0){
              return <div key={s} style={{position:'absolute',top:s*SLOT_PX+3,right:2,fontSize:8,fontWeight:700,color:'#9dbdd4',lineHeight:1}}>{Math.floor(h)}</div>;
            }
            return null;
          })}
        </div>

        {/* 요일 컬럼 */}
        {DS.map((d, dayIdx)=>{
          const isSel = dayIdx===selDay;
          return (
            <div key={d} style={{position:'relative',height:totalPx,borderRight:'1px solid #eef4fa',background:isSel?'#f0f7ff':'white',overflow:'hidden',outline:isSel?'2px solid #3a9bd5':'none',outlineOffset:-1,zIndex:isSel?1:0}}>
              {/* 시간 줄 */}
              {Array.from({length:WK_END_H-startH+1},(_,i)=>(
                <div key={i} style={{position:'absolute',top:wkHtoY(startH+i,amView),left:0,right:0,borderTop:'1px solid #eef4fa',pointerEvents:'none'}} />
              ))}
              {/* 빈칸 클릭 */}
              <div style={{position:'absolute',inset:0,zIndex:0}} onClick={e=>{
                const rect = e.currentTarget.parentElement.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const rawH = wkYtoH(y, amView);
                const h = Math.round(rawH*6)/6;
                openPopup(dayIdx, Math.max(startH, Math.min(WK_END_H-0.5, h)), -1);
              }} />
              {/* 블럭 */}
              {(SCH[dayIdx]||[]).map((ev,idx)=>{
                const top = wkHtoY(ev.start, amView);
                const ht = Math.max(ev.dur*60/SLOT_MIN*SLOT_PX-2, 14);
                if(top+ht<0||top>totalPx) return null;
                return (
                  <div key={idx}
                    style={{position:'absolute',left:2,right:2,top,height:ht,background:ev.color,borderRadius:5,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.15)',border:'1.5px solid rgba(255,255,255,0.6)',zIndex:2}}
                    onClick={e=>{e.stopPropagation();openPopup(dayIdx,ev.start,idx);}}
                    onTouchStart={()=>{longTapTimer.current=setTimeout(()=>setLongMenu({dayIdx,idx,ev}),600);}}
                    onTouchEnd={()=>clearTimeout(longTapTimer.current)}
                    onTouchMove={()=>clearTimeout(longTapTimer.current)}
                  >
                    {ht>24
                      ? <span style={{fontSize:8,fontWeight:800,color:'white',lineHeight:1.3,textAlign:'center',padding:'0 2px',wordBreak:'keep-all',overflow:'hidden',maxWidth:'100%',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{ev.emoji} {ev.name}</span>
                      : <span style={{fontSize:9,color:'white',fontWeight:800}}>{ev.emoji}</span>
                    }
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* 미리보기 */}
      {selDay >= 0 && (
        <div style={{display:'block',margin:'10px 14px 0',background:'rgba(255,255,255,0.92)',borderRadius:18,padding:14,boxShadow:'0 2px 10px rgba(80,140,200,0.08)'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <div style={{fontSize:12,fontWeight:800,color:'#0d5a7a'}}>👀 {DN[selDay]} 미리보기</div>
          </div>
          <div style={{display:'flex',gap:12,alignItems:'center'}}>
            <div style={{flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
              <div style={{fontSize:10,color:'#5aaac8',fontWeight:700,textAlign:'center'}}>☀️ 오전</div>
              <PreviewPie items={selItems} ap="am" />
              <div style={{fontSize:10,color:'#5aaac8',fontWeight:700,textAlign:'center'}}>🌙 오후</div>
              <PreviewPie items={selItems} ap="pm" />
            </div>
            <div style={{flex:1,overflow:'hidden'}}>
              <div style={{display:'flex',flexDirection:'column',gap:3,marginTop:4}}>
                {selItems.length
                  ? selItems.map((it,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:5}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:it.color,flexShrink:0}} />
                      <span style={{fontSize:10,fontWeight:700,color:'#1a3a5c',flex:1}}>{it.emoji} {it.name}</span>
                      <span style={{fontSize:9,color:'#8aaac8'}}>{it.time||''}</span>
                    </div>
                  ))
                  : <div style={{fontSize:11,color:'#8aaac8',marginTop:8}}>일정이 없어요</div>
                }
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{height:14}} />

      {/* 블럭 추가/편집 팝업 */}
      {popup && (
        <div className="popup-overlay" onClick={e=>{if(e.target===e.currentTarget){setPopup(null);setSelCat(null);}}}>
          <div style={{background:'white',borderRadius:'22px 22px 0 0',padding:20,width:'100%',maxWidth:420,maxHeight:'80vh',overflowY:'auto'}}>
            <div style={{fontSize:14,fontWeight:800,color:'#0d5a7a',marginBottom:12}}>
              {popup.existing?'✏️ 일정 수정':'➕ 일정 추가'} · {DN[popup.dayIdx]}
            </div>
            <div style={{display:'flex',gap:8,marginBottom:12}}>
              <div style={{flex:1,textAlign:'center'}}>
                <div style={{fontSize:10,color:'#8aaac8',marginBottom:4}}>시작</div>
                <input id="wkS" type="time" step="600"
                  defaultValue={H(popup.existing?popup.existing.start:popup.startH)}
                  style={{width:'100%',padding:8,borderRadius:10,border:'1.5px solid #d4eaf5',fontSize:15,textAlign:'center',outline:'none',fontFamily:'inherit'}} />
              </div>
              <div style={{display:'flex',alignItems:'flex-end',paddingBottom:8,color:'#8aaac8',fontSize:18}}>~</div>
              <div style={{flex:1,textAlign:'center'}}>
                <div style={{fontSize:10,color:'#8aaac8',marginBottom:4}}>종료</div>
                <input id="wkE" type="time" step="600"
                  defaultValue={H(popup.existing?popup.existing.start+popup.existing.dur:popup.startH+1)}
                  style={{width:'100%',padding:8,borderRadius:10,border:'1.5px solid #d4eaf5',fontSize:15,textAlign:'center',outline:'none',fontFamily:'inherit'}} />
              </div>
            </div>
            <div style={{fontSize:11,fontWeight:700,color:'#0d5a7a',marginBottom:8}}>어떤 일정인가요?</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginBottom:14}}>
              {WK_CATS.map(cat=>(
                <button key={cat.id} onClick={()=>setSelCat(cat)}
                  style={{padding:'8px 4px',borderRadius:10,border:`2px solid ${selCat?.id===cat.id?cat.c:'#e8f0f8'}`,background:selCat?.id===cat.id?cat.c+'22':'white',cursor:'pointer',fontFamily:'inherit',transition:'all 0.15s'}}>
                  <div style={{fontSize:18}}>{cat.e}</div>
                  <div style={{fontSize:9,fontWeight:700,color:'#1a4a6a',marginTop:2}}>{cat.n}</div>
                </button>
              ))}
            </div>
            {(selCat?.id==='custom'||selCat?.id==='custom_arrive') && (
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,color:'#8aaac8',marginBottom:4}}>{selCat.id==='custom_arrive'?'📍 장소/일정 이름 입력':'📝 일정 이름 입력'}</div>
                <input id="wkCustomName" type="text" placeholder="이름 입력" maxLength={8}
                  defaultValue={popup.existing?.name||''}
                  style={{width:'100%',padding:10,borderRadius:10,border:'1.5px solid #d4eaf5',fontSize:14,outline:'none',fontFamily:'inherit'}} />
              </div>
            )}
            <div style={{display:'flex',gap:8}}>
              {popup.existing&&<button onClick={deleteBlock} style={{flex:1,padding:12,borderRadius:13,background:'#fff0f0',color:'#e05555',fontSize:13,fontWeight:700,border:'none',cursor:'pointer',fontFamily:'inherit'}}>🗑️ 삭제</button>}
              <button onClick={confirmBlock} style={{flex:2,padding:12,borderRadius:13,background:'linear-gradient(135deg,#3a9bd5,#2ec4a9)',color:'white',fontSize:13,fontWeight:700,border:'none',cursor:'pointer',fontFamily:'inherit'}}>✓ 확인</button>
            </div>
          </div>
        </div>
      )}

      {/* 롱탭 복사/삭제 메뉴 */}
      {longMenu && (
        <div className="popup-overlay" onClick={e=>{if(e.target===e.currentTarget)setLongMenu(null);}}>
          <div style={{background:'white',borderRadius:'22px 22px 0 0',padding:20,width:'100%',maxWidth:420}}>
            <div style={{fontSize:13,fontWeight:800,color:'#0d5a7a',marginBottom:12}}>{longMenu.ev.emoji} {longMenu.ev.name} · {DN[longMenu.dayIdx]}</div>
            <div style={{fontSize:11,fontWeight:700,color:'#5a8aa8',marginBottom:8}}>📋 다른 요일에 복사</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:14}}>
              {DS.map((d,i)=>i===longMenu.dayIdx?null:(
                <button key={d} onClick={()=>copyBlock(longMenu.dayIdx,longMenu.idx,i)}
                  style={{padding:'7px 12px',borderRadius:10,border:'1.5px solid #d4eaf5',background:'white',fontSize:12,fontWeight:700,color:'#3a9bd5',cursor:'pointer',fontFamily:'inherit'}}>{d}요일</button>
              ))}
            </div>
            <button onClick={()=>deleteFromMenu(longMenu.dayIdx,longMenu.idx)}
              style={{width:'100%',padding:12,borderRadius:13,background:'#fff0f0',color:'#e05555',fontSize:13,fontWeight:700,border:'none',cursor:'pointer',fontFamily:'inherit'}}>🗑️ 삭제</button>
          </div>
        </div>
      )}
    </div>
  );
}

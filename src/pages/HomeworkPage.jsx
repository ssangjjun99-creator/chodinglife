import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DS, HW_INFO, formatDateLabel, getMonday } from '../utils/scheduleUtils';

const HW_NAMES_MAP = {
  '학교':    {id:'sch',  n:'학교',     e:'🏫', c:'#7b9ef7', bg:'#f0f4ff'},
  '영어학원':{id:'eng',  n:'영어학원', e:'📖', c:'#ffaa55', bg:'#fff8f0'},
  '수학학원':{id:'math', n:'수학학원', e:'📚', c:'#b07ef7', bg:'#f8f0ff'},
};

export default function HomeworkPage() {
  const { role, SCH, hwData, hwExtra, hwLog, parentApproveHw, saveHwData, saveHwExtra, uploadHwPhoto, deleteHwPhoto, getHwPhoto, getHwLastPhoto, hwLastData, toast, bonus } = useApp();
  const [selectedCard, setSelectedCard] = useState(null); // {key, name, emoji, color}
  const [showLastWeek, setShowLastWeek] = useState(false);
  const [dayPopup, setDayPopup] = useState(null); // 부모 탭용
  const [showParentLastWeek, setShowParentLastWeek] = useState(false);
  const [addPopup, setAddPopup] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDays, setNewDays] = useState([]);

  const DN_KR = ['월','화','수','목','금','토','일'];
  const today = new Date().getDay();
  const todayIdx = today === 0 ? 6 : today - 1;

  const HW_NAMES = {...HW_NAMES_MAP};
  hwExtra.forEach(ex => {
    HW_NAMES[ex.name] = {id:'extra_'+ex.name, n:ex.name, e:'✍️', c:'#ff7043', bg:'#fff4f0'};
  });

  const found = {};
  for(let i=0;i<7;i++){
    const items = SCH[i]||[];
    const seenNames = new Set();
    items.forEach(it=>{
      const nm = it.name;
      if(HW_NAMES[nm]&&!seenNames.has(nm)){
        seenNames.add(nm);
        if(!found[nm]) found[nm] = new Set();
        found[nm].add(i);
      }
    });
  }
  hwExtra.forEach(ex=>{
    if(!found[ex.name]){
      const days = ex.days||[0,1,2,3,4,5,6];
      found[ex.name] = new Set(days);
    }
  });

  const keys = Object.keys(found).filter(nm=>found[nm].size>0);

  const viewPhoto = (url) => {
    const overlay = document.createElement('div');
    overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:9999;display:flex;align-items:center;justify-content:center;';
    overlay.onclick = ()=>overlay.remove();
    overlay.innerHTML=`<img src="${url}" style="max-width:92vw;max-height:88vh;border-radius:16px;object-fit:contain;" alt=""><button style="position:absolute;top:20px;right:20px;width:36px;height:36px;border-radius:50%;border:none;background:rgba(255,255,255,0.2);color:white;font-size:20px;cursor:pointer">×</button>`;
    document.body.appendChild(overlay);
  };

  // 아이 탭 사진 업로드 (createElement 방식)
  const triggerChildPhoto = (key, ds, hw) => {
    const old = document.getElementById('_hwPhotoInput');
    if(old) old.remove();
    const inp = document.createElement('input');
    inp.type='file'; inp.accept='image/*'; inp.id='_hwPhotoInput';
    inp.style.cssText='position:fixed;top:-999px;left:-999px;opacity:0;';
    inp.onchange = () => {
      const file = inp.files[0]; if(!file){inp.remove();return;}
      uploadHwPhoto(key, ds, file, ()=>{ inp.remove(); setSelectedCard(prev=>prev?{...prev}:null); });
      toast('📷 사진이 첨부됐어요!');
    };
    document.body.appendChild(inp);
    inp.click();
  };

  // 아이 상세화면 - 날짜 카드 1개
  const renderDetailDayCard = (dayIdx, isLast) => {
    const {key, color} = selectedCard;
    const ds = 'day_' + dayIdx;
    const hw = isLast ? ((hwLastData[key]||{})[ds]||{}) : ((hwData[key]||{})[ds]||{});
    const photo = isLast ? getHwLastPhoto(key, ds) : getHwPhoto(key, ds);
    const isToday = !isLast && dayIdx === todayIdx;
    const isDone = hw.status === 'done';
    const isPending = hw.status === 'pending';
    const statusColor = isDone ? '#2bc87a' : isPending ? '#ffaa55' : '#c8dce8';
    const statusText = isDone ? '✅ 완료' : isPending ? '⏳ 제출함' : '📋 미완료';
    const dateLabel = (isLast ? '지난주 ' : '') + formatDateLabel(dayIdx);

    return (
      <div key={dayIdx} style={{
        background: isToday ? '#eef7ff' : 'white',
        borderRadius:16, padding:'14px 16px', marginBottom:10,
        boxShadow:'0 2px 8px rgba(80,140,200,0.08)',
        border: isLast ? '1.5px solid #f0f0f0' : '1.5px solid #e8f0f8',
        opacity:isLast?0.85:1
      }}>
        {/* 날짜 + 상태 + 완료 버튼 */}
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
              <span style={{fontSize:13,fontWeight:800,color:isLast?'#8aaac8':'#0d5a7a'}}>{dateLabel}</span>
              {isToday&&<span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:6,background:color+'22',color:color}}>오늘</span>}
              {isLast&&<span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:6,background:'#f0f0f0',color:'#8aaac8'}}>지난주</span>}
            </div>
            <div style={{fontSize:11,fontWeight:700,color:statusColor,marginTop:2}}>{statusText}</div>
          </div>
          {!isLast&&(
            isDone
              ?<div style={{padding:'8px 14px',borderRadius:11,background:'#e8faf0',color:'#2bc87a',fontSize:11,fontWeight:700}}>완료 ✓</div>
              :isPending
              ?<div style={{padding:'8px 14px',borderRadius:11,background:'#fff8e1',color:'#c07000',fontSize:11,fontWeight:700}}>제출함</div>
              :<button
                onClick={()=>{
                  const newData={...hwData,[key]:{...(hwData[key]||{}),[ds]:{...hw,status:'pending'}}};
                  saveHwData(newData);
                  toast('제출했어요! 부모님이 확인하면 완료돼요');
                }}
                style={{padding:'8px 14px',borderRadius:11,border:'none',background:`linear-gradient(135deg,${color},${color}cc)`,color:'white',fontSize:12,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>
                제출하기
              </button>
          )}
        </div>

        {/* 사진 */}
        <div style={{marginBottom:8}}>
          {photo
            ?<div style={{position:'relative',display:'inline-block'}}>
                <img src={photo} onClick={()=>viewPhoto(photo)} style={{width:80,height:80,objectFit:'cover',borderRadius:10,cursor:'pointer',border:`2px solid ${color}44`}} alt="" />
                {!isLast&&<button onClick={()=>deleteHwPhoto(key, ds)} style={{position:'absolute',top:-6,right:-6,width:20,height:20,borderRadius:'50%',border:'none',background:'#e05555',color:'white',fontSize:11,cursor:'pointer'}}>×</button>}
              </div>
            :!isLast
            ?<button onClick={()=>triggerChildPhoto(key,ds,hw)} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'7px 12px',borderRadius:10,border:'1.5px dashed #c8dce8',cursor:'pointer',background:'#fafcff',fontFamily:'inherit'}}>
                <span style={{fontSize:14}}>📷</span>
                <span style={{fontSize:11,color:'#8aaac8',fontWeight:700}}>사진 첨부</span>
              </button>
            :<span style={{fontSize:11,color:'#c8dce8'}}>사진 없음</span>
          }
        </div>

        {/* 메모 */}
        {!isLast
          ?<textarea
              key={ds}
              defaultValue={hw.memo||''}
              onBlur={e=>{
                const curHw=(hwData[key]||{})[ds]||{};
                const newData={...hwData,[key]:{...(hwData[key]||{}),[ds]:{...curHw,memo:e.target.value}}};
                saveHwData(newData);
              }}
              placeholder="📝 숙제 내용 메모 (페이지, 내용 등)"
              rows={2}
              style={{width:'100%',padding:'8px 10px',borderRadius:10,border:'1.5px solid #e8f0f8',fontSize:12,fontFamily:'inherit',resize:'none',color:'#1a3a5c',background:'#fafcff',boxSizing:'border-box'}}
            />
          :hw.memo
          ?<div style={{fontSize:11,color:'#8aaac8',padding:'6px 8px',background:'#f8f8f8',borderRadius:8}}>📝 {hw.memo}</div>
          :null
        }
      </div>
    );
  };

  // 아이 상세화면 전체
  const renderDetailView = () => {
    const {key, name, emoji} = selectedCard;
    const daySet = found[name];
    const dayList = daySet ? [...daySet].sort((a,b)=>a-b) : [];
    const lastDayList = [];
    for(let i=0;i<7;i++){
      if((hwLastData[key]||{})['day_'+i]) lastDayList.push(i);
    }

    return (
      <div>
        <div style={{display:'flex',alignItems:'center',gap:10,margin:'10px 14px 14px'}}>
          <button
            onClick={()=>{setSelectedCard(null);setShowLastWeek(false);}}
            style={{width:32,height:32,borderRadius:10,border:'none',background:'#e8f0f8',color:'#5a8aa8',fontSize:16,cursor:'pointer',fontFamily:'inherit'}}>
            ‹
          </button>
          <div style={{width:36,height:36,borderRadius:12,background:'#f0f4ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>{emoji}</div>
          <div style={{fontSize:15,fontWeight:800,color:'#0d5a7a',flex:1}}>{name} 숙제</div>
        </div>

        <div style={{margin:'0 14px'}}>
          {dayList.length===0
            ?<div style={{textAlign:'center',padding:24,color:'#8aaac8',fontSize:12}}>이번주 {name} 수업이 없어요</div>
            :dayList.map(d=>renderDetailDayCard(d,false))
          }

          {lastDayList.length>0&&(
            <div style={{marginTop:4}}>
              <button
                onClick={()=>setShowLastWeek(v=>!v)}
                style={{width:'100%',padding:10,borderRadius:12,border:'1.5px solid #e8f0f8',background:'white',color:'#8aaac8',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                📅 지난주 기록 보기 {showLastWeek?'▴':'▾'}
              </button>
              {showLastWeek&&<div style={{marginTop:8}}>{lastDayList.map(d=>renderDetailDayCard(d,true))}</div>}
            </div>
          )}
        </div>

        <div className="bb" style={{marginTop:10}}>
          <div className="bbl"><div className="bbs">숙제 포인트</div><div className="bbn">{Object.values(hwLog||{}).length*20}점</div></div>
          <div className="bbr"><div className="bbs">완료</div><div style={{fontSize:13,fontWeight:700}}>{Object.values(hwLog||{}).length}개</div></div>
        </div>
      </div>
    );
  };

  // 아이 탭: 카드 목록 or 상세화면
  const renderChildTab = () => {
    if(selectedCard) return renderDetailView();

    return (
      <div id="hwC">
        <div id="hwSubjectList" style={{margin:'10px 14px 0',display:'flex',flexDirection:'column',gap:10}}>
          {keys.length===0
            ?<div style={{textAlign:'center',padding:30,color:'#8aaac8',fontSize:13}}>스케쥴에 학교/학원을 추가하면<br/>숙제 목록이 자동으로 나타나요! 📅</div>
            :keys.map(nm=>{
                const info = HW_NAMES[nm];
                const daySet = found[nm];
                const dayList = [...daySet].sort((a,b)=>a-b);
                const total = dayList.length;
                const key = info.id;
                const done = dayList.filter(d=>(hwData[key]||{})['day_'+d]?.status==='done').length;
                const pending = dayList.filter(d=>(hwData[key]||{})['day_'+d]?.status==='pending').length;

                return (
                  <div key={nm}
                    onClick={()=>{setSelectedCard({key,name:nm,emoji:info.e,color:info.c});setShowLastWeek(false);}}
                    style={{
                      background:'white',borderRadius:18,padding:'16px 18px',
                      boxShadow:'0 3px 12px rgba(80,140,200,0.1)',
                      borderLeft:`5px solid ${info.c}`,cursor:'pointer',marginBottom:2
                    }}>
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <div style={{width:44,height:44,borderRadius:14,background:info.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{info.e}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,fontWeight:800,color:'#0d5a7a'}}>{nm} 숙제</div>
                        <div style={{fontSize:11,color:'#8aaac8',marginTop:2}}>주 {total}회 · {dayList.map(d=>DN_KR[d]).join('/')}요일</div>
                      </div>
                      <div style={{textAlign:'right',marginRight:4}}>
                        <div style={{fontSize:18,fontWeight:900,color:done===total&&total>0?'#2bc87a':info.c}}>{done}<span style={{fontSize:11,color:'#8aaac8'}}>/{total}</span></div>
                        <div style={{fontSize:10,color:'#8aaac8'}}>이번주</div>
                      </div>
                      <div style={{fontSize:18,color:'#c8dce8'}}>›</div>
                    </div>
                    {pending>0&&<div style={{marginTop:8,padding:'6px 10px',background:'#fff8e1',borderRadius:8,fontSize:11,color:'#c07000',fontWeight:700}}>⏳ 제출 {pending}건 · 확인 대기중</div>}
                  </div>
                );
              })
          }
        </div>
        <div className="bb" style={{marginTop:10}}>
          <div className="bbl"><div className="bbs">숙제 포인트</div><div className="bbn">{Object.values(hwLog||{}).length*20}점</div></div>
          <div className="bbr"><div className="bbs">완료</div><div style={{fontSize:13,fontWeight:700}}>{Object.values(hwLog||{}).length}개</div></div>
        </div>
      </div>
    );
  };

  // 부모 탭: 숙제 현황
  const renderParentTab = () => {
    const isLastWeek = showParentLastWeek;
    const activeData = isLastWeek ? hwLastData : hwData;
    const activeGetPhoto = isLastWeek ? getHwLastPhoto : getHwPhoto;
    const activeMonday = (() => {
      const mon = getMonday(new Date());
      if(isLastWeek) mon.setDate(mon.getDate() - 7);
      return mon;
    })();
    const formatActiveDate = (idx) => {
      const d = new Date(activeMonday);
      d.setDate(activeMonday.getDate() + idx);
      return (d.getMonth()+1) + '/' + d.getDate();
    };
    return (
    <div id="hwP">
      <div style={{margin:'10px 14px 0',background:'white',borderRadius:18,padding:'14px 16px',boxShadow:'0 2px 10px rgba(80,140,200,0.08)'}}>
        {/* 헤더: 제목 + 이번주/지난주 탭 */}
        <div style={{display:'flex',alignItems:'center',marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:800,color:'#0d5a7a',flex:1}}>
            📊 {isLastWeek?'지난주':'이번주'} 숙제 현황
          </div>
          <div style={{display:'flex',borderRadius:9,overflow:'hidden',border:'1.5px solid #e0eef8'}}>
            <button onClick={()=>setShowParentLastWeek(false)}
              style={{padding:'4px 11px',border:'none',background:!isLastWeek?'#3a9bd5':'white',color:!isLastWeek?'white':'#8aaac8',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
              이번주
            </button>
            <button onClick={()=>setShowParentLastWeek(true)}
              style={{padding:'4px 11px',border:'none',background:isLastWeek?'#3a9bd5':'white',color:isLastWeek?'white':'#8aaac8',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
              지난주
            </button>
          </div>
        </div>
        {keys.length === 0
          ? <div style={{textAlign:'center',padding:16,color:'#8aaac8',fontSize:12}}>스케쥴에 학교/학원 설정하면 여기 보여요</div>
          : keys.map(nm=>{
              const info = HW_NAMES[nm];
              const daySet = found[nm];
              const dayList = [...daySet].sort((a,b)=>a-b);
              const key = info.id;
              return (
                <div key={nm} style={{marginBottom:14}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                    <span style={{fontSize:14}}>{info.e}</span>
                    <span style={{fontSize:13,fontWeight:800,color:'#0d5a7a',flex:1}}>{nm}</span>
                    {!isLastWeek&&key.startsWith('extra_')&&(
                      <button
                        onClick={()=>{
                          if(window.confirm(`'${nm}' 항목을 삭제할까요?`)){
                            saveHwExtra(hwExtra.filter(ex=>ex.name!==nm));
                            toast('항목이 삭제됐어요');
                          }
                        }}
                        style={{padding:'3px 8px',borderRadius:7,border:'none',background:'#f5e8e8',color:'#c05555',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                        삭제
                      </button>
                    )}
                  </div>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {dayList.map(dayIdx=>{
                      const ds = 'day_'+dayIdx;
                      const hw = (activeData[key]||{})[ds]||{};
                      const photo = activeGetPhoto(key, ds);
                      const isToday = !isLastWeek && dayIdx===todayIdx;
                      const isDone = hw.status==='done';
                      const isPending = hw.status==='pending';
                      let bg='#f0f7ff', border='#e0eef8';
                      if(isDone){bg='#f0fdf4';}
                      else if(isPending){bg='#fff8e1';border='#ffaa55';}
                      else if(photo||hw.memo){bg='#f0f4ff';border=info.c;}
                      if(isToday&&!isDone) border=info.c;
                      const icon = photo?'📷':isPending?'⏳':isDone?'':'○';
                      return (
                        <div key={dayIdx}
                          onClick={()=>setDayPopup({key,name:nm,emoji:info.e,color:info.c,ds,isLastWeek})}
                          style={{minWidth:48,padding:'6px 8px',borderRadius:10,background:bg,border:`2px solid ${border}`,cursor:'pointer',textAlign:'center',position:'relative',overflow:'hidden'}}>
                          {isDone&&<div style={{position:'absolute',top:3,left:3,fontSize:9}}>✅</div>}
                          <div style={{fontSize:9,fontWeight:700,color:'#5a8aa8'}}>{DN_KR[dayIdx]}</div>
                          <div style={{fontSize:10,color:'#888',marginTop:1}}>{formatActiveDate(dayIdx)}</div>
                          <div style={{fontSize:14,marginTop:2}}>{icon}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
        }
        {!isLastWeek&&(
          <div style={{marginTop:8,textAlign:'right'}}>
            <button onClick={()=>showAddPopup()} style={{padding:'5px 12px',borderRadius:9,border:'none',background:'linear-gradient(135deg,#3a9bd5,#2ec4a9)',color:'white',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>+ 항목 추가</button>
          </div>
        )}
      </div>

      <div style={{margin:'10px 14px 0',background:'white',borderRadius:18,padding:'14px 16px',boxShadow:'0 2px 10px rgba(80,140,200,0.08)'}}>
        <div style={{fontSize:12,fontWeight:800,color:'#0d5a7a',marginBottom:10}}>🌟 보너스 포인트</div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          <button style={{padding:'9px 13px',borderRadius:12,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#e8faf0,#d4f5e5)',color:'#2bc87a',fontSize:12,fontWeight:700,fontFamily:'inherit'}} onClick={()=>bonus('착한 일',15)}>😊 착한일 +15점</button>
          <button style={{padding:'9px 13px',borderRadius:12,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#e8faf0,#d4f5e5)',color:'#2bc87a',fontSize:12,fontWeight:700,fontFamily:'inherit'}} onClick={()=>bonus('말씀 듣기',15)}>👂 말씀듣기 +15점</button>
          <button style={{padding:'9px 13px',borderRadius:12,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#e8faf0,#d4f5e5)',color:'#2bc87a',fontSize:12,fontWeight:700,fontFamily:'inherit'}} onClick={()=>bonus('방 청소',10)}>🧹 방청소 +10점</button>
        </div>
      </div>
    </div>
    );
  };

  const showAddPopup = () => { setNewName(''); setNewDays([]); setAddPopup(true); };

  const renderAddPopup = () => {
    if(!addPopup) return null;
    const DN = ['월','화','수','목','금','토','일'];
    const toggleDay = (i) => setNewDays(prev => prev.includes(i) ? prev.filter(d=>d!==i) : [...prev,i]);
    const handleSave = async () => {
      const name = newName.trim();
      if(!name){ toast('항목 이름을 입력해주세요'); return; }
      if(newDays.length===0){ toast('요일을 하나 이상 선택해주세요'); return; }
      if(hwExtra.some(ex=>ex.name===name)){ toast('이미 같은 이름의 항목이 있어요'); return; }
      await saveHwExtra([...hwExtra, {name, days: [...newDays].sort((a,b)=>a-b)}]);
      setAddPopup(false);
      toast('✅ 항목이 추가됐어요!');
    };
    return (
      <div className="popup-overlay" onClick={e=>{if(e.target===e.currentTarget)setAddPopup(false)}}>
        <div style={{background:'white',borderRadius:'22px 22px 0 0',padding:20,width:'100%',maxWidth:480,marginBottom:80}}>
          <div style={{fontSize:15,fontWeight:800,color:'#0d5a7a',marginBottom:16}}>+ 숙제 항목 추가</div>
          <div style={{fontSize:12,fontWeight:700,color:'#5a8aa8',marginBottom:6}}>항목 이름</div>
          <input
            value={newName}
            onChange={e=>setNewName(e.target.value)}
            placeholder="예: 바둑학원"
            maxLength={20}
            style={{width:'100%',padding:'10px 12px',borderRadius:10,border:'1.5px solid #d4eaf5',fontSize:14,fontFamily:'inherit',color:'#0d5a7a',outline:'none',boxSizing:'border-box',marginBottom:14}}
          />
          <div style={{fontSize:12,fontWeight:700,color:'#5a8aa8',marginBottom:8}}>요일 선택</div>
          <div style={{display:'flex',gap:5,marginBottom:20}}>
            {DN.map((d,i)=>(
              <button key={i} onClick={()=>toggleDay(i)}
                style={{flex:1,padding:'9px 0',borderRadius:9,border:'none',
                  background:newDays.includes(i)?'linear-gradient(135deg,#3a9bd5,#2ec4a9)':'#f0f4f8',
                  color:newDays.includes(i)?'white':'#8aaac8',
                  fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                {d}
              </button>
            ))}
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setAddPopup(false)}
              style={{flex:1,padding:12,borderRadius:14,border:'none',background:'#f0f4f8',color:'#8aaac8',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
              취소
            </button>
            <button onClick={handleSave}
              style={{flex:2,padding:12,borderRadius:14,border:'none',background:'linear-gradient(135deg,#3a9bd5,#2ec4a9)',color:'white',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>
              저장
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 날짜 팝업 (부모 탭용)
  const renderDayPopup = () => {
    if(!dayPopup) return null;
    const {key, name, emoji, color, ds, isLastWeek: popupIsLast} = dayPopup;
    const hw = (popupIsLast ? hwLastData : hwData)[key]?.[ds] || {};
    const photo = popupIsLast ? getHwLastPhoto(key, ds) : getHwPhoto(key, ds);
    const dayIdx = parseInt(ds.replace('day_',''));
    const isDone = hw.status==='done';
    const popupMon = (() => { const m = getMonday(new Date()); if(popupIsLast) m.setDate(m.getDate()-7); return m; })();
    const popupDateLabel = (() => { const d = new Date(popupMon); d.setDate(popupMon.getDate()+dayIdx); return `${d.getMonth()+1}/${d.getDate()} (${DS[dayIdx]})`; })();

    const triggerPhoto = () => {
      const old = document.getElementById('_hwPhotoInput');
      if(old) old.remove();
      const inp = document.createElement('input');
      inp.type='file'; inp.accept='image/*'; inp.id='_hwPhotoInput';
      inp.style.cssText='position:fixed;top:-999px;left:-999px;opacity:0;';
      inp.onchange = () => {
        const file = inp.files[0]; if(!file){inp.remove();return;}
        uploadHwPhoto(key, ds, file, ()=>{ inp.remove(); setDayPopup({...dayPopup}); });
      };
      document.body.appendChild(inp);
      inp.click();
    };

    return (
      <div className="popup-overlay" onClick={e=>{if(e.target===e.currentTarget)setDayPopup(null)}}>
        <div style={{background:'white',borderRadius:'22px 22px 0 0',padding:20,width:'100%',maxWidth:480,maxHeight:'calc(100vh - 80px)',overflowY:'auto',borderTop:isDone?'4px solid #3a9bd5':undefined,marginBottom:80}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
            <div style={{width:36,height:36,borderRadius:12,background:'#f0f4ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>{emoji}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:800,color:'#0d5a7a'}}>{name} · {popupDateLabel}</div>
              <div style={{fontSize:11,color:'#8aaac8'}}>{isDone?'✅ 완료':hw.status==='pending'?'⏳ 제출함':'📋 미완료'}</div>
            </div>
            {isDone&&<div style={{padding:'4px 10px',borderRadius:20,background:'#e8f3ff',color:'#3a9bd5',fontSize:11,fontWeight:800}}>✅ 완료</div>}
            <button onClick={()=>setDayPopup(null)} style={{width:30,height:30,borderRadius:'50%',border:'none',background:'#f0f0f0',color:'#888',fontSize:16,cursor:'pointer'}}>×</button>
          </div>

          {photo
            ?<div style={{position:'relative',marginBottom:10}}>
                <img src={photo} style={{width:'100%',maxHeight:200,objectFit:'contain',borderRadius:12,border:`1.5px solid ${color}44`}} onClick={()=>viewPhoto(photo)} alt="" />
                {!popupIsLast&&<button onClick={()=>deleteHwPhoto(key, ds)} style={{position:'absolute',top:6,right:6,padding:'4px 8px',borderRadius:8,border:'none',background:'rgba(0,0,0,0.5)',color:'white',fontSize:11,cursor:'pointer'}}>삭제</button>}
              </div>
            :!popupIsLast&&<button onClick={triggerPhoto} style={{width:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:6,padding:20,border:'2px dashed #c8dce8',borderRadius:12,cursor:'pointer',background:'#fafcff',marginBottom:10,fontFamily:'inherit'}}>
                <span style={{fontSize:28}}>📷</span>
                <span style={{fontSize:12,color:'#8aaac8',fontWeight:700}}>사진 첨부 (카메라/갤러리)</span>
              </button>
          }

          <div style={{fontSize:11,fontWeight:700,color:'#0d5a7a',marginBottom:6}}>숙제 내용</div>
          {popupIsLast
            ?<div style={{padding:'8px 10px',borderRadius:10,border:'1.5px solid #f0f0f0',fontSize:13,color:hw.memo?'#1a3a5c':'#c8dce8',background:'#fafafa',marginBottom:10,minHeight:56}}>
                {hw.memo||'메모 없음'}
              </div>
            :<textarea
                defaultValue={hw.memo||''}
                onBlur={e=>{
                  if(e.target.value === (hw.memo||'')) return;
                  const freshEntry = (hwData[key]||{})[ds]||{};
                  const newData={...hwData,[key]:{...(hwData[key]||{}),[ds]:{...freshEntry,memo:e.target.value}}};
                  saveHwData(newData);
                }}
                placeholder="숙제 내용 입력..."
                rows={3}
                style={{width:'100%',padding:10,borderRadius:10,border:'1.5px solid #e8f0f8',fontSize:13,fontFamily:'inherit',resize:'none',color:'#1a3a5c',background:'#fafcff',boxSizing:'border-box',marginBottom:10,outline:'none'}}
              />
          }

          {!popupIsLast&&<button onClick={()=>{parentApproveHw(key,ds);setDayPopup(null);}}
            style={{width:'100%',padding:12,borderRadius:14,border:'none',background:isDone?'#f0f0f0':'linear-gradient(135deg,#2bc87a,#1aaa60)',color:isDone?'#888':'white',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>
            {isDone?'↩️ 완료 취소 (-20점)':'✅ 완료 처리 +20점'}
          </button>}
        </div>
      </div>
    );
  };

  return (
    <div className="page" id="page-homework">
      <div className="sub-hd">
        <div className="sub-ttl">📚 숙제완료</div>
        <div className="sub-av">📝</div>
      </div>
      <div className="sp">
        {role === 'parent'
          ? renderParentTab()
          : renderChildTab()
        }
      </div>
      {renderDayPopup()}
      {renderAddPopup()}
    </div>
  );
}

import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DS, HW_INFO, formatDateLabel } from '../utils/scheduleUtils';

const HW_NAMES_MAP = {
  '학교':    {id:'sch',  n:'학교',     e:'🏫', c:'#7b9ef7', bg:'#f0f4ff'},
  '영어학원':{id:'eng',  n:'영어학원', e:'📖', c:'#ffaa55', bg:'#fff8f0'},
  '수학학원':{id:'math', n:'수학학원', e:'📚', c:'#b07ef7', bg:'#f8f0ff'},
};

export default function HomeworkPage() {
  const { role, SCH, hwData, hwExtra, hwLog, parentApproveHw, saveHwData, uploadHwPhoto, getHwPhoto, getHwLastPhoto, hwLastData, toast, bonus } = useApp();
  const [hwTab, setHwTab] = useState(role === 'child' ? 'c' : 'p');
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayPopup, setDayPopup] = useState(null); // {key, name, emoji, color, ds}

  const DN_KR = ['월','화','수','목','금','토','일'];
  const today = new Date().getDay();
  const todayIdx = today === 0 ? 6 : today - 1;

  // 숙제 과목 수집
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

  // 아이 탭: 숙제 목록
  const renderChildTab = () => (
    <div id="hwC">
      <div id="hwSubjectList" style={{margin:'10px 14px 0',display:'flex',flexDirection:'column',gap:10}}>
        {keys.length === 0
          ? <div style={{textAlign:'center',padding:30,color:'#8aaac8',fontSize:13}}>스케쥴에 학교/학원을 추가하면<br/>숙제 목록이 자동으로 나타나요! 📅</div>
          : keys.map(nm=>{
              const info = HW_NAMES[nm];
              const daySet = found[nm];
              const dayList = [...daySet].sort((a,b)=>a-b);
              const total = dayList.length;
              const key = info.id;
              const done = dayList.filter(d=>(hwData[key]||{})['day_'+d]?.status==='done').length;
              const pending = dayList.filter(d=>(hwData[key]||{})['day_'+d]?.status==='pending').length;

              return (
                <div key={nm} style={{background:'rgba(255,255,255,0.92)',borderRadius:16,padding:'13px 14px',border:`2px solid ${done===total&&total>0?'#c0ecd4':'#d4eaf5'}`,boxShadow:'0 2px 10px rgba(80,140,200,0.08)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                    <span style={{fontSize:20}}>{info.e}</span>
                    <span style={{fontSize:14,fontWeight:800,color:'#0d5a7a',flex:1}}>{nm}</span>
                    <span style={{fontSize:11,color:'#8aaac8'}}>{done}/{total} 완료</span>
                  </div>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {dayList.map(dayIdx=>{
                      const ds = 'day_'+dayIdx;
                      const hw = (hwData[key]||{})[ds]||{};
                      const photo = getHwPhoto(key, ds);
                      const isDone = hw.status==='done';
                      const isPending = hw.status==='pending';
                      const isToday = dayIdx===todayIdx;
                      let bg='#f0f7ff', border='#e0eef8';
                      if(isDone){bg='#f0fdf4';border='#c0ecd4';}
                      else if(isPending){bg='#fff8e1';border='#ffaa55';}
                      else if(photo||hw.memo){bg='#f0f4ff';border=info.c;}
                      if(isToday&&!isDone) border=info.c;
                      return (
                        <div key={dayIdx} onClick={()=>setDayPopup({key,name:nm,emoji:info.e,color:info.c,ds})}
                          style={{minWidth:48,padding:'6px 8px',borderRadius:10,background:bg,border:`2px solid ${border}`,cursor:'pointer',textAlign:'center',position:'relative',overflow:'hidden'}}>
                          {isDone&&<div style={{position:'absolute',top:3,left:3,fontSize:9,lineHeight:1}}>✅</div>}
                          <div style={{fontSize:9,fontWeight:700,color:'#5a8aa8'}}>{DN_KR[dayIdx]}</div>
                          <div style={{fontSize:10,color:'#888',marginTop:1}}>{formatDateLabel(dayIdx).split(' ')[0]}</div>
                          <div style={{fontSize:14,marginTop:2}}>{photo?'📷':isPending?'⏳':isDone?'':'○'}</div>
                        </div>
                      );
                    })}
                  </div>
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

  // 부모 탭: 숙제 현황
  const renderParentTab = () => (
    <div id="hwP">
      <div style={{margin:'10px 14px 0',background:'white',borderRadius:18,padding:'14px 16px',boxShadow:'0 2px 10px rgba(80,140,200,0.08)'}}>
        <div style={{fontSize:13,fontWeight:800,color:'#0d5a7a',marginBottom:12}}>📊 이번주 숙제 현황</div>
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
                  </div>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {dayList.map(dayIdx=>{
                      const ds = 'day_'+dayIdx;
                      const hw = (hwData[key]||{})[ds]||{};
                      const photo = getHwPhoto(key, ds);
                      const isToday = dayIdx===todayIdx;
                      const isDone = hw.status==='done';
                      const isPending = hw.status==='pending';
                      let bg='#f0f7ff', border='#e0eef8';
                      if(isDone){bg='#f0fdf4';}
                      else if(isPending){bg='#fff8e1';border='#ffaa55';}
                      else if(photo||hw.memo){bg='#f0f4ff';border=info.c;}
                      if(isToday&&!isDone) border=info.c;
                      const icon = photo?'📷':isPending?'⏳':isDone?'':'○';
                      return (
                        <div key={dayIdx} onClick={()=>setDayPopup({key,name:nm,emoji:info.e,color:info.c,ds})}
                          style={{minWidth:48,padding:'6px 8px',borderRadius:10,background:bg,border:`2px solid ${border}`,cursor:'pointer',textAlign:'center',position:'relative',overflow:'hidden'}}>
                          {isDone&&<div style={{position:'absolute',top:3,left:3,fontSize:9}}>✅</div>}
                          <div style={{fontSize:9,fontWeight:700,color:'#5a8aa8'}}>{DN_KR[dayIdx]}</div>
                          <div style={{fontSize:10,color:'#888',marginTop:1}}>{formatDateLabel(dayIdx).split(' ')[0]}</div>
                          <div style={{fontSize:14,marginTop:2}}>{icon}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
        }
        <div style={{marginTop:8,textAlign:'right'}}>
          <button onClick={()=>showAddPopup()} style={{padding:'5px 12px',borderRadius:9,border:'none',background:'linear-gradient(135deg,#3a9bd5,#2ec4a9)',color:'white',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>+ 항목 추가</button>
        </div>
      </div>

      {/* 보너스 포인트 */}
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

  const showAddPopup = () => toast('항목 추가 기능은 준비중이에요!');

  // 날짜 팝업 (부모/아이 공통)
  const renderDayPopup = () => {
    if(!dayPopup) return null;
    const {key, name, emoji, color, ds} = dayPopup;
    const hw = (hwData[key]||{})[ds]||{};
    const photo = getHwPhoto(key, ds);
    const dayIdx = parseInt(ds.replace('day_',''));
    const isDone = hw.status==='done';

    const triggerPhoto = () => {
      const old = document.getElementById('_hwPhotoInput');
      if(old) old.remove();
      const inp = document.createElement('input');
      inp.type='file'; inp.accept='image/*'; inp.id='_hwPhotoInput';
      inp.style.cssText='position:fixed;top:-999px;left:-999px;opacity:0;';
      inp.onchange = () => {
        const file = inp.files[0]; if(!file){inp.remove();return;}
        if(role==='parent') {
          uploadHwPhoto(key, ds, file, ()=>{ inp.remove(); setDayPopup({...dayPopup}); });
        } else {
          // 아이: 확인 요청
          const newData = {...hwData,[key]:{...(hwData[key]||{}),[ds]:{...(hw),status:'pending'}}};
          saveHwData(newData);
          uploadHwPhoto(key, ds, file, ()=>{ inp.remove(); setDayPopup({...dayPopup}); });
          toast('📤 확인 요청 보냈어요!');
        }
      };
      document.body.appendChild(inp);
      inp.click();
    };

    const handleMemoChange = (val) => {
      const newData = {...hwData,[key]:{...(hwData[key]||{}),[ds]:{...(hw),memo:val}}};
      saveHwData(newData);
    };

    return (
      <div className="popup-overlay" onClick={e=>{if(e.target===e.currentTarget)setDayPopup(null)}}>
        <div style={{background:'white',borderRadius:'22px 22px 0 0',padding:20,width:'100%',maxWidth:480,maxHeight:'80vh',overflowY:'auto',borderTop:isDone?'4px solid #3a9bd5':undefined}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
            <div style={{width:36,height:36,borderRadius:12,background:'#f0f4ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>{emoji}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:800,color:'#0d5a7a'}}>{name} · {formatDateLabel(dayIdx)}</div>
              <div style={{fontSize:11,color:'#8aaac8'}}>{isDone?'✅ 완료':hw.status==='pending'?'⏳ 확인 중':'📋 미완료'}</div>
            </div>
            {isDone&&<div style={{padding:'4px 10px',borderRadius:20,background:'#e8f3ff',color:'#3a9bd5',fontSize:11,fontWeight:800}}>✅ 완료</div>}
            <button onClick={()=>setDayPopup(null)} style={{width:30,height:30,borderRadius:'50%',border:'none',background:'#f0f0f0',color:'#888',fontSize:16,cursor:'pointer'}}>×</button>
          </div>

          {/* 사진 */}
          {photo
            ? <div style={{position:'relative',marginBottom:10}}>
                <img src={photo} style={{width:'100%',maxHeight:200,objectFit:'contain',borderRadius:12,border:`1.5px solid ${color}44`}} onClick={()=>viewPhoto(photo)} />
                {role==='parent'&&<button onClick={()=>{/* 삭제 */toast('사진 삭제됐어요!');}} style={{position:'absolute',top:6,right:6,padding:'4px 8px',borderRadius:8,border:'none',background:'rgba(0,0,0,0.5)',color:'white',fontSize:11,cursor:'pointer'}}>삭제</button>}
              </div>
            : <button onClick={triggerPhoto} style={{width:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:6,padding:20,border:'2px dashed #c8dce8',borderRadius:12,cursor:'pointer',background:'#fafcff',marginBottom:10,fontFamily:'inherit'}}>
                <span style={{fontSize:28}}>📷</span>
                <span style={{fontSize:12,color:'#8aaac8',fontWeight:700}}>{role==='parent'?'사진 첨부 (카메라/갤러리)':'사진 첨부해서 확인 요청'}</span>
              </button>
          }

          {/* 메모 */}
          <div style={{fontSize:11,fontWeight:700,color:'#0d5a7a',marginBottom:6}}>숙제 내용</div>
          <textarea
            defaultValue={hw.memo||''}
            onBlur={e=>handleMemoChange(e.target.value)}
            placeholder="숙제 내용 입력..."
            rows={3}
            style={{width:'100%',padding:10,borderRadius:10,border:'1.5px solid #e8f0f8',fontSize:13,fontFamily:'inherit',resize:'none',color:'#1a3a5c',background:'#fafcff',boxSizing:'border-box',marginBottom:10,outline:'none'}}
          />

          {/* 아이: 확인 요청 / 부모: 완료 처리 */}
          {role==='parent'
            ? <button onClick={()=>{parentApproveHw(key,ds);setDayPopup(null);}}
                style={{width:'100%',padding:12,borderRadius:14,border:'none',background:isDone?'#f0f0f0':'linear-gradient(135deg,#2bc87a,#1aaa60)',color:isDone?'#888':'white',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>
                {isDone?'↩️ 완료 취소 (-20점)':'✅ 완료 처리 +20점'}
              </button>
            : !isDone&&hw.status!=='pending'&&
              <button onClick={()=>{
                  const newData={...hwData,[key]:{...(hwData[key]||{}),[ds]:{...(hw),status:'pending'}}};
                  saveHwData(newData);
                  toast('📤 확인 요청 보냈어요!');
                  setDayPopup(null);
                }}
                style={{width:'100%',padding:12,borderRadius:14,border:'none',background:'linear-gradient(135deg,#3a9bd5,#2ec4a9)',color:'white',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>
                📤 확인 요청하기
              </button>
          }
        </div>
      </div>
    );
  };

  const viewPhoto = (url) => {
    const overlay = document.createElement('div');
    overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:9999;display:flex;align-items:center;justify-content:center;';
    overlay.onclick = ()=>overlay.remove();
    overlay.innerHTML=`<img src="${url}" style="max-width:92vw;max-height:88vh;border-radius:16px;object-fit:contain;"><button style="position:absolute;top:20px;right:20px;width:36px;height:36px;border-radius:50%;border:none;background:rgba(255,255,255,0.2);color:white;font-size:20px;cursor:pointer">×</button>`;
    document.body.appendChild(overlay);
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
    </div>
  );
}

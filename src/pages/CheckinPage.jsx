import { useApp } from '../context/AppContext';
import { isArriveItem, H } from '../utils/scheduleUtils';

export default function CheckinPage() {
  const { SCH, arriveData, todayKey, arriveNow } = useApp();
  const now = new Date();
  const curD = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const nowH = now.getHours() + now.getMinutes()/60;

  const dateStr = `${String(now.getFullYear()).slice(2)}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}`;

  const items = (SCH[curD] || []).filter(isArriveItem);
  const doneKeys = arriveData[todayKey] || {};
  const doneCount = items.filter((_,idx) => doneKeys[`${curD}_${idx}_${items[idx]?.name}`]).length;

  return (
    <div className="page" id="page-checkin">
      <div className="sub-hd">
        <div className="sub-ttl">📍 도착체크</div>
        <div className="sub-av">📡</div>
      </div>
      <div className="sp">
        <div style={{margin:'10px 14px 0',background:'linear-gradient(135deg,#3a9bd5,#2ec4a9)',borderRadius:18,padding:'14px 16px'}}>
          <div style={{color:'#fff'}}>
            <div style={{fontSize:14,fontWeight:800}}>오늘 도착체크</div>
            <div style={{fontSize:11,opacity:0.85,marginTop:2}}>{dateStr} · 시간이 되면 버튼이 활성화돼요!</div>
          </div>
        </div>

        <div style={{margin:'10px 14px 0'}}>
          {items.length === 0
            ? <div style={{textAlign:'center',padding:24,color:'#8aaac8',fontSize:12}}>학교·학원·스포츠 일정이 있으면 여기 나타나요!</div>
            : items.map((it, idx) => {
                const key = `${curD}_${idx}_${it.name}`;
                const isDone = !!doneKeys[key];
                const canArrive = nowH >= it.start - 0.5 && nowH <= it.start + it.dur + 0.5;
                const isPast = nowH > it.start + it.dur + 0.5;
                let statusColor = '#d4eaf5', statusText = `⏰ ${H(it.start)} 대기 중`;

                return (
                  <div key={idx} style={{marginBottom:10,background:'rgba(255,255,255,0.95)',borderRadius:16,padding:'14px 16px',boxShadow:'0 2px 10px rgba(80,140,200,0.08)',borderLeft:`4px solid ${isDone?'#2bc87a':canArrive?'#3a9bd5':isPast?'#ffaa55':'#d4eaf5'}`}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{fontSize:28}}>{it.emoji}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,fontWeight:800,color:'#0d5a7a'}}>{it.name}</div>
                        <div style={{fontSize:11,color:'#8aaac8',marginTop:2}}>{it.time||H(it.start)+'~'+H(it.start+it.dur)}</div>
                        <div style={{fontSize:11,fontWeight:700,marginTop:3,color:isDone?'#2bc87a':canArrive?'#3a9bd5':isPast&&!isDone?'#ffaa55':'#9dbdd4'}}>
                          {isDone ? '✅ 도착 완료! +10점' : canArrive ? '📍 지금 도착할 수 있어요!' : isPast ? '⚠️ 시간이 지났어요' : `⏰ ${H(it.start)} 대기 중`}
                        </div>
                      </div>
                      {isDone
                        ? <div style={{padding:'10px 16px',borderRadius:12,background:'#e8faf0',color:'#2bc87a',fontSize:12,fontWeight:700}}>✓ 완료</div>
                        : (canArrive || isPast)
                          ? <button onClick={()=>arriveNow(curD,idx,it.name,it.emoji)} style={{padding:'10px 16px',borderRadius:12,border:'none',background:canArrive?'linear-gradient(135deg,#3a9bd5,#2ec4a9)':'#fff0e0',color:canArrive?'#fff':'#e08000',fontSize:12,fontWeight:800,fontFamily:'inherit',cursor:'pointer',boxShadow:canArrive?'0 3px 10px rgba(58,155,213,0.4)':'none'}}>
                              {canArrive?'📍 도착!':'늦게 체크'}
                            </button>
                          : <button disabled style={{padding:'10px 16px',borderRadius:12,border:'none',background:'#d4eaf5',color:'#9dbdd4',fontSize:12,fontWeight:700,fontFamily:'inherit'}}>도착 전</button>
                      }
                    </div>
                  </div>
                );
              })
          }
        </div>

        <div className="bb">
          <div className="bbl">
            <div className="bbs">오늘 도착 포인트</div>
            <div className="bbn">{doneCount*10}점</div>
          </div>
          <div className="bbr">
            <div className="bbs">완료</div>
            <div style={{fontSize:13,fontWeight:700}}>{doneCount}/{items.length}개</div>
          </div>
        </div>
      </div>
    </div>
  );
}

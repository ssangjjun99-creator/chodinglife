import { useApp } from '../context/AppContext';
import { RW, getMonday, mondayStr } from '../utils/scheduleUtils';

const WEEKDAY_KR = ['일','월','화','수','목','금','토'];

export default function PointsPage() {
  const { wkS, todayS, goal, hwLog, bonusLog, arriveData, todayKey, rwI, setRwI, toast, pickReward } = useApp();

  const pct = Math.min(100, Math.round((wkS/goal)*100));

  // 이번주(월요일 이후) 도착 기록을 날짜별로 그룹핑, 최신 날짜 순
  const thisMonday = mondayStr(getMonday(new Date()));
  const weekArriveGroups = Object.keys(arriveData||{})
    .filter(k => k >= thisMonday)
    .sort((a,b) => b.localeCompare(a))
    .map(dateKey => ({
      dateKey,
      entries: Object.entries(arriveData[dateKey]||{}).filter(([,v])=>v),
    }))
    .filter(g => g.entries.length > 0);

  const formatDateHeader = (dateKey) => {
    const [y,m,d] = dateKey.split('-').map(Number);
    const wd = WEEKDAY_KR[new Date(y, m-1, d).getDay()];
    return dateKey === todayKey ? `오늘 (${m}/${d})` : `${m}/${d} (${wd})`;
  };

  // 숙제 완료 이력: 승인 시각(ts) 기준 날짜별 그룹핑, 시각 없는 옛 기록은 "이번주"로 묶음
  const hwLogGroups = {};
  const hwLogNoTs = [];
  Object.values(hwLog||{}).forEach(log => {
    if(!log.ts) { hwLogNoTs.push(log); return; }
    const d = new Date(log.ts);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    (hwLogGroups[dateKey] = hwLogGroups[dateKey]||[]).push(log);
  });
  const hwLogDateGroups = Object.keys(hwLogGroups)
    .sort((a,b) => b.localeCompare(a))
    .map(dateKey => ({
      dateKey,
      label: formatDateHeader(dateKey),
      logs: hwLogGroups[dateKey].sort((a,b)=>(b.ts||0)-(a.ts||0)),
    }));
  if(hwLogNoTs.length > 0) {
    hwLogDateGroups.push({ dateKey:'no-ts', label:'이번주', logs:hwLogNoTs });
  }

  // 보너스 이력
  const bonusEntries = Object.values(bonusLog||{}).sort((a,b)=>(b.ts||0)-(a.ts||0));

  const pickRw = async (idx) => {
    if(wkS < goal) { toast(`목표까지 ${goal-wkS}점 더!`); return; }
    await pickReward(RW[rwI[idx]].n);
  };

  return (
    <div className="page" id="page-points">
      <div className="sub-hd">
        <div className="sub-ttl">⭐ 포인트</div>
        <div className="sub-av">⭐</div>
      </div>
      <div className="sp">
        {/* 포인트 헤더 */}
        <div className="pts-h">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <div>
              <div style={{color:'#fff',fontSize:14,fontWeight:800}}>포인트 현황</div>
              <div style={{color:'rgba(255,255,255,0.85)',fontSize:11,marginTop:2}}>이번주 목표 <span style={{fontWeight:900}}>{goal}</span>점</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.8)',marginBottom:4}}>금주 <span style={{fontWeight:900,fontSize:16,color:'#fff'}}>{wkS}</span>점</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.8)'}}>금일 <span style={{fontWeight:900,fontSize:16,color:'#ffe066'}}>{todayS}</span>점</div>
            </div>
          </div>
          <div className="pts-prog"><div className="pts-fill" style={{width:`${pct}%`}} /></div>
        </div>

        {/* 이번주 도착 */}
        <div className="card" style={{marginTop:10}}>
          <div className="ch"><span className="ci">📍</span><span className="ct">이번주 도착</span></div>
          {weekArriveGroups.length === 0
            ? <div style={{textAlign:'center',padding:12,color:'#8aaac8',fontSize:12}}>도착 기록이 없어요</div>
            : weekArriveGroups.map(({dateKey, entries}) => (
                <div key={dateKey}>
                  <div style={{fontSize:11,fontWeight:700,color:'#5a8aa8',padding:'8px 0 2px'}}>{formatDateHeader(dateKey)}</div>
                  {entries.map(([key]) => {
                    const parts = key.split('_');
                    const name = parts.slice(2).join('_');
                    return (
                      <div key={key} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid #f0f7ff'}}>
                        <span style={{flex:1,fontSize:13,fontWeight:700,color:'#0d5a7a'}}>{name}</span>
                        <span style={{fontSize:11,color:'#2bc87a',fontWeight:700}}>+10점 ✓</span>
                      </div>
                    );
                  })}
                </div>
              ))
          }
        </div>

        {/* 이번주 숙제 완료 */}
        <div className="card" style={{marginTop:10}}>
          <div className="ch"><span className="ci">📚</span><span className="ct">이번주 숙제 완료</span></div>
          {hwLogDateGroups.length === 0
            ? <div style={{textAlign:'center',padding:12,color:'#8aaac8',fontSize:12}}>완료된 숙제가 없어요</div>
            : hwLogDateGroups.map(({dateKey, label, logs}) => (
                <div key={dateKey}>
                  <div style={{fontSize:11,fontWeight:700,color:'#5a8aa8',padding:'8px 0 2px'}}>{label}</div>
                  {logs.map((log, i) => (
                    <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid #f0f7ff'}}>
                      <span style={{fontSize:18}}>{log.emoji}</span>
                      <span style={{flex:1,fontSize:13,fontWeight:700,color:'#0d5a7a'}}>{log.name} <span style={{color:'#8aaac8',fontWeight:400}}>{log.dayLabel}요일</span></span>
                      <span style={{fontSize:11,color:'#2bc87a',fontWeight:700}}>+20점 ✓</span>
                    </div>
                  ))}
                </div>
              ))
          }
        </div>

        {/* 보너스 포인트 이력 */}
        <div className="card" style={{marginTop:10}}>
          <div className="ch"><span className="ci">🌟</span><span className="ct">엄마 보너스 포인트</span></div>
          {bonusEntries.length === 0
            ? <div style={{textAlign:'center',padding:12,color:'#8aaac8',fontSize:12}}>보너스 포인트가 없어요</div>
            : bonusEntries.map((b, i) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid #f0f7ff'}}>
                <span style={{flex:1,fontSize:13,fontWeight:700,color:'#0d5a7a'}}>{b.name}</span>
                <span style={{fontSize:11,color:'#2bc87a',fontWeight:700}}>+{b.pts}점 ✓</span>
              </div>
            ))
          }
        </div>

        {/* 이번주 보상 */}
        <div className="card" style={{marginTop:10}}>
          <div className="ch"><span className="ci">🎁</span><span className="ct">이번주 보상</span></div>
          <div className="rwr">
            {[0,1,2].map(i => {
              const rw = RW[rwI[i]];
              const locked = wkS < goal;
              return (
                <div key={i} className={`rwc${locked?' lk':''}`} onClick={()=>pickRw(i)}>
                  {locked && <div className="rwlk">🔒</div>}
                  <div style={{fontSize:22}}>{rw.e}</div>
                  <div style={{fontSize:10,fontWeight:700,color:'#1a3a5c',marginTop:2}}>{rw.n}</div>
                </div>
              );
            })}
          </div>
          <div style={{fontSize:11,color:'#8aaac8',textAlign:'center',marginTop:8}}>
            {wkS >= goal ? '보상을 골라요! 🎉' : `목표 달성하면 보상을 골라요! (${goal-wkS}점 남음)`}
          </div>
        </div>
      </div>
    </div>
  );
}

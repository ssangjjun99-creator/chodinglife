import { useApp } from '../context/AppContext';
import { RW } from '../utils/scheduleUtils';

export default function PointsPage() {
  const { wkS, todayS, goal, hwLog, bonusLog, arriveData, todayKey, rwI, setRwI, toast } = useApp();

  const pct = Math.min(100, Math.round((wkS/goal)*100));

  const now = new Date();
  const dateStr = `(${String(now.getFullYear()).slice(2)}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')})`;

  // 오늘 도착 목록 (arriveData[todayKey])
  const arriveEntries = Object.entries(arriveData[todayKey]||{}).filter(([,v])=>v);

  // 숙제 완료 이력
  const hwLogs = Object.values(hwLog||{}).sort((a,b)=>(b.ts||0)-(a.ts||0));

  // 보너스 이력
  const bonusEntries = Object.values(bonusLog||{}).sort((a,b)=>(b.ts||0)-(a.ts||0));

  const pickRw = (idx) => {
    if(wkS < goal) { toast(`목표까지 ${goal-wkS}점 더!`); return; }
    toast(`"${RW[rwI[idx]].n}" 선택! 부모님께 알림! 📱`);
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

        {/* 오늘 도착 */}
        <div className="card" style={{marginTop:10}}>
          <div className="ch"><span className="ci">📍</span><span className="ct">오늘 도착 <span style={{fontSize:11,color:'#8aaac8',fontWeight:400}}>{dateStr}</span></span></div>
          {arriveEntries.length === 0
            ? <div style={{textAlign:'center',padding:12,color:'#8aaac8',fontSize:12}}>도착 기록이 없어요</div>
            : arriveEntries.map(([key]) => {
                const parts = key.split('_');
                const name = parts.slice(2).join('_');
                return (
                  <div key={key} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid #f0f7ff'}}>
                    <span style={{flex:1,fontSize:13,fontWeight:700,color:'#0d5a7a'}}>{name}</span>
                    <span style={{fontSize:11,color:'#2bc87a',fontWeight:700}}>+10점 ✓</span>
                  </div>
                );
              })
          }
        </div>

        {/* 이번주 숙제 완료 */}
        <div className="card" style={{marginTop:10}}>
          <div className="ch"><span className="ci">📚</span><span className="ct">이번주 숙제 완료</span></div>
          {hwLogs.length === 0
            ? <div style={{textAlign:'center',padding:12,color:'#8aaac8',fontSize:12}}>완료된 숙제가 없어요</div>
            : hwLogs.map((log, i) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid #f0f7ff'}}>
                <span style={{fontSize:18}}>{log.emoji}</span>
                <span style={{flex:1,fontSize:13,fontWeight:700,color:'#0d5a7a'}}>{log.name} <span style={{color:'#8aaac8',fontWeight:400}}>{log.dayLabel}요일</span></span>
                <span style={{fontSize:11,color:'#2bc87a',fontWeight:700}}>+20점 ✓</span>
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

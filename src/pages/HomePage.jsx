import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import PieChart from '../components/PieChart';

const BG_BASE = (process.env.PUBLIC_URL || '') + '/images/';

export default function HomePage() {
  const { SCH, childPhotoUrl, secretReset, role, setCurrentPage, setParentTab, message } = useApp();
  const [clock, setClock] = useState('');
  const [clockDate, setClockDate] = useState('');
  const [curD, setCurD] = useState(() => { const d=new Date().getDay(); return d===0?6:d-1; });
  const [curAP, setCurAP] = useState(() => new Date().getHours()<12?'am':'pm');
  const [nowMain, setNowMain] = useState('스케쥴을 설정해주세요!');
  const [nowNext, setNowNext] = useState('부모님 → 스케쥴 탭');
  const [nowEmoji, setNowEmoji] = useState('👨‍👩‍👧');
  const [isDaytime, setIsDaytime] = useState(() => { const h=new Date().getHours(); return h>=6&&h<18; });

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = now.getHours();
      const hStr = String(h).padStart(2,'0');
      const m = String(now.getMinutes()).padStart(2,'0');
      setClock(`${hStr}:${m}`);
      const yy = String(now.getFullYear()).slice(2);
      const mm = String(now.getMonth()+1).padStart(2,'0');
      const dd = String(now.getDate()).padStart(2,'0');
      const days = ['일','월','화','수','목','금','토'];
      setClockDate(`${yy}.${mm}.${dd} ${days[now.getDay()]}요일`);
      setIsDaytime(h>=6&&h<18);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // 홈 진입 시 현재 시간 기준 오전/오후 자동 선택
  useEffect(() => {
    const ap = new Date().getHours() < 12 ? 'am' : 'pm';
    setCurAP(ap);
  }, []);

  const handleNowChange = (main, next, emoji) => {
    console.log('[HomePage handleNowChange] nowMain →', main);
    setNowMain(main);
    setNowNext(next);
    setNowEmoji(emoji);
  };

  return (
    <div className="page" id="page-main" style={{background:'transparent'}}>
      {/* 낮/밤 배경 */}
      <div style={{
        position:'absolute',inset:0,zIndex:-1,
        backgroundImage:`url('${BG_BASE}bg-day.png')`,
        backgroundSize:'cover',backgroundPosition:'top center',
        opacity: isDaytime ? 1 : 0,
        transition:'opacity 1s ease',
      }} />
      <div style={{
        position:'absolute',inset:0,zIndex:-1,
        backgroundImage:`url('${BG_BASE}bg-night.png')`,
        backgroundSize:'cover',backgroundPosition:'top center',
        opacity: isDaytime ? 0 : 1,
        transition:'opacity 1s ease',
      }} />
      <div className="topbar">
        <div>
          <div className="clock-small">{clock}</div>
          <div className="clock-date">{clockDate}</div>
        </div>
        <span className="topbar-txt" onClick={secretReset} style={{cursor:'pointer',padding:8}}>✦</span>
      </div>

      {/* overflow:hidden → chart-outer marginTop(14px) 붕괴 방지 → top 기준 확정 */}
      <div style={{position:'relative',width:'100%',overflow:'hidden'}}>
        <PieChart
          SCH={SCH}
          curD={curD}
          curAP={curAP}
          childPhotoUrl={childPhotoUrl}
          onNowChange={handleNowChange}
        />
        {role === 'parent' && (
          <button
            onClick={() => { setParentTab('sc'); setCurrentPage('parent'); }}
            style={{
              position:'absolute',
              left:'calc(50% + 104px)',
              top:'284px',
              transform:'translate(-50%, -50%)',
              border:'none',
              cursor:'pointer',
              zIndex:10,
              width:44,
              height:44,
              borderRadius:'50%',
              background:'rgba(255,255,255,0.85)',
              boxShadow:'0 2px 8px rgba(100,90,150,0.25)',
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              padding:0,
              fontSize:17,
              color:'#0d5a7a',
            }}
          >{'⚙️'}</button>
        )}
        <button
          onClick={() => setCurrentPage('wordgame')}
          style={{
            position: 'absolute',
            left: 'calc(50% - 104px)',
            top: '284px',
            transform: 'translate(-50%, -50%)',
            border: 'none',
            cursor: 'pointer',
            zIndex: 10,
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.85)',
            boxShadow: '0 2px 8px rgba(100,90,150,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
        >
          <img src={process.env.PUBLIC_URL + '/icons/game_icon.png'} alt="" width={30} style={{display:'block'}} />
        </button>
      </div>

      {/* 응원메시지 배너 — 오늘 부모 메시지가 있을 때만 표시 */}
      {message?.sentAt === new Date().toISOString().slice(0, 10) && (
        <div style={{
          margin:'0 16px 6px',
          display:'flex', alignItems:'center', gap:8,
          fontSize:12, fontWeight:600,
          color:'#0d5a7a',
        }}>
          <span style={{fontSize:19, flexShrink:0}}>❤️</span>
          <span style={{lineHeight:1.4}}>{message.text}</span>
        </div>
      )}

      <div className="now-badge">
        <div className="now-left">
          <div className="now-dot" />
          <div>
            <div className="now-main">{nowMain}</div>
            <div className="now-next">{nowNext}</div>
          </div>
        </div>
        <div style={{fontSize:24}}>{nowEmoji}</div>
      </div>

      <div className="ampm-row">
        <div className={`ampm-btn${curAP==='am'?' on':''}`} onClick={()=>setCurAP('am')}>☀️ 오전 (0~12시)</div>
        <div className={`ampm-btn${curAP==='pm'?' on':''}`} onClick={()=>setCurAP('pm')}>🌙 오후 (12~24시)</div>
      </div>
    </div>
  );
}

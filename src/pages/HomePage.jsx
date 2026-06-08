import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import PieChart from '../components/PieChart';

export default function HomePage() {
  const { SCH, childPhotoUrl, secretReset } = useApp();
  const [clock, setClock] = useState('');
  const [clockDate, setClockDate] = useState('');
  const [curD, setCurD] = useState(() => { const d=new Date().getDay(); return d===0?6:d-1; });
  const [curAP, setCurAP] = useState(() => new Date().getHours()<12?'am':'pm');
  const [nowMain, setNowMain] = useState('스케쥴을 설정해주세요!');
  const [nowNext, setNowNext] = useState('부모님 → 스케쥴 탭');
  const [nowEmoji, setNowEmoji] = useState('👨‍👩‍👧');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2,'0');
      const m = String(now.getMinutes()).padStart(2,'0');
      setClock(`${h}:${m}`);
      const yy = String(now.getFullYear()).slice(2);
      const mm = String(now.getMonth()+1).padStart(2,'0');
      const dd = String(now.getDate()).padStart(2,'0');
      const days = ['일','월','화','수','목','금','토'];
      setClockDate(`${yy}.${mm}.${dd} ${days[now.getDay()]}요일`);
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
    setNowMain(main);
    setNowNext(next);
    setNowEmoji(emoji);
  };

  return (
    <div className="page" id="page-main">
      <div className="topbar">
        <div>
          <div className="clock-small">{clock}</div>
          <div className="clock-date">{clockDate}</div>
        </div>
        <span className="topbar-txt" onClick={secretReset} style={{cursor:'pointer',padding:8}}>✦</span>
      </div>

      <PieChart
        SCH={SCH}
        curD={curD}
        curAP={curAP}
        childPhotoUrl={childPhotoUrl}
        onNowChange={handleNowChange}
      />

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

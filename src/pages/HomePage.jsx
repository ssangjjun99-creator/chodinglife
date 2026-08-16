import { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { NativeSettings, AndroidSettings } from 'capacitor-native-settings';
import { useApp } from '../context/AppContext';
import PieChart from '../components/PieChart';
import ChildSettingsModal from '../components/ChildSettingsModal';

const BG_BASE = (process.env.PUBLIC_URL || '') + '/images/';

export default function HomePage() {
  const { SCH, childPhotoUrl, secretReset, role, setCurrentPage, setParentTab, message, toast } = useApp();
  const [showChildSettings, setShowChildSettings] = useState(false);
  const [clock, setClock] = useState('');
  const [clockDate, setClockDate] = useState('');
  const [curD, setCurD] = useState(() => { const d=new Date().getDay(); return d===0?6:d-1; });
  const [curAP, setCurAP] = useState(() => new Date().getHours()<12?'am':'pm');
  const [nowMain, setNowMain] = useState('스케쥴을 설정해주세요!');
  const [nowNext, setNowNext] = useState('부모님 → 스케쥴 탭');
  const [nowEmoji, setNowEmoji] = useState('👨‍👩‍👧');
  const [isDaytime, setIsDaytime] = useState(() => { const h=new Date().getHours(); return h>=6&&h<18; });
  const lastDayRef = useRef(curD);
  const lastApRef = useRef(curAP);
  const manualApRef = useRef(false);
  const [exactAlarmGranted, setExactAlarmGranted] = useState(true);
  const [notifPermGranted, setNotifPermGranted] = useState(true);

  // 정확한 알람 권한 상태 확인 — 실패 시 배너를 띄우지 않음(권한 상태를 모를 때 겁주지 않기)
  const checkExactAlarm = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const status = await LocalNotifications.checkExactNotificationSetting();
      setExactAlarmGranted(status.exact_alarm === 'granted');
    } catch(e) {
      // 확인 실패 — 배너 표시 안 함
    }
  };

  // 알림 표시 권한(POST_NOTIFICATIONS) 상태 확인 — 실패 시 배너를 띄우지 않음
  const checkNotifPerm = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const status = await LocalNotifications.checkPermissions();
      setNotifPermGranted(status.display === 'granted');
    } catch(e) {
      // 확인 실패 — 배너 표시 안 함
    }
  };

  // 알림 표시 권한은 부모·아이 모드 공통으로 확인(배너 1순위), 정확한 알람은 아이 모드에서만(배너 2순위) —
  // 앱 재개(resume)/탭 다시 보임(visible) 시에도 재확인해 단계가 자동으로 넘어가게 함
  // (설정 화면 다녀오면 배너가 사라지게) — AppContext.jsx의 리스너와는 별개로 HomePage 전용으로 둠
  useEffect(() => {
    const recheck = () => {
      checkNotifPerm();
      if (role === 'child') checkExactAlarm();
    };
    recheck();
    let resumeListenerPromise = null;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') recheck();
    };
    if (Capacitor.isNativePlatform()) {
      resumeListenerPromise = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) recheck();
      });
    } else {
      document.addEventListener('visibilitychange', handleVisibility);
    }
    return () => {
      if (resumeListenerPromise) resumeListenerPromise.then(h => h.remove());
      else document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [role]);

  const handleTurnOnExactAlarm = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const status = await LocalNotifications.changeExactNotificationSetting();
      setExactAlarmGranted(status.exact_alarm === 'granted');
    } catch(e) {
      // 실패 시 조용히 무시
    }
  };

  // 알림 배너 "켜기" — 아직 완전 거부 전이면 팝업이 다시 뜸(전용 재요청 경로라 requestNotificationPermissionOnce 게이트는 거치지 않음)
  // 그래도 granted가 아니면 앱 알림 설정 화면을 직접 열어줌(마지막 폴백은 toast 안내)
  const handleTurnOnNotif = async () => {
    if (!Capacitor.isNativePlatform()) return;
    let granted = false;
    try {
      const status = await LocalNotifications.requestPermissions();
      granted = status.display === 'granted';
      setNotifPermGranted(granted);
    } catch(e) {
      // 요청 자체 실패 — 아래에서 설정 화면으로 폴백
    }
    if (!granted) {
      try {
        await NativeSettings.openAndroid({ option: AndroidSettings.AppNotification });
      } catch(e) {
        toast('설정 → 애플리케이션 → 초딩생활 → 알림 에서 켜주세요');
      }
    }
  };

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

      // 날짜(요일)가 실제로 바뀐 순간에만 curD/curAP 갱신 — 매초 재계산하면
      // 184~187행의 수동 오전/오후 탭이 1초 뒤 되돌아가는 버그가 생기므로 값이 같으면 아무것도 안 함
      const d = now.getDay();
      const dayIdx = d===0?6:d-1;
      if(dayIdx !== lastDayRef.current) {
        lastDayRef.current = dayIdx;
        setCurD(dayIdx);
        setCurAP('am');
        manualApRef.current = false; // 새 날 시작 — 수동 고정 해제하고 다시 자동으로 따라가게
        lastApRef.current = 'am';
      }

      // 정오(12시) 경계 감지 — 사용자가 오전/오후 탭을 수동으로 누른 적 있으면 건드리지 않음
      const ap = h < 12 ? 'am' : 'pm';
      if(ap !== lastApRef.current) {
        lastApRef.current = ap;
        if(!manualApRef.current) {
          setCurAP(ap);
        }
      }
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
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div className="clock-small">{clock}</div>
            {role === 'child' && (
              <button
                onClick={() => setShowChildSettings(true)}
                style={{
                  border:'none',
                  background:'none',
                  cursor:'pointer',
                  width:40,
                  height:40,
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'center',
                  padding:0,
                  fontSize:20,
                  opacity:0.5,
                }}
              >{'⚙️'}</button>
            )}
          </div>
          <div className="clock-date">{clockDate}</div>
        </div>
      </div>

      {showChildSettings && (
        <ChildSettingsModal onClose={() => setShowChildSettings(false)} />
      )}

      {/* 알림 배너 — 한 자리에 항상 1개만: 1) 알림 표시 권한(부모·아이 공통) 2) 정확한 알람(아이 전용) 3) 둘 다 충족 시 없음 */}
      {Capacitor.isNativePlatform() && (() => {
        const banner = !notifPermGranted
          ? { icon:'🔔', title:'알림이 꺼져 있어요', sub:'학원·숙제 알림을 받으려면 켜주세요', onClick: handleTurnOnNotif }
          : (role === 'child' && !exactAlarmGranted)
          ? { icon:'⏰', title:'정확한 시간 알림이 꺼져 있어요', sub:"부모님이 '알람 및 리마인더'를 켜주세요", onClick: handleTurnOnExactAlarm }
          : null;
        if (!banner) return null;
        return (
          <div style={{
            margin:'0 16px 10px',
            display:'flex', alignItems:'center', gap:10,
            background:'#fff4e0', border:'1.5px solid #ffdca0', borderRadius:14,
            padding:'10px 14px',
          }}>
            <span style={{fontSize:20, flexShrink:0}}>{banner.icon}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:800,color:'#a86400'}}>{banner.title}</div>
              <div style={{fontSize:11,color:'#c08030'}}>{banner.sub}</div>
            </div>
            <button
              onClick={banner.onClick}
              style={{padding:'7px 12px',borderRadius:10,border:'none',background:'#ffb020',color:'#fff',fontSize:12,fontWeight:800,cursor:'pointer',fontFamily:'inherit',flexShrink:0}}
            >켜기</button>
          </div>
        );
      })()}

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
        <div className={`ampm-btn${curAP==='am'?' on':''}`} onClick={()=>{manualApRef.current=true;setCurAP('am');}}>☀️ 오전 (0~12시)</div>
        <div className={`ampm-btn${curAP==='pm'?' on':''}`} onClick={()=>{manualApRef.current=true;setCurAP('pm');}}>🌙 오후 (12~24시)</div>
      </div>
    </div>
  );
}

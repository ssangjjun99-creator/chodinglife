import { useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase/config';
import { useApp } from './context/AppContext';
import { scheduleClassReminders, cancelClassReminders } from './utils/localNotify';
import Toast from './components/Toast';
import Navbar from './components/Navbar';
import RoleSelectPage from './pages/RoleSelectPage';
import LoginPage from './pages/LoginPage';
import ChildSetupPage from './pages/ChildSetupPage';
import HomePage from './pages/HomePage';
import PointsPage from './pages/PointsPage';
import CheckinPage from './pages/CheckinPage';
import HomeworkPage from './pages/HomeworkPage';
import ParentPage from './pages/ParentPage';
import WordGamePage from './pages/WordGamePage';

function AppInner() {
  const { role, fbUser, authReady, familyCode, currentPage, setCurrentPage, SCH } = useApp();

  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;

  const familyCodeRef = useRef(familyCode);
  familyCodeRef.current = familyCode;
  const pushTokenRef = useRef(null);

  const roleRef = useRef(role);
  roleRef.current = role;
  const schRef = useRef(SCH);
  schRef.current = SCH;
  const pendingGotoRef = useRef(null);

  // FCM 토큰을 families/{familyCode}/data/fcm_tokens에 저장 (토큰을 키로 써서 중복 자동 방지)
  const saveFcmToken = useCallback(async (token, fc) => {
    if (!token || !fc) return;
    const savedRole = localStorage.getItem('chodinglife_role');
    if (!savedRole) return;
    try {
      const tokenDocRef = doc(db, 'families', fc, 'data', 'fcm_tokens');
      await setDoc(tokenDocRef, {
        tokens: { [token]: { role: savedRole, updatedAt: new Date().toISOString() } }
      }, { merge: true });
      console.log('[Push] 토큰 Firestore 저장 성공');
    } catch (e) {
      console.log('[Push] 토큰 Firestore 저장 실패:', e.message);
    }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      if (currentPageRef.current !== 'main') {
        setCurrentPage('main');
      } else if (window.confirm('초딩생활을 종료할까요?')) {
        CapacitorApp.exitApp();
      }
    });
    return () => { listenerPromise.then(l => l.remove()); };
  }, [setCurrentPage]);

  // 푸시알림 초기화 (네이티브 전용, 1단계: 권한 요청 + 토큰/수신 로그만)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const regListenerPromise = PushNotifications.addListener('registration', (token) => {
      console.log('[Push] 등록 토큰:', token.value);
      pushTokenRef.current = token.value;
      saveFcmToken(token.value, familyCodeRef.current);
    });
    const recvListenerPromise = PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] 알림 수신:', notification);
    });
    PushNotifications.requestPermissions().then((res) => {
      if (res.receive === 'granted') {
        PushNotifications.register();
      }
    });
    return () => {
      regListenerPromise.then(l => l.remove());
      recvListenerPromise.then(l => l.remove());
    };
  }, [saveFcmToken]);

  // familyCode가 registration 이후에 준비되는 경우 대응: 보관해둔 토큰을 그때 저장
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (pushTokenRef.current) {
      saveFcmToken(pushTokenRef.current, familyCode);
    }
  }, [familyCode, saveFcmToken]);

  // 학원 수업 10분 전 로컬 알림: 아이모드일 때만 예약, 부모모드면 기존 예약 전부 취소
  const syncClassReminders = useCallback(() => {
    if (roleRef.current === 'child') {
      scheduleClassReminders(schRef.current);
    } else {
      cancelClassReminders();
    }
  }, []);

  // 실행 시점 1) 앱 시작 시 + 역할/스케줄 변경 시(모드 전환 포함)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    syncClassReminders();
  }, [role, SCH, syncClassReminders]);

  // 실행 시점 2) 앱 재개(resume) 시 — 기존 runResetChecks의 appStateChange 패턴 참고
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listenerPromise = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) syncClassReminders();
    });
    return () => { listenerPromise.then(l => l.remove()); };
  }, [syncClassReminders]);

  // 로컬 알림 탭 시 도착 화면으로 이동 (아이모드 전용). 콜드 스타트 대비: 준비 안 됐으면 보관 후 재시도
  const tryFlushPendingGoto = useCallback(() => {
    if (!pendingGotoRef.current) return;
    if (!authReady) return; // 아직 준비 안 됨 — authReady/role이 바뀔 때 다시 시도됨
    if (role !== 'child') { pendingGotoRef.current = null; return; } // 부모모드면 무시
    const linked = localStorage.getItem('chodinglife_linkedcode');
    if (!linked) return; // 코드 입력 전이면 대기
    if (pendingGotoRef.current === 'arrive') setCurrentPage('checkin');
    pendingGotoRef.current = null;
  }, [authReady, role, setCurrentPage]);

  useEffect(() => { tryFlushPendingGoto(); }, [tryFlushPendingGoto]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listenerPromise = LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const goto = action.notification && action.notification.extra && action.notification.extra.goto;
      if (goto === 'arrive') {
        pendingGotoRef.current = goto;
        tryFlushPendingGoto();
      }
    });
    return () => { listenerPromise.then(l => l.remove()); };
  }, [tryFlushPendingGoto]);

  // Firebase 인증 초기화 대기
  if(!authReady) {
    return (
      <div className="page" style={{alignItems:'center',justifyContent:'center'}}>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:48,marginBottom:12}}>🌟</div>
          <div style={{fontSize:16,color:'#5aaac8',fontWeight:700}}>불러오는 중...</div>
        </div>
      </div>
    );
  }

  // 역할 미설정 → 역할 선택 화면
  if(!role) return <RoleSelectPage />;

  // 부모인데 로그인 안 됨 → 로그인 페이지
  if(role === 'parent' && !fbUser) return <LoginPage />;

  // 아이인데 familyCode 없음 → 코드 입력 화면
  if(role === 'child') {
    const linked = localStorage.getItem('chodinglife_linkedcode');
    if(!linked) return <ChildSetupPage />;
  }

  const hide = (name) => ({ display: currentPage === name ? undefined : 'none' });

  return (
    <>
      <Toast />
      <div style={hide('main')}><HomePage /></div>
      <div style={hide('points')}><PointsPage /></div>
      <div style={hide('checkin')}><CheckinPage /></div>
      <div style={hide('homework')}><HomeworkPage /></div>
      <div style={hide('parent')}><ParentPage /></div>
      {currentPage === 'wordgame' && <WordGamePage />}
      {currentPage !== 'wordgame' && <Navbar />}
    </>
  );
}

export default function App() {
  return <AppInner />;
}

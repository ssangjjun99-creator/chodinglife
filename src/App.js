import { useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase/config';
import { useApp } from './context/AppContext';
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
  const { role, fbUser, authReady, familyCode, currentPage, setCurrentPage } = useApp();

  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;

  const familyCodeRef = useRef(familyCode);
  familyCodeRef.current = familyCode;
  const pushTokenRef = useRef(null);

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

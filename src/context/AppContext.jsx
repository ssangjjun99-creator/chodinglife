import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import {
  onAuthStateChanged, signOut, signInWithPopup, signInWithCredential, signInWithCustomToken, GoogleAuthProvider, OAuthProvider,
  createUserWithEmailAndPassword, signInWithEmailAndPassword
} from 'firebase/auth';
import {
  doc, setDoc, getDoc, onSnapshot, deleteDoc
} from 'firebase/firestore';
import {
  ref, uploadBytes, getDownloadURL, deleteObject
} from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { auth, db, storage, googleProvider, functions } from '../firebase/config';
import {
  makeDefaultSchedule, checkHwWeekReset, H, mondayStr, getMonday, HW_INFO,
  localDateStr, legacyMondayStr
} from '../utils/scheduleUtils';

const AppContext = createContext(null);

// 이미지 압축 (FileReader + Image → Canvas → JPEG 0.6, 최대 600px)
// iOS Safari HEIC 호환: FileReader/Image 방식은 iOS가 자동 디코딩해서 Canvas에 그릴 수 있음
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('이미지 디코딩 실패'));
      img.onload = () => {
        try {
          const MAX = 600;
          let w = img.naturalWidth, h = img.naturalHeight;
          if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
          else        { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          canvas.toBlob((blob) => {
            if (!blob) { reject(new Error('압축 결과 없음')); return; }
            resolve(blob);
          }, 'image/jpeg', 0.6);
        } catch(err) { reject(err); }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export function AppProvider({ children }) {
  // ── 역할 / 인증
  const [role, setRole] = useState(() => localStorage.getItem('chodinglife_role') || null);
  const [fbUser, setFbUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [familyCode, setFamilyCode] = useState(() =>
    localStorage.getItem('chodinglife_familycode') || null
  );

  // ── 화면
  const [currentPage, setCurrentPage] = useState('main');
  const [parentTab, setParentTab] = useState('ov');

  // ── 스케쥴
  const [SCH, setSCH] = useState(() => {
    const saved = localStorage.getItem('chodinglife_sch_v1');
    return saved ? JSON.parse(saved) : makeDefaultSchedule();
  });
  const [FREE, setFREE] = useState(() => {
    const saved = localStorage.getItem('chodinglife_free_v1');
    return saved ? JSON.parse(saved) : {};
  });

  // ── 포인트
  const [wkS, setWkS] = useState(() => {
    const s = JSON.parse(localStorage.getItem('chodinglife_scores') || 'null');
    return s ? (s.wk || 0) : 0;
  });
  const [todayS, setTodayS] = useState(() => {
    const s = JSON.parse(localStorage.getItem('chodinglife_scores') || 'null');
    return s ? (s.today || 0) : 0;
  });
  const [totS, setTotS] = useState(() => {
    const s = JSON.parse(localStorage.getItem('chodinglife_scores') || 'null');
    return s ? (s.tot || 0) : 0;
  });
  const [goal, setGoal] = useState(() => parseInt(localStorage.getItem('chodinglife_goal')||'100'));

  // ── 숙제
  const [hwData, setHwData] = useState(() => {
    checkHwWeekReset();
    return JSON.parse(localStorage.getItem('chodinglife_hw_current') || '{}');
  });
  const [hwLastData, setHwLastData] = useState(() =>
    JSON.parse(localStorage.getItem('chodinglife_hw_last') || '{}')
  );
  const [hwPhotos, setHwPhotos] = useState(() =>
    JSON.parse(localStorage.getItem('chodinglife_hw_photos') || '{}')
  );
  const [hwLastPhotos, setHwLastPhotos] = useState(() =>
    JSON.parse(localStorage.getItem('chodinglife_hw_photos_last') || '{}')
  );
  const [hwExtra, setHwExtra] = useState([]);
  const [hwLog, setHwLog] = useState(() =>
    JSON.parse(localStorage.getItem('chodinglife_hw_log') || '{}')
  );
  const [hwPhotoUrls, setHwPhotoUrls] = useState({});
  const [hwPhotoUrlsLast, setHwPhotoUrlsLast] = useState({});

  // ── 도착
  const todayKey = localDateStr(new Date());
  const [arriveData, setArriveData] = useState(() => {
    const saved = JSON.parse(localStorage.getItem('chodinglife_arrive_v1') || '{}');
    if(!saved[todayKey]) saved[todayKey] = {};
    return saved;
  });

  // ── 아이 사진
  const [childPhotoUrl, setChildPhotoUrl] = useState(null);

  // ── 보너스 로그
  const [bonusLog, setBonusLog] = useState(() =>
    JSON.parse(localStorage.getItem('chodinglife_bonus_log') || '{}')
  );

  // ── 응원메시지
  const [message, setMessage] = useState(null);

  // ── 토스트
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef(null);

  // ── 보상
  const [rwI, setRwI] = useState(() => {
    const saved = localStorage.getItem('chodinglife_rw');
    return saved ? JSON.parse(saved) : [0,1,2];
  });

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2200);
  }, []);

  // familyCode가 "다른 값"으로 바뀔 때(계정/가족코드 전환) 전 계정의 로컬 캐시를 전부 청소.
  // role/linkedcode/familycode 키는 여기서 건드리지 않음 — 호출부에서 그 직후에 새 값으로 갱신함.
  const resetFamilyDataCache = useCallback(() => {
    [
      'chodinglife_sch_v1', 'chodinglife_free_v1',
      'chodinglife_scores', 'chodinglife_goal',
      'chodinglife_hw_current', 'chodinglife_hw_last',
      'chodinglife_hw_photos', 'chodinglife_hw_photos_last',
      'chodinglife_hw_log', 'chodinglife_hw_updated', 'chodinglife_hw_week',
      'chodinglife_arrive_v1', 'chodinglife_bonus_log', 'chodinglife_rw',
    ].forEach(k => localStorage.removeItem(k));

    setSCH(makeDefaultSchedule());
    setFREE({});
    setWkS(0); setTodayS(0); setTotS(0);
    setGoal(100);
    setHwData({});
    setHwLastData({});
    setHwPhotos({});
    setHwLastPhotos({});
    setHwLog({});
    setHwPhotoUrls({});
    setHwPhotoUrlsLast({});
    setHwExtra([]);
    setArriveData({ [todayKey]: {} });
    setBonusLog({});
    setChildPhotoUrl(null);
    setMessage(null);
    setRwI([0,1,2]);
  }, [todayKey]);

  // ══════════════════
  // Firebase Auth
  // ══════════════════
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFbUser(user);
      setAuthReady(true);
      if(user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          let code;
          if(userSnap.exists() && userSnap.data().familyCode) {
            code = userSnap.data().familyCode;
          } else {
            code = Math.random().toString(36).substring(2,8).toUpperCase();
            await setDoc(userRef, {
              familyCode: code,
              email: user.email,
              displayName: user.displayName || '사용자',
              createdAt: new Date().toISOString()
            }, { merge: true });
          }
          const prevCode = localStorage.getItem('chodinglife_familycode');
          if(prevCode && prevCode !== code) resetFamilyDataCache();
          localStorage.setItem('chodinglife_familycode', code);
          setFamilyCode(code);
          // 로컬 점수 → Firebase 동기화 (기존에 로그인 없이 쌓은 점수 복구)
          const currentRole = localStorage.getItem('chodinglife_role');
          if(currentRole === 'parent') {
            try {
              const scoresRef = doc(db, 'families', code, 'data', 'scores');
              const scoresSnap = await getDoc(scoresRef);
              if(!scoresSnap.exists() || (scoresSnap.data().totalPts || 0) === 0) {
                const localScores = JSON.parse(localStorage.getItem('chodinglife_scores') || 'null');
                if(localScores && (localScores.wk > 0 || localScores.tot > 0)) {
                  await setDoc(scoresRef, {
                    weekPts: localScores.wk || 0,
                    todayPts: localScores.today || 0,
                    totalPts: localScores.tot || 0,
                    updatedAt: new Date().toISOString()
                  });
                }
              }
            } catch(e) { console.log('점수 동기화 실패:', e.message); }

            // 로컬 주간목표/보상설정 → Firebase 동기화 (기존에 로컬에만 있던 값 1회 복구)
            try {
              const profileRef = doc(db, 'families', code, 'data', 'profile');
              const profileSnap = await getDoc(profileRef);
              const profileData = profileSnap.exists() ? profileSnap.data() : {};
              const updates = {};
              if(typeof profileData.goal !== 'number') {
                updates.goal = parseInt(localStorage.getItem('chodinglife_goal') || '100');
              }
              if(!profileData.rwI) {
                const localRwI = localStorage.getItem('chodinglife_rw');
                if(localRwI) updates.rwI = localRwI;
              }
              if(Object.keys(updates).length > 0) {
                updates.updatedAt = new Date().toISOString();
                await setDoc(profileRef, updates, { merge: true });
              }
            } catch(e) { console.log('주간목표/보상설정 동기화 실패:', e.message); }
          }
        } catch(e) {
          let code = localStorage.getItem('chodinglife_familycode');
          if(!code) {
            code = Math.random().toString(36).substring(2,8).toUpperCase();
            localStorage.setItem('chodinglife_familycode', code);
          }
          setFamilyCode(code);
        }
      } else {
        const localCode = localStorage.getItem('chodinglife_familycode');
        setFamilyCode(localCode || null);
      }
    });
    return () => unsub();
  }, []);

  // ══════════════════
  // 리셋 체크 (주간 Firestore 리셋 6종: hw_photo_urls/scores/hwlog/bonuslog/arrive/homework)
  // 마운트 1회 + 앱 재개(resume)/탭 다시 보임(visible) 시 재실행됨 — 도장이 같으면 아무것도 안 하므로 안전
  // ══════════════════
  const runResetChecks = useCallback(async (fc) => {
    if(!fc) return;

    // 로컬 도착 데이터 정리: 이번주 이전 날짜 키 삭제 (기기별 로컬 저장공간 정리, 재실행해도 안전한 멱등 작업)
    // arrive의 onSnapshot 병합({...prev,...loaded})은 예전 날짜 키를 지우지 못하므로 로컬에서 별도로 정리
    const thisMondayForArrivePrune = mondayStr(getMonday(new Date()));
    const todayKeyForArrivePrune = localDateStr(new Date());
    setArriveData(prev => {
      const pruned = {};
      Object.keys(prev).forEach(dateKey => {
        if(dateKey >= thisMondayForArrivePrune) pruned[dateKey] = prev[dateKey];
      });
      if(!pruned[todayKeyForArrivePrune]) pruned[todayKeyForArrivePrune] = {};
      localStorage.setItem('chodinglife_arrive_v1', JSON.stringify(pruned));
      return pruned;
    });

    // 주간 리셋: Firestore hw_photo_urls 초기화 (다중 기기 가드 포함)
    try {
      const thisMonday = mondayStr(getMonday(new Date()));
      const urlsRef = doc(db, 'families', fc, 'data', 'hw_photo_urls');
      const snap = await getDoc(urlsRef);
      if(snap.exists()) {
        const data = snap.data();
        const savedResetWeek = data.resetWeek || '';
        if(!savedResetWeek) {
          // 도장이 없는 경우 = 새 주가 아니라 도장 유실/최초 상태일 수 있으므로 삭제 없이 도장만 찍음
          await setDoc(urlsRef, { resetWeek: thisMonday }, { merge: true });
        } else if(savedResetWeek === legacyMondayStr(thisMonday)) {
          // 같은 주인데 구버전(하루 이른) 라벨로 찍혀있던 경우 — 데이터는 건드리지 않고 도장만 새 형식으로 교체
          await setDoc(urlsRef, { resetWeek: thisMonday }, { merge: true });
        } else if(savedResetWeek !== thisMonday) {
          const lastRef = doc(db, 'families', fc, 'data', 'hw_photo_urls_last');
          await setDoc(lastRef, { urls: data.urls || {}, savedAt: new Date().toISOString() });
          await setDoc(urlsRef, { urls: {}, resetWeek: thisMonday, updatedAt: new Date().toISOString() });
        }
      }
    } catch(e) {
      console.warn('[hwPhotoReset] Firestore 리셋 실패:', e.message);
    }

    // 주간/일간 리셋: Firestore scores 초기화 (weekPts→주간, todayPts→일간, totalPts는 누적 유지). 다중 기기 가드 포함
    try {
      const thisMonday = mondayStr(getMonday(new Date()));
      const todayStr = localDateStr(new Date());
      const scoresRef = doc(db, 'families', fc, 'data', 'scores');
      const snap = await getDoc(scoresRef);
      if(snap.exists()) {
        const data = snap.data();
        const savedResetWeek = data.resetWeek || '';
        const savedResetDay = data.resetDay || '';
        const updates = {};
        if(!savedResetWeek) {
          updates.resetWeek = thisMonday;
        } else if(savedResetWeek === legacyMondayStr(thisMonday)) {
          updates.resetWeek = thisMonday;
        } else if(savedResetWeek !== thisMonday) {
          updates.weekPts = 0;
          updates.resetWeek = thisMonday;
        }
        if(!savedResetDay) {
          updates.resetDay = todayStr;
        } else if(savedResetDay !== todayStr) {
          updates.todayPts = 0;
          updates.resetDay = todayStr;
        }
        if(Object.keys(updates).length) {
          updates.updatedAt = new Date().toISOString();
          await setDoc(scoresRef, updates, { merge: true });
        }
      }
    } catch(e) {
      console.warn('[scoresReset] Firestore 리셋 실패:', e.message);
    }

    // 주간 리셋: Firestore hwlog 초기화 (다중 기기 가드 포함)
    try {
      const thisMonday = mondayStr(getMonday(new Date()));
      const hwLogRef = doc(db, 'families', fc, 'data', 'hwlog');
      const snap = await getDoc(hwLogRef);
      if(snap.exists()) {
        const data = snap.data();
        const savedResetWeek = data.resetWeek || '';
        if(!savedResetWeek) {
          await setDoc(hwLogRef, { resetWeek: thisMonday }, { merge: true });
        } else if(savedResetWeek === legacyMondayStr(thisMonday)) {
          await setDoc(hwLogRef, { resetWeek: thisMonday }, { merge: true });
        } else if(savedResetWeek !== thisMonday) {
          await setDoc(hwLogRef, { hwLog: JSON.stringify({}), resetWeek: thisMonday, updatedAt: new Date().toISOString() }, { merge: true });
        }
      }
    } catch(e) {
      console.warn('[hwLogReset] Firestore 리셋 실패:', e.message);
    }

    // 주간 리셋: Firestore bonuslog 정리 (이번주 이전 항목 삭제, 다중 기기 가드 포함)
    try {
      const monday = getMonday(new Date());
      const thisMonday = mondayStr(monday);
      const mondayTs = monday.getTime();
      const bonusLogRef = doc(db, 'families', fc, 'data', 'bonuslog');
      const snap = await getDoc(bonusLogRef);
      if(snap.exists()) {
        const data = snap.data();
        const savedResetWeek = data.resetWeek || '';
        if(!savedResetWeek) {
          await setDoc(bonusLogRef, { resetWeek: thisMonday }, { merge: true });
        } else if(savedResetWeek === legacyMondayStr(thisMonday)) {
          await setDoc(bonusLogRef, { resetWeek: thisMonday }, { merge: true });
        } else if(savedResetWeek !== thisMonday) {
          const loaded = data.bonusLog ? JSON.parse(data.bonusLog) : {};
          const pruned = {};
          Object.keys(loaded).forEach(k => {
            const ts = loaded[k].ts || parseInt(k);
            if(ts >= mondayTs) pruned[k] = loaded[k];
          });
          await setDoc(bonusLogRef, { bonusLog: JSON.stringify(pruned), resetWeek: thisMonday, updatedAt: new Date().toISOString() }, { merge: true });
        }
      }
    } catch(e) {
      console.warn('[bonusLogReset] Firestore 리셋 실패:', e.message);
    }

    // 주간 리셋: Firestore arrive 정리 (이번주 이전 날짜 키 삭제, 다중 기기 가드 포함)
    try {
      const thisMonday = mondayStr(getMonday(new Date()));
      const arriveRef = doc(db, 'families', fc, 'data', 'arrive');
      const snap = await getDoc(arriveRef);
      if(snap.exists()) {
        const data = snap.data();
        const savedResetWeek = data.resetWeek || '';
        if(!savedResetWeek) {
          await setDoc(arriveRef, { resetWeek: thisMonday }, { merge: true });
        } else if(savedResetWeek === legacyMondayStr(thisMonday)) {
          await setDoc(arriveRef, { resetWeek: thisMonday }, { merge: true });
        } else if(savedResetWeek !== thisMonday) {
          const loaded = data.arriveData ? JSON.parse(data.arriveData) : {};
          const pruned = {};
          Object.keys(loaded).forEach(dateKey => {
            if(dateKey >= thisMonday) pruned[dateKey] = loaded[dateKey];
          });
          await setDoc(arriveRef, { arriveData: JSON.stringify(pruned), resetWeek: thisMonday, updatedAt: new Date().toISOString() }, { merge: true });
        }
      }
    } catch(e) {
      console.warn('[arriveReset] Firestore 리셋 실패:', e.message);
    }

    // 주간 리셋: Firestore homework 초기화 (다중 기기 가드 포함) — hwData(day_1~day_6 슬롯 구조는 유지, resetWeek 도장으로만 판정)
    try {
      const thisMonday = mondayStr(getMonday(new Date()));
      const hwRef = doc(db, 'families', fc, 'data', 'homework');
      const snap = await getDoc(hwRef);
      if(snap.exists()) {
        const data = snap.data();
        const savedResetWeek = data.resetWeek || '';
        if(!savedResetWeek) {
          await setDoc(hwRef, { resetWeek: thisMonday }, { merge: true });
        } else if(savedResetWeek === legacyMondayStr(thisMonday)) {
          await setDoc(hwRef, { resetWeek: thisMonday }, { merge: true });
        } else if(savedResetWeek !== thisMonday) {
          const currentHw = data.hwData ? JSON.parse(data.hwData) : {};
          await setDoc(hwRef, { hwData: JSON.stringify({}), hwDataLast: JSON.stringify(currentHw), resetWeek: thisMonday, updatedAt: new Date().toISOString() }, { merge: true });
          setHwData({});
          setHwLastData(currentHw);
          localStorage.setItem('chodinglife_hw_current', JSON.stringify({}));
          localStorage.setItem('chodinglife_hw_last', JSON.stringify(currentHw));
          localStorage.setItem('chodinglife_hw_updated', new Date().toISOString());
        }
      }
    } catch(e) {
      console.warn('[homeworkReset] Firestore 리셋 실패:', e.message);
    }
  }, []);

  // familyCode 변경 시 실시간 감지 시작
  useEffect(() => {
    if(!familyCode) return;
    const unsubs = [];

    // 리셋 체크: 마운트 1회 실행
    runResetChecks(familyCode);

    // 리셋 체크 재실행: 네이티브는 앱 재개(resume), 웹은 탭 다시 보임(visible)
    let resumeListenerPromise = null;
    const handleVisibility = () => {
      if(document.visibilityState === 'visible') runResetChecks(familyCode);
    };
    if(Capacitor.isNativePlatform()) {
      resumeListenerPromise = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if(isActive) runResetChecks(familyCode);
      });
    } else {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    // 스케쥴 감지
    const schedRef = doc(db, 'families', familyCode, 'data', 'schedule');
    unsubs.push(onSnapshot(schedRef, (snap) => {
      if(snap.exists()) {
        const data = snap.data();
        if(data.SCH) {
          const newSCH = JSON.parse(data.SCH);
          setSCH(prev => { const m = {...prev,...newSCH}; localStorage.setItem('chodinglife_sch_v1',JSON.stringify(m)); return m; });
        }
        if(data.FREE) {
          const newFREE = JSON.parse(data.FREE);
          setFREE(prev => { const m = {...prev,...newFREE}; localStorage.setItem('chodinglife_free_v1',JSON.stringify(m)); return m; });
        }
      } else {
        // 새 가족코드인데 스케줄 문서가 아직 없는 경우 — 이전 창고의 스케줄이 화면에 남지 않도록 기본 스케줄로 표시
        const def = makeDefaultSchedule();
        setSCH(def);
        localStorage.setItem('chodinglife_sch_v1', JSON.stringify(def));
        setFREE({});
        localStorage.setItem('chodinglife_free_v1', JSON.stringify({}));
      }
    }, (e) => { console.warn('[onSnapshot] schedule 권한 오류:', e.code); }));

    // 숙제 감지
    const hwRef = doc(db, 'families', familyCode, 'data', 'homework');
    unsubs.push(onSnapshot(hwRef, (snap) => {
      if(snap.exists() && snap.data().hwData) {
        const thisMonday = mondayStr(getMonday(new Date()));
        const remoteResetWeek = snap.data().resetWeek || '';
        if(remoteResetWeek && remoteResetWeek !== thisMonday && remoteResetWeek !== legacyMondayStr(thisMonday)) {
          // 아직 새 주로 리셋되기 전(지난주 도장)인 원격 데이터 — 이번주 버킷에 섞이지 않도록 병합 건너뜀
          return;
        }
        const loaded = JSON.parse(snap.data().hwData);
        const remoteTime = snap.data().updatedAt || '';
        const localTime = localStorage.getItem('chodinglife_hw_updated') || '';
        if(remoteTime > localTime) {
          setHwData(prev => {
            const merged = {...prev};
            Object.keys(loaded).forEach(k => {
              if(!merged[k]) merged[k] = {};
              Object.keys(loaded[k]).forEach(ds => {
                merged[k][ds] = {...(merged[k][ds]||{}), ...loaded[k][ds]};
              });
            });
            localStorage.setItem('chodinglife_hw_current', JSON.stringify(merged));
            localStorage.setItem('chodinglife_hw_updated', remoteTime);
            return merged;
          });
        }
      } else {
        // 초기화(문서 삭제) 등으로 문서가 없어진 경우 — 병합을 거치지 않고 바로 비움
        setHwData({});
        localStorage.setItem('chodinglife_hw_current', JSON.stringify({}));
      }
    }, (e) => { console.warn('[onSnapshot] homework 권한 오류:', e.code); }));

    // 사진 URL 감지
    const photoRef = doc(db, 'families', familyCode, 'data', 'hw_photo_urls');
    unsubs.push(onSnapshot(photoRef, (snap) => {
      if(snap.exists()) setHwPhotoUrls(snap.data().urls || {});
      else setHwPhotoUrls({});
    }, (e) => { console.warn('[onSnapshot] hw_photo_urls 권한 오류:', e.code); }));

    // 지난주 사진 URL 감지
    const photoLastRef = doc(db, 'families', familyCode, 'data', 'hw_photo_urls_last');
    unsubs.push(onSnapshot(photoLastRef, (snap) => {
      if(snap.exists()) setHwPhotoUrlsLast(snap.data().urls || {});
    }, (e) => { console.warn('[onSnapshot] hw_photo_urls_last 권한 오류:', e.code); }));

    // 포인트 감지
    const scoresRef = doc(db, 'families', familyCode, 'data', 'scores');
    unsubs.push(onSnapshot(scoresRef, (snap) => {
      if(snap.exists()) {
        const data = snap.data();
        const wk = data.weekPts || 0;
        const today = data.todayPts || 0;
        const tot = data.totalPts || 0;
        setWkS(wk);
        setTodayS(today);
        setTotS(tot);
        localStorage.setItem('chodinglife_scores', JSON.stringify({ wk, today, tot }));
      } else {
        setWkS(0);
        setTodayS(0);
        setTotS(0);
        localStorage.setItem('chodinglife_scores', JSON.stringify({ wk: 0, today: 0, tot: 0 }));
      }
    }, (e) => { console.warn('[onSnapshot] scores 권한 오류:', e.code); }));

    // hwLog 감지
    const hwLogRef = doc(db, 'families', familyCode, 'data', 'hwlog');
    unsubs.push(onSnapshot(hwLogRef, (snap) => {
      if(snap.exists() && snap.data().hwLog) {
        const loaded = JSON.parse(snap.data().hwLog);
        setHwLog(loaded);
        localStorage.setItem('chodinglife_hw_log', JSON.stringify(loaded));
      } else {
        setHwLog({});
        localStorage.setItem('chodinglife_hw_log', JSON.stringify({}));
      }
    }, (e) => { console.warn('[onSnapshot] hwlog 권한 오류:', e.code); }));

    // 아이 프로필 사진 + 주간 목표 + 보상 설정 감지
    const profileRef = doc(db, 'families', familyCode, 'data', 'profile');
    unsubs.push(onSnapshot(profileRef, (snap) => {
      if(snap.exists() && snap.data().childPhotoUrl) {
        setChildPhotoUrl(snap.data().childPhotoUrl);
      } else {
        setChildPhotoUrl(null);
      }
      if(snap.exists() && typeof snap.data().goal === 'number') {
        const g = snap.data().goal;
        setGoal(g);
        localStorage.setItem('chodinglife_goal', String(g));
      }
      if(snap.exists() && snap.data().rwI) {
        try {
          const loadedRwI = JSON.parse(snap.data().rwI);
          setRwI(loadedRwI);
          localStorage.setItem('chodinglife_rw', JSON.stringify(loadedRwI));
        } catch(e) { console.warn('[onSnapshot] profile rwI 파싱 실패:', e.message); }
      }
    }, (e) => { console.warn('[onSnapshot] profile 권한 오류:', e.code); }));

    // 도착 기록 감지 (아이가 쓰면 부모가 실시간으로 수신)
    const arriveSnapRef = doc(db, 'families', familyCode, 'data', 'arrive');
    unsubs.push(onSnapshot(arriveSnapRef, (snap) => {
      if(snap.exists() && snap.data().arriveData) {
        const loaded = JSON.parse(snap.data().arriveData);
        setArriveData(prev => {
          const merged = { ...prev, ...loaded };
          localStorage.setItem('chodinglife_arrive_v1', JSON.stringify(merged));
          return merged;
        });
      } else {
        const emptyArrive = { [todayKey]: {} };
        setArriveData(emptyArrive);
        localStorage.setItem('chodinglife_arrive_v1', JSON.stringify(emptyArrive));
      }
    }, (e) => { console.warn('[onSnapshot] arrive 권한 오류:', e.code); }));

    // 보너스 로그 감지 (부모가 쓰면 아이가 실시간으로 수신)
    const bonusLogSnapRef = doc(db, 'families', familyCode, 'data', 'bonuslog');
    unsubs.push(onSnapshot(bonusLogSnapRef, (snap) => {
      if(snap.exists() && snap.data().bonusLog) {
        const loaded = JSON.parse(snap.data().bonusLog);
        setBonusLog(loaded);
        localStorage.setItem('chodinglife_bonus_log', JSON.stringify(loaded));
      } else {
        setBonusLog({});
        localStorage.setItem('chodinglife_bonus_log', JSON.stringify({}));
      }
    }, (e) => { console.warn('[onSnapshot] bonuslog 권한 오류:', e.code); }));

    // 응원메시지 감지 (부모가 쓰면 아이가 실시간으로 수신)
    const msgSnapRef = doc(db, 'families', familyCode, 'data', 'message');
    unsubs.push(onSnapshot(msgSnapRef, (snap) => {
      setMessage(snap.exists() ? snap.data() : null);
    }, (e) => {
      console.warn('[onSnapshot] message 권한 오류:', e.code);
      setMessage(null);
    }));

    // 커스텀 숙제 항목 감지 (부모가 추가하면 아이 화면에 실시간 반영)
    const hwExtraRef = doc(db, 'families', familyCode, 'data', 'hw_extra');
    unsubs.push(onSnapshot(hwExtraRef, (snap) => {
      setHwExtra(snap.exists() ? (snap.data().items || []) : []);
    }, (e) => { console.warn('[onSnapshot] hw_extra 권한 오류:', e.code); }));

    return () => {
      unsubs.forEach(u => u());
      if(resumeListenerPromise) resumeListenerPromise.then(h => h.remove());
      else document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [familyCode, role, runResetChecks]);

  // ══════════════════
  // 저장 함수들
  // ══════════════════
  const saveSCH = useCallback(async (newSCH, newFREE) => {
    setSCH(newSCH);
    setFREE(newFREE || FREE);
    localStorage.setItem('chodinglife_sch_v1', JSON.stringify(newSCH));
    localStorage.setItem('chodinglife_free_v1', JSON.stringify(newFREE || FREE));
    if(fbUser && familyCode) {
      try {
        const schedRef = doc(db, 'families', familyCode, 'data', 'schedule');
        await setDoc(schedRef, {
          SCH: JSON.stringify(newSCH),
          FREE: JSON.stringify(newFREE || FREE),
          updatedAt: new Date().toISOString()
        });
      } catch(e) { console.log('스케쥴 Firestore 저장 실패:', e.message); }
    }
  }, [fbUser, familyCode, FREE]);

  const saveScores = useCallback(async (wk, today, tot) => {
    setWkS(wk); setTodayS(today); setTotS(tot);
    localStorage.setItem('chodinglife_scores', JSON.stringify({wk, today, tot}));
    if(familyCode) {
      try {
        const scoresRef = doc(db, 'families', familyCode, 'data', 'scores');
        await setDoc(scoresRef, {
          weekPts: wk, todayPts: today, totalPts: tot,
          updatedAt: new Date().toISOString()
        });
      } catch(e) { console.log('포인트 저장 실패:', e.message); }
    }
  }, [fbUser, familyCode, role]);

  const saveHwData = useCallback(async (newHwData) => {
    setHwData(newHwData);
    const noPhoto = {};
    Object.keys(newHwData).forEach(k => {
      noPhoto[k] = {};
      Object.keys(newHwData[k]).forEach(ds => {
        const {photo, ...rest} = newHwData[k][ds];
        noPhoto[k][ds] = rest;
      });
    });
    const now = new Date().toISOString();
    localStorage.setItem('chodinglife_hw_current', JSON.stringify(noPhoto));
    localStorage.setItem('chodinglife_hw_updated', now);
    if(familyCode) {
      try {
        const hwRef = doc(db, 'families', familyCode, 'data', 'homework');
        await setDoc(hwRef, { hwData: JSON.stringify(noPhoto), updatedAt: now }, { merge: true });
      } catch(e) { console.log('숙제 저장 실패:', e.message); }
    }
  }, [familyCode]);

  const saveHwLog = useCallback(async (newLog) => {
    setHwLog(newLog);
    localStorage.setItem('chodinglife_hw_log', JSON.stringify(newLog));
    if(fbUser && familyCode) {
      try {
        const hwLogRef = doc(db, 'families', familyCode, 'data', 'hwlog');
        await setDoc(hwLogRef, {
          hwLog: JSON.stringify(newLog),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch(e) { console.log('hwLog 저장 실패:', e.message); }
    }
  }, [fbUser, familyCode]);

  const saveArrive = useCallback(async (newData) => {
    setArriveData(newData);
    localStorage.setItem('chodinglife_arrive_v1', JSON.stringify(newData));
    if(familyCode) {
      try {
        const arriveRef = doc(db, 'families', familyCode, 'data', 'arrive');
        await setDoc(arriveRef, {
          arriveData: JSON.stringify(newData),
          updatedAt: new Date().toISOString()
        });
      } catch(e) { console.log('도착 Firestore 저장 실패:', e.message); }
    }
  }, [familyCode]);

  const saveHwExtra = useCallback(async (newExtra) => {
    setHwExtra(newExtra);
    if(familyCode) {
      try {
        const extraRef = doc(db, 'families', familyCode, 'data', 'hw_extra');
        await setDoc(extraRef, { items: newExtra, updatedAt: new Date().toISOString() });
      } catch(e) { console.log('hwExtra 저장 실패:', e.message); }
    }
  }, [familyCode]);

  const saveHwPhotos = useCallback((newPhotos) => {
    setHwPhotos(newPhotos);
    try {
      localStorage.setItem('chodinglife_hw_photos', JSON.stringify(newPhotos));
    } catch(e) {
      toast('⚠️ 저장 공간 부족! 이전 사진 일부가 삭제됐어요.');
    }
  }, [toast]);

  // 아이 프로필 사진 업로드
  const uploadChildPhoto = useCallback(async (file) => {
    if(!familyCode) return;
    try {
      const storageRef = ref(storage, `families/${familyCode}/child_profile.jpg`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setChildPhotoUrl(url);
      const profileRef = doc(db, 'families', familyCode, 'data', 'profile');
      await setDoc(profileRef, { childPhotoUrl: url, updatedAt: new Date().toISOString() }, { merge: true });
      toast('📸 사진 저장됐어요!');
    } catch(e) { toast('사진 업로드 실패 😢'); console.error(e); }
  }, [familyCode, toast]);

  const removeChildPhoto = useCallback(async () => {
    if(!familyCode) return;
    setChildPhotoUrl(null);
    try {
      const storageRef = ref(storage, `families/${familyCode}/child_profile.jpg`);
      await deleteObject(storageRef);
      const profileRef = doc(db, 'families', familyCode, 'data', 'profile');
      await setDoc(profileRef, { childPhotoUrl: null, updatedAt: new Date().toISOString() }, { merge: true });
      toast('사진 삭제됐어요!');
    } catch(e) { console.log('사진 삭제:', e.message); }
  }, [familyCode, toast]);

  // 숙제 사진 삭제 (Firebase Storage + Firestore + 로컬 state)
  const deleteHwPhoto = useCallback(async (key, ds) => {
    if(!familyCode) return;
    const photoKey = `${key}_${ds}`;
    // 로컬 state 즉시 업데이트 (UI 즉각 반응)
    setHwPhotoUrls(prev => { const n={...prev}; delete n[photoKey]; return n; });
    const newPhotos = {...hwPhotos}; delete newPhotos[photoKey];
    saveHwPhotos(newPhotos);
    try {
      // 1. Firebase Storage 파일 삭제 (파일 없으면 무시)
      try {
        const storageRef = ref(storage, `families/${familyCode}/hw_photos/${photoKey}.jpg`);
        await deleteObject(storageRef);
      } catch(se) {
        if(se.code !== 'storage/object-not-found') throw se;
      }
      // 2. Firestore hw_photo_urls 문서에서 해당 키만 제거
      const urlsRef = doc(db, 'families', familyCode, 'data', 'hw_photo_urls');
      const snap = await getDoc(urlsRef);
      if(snap.exists()) {
        const urls = snap.data().urls || {};
        delete urls[photoKey];
        await setDoc(urlsRef, { urls, updatedAt: new Date().toISOString() }, { merge: true });
      }
      toast('사진 삭제됐어요!');
    } catch(e) {
      console.error('[deleteHwPhoto] 삭제 실패:', e);
      toast('삭제에 실패했어요 😢');
    }
  }, [familyCode, hwPhotos, saveHwPhotos, toast]);

  // 숙제 사진 업로드 (압축 → Firebase Storage)
  const uploadHwPhoto = useCallback(async (key, ds, file, onDone) => {
    if(!familyCode) { onDone && onDone(); return; }
    // 1단계: 압축 (실패 시 fallback 없이 명확히 종료)
    let blob;
    try {
      blob = await compressImage(file);
    } catch(ce) {
      console.error('[uploadHwPhoto] 압축 실패:', ce);
      toast('사진 처리에 실패했어요 😢');
      onDone && onDone();
      return;
    }
    // 2단계: Storage 업로드 + Firestore 저장
    try {
      const storageRef = ref(storage, `families/${familyCode}/hw_photos/${key}_${ds}.jpg`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      const urlsRef = doc(db, 'families', familyCode, 'data', 'hw_photo_urls');
      const snap = await getDoc(urlsRef);
      const urls = snap.exists() ? (snap.data().urls || {}) : {};
      urls[`${key}_${ds}`] = url;
      await setDoc(urlsRef, { urls, updatedAt: new Date().toISOString() }, { merge: true });
      setHwPhotoUrls(prev => ({...prev, [`${key}_${ds}`]: url}));
      toast('📷 사진 업로드 완료!');
      onDone && onDone(url);
    } catch(e) {
      toast('사진 업로드 실패 😢');
      console.error(e);
      onDone && onDone();
    }
  }, [familyCode, toast]);

  // getHwPhoto: 로컬 우선, 없으면 Firestore URL
  const getHwPhoto = useCallback((key, ds) => {
    return hwPhotos[`${key}_${ds}`] || hwPhotoUrls[`${key}_${ds}`] || '';
  }, [hwPhotos, hwPhotoUrls]);

  const getHwLastPhoto = useCallback((key, ds) => {
    return hwLastPhotos[`${key}_${ds}`] || hwPhotoUrlsLast[`${key}_${ds}`] || '';
  }, [hwLastPhotos, hwPhotoUrlsLast]);

  // ── Auth 함수들
  const doEmailLogin = useCallback(async (email, pw) => {
    try {
      await signInWithEmailAndPassword(auth, email, pw);
      localStorage.setItem('chodinglife_role', 'parent');
      setRole('parent');
      toast('✅ 로그인 완료!');
      return true;
    } catch(e) {
      if(e.code === 'auth/user-not-found') toast('등록되지 않은 이메일이에요!');
      else if(e.code === 'auth/wrong-password') toast('비밀번호가 틀렸어요!');
      else if(e.code === 'auth/invalid-credential') toast('이메일 또는 비밀번호가 틀렸어요!');
      else toast('로그인 실패 😢 다시 시도해주세요');
      return false;
    }
  }, [toast]);

  const doEmailSignup = useCallback(async (email, pw) => {
    try {
      await createUserWithEmailAndPassword(auth, email, pw);
      toast('✅ 회원가입 완료!');
      return true;
    } catch(e) {
      if(e.code === 'auth/email-already-in-use') toast('이미 사용중인 이메일이에요!');
      else if(e.code === 'auth/invalid-email') toast('이메일 형식이 올바르지 않아요!');
      else toast('회원가입 실패 😢 다시 시도해주세요');
      return false;
    }
  }, [toast]);

  const doGoogleLogin = useCallback(async () => {
    try {
      if(Capacitor.isNativePlatform()) {
        // 앱(웹뷰)에서는 signInWithPopup이 "missing initial state" 에러로 실패함
        // → 네이티브 Google 로그인(Credential Manager)으로 idToken을 받아 auth에 연결
        const result = await FirebaseAuthentication.signInWithGoogle();
        const idToken = result.credential?.idToken;
        if(!idToken) throw new Error('구글 idToken을 받지 못했어요');
        const credential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(auth, credential);
      } else {
        await signInWithPopup(auth, googleProvider);
      }
      localStorage.setItem('chodinglife_role', 'parent');
      setRole('parent');
      toast('✅ 구글 로그인 완료!');
    } catch(e) {
      if(e.code !== 'auth/popup-closed-by-user') toast('로그인 실패 😢');
    }
  }, [toast]);

  // 카카오 OIDC 로그인 — 네이티브는 커스텀 토큰 브릿지(exchangeKakaoToken) 경유
  // (signInWithOpenIdConnect가 nonce를 반환하지 않아 JS signInWithCredential이 auth/missing-or-invalid-nonce로 막힘 — 우회)
  const doKakaoLogin = useCallback(async () => {
    try {
      if(Capacitor.isNativePlatform()) {
        await FirebaseAuthentication.signInWithOpenIdConnect({ providerId: 'oidc.oidc.kakao' });
        let nativeIdToken;
        try {
          const idTokenResult = await FirebaseAuthentication.getIdToken();
          nativeIdToken = idTokenResult.token;
        } catch(e) {
          console.log('[Kakao] 네이티브 idToken 획득 실패', e.code, e.message);
          throw e;
        }
        let customToken;
        try {
          const callable = httpsCallable(functions, 'exchangeKakaoToken');
          const res = await callable({ idToken: nativeIdToken });
          customToken = res.data?.customToken;
        } catch(e) {
          console.log('[Kakao] exchangeKakaoToken 호출 실패', e.code, e.message);
          throw e;
        }
        try {
          await signInWithCustomToken(auth, customToken);
        } catch(e) {
          console.log('[Kakao] signInWithCustomToken 실패', e.code, e.message);
          throw e;
        }
      } else {
        const provider = new OAuthProvider('oidc.oidc.kakao');
        await signInWithPopup(auth, provider);
      }
      localStorage.setItem('chodinglife_role', 'parent');
      setRole('parent');
      toast('✅ 카카오 로그인 완료!');
      console.log('[Kakao] 로그인 성공', auth.currentUser?.uid);
    } catch(e) {
      console.log('[Kakao] 로그인 실패', e.code, e.message);
      if(e.code !== 'auth/popup-closed-by-user') toast('로그인 실패 😢');
    }
  }, [toast]);

  const selectRole = useCallback((r) => {
    setRole(r);
    localStorage.setItem('chodinglife_role', r);
  }, []);

  const resetRole = useCallback(() => {
    localStorage.removeItem('chodinglife_role');
    localStorage.removeItem('chodinglife_linkedcode');
    setRole(null);
    setFamilyCode(null);
    setCurrentPage('main');
  }, []);

  const doLogout = useCallback(async () => {
    if(!window.confirm('로그아웃 하시겠어요?')) return;
    await signOut(auth);
    resetRole();
  }, [resetRole]);

  const copyFamilyCode = useCallback(() => {
    const code = familyCode || '';
    navigator.clipboard.writeText(code).then(() => toast('코드 복사됨! 📋'));
  }, [familyCode, toast]);

  const confirmChildCode = useCallback((code) => {
    if(code.length !== 6) { toast('6자리 코드를 입력해주세요!'); return false; }
    const prevCode = localStorage.getItem('chodinglife_familycode');
    if(prevCode && prevCode !== code) resetFamilyDataCache();
    localStorage.setItem('chodinglife_role', 'child');
    localStorage.setItem('chodinglife_linkedcode', code);
    localStorage.setItem('chodinglife_familycode', code);
    setRole('child');
    setFamilyCode(code);
    toast('🎉 연동 완료! 데이터 불러오는 중...');
    return true;
  }, [toast, resetFamilyDataCache]);

  // ── 포인트
  const addScore = useCallback((pts) => {
    setWkS(prev => {
      const nw = prev + pts;
      setTodayS(td => {
        const nt = td + pts;
        setTotS(tt => {
          const nt2 = tt + pts;
          saveScores(nw, nt, nt2);
          return nt2;
        });
        return nt;
      });
      return nw;
    });
  }, [saveScores]);

  const subtractScore = useCallback((pts) => {
    setWkS(prev => {
      const nw = Math.max(0, prev - pts);
      setTodayS(td => {
        const nt = Math.max(0, td - pts);
        setTotS(tt => {
          const nt2 = Math.max(0, tt - pts);
          saveScores(nw, nt, nt2);
          return nt2;
        });
        return nt;
      });
      return nw;
    });
  }, [saveScores]);

  const bonus = useCallback((name, pts) => {
    addScore(pts);
    const newLog = {...bonusLog, [Date.now()]: {name, pts, ts: Date.now()}};
    setBonusLog(newLog);
    localStorage.setItem('chodinglife_bonus_log', JSON.stringify(newLog));
    if(familyCode) {
      try {
        const bonusRef = doc(db, 'families', familyCode, 'data', 'bonuslog');
        setDoc(bonusRef, { bonusLog: JSON.stringify(newLog), updatedAt: new Date().toISOString() });
      } catch(e) { console.log('보너스 Firestore 저장 실패:', e.message); }
    }
    toast(`🌟 ${name} +${pts}점!`);
  }, [addScore, bonusLog, familyCode, toast]);

  // 보상 선택 기록 (bonuslog와 동일 패턴: 타임스탬프 키맵 JSON 문자열)
  // rewardLog는 실시간 구독 대상이 아니라 로컬 state가 없으므로, bonus()처럼 스프레드하는 대신
  // 쓰기 직전에 getDoc으로 현재 값을 읽어와 합침
  const pickReward = useCallback(async (name) => {
    if(!familyCode) { toast('로그인이 필요해요 😢'); return false; }
    try {
      const rewardRef = doc(db, 'families', familyCode, 'data', 'rewardlog');
      const snap = await getDoc(rewardRef);
      const existing = snap.exists() && snap.data().rewardLog ? JSON.parse(snap.data().rewardLog) : {};
      const newLog = { ...existing, [Date.now()]: { name, ts: Date.now() } };
      await setDoc(rewardRef, { rewardLog: JSON.stringify(newLog), updatedAt: new Date().toISOString() }, { merge: true });
      toast(`"${name}" 선택! 부모님께 알림! 📱`);
      return true;
    } catch(e) {
      console.log('보상 선택 저장 실패:', e.message);
      toast('저장 실패 😢 다시 시도해주세요');
      return false;
    }
  }, [familyCode, toast]);

  const sendMessage = useCallback(async (text) => {
    if(!familyCode) return;
    const today = localDateStr(new Date());
    try {
      const msgRef = doc(db, 'families', familyCode, 'data', 'message');
      await setDoc(msgRef, { text, sentAt: today, sentBy: 'parent' });
      toast('💌 응원메시지 전송됐어요!');
    } catch(e) {
      toast('전송 실패 😢');
      console.error(e);
    }
  }, [familyCode, toast]);

  const deleteMessage = useCallback(async () => {
    if(!familyCode) return;
    try {
      const msgRef = doc(db, 'families', familyCode, 'data', 'message');
      await deleteDoc(msgRef);
    } catch(e) {
      toast('삭제 실패 😢');
      console.error(e);
    }
  }, [familyCode, toast]);

  // ── 숙제 완료 처리
  const parentApproveHw = useCallback((key, ds) => {
    const current = (hwData[key]||{})[ds]||{};
    const isDone = current.status === 'done';
    if(isDone) {
      const newData = {...hwData, [key]: {...(hwData[key]||{}), [ds]: {...current, status:'none'}}};
      saveHwData(newData);
      subtractScore(20);
      const newLog = {...hwLog};
      delete newLog[`${key}_${ds}`];
      saveHwLog(newLog);
      toast('↩️ 완료 취소됐어요. -20점');
    } else {
      const newData = {...hwData, [key]: {...(hwData[key]||{}), [ds]: {...current, status:'done'}}};
      saveHwData(newData);
      addScore(20);
      const DN_KR = ['월','화','수','목','금','토','일'];
      const dayIdx = parseInt(ds.replace('day_',''));
      const info = HW_INFO[key] || {n:key, e:'📚'};
      const newLog = {...hwLog, [`${key}_${ds}`]: {
        name: info.n||key, emoji: info.e, ds, dayLabel: DN_KR[dayIdx]||'', ts: Date.now()
      }};
      saveHwLog(newLog);
      toast('✅ 완료 처리! +20점 지급!');
    }
  }, [hwData, hwLog, saveHwData, saveHwLog, addScore, subtractScore, toast]);

  // ── 도착 체크
  const arriveNow = useCallback((curD, idx, itemName, itemEmoji) => {
    const key = `${curD}_${idx}_${itemName}`;
    const newData = {...arriveData, [todayKey]: {...(arriveData[todayKey]||{}), [key]: true}};
    saveArrive(newData);
    addScore(10);
    toast(`📍 ${itemName} 도착! +10점 🎉`);
  }, [arriveData, todayKey, saveArrive, addScore, toast]);

  // ── 비밀 리셋 카운터
  const secretCountRef = useRef(0);
  const secretTimerRef = useRef(null);
  const secretReset = useCallback(() => {
    secretCountRef.current++;
    clearTimeout(secretTimerRef.current);
    secretTimerRef.current = setTimeout(() => { secretCountRef.current = 0; }, 2000);
    if(secretCountRef.current >= 5) {
      secretCountRef.current = 0;
      if(window.confirm('🔧 역할 초기화\n부모/아이 선택 화면으로 돌아갈게요!')) {
        resetRole();
      }
    }
  }, [resetRole]);

  const value = {
    // 상태
    role, fbUser, authReady, familyCode, currentPage, setCurrentPage,
    parentTab, setParentTab,
    SCH, FREE, wkS, todayS, totS, goal, setGoal,
    hwData, hwLastData, hwPhotos, hwLastPhotos, hwExtra,
    hwLog, hwPhotoUrls, arriveData, todayKey,
    childPhotoUrl, bonusLog, message, toastMsg, rwI, setRwI,
    // 저장
    saveSCH, saveScores, saveHwData, saveHwLog, saveArrive, saveHwPhotos, saveHwExtra,
    // Auth
    doEmailLogin, doEmailSignup, doGoogleLogin, doKakaoLogin, doLogout,
    selectRole, resetRole, copyFamilyCode, confirmChildCode,
    // 액션
    toast, addScore, subtractScore, bonus, pickReward, sendMessage, deleteMessage, parentApproveHw,
    arriveNow, secretReset,
    // 사진
    uploadChildPhoto, removeChildPhoto, uploadHwPhoto, deleteHwPhoto,
    getHwPhoto, getHwLastPhoto,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}

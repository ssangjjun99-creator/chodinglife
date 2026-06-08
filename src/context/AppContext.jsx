import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  onAuthStateChanged, signOut, signInWithPopup,
  createUserWithEmailAndPassword, signInWithEmailAndPassword
} from 'firebase/auth';
import {
  doc, setDoc, getDoc, onSnapshot
} from 'firebase/firestore';
import {
  ref, uploadBytes, getDownloadURL, deleteObject
} from 'firebase/storage';
import { auth, db, storage, googleProvider } from '../firebase/config';
import {
  makeDefaultSchedule, checkHwWeekReset, H, mondayStr, getMonday
} from '../utils/scheduleUtils';

const AppContext = createContext(null);

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
  const [wkS, setWkS] = useState(0);
  const [todayS, setTodayS] = useState(0);
  const [totS, setTotS] = useState(0);
  const [goal, setGoal] = useState(() => parseInt(localStorage.getItem('chodinglife_goal')||'100'));

  // ── 숙제
  const [hwData, setHwData] = useState(() => {
    checkHwWeekReset();
    return JSON.parse(localStorage.getItem('chodinglife_hw_current') || '{}');
  });
  const [hwLastData] = useState(() =>
    JSON.parse(localStorage.getItem('chodinglife_hw_last') || '{}')
  );
  const [hwPhotos, setHwPhotos] = useState(() =>
    JSON.parse(localStorage.getItem('chodinglife_hw_photos') || '{}')
  );
  const [hwLastPhotos] = useState(() =>
    JSON.parse(localStorage.getItem('chodinglife_hw_photos_last') || '{}')
  );
  const [hwExtra, setHwExtra] = useState(() =>
    JSON.parse(localStorage.getItem('chodinglife_hw_extra') || '[]')
  );
  const [hwLog, setHwLog] = useState(() =>
    JSON.parse(localStorage.getItem('chodinglife_hw_log') || '{}')
  );
  const [hwPhotoUrls, setHwPhotoUrls] = useState({});

  // ── 도착
  const todayKey = new Date().toISOString().slice(0,10);
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
          localStorage.setItem('chodinglife_familycode', code);
          setFamilyCode(code);
        } catch(e) {
          let code = localStorage.getItem('chodinglife_familycode');
          if(!code) {
            code = Math.random().toString(36).substring(2,8).toUpperCase();
            localStorage.setItem('chodinglife_familycode', code);
          }
          setFamilyCode(code);
        }
      } else {
        setFamilyCode(null);
      }
    });
    return () => unsub();
  }, []);

  // familyCode 변경 시 실시간 감지 시작
  useEffect(() => {
    if(!familyCode) return;
    const unsubs = [];

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
      }
    }));

    // 숙제 감지
    const hwRef = doc(db, 'families', familyCode, 'data', 'homework');
    unsubs.push(onSnapshot(hwRef, (snap) => {
      if(snap.exists() && snap.data().hwData) {
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
      }
    }));

    // 사진 URL 감지
    const photoRef = doc(db, 'families', familyCode, 'data', 'hw_photo_urls');
    unsubs.push(onSnapshot(photoRef, (snap) => {
      if(snap.exists()) setHwPhotoUrls(snap.data().urls || {});
    }));

    // 포인트 감지 (아이는 읽기만)
    const scoresRef = doc(db, 'families', familyCode, 'data', 'scores');
    unsubs.push(onSnapshot(scoresRef, (snap) => {
      if(snap.exists()) {
        const data = snap.data();
        if(role !== 'parent') {
          setWkS(data.weekPts || 0);
          setTodayS(data.todayPts || 0);
          setTotS(data.totalPts || 0);
        }
      }
    }));

    // hwLog 감지
    const hwLogRef = doc(db, 'families', familyCode, 'data', 'hwlog');
    unsubs.push(onSnapshot(hwLogRef, (snap) => {
      if(snap.exists() && snap.data().hwLog) {
        const loaded = JSON.parse(snap.data().hwLog);
        setHwLog(loaded);
        localStorage.setItem('chodinglife_hw_log', JSON.stringify(loaded));
      }
    }));

    // 아이 프로필 사진 감지
    const profileRef = doc(db, 'families', familyCode, 'data', 'profile');
    unsubs.push(onSnapshot(profileRef, (snap) => {
      if(snap.exists() && snap.data().childPhotoUrl) {
        setChildPhotoUrl(snap.data().childPhotoUrl);
      }
    }));

    return () => unsubs.forEach(u => u());
  }, [familyCode, role]);

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
    if(fbUser && familyCode && role === 'parent') {
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
        });
      } catch(e) { console.log('hwLog 저장 실패:', e.message); }
    }
  }, [fbUser, familyCode]);

  const saveArrive = useCallback((newData) => {
    setArriveData(newData);
    localStorage.setItem('chodinglife_arrive_v1', JSON.stringify(newData));
  }, []);

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

  // 숙제 사진 업로드 (Firebase Storage)
  const uploadHwPhoto = useCallback(async (key, ds, file, onDone) => {
    if(!familyCode) { onDone && onDone(); return; }
    try {
      const storageRef = ref(storage, `families/${familyCode}/hw_photos/${key}_${ds}.jpg`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      // URL을 Firestore에 저장
      const urlsRef = doc(db, 'families', familyCode, 'data', 'hw_photo_urls');
      const snap = await getDoc(urlsRef);
      const urls = snap.exists() ? (snap.data().urls || {}) : {};
      urls[`${key}_${ds}`] = url;
      await setDoc(urlsRef, { urls, updatedAt: new Date().toISOString() });
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
    return hwLastPhotos[`${key}_${ds}`] || '';
  }, [hwLastPhotos]);

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
      await signInWithPopup(auth, googleProvider);
      localStorage.setItem('chodinglife_role', 'parent');
      setRole('parent');
      toast('✅ 구글 로그인 완료!');
    } catch(e) {
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
    localStorage.setItem('chodinglife_role', 'child');
    localStorage.setItem('chodinglife_linkedcode', code);
    localStorage.setItem('chodinglife_familycode', code);
    setRole('child');
    setFamilyCode(code);
    toast('🎉 연동 완료! 데이터 불러오는 중...');
    return true;
  }, [toast]);

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
    toast(`🌟 ${name} +${pts}점!`);
  }, [addScore, bonusLog, toast]);

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
      const info = {n:key, e:'📚'};
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
    SCH, FREE, wkS, todayS, totS, goal, setGoal,
    hwData, hwLastData, hwPhotos, hwLastPhotos, hwExtra, setHwExtra,
    hwLog, hwPhotoUrls, arriveData, todayKey,
    childPhotoUrl, bonusLog, toastMsg, rwI, setRwI,
    // 저장
    saveSCH, saveScores, saveHwData, saveHwLog, saveArrive, saveHwPhotos,
    // Auth
    doEmailLogin, doEmailSignup, doGoogleLogin, doLogout,
    selectRole, resetRole, copyFamilyCode, confirmChildCode,
    // 액션
    toast, addScore, subtractScore, bonus, parentApproveHw,
    arriveNow, secretReset,
    // 사진
    uploadChildPhoto, removeChildPhoto, uploadHwPhoto,
    getHwPhoto, getHwLastPhoto,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}

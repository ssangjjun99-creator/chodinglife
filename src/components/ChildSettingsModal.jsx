import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';

const HOLD_MS = 3000;

export default function ChildSettingsModal({ onClose }) {
  const { familyCode, resetRole, toast } = useApp();
  const [step, setStep] = useState('main'); // 'main' | 'confirm'
  const [holdPct, setHoldPct] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(0);

  const stopHold = useCallback(() => {
    if(rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setHoldPct(0);
  }, []);

  const tick = useCallback(() => {
    const elapsed = Date.now() - startRef.current;
    const pct = Math.min(100, (elapsed / HOLD_MS) * 100);
    setHoldPct(pct);
    if(pct >= 100) {
      rafRef.current = null;
      resetRole();
      toast('🔌 연결이 해제됐어요');
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [resetRole, toast]);

  const startHold = useCallback((e) => {
    e.preventDefault();
    startRef.current = Date.now();
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => () => { if(rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  return (
    <div className="popup-overlay" onClick={e=>{if(e.target===e.currentTarget) onClose();}}>
      <div className="popup-sheet" style={{marginBottom:'calc(80px + env(safe-area-inset-bottom))'}}>
        {step === 'main' ? (
          <>
            <div style={{fontSize:16,fontWeight:700,marginBottom:14}}>⚙️ 설정</div>
            <div className="card" style={{margin:'0 0 14px'}}>
              <div style={{fontSize:13,color:'#5b6b7a',marginBottom:4}}>연결된 가족코드</div>
              <div style={{fontSize:20,fontWeight:700,letterSpacing:1}}>{familyCode || '-'}</div>
            </div>
            <button
              onClick={() => setStep('confirm')}
              style={{width:'100%',padding:'13px',borderRadius:14,border:'none',background:'#ffecec',color:'#d33',fontWeight:700,fontSize:15,cursor:'pointer'}}
            >연결 해제</button>
            <button
              onClick={onClose}
              style={{width:'100%',padding:'13px',borderRadius:14,border:'none',background:'#f0f2f5',color:'#556',fontWeight:600,fontSize:15,marginTop:8,cursor:'pointer'}}
            >닫기</button>
          </>
        ) : (
          <>
            <div style={{fontSize:15,fontWeight:700,marginBottom:10,color:'#d33'}}>정말 해제할까요?</div>
            <div style={{fontSize:13,color:'#5b6b7a',marginBottom:18,lineHeight:1.5}}>
              해제하면 엄마아빠에게 도착 알림을 보낼 수 없어요
            </div>
            <button
              onMouseDown={startHold}
              onMouseUp={stopHold}
              onMouseLeave={stopHold}
              onTouchStart={startHold}
              onTouchEnd={stopHold}
              style={{
                position:'relative',
                width:'100%',
                padding:'15px',
                borderRadius:14,
                border:'none',
                background:'#ffe3e3',
                color:'#d33',
                fontWeight:700,
                fontSize:15,
                cursor:'pointer',
                overflow:'hidden',
                userSelect:'none',
                WebkitUserSelect:'none',
                touchAction:'none',
              }}
            >
              <div style={{
                position:'absolute', left:0, top:0, bottom:0,
                width:`${holdPct}%`,
                background:'#ff9d9d',
                transition: holdPct===0 ? 'width 0.15s ease' : 'none',
              }} />
              <span style={{position:'relative'}}>
                {holdPct > 0 ? '꾹 눌러서 해제 중...' : '3초간 꾹 눌러서 해제'}
              </span>
            </button>
            <button
              onClick={() => setStep('main')}
              style={{width:'100%',padding:'13px',borderRadius:14,border:'none',background:'#f0f2f5',color:'#556',fontWeight:600,fontSize:15,marginTop:8,cursor:'pointer'}}
            >취소</button>
          </>
        )}
      </div>
    </div>
  );
}

import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { RW } from '../utils/scheduleUtils';
import WeeklyGrid from '../components/WeeklyGrid';

export default function ParentPage() {
  const {
    fbUser, familyCode, wkS, todayS, goal, setGoal,
    doEmailLogin, doEmailSignup, doGoogleLogin, doLogout,
    copyFamilyCode, bonus, rwI, setRwI,
    childPhotoUrl, uploadChildPhoto, removeChildPhoto,
    toast, saveSCH, SCH, FREE
  } = useApp();

  const [pTab, setPTab] = useState('ov');
  const [emailV, setEmailV] = useState('');
  const [pwV, setPwV] = useState('');
  const [showChildInput, setShowChildInput] = useState(false);
  const [childCodeInput, setChildCodeInput] = useState('');
  const pct = Math.min(100, Math.round((wkS/goal)*100));

  const handleLogin = async () => {
    const ok = await doEmailLogin(emailV, pwV);
    if(ok) { setEmailV(''); setPwV(''); }
  };

  const handleSignup = async () => {
    await doEmailSignup(emailV, pwV);
  };

  const handleChildPhotoSelect = () => {
    const inp = document.createElement('input');
    inp.type='file'; inp.accept='image/*';
    inp.style.cssText='position:fixed;top:-999px;left:-999px;opacity:0;';
    inp.onchange = () => {
      const file = inp.files[0]; if(!file){inp.remove();return;}
      uploadChildPhoto(file);
      inp.remove();
    };
    document.body.appendChild(inp);
    inp.click();
  };

  const connectChildCode = () => {
    if(childCodeInput.length!==6){toast('6자리 코드를 입력해주세요!');return;}
    localStorage.setItem('chodinglife_linkedcode',childCodeInput);
    toast('🎉 연동 완료! 곧 실시간 연동이 활성화돼요!');
    setShowChildInput(false);
    setChildCodeInput('');
  };

  const cycReward = (i) => {
    const newRwI = [...rwI];
    newRwI[i] = (newRwI[i]+1) % RW.length;
    setRwI(newRwI);
    localStorage.setItem('chodinglife_rw', JSON.stringify(newRwI));
  };

  const adjGoal = (delta) => {
    const newGoal = Math.max(10, goal+delta);
    setGoal(newGoal);
    localStorage.setItem('chodinglife_goal', String(newGoal));
  };

  const resetRoleBtn = () => {
    if(window.confirm('역할을 초기화할까요?\n부모/아이 선택 화면으로 돌아가요.')) {
      localStorage.removeItem('chodinglife_role');
      localStorage.removeItem('chodinglife_linkedcode');
      window.location.reload();
    }
  };

  return (
    <div className="page" id="page-parent">
      <div className="sub-hd">
        <div className="sub-ttl">👨‍👩‍👧 부모님</div>
        <div className="sub-av">👩</div>
      </div>
      <div className="sp">
        {/* 탭 */}
        <div className="tbr">
          <button className={`tb${pTab==='ov'?' on':''}`} onClick={()=>setPTab('ov')}>📊 현황</button>
          <button className={`tb${pTab==='sc'?' on':''}`} onClick={()=>setPTab('sc')}>📅 스케쥴</button>
          <button className={`tb${pTab==='st'?' on':''}`} onClick={()=>setPTab('st')}>⚙️ 설정</button>
        </div>

        {/* 현황 탭 */}
        {pTab==='ov' && (
          <div id="pt-ov">
            <div style={{margin:'10px 14px 0',background:'linear-gradient(135deg,#3a9bd5,#2ec4a9)',borderRadius:18,padding:'14px 16px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <div style={{color:'#fff'}}>
                  <div style={{fontSize:14,fontWeight:800}}>이번주 포인트 현황</div>
                  <div style={{fontSize:11,opacity:0.85,marginTop:2}}>{wkS>=goal?'🎉 목표 달성!':'열심히 하면 달성!'}</div>
                </div>
                <div style={{textAlign:'right',color:'#fff'}}>
                  <div style={{fontSize:32,fontWeight:900,lineHeight:1}}>{wkS}</div>
                  <div style={{fontSize:11,opacity:0.8}}>/ {goal}점</div>
                </div>
              </div>
              <div style={{background:'rgba(255,255,255,0.25)',borderRadius:5,height:6,overflow:'hidden'}}>
                <div style={{height:'100%',borderRadius:5,background:'#fff',transition:'width 0.8s',width:`${pct}%`}} />
              </div>
            </div>

            {/* 보너스 포인트 */}
            <div className="card" style={{marginTop:10}}>
              <div className="ch"><span className="ci">🌟</span><span className="ct">보너스 포인트</span></div>
              <div style={{fontSize:11,color:'#8aaac8',marginBottom:8}}>누르면 즉시 포인트에 반영돼요!</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                <button style={{padding:'8px 11px',borderRadius:10,border:'none',cursor:'pointer',background:'#e8faf0',color:'#2bc87a',fontSize:12,fontWeight:700,fontFamily:'inherit'}} onClick={()=>bonus('착한 일',15)}>😊 착한일 +15점</button>
                <button style={{padding:'8px 11px',borderRadius:10,border:'none',cursor:'pointer',background:'#e8faf0',color:'#2bc87a',fontSize:12,fontWeight:700,fontFamily:'inherit'}} onClick={()=>bonus('말씀 듣기',15)}>👂 말씀듣기 +15점</button>
                <button style={{padding:'8px 11px',borderRadius:10,border:'none',cursor:'pointer',background:'#e8faf0',color:'#2bc87a',fontSize:12,fontWeight:700,fontFamily:'inherit'}} onClick={()=>bonus('방 청소',10)}>🧹 방청소 +10점</button>
              </div>
            </div>

            {/* 독려 메시지 */}
            <div className="card" style={{marginTop:10}}>
              <div className="ch"><span className="ci">💬</span><span className="ct">독려 메시지</span></div>
              <div className="ni"><span style={{fontSize:16}}>📅</span><div className="nt">이틀 전 · "모레까지야! 미리 해두면 어때? 😊"</div><button className="ns" onClick={()=>toast('전송됐어요! 📱')}>전송</button></div>
              <div className="ni"><span style={{fontSize:16}}>⏰</span><div className="nt">하루 전 · "내일까지야! 오늘 안에 끝내보자! 💪"</div><button className="ns" onClick={()=>toast('전송됐어요! 📱')}>전송</button></div>
              <div className="ni"><span style={{fontSize:16}}>💖</span><div className="nt">응원 · "오늘도 최고야! 엄마가 응원해! 🥰"</div><button className="ns" onClick={()=>toast('전송됐어요! 📱')}>전송</button></div>
            </div>
          </div>
        )}

        {/* 스케쥴 탭 */}
        {pTab==='sc' && <WeeklyGrid />}

        {/* 설정 탭 */}
        {pTab==='st' && (
          <div id="pt-st">
            {/* 주간 목표 */}
            <div className="card" style={{marginTop:10}}>
              <div className="ch"><span className="ci">🎯</span><span className="ct">주간 목표</span></div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:18,padding:'6px 0'}}>
                <button className="adj-b" onClick={()=>adjGoal(-10)}>−</button>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:38,fontWeight:900,color:'#3a9bd5'}}>{goal}</div>
                  <div style={{fontSize:11,color:'#8aaac8'}}>점</div>
                </div>
                <button className="adj-b" onClick={()=>adjGoal(10)}>+</button>
              </div>
            </div>

            {/* 보상 설정 */}
            <div className="card" style={{marginTop:10}}>
              <div className="ch"><span className="ci">🎁</span><span className="ct">보상 설정</span></div>
              <div className="rwr">
                {[0,1,2].map(i=>(
                  <div key={i} className="rwc" onClick={()=>cycReward(i)}>
                    <div style={{fontSize:22}}>{RW[rwI[i]].e}</div>
                    <div style={{fontSize:10,fontWeight:700,color:'#1a3a5c',marginTop:2}}>{RW[rwI[i]].n}</div>
                    <div style={{fontSize:9,color:'#8aaac8',marginTop:1}}>탭해서 변���</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 아이 사진 설정 */}
            <div className="card" style={{marginTop:10}}>
              <div className="ch"><span className="ci">📸</span><span className="ct">아이 사진 설정</span></div>
              <div style={{fontSize:12,color:'#5aaac8',marginBottom:12}}>파이차트 중앙에 표시될 아이 사진이에요!</div>
              <div style={{display:'flex',alignItems:'center',gap:14}}>
                <div style={{width:72,height:72,borderRadius:'50%',background:'linear-gradient(135deg,#f0c8a0,#e8a070)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:36,overflow:'hidden',flexShrink:0}}>
                  {childPhotoUrl
                    ? <img src={childPhotoUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                    : '🐶'
                  }
                </div>
                <div style={{flex:1}}>
                  <button onClick={handleChildPhotoSelect} style={{width:'100%',padding:10,borderRadius:10,border:'1.5px dashed #3a9bd5',background:'#f0f8ff',color:'#3a9bd5',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:'inherit',marginBottom:6}}>📷 사진 선택하기</button>
                  <button onClick={removeChildPhoto} style={{width:'100%',padding:8,borderRadius:10,border:'1.5px solid #f0d4d4',background:'#fff',color:'#e05555',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>🗑️ 사진 삭제</button>
                </div>
              </div>
            </div>

            {/* 아이랑 연동하기 */}
            <div className="card" style={{marginTop:10}}>
              <div className="ch"><span className="ci">🔗</span><span className="ct">아이랑 연동하기</span></div>
              {!fbUser
                ? <div>
                    <div style={{fontSize:12,color:'#5aaac8',marginBottom:12,lineHeight:1.5}}>로그인 후 가족코드를 만들어<br/>지율이 폰과 실시간으로 연동하세요! 📱</div>
                    <input value={emailV} onChange={e=>setEmailV(e.target.value)} type="email" placeholder="이메일 주소" style={{width:'100%',padding:10,borderRadius:10,border:'1.5px solid #d4eaf5',fontSize:13,fontFamily:'inherit',outline:'none',marginBottom:8,boxSizing:'border-box'}} />
                    <input value={pwV} onChange={e=>setPwV(e.target.value)} type="password" placeholder="비밀번호 (6자리 이상)" style={{width:'100%',padding:10,borderRadius:10,border:'1.5px solid #d4eaf5',fontSize:13,fontFamily:'inherit',outline:'none',marginBottom:8,boxSizing:'border-box'}} />
                    <div style={{display:'flex',gap:8,marginBottom:10}}>
                      <button onClick={handleLogin} style={{flex:1,padding:11,borderRadius:10,border:'none',background:'linear-gradient(135deg,#3a9bd5,#2ec4a9)',color:'white',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>로그인</button>
                      <button onClick={handleSignup} style={{flex:1,padding:11,borderRadius:10,border:'1.5px solid #3a9bd5',background:'white',color:'#3a9bd5',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>회원가입</button>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                      <div style={{flex:1,height:1,background:'#d4eaf5'}} /><div style={{fontSize:11,color:'#8aaac8'}}>또는</div><div style={{flex:1,height:1,background:'#d4eaf5'}} />
                    </div>
                    <button onClick={doGoogleLogin} style={{width:'100%',padding:11,borderRadius:10,border:'1.5px solid #d4eaf5',background:'white',color:'#444',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                      <span style={{fontSize:16}}>G</span> 구글로 로그인하기
                    </button>
                  </div>
                : <div>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                      <div style={{width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,#3a9bd5,#2ec4a9)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>👩</div>
                      <div>
                        <div style={{fontSize:13,fontWeight:800,color:'#0d5a7a'}}>{fbUser.displayName||'사용자'}</div>
                        <div style={{fontSize:11,color:'#5aaac8'}}>{fbUser.email}</div>
                      </div>
                      <button onClick={doLogout} style={{marginLeft:'auto',padding:'5px 10px',borderRadius:8,border:'1.5px solid #d4eaf5',background:'#fff',color:'#8aaac8',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>로그아웃</button>
                    </div>
                    <div style={{background:'#f0f8ff',borderRadius:12,padding:12,marginBottom:10}}>
                      <div style={{fontSize:11,color:'#5aaac8',marginBottom:4,fontWeight:700}}>내 가족코드</div>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div style={{fontSize:22,fontWeight:800,color:'#3a9bd5',letterSpacing:4}}>{familyCode||'------'}</div>
                        <button onClick={copyFamilyCode} style={{padding:'5px 10px',borderRadius:8,border:'none',background:'#3a9bd5',color:'white',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>복사</button>
                      </div>
                      <div style={{fontSize:11,color:'#8aaac8',marginTop:4}}>이 코드를 지율이 폰에 입력하면 연동돼요!</div>
                    </div>
                    <button onClick={()=>setShowChildInput(!showChildInput)} style={{width:'100%',padding:10,borderRadius:12,border:'1.5px solid #3a9bd5',background:'#fff',color:'#3a9bd5',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>👧 아이 코드 입력하기</button>
                    {showChildInput && (
                      <div style={{marginTop:10}}>
                        <input value={childCodeInput} onChange={e=>setChildCodeInput(e.target.value.toUpperCase())} type="text" maxLength={6} placeholder="6자리 코드 입력" style={{width:'100%',padding:10,borderRadius:10,border:'1.5px solid #d4eaf5',fontSize:16,textAlign:'center',letterSpacing:4,fontWeight:800,color:'#0d5a7a',fontFamily:'inherit',outline:'none'}} />
                        <button onClick={connectChildCode} style={{width:'100%',marginTop:8,padding:10,borderRadius:12,border:'none',background:'linear-gradient(135deg,#2bc87a,#1aaa60)',color:'white',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>연동하기</button>
                      </div>
                    )}
                  </div>
              }
            </div>

            {/* 기타 */}
            <div className="card" style={{marginTop:10,marginBottom:14}}>
              <div className="ch"><span className="ci">⚙️</span><span className="ct">기타</span></div>
              <div className="sti" onClick={()=>toast('GPS 설정 준비중!')}><div className="stib" style={{background:'#e8faf0'}}>📍</div><div style={{flex:1}}><div className="stin">GPS 장소 설정</div><div className="stis">학교·학원·집 위치 등록</div></div><div style={{fontSize:14,color:'#c0d4e0'}}>›</div></div>
              <div className="sti" onClick={()=>toast('알림 설정 준비중!')}><div className="stib" style={{background:'#fff8e8'}}>🔔</div><div style={{flex:1}}><div className="stin">알림 설정</div></div><div style={{fontSize:14,color:'#c0d4e0'}}>›</div></div>
              <div className="sti" onClick={resetRoleBtn}><div className="stib" style={{background:'#fff0f0'}}>🔄</div><div style={{flex:1}}><div className="stin" style={{color:'#e05555'}}>역할 초기화</div><div className="stis">부모/아이 선택 화면으로 돌아가기</div></div><div style={{fontSize:14,color:'#c0d4e0'}}>›</div></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

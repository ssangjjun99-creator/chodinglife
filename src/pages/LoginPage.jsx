import { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function LoginPage() {
  const { doEmailLogin, doEmailSignup, doGoogleLogin, resetRole } = useApp();
  const [emailV, setEmailV] = useState('');
  const [pwV, setPwV] = useState('');
  const [mode, setMode] = useState('login'); // 'login' | 'signup'

  const handleSubmit = async () => {
    if(mode === 'login') {
      await doEmailLogin(emailV, pwV);
    } else {
      const ok = await doEmailSignup(emailV, pwV);
      if(ok) await doEmailLogin(emailV, pwV);
    }
  };

  const handleKeyDown = (e) => {
    if(e.key === 'Enter') handleSubmit();
  };

  return (
    <div className="page" style={{alignItems:'center',justifyContent:'center',background:'linear-gradient(160deg,#e8f4fb 0%,#f5fbff 100%)'}}>
      <div style={{width:'100%',maxWidth:360,padding:'0 24px'}}>
        {/* 헤더 */}
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontSize:52,marginBottom:10}}>👨‍👩‍👧</div>
          <div style={{fontSize:22,fontWeight:900,color:'#0d5a7a',marginBottom:4}}>부모님 로그인</div>
          <div style={{fontSize:13,color:'#5aaac8',lineHeight:1.5}}>로그인하면 지율이 폰과<br/>실시간으로 연동돼요! 📱</div>
        </div>

        {/* 탭 */}
        <div style={{display:'flex',background:'#e8f4fb',borderRadius:12,padding:3,marginBottom:20}}>
          <button
            onClick={()=>setMode('login')}
            style={{flex:1,padding:'9px 0',borderRadius:10,border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:800,transition:'all 0.2s',
              background:mode==='login'?'white':'transparent',
              color:mode==='login'?'#0d5a7a':'#8aaac8',
              boxShadow:mode==='login'?'0 2px 6px rgba(58,155,213,0.15)':'none'
            }}>로그인</button>
          <button
            onClick={()=>setMode('signup')}
            style={{flex:1,padding:'9px 0',borderRadius:10,border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:800,transition:'all 0.2s',
              background:mode==='signup'?'white':'transparent',
              color:mode==='signup'?'#0d5a7a':'#8aaac8',
              boxShadow:mode==='signup'?'0 2px 6px rgba(58,155,213,0.15)':'none'
            }}>회원가입</button>
        </div>

        {/* 입력폼 */}
        <div style={{background:'white',borderRadius:20,padding:20,boxShadow:'0 4px 20px rgba(58,155,213,0.1)',marginBottom:12}}>
          <input
            value={emailV}
            onChange={e=>setEmailV(e.target.value)}
            onKeyDown={handleKeyDown}
            type="email"
            placeholder="이메일 주소"
            style={{width:'100%',padding:12,borderRadius:12,border:'1.5px solid #d4eaf5',fontSize:14,fontFamily:'inherit',outline:'none',marginBottom:10,boxSizing:'border-box',color:'#0d5a7a'}}
          />
          <input
            value={pwV}
            onChange={e=>setPwV(e.target.value)}
            onKeyDown={handleKeyDown}
            type="password"
            placeholder="비밀번호 (6자리 이상)"
            style={{width:'100%',padding:12,borderRadius:12,border:'1.5px solid #d4eaf5',fontSize:14,fontFamily:'inherit',outline:'none',marginBottom:14,boxSizing:'border-box',color:'#0d5a7a'}}
          />
          <button
            onClick={handleSubmit}
            style={{width:'100%',padding:13,borderRadius:13,border:'none',background:'linear-gradient(135deg,#3a9bd5,#2ec4a9)',color:'white',fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}
          >{mode==='login'?'로그인':'회원가입'}</button>
        </div>

        {/* 구분선 */}
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
          <div style={{flex:1,height:1,background:'#d4eaf5'}} />
          <div style={{fontSize:12,color:'#8aaac8'}}>또는</div>
          <div style={{flex:1,height:1,background:'#d4eaf5'}} />
        </div>

        {/* 구글 로그인 */}
        <button
          onClick={doGoogleLogin}
          style={{width:'100%',padding:13,borderRadius:13,border:'1.5px solid #d4eaf5',background:'white',color:'#444',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:10,boxShadow:'0 2px 8px rgba(0,0,0,0.06)',marginBottom:16}}
        >
          <span style={{fontSize:18,fontWeight:900,color:'#4285F4'}}>G</span>
          구글로 로그인하기
        </button>

        {/* 뒤로가기 */}
        <div style={{textAlign:'center'}}>
          <button
            onClick={resetRole}
            style={{background:'none',border:'none',color:'#8aaac8',fontSize:12,cursor:'pointer',fontFamily:'inherit',textDecoration:'underline'}}
          >← 역할 선택으로 돌아가기</button>
        </div>
      </div>
    </div>
  );
}

import { Capacitor } from '@capacitor/core';
import { useApp } from '../context/AppContext';

const ICON_BASE = (process.env.PUBLIC_URL || '') + '/icons/';

export default function LoginPage() {
  const { doGoogleLogin, doKakaoLogin, resetRole } = useApp();

  // 외부 링크(개인정보처리방침)를 앱 웹뷰 밖(시스템 브라우저)으로 열기 (ParentPage.jsx와 동일 방식)
  const openPrivacyPolicy = () => {
    const url = 'https://ssangjjun99-creator.github.io/chodinglife/privacy.html';
    if (Capacitor.isNativePlatform()) {
      window.location.href = url;
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="page" style={{alignItems:'center',justifyContent:'center',background:'linear-gradient(160deg,#e8f4fb 0%,#f5fbff 100%)'}}>
      <div style={{width:'100%',maxWidth:360,padding:'0 24px'}}>
        {/* 헤더 */}
        <div style={{textAlign:'center',marginBottom:40}}>
          <img src={ICON_BASE + encodeURIComponent('18_부모님.png')} alt="부모" style={{width:72,height:72,marginBottom:10,objectFit:'contain'}} />
          <div style={{fontSize:22,fontWeight:900,color:'#0d5a7a',marginBottom:4}}>부모님 로그인</div>
          <div style={{fontSize:13,color:'#5aaac8',lineHeight:1.5}}>로그인하면 아이 폰과<br/>실시간으로 연동돼요! 📱</div>
        </div>

        {/* 카카오 로그인 */}
        <button
          onClick={doKakaoLogin}
          style={{width:'100%',padding:13,borderRadius:13,border:'none',background:'#FEE500',color:'#3A2929',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',marginBottom:10}}
        >
          카카오로 시작하기
        </button>

        {/* 구글 로그인 */}
        <button
          onClick={doGoogleLogin}
          style={{width:'100%',padding:13,borderRadius:13,border:'1.5px solid #d4eaf5',background:'white',color:'#444',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:10,boxShadow:'0 2px 8px rgba(0,0,0,0.06)',marginBottom:36}}
        >
          <span style={{fontSize:18,fontWeight:900,color:'#4285F4'}}>G</span>
          구글로 시작하기
        </button>

        {/* 뒤로가기 */}
        <div style={{textAlign:'center'}}>
          <button
            onClick={resetRole}
            style={{background:'none',border:'none',color:'#8aaac8',fontSize:12,cursor:'pointer',fontFamily:'inherit',textDecoration:'underline'}}
          >← 역할 선택으로 돌아가기</button>
        </div>

        {/* 개인정보처리방침 */}
        <div style={{textAlign:'center',marginTop:14}}>
          <button
            onClick={openPrivacyPolicy}
            style={{background:'none',border:'none',color:'#b0c8d8',fontSize:11,cursor:'pointer',fontFamily:'inherit',textDecoration:'underline'}}
          >개인정보처리방침</button>
        </div>
      </div>
    </div>
  );
}

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
          style={{width:'100%',background:'transparent',border:'none',padding:0,cursor:'pointer',marginBottom:10,display:'block'}}
        >
          <img src={ICON_BASE + 'kakao_login.png'} alt="카카오 로그인" style={{width:'100%',height:'auto',display:'block'}} />
        </button>

        {/* 구글 로그인 */}
        <button
          onClick={doGoogleLogin}
          style={{width:'100%',aspectRatio:'600 / 90',background:'#FFFFFF',border:'1px solid #747775',borderRadius:13,padding:0,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginBottom:36}}
        >
          <img src={ICON_BASE + 'google_g.svg'} alt="Google 계정으로 로그인" style={{height:'38%',width:'auto',display:'block'}} />
          <span style={{fontSize:15,fontWeight:500,color:'#1F1F1F'}}>Google 계정으로 로그인</span>
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

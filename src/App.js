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

function AppInner() {
  const { role, fbUser, authReady, currentPage } = useApp();

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
      <Navbar />
    </>
  );
}

export default function App() {
  return <AppInner />;
}

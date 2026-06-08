import { useApp } from '../context/AppContext';

export default function RoleSelectPage() {
  const { selectRole, setCurrentPage } = useApp();

  const choose = (r) => {
    if(r === 'parent') {
      selectRole('parent');
      setCurrentPage('main');
    } else {
      setCurrentPage('child-setup');
    }
  };

  return (
    <div className="page" style={{alignItems:'center',justifyContent:'center'}}>
      <div style={{textAlign:'center',padding:'30px 24px',width:'100%',maxWidth:360}}>
        <div style={{fontSize:56,marginBottom:12}}>🌟</div>
        <div style={{fontSize:24,fontWeight:900,color:'#0d5a7a',marginBottom:6}}>초딩생활</div>
        <div style={{fontSize:14,color:'#5aaac8',marginBottom:40}}>우리 아이 성장 도우미</div>
        <div style={{fontSize:15,fontWeight:800,color:'#0d5a7a',marginBottom:16}}>누가 사용하시나요?</div>

        <div onClick={()=>choose('parent')} style={{background:'white',borderRadius:20,padding:20,marginBottom:12,cursor:'pointer',border:'2px solid #d4eaf5',boxShadow:'0 4px 12px rgba(58,155,213,0.1)'}}>
          <div style={{fontSize:36,marginBottom:8}}>👨‍👩‍👧</div>
          <div style={{fontSize:16,fontWeight:800,color:'#0d5a7a'}}>부모예요</div>
          <div style={{fontSize:12,color:'#8aaac8',marginTop:4}}>스케쥴 설정 · 숙제 확인 · 포인트 관리</div>
        </div>

        <div onClick={()=>choose('child')} style={{background:'white',borderRadius:20,padding:20,cursor:'pointer',border:'2px solid #d4eaf5',boxShadow:'0 4px 12px rgba(58,155,213,0.1)'}}>
          <div style={{fontSize:36,marginBottom:8}}>👧</div>
          <div style={{fontSize:16,fontWeight:800,color:'#0d5a7a'}}>아이예요</div>
          <div style={{fontSize:12,color:'#8aaac8',marginTop:4}}>도착체크 · 숙제 완료 · 포인트 확인</div>
        </div>
      </div>
    </div>
  );
}

import { useApp } from '../context/AppContext';

const ICON_BASE = (process.env.PUBLIC_URL || '') + '/icons/';

export default function RoleSelectPage() {
  const { selectRole, setCurrentPage } = useApp();

  const choose = (r) => {
    console.log('[RoleSelect] choose called, r =', r);
    if(r === 'parent') {
      selectRole('parent');
      setCurrentPage('main');
    } else {
      console.log('[RoleSelect] 아이예요 클릭 → selectRole(child)');
      selectRole('child');
      console.log('[RoleSelect] selectRole 호출 완료');
    }
  };

  return (
    <div className="page" style={{alignItems:'center',justifyContent:'center'}}>
      <div style={{textAlign:'center',padding:'30px 24px',width:'100%',maxWidth:360}}>
        <img src={ICON_BASE + encodeURIComponent('15_포인트.png')} alt="logo" style={{width:72,height:72,marginBottom:12,objectFit:'contain'}} />
        <div style={{fontSize:24,fontWeight:900,color:'#0d5a7a',marginBottom:6}}>초딩생활</div>
        <div style={{fontSize:14,color:'#5aaac8',marginBottom:40}}>매일매일 즐거운 습관 만들기</div>
        <div style={{fontSize:15,fontWeight:800,color:'#0d5a7a',marginBottom:16}}>누가 사용하시나요?</div>

        <div onClick={()=>choose('parent')} style={{background:'white',borderRadius:20,padding:20,marginBottom:12,cursor:'pointer',border:'2px solid #d4eaf5',boxShadow:'0 4px 12px rgba(58,155,213,0.1)'}}>
          <div style={{height:90,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:8}}>
            <img src={ICON_BASE + encodeURIComponent('18_부모님.png')} alt="부모" style={{width:62,height:62,objectFit:'contain'}} />
          </div>
          <div style={{fontSize:16,fontWeight:800,color:'#0d5a7a'}}>부모예요</div>
          <div style={{fontSize:12,color:'#8aaac8',marginTop:4}}>스케쥴 설정 · 숙제 확인 · 포인트 관리</div>
        </div>

        <div onClick={()=>choose('child')} style={{background:'white',borderRadius:20,padding:20,cursor:'pointer',border:'2px solid #d4eaf5',boxShadow:'0 4px 12px rgba(58,155,213,0.1)'}}>
          <div style={{height:90,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:8}}>
            <img src={ICON_BASE + encodeURIComponent('19_아이.png')} alt="아이" style={{width:90,height:90,objectFit:'contain'}} />
          </div>
          <div style={{fontSize:16,fontWeight:800,color:'#0d5a7a'}}>아이예요</div>
          <div style={{fontSize:12,color:'#8aaac8',marginTop:4}}>도착체크 · 숙제 완료 · 포인트 확인</div>
        </div>
      </div>
    </div>
  );
}

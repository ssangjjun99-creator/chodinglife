import { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function ChildSetupPage() {
  const { confirmChildCode, setCurrentPage } = useApp();
  const [code, setCode] = useState('');

  const handleConfirm = () => {
    const ok = confirmChildCode(code.trim().toUpperCase());
    if(ok) setCurrentPage('main');
  };

  return (
    <div className="page" style={{alignItems:'center',justifyContent:'center'}}>
      <div style={{textAlign:'center',padding:'30px 24px',width:'100%',maxWidth:360}}>
        <div style={{fontSize:56,marginBottom:12}}>👧</div>
        <div style={{fontSize:20,fontWeight:900,color:'#0d5a7a',marginBottom:6}}>가족코드 입력</div>
        <div style={{fontSize:13,color:'#5aaac8',marginBottom:32}}>부모님 폰의 가족코드를 입력해주세요!</div>

        <input
          value={code}
          onChange={e=>setCode(e.target.value.toUpperCase())}
          maxLength={6}
          placeholder="예: QH3V58"
          style={{width:'100%',padding:16,borderRadius:14,border:'2px solid #d4eaf5',fontSize:24,textAlign:'center',letterSpacing:6,fontWeight:800,color:'#0d5a7a',fontFamily:'inherit',outline:'none',marginBottom:16}}
        />
        <button
          onClick={handleConfirm}
          style={{width:'100%',padding:14,borderRadius:14,border:'none',background:'linear-gradient(135deg,#3a9bd5,#2ec4a9)',color:'white',fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:'inherit',marginBottom:12}}
        >
          🔗 연동하기
        </button>
        <div onClick={()=>setCurrentPage('role-select')} style={{fontSize:12,color:'#8aaac8',cursor:'pointer'}}>← 부모님이세요?</div>
      </div>
    </div>
  );
}

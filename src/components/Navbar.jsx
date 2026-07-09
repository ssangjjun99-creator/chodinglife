import { useApp } from '../context/AppContext';

const _ICON_BASE = (process.env.PUBLIC_URL || '') + '/icons/';

const TABS = [
  { id: 'main',     icon: '14_홈메뉴.png',  l: '홈',     sz: 46 },
  { id: 'checkin',  icon: '16_도착.png',    l: '도착',   sz: 31 },
  { id: 'homework', icon: '17_숙제.png',    l: '숙제',   sz: 31 },
  { id: 'points',   icon: '15_포인트.png',  l: '포인트', sz: 31 },
  { id: 'parent',   icon: '18_부모님.png',  l: '부모님', sz: 31 },
];

const ICON_H = 31;

export default function Navbar() {
  const { currentPage, setCurrentPage, role, setParentTab } = useApp();
  const visibleTabs = role === 'child' ? TABS.filter(t => t.id !== 'parent') : TABS;
  return (
    <nav className="bnav">
      {visibleTabs.map(t => (
        <div
          key={t.id}
          className={`nb${currentPage === t.id ? ' on' : ''}`}
          onClick={() => { if(t.id === 'parent') setParentTab('ov'); setCurrentPage(t.id); }}
        >
          <div className="nb-e" style={{height:ICON_H,display:'flex',alignItems:'center',justifyContent:'center',overflow:'visible'}}>
            <img
              src={`${_ICON_BASE}${encodeURIComponent(t.icon)}`}
              alt={t.l}
              style={{
                width:t.sz, height:t.sz, objectFit:'contain', display:'block',
                WebkitTapHighlightColor:'transparent', outline:'none', userSelect:'none',
              }}
            />
          </div>
          <div className="nb-l">{t.l}</div>
        </div>
      ))}
    </nav>
  );
}

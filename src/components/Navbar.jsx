import { useApp } from '../context/AppContext';

const TABS = [
  { id: 'main',    e: '🌟', l: '홈' },
  { id: 'points',  e: '⭐', l: '포인트' },
  { id: 'checkin', e: '📍', l: '도착' },
  { id: 'homework',e: '📚', l: '숙제' },
  { id: 'parent',  e: '👨‍👩‍👧', l: '부모님' },
];

export default function Navbar() {
  const { currentPage, setCurrentPage } = useApp();
  return (
    <nav className="bnav">
      {TABS.map(t => (
        <div
          key={t.id}
          className={`nb${currentPage === t.id ? ' on' : ''}`}
          onClick={() => setCurrentPage(t.id)}
        >
          <div className="nb-e">{t.e}</div>
          <div className="nb-l">{t.l}</div>
        </div>
      ))}
    </nav>
  );
}

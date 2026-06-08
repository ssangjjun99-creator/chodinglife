export const CATS = [
  {id:'wake',n:'기상',e:'🌅',c:'#5bc8f5',d:1},
  {id:'sch',n:'학교',e:'🏫',c:'#7b9ef7',d:4},
  {id:'lunch',n:'점심',e:'🍱',c:'#f97fb8',d:1},
  {id:'eng',n:'영어학원',e:'📖',c:'#ffaa55',d:2},
  {id:'math',n:'수학학원',e:'🔢',c:'#b07ef7',d:2},
  {id:'swim',n:'수영',e:'🏊',c:'#22d3ee',d:2},
  {id:'piano',n:'피아노',e:'🎹',c:'#ff7eb3',d:2},
  {id:'dance',n:'댄스',e:'💃',c:'#f97fb8',d:2},
  {id:'church',n:'성당',e:'⛪',c:'#fbbf24',d:1},
  {id:'hw',n:'숙제',e:'✏️',c:'#ffe03a',d:1},
  {id:'read',n:'독서',e:'📕',c:'#26d4b8',d:0.5},
  {id:'din',n:'저녁',e:'🍚',c:'#3dd68c',d:1},
  {id:'free',n:'자유시간',e:'🎮',c:'#f97fb8',d:2},
  {id:'sleep',n:'꿈나라',e:'🌙',c:'#7ab8e8',d:2},
  {id:'bath',n:'씻기',e:'🛁',c:'#a8e063',d:0.5},
  {id:'custom',n:'직접입력',e:'✍️',c:'#aabcd0',d:1},
];

export const WK_CATS = [
  {id:'sch',    n:'학교',      e:'🏫', c:'#7b9ef7', d:4  },
  {id:'eng',    n:'영어학원',  e:'📖', c:'#ffaa55', d:2  },
  {id:'math',   n:'수학학원',  e:'📚', c:'#b07ef7', d:2  },
  {id:'sport',  n:'스포츠',    e:'🏃', c:'#22d3ee', d:1.5},
  {id:'piano',  n:'피아노',    e:'🎹', c:'#ff7eb3', d:1  },
  {id:'swim',   n:'수영',      e:'🏊', c:'#00bcd4', d:1.5},
  {id:'hw',     n:'숙제',      e:'✏️', c:'#ffe03a', d:1  },
  {id:'read',   n:'독서',      e:'📕', c:'#26d4b8', d:0.5},
  {id:'free',   n:'자유시간',  e:'🎮', c:'#f97fb8', d:2  },
  {id:'sleep',  n:'꿈나라',    e:'🌙', c:'#7ab8e8', d:8  },
  {id:'custom_arrive', n:'직접입력(도착알림)', e:'✍️', c:'#ff7043', d:1},
  {id:'custom', n:'직접입력',  e:'✍️', c:'#aabcd0', d:1  },
];

export const DN = ['월요일','화요일','수요일','목요일','금요일','토요일','일요일'];
export const DS = ['월','화','수','목','금','토','일'];

export const RW = [
  {e:'🍕',n:'피자 먹기'},{e:'🎮',n:'게임 1시간'},{e:'🎬',n:'영화 보기'},
  {e:'🍗',n:'치킨 먹기'},{e:'🛍️',n:'쇼핑하기'},{e:'🎡',n:'놀이공원'}
];

export const HW_INFO = {
  sch:          { n:'학교',      e:'🏫', c:'#7b9ef7', bg:'#f0f4ff' },
  eng:          { n:'영어학원',  e:'📖', c:'#ffaa55', bg:'#fff8f0' },
  math:         { n:'수학학원',  e:'📚', c:'#b07ef7', bg:'#f8f0ff' },
  custom_arrive:{ n:'직접입력', e:'✍️', c:'#ff7043', bg:'#fff4f0' },
};

export const ARRIVE_IDS = ['sch','eng','math','sport','swim','piano','custom_arrive'];
export const ARRIVE_NAMES = ['학교','영어학원','수학학원','스포츠','수영','피아노'];

// hh:mm → float
export function H(h) {
  return String(Math.floor(h)).padStart(2,'0') + ':' + String(Math.round((h%1)*60)).padStart(2,'0');
}

// "hh:mm" → float
export function T(t) {
  const [a,b] = t.split(':').map(Number);
  return a + b/60;
}

export function isArriveItem(it) {
  if(it.catId) return ARRIVE_IDS.includes(it.catId);
  const cat = WK_CATS.find(c => c.n === it.name);
  if(cat) return ARRIVE_IDS.includes(cat.id);
  return ARRIVE_NAMES.includes(it.name);
}

export function makeDefaultSchedule() {
  const mk = (n,e,c,s,d) => ({name:n,emoji:e,color:c,start:s,dur:d,time:H(s)+'~'+H(s+d)});
  return {
    0:[mk('기상','🌅','#5bc8f5',8,1),mk('학교','🏫','#7b9ef7',9,4),mk('점심','🍱','#f97fb8',13,1.5),mk('영어학원','📖','#ffaa55',14.5,2),mk('숙제','✏️','#ffe03a',16.5,1),mk('저녁','🍚','#3dd68c',17.5,1),mk('독서','📕','#26d4b8',18.5,0.5),mk('수학학원','🔢','#b07ef7',19,2),mk('자유시간','🎮','#f97fb8',21,1),mk('꿈나라','🌙','#7ab8e8',22,2)],
    1:[mk('기상','🌅','#5bc8f5',8,1),mk('학교','🏫','#7b9ef7',9,4),mk('점심','🍱','#f97fb8',13,1.5),mk('수학학원','🔢','#b07ef7',14.5,2),mk('숙제','✏️','#ffe03a',16.5,1),mk('저녁','🍚','#3dd68c',17.5,1),mk('독서','📕','#26d4b8',18.5,0.5),mk('자유시간','🎮','#f97fb8',19,3),mk('꿈나라','🌙','#7ab8e8',22,2)],
    2:[mk('기상','🌅','#5bc8f5',8,1),mk('학교','🏫','#7b9ef7',9,4),mk('점심','🍱','#f97fb8',13,1.5),mk('영어학원','📖','#ffaa55',14.5,2),mk('숙제','✏️','#ffe03a',16.5,1),mk('저녁','🍚','#3dd68c',17.5,1),mk('독서','📕','#26d4b8',18.5,0.5),mk('자유시간','🎮','#f97fb8',19,3),mk('꿈나라','🌙','#7ab8e8',22,2)],
    3:[mk('기상','🌅','#5bc8f5',8,1),mk('학교','🏫','#7b9ef7',9,4),mk('점심','🍱','#f97fb8',13,1.5),mk('수영','🏊','#22d3ee',14.5,2),mk('숙제','✏️','#ffe03a',16.5,1),mk('저녁','🍚','#3dd68c',17.5,1),mk('독서','📕','#26d4b8',18.5,0.5),mk('자유시간','🎮','#f97fb8',19,3),mk('꿈나라','🌙','#7ab8e8',22,2)],
    4:[mk('기상','🌅','#5bc8f5',8,1),mk('학교','🏫','#7b9ef7',9,4),mk('점심','🍱','#f97fb8',13,1.5),mk('피아노','🎹','#ff7eb3',14.5,2),mk('숙제','✏️','#ffe03a',16.5,1),mk('저녁','🍚','#3dd68c',17.5,1),mk('독서','📕','#26d4b8',18.5,0.5),mk('자유시간','🎮','#f97fb8',19,3),mk('꿈나라','🌙','#7ab8e8',22,2)],
    5:[mk('기상','😴','#5bc8f5',8,2),mk('댄스','💃','#f97fb8',10,2),mk('점심','🍱','#3dd68c',12,1),mk('자유시간','🎮','#ffaa55',13,3),mk('숙제','✏️','#ffe03a',16,1),mk('저녁','🍚','#3dd68c',17.5,1),mk('꿈나라','🌙','#7ab8e8',22,2)],
    6:[mk('늦잠','😴','#5bc8f5',8,2),mk('성당','⛪','#fbbf24',11,1),mk('점심','🍱','#3dd68c',12,1.5),mk('자유시간','🎮','#f97fb8',13.5,3.5),mk('독서','📕','#26d4b8',17,0.5),mk('저녁','🍚','#3dd68c',17.5,1),mk('꿈나라','🌙','#7ab8e8',22,2)]
  };
}

export function getMonday(d) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0,0,0,0);
  return mon;
}

export function mondayStr(d) { return d.toISOString().slice(0,10); }

export function checkHwWeekReset() {
  const savedWeek = localStorage.getItem('chodinglife_hw_week') || '';
  const thisMonday = mondayStr(getMonday(new Date()));
  if(savedWeek !== thisMonday) {
    const current = JSON.parse(localStorage.getItem('chodinglife_hw_current') || '{}');
    localStorage.setItem('chodinglife_hw_last', JSON.stringify(current));
    localStorage.setItem('chodinglife_hw_current', '{}');
    localStorage.setItem('chodinglife_hw_week', thisMonday);
  }
}

export function getThisWeekMonday() {
  return mondayStr(getMonday(new Date()));
}

export function formatDateLabel(dayIdx) {
  const mon = getMonday(new Date());
  const d = new Date(mon);
  d.setDate(mon.getDate() + dayIdx);
  return (d.getMonth()+1) + '/' + d.getDate() + ' (' + DS[dayIdx] + ')';
}

// ══════════════════════════════════════════
// 파이차트 핵심 로직 - 절대 건드리지 말 것!
// ══════════════════════════════════════════

export function buildSegments(rawEvents, ap) {
  const BASE     = ap==='am' ? 0  : 12;
  const BASE_MIN = BASE * 60;
  const TOTAL    = 720;

  const tl = new Array(TOTAL).fill(null);

  rawEvents.forEach(ev => {
    const s = Math.round(ev.start * 60);
    const e = Math.round((ev.start + ev.dur) * 60);
    const cs = Math.max(s, BASE_MIN);
    const ce = Math.min(e, BASE_MIN + TOTAL);
    if(cs >= ce) return;
    for(let m = cs; m < ce; m++) tl[m - BASE_MIN] = ev;
  });

  if(ap === 'am'){
    const overnightSrc = rawEvents
      .filter(ev => Math.round((ev.start + ev.dur)*60) >= 1440)
      .sort((a,b) => (b.start+b.dur) - (a.start+a.dur))[0]
      || rawEvents[rawEvents.length-1];

    const sentinel = { ...overnightSrc, _overnight: true };
    for(let m = 0; m < TOTAL; m++){
      if(tl[m] !== null) break;
      tl[m] = sentinel;
    }
  }

  const segs = [];
  let i = 0;
  while(i < TOTAL){
    const ev = tl[i];
    let j = i + 1;
    while(j < TOTAL && tl[j] === ev) j++;
    const durMin = j - i;

    if(ev === null){
      segs.push({ name:'', emoji:'', color:'#c8dce8', relMin: i, durMin, isEmpty: true, _overnight: false });
    } else {
      segs.push({ ...ev, relMin: i, durMin, isEmpty: false, _overnight: !!ev._overnight });
    }
    i = j;
  }
  return segs;
}

export function relMinToAngle(relMin) {
  return -Math.PI/2 + (relMin / 720) * Math.PI * 2;
}

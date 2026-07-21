import { useEffect, useRef, useState } from 'react';
import { app as firebaseApp, app } from '../firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useApp } from '../context/AppContext';
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

// ==================== AUDIO ====================
let audioCtx = null;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}
function playSound(type) {
    if (!audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;
        if (type === 'bounce') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
            osc.start(now); osc.stop(now + 0.12);
        } else if (type === 'correct') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, now);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0.02, now + 0.15);
            const o2 = audioCtx.createOscillator(), g2 = audioCtx.createGain();
            o2.connect(g2); g2.connect(audioCtx.destination);
            o2.type = 'sine'; o2.frequency.setValueAtTime(659.25, now + 0.1);
            g2.gain.setValueAtTime(0.2, now + 0.1); g2.gain.linearRampToValueAtTime(0.02, now + 0.3);
            osc.start(now); osc.stop(now + 0.2);
            o2.start(now + 0.1); o2.stop(now + 0.35);
        } else if (type === 'incorrect') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(180, now); osc.frequency.setValueAtTime(150, now + 0.08);
            gain.gain.setValueAtTime(0.25, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
            osc.start(now); osc.stop(now + 0.25);
        } else if (type === 'fail') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.4);
            gain.gain.setValueAtTime(0.2, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
            osc.start(now); osc.stop(now + 0.4);
        } else if (type === 'word_clear') {
            [523,659,784,1046].forEach((f,i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.connect(g); g.connect(audioCtx.destination); o.type = 'sine';
                o.frequency.setValueAtTime(f, now+i*0.08);
                g.gain.setValueAtTime(0.15, now+i*0.08); g.gain.linearRampToValueAtTime(0.01, now+i*0.08+0.2);
                o.start(now+i*0.08); o.stop(now+i*0.08+0.25);
            });
        }
    } catch(e) {}
}

// ==================== DATABASES ====================
const DB_HANJA_12 = [
  { question:"山", answer:"산 산" },     { question:"水", answer:"물 수" },
  { question:"火", answer:"불 화" },     { question:"木", answer:"나무 목" },
  { question:"土", answer:"흙 토" },     { question:"日", answer:"해 일" },
  { question:"月", answer:"달 월" },     { question:"金", answer:"쇠 금" },
  { question:"人", answer:"사람 인" },   { question:"口", answer:"입 구" },
  { question:"手", answer:"손 수" },     { question:"足", answer:"발 족" },
  { question:"目", answer:"눈 목" },     { question:"耳", answer:"귀 이" },
  { question:"大", answer:"큰 대" },     { question:"小", answer:"작은 소" },
  { question:"上", answer:"위 상" },     { question:"下", answer:"아래 하" },
  { question:"中", answer:"가운데 중" }, { question:"一", answer:"하나 일" },
  { question:"二", answer:"둘 이" },     { question:"三", answer:"셋 삼" },
  { question:"四", answer:"넷 사" },     { question:"五", answer:"다섯 오" },
  { question:"六", answer:"여섯 육" },   { question:"七", answer:"일곱 칠" },
  { question:"八", answer:"여덟 팔" },   { question:"九", answer:"아홉 구" },
  { question:"十", answer:"열 십" },     { question:"父", answer:"아버지 부" },
  { question:"母", answer:"어머니 모" }, { question:"子", answer:"아들 자" },
  { question:"女", answer:"여자 녀" },   { question:"男", answer:"남자 남" },
  { question:"兄", answer:"형 형" },     { question:"弟", answer:"동생 제" },
  { question:"門", answer:"문 문" },     { question:"室", answer:"방 실" },
  { question:"外", answer:"바깥 외" },   { question:"內", answer:"안 내" },
  { question:"天", answer:"하늘 천" },   { question:"地", answer:"땅 지" },
  { question:"花", answer:"꽃 화" },     { question:"草", answer:"풀 초" },
  { question:"犬", answer:"개 견" },     { question:"牛", answer:"소 우" },
  { question:"馬", answer:"말 마" },     { question:"魚", answer:"물고기 어" },
  { question:"鳥", answer:"새 조" },     { question:"雨", answer:"비 우" }
];
const DB_HANJA_34 = [
  { question:"學", answer:"배울 학" },   { question:"校", answer:"학교 교" },
  { question:"先", answer:"먼저 선" },   { question:"生", answer:"날 생" },
  { question:"敎", answer:"가르칠 교" }, { question:"友", answer:"벗 우" },
  { question:"愛", answer:"사랑 애" },   { question:"心", answer:"마음 심" },
  { question:"力", answer:"힘 력" },     { question:"氣", answer:"기운 기" },
  { question:"食", answer:"먹을 식" },   { question:"飮", answer:"마실 음" },
  { question:"住", answer:"살 주" },     { question:"衣", answer:"옷 의" },
  { question:"色", answer:"색깔 색" },   { question:"白", answer:"흰 백" },
  { question:"黑", answer:"검은 흑" },   { question:"赤", answer:"붉은 적" },
  { question:"靑", answer:"푸른 청" },   { question:"黃", answer:"노란 황" },
  { question:"東", answer:"동쪽 동" },   { question:"西", answer:"서쪽 서" },
  { question:"南", answer:"남쪽 남" },   { question:"北", answer:"북쪽 북" },
  { question:"春", answer:"봄 춘" },     { question:"夏", answer:"여름 하" },
  { question:"秋", answer:"가을 추" },   { question:"冬", answer:"겨울 동" },
  { question:"年", answer:"해 년" },     { question:"時", answer:"때 시" },
  { question:"分", answer:"나눌 분" },   { question:"間", answer:"사이 간" },
  { question:"前", answer:"앞 전" },     { question:"後", answer:"뒤 후" },
  { question:"左", answer:"왼쪽 좌" },   { question:"右", answer:"오른쪽 우" },
  { question:"長", answer:"긴 장" },     { question:"短", answer:"짧은 단" },
  { question:"高", answer:"높은 고" },   { question:"江", answer:"강 강" },
  { question:"海", answer:"바다 해" },   { question:"林", answer:"숲 림" },
  { question:"石", answer:"돌 석" },     { question:"村", answer:"마을 촌" },
  { question:"市", answer:"시장 시" },   { question:"國", answer:"나라 국" },
  { question:"王", answer:"임금 왕" },   { question:"民", answer:"백성 민" },
  { question:"軍", answer:"군사 군" },   { question:"平", answer:"평평할 평" },
  { question:"和", answer:"화할 화" }
];
const DB_HANJA_56 = [
  { question:"政", answer:"정치 정" },   { question:"治", answer:"다스릴 치" },
  { question:"經", answer:"경제 경" },   { question:"社", answer:"모일 사" },
  { question:"會", answer:"모임 회" },   { question:"文", answer:"글 문" },
  { question:"化", answer:"될 화" },     { question:"科", answer:"과목 과" },
  { question:"技", answer:"재주 기" },   { question:"術", answer:"기술 술" },
  { question:"藝", answer:"재주 예" },   { question:"史", answer:"역사 사" },
  { question:"理", answer:"이치 리" },   { question:"數", answer:"셀 수" },
  { question:"語", answer:"말 어" },     { question:"言", answer:"말씀 언" },
  { question:"書", answer:"글 서" },     { question:"讀", answer:"읽을 독" },
  { question:"知", answer:"알 지" },     { question:"識", answer:"알 식" },
  { question:"思", answer:"생각 사" },   { question:"考", answer:"생각할 고" },
  { question:"問", answer:"물을 문" },   { question:"答", answer:"대답 답" },
  { question:"正", answer:"바를 정" },   { question:"直", answer:"곧을 직" },
  { question:"善", answer:"착할 선" },   { question:"惡", answer:"나쁠 악" },
  { question:"戰", answer:"싸울 전" },   { question:"勝", answer:"이길 승" },
  { question:"敗", answer:"질 패" },     { question:"強", answer:"강할 강" },
  { question:"弱", answer:"약할 약" },   { question:"重", answer:"무거울 중" },
  { question:"輕", answer:"가벼울 경" }, { question:"速", answer:"빠를 속" },
  { question:"遠", answer:"멀 원" },     { question:"近", answer:"가까울 근" },
  { question:"新", answer:"새 신" },     { question:"古", answer:"옛 고" },
  { question:"明", answer:"밝을 명" },   { question:"暗", answer:"어두울 암" },
  { question:"動", answer:"움직일 동" }, { question:"靜", answer:"고요할 정" },
  { question:"開", answer:"열 개" },     { question:"閉", answer:"닫을 폐" },
  { question:"信", answer:"믿을 신" },   { question:"義", answer:"옳을 의" },
  { question:"禮", answer:"예의 례" },   { question:"智", answer:"지혜 지" }
];
const DB_GRADE12 = [
    { question:"Apple",   answer:"사과" },   { question:"Banana",  answer:"바나나" },
    { question:"Orange",  answer:"오렌지" },  { question:"Grape",   answer:"포도" },
    { question:"Melon",   answer:"멜론" },    { question:"Cherry",  answer:"체리" },
    { question:"Peach",   answer:"복숭아" },  { question:"Lemon",   answer:"레몬" },
    { question:"Mango",   answer:"망고" },    { question:"Pear",    answer:"배" },
    { question:"Dog",     answer:"개" },      { question:"Cat",     answer:"고양이" },
    { question:"Bird",    answer:"새" },      { question:"Fish",    answer:"물고기" },
    { question:"Rabbit",  answer:"토끼" },    { question:"Bear",    answer:"곰" },
    { question:"Lion",    answer:"사자" },    { question:"Tiger",   answer:"호랑이" },
    { question:"Monkey",  answer:"원숭이" },  { question:"Cow",     answer:"소" },
    { question:"Pig",     answer:"돼지" },    { question:"Duck",    answer:"오리" },
    { question:"Frog",    answer:"개구리" },  { question:"Horse",   answer:"말" },
    { question:"Sheep",   answer:"양" },      { question:"Chicken", answer:"닭" },
    { question:"Red",     answer:"빨간" },    { question:"Blue",    answer:"파란" },
    { question:"Green",   answer:"초록" },    { question:"Yellow",  answer:"노란" },
    { question:"Black",   answer:"검은" },    { question:"White",   answer:"하얀" },
    { question:"Pink",    answer:"분홍" },    { question:"Purple",  answer:"보라" },
    { question:"Head",    answer:"머리" },    { question:"Eye",     answer:"눈" },
    { question:"Nose",    answer:"코" },      { question:"Mouth",   answer:"입" },
    { question:"Ear",     answer:"귀" },      { question:"Hand",    answer:"손" },
    { question:"Foot",    answer:"발" },      { question:"Leg",     answer:"다리" },
    { question:"Mom",     answer:"엄마" },    { question:"Dad",     answer:"아빠" },
    { question:"Sister",  answer:"언니/누나" },{ question:"Brother", answer:"형/오빠" },
    { question:"Baby",    answer:"아기" },    { question:"Family",  answer:"가족" },
    { question:"Book",    answer:"책" },      { question:"Bag",     answer:"가방" },
    { question:"Pen",     answer:"펜" },      { question:"Desk",    answer:"책상" },
    { question:"Chair",   answer:"의자" },    { question:"School",  answer:"학교" },
    { question:"Class",   answer:"수업" },    { question:"Friend",  answer:"친구" },
    { question:"Sun",     answer:"태양" },    { question:"Moon",    answer:"달" },
    { question:"Star",    answer:"별" },      { question:"Rain",    answer:"비" },
    { question:"Snow",    answer:"눈" },      { question:"Wind",    answer:"바람" },
    { question:"Sky",     answer:"하늘" },    { question:"Cloud",   answer:"구름" },
    { question:"Tree",    answer:"나무" },    { question:"Flower",  answer:"꽃" },
    { question:"Grass",   answer:"풀" },      { question:"Water",   answer:"물" },
    { question:"Rice",    answer:"밥" },      { question:"Bread",   answer:"빵" },
    { question:"Milk",    answer:"우유" },    { question:"Egg",     answer:"달걀" },
    { question:"Cake",    answer:"케이크" },  { question:"Candy",   answer:"사탕" },
    { question:"Ball",    answer:"공" },      { question:"Toy",     answer:"장난감" },
    { question:"Game",    answer:"게임" },    { question:"Sing",    answer:"노래하다" },
    { question:"Run",     answer:"달리다" },  { question:"Jump",    answer:"뛰다" },
    { question:"Eat",     answer:"먹다" },    { question:"Sleep",   answer:"자다" },
    { question:"Play",    answer:"놀다" },    { question:"Read",    answer:"읽다" },
    { question:"Write",   answer:"쓰다" },    { question:"Draw",    answer:"그리다" },
    { question:"Good",    answer:"좋은" },    { question:"Big",     answer:"큰" },
    { question:"Small",   answer:"작은" },    { question:"Hot",     answer:"뜨거운" },
    { question:"Cold",    answer:"차가운" },  { question:"Fast",    answer:"빠른" },
    { question:"Slow",    answer:"느린" },    { question:"Happy",   answer:"행복한" },
    { question:"Sad",     answer:"슬픈" },    { question:"New",     answer:"새로운" },
    { question:"One",     answer:"하나" },    { question:"Two",     answer:"둘" }
];
const DB_GRADE34 = [
    { question:"Library",    answer:"도서관" },  { question:"Hospital",   answer:"병원" },
    { question:"Market",     answer:"시장" },    { question:"Station",    answer:"역" },
    { question:"Museum",     answer:"박물관" },  { question:"Park",       answer:"공원" },
    { question:"Restaurant", answer:"식당" },    { question:"Airport",    answer:"공항" },
    { question:"Mountain",   answer:"산" },      { question:"River",      answer:"강" },
    { question:"Ocean",      answer:"바다" },    { question:"Island",     answer:"섬" },
    { question:"Forest",     answer:"숲" },      { question:"Desert",     answer:"사막" },
    { question:"Season",     answer:"계절" },    { question:"Spring",     answer:"봄" },
    { question:"Summer",     answer:"여름" },    { question:"Autumn",     answer:"가을" },
    { question:"Winter",     answer:"겨울" },    { question:"Weather",    answer:"날씨" },
    { question:"Sunny",      answer:"맑은" },    { question:"Cloudy",     answer:"흐린" },
    { question:"Rainy",      answer:"비오는" },  { question:"Snowy",      answer:"눈오는" },
    { question:"Windy",      answer:"바람부는" },{ question:"Foggy",      answer:"안개낀" },
    { question:"Subject",    answer:"과목" },    { question:"Math",       answer:"수학" },
    { question:"Science",    answer:"과학" },    { question:"English",    answer:"영어" },
    { question:"History",    answer:"역사" },    { question:"Music",      answer:"음악" },
    { question:"Art",        answer:"미술" },    { question:"Sport",      answer:"체육" },
    { question:"Test",       answer:"시험" },    { question:"Homework",   answer:"숙제" },
    { question:"Eraser",     answer:"지우개" },  { question:"Ruler",      answer:"자" },
    { question:"Scissors",   answer:"가위" },    { question:"Glue",       answer:"풀" },
    { question:"Computer",   answer:"컴퓨터" },  { question:"Internet",   answer:"인터넷" },
    { question:"Phone",      answer:"전화" },    { question:"Camera",     answer:"카메라" },
    { question:"Television", answer:"텔레비전" },{ question:"Radio",      answer:"라디오" },
    { question:"Newspaper",  answer:"신문" },    { question:"Magazine",   answer:"잡지" },
    { question:"Soccer",     answer:"축구" },    { question:"Baseball",   answer:"야구" },
    { question:"Basketball", answer:"농구" },    { question:"Swimming",   answer:"수영" },
    { question:"Running",    answer:"달리기" },  { question:"Cycling",    answer:"자전거" },
    { question:"Dancing",    answer:"춤" },      { question:"Cooking",    answer:"요리" },
    { question:"Shopping",   answer:"쇼핑" },    { question:"Traveling",  answer:"여행" },
    { question:"Camping",    answer:"캠핑" },    { question:"Fishing",    answer:"낚시" },
    { question:"Breakfast",  answer:"아침식사" },{ question:"Lunch",      answer:"점심식사" },
    { question:"Dinner",     answer:"저녁식사" },{ question:"Noodle",     answer:"국수" },
    { question:"Soup",       answer:"국" },      { question:"Salad",      answer:"샐러드" },
    { question:"Pizza",      answer:"피자" },    { question:"Hamburger",  answer:"햄버거" },
    { question:"Sandwich",   answer:"샌드위치" },{ question:"Cookie",     answer:"쿠키" },
    { question:"Chocolate",  answer:"초콜릿" },  { question:"Ice cream",  answer:"아이스크림" },
    { question:"Juice",      answer:"주스" },    { question:"Coffee",     answer:"커피" },
    { question:"Tall",       answer:"키 큰" },   { question:"Short",      answer:"키 작은" },
    { question:"Long",       answer:"긴" },      { question:"Round",      answer:"둥근" },
    { question:"Square",     answer:"사각형" },  { question:"Triangle",   answer:"삼각형" },
    { question:"Circle",     answer:"원" },      { question:"Heavy",      answer:"무거운" },
    { question:"Light",      answer:"가벼운" },  { question:"Soft",       answer:"부드러운" },
    { question:"Hard",       answer:"딱딱한" },  { question:"Quiet",      answer:"조용한" },
    { question:"Loud",       answer:"시끄러운" },{ question:"Clean",      answer:"깨끗한" },
    { question:"Dirty",      answer:"더러운" },  { question:"Busy",       answer:"바쁜" },
    { question:"Tired",      answer:"피곤한" },  { question:"Angry",      answer:"화난" },
    { question:"Scared",     answer:"무서운" },  { question:"Excited",    answer:"신나는" },
    { question:"Surprised",  answer:"놀란" },    { question:"Bored",      answer:"지루한" },
    { question:"Hungry",     answer:"배고픈" },  { question:"Thirsty",    answer:"목마른" }
];
const DB_GRADE56 = [
    { question:"Environment",  answer:"환경" },    { question:"Pollution",    answer:"오염" },
    { question:"Recycle",      answer:"재활용" },  { question:"Energy",       answer:"에너지" },
    { question:"Climate",      answer:"기후" },    { question:"Earthquake",   answer:"지진" },
    { question:"Volcano",      answer:"화산" },    { question:"Typhoon",      answer:"태풍" },
    { question:"Flood",        answer:"홍수" },    { question:"Drought",      answer:"가뭄" },
    { question:"Government",   answer:"정부" },    { question:"President",    answer:"대통령" },
    { question:"Election",     answer:"선거" },    { question:"Democracy",    answer:"민주주의" },
    { question:"Law",          answer:"법" },      { question:"Police",       answer:"경찰" },
    { question:"Doctor",       answer:"의사" },    { question:"Nurse",        answer:"간호사" },
    { question:"Teacher",      answer:"선생님" },  { question:"Engineer",     answer:"엔지니어" },
    { question:"Scientist",    answer:"과학자" },  { question:"Artist",       answer:"예술가" },
    { question:"Musician",     answer:"음악가" },  { question:"Writer",       answer:"작가" },
    { question:"Athlete",      answer:"운동선수" },{ question:"Volunteer",    answer:"자원봉사" },
    { question:"Develop",      answer:"개발하다" },{ question:"Improve",      answer:"개선하다" },
    { question:"Create",       answer:"창조하다" },{ question:"Discover",     answer:"발견하다" },
    { question:"Explore",      answer:"탐험하다" },{ question:"Protect",      answer:"보호하다" },
    { question:"Communicate",  answer:"소통하다" },{ question:"Cooperate",    answer:"협력하다" },
    { question:"Respect",      answer:"존중하다" },{ question:"Responsibility",answer:"책임" },
    { question:"Culture",      answer:"문화" },    { question:"Tradition",    answer:"전통" },
    { question:"Custom",       answer:"관습" },    { question:"Festival",     answer:"축제" },
    { question:"Religion",     answer:"종교" },    { question:"Language",     answer:"언어" },
    { question:"Alphabet",     answer:"알파벳" },  { question:"Grammar",      answer:"문법" },
    { question:"Vocabulary",   answer:"어휘" },    { question:"Sentence",     answer:"문장" },
    { question:"Paragraph",    answer:"단락" },    { question:"Essay",        answer:"에세이" },
    { question:"Experiment",   answer:"실험" },    { question:"Research",     answer:"연구" },
    { question:"Theory",       answer:"이론" },    { question:"Evidence",     answer:"증거" },
    { question:"Conclusion",   answer:"결론" },    { question:"Hypothesis",   answer:"가설" },
    { question:"Electricity",  answer:"전기" },    { question:"Magnet",       answer:"자석" },
    { question:"Gravity",      answer:"중력" },    { question:"Pressure",     answer:"압력" },
    { question:"Temperature",  answer:"온도" },    { question:"Chemical",     answer:"화학물질" },
    { question:"Oxygen",       answer:"산소" },    { question:"Carbon",       answer:"탄소" },
    { question:"Planet",       answer:"행성" },    { question:"Galaxy",       answer:"은하계" },
    { question:"Universe",     answer:"우주" },    { question:"Satellite",    answer:"위성" },
    { question:"Continent",    answer:"대륙" },    { question:"Country",      answer:"나라" },
    { question:"Population",   answer:"인구" },    { question:"Economy",      answer:"경제" },
    { question:"Industry",     answer:"산업" },    { question:"Agriculture",  answer:"농업" },
    { question:"Technology",   answer:"기술" },    { question:"Invention",    answer:"발명" },
    { question:"Revolution",   answer:"혁명" },    { question:"Migration",    answer:"이주" },
    { question:"International",answer:"국제적" },  { question:"Globalization",answer:"세계화" },
    { question:"Cooperation",  answer:"협조" },    { question:"Agreement",    answer:"합의" },
    { question:"Conflict",     answer:"갈등" },    { question:"Peace",        answer:"평화" },
    { question:"Freedom",      answer:"자유" },    { question:"Justice",      answer:"정의" },
    { question:"Equality",     answer:"평등" },    { question:"Rights",       answer:"권리" },
    { question:"Duty",         answer:"의무" },    { question:"Community",    answer:"공동체" },
    { question:"Generation",   answer:"세대" },    { question:"Future",       answer:"미래" },
    { question:"Challenge",    answer:"도전" },    { question:"Opportunity",  answer:"기회" },
    { question:"Achievement",  answer:"성취" },    { question:"Failure",      answer:"실패" },
    { question:"Courage",      answer:"용기" },    { question:"Patience",     answer:"인내" },
    { question:"Wisdom",       answer:"지혜" },    { question:"Imagination",  answer:"상상력" },
    { question:"Creativity",   answer:"창의성" },  { question:"Leadership",   answer:"리더십" }
];

// ==================== GAME STATE ====================
const DAILY_WORD_LIMIT = 10;
const MASTER_HIT_TARGET = 5;
const DECO_COLORS = ['#b2ebf2','#e1bee7','#fffde7','#dcedc8'];
const DECO_SYMBOLS = ['✦','♡'];

let wordPool = [], currentWordIndex = 0, correctHitCount = 0;
let lastHitTime = 0;
let currentMode = 'grade12';
let isPlaying = false, score = 0, lives = 3, combo = 0, masteredWordsCount = 0;

let canvas, ctx;
let animationFrameId;

const _PUBLIC = process.env.PUBLIC_URL || '';
let bgImage = null, bgImageLoaded = false;
let paddleImage = null, paddleImageLoaded = false;
function preloadGameImages() {
    if (!bgImage) {
        bgImage = new Image();
        bgImage.onload = () => { bgImageLoaded = true; };
        bgImage.src = _PUBLIC + '/icons/game_bg.jpg';
    }
    if (!paddleImage) {
        paddleImage = new Image();
        paddleImage.onload = () => { paddleImageLoaded = true; };
        paddleImage.src = _PUBLIC + '/icons/paddle.png';
    }
}

const paddle = { x:0, y:0, width:120, height:28, speed:8 };
const ball    = { x:0, y:0, radius:32, dx:3, dy:-3, text:'', baseSpeed:3, speedMultiplier:1 };

let bricks = [], decorBricks = [], particles = [], bgStars = [];
let basePaddleWidth = 120;
let bricksDestroyed = 0;

const GRID_TOP     = 52;
const GRID_BLOCK_H = 52;
const GRID_ROW_GAP = 8;

let safeInsetTop = 0, safeInsetBottom = 0;
function measureSafeAreaInsets() {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);';
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    safeInsetTop = parseFloat(cs.paddingTop) || 0;
    safeInsetBottom = parseFloat(cs.paddingBottom) || 0;
    document.body.removeChild(probe);
}

// ==================== GAME FUNCTIONS ====================
function resizeCanvas() {
    if (!canvas) return;
    measureSafeAreaInsets();
    const c = canvas.parentElement;
    canvas.width  = c.clientWidth;
    canvas.height = c.clientHeight;
    ball.radius    = Math.max(28, Math.min(40, canvas.width * 0.09));
    ball.baseSpeed = Math.max(2.2, Math.min(4.0, canvas.width * 0.007));
    paddle.width   = Math.max(113, Math.min(163, canvas.width * 0.40));
    basePaddleWidth = paddle.width;
    paddle.y = canvas.height - 68 - safeInsetBottom;
    if (paddle.x === 0) paddle.x = (canvas.width - paddle.width) / 2;
}

function applyDifficulty() {
    keepPaddleInBounds();
}
function onBrickDestroyed() {
    bricksDestroyed++;
    ball.speedMultiplier = Math.min(1.0 + Math.floor(bricksDestroyed / 5) * 0.05, 1.5);
}

function initBgStars() {
    bgStars = [];
    for (let i = 0; i < 8; i++) {
        bgStars.push({
            x: 20 + Math.random() * (canvas.width  - 40),
            y: 20 + Math.random() * (canvas.height - 40),
            size: Math.random() * 10 + 8
        });
    }
}

let keys = {};
function handleKeyDown(e) { keys[e.key] = true; }
function handleKeyUp(e)   { keys[e.key] = false; }
function handleMouseMove(e) {
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    paddle.x = e.clientX - r.left - paddle.width / 2;
    keepPaddleInBounds();
}
function handleTouchStart(e) { initAudio(); handleTouch(e); }
function handleTouchMove(e)  { handleTouch(e); }
function handleTouch(e) {
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    paddle.x = e.touches[0].clientX - r.left - paddle.width / 2;
    keepPaddleInBounds();
}
function keepPaddleInBounds() {
    if (paddle.x < 0) paddle.x = 0;
    if (paddle.x + paddle.width > canvas.width) paddle.x = canvas.width - paddle.width;
}

// eslint-disable-next-line no-control-regex
function getCleanEnglish(text) { return text.replace(/[^\x00-\x7F]+/g,'').trim(); }
function speakWord(text) {
    const c = getCleanEnglish(text);
    if (!c) return;
    if (Capacitor.isNativePlatform()) {
        TextToSpeech.stop();
        TextToSpeech.speak({ text: c, lang: 'en-US', rate: 0.85 });
        return;
    }
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(c);
    u.lang = 'en-US'; u.rate = 0.85;
    window.speechSynthesis.speak(u);
}

function truncateBrickText(text, max = 14) {
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
}
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ── 내가 만든 단어장 ──
let customWords = [];
function showCustomWordList() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('custom-word-screen').classList.remove('hidden');
    renderCustomWordList();
}
function addCustomWord() {
    const en = document.getElementById('new-word-en').value.trim();
    const ko = document.getElementById('new-word-ko').value.trim();
    const status = document.getElementById('translate-status');
    if (!en || !ko) { status.textContent = '영어와 한글 뜻을 모두 입��해주세요.'; status.style.color = '#ef4444'; return; }
    if (customWords.length >= 30) { status.textContent = '최대 30개까지만 추가할 수 있어요.'; status.style.color = '#ef4444'; return; }
    if (customWords.find(w => w.en.toLowerCase() === en.toLowerCase())) { status.textContent = '이미 있는 단어예요.'; status.style.color = '#ef4444'; return; }
    customWords.push({ en, ko });
    document.getElementById('new-word-en').value = '';
    document.getElementById('new-word-ko').value = '';
    status.textContent = '';
    renderCustomWordList();
    saveCustomWords();
}
function removeCustomWord(idx) {
    customWords.splice(idx, 1);
    renderCustomWordList();
    saveCustomWords();
}
function renderCustomWordList() {
    const list  = document.getElementById('custom-word-list');
    const count = document.getElementById('word-count');
    const btn   = document.getElementById('start-custom-game-btn');
    count.textContent = customWords.length;
    list.innerHTML = customWords.map((w, i) => `
        <div class="flex items-start justify-between rounded-xl px-3 py-2 mb-2"
             style="background:#fff;border:1px solid #ede9fe;">
            <div class="flex-1 min-w-0 mr-2">
                <span class="text-sm font-bold block" style="color:#374151;word-break:break-all;">${w.en}</span>
                <span class="text-xs block" style="color:#7c6fcd;word-break:keep-all;">${w.ko}</span>
            </div>
            <button onclick="window.removeCustomWord(${i})"
                    class="text-xs text-gray-400 flex-shrink-0 mt-1"
                    style="min-width:20px;">✕</button>
        </div>
    `).join('');
    if (customWords.length >= 10) {
        btn.disabled = false;
        btn.classList.remove('opacity-40');
        btn.textContent = `🎮 게임 시작! (${customWords.length}개)`;
    } else {
        btn.disabled = true;
        btn.classList.add('opacity-40');
        btn.textContent = `🎮 게임 시작! (${customWords.length}/10개 필요)`;
    }
}
function saveCustomWords() {
    localStorage.setItem('chodinglife_custom_words', JSON.stringify(customWords));
}
function loadCustomWords() {
    const saved = localStorage.getItem('chodinglife_custom_words');
    if (saved) customWords = JSON.parse(saved);
}

function showGradeSelect(subject) {
    document.getElementById('subject-select').classList.add('hidden');
    document.getElementById('grade-select').classList.remove('hidden');
    const title = document.getElementById('grade-select-title');
    const btn1  = document.getElementById('grade-btn-1');
    const btn2  = document.getElementById('grade-btn-2');
    const btn3  = document.getElementById('grade-btn-3');
    if (subject === 'english') {
        title.textContent = '🇬🇧 영어 단어장 - 학년을 선택해요!';
        btn1.onclick = () => startGame('grade12');
        btn2.onclick = () => startGame('grade34');
        btn3.onclick = () => startGame('grade56');
    } else {
        title.textContent = '🇨🇳 한자 단어장 - 학년을 선택해요!';
        btn1.onclick = () => startGame('hanja12');
        btn2.onclick = () => startGame('hanja34');
        btn3.onclick = () => startGame('hanja56');
    }
}
function goBackToSubject() {
    document.getElementById('grade-select').classList.add('hidden');
    document.getElementById('subject-select').classList.remove('hidden');
}

function startGame(mode) {
    initAudio();
    ['start-screen','game-over-screen','game-clear-screen',
     'daily-complete-screen','quiz-overlay','custom-word-screen'].forEach(id =>
        document.getElementById(id).classList.add('hidden')
    );
    document.getElementById('canvas-hud').classList.remove('hidden');

    currentMode = mode;
    score = 0; lives = 3; combo = 0; masteredWordsCount = 0;
    bricksDestroyed = 0; ball.speedMultiplier = 1.0;
    updateHUD();

    let selectedDB;
    if (mode === 'grade12')       selectedDB = DB_GRADE12;
    else if (mode === 'grade34')  selectedDB = DB_GRADE34;
    else if (mode === 'grade56')  selectedDB = DB_GRADE56;
    else if (mode === 'hanja12')  selectedDB = DB_HANJA_12;
    else if (mode === 'hanja34')  selectedDB = DB_HANJA_34;
    else if (mode === 'hanja56')  selectedDB = DB_HANJA_56;
    else {
        if (customWords.length < 10) {
            alert('단어장에 최소 10개 이상 단어를 추가해주세요!');
            showCustomWordList();
            return;
        }
        selectedDB = customWords.map(w => ({
            question: w.en,
            answer:   w.ko,
            wrongs:   customWords.filter(x => x.en !== w.en)
                          .sort(() => Math.random() - 0.5)
                          .slice(0, 2)
                          .map(x => x.ko)
        }));
    }
    const randomStart = Math.floor(Math.random() * selectedDB.length);
    const rotated = [...selectedDB.slice(randomStart), ...selectedDB.slice(0, randomStart)];
    wordPool = shuffleArray(rotated);
    currentWordIndex = 0;

    resizeCanvas();
    initBgStars();
    loadWord(0);
    resetBall();
    isPlaying = true;
    gameLoop();
}

function loadWord(index) {
    if (index >= wordPool.length) { triggerGameClear(); return; }
    const wd = wordPool[index];
    ball.text = wd.answer;
    correctHitCount = 0;

    const others = shuffleArray(wordPool.filter((_,i) => i !== index));
    const wordList = shuffleArray([
        { text: wd.question,        isCorrect: true,  koreanText: wd.answer },
        { text: others[0].question, isCorrect: false, koreanText: others[0].answer },
        { text: others[1].question, isCorrect: false, koreanText: others[1].answer }
    ]);

    const margin = 10;
    const bw = (canvas.width - margin * 4) / 3;

    const getSlotPos = (slot) => ({
        x: margin + (slot % 3) * (bw + margin),
        y: GRID_TOP + safeInsetTop + Math.floor(slot / 3) * (GRID_BLOCK_H + GRID_ROW_GAP),
        width: bw,
        height: GRID_BLOCK_H
    });

    const allSlots = shuffleArray([0,1,2,3,4,5]);
    const wordSlots = allSlots.slice(0, 3);
    const decoSlots = allSlots.slice(3);

    bricks = wordSlots.map((slot, i) => ({
        ...getSlotPos(slot),
        text: wordList[i].text,
        koreanText: wordList[i].koreanText,
        isCorrect: wordList[i].isCorrect,
        color: wordList[i].isCorrect ? '#4ade80' : '#fca5a5',
        glowTimer: 0,
        hp: wordList[i].isCorrect ? 999 : 3
    }));

    decorBricks = decoSlots.map(slot => ({
        ...getSlotPos(slot),
        hp: 2,
        color: DECO_COLORS[Math.floor(Math.random() * DECO_COLORS.length)],
        symbol: DECO_SYMBOLS[Math.floor(Math.random() * DECO_SYMBOLS.length)],
        isDecor: true
    }));

    applyDifficulty(index);
}

function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = paddle.y - 40;
    ball.dx = (Math.random() * 4 - 2) || 2;
    ball.dy = -ball.baseSpeed;
}

function gameLoop() {
    if (!isPlaying) return;
    updatePhysics();
    drawGame();
    animationFrameId = requestAnimationFrame(gameLoop);
}

function updatePhysics() {
    if (keys['ArrowLeft']  || keys['Left'])  paddle.x -= paddle.speed;
    if (keys['ArrowRight'] || keys['Right']) paddle.x += paddle.speed;
    keepPaddleInBounds();

    ball.x += ball.dx * ball.speedMultiplier;
    ball.y += ball.dy * ball.speedMultiplier;

    if (ball.x - ball.radius < 0) {
        ball.x = ball.radius; ball.dx = -ball.dx; playSound('bounce');
    }
    if (ball.x + ball.radius > canvas.width) {
        ball.x = canvas.width - ball.radius; ball.dx = -ball.dx; playSound('bounce');
    }
    if (ball.y - ball.radius < 0) {
        ball.y = ball.radius; ball.dy = -ball.dy; playSound('bounce');
    }
    if (ball.y - ball.radius > canvas.height) { handleLifeLoss(); return; }

    if (ball.y + ball.radius >= paddle.y &&
        ball.x >= paddle.x && ball.x <= paddle.x + paddle.width &&
        ball.y <= paddle.y + paddle.height) {
        const rel   = (paddle.x + paddle.width / 2) - ball.x;
        const norm  = rel / (paddle.width / 2);
        const angle = norm * (Math.PI / 3);
        ball.dy = -Math.abs(ball.baseSpeed * Math.cos(angle));
        ball.dx = -ball.baseSpeed * Math.sin(angle);
        playSound('bounce');
        createBounceSmoke(ball.x, paddle.y);
    }

    const allBricks = [...decorBricks, ...bricks];
    for (let bi = 0; bi < allBricks.length; bi++) {
        const b = allBricks[bi];
        const cx = Math.max(b.x, Math.min(ball.x, b.x + b.width));
        const cy = Math.max(b.y, Math.min(ball.y, b.y + b.height));
        const ddx = ball.x - cx, ddy = ball.y - cy;
        if (ddx*ddx + ddy*ddy < ball.radius * ball.radius) {
            if (Date.now() - lastHitTime < 300) { break; }
            if (Math.abs(ddx) > Math.abs(ddy)) ball.dx = -ball.dx;
            else ball.dy = -ball.dy;
            if (b.isDecor)        handleDecorHit(b);
            else if (b.isCorrect) handleCorrectHit(b);
            else                  handleWrongHit(b);
            lastHitTime = Date.now();
            break;
        }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.alpha -= 0.02;
        if (p.alpha <= 0) particles.splice(i, 1);
    }
}

function handleDecorHit(brick) {
    brick.hp--;
    playSound('bounce');
    if (brick.hp <= 0) {
        createSmallExplosion(brick.x + brick.width/2, brick.y + brick.height/2, brick.color);
        const idx = decorBricks.indexOf(brick);
        if (idx !== -1) decorBricks.splice(idx, 1);
        onBrickDestroyed();
    }
}
function handleCorrectHit(brick) {
    if (wordPool[currentWordIndex] && !currentMode.startsWith('hanja')) {
        speakWord(wordPool[currentWordIndex].question);
    }
    playSound('correct');
    correctHitCount++;
    score += 10 + combo * 5;
    combo++;
    brick.glowTimer = 15;
    createExplosion(brick.x + brick.width/2, brick.y + brick.height/2, '#4ade80');
    updateHUD();
    if (correctHitCount >= MASTER_HIT_TARGET && isPlaying) { showQuiz(); return; }
    const correctBricksLeft = bricks.filter(b => b.isCorrect);
    if (correctBricksLeft.length === 0 && isPlaying) { showQuiz(); return; }
}
function handleWrongHit(brick) {
    playSound('incorrect');
    combo = 0;
    brick.glowTimer = -60;
    createExplosion(ball.x, ball.y, '#fca5a5');
    updateHUD();
    brick.hp--;
    if (brick.hp <= 0) {
        createSmallExplosion(brick.x + brick.width/2, brick.y + brick.height/2, '#fca5a5');
        const idx = bricks.indexOf(brick);
        if (idx !== -1) bricks.splice(idx, 1);
        onBrickDestroyed();
    }
}
function handleLifeLoss() {
    playSound('fail'); lives--; combo = 0; updateHUD();
    if (lives <= 0) triggerGameOver(); else resetBall();
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 15; i++) {
        particles.push({ x, y,
            vx: (Math.random()-0.5)*8, vy: (Math.random()-0.5)*8,
            radius: Math.random()*4+2, color, alpha: 1.0 });
    }
}
function createSmallExplosion(x, y, color) {
    const n = Math.floor(Math.random()*3)+4;
    for (let i = 0; i < n; i++) {
        particles.push({ x, y,
            vx: (Math.random()-0.5)*6, vy: (Math.random()-0.5)*6,
            radius: Math.random()*5+3, color, alpha: 1.0 });
    }
}
function createBounceSmoke(x, y) {
    for (let i = 0; i < 6; i++) {
        particles.push({
            x: x + (Math.random()-0.5)*40, y,
            vx: (Math.random()-0.5)*2, vy: -Math.random()*3,
            radius: Math.random()*6+3,
            color: 'rgba(196,181,253,0.5)', alpha: 0.8 });
    }
}

const QUIZ_BG = ['#fce4ec','#ede7f6','#e3f2fd'];
function showQuiz() {
    isPlaying = false;
    cancelAnimationFrame(animationFrameId);

    const wd = wordPool[currentWordIndex];
    document.getElementById('quiz-question').textContent = `"${wd.answer}"`;
    document.getElementById('quiz-result').textContent = '';

    const others = shuffleArray(wordPool.filter((_,i) => i !== currentWordIndex));
    const choices = shuffleArray([
        { text: wd.question,        isCorrect: true },
        { text: others[0].question, isCorrect: false },
        { text: others[1].question, isCorrect: false }
    ]);

    const container = document.getElementById('quiz-choices');
    container.innerHTML = '';
    const btns = [];

    choices.forEach((choice, idx) => {
        const btn = document.createElement('button');
        btn.textContent = choice.text;
        btn.style.cssText = `width:100%;padding:14px 12px;border-radius:16px;` +
            `border:2px solid transparent;background:${QUIZ_BG[idx]};` +
            `color:#374151;font-size:18px;font-weight:700;cursor:pointer;` +
            `font-family:'Jua',sans-serif;display:block;transition:filter 0.1s;`;
        btn.onmouseover = () => { btn.style.filter = 'brightness(0.96)'; };
        btn.onmouseout  = () => { btn.style.filter = ''; };
        btn.onclick = () => handleQuizAnswer(choice.isCorrect, wd.question, idx, btns, choices);
        btns.push(btn);
        container.appendChild(btn);
    });

    document.getElementById('quiz-overlay').classList.remove('hidden');
}
function handleQuizAnswer(isCorrect, correctText, clickedIdx, btns, choices) {
    btns.forEach(b => { b.disabled = true; b.style.cursor = 'default'; b.style.filter = ''; });
    const correctIdx = choices.findIndex(c => c.isCorrect);
    const resultEl = document.getElementById('quiz-result');

    if (isCorrect) {
        btns[clickedIdx].style.background = '#c8e6c9';
        btns[clickedIdx].style.borderColor = '#4caf50';
        btns[clickedIdx].textContent = '✅ ' + btns[clickedIdx].textContent;
        playSound('correct');
        resultEl.textContent = '정답! 🎉';
        resultEl.style.color = '#16a34a';
        setTimeout(proceedToNextWord, 1000);
    } else {
        btns[clickedIdx].style.background = '#ffcdd2';
        btns[clickedIdx].style.borderColor = '#ef9a9a';
        btns[clickedIdx].textContent = '❌ ' + btns[clickedIdx].textContent;
        btns[correctIdx].style.background = '#c8e6c9';
        btns[correctIdx].style.borderColor = '#4caf50';
        btns[correctIdx].textContent = '✅ ' + btns[correctIdx].textContent;
        playSound('incorrect');
        resultEl.textContent = `아쉬워요! 정답은 '${correctText}'`;
        resultEl.style.color = '#dc2626';
        setTimeout(proceedToNextWord, 1500);
    }
}
function proceedToNextWord() {
    document.getElementById('quiz-overlay').classList.add('hidden');
    playSound('word_clear');
    masteredWordsCount++;
    updateHUD();

    const banner = document.getElementById('word-clear-banner');
    banner.classList.remove('hidden');
    setTimeout(() => banner.classList.add('hidden'), 800);
    createExplosion(canvas.width/2, canvas.height/3, '#f9a8d4');

    if (masteredWordsCount >= DAILY_WORD_LIMIT) { triggerDailyComplete(); return; }
    currentWordIndex++;
    if (currentWordIndex >= wordPool.length) { triggerGameClear(); return; }

    loadWord(currentWordIndex);
    resetBall();
    isPlaying = true;
    gameLoop();
}

function saveGameState() {
    try {
        localStorage.setItem('wordgame_save', JSON.stringify({
            mode: currentMode,
            wordPool,
            currentWordIndex,
            score,
            lives,
            speedMultiplier: ball.speedMultiplier,
            bricksDestroyed,
            masteredWordsCount,
        }));
    } catch(e) {}
}
function resumeGame() {
    try {
        const save = JSON.parse(localStorage.getItem('wordgame_save'));
        if (!save) return;
        initAudio();
        ['start-screen','game-over-screen','game-clear-screen',
         'daily-complete-screen','quiz-overlay','custom-word-screen'].forEach(id =>
            document.getElementById(id).classList.add('hidden')
        );
        document.getElementById('canvas-hud').classList.remove('hidden');
        currentMode        = save.mode;
        wordPool           = save.wordPool;
        currentWordIndex   = save.currentWordIndex;
        score              = save.score;
        lives              = save.lives;
        ball.speedMultiplier = save.speedMultiplier ?? 1.0;
        bricksDestroyed    = save.bricksDestroyed   ?? 0;
        masteredWordsCount = save.masteredWordsCount ?? 0;
        resizeCanvas();
        initBgStars();
        loadWord(currentWordIndex);
        resetBall();
        updateHUD();
        isPlaying = true;
        gameLoop();
    } catch(e) {
        localStorage.removeItem('wordgame_save');
    }
}
function triggerGameOver() {
    isPlaying = false; cancelAnimationFrame(animationFrameId);
    localStorage.removeItem('wordgame_save');
    document.getElementById('final-score').innerText = score;
    document.getElementById('mastered-count').innerText = masteredWordsCount;
    document.getElementById('game-over-screen').classList.remove('hidden');
}
function triggerGameClear() {
    isPlaying = false; cancelAnimationFrame(animationFrameId);
    localStorage.removeItem('wordgame_save');
    document.getElementById('game-clear-screen').classList.remove('hidden');
}
function triggerDailyComplete() {
    isPlaying = false; cancelAnimationFrame(animationFrameId);
    localStorage.removeItem('wordgame_save');
    document.getElementById('daily-complete-score').innerText = score;
    document.getElementById('daily-complete-mastered').innerText = masteredWordsCount;
    document.getElementById('daily-complete-screen').classList.remove('hidden');
}
function resetToMenu() {
    ['game-over-screen','game-clear-screen','daily-complete-screen',
     'quiz-overlay','canvas-hud'].forEach(id =>
        document.getElementById(id).classList.add('hidden')
    );
    document.getElementById('start-screen').classList.remove('hidden');
    document.getElementById('grade-select').classList.add('hidden');
    document.getElementById('subject-select').classList.remove('hidden');
    document.getElementById('custom-word-screen').classList.add('hidden');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (window._wgSetHasSave) window._wgSetHasSave(!!localStorage.getItem('wordgame_save'));
}
function updateHUD() {
    const scoreEl = document.getElementById('canvas-score');
    if (scoreEl) scoreEl.textContent = 'SCORE: ' + score;
    const heartsEl = document.getElementById('hearts-container');
    if (heartsEl) heartsEl.innerText = '❤️'.repeat(lives) + '💔'.repeat(Math.max(0, 3 - lives));
    const comboEl = document.getElementById('canvas-combo');
    if (comboEl) {
        if (combo >= 2) {
            comboEl.textContent = `🔥 ${combo} COMBO`;
            comboEl.style.visibility = 'visible';
        } else {
            comboEl.style.visibility = 'hidden';
        }
    }
}

function drawGame() {
    if (!ctx) return;
    if (bgImageLoaded && bgImage) {
        const iw = bgImage.naturalWidth, ih = bgImage.naturalHeight;
        const cw = canvas.width, ch = canvas.height;
        const scale = Math.max(cw / iw, ch / ih);
        const sw = iw * scale, sh = ih * scale;
        ctx.drawImage(bgImage, (cw - sw) / 2, (ch - sh) / 2, sw, sh);
    } else {
        const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        bgGrad.addColorStop(0, '#fdf4ff');
        bgGrad.addColorStop(1, '#eef2ff');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (wordPool[currentWordIndex]) {
        const korWord = wordPool[currentWordIndex].answer;
        const cfs = Math.min(Math.max(Math.floor(canvas.width * 0.22), 48), 88);
        ctx.save();
        ctx.globalAlpha = 0.13;
        ctx.fillStyle = '#7c3aed';
        ctx.font = `bold ${cfs}px Jua`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(korWord, canvas.width / 2, canvas.height / 2);
        ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = 0.12;
    bgStars.forEach(s => {
        ctx.font = `${s.size}px serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#7c6fcd';
        ctx.fillText('✦', s.x, s.y);
    });
    ctx.restore();

    decorBricks.forEach(brick => {
        ctx.save();
        if (brick.hp === 1) ctx.globalAlpha = 0.65;
        ctx.shadowBlur = 6; ctx.shadowColor = 'rgba(0,0,0,0.08)';
        ctx.fillStyle = brick.color;
        ctx.strokeStyle = 'rgba(150,130,200,0.3)';
        ctx.lineWidth = 1.5;
        const r = Math.min(10, brick.height / 2);
        const {x, y, width: w, height: h} = brick;
        ctx.beginPath();
        ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
        ctx.quadraticCurveTo(x+w,y,x+w,y+r);
        ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
        ctx.lineTo(x+r,y+h);   ctx.quadraticCurveTo(x,y+h,x,y+h-r);
        ctx.lineTo(x,y+r);     ctx.quadraticCurveTo(x,y,x+r,y);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = brick.hp === 1 ? 0.65 : 1;
        ctx.fillStyle = 'rgba(100,80,160,0.4)';
        ctx.font = `${Math.round(h * 0.6)}px serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(brick.symbol, x + w/2, y + h/2);
        if (brick.hp === 1) {
            ctx.save();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = 'rgba(100,80,160,0.75)';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(x + w*0.38, y + h*0.06);
            ctx.lineTo(x + w*0.55, y + h*0.3);
            ctx.lineTo(x + w*0.40, y + h*0.52);
            ctx.lineTo(x + w*0.60, y + h*0.78);
            ctx.lineTo(x + w*0.45, y + h*0.94);
            ctx.stroke();
            ctx.restore();
        }
        ctx.restore();
    });

    bricks.forEach(brick => {
        ctx.save();
        if (brick.glowTimer < 0) brick.glowTimer++;
        let bFill, bStroke, bTextColor;
        if      (brick.glowTimer > 0) { bFill='#6ee7b7'; bStroke='#4ade80'; brick.glowTimer--; }
        else if (brick.glowTimer < 0) { bFill='#fca5a5'; bStroke='#ef4444'; }
        else if (brick.isCorrect)     { bFill='#e0fdf4'; bStroke='#4ade80'; }
        else                          { bFill='#fff1f2'; bStroke='#fca5a5'; }
        bTextColor = brick.isCorrect ? '#166534' : '#9f1239';
        const wrongFlash = (bFill === '#fca5a5');
        ctx.shadowBlur = 6; ctx.shadowColor = 'rgba(0,0,0,0.08)';
        ctx.fillStyle = bFill; ctx.strokeStyle = bStroke; ctx.lineWidth = 3;
        const {x, y, width: bw, height: bh} = brick;
        const rr = 16;
        ctx.beginPath();
        ctx.moveTo(x+rr,y); ctx.lineTo(x+bw-rr,y);
        ctx.quadraticCurveTo(x+bw,y,x+bw,y+rr);
        ctx.lineTo(x+bw,y+bh-rr); ctx.quadraticCurveTo(x+bw,y+bh,x+bw-rr,y+bh);
        ctx.lineTo(x+rr,y+bh);    ctx.quadraticCurveTo(x,y+bh,x,y+bh-rr);
        ctx.lineTo(x,y+rr);       ctx.quadraticCurveTo(x,y,x+rr,y);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = bTextColor;
        const isHanjaMode = currentMode.startsWith('hanja');
        const baseFontSize = isHanjaMode ? Math.round(bh * 0.65) : Math.round(bh * 0.42);
        const textLen = brick.text.length;
        let fontSize = baseFontSize;
        if (!isHanjaMode) {
            if (textLen > 10)     fontSize = Math.round(baseFontSize * 0.55);
            else if (textLen > 7) fontSize = Math.round(baseFontSize * 0.7);
            else if (textLen > 5) fontSize = Math.round(baseFontSize * 0.85);
        }
        ctx.font = `bold ${fontSize}px Jua`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const textY = wrongFlash ? y + bh*0.35 : y + bh/2;
        ctx.fillText(truncateBrickText(brick.text), x + bw/2, textY);
        if (wrongFlash && brick.koreanText) {
            ctx.fillStyle = '#9f1239';
            ctx.font = `bold ${Math.round(bh * 0.24)}px Jua`;
            ctx.fillText(brick.koreanText, x + bw/2, y + bh*0.72);
        }
        if (!brick.isCorrect && brick.hp < 3) {
            const isHanja = currentMode.startsWith('hanja');
            if (isHanja) {
                ctx.save();
                const fadeAlpha = brick.hp === 2 ? 0.15 : 0.35;
                ctx.fillStyle = `rgba(0,0,0,${fadeAlpha})`;
                ctx.beginPath();
                ctx.roundRect(x, y, bw, bh, 16);
                ctx.fill();
                ctx.restore();
            } else {
                ctx.save();
                const crackColor = brick.hp === 2 ? 'rgba(239,68,68,0.55)' : 'rgba(239,68,68,0.9)';
                const crackWidth = brick.hp === 2 ? 1.5 : 2.5;
                ctx.strokeStyle = crackColor;
                ctx.lineWidth = crackWidth;
                if (brick.hp === 2) {
                    ctx.beginPath();
                    ctx.moveTo(x + bw*0.35, y + bh*0.08);
                    ctx.lineTo(x + bw*0.55, y + bh*0.28);
                    ctx.lineTo(x + bw*0.38, y + bh*0.48);
                    ctx.lineTo(x + bw*0.58, y + bh*0.72);
                    ctx.lineTo(x + bw*0.42, y + bh*0.92);
                    ctx.stroke();
                } else if (brick.hp === 1) {
                    ctx.beginPath();
                    ctx.moveTo(x + bw*0.25, y + bh*0.05);
                    ctx.lineTo(x + bw*0.45, y + bh*0.28);
                    ctx.lineTo(x + bw*0.28, y + bh*0.52);
                    ctx.lineTo(x + bw*0.48, y + bh*0.78);
                    ctx.lineTo(x + bw*0.32, y + bh*0.95);
                    ctx.moveTo(x + bw*0.65, y + bh*0.08);
                    ctx.lineTo(x + bw*0.78, y + bh*0.32);
                    ctx.lineTo(x + bw*0.62, y + bh*0.55);
                    ctx.lineTo(x + bw*0.80, y + bh*0.82);
                    ctx.stroke();
                    ctx.fillStyle = 'rgba(0,0,0,0.1)';
                    ctx.beginPath();
                    ctx.roundRect(x, y, bw, bh, 16);
                    ctx.fill();
                }
                ctx.restore();
            }
        }
        if (!brick.isCorrect && brick.glowTimer < -50 && brick.glowTimer > -60) {
            brick.shakeOffset = (Math.random() - 0.5) * 4;
        } else {
            brick.shakeOffset = 0;
        }
        ctx.restore();
    });

    ctx.save();
    const {x:px,y:py,width:pw,height:ph} = paddle;
    if (paddleImageLoaded && paddleImage) {
        ctx.shadowBlur=10; ctx.shadowColor='rgba(196,181,253,0.7)';
        ctx.drawImage(paddleImage, px, py, pw, ph);
        ctx.shadowBlur=0;
    } else {
        const pg = ctx.createLinearGradient(px, py, px+pw, py+ph);
        pg.addColorStop(0,'#c4b5fd'); pg.addColorStop(1,'#7c6fcd');
        ctx.shadowBlur=10; ctx.shadowColor='#c4b5fd';
        ctx.fillStyle=pg; ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.lineWidth=2;
        const prad=ph/2;
        ctx.beginPath();
        ctx.moveTo(px+prad,py); ctx.lineTo(px+pw-prad,py);
        ctx.quadraticCurveTo(px+pw,py,px+pw,py+prad);
        ctx.quadraticCurveTo(px+pw,py+ph,px+pw-prad,py+ph);
        ctx.lineTo(px+prad,py+ph); ctx.quadraticCurveTo(px,py+ph,px,py+prad);
        ctx.quadraticCurveTo(px,py,px+prad,py);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.shadowBlur=0;
        ctx.font=`${Math.round(ph*1.3)}px serif`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('🐻', px+pw/2, py+ph/2);
    }
    ctx.restore();

    ctx.save();
    ctx.shadowBlur=12; ctx.shadowColor='#f9a8d4';
    const ballGrad = ctx.createRadialGradient(ball.x-5,ball.y-5,2,ball.x,ball.y,ball.radius);
    ballGrad.addColorStop(0,'#ffffff');
    ballGrad.addColorStop(0.5,'#f9a8d4');
    ballGrad.addColorStop(1,'#ec4899');
    ctx.fillStyle=ballGrad;
    ctx.beginPath(); ctx.arc(ball.x,ball.y,ball.radius,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=2; ctx.stroke();
    ctx.shadowBlur=0;
    ctx.restore();

    particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha=p.alpha; ctx.fillStyle=p.color;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.radius,0,Math.PI*2); ctx.fill();
        ctx.restore();
    });
}

// ==================== COMPONENT ====================
export default function WordGamePage() {
    const { setCurrentPage, currentPage } = useApp();
    const [hasSave, setHasSave] = useState(() => !!localStorage.getItem('wordgame_save'));
    const enInputRef = useRef(null);
    const koInputRef = useRef(null);
    const translateStatusRef = useRef(null);
    const debounceTimerRef = useRef(null);
    const reqSeqRef = useRef(0);
    const koUserEditedRef = useRef(false);

    const translateAndFill = async () => {
        console.log('번역 시작');
        const enInput = enInputRef.current;
        const koInput = koInputRef.current;
        const status  = translateStatusRef.current;
        if (!enInput || !koInput || !status) return;
        const word = enInput.value.trim();
        if (!word) return;
        status.textContent = '번역 중...';
        status.style.color = '#7c6fcd';
        try {
            const functions = getFunctions(app, 'us-central1');
            const translateWord = httpsCallable(functions, 'translateWord');
            const result = await translateWord({ text: word });
            koInput.value = result.data.translated;
            status.textContent = '✅ 번역 완료!';
            status.style.color = '#16a34a';
            koInput.focus();
        } catch (e) {
            console.error('[translateAndFill] Firebase Functions 호출 실패:', e);
            status.textContent = '번역 실패. 직접 입력해주세요.';
            status.style.color = '#ef4444';
        }
    };

    const onEnChange = () => {
        const word = enInputRef.current?.value.trim();
        clearTimeout(debounceTimerRef.current);
        // ko가 비어있으면 사용자 편집 플래그 초기화 (addCustomWord 후 필드 클리어 대응)
        if (!koInputRef.current?.value) koUserEditedRef.current = false;
        if (!word) return;
        if (koUserEditedRef.current) return;
        debounceTimerRef.current = setTimeout(async () => {
            const koInput = koInputRef.current;
            const status = translateStatusRef.current;
            if (!koInput || !status) return;
            if (koUserEditedRef.current) return;
            const seq = ++reqSeqRef.current;
            const originalPlaceholder = koInput.placeholder;
            koInput.placeholder = '번역중...';
            status.textContent = '번역 중...';
            status.style.color = '#7c6fcd';
            try {
                const functions = getFunctions(app, 'us-central1');
                const translateWord = httpsCallable(functions, 'translateWord');
                const result = await translateWord({ text: word });
                if (seq !== reqSeqRef.current) return;
                koInput.value = result.data.translated;
                koUserEditedRef.current = false;
                status.textContent = '✅ 번역 완료!';
                status.style.color = '#16a34a';
            } catch (e) {
                if (seq !== reqSeqRef.current) return;
                status.textContent = '번역 실패. 직접 입력해주세요.';
                status.style.color = '#ef4444';
            } finally {
                if (koInputRef.current) koInputRef.current.placeholder = originalPlaceholder;
            }
        }, 800);
    };

    useEffect(() => {
        canvas = document.getElementById('game-canvas');
        ctx = canvas.getContext('2d');
        preloadGameImages();
        window.firebaseApp = firebaseApp;
        window.removeCustomWord = removeCustomWord;
        loadCustomWords();

        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: true });

        // 컨테이너 크기가 변할 때마다 캔버스 재조정 (display:none → visible 전환 포함)
        let ro;
        if (window.ResizeObserver && canvas.parentElement) {
            ro = new ResizeObserver(() => {
                if (canvas && canvas.parentElement &&
                    canvas.parentElement.clientWidth > 0 &&
                    canvas.parentElement.clientHeight > 0) {
                    resizeCanvas();
                }
            });
            ro.observe(canvas.parentElement);
        }

        window._wgSetHasSave = setHasSave;
        return () => {
            if (isPlaying) saveGameState();
            isPlaying = false;
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', resizeCanvas);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            if (Capacitor.isNativePlatform()) TextToSpeech.stop();
            else if (window.speechSynthesis) window.speechSynthesis.cancel();
            if (ro) ro.disconnect();
            clearTimeout(debounceTimerRef.current);
            window._wgSetHasSave = null;
            canvas = null;
            ctx = null;
        };
    }, []);

    // 페이지가 보여질 때 캔버스 크기를 다시 계산 (초기 마운트 시 display:none 으로 0이었던 것을 보정)
    useEffect(() => {
        if (currentPage === 'wordgame' && canvas) {
            requestAnimationFrame(() => requestAnimationFrame(resizeCanvas));
        }
    }, [currentPage]);

    const btn = (bg, extra) => ({
        width:'100%', padding:'14px 20px', borderRadius:16, border:'none', cursor:'pointer',
        fontSize:17, fontWeight:700, color:'#fff', display:'block', marginBottom:10,
        background:bg, fontFamily:'inherit', ...extra,
    });

    return (
        <div className="page" style={{
            background:'linear-gradient(to bottom,#fef3f8,#f0f4ff)',
            overflowY:'hidden',
            fontFamily:"'Jua','Malgun Gothic',sans-serif",
            userSelect:'none',
        }}>
            {/* 게임 영역 — 네브바 위까지 */}
            <div style={{
                flex:1, position:'relative', overflow:'hidden', minHeight:0,
                margin:'8px',
                borderRadius:24,
                background:'rgba(255,255,255,0.75)',
                border:'1.5px solid #e9d5ff',
                boxShadow:'0 4px 20px rgba(124,111,205,0.12)',
            }}>

                {/* 캔버스 — 가장 아래 레이어 */}
                <canvas id="game-canvas"
                        style={{display:'block',position:'absolute',top:0,left:0,width:'100%',height:'100%',zIndex:0}} />

                {/* HUD — 항상 flex, 시작화면에 의해 가려짐 */}
                <div id="canvas-hud"
                     style={{display:'flex',position:'absolute',top:0,left:0,right:0,height:'calc(44px + env(safe-area-inset-top))',zIndex:10,
                             background:'rgba(255,255,255,0.9)',alignItems:'center',
                             justifyContent:'space-between',padding:'env(safe-area-inset-top) 4px 0 0',pointerEvents:'none'}}>
                    <button onClick={() => setCurrentPage('main')}
                            style={{pointerEvents:'auto',background:'none',border:'none',cursor:'pointer',
                                    minWidth:44,minHeight:44,display:'flex',alignItems:'center',justifyContent:'center',
                                    fontSize:20,color:'#7c3aed',fontWeight:700,fontFamily:'inherit',flexShrink:0}}>
                        ←
                    </button>
                    <span style={{fontSize:11,color:'#7c6fcd',fontWeight:700,display:'flex',alignItems:'center',gap:3,flex:1}}>
                        <span id="hearts-container" style={{fontSize:11}}>❤️❤️❤️</span>
                    </span>
                    <span id="canvas-combo" style={{fontSize:11,color:'#d97706',fontWeight:700,flex:1,textAlign:'center',visibility:'hidden'}}></span>
                    <span id="canvas-score" style={{fontSize:12,color:'#7c6fcd',fontWeight:700,flex:1,textAlign:'right',paddingRight:8}}>SCORE: 0</span>
                </div>

                {/* 시작 화면 — 초기 표시, HUD 위를 덮음 */}
                <div id="start-screen" className="g-overlay"
                     style={{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:11,
                             background:'rgba(255,255,255,0.97)',padding:24,textAlign:'center',
                             overflowY:'auto'}}>
                    <button onClick={() => setCurrentPage('main')}
                            style={{position:'absolute',top:12,left:12,background:'rgba(124,99,205,0.12)',
                                    border:'1.5px solid #c4b5fd',borderRadius:12,padding:'8px 16px',
                                    fontSize:14,color:'#7c3aed',fontWeight:700,
                                    cursor:'pointer',fontFamily:'inherit'}}>
                        ← 나가기
                    </button>
                    <div style={{fontSize:52,marginBottom:8}}>🐻⭐🐻</div>
                    <h2 style={{fontSize:26,fontWeight:700,color:'#7c6fcd',marginBottom:8}}>신나는 단어 깨기!</h2>
                    <p style={{fontSize:13,color:'#6b7280',marginBottom:20,lineHeight:1.6}}>
                        한글 뜻이 쓰인 공을 튕겨서<br/>
                        위쪽에 있는 <strong style={{color:'#16a34a'}}>올바른 영어 블록</strong>에 부딪치세요!<br/>
                        <span style={{color:'#ec4899'}}>🎯 5번 "딩동!"</span> 맞추면 퀴즈 타임!
                    </p>
                    {hasSave && (
                        <div style={{width:'100%',maxWidth:300,marginBottom:16}}>
                            <p style={{fontSize:13,color:'#7c6fcd',fontWeight:700,marginBottom:10}}>🕹️ 저장된 게임이 있어요!</p>
                            <button onClick={() => { resumeGame(); setHasSave(false); }}
                                    style={btn('linear-gradient(135deg,#4ade80,#16a34a)')}>
                                ▶ 이어하기
                            </button>
                            <button onClick={() => { localStorage.removeItem('wordgame_save'); setHasSave(false); }}
                                    style={btn('linear-gradient(135deg,#d1d5db,#9ca3af)',{marginBottom:0})}>
                                처음부터 하기
                            </button>
                        </div>
                    )}
                    <div id="subject-select" style={{width:'100%',maxWidth:300,marginBottom:20,display:hasSave?'none':undefined}}>
                        <button onClick={() => showGradeSelect('english')} style={btn('linear-gradient(135deg,#93c5fd,#3b82f6)')}>🇬🇧 영어 단어장</button>
                        <button onClick={() => showGradeSelect('hanja')}   style={btn('linear-gradient(135deg,#86efac,#22c55e)')}>🇨🇳 한자 단어장</button>
                        <button onClick={showCustomWordList}                style={btn('linear-gradient(135deg,#f9a8d4,#ec4899)',{marginBottom:0})}>✏️ 내가 만든 단어장</button>
                    </div>
                    <div id="grade-select" className="hidden g-col"
                         style={{width:'100%',maxWidth:300,marginBottom:20}}>
                        <button onClick={goBackToSubject}
                                style={{padding:'8px 16px',borderRadius:12,border:'none',cursor:'pointer',
                                        fontSize:13,fontWeight:700,color:'#6b7280',background:'#f3f4f6',
                                        marginBottom:8,fontFamily:'inherit'}}>
                            ← 뒤로가기
                        </button>
                        <p id="grade-select-title" style={{fontSize:14,fontWeight:700,color:'#7c6fcd',marginBottom:8}}></p>
                        <button id="grade-btn-1" style={btn('linear-gradient(135deg,#fda4af,#fb7185)')}>🌱 1~2학년</button>
                        <button id="grade-btn-2" style={btn('linear-gradient(135deg,#86efac,#4ade80)')}>🌿 3~4학년</button>
                        <button id="grade-btn-3" style={btn('linear-gradient(135deg,#93c5fd,#60a5fa)',{marginBottom:0})}>🌳 5~6학년</button>
                    </div>
                    <p style={{fontSize:12,color:'#9ca3af'}}>마우스, 터치, 또는 키보드 [←][→]로 바를 움직여요!</p>
                </div>

                {/* word-clear-banner */}
                <div id="word-clear-banner" className="hidden g-row"
                     style={{position:'absolute',top:'50%',left:0,right:0,
                             transform:'translateY(-50%)',justifyContent:'center',
                             pointerEvents:'none',zIndex:12}}>
                    <span style={{fontSize:24,fontWeight:700,padding:'8px 20px',borderRadius:999,
                                  boxShadow:'0 4px 20px rgba(0,0,0,0.15)',background:'#fde68a',color:'#7c6fcd'}}>
                        ✨ WORD MASTERED! ✨
                    </span>
                </div>

                {/* quiz-overlay */}
                <div id="quiz-overlay" className="hidden g-overlay"
                     style={{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:30,
                             background:'rgba(255,255,255,0.97)',padding:24,textAlign:'center'}}>
                    <div style={{fontSize:40,marginBottom:8}}>🎯</div>
                    <h3 style={{fontSize:20,fontWeight:700,color:'#7c6fcd',marginBottom:4}}>퀴즈 타임!</h3>
                    <p style={{fontSize:12,color:'#9ca3af',marginBottom:12}}>아래 한글 뜻에 맞는 영어를 골라봐요</p>
                    <p id="quiz-question" style={{fontSize:28,fontWeight:700,color:'#374151',marginBottom:20}}></p>
                    <div id="quiz-choices" style={{width:'100%',maxWidth:300,marginBottom:16}}></div>
                    <div id="quiz-result" style={{fontSize:20,fontWeight:700,minHeight:32}}></div>
                </div>

                {/* daily-complete-screen */}
                <div id="daily-complete-screen" className="hidden g-overlay"
                     style={{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:20,
                             background:'rgba(255,255,255,0.97)',padding:24,textAlign:'center',
                             overflowY:'auto'}}>
                    <div style={{fontSize:52,marginBottom:16}}>🌟🎊🌟</div>
                    <h3 style={{fontSize:26,fontWeight:700,color:'#7c6fcd',marginBottom:4}}>오늘의 단어 깨기 완료!</h3>
                    <p style={{fontSize:13,color:'#6b7280',marginBottom:20}}>열심히 공부했어요! 정말 대단해요!</p>
                    <div style={{borderRadius:16,padding:20,width:'100%',maxWidth:280,marginBottom:20,
                                 background:'#f5f3ff',border:'1.5px solid #ddd6fe'}}>
                        <div style={{fontSize:13,color:'#9ca3af',marginBottom:4}}>오늘 마스터한 단어</div>
                        <div style={{display:'flex',alignItems:'flex-end',justifyContent:'center',gap:4,marginBottom:12}}>
                            <span id="daily-complete-mastered" style={{fontSize:48,fontWeight:700,color:'#7c6fcd',lineHeight:1}}>0</span>
                            <span style={{fontSize:16,color:'#9ca3af',marginBottom:4}}>개</span>
                        </div>
                        <div style={{borderTop:'1px solid #ede9fe',margin:'0 0 10px'}}></div>
                        <div style={{fontSize:13,color:'#9ca3af',marginBottom:4}}>최종 점수</div>
                        <div id="daily-complete-score" style={{fontSize:28,fontWeight:700,color:'#ec4899'}}>0</div>
                    </div>
                    <p style={{fontSize:13,color:'#9ca3af',marginBottom:16}}>🌙 내일 또 도전해요!</p>
                    <button onClick={resetToMenu} style={btn('linear-gradient(135deg,#c4b5fd,#7c6fcd)',{maxWidth:280,marginBottom:0})}>
                        메인 메뉴로 가기 🏠
                    </button>
                </div>

                {/* custom-word-screen */}
                <div id="custom-word-screen" className="hidden g-col"
                     style={{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:11,
                             background:'rgba(255,255,255,0.97)'}}>
                    <div style={{padding:'12px 16px 8px',paddingTop:'env(safe-area-inset-top)',borderBottom:'1px solid #ede9fe',flexShrink:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                            <button onClick={() => {
                                        goBackToSubject();
                                        document.getElementById('custom-word-screen').classList.add('hidden');
                                        document.getElementById('start-screen').classList.remove('hidden');
                                    }}
                                    style={{padding:'4px 12px',borderRadius:12,border:'none',cursor:'pointer',
                                            fontSize:13,fontWeight:700,color:'#6b7280',background:'#f3f4f6',
                                            fontFamily:'inherit'}}>
                                ← 뒤로
                            </button>
                            <h2 style={{fontSize:17,fontWeight:700,color:'#7c6fcd'}}>✏️ 내가 만든 단어장</h2>
                        </div>
                        <div style={{borderRadius:16,padding:12,background:'#f5f3ff',border:'1.5px solid #ddd6fe'}}>
                            <div style={{display:'flex',gap:8,marginBottom:8}}>
                                <div style={{flex:1}}>
                                    <input ref={enInputRef} id="new-word-en" type="text" placeholder="영어 단어 (예: apple)"
                                           style={{width:'100%',borderRadius:12,padding:'8px 12px',fontSize:13,
                                                   border:'1px solid #ddd6fe',marginBottom:6,display:'block',
                                                   fontFamily:'inherit',boxSizing:'border-box'}}
                                           onChange={onEnChange}
                                           onKeyDown={e => e.key==='Enter' && translateAndFill()} />
                                    <input ref={koInputRef} id="new-word-ko" type="text" placeholder="한글 뜻 (자동입력 또는 직접)"
                                           style={{width:'100%',borderRadius:12,padding:'8px 12px',fontSize:13,
                                                   border:'1px solid #ddd6fe',display:'block',
                                                   fontFamily:'inherit',boxSizing:'border-box'}}
                                           onChange={e => { koUserEditedRef.current = e.target.value.length > 0; }}
                                           onKeyDown={e => e.key==='Enter' && addCustomWord()} />
                                </div>
                                <div style={{display:'flex',flexDirection:'column',gap:4,justifyContent:'center'}}>
                                    <button onClick={translateAndFill}
                                            style={{padding:'8px 10px',borderRadius:12,border:'none',cursor:'pointer',
                                                    fontSize:12,fontWeight:700,color:'#fff',whiteSpace:'nowrap',
                                                    background:'linear-gradient(135deg,#93c5fd,#3b82f6)',fontFamily:'inherit'}}>
                                        번역🔄
                                    </button>
                                    <button onClick={addCustomWord}
                                            style={{padding:'8px 10px',borderRadius:12,border:'none',cursor:'pointer',
                                                    fontSize:12,fontWeight:700,color:'#fff',whiteSpace:'nowrap',
                                                    background:'linear-gradient(135deg,#86efac,#22c55e)',fontFamily:'inherit'}}>
                                        추가✚
                                    </button>
                                </div>
                            </div>
                            <p ref={translateStatusRef} id="translate-status" style={{fontSize:12,color:'#7c6fcd',minHeight:14}}></p>
                        </div>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:8}}>
                            <p style={{fontSize:13,fontWeight:700,color:'#374151'}}>
                                단어 목록 <span id="word-count" style={{color:'#7c6fcd'}}>0</span>/30
                            </p>
                            <p style={{fontSize:12,color:'#9ca3af'}}>최소 10개 이상이면 게임 시작!</p>
                        </div>
                    </div>
                    <div id="custom-word-list" style={{flex:1,overflowY:'auto',padding:'8px 16px'}}></div>
                    <div style={{padding:'8px 16px 12px',paddingBottom:'env(safe-area-inset-bottom)',borderTop:'1px solid #ede9fe',flexShrink:0}}>
                        <button id="start-custom-game-btn" onClick={() => startGame('custom')}
                                style={{width:'100%',padding:14,borderRadius:16,border:'none',cursor:'pointer',
                                        fontSize:17,fontWeight:700,color:'#fff',opacity:0.4,
                                        background:'linear-gradient(135deg,#f9a8d4,#ec4899)',fontFamily:'inherit'}}>
                            🎮 게임 시작! (10개 이상 필요)
                        </button>
                    </div>
                </div>

                {/* game-over-screen */}
                <div id="game-over-screen" className="hidden g-overlay"
                     style={{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:20,
                             background:'rgba(255,255,255,0.95)',padding:24,textAlign:'center'}}>
                    <div style={{fontSize:48,marginBottom:16}}>😢</div>
                    <h3 style={{fontSize:26,fontWeight:700,color:'#ec4899',marginBottom:8}}>아쉽게 기회를 다 썼어요!</h3>
                    <p style={{fontSize:13,color:'#6b7280',marginBottom:20}}>포기하지 말고 다시 도전해 봐요!</p>
                    <div style={{borderRadius:16,padding:16,width:'100%',maxWidth:280,marginBottom:20,
                                 background:'#f5f3ff',border:'1.5px solid #ddd6fe'}}>
                        <div style={{fontSize:13,color:'#9ca3af'}}>최종 점수</div>
                        <div id="final-score" style={{fontSize:28,fontWeight:700,color:'#7c6fcd',marginBottom:8}}>0</div>
                        <div style={{fontSize:12,color:'#9ca3af'}}>오늘 마스터한 단어: <span id="mastered-count" style={{fontWeight:700,color:'#16a34a'}}>0</span>개</div>
                    </div>
                    <button onClick={resetToMenu} style={btn('linear-gradient(135deg,#c4b5fd,#7c6fcd)',{maxWidth:280,marginBottom:0})}>
                        메인 메뉴로 가기 🏠
                    </button>
                </div>

                {/* game-clear-screen */}
                <div id="game-clear-screen" className="hidden g-overlay"
                     style={{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:20,
                             background:'rgba(255,255,255,0.97)',padding:24,textAlign:'center'}}>
                    <div style={{fontSize:52,marginBottom:16}}>👑🏆👑</div>
                    <h3 style={{fontSize:26,fontWeight:700,color:'#7c6fcd',marginBottom:8}}>대단해요! 단어 왕 등극!</h3>
                    <p style={{fontSize:13,color:'#16a34a',marginBottom:24}}>준비된 모든 단어를 완벽 마스터!</p>
                    <button onClick={resetToMenu} style={btn('linear-gradient(135deg,#86efac,#4ade80)',{maxWidth:280,marginBottom:0})}>
                        다시 놀기 🕹️
                    </button>
                </div>

            </div>
        </div>
    );
}

import React, { useState, useEffect, useMemo } from 'react';
import {
  Compass, BookOpen, Wallet, CalendarDays, Sparkles,
  Plus, Trash2, Check, X, RefreshCw, ArrowRightLeft,
  Plane, MapPin, Sun, Mountain, Coffee, Edit3, Save,
  ChevronRight, GraduationCap, Languages, RotateCcw, User,
  Flame, Pencil, FileText, GripVertical
} from 'lucide-react';
import {
  DndContext, closestCorners, KeyboardSensor, PointerSensor,
  TouchSensor, useSensor, useSensors
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { initSync, syncStorage, subscribeRemoteChanges, refreshNow } from './lib/syncStorage';
import PullToRefresh from 'pulltorefreshjs';
import { getLinkedEmail, attachEmailToCurrentSession, sendOtpCode, verifyOtpCode, isAnonymous, getRememberedEmail } from './lib/supabase';
import { parseDiaryMarkdown, diaryToPhrases } from './lib/parseDiary';

// ============================================================
//  스토리지 — localStorage + Supabase 동기화 (lib/syncStorage)
//  Supabase 미설정 시 localStorage로만 작동 (fallback)
// ============================================================
const storage = syncStorage;

// ============================================================
//  데이터: 영어 학습 카드 (바기오 어학연수 맞춤)
// ============================================================
const STARTER_PHRASES = [
  { cat: '교실', en: "Could you say that again, please?", ko: "다시 한번 말씀해 주시겠어요?" },
  { cat: '교실', en: "I'm not sure I understand.", ko: "잘 이해가 안 됐어요." },
  { cat: '교실', en: "How do you spell that?", ko: "스펠링이 어떻게 되나요?" },
  { cat: '교실', en: "What does '___' mean?", ko: "'___'가 무슨 뜻이에요?" },
  { cat: '교실', en: "Can we move on to the next topic?", ko: "다음 주제로 넘어가도 될까요?" },
  { cat: '식당', en: "Could I see the menu, please?", ko: "메뉴 좀 볼 수 있을까요?" },
  { cat: '식당', en: "Not too spicy, please.", ko: "너무 맵지 않게 해주세요." },
  { cat: '식당', en: "Can I have the bill?", ko: "계산서 주세요." },
  { cat: '식당', en: "Is this dish good for vegetarians?", ko: "이 요리 채식주의자도 먹을 수 있나요?" },
  { cat: '교통', en: "How much to Session Road?", ko: "세션로드까지 얼마예요?" },
  { cat: '교통', en: "Please drop me off here.", ko: "여기서 내려주세요." },
  { cat: '교통', en: "Bayad po. (지프니에서 요금 낼 때)", ko: "요금이요. (필리핀 표현)" },
  { cat: '쇼핑', en: "Can you give me a discount?", ko: "할인해 주실 수 있나요?" },
  { cat: '쇼핑', en: "Do you accept GCash?", ko: "지캐시 받으세요?" },
  { cat: '일상', en: "Where can I find an ATM?", ko: "ATM이 어디 있어요?" },
  { cat: '일상', en: "Is the water safe to drink?", ko: "물 마셔도 괜찮나요?" },
  { cat: '필리핀어', en: "Salamat / Salamat po", ko: "감사합니다 (po는 정중한 표현)" },
  { cat: '필리핀어', en: "Magkano?", ko: "얼마예요?" },
  { cat: '필리핀어', en: "Kuya / Ate", ko: "오빠·형 / 누나·언니 (호칭)" },
];

const STARTER_CHECKLIST = [
  // 도착 첫날
  { id: 'seed-1', text: '어학원 체크인', done: false, group: '오늘', order: 0, completedAt: null },
  { id: 'seed-2', text: '기숙사 도착 신고', done: false, group: '오늘', order: 1, completedAt: null },
  { id: 'seed-3', text: '오리엔테이션 참석', done: false, group: '오늘', order: 2, completedAt: null },
  { id: 'seed-4', text: '심카드 + GCash 개설', done: false, group: '오늘', order: 3, completedAt: null },
  { id: 'seed-5', text: '레벨 테스트 준비', done: false, group: '과제', order: 0, completedAt: null },
  // 출발 전 (내일 출국)
  { id: 'seed-6', text: '여권 + 비자 서류 확인', done: false, group: '준비', order: 0, completedAt: null },
  { id: 'seed-7', text: '돼지코 (220V 어댑터)', done: false, group: '준비', order: 1, completedAt: null },
  { id: 'seed-8', text: '긴팔 자켓 (바기오 서늘함)', done: false, group: '준비', order: 2, completedAt: null },
  { id: 'seed-9', text: '상비약 (해열·소화·지사제)', done: false, group: '준비', order: 3, completedAt: null },
];

// ============================================================
//  데이터: 동기부여 문장 — 날짜 기반 회전
//  (영화 명대사 / 미국 속담 / 명언 / 따뜻한 한 줄 믹스)
// ============================================================
const MOTIVATIONS = [
  // 영화 / 픽션
  { en: "The cave you fear to enter holds the treasure you seek.", ko: "들어가기 두려운 동굴에 네가 찾는 보물이 있다.", src: "Joseph Campbell" },
  { en: "Just keep swimming.", ko: "그냥 계속 헤엄쳐.", src: "Finding Nemo" },
  { en: "Do, or do not. There is no try.", ko: "하라, 아니면 하지 마라. 시도란 없다.", src: "Yoda" },
  { en: "You miss 100% of the shots you don't take.", ko: "쏘지 않은 슛은 100% 빗나간다.", src: "Wayne Gretzky" },
  { en: "Today, well lived, makes every yesterday a dream and every tomorrow a vision of hope.", ko: "오늘 하루를 잘 살면, 어제는 꿈이 되고 내일은 희망의 풍경이 된다.", src: "Sanskrit proverb" },
  { en: "It always seems impossible until it's done.", ko: "끝내고 나면 불가능해 보이지 않는다.", src: "Nelson Mandela" },
  { en: "Today is a gift. That's why it's called the present.", ko: "오늘은 선물이다. 그래서 'present'라 부른다.", src: "Kung Fu Panda" },
  { en: "Adventure is out there.", ko: "모험은 저 바깥에 있어.", src: "Up" },
  { en: "Stories with happy endings just haven't reached the end yet.", ko: "해피엔딩으로 끝나는 이야기는 아직 끝나지 않았을 뿐이다.", src: "—" },
  { en: "Not all those who wander are lost.", ko: "방황하는 모두가 길을 잃은 건 아니다.", src: "Tolkien" },

  // 영어 학습 / 시작 / 인내
  { en: "A journey of a thousand miles begins with a single step.", ko: "천 리 길도 한 걸음부터.", src: "Lao Tzu" },
  { en: "Fall seven times, stand up eight.", ko: "일곱 번 넘어지면 여덟 번 일어나라.", src: "Japanese proverb" },
  { en: "Slow and steady wins the race.", ko: "느려도 꾸준한 자가 이긴다.", src: "Aesop" },
  { en: "Practice doesn't make perfect. Perfect practice makes perfect.", ko: "연습이 완벽을 만드는 게 아니다. 제대로 된 연습이 완벽을 만든다.", src: "Vince Lombardi" },
  { en: "The expert in anything was once a beginner.", ko: "모든 전문가는 한때 초보였다.", src: "Helen Hayes" },
  { en: "If you want to go fast, go alone. If you want to go far, go together.", ko: "빨리 가려면 혼자, 멀리 가려면 함께.", src: "African proverb" },
  { en: "Don't count the days. Make the days count.", ko: "날짜를 세지 말고, 날들이 의미를 갖게 하라.", src: "Muhammad Ali" },
  { en: "Action is the antidote to despair.", ko: "행동은 절망의 해독제다.", src: "Joan Baez" },
  { en: "What you do today can improve all your tomorrows.", ko: "오늘 한 일이 모든 내일을 바꾼다.", src: "Ralph Marston" },
  { en: "Tough times never last, but tough people do.", ko: "힘든 시기는 지나가지만, 단단한 사람은 남는다.", src: "Robert Schuller" },

  // 따뜻한 한 줄 / 응원
  { en: "Wherever you go, go with all your heart.", ko: "어디로 가든, 온 마음으로 가라.", src: "Confucius" },
  { en: "The best way out is always through.", ko: "벗어나는 가장 좋은 길은 언제나 통과하는 것.", src: "Robert Frost" },
  { en: "You are braver than you believe, stronger than you seem, and smarter than you think.", ko: "너는 생각보다 용감하고, 보이는 것보다 강하며, 스스로 아는 것보다 똑똑하다.", src: "Christopher Robin" },
  { en: "Bloom where you are planted.", ko: "심긴 곳에서 꽃 피워라.", src: "Saint Francis" },
  { en: "Every accomplishment starts with the decision to try.", ko: "모든 성취는 해보겠다는 결심에서 시작된다.", src: "John F. Kennedy" },
  { en: "Be the change you wish to see in the world.", ko: "네가 세상에서 보고 싶은 변화, 네가 되어라.", src: "Gandhi" },
  { en: "Today's accomplishments were yesterday's impossibilities.", ko: "오늘의 성취는 어제의 불가능이었다.", src: "Robert H. Schuller" },
  { en: "The future belongs to those who believe in the beauty of their dreams.", ko: "미래는 자신의 꿈의 아름다움을 믿는 사람의 것이다.", src: "Eleanor Roosevelt" },
  { en: "Small steps every day.", ko: "매일, 작은 한 걸음씩.", src: "—" },
  { en: "Yesterday is history, tomorrow is a mystery, today is a gift.", ko: "어제는 역사, 내일은 미스터리, 오늘은 선물.", src: "Bil Keane" },
];

const STARTER_SCHEDULE = [];

// 사용자(Ryan)의 실제 화요일 시간표 — LEAP 프로그램.
// 어학원에서 받은 종이 시간표 그대로. 다른 요일은 받으면 추가.
const RYAN_TUE_SCHEDULE = [
  { day: 'tue', time: '08:00', endTime: '08:45', subject: 'DISC GROUP', teacher: '', room: 'G103', floor: 'B5' },
  { day: 'tue', time: '08:55', endTime: '09:40', subject: 'WRI GROUP', teacher: '', room: 'G103', floor: 'B5' },
  { day: 'tue', time: '09:50', endTime: '10:35', subject: 'PRO GROUP', teacher: '', room: 'B6 LIBRARY', floor: 'B6' },
  { day: 'tue', time: '10:45', endTime: '11:30', subject: 'ECD (E INT 1)', teacher: '', room: 'M309', floor: 'B7' },
  { day: 'tue', time: '11:40', endTime: '12:25', subject: 'MARKET LEADER', teacher: '', room: 'G306', floor: 'B7' },
  { day: 'tue', time: '13:30', endTime: '14:15', subject: 'CBE BOOK 2', teacher: '', room: 'M311', floor: 'B7' },
  { day: 'tue', time: '14:25', endTime: '15:10', subject: 'CBE BOOK 1', teacher: '', room: 'G309', floor: 'B7' },
  { day: 'tue', time: '15:20', endTime: '16:05', subject: 'GRAMMAR', teacher: '', room: 'G103', floor: 'B5' },
  { day: 'tue', time: '16:15', endTime: '17:00', subject: 'BE PRE-JOB INT', teacher: '', room: 'G301', floor: 'B7' },
];

const STARTER_ROUTINES = [
  { id: 'r-seed-1', name: '단어 20개 외우기', history: {} },
  { id: 'r-seed-2', name: '쉐도잉 10분', history: {} },
  { id: 'r-seed-3', name: '영어 일기 쓰기', history: {} },
];

// ============================================================
//  데이터: 샘플 일기 — 사용자의 실제 5/17 도착 일기
// ============================================================
const STARTER_DIARIES = [
  {
    id: 'diary-seed-1',
    date: '2026-05-17',
    title: '바기오에 도착하다',
    paragraphs: [
      {
        ko: '어제 5월16일 밤 9시 비행기를 타고, 클락공항에 새벽 12시가 넘어 도착했다. 새벽 1시30분에 셔틀을 타고 Monol 어학원에 도착했을때는 새벽 4시쯤이었다.',
        en: 'I took a 9 PM flight on May 16th and arrived at Clark Airport past midnight. I got on a shuttle at 1:30 AM and finally made it to Monol Language Academy around 4 AM.',
      },
      {
        ko: '오면서 참 많은 생각들이 들었다. 여기에 온 내 또래 어른들은 뭐하는 사람들일까? 무슨 생각과 어떤 사정때문에 이곳에 왔을까? 나도 그들이 보기에 궁금하겠지?',
        en: "So many thoughts crossed my mind on the way here. I wonder what the other adults my age do for a living. What's going through their heads, and what circumstances brought them here? I bet they're curious about me too.",
      },
      {
        ko: '산 깊은 곳에 위치하는 이곳은 날씨가 선선해서 좋다. 1인실이라는 숙소는 한국의 고시원 시설보다 후지지만, 한달동안 내가 살 곳이니 적응해야겠지.',
        en: "This place is tucked deep in the mountains, and the cool weather is nice. My single room is even more run-down than a gosiwon back in Korea, but it's going to be my home for a month, so I'll just have to get used to it.",
      },
      {
        ko: '첫 아침에 너무 배가 고파서 식당에 와서 밥을 먹었는데, 가격이 7600원 치고 형편없었다. 이 돈을 내고 계속 밥을 먹을 수는 없다. 아껴야 한다.',
        en: "I was starving on my first morning, so I went to the cafeteria and had a meal — but the food was a total rip-off for 7,600 won. I can't keep paying this much for food like that. I need to watch my spending.",
      },
      {
        ko: '오늘은 일요일이라 수업도 없고 아무것도 없는 평온한 하루다. 오늘 한달동안 잡을 루틴과 계획을 세울 생각이다. 이번 한달동안 내가 꼭 가지고 가야하는건 영어다. 영어의 일상화. 스피킹, 리스닝을 중점적으로 연습하고 활용할거다.',
        en: "Today is Sunday — no classes, nothing going on. Just a calm day. I'm going to map out my routine and plan for the month ahead. The one thing I absolutely need to take away from this month is English. Living and breathing English. I'm going to focus on speaking and listening.",
      },
    ],
    vocabulary: [
      { word: 'circumstances', meaning: '상황, 사정', example: 'What circumstances brought them here?' },
      { word: 'tucked', meaning: '(깊숙이) 자리잡은', example: 'The school is tucked deep in the mountains.' },
      { word: 'starving', meaning: '배가 너무 고픈 (hungry보다 강한 표현)', example: 'I was starving on my first morning.' },
      { word: 'cafeteria', meaning: '구내식당', example: 'I went to the cafeteria and had a meal.' },
      { word: 'terrible', meaning: '형편없는, 끔찍한', example: 'The food was terrible.' },
      { word: 'watch my spending', meaning: '지출을 조심하다', example: 'I need to watch my spending.' },
      { word: 'run-down', meaning: '낡고 허름한, 후진', example: 'The building looks pretty run-down.' },
      { word: 'rip-off', meaning: '바가지, 돈값 못하는 것', example: 'That meal was a total rip-off.' },
    ],
    phrasal_verbs: [],
    expressions: [
      { expression: 'made it to ~', meaning: '~에 (겨우/드디어) 도착하다', note: '"arrived"보다 고생 끝에 도착한 느낌' },
      { expression: 'crossed my mind', meaning: '머리를 스치다, 문득 떠오르다', note: '"I thought about it"보다 자연스러운 표현' },
      { expression: 'do for a living', meaning: '직업이 뭐야 (생계로 뭘 해?)', note: 'What do you do for a living?' },
      { expression: 'get used to it', meaning: '적응하다', note: '원어민이 일상에서 매우 자주 씀' },
      { expression: 'take away from ~', meaning: '~에서 얻어가다, 가져가다', note: '경험에서 무언가를 배워간다는 뉘앙스' },
      { expression: 'map out', meaning: '계획을 짜다, 구상하다', note: 'I need to map out my schedule for the week.' },
      { expression: 'living and breathing ~', meaning: '~에 푹 빠져 살다, 일상화하다', note: '"part of my daily life"보다 몰입감 강한 표현' },
    ],
    raw: '',
    createdAt: '2026-05-17T00:00:00.000Z',
  },
];

// 샘플 일기에서 추출된 Phrases (단어장에도 시드)
const STARTER_DIARY_PHRASES = (() => {
  const out = [];
  const d = STARTER_DIARIES[0];
  for (const v of d.vocabulary) {
    out.push({ en: v.word, ko: v.meaning, cat: '단어', example: v.example, fromDiaryId: d.id });
  }
  for (const e of d.expressions) {
    const ko = e.note ? `${e.meaning} (${e.note})` : e.meaning;
    out.push({ en: e.expression, ko, cat: '표현', example: '', fromDiaryId: d.id });
  }
  return out;
})();

// ============================================================
//  루틴 헬퍼 함수
// ============================================================
function getDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getLast7Days() {
  const days = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push({
      key: getDateKey(d),
      label: ['일','월','화','수','목','금','토'][d.getDay()],
      isToday: i === 0
    });
  }
  return days;
}

function getRoutineStreak(history) {
  let streak = 0;
  const today = new Date(); today.setHours(0,0,0,0);
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const status = history[getDateKey(d)];
    if (status === 'done') streak++;
    else if (i === 0 && !status) continue; // 오늘 미체크는 스트릭 유지
    else break;
  }
  return streak;
}

function getRoutineRate(history, days = 7) {
  const today = new Date(); today.setHours(0,0,0,0);
  let done = 0, total = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const k = getDateKey(d);
    if (i === 0 && !history[k]) continue;
    total++;
    if (history[k] === 'done') done++;
  }
  return total > 0 ? Math.round((done/total) * 100) : 0;
}

function formatRelativeTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date(); today.setHours(0,0,0,0);
  const itemDay = new Date(d); itemDay.setHours(0,0,0,0);
  const diff = Math.floor((today - itemDay) / 86400000);
  const hh = String(d.getHours()).padStart(2,'0');
  const mm = String(d.getMinutes()).padStart(2,'0');
  if (diff === 0) return `오늘 ${hh}:${mm}`;
  if (diff === 1) return `어제 ${hh}:${mm}`;
  if (diff < 7) return `${diff}일 전`;
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

// ============================================================
//  성취 분석: 특정 날짜의 표식을 결정
//  결과: { x: bool, slash: bool, backslash: bool, dot: bool }
//    x         빨간 X   — 그날 완료 항목이 전체의 90% 이상 + 최소 2개 완료
//    slash     /        — 영어/단어 카테고리 항목을 하나라도 완료
//    backslash \        — 루틴을 하나라도 완료
//    dot       회색 원   — 그 외 부분적 성취 (할 일 일부 완료)
// ============================================================
function getDayAchievement(dateKey, checklist, routines) {
  const completedThatDay = checklist.filter(c =>
    c.done && c.completedAt && getDateKey(new Date(c.completedAt)) === dateKey
  );
  const totalRelevantForDay = checklist.filter(c => {
    // 그날 완료된 것 OR 아직 미완료 상태 (오늘 표식 계산 시)
    // 단순화를 위해: 완료된 것은 그날 카운트, 미완료는 오늘만 카운트
    if (c.done && c.completedAt) {
      return getDateKey(new Date(c.completedAt)) === dateKey;
    }
    return dateKey === getDateKey(new Date()); // 오늘만 미완료 포함
  });

  const ENGLISH_GROUPS = ['영어', '단어'];
  const hasEnglish = completedThatDay.some(c => ENGLISH_GROUPS.includes(c.group));
  const hasRoutine = routines.some(r => r.history[dateKey] === 'done');
  const completionRatio = totalRelevantForDay.length > 0
    ? completedThatDay.length / totalRelevantForDay.length
    : 0;
  const isFullDay = completedThatDay.length >= 2 && completionRatio >= 0.9;
  const hasAnyTodo = completedThatDay.length > 0;

  return {
    x: isFullDay,
    slash: hasEnglish,
    backslash: hasRoutine,
    // 부분 성취: X도 아니고, 영어/루틴 표식도 없는데 할 일은 했을 때
    dot: !isFullDay && !hasEnglish && !hasRoutine && hasAnyTodo
  };
}

// ============================================================
//  새로고침 버튼 — PWA 모드에서도 수동으로 원격 데이터 가져오기
// ============================================================
function RefreshButton({ lang }) {
  const [spinning, setSpinning] = useState(false);
  const handle = async () => {
    setSpinning(true);
    try { await refreshNow(); } catch {}
    // 최소 600ms 회전 (피드백)
    setTimeout(() => setSpinning(false), 600);
  };
  return (
    <button
      onClick={handle}
      aria-label={lang === 'ko' ? '새로고침' : 'Refresh'}
      title={lang === 'ko' ? '동기화' : 'Sync'}
      style={{
        width: 28, height: 28,
        border: '1px solid rgba(31,58,46,0.25)',
        borderRadius: '50%',
        background: 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#1F3A2E',
        padding: 0,
      }}
    >
      <RefreshCw size={14} style={{
        animation: spinning ? 'spin 0.6s linear' : 'none',
      }} />
    </button>
  );
}

// ============================================================
//  메인 컴포넌트
// ============================================================
export default function BaguioApp() {
  const [tab, setTab] = useState('home');
  const [loaded, setLoaded] = useState(false);

  // 언어 (ko | en)
  const [lang, setLang] = useState('ko');

  // 여행 정보 (5/16 도착 → 5/17 수업 시작)
  const [tripStart, setTripStart] = useState('2026-05-17');
  const [tripEnd, setTripEnd] = useState('2026-06-13');

  // 환율
  const [phpRate, setPhpRate] = useState(24.17);
  const [rateUpdated, setRateUpdated] = useState('2026-05-15');

  // 체크리스트, 시간표, 가계부, 단어장, 루틴, 글쓰기, 일기
  const [checklist, setChecklist] = useState(STARTER_CHECKLIST);
  const [schedule, setSchedule] = useState(STARTER_SCHEDULE);
  const [expenses, setExpenses] = useState([]);
  const [vocab, setVocab] = useState([...STARTER_DIARY_PHRASES, ...STARTER_PHRASES]);
  const [routines, setRoutines] = useState(STARTER_ROUTINES);
  const [articles, setArticles] = useState([]);
  const [diaries, setDiaries] = useState(STARTER_DIARIES);

  // 첫 로드 시 Supabase 동기화 → 저장된 데이터 불러오기
  useEffect(() => {
    (async () => {
      // 1) Supabase 익명 세션 + 원격 row → localStorage 시드 (또는 첫 마이그레이션)
      await initSync().catch(err => console.warn('[init] sync failed', err));
      // 2) 로컬에서 읽기 (initSync가 원격 우선으로 시드해두었음)
      const lg = await storage.get('baguio:lang');
      if (lg === 'ko' || lg === 'en') setLang(lg);
      const t = await storage.get('baguio:trip');
      if (t) {
        try {
          const p = JSON.parse(t);
          // 마이그레이션: 도착일(5/16)을 시작일로 잡았던 옛 데이터 → 수업 시작일(5/17)로
          const migratedStart = p.start === '2026-05-16' ? '2026-05-17' : (p.start || tripStart);
          setTripStart(migratedStart);
          setTripEnd(p.end || tripEnd);
          if (p.start === '2026-05-16') {
            // 새 값으로 즉시 저장 (Supabase에도 반영)
            await storage.set('baguio:trip', JSON.stringify({ start: migratedStart, end: p.end || tripEnd }));
          }
        } catch {}
      }
      const r = await storage.get('baguio:rate');
      if (r) {
        try { const p = JSON.parse(r); setPhpRate(p.rate || 24.17); setRateUpdated(p.updated || ''); } catch {}
      }
      const c = await storage.get('baguio:checklist');
      if (c) {
        try {
          const parsed = JSON.parse(c);
          // 그룹별 order 부여 (legacy 데이터에 order가 없는 경우)
          const groupCounters = {};
          const migrated = parsed.map((item, idx) => {
            const grp = item.group || '기타';
            if (typeof item.order !== 'number') {
              groupCounters[grp] = (groupCounters[grp] ?? -1) + 1;
            }
            return {
              id: item.id || `legacy-${idx}-${Date.now()}`,
              text: item.text,
              done: !!item.done,
              group: grp,
              order: typeof item.order === 'number' ? item.order : groupCounters[grp],
              completedAt: item.completedAt ?? (item.done ? new Date().toISOString() : null)
            };
          });
          setChecklist(migrated);
        } catch {}
      }
      const s = await storage.get('baguio:schedule');
      let loadedSchedule = STARTER_SCHEDULE;
      if (s) { try { loadedSchedule = JSON.parse(s); } catch {} }

      // Ryan의 화요일 시간표 일회성 시드 — 화요일 슬롯이 비어있을 때만 추가.
      // 다른 요일은 어학원에서 받으면 사용자가 직접 추가.
      const tueSeedFlag = await storage.get('baguio:seeded:tue-v1');
      if (!tueSeedFlag) {
        const hasTue = loadedSchedule.some(x => x.day === 'tue');
        if (!hasTue) {
          loadedSchedule = [...loadedSchedule, ...RYAN_TUE_SCHEDULE];
        }
        await storage.set('baguio:seeded:tue-v1', '1');
      }
      setSchedule(loadedSchedule);
      const e = await storage.get('baguio:expenses');
      if (e) { try { setExpenses(JSON.parse(e)); } catch {} }
      const v = await storage.get('baguio:vocab');
      if (v) { try { setVocab(JSON.parse(v)); } catch {} }
      const ro = await storage.get('baguio:routines');
      if (ro) { try { setRoutines(JSON.parse(ro)); } catch {} }
      const ar = await storage.get('baguio:articles');
      if (ar) { try { setArticles(JSON.parse(ar)); } catch {} }
      const dr = await storage.get('baguio:diaries');
      let loadedDiaries = STARTER_DIARIES;
      if (dr) {
        try { loadedDiaries = JSON.parse(dr); } catch {}
      }

      // 샘플 일기 일회성 시드: seedFlag 없으면 기존 일기에 샘플이 없을 때만 추가
      const seedFlag = await storage.get('baguio:seeded:diary-v1');
      if (!seedFlag) {
        const hasSample = loadedDiaries.some(d => d.id === 'diary-seed-1');
        if (!hasSample) {
          loadedDiaries = [...STARTER_DIARIES, ...loadedDiaries];
        }
        // vocab도 같은 방식: 샘플 단어가 이미 있는지 en 기준으로 확인 후 보강
        // (위의 setVocab은 이미 로드된 c 결과를 갖고 있으므로 함수형 업데이트)
        setVocab(prev => {
          const existing = new Set(prev.map(v => v.en));
          const fresh = STARTER_DIARY_PHRASES.filter(p => !existing.has(p.en));
          return fresh.length > 0 ? [...fresh, ...prev] : prev;
        });
        await storage.set('baguio:seeded:diary-v1', '1');
      }
      setDiaries(loadedDiaries);

      setLoaded(true);
    })();
  }, []);

  // 저장 (loaded 이후만)
  useEffect(() => { if (loaded) storage.set('baguio:lang', lang); }, [lang, loaded]);
  useEffect(() => { if (loaded) storage.set('baguio:trip', JSON.stringify({ start: tripStart, end: tripEnd })); }, [tripStart, tripEnd, loaded]);
  useEffect(() => { if (loaded) storage.set('baguio:rate', JSON.stringify({ rate: phpRate, updated: rateUpdated })); }, [phpRate, rateUpdated, loaded]);
  useEffect(() => { if (loaded) storage.set('baguio:checklist', JSON.stringify(checklist)); }, [checklist, loaded]);
  useEffect(() => { if (loaded) storage.set('baguio:schedule', JSON.stringify(schedule)); }, [schedule, loaded]);
  useEffect(() => { if (loaded) storage.set('baguio:expenses', JSON.stringify(expenses)); }, [expenses, loaded]);
  useEffect(() => { if (loaded) storage.set('baguio:vocab', JSON.stringify(vocab)); }, [vocab, loaded]);
  useEffect(() => { if (loaded) storage.set('baguio:routines', JSON.stringify(routines)); }, [routines, loaded]);
  useEffect(() => { if (loaded) storage.set('baguio:articles', JSON.stringify(articles)); }, [articles, loaded]);
  useEffect(() => { if (loaded) storage.set('baguio:diaries', JSON.stringify(diaries)); }, [diaries, loaded]);

  // Pull-to-Refresh — 화면 위에서 아래로 당겨서 새로고침
  // (PWA에서 브라우저 기본 P2R가 비활성화되므로 직접 구현)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const instance = PullToRefresh.init({
      mainElement: 'body',
      instructionsPullToRefresh: lang === 'ko' ? '당겨서 새로고침' : 'Pull to refresh',
      instructionsReleaseToRefresh: lang === 'ko' ? '놓으면 새로고침' : 'Release to refresh',
      instructionsRefreshing: lang === 'ko' ? '새로고침 중...' : 'Refreshing...',
      distThreshold: 70,
      distMax: 120,
      resistanceFunction: (t) => Math.min(1, t / 2.5),
      onRefresh: async () => {
        await refreshNow();
      },
    });
    return () => { try { instance.destroy(); } catch {} };
  }, [lang]);

  // 매직 링크 콜백 후 URL 정리 — supabase-js가 토큰을 자동 처리한 뒤 ?code= 또는 #access_token= 가 남아있을 수 있음
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasAuth = window.location.search.includes('code=') || window.location.hash.includes('access_token');
    if (hasAuth) {
      // 잠깐 기다린 후(라이브러리가 토큰 교환 완료) URL 정리
      const t = setTimeout(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
      }, 500);
      return () => clearTimeout(t);
    }
  }, []);

  // 다른 기기에서 변경된 내용을 Realtime으로 받아 상태에 반영
  // 주의: storage.set은 자기 자신을 broadcast하지 않으니 echo 걱정 없음
  // (Supabase Realtime은 다른 세션의 UPDATE만 전달함)
  useEffect(() => {
    if (!loaded) return;
    const unsub = subscribeRemoteChanges((key, serialized) => {
      try {
        switch (key) {
          case 'baguio:lang':
            if (serialized === 'ko' || serialized === 'en') setLang(serialized);
            break;
          case 'baguio:trip': {
            const p = JSON.parse(serialized);
            if (p.start) setTripStart(p.start);
            if (p.end) setTripEnd(p.end);
            break;
          }
          case 'baguio:rate': {
            const p = JSON.parse(serialized);
            if (typeof p.rate === 'number') setPhpRate(p.rate);
            if (p.updated) setRateUpdated(p.updated);
            break;
          }
          case 'baguio:checklist': setChecklist(JSON.parse(serialized)); break;
          case 'baguio:schedule': setSchedule(JSON.parse(serialized)); break;
          case 'baguio:expenses': setExpenses(JSON.parse(serialized)); break;
          case 'baguio:vocab': setVocab(JSON.parse(serialized)); break;
          case 'baguio:routines': setRoutines(JSON.parse(serialized)); break;
          case 'baguio:articles': setArticles(JSON.parse(serialized)); break;
          case 'baguio:diaries': setDiaries(JSON.parse(serialized)); break;
        }
      } catch (e) {
        console.warn('[realtime] apply failed', key, e);
      }
    });
    return unsub;
  }, [loaded]);

  // D-day 계산 (로컬 시간 기준 자정 정렬 — timezone 영향 제거)
  // 'YYYY-MM-DD' 문자열을 그냥 new Date()에 넣으면 UTC 자정으로 파싱돼서
  // KST 환경에선 종일 어긋남. 수동으로 로컬 자정 Date 생성.
  const parseLocalDate = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d); // 로컬 자정
  };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = parseLocalDate(tripStart);
  const end = parseLocalDate(tripEnd);
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const dDay = Math.round((start - today) / MS_PER_DAY);
  const totalDays = Math.round((end - start) / MS_PER_DAY) + 1; // inclusive
  const daysIn = Math.round((today - start) / MS_PER_DAY) + 1; // 시작일이 Day 1
  // 주차: 5/16(토) 시작 → 5/16~5/22 = 1주차, 5/23~5/29 = 2주차 ... 6/13(토)은 5주차 첫날
  // 단, 코스가 정확히 4주(28일)면 4, 그 이상이면 자연 ceil
  const totalWeeks = Math.max(1, Math.round(totalDays / 7));
  const weekNum = daysIn >= 1 ? Math.min(totalWeeks, Math.ceil(daysIn / 7)) : 0;
  const todayMonthDay = `${today.getMonth()+1}/${today.getDate()}`;
  // status: 시작 전엔 D-N, 시작 후엔 Day N을 메인으로 강조하고 날짜는 sub로
  const status = dDay > 0
    ? { label: `D-${dDay}`, sub: lang === 'ko' ? '출국까지' : 'until departure' }
    : daysIn >= 1 && daysIn <= totalDays
    ? { label: `Day ${daysIn}`, sub: todayMonthDay }
    : { label: lang === 'ko' ? '종료' : 'completed', sub: lang === 'ko' ? '수고했어요' : 'well done' };

  const totalSpentPhp = expenses.reduce((s, e) => s + (e.currency === 'PHP' ? Number(e.amount) : Number(e.amount) / phpRate), 0);

  // ============================================================
  //  렌더링
  // ============================================================
  return (
    <div style={{
      minHeight: '100vh',
      background: '#F5EFE0',
      color: '#1F3A2E',
      fontFamily: "'Inter', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
      paddingBottom: '100px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;1,9..144,400;1,9..144,500&family=Inter:wght@300;400;500;600;700&family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        .display { font-family: 'Fraunces', 'Apple SD Gothic Neo', serif; font-optical-sizing: auto; }
        .display-italic { font-family: 'Fraunces', serif; font-style: italic; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.6s ease-out both; }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .pulse-dot { animation: pulse-dot 2s ease-in-out infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .grain::before {
          content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 100;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E");
          opacity: 0.18; mix-blend-mode: multiply;
        }
        .stamp { border: 2px dashed #1F3A2E; border-radius: 4px; padding: 6px 12px; display: inline-block; transform: rotate(-2deg); }
        .scrollbar-hidden::-webkit-scrollbar { display: none; }
        .scrollbar-hidden { scrollbar-width: none; }
      `}</style>

      <div className="grain" />

      {/* ============================================================
          헤더
      ============================================================ */}
      <header style={{ padding: '28px 24px 12px', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '11px', letterSpacing: '0.2em', color: '#7A8E7E', fontWeight: 500, marginBottom: 4 }}>
              CITY OF PINES · 1,540M
            </div>
            <h1 className="display" style={{ fontSize: '34px', fontWeight: 700, margin: 0, lineHeight: 1, letterSpacing: '-0.02em' }}>
              Baguio<span className="display-italic" style={{ color: '#C45A3F', fontWeight: 400 }}>, mi.</span>
            </h1>
            <div style={{ marginTop: 8, fontSize: '13px', color: '#5C6F62' }}>
              {lang === 'ko'
                ? `어학연수 · ${tripStart} → ${tripEnd}`
                : `Language study · ${tripStart} → ${tripEnd}`}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            {/* 새로고침 + KO/EN 토글 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <RefreshButton lang={lang} />
              <div style={{
                display: 'inline-flex',
                border: '1px solid rgba(31,58,46,0.25)',
                borderRadius: 999,
                overflow: 'hidden',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em'
              }}>
                {['ko', 'en'].map(l => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    aria-pressed={lang === l}
                    style={{
                      padding: '4px 10px',
                      border: 'none',
                      cursor: 'pointer',
                      background: lang === l ? '#1F3A2E' : 'transparent',
                      color: lang === l ? '#F5EFE0' : '#1F3A2E',
                      transition: 'background 0.15s'
                    }}
                  >{l.toUpperCase()}</button>
                ))}
              </div>
            </div>
            {/* 상태 카드: Day N 크게 + 그 밑에 날짜 */}
            <div style={{
              border: '1px solid rgba(31,58,46,0.2)',
              borderRadius: 8,
              padding: '8px 14px',
              textAlign: 'center',
              background: 'rgba(255,255,255,0.4)',
              minWidth: 76
            }}>
              <div className="display" style={{ fontSize: '24px', fontWeight: 700, color: '#C45A3F', lineHeight: 1, letterSpacing: '-0.01em' }}>
                {status.label}
              </div>
              <div style={{ fontSize: '11px', color: '#5C6F62', letterSpacing: '0.05em', marginTop: 4, fontWeight: 500 }}>{status.sub}</div>
            </div>
          </div>
        </div>
      </header>

      {/* ============================================================
          탭 콘텐츠
      ============================================================ */}
      <main style={{ padding: '8px 20px', position: 'relative', zIndex: 2 }} key={tab}>
        {tab === 'home' && (
          <DashboardTab
            lang={lang}
            status={status} dDay={dDay} totalDays={totalDays} daysIn={daysIn}
            weekNum={weekNum} totalWeeks={totalWeeks}
            phpRate={phpRate} rateUpdated={rateUpdated}
            checklist={checklist} setChecklist={setChecklist}
            schedule={schedule} expenses={expenses}
            vocab={vocab}
            totalSpentPhp={totalSpentPhp}
            goTo={setTab}
          />
        )}
        {tab === 'plan' && (
          <PlanTab
            lang={lang}
            checklist={checklist} setChecklist={setChecklist}
            routines={routines} setRoutines={setRoutines}
          />
        )}
        {tab === 'schedule' && (
          <ScheduleTab lang={lang} schedule={schedule} setSchedule={setSchedule} />
        )}
        {tab === 'money' && (
          <MoneyTab
            lang={lang}
            phpRate={phpRate} setPhpRate={setPhpRate}
            rateUpdated={rateUpdated} setRateUpdated={setRateUpdated}
            expenses={expenses} setExpenses={setExpenses}
            tripStart={tripStart} setTripStart={setTripStart}
            tripEnd={tripEnd} setTripEnd={setTripEnd}
          />
        )}
        {tab === 'english' && (
          <EnglishTab
            lang={lang}
            vocab={vocab} setVocab={setVocab}
            articles={articles} setArticles={setArticles}
            diaries={diaries} setDiaries={setDiaries}
          />
        )}
      </main>

      {/* ============================================================
          하단 탭바
      ============================================================ */}
      <nav style={{
        position: 'fixed', bottom: 16, left: 16, right: 16,
        background: '#1F3A2E',
        borderRadius: 18,
        padding: '8px 6px',
        display: 'flex',
        justifyContent: 'space-around',
        zIndex: 50,
        boxShadow: '0 10px 30px rgba(31,58,46,0.25)'
      }}>
        {[
          { key: 'home', icon: Compass, label: lang === 'ko' ? '홈' : 'Home' },
          { key: 'plan', icon: Check, label: lang === 'ko' ? '할 일' : 'Todo' },
          { key: 'schedule', icon: CalendarDays, label: lang === 'ko' ? '시간표' : 'Schedule' },
          { key: 'money', icon: Wallet, label: lang === 'ko' ? '머니' : 'Money' },
          { key: 'english', icon: Languages, label: lang === 'ko' ? '영어' : 'English' },
        ].map(({ key, icon: Icon, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            background: tab === key ? '#C45A3F' : 'transparent',
            color: tab === key ? '#F5EFE0' : '#A8B8AB',
            border: 'none',
            padding: '10px 14px',
            borderRadius: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            cursor: 'pointer',
            transition: 'all 0.2s',
            flex: 1
          }}>
            <Icon size={18} strokeWidth={tab === key ? 2.5 : 2} />
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.02em' }}>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ============================================================
//  공통 카드 컴포넌트
// ============================================================
function Card({ children, style = {}, accent = false }) {
  return (
    <div className="fade-up" style={{
      background: accent ? '#1F3A2E' : '#FAF7EC',
      color: accent ? '#F5EFE0' : '#1F3A2E',
      borderRadius: 16,
      padding: 18,
      border: accent ? 'none' : '1px solid rgba(31,58,46,0.08)',
      boxShadow: '0 1px 0 rgba(31,58,46,0.04)',
      ...style
    }}>{children}</div>
  );
}

function SectionTitle({ children, kicker }) {
  return (
    <div style={{ marginTop: 18, marginBottom: 10 }}>
      {kicker && (
        <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#7A8E7E', fontWeight: 600 }}>{kicker}</div>
      )}
      <h2 className="display" style={{ fontSize: 24, fontWeight: 700, margin: '2px 0 0', letterSpacing: '-0.01em' }}>{children}</h2>
    </div>
  );
}

// ============================================================
//  대시보드 탭 — 학습 / 수업 중심
// ============================================================
function DashboardTab({ lang = 'ko', status, dDay, totalDays, daysIn, weekNum, totalWeeks, phpRate, rateUpdated, checklist, setChecklist, schedule, expenses, vocab, totalSpentPhp, goTo }) {
  const doneCount = checklist.filter(c => c.done).length;
  const pendingCount = checklist.filter(c => !c.done).length;

  const dayKeys = ['sun','mon','tue','wed','thu','fri','sat'];
  const dayKoMap = { sun:'일', mon:'월', tue:'화', wed:'수', thu:'목', fri:'금', sat:'토' };
  const now = new Date();
  const todayKey = dayKeys[now.getDay()];

  const todayClasses = schedule.filter(s => s.day === todayKey).sort((a,b) => a.time.localeCompare(b.time));
  const weeklyCount = schedule.length;

  // 다음 수업 찾기
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const upcomingToday = todayClasses.find(c => {
    const [h,m] = c.time.split(':').map(Number);
    return h * 60 + m > nowMinutes;
  });

  // 오늘 할 일 — 우선순위순으로 정렬 (오늘 → 과제 → 읽기 → 단어 → 준비 → 기타)
  const groupOrder = { '오늘': 1, '과제': 2, '영어': 3, '읽기': 4, '단어': 5, '준비': 6 };
  const todayTodos = checklist
    .filter(c => !c.done)
    .sort((a, b) => (groupOrder[a.group] || 99) - (groupOrder[b.group] || 99));
  const HOME_TODO_LIMIT = 5;
  const visibleTodos = todayTodos.slice(0, HOME_TODO_LIMIT);
  const hiddenTodosCount = Math.max(0, todayTodos.length - HOME_TODO_LIMIT);

  const toggleTodo = (id) => {
    setChecklist(checklist.map(c =>
      c.id === id
        ? { ...c, done: !c.done, completedAt: !c.done ? new Date().toISOString() : null }
        : c
    ));
  };

  const progress = totalDays > 0 ? Math.max(0, Math.min(100, (daysIn / totalDays) * 100)) : 0;

  // ===== Hero 상태 계산 =====
  const formatMins = (m) => {
    if (m < 60) return `${m}분`;
    const h = Math.floor(m/60);
    const mm = m % 60;
    return mm === 0 ? `${h}시간` : `${h}시간 ${mm}분`;
  };
  const nowTimeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const dayKoMapFull = { mon:'월', tue:'화', wed:'수', thu:'목', fri:'금', sat:'토', sun:'일' };

  const heroState = (() => {
    if (dDay > 0) return { type: 'pre-trip' };
    if (dDay === 0) return { type: 'departure' };
    if (daysIn > totalDays) return { type: 'after' };

    // 오늘 수업 없음 (휴일/주말)
    if (todayClasses.length === 0) {
      for (let i = 1; i <= 7; i++) {
        const checkDayKey = dayKeys[(now.getDay() + i) % 7];
        const classes = schedule
          .filter(s => s.day === checkDayKey)
          .sort((a,b) => a.time.localeCompare(b.time));
        if (classes.length > 0) {
          return { type: 'rest-day', nextClass: classes[0], daysAway: i, nextDayKo: dayKoMapFull[checkDayKey] };
        }
      }
      return { type: 'rest-day' };
    }

    // 현재 수업 / 다음 수업 찾기 (수업 1시간 가정)
    let current = null;
    let next = null;
    for (const c of todayClasses) {
      const [h, m] = c.time.split(':').map(Number);
      const startMin = h * 60 + m;
      const endMin = startMin + 60;
      if (nowMinutes >= startMin && nowMinutes < endMin && !current) {
        current = { ...c, minsRemaining: endMin - nowMinutes };
      }
      if (nowMinutes < startMin && !next) {
        next = { ...c, minsUntil: startMin - nowMinutes };
      }
    }

    if (current) return { type: 'in-class', current, next };
    if (next) {
      const hadEarlier = todayClasses.some(c => {
        const [h,m] = c.time.split(':').map(Number);
        return h*60+m+60 <= nowMinutes;
      });
      return { type: hadEarlier ? 'break' : 'before-first', next };
    }
    return { type: 'classes-done', last: todayClasses[todayClasses.length-1] };
  })();

  // 오늘의 표현 (날짜 기반 회전)
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(),0,0)) / 86400000);
  const todayExpression = vocab.length > 0 ? vocab[dayOfYear % vocab.length] : null;
  const [exprSide, setExprSide] = useState('en');

  // 오늘의 동기부여 문장 (날짜 기반 회전)
  const todayMotivation = MOTIVATIONS[dayOfYear % MOTIVATIONS.length];

  return (
    <>
      {/* 메인 카드 — 학습 진척 */}
      <Card accent style={{ marginTop: 8, padding: 22, position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <GraduationCap size={16} style={{ opacity: 0.7 }} />
            <span style={{ fontSize: 11, letterSpacing: '0.15em', opacity: 0.7 }}>
              {heroState.type === 'in-class' && (lang === 'ko' ? '진행 중' : 'IN CLASS')}
              {heroState.type === 'break' && (lang === 'ko' ? '쉬는 시간' : 'BREAK')}
              {heroState.type === 'before-first' && (lang === 'ko' ? '오늘 첫 수업' : "TODAY'S FIRST CLASS")}
              {heroState.type === 'classes-done' && (lang === 'ko' ? '오늘 수업 완료' : 'CLASSES DONE')}
              {heroState.type === 'rest-day' && (lang === 'ko' ? '오늘 휴식일' : 'REST DAY')}
              {(heroState.type === 'pre-trip' || heroState.type === 'departure' || heroState.type === 'after') && 'STUDY PROGRAM'}
            </span>
          </div>
          {(heroState.type === 'in-class' || heroState.type === 'break' || heroState.type === 'before-first') && (
            <span className="display" style={{ fontSize: 13, fontWeight: 700, opacity: 0.85, letterSpacing: '-0.01em' }}>
              {nowTimeStr}
            </span>
          )}
        </div>

        {/* 헤드라인 — 출국 전 / 출국 당일 / 종료 후 */}
        {(heroState.type === 'pre-trip' || heroState.type === 'departure' || heroState.type === 'after') && (
          <div style={{ marginBottom: 16 }}>
            {heroState.type === 'departure' ? (
              // 출국 당일 — 동기부여 문장
              <>
                <div className="display-italic" style={{ fontSize: 20, lineHeight: 1.35, fontWeight: 500, letterSpacing: '-0.01em' }}>
                  {lang === 'ko' ? `"${todayMotivation.ko}"` : `"${todayMotivation.en}"`}
                </div>
                <div style={{ fontSize: 10, opacity: 0.55, marginTop: 8, letterSpacing: '0.05em' }}>
                  — {todayMotivation.src}
                </div>
              </>
            ) : (
              <div className="display" style={{ fontSize: 22, lineHeight: 1.25, fontWeight: 600, letterSpacing: '-0.01em' }}>
                {heroState.type === 'pre-trip' && (lang === 'ko' ? '곧 시작됩니다.' : 'Starting soon.')}
                {heroState.type === 'after' && (lang === 'ko' ? '여정이 끝났습니다.' : 'Journey complete.')}
              </div>
            )}
          </div>
        )}

        {/* 수업 중 */}
        {heroState.type === 'in-class' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 11, opacity: 0.85 }}>
              <span className="pulse-dot" style={{ width: 7, height: 7, borderRadius: 4, background: '#C45A3F', display: 'inline-block' }} />
              <span style={{ fontWeight: 600 }}>{formatMins(heroState.current.minsRemaining)} 남음</span>
            </div>
            <div className="display" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1, marginBottom: 4 }}>
              {heroState.current.subject}
            </div>
            {(heroState.current.teacher || heroState.current.room) && (
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                {heroState.current.teacher}{heroState.current.teacher && heroState.current.room ? ' · ' : ''}{heroState.current.room}
              </div>
            )}
            {heroState.next && (
              <div style={{ marginTop: 10, fontSize: 11, opacity: 0.6 }}>
                다음 → {heroState.next.time} {heroState.next.subject}
              </div>
            )}
          </div>
        )}

        {/* 쉬는 시간 / 첫 수업 전 */}
        {(heroState.type === 'break' || heroState.type === 'before-first') && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6, fontWeight: 600 }}>
              {formatMins(heroState.next.minsUntil)} 후
            </div>
            <div className="display" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1, marginBottom: 4 }}>
              {heroState.next.subject}
            </div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              {heroState.next.time}
              {heroState.next.teacher && ` · ${heroState.next.teacher}`}
              {heroState.next.room && ` · ${heroState.next.room}`}
            </div>
          </div>
        )}

        {/* 오늘 수업 완료 */}
        {heroState.type === 'classes-done' && (
          <div style={{ marginBottom: 16 }}>
            <div className="display-italic" style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.3, marginBottom: 8 }}>
              {lang === 'ko' ? `"${todayMotivation.ko}"` : `"${todayMotivation.en}"`}
            </div>
            <div style={{ fontSize: 10, opacity: 0.55, letterSpacing: '0.05em', marginBottom: 8 }}>
              — {todayMotivation.src}
            </div>
            {heroState.last?.subject && (
              <div style={{ fontSize: 11, opacity: 0.6 }}>
                {lang === 'ko' ? '마지막 수업' : 'Last class'}: {heroState.last.subject}
              </div>
            )}
          </div>
        )}

        {/* 휴식일 (수업 없는 날) */}
        {heroState.type === 'rest-day' && (
          <div style={{ marginBottom: 16 }}>
            <div className="display-italic" style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.3, marginBottom: 8 }}>
              {lang === 'ko' ? `"${todayMotivation.ko}"` : `"${todayMotivation.en}"`}
            </div>
            <div style={{ fontSize: 10, opacity: 0.55, letterSpacing: '0.05em', marginBottom: 8 }}>
              — {todayMotivation.src}
            </div>
            {heroState.nextClass && (
              <div style={{ fontSize: 11, opacity: 0.7 }}>
                {lang === 'ko'
                  ? `${heroState.daysAway === 1 ? '내일' : `${heroState.daysAway}일 뒤 ${heroState.nextDayKo}요일`} → ${heroState.nextClass.time} ${heroState.nextClass.subject}`
                  : `${heroState.daysAway === 1 ? 'Tomorrow' : `In ${heroState.daysAway} days`} → ${heroState.nextClass.time} ${heroState.nextClass.subject}`}
              </div>
            )}
          </div>
        )}

        {/* DAY / WEEK stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingTop: 14, borderTop: '1px solid rgba(245,239,224,0.15)' }}>
          <div>
            <div style={{ fontSize: 9, opacity: 0.6, letterSpacing: '0.12em', fontWeight: 600 }}>DAY</div>
            <div className="display" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, marginTop: 4 }}>
              {dDay > 0 ? `D-${dDay}` : (daysIn >= 1 && daysIn <= totalDays) ? daysIn : '—'}
            </div>
            <div style={{ fontSize: 9, opacity: 0.55, marginTop: 3 }}>
              {dDay > 0
                ? (lang === 'ko' ? '출국까지' : 'until departure')
                : (daysIn >= 1 && daysIn <= totalDays)
                  ? (lang === 'ko' ? `/ ${totalDays}일 중` : `of ${totalDays}`)
                  : (lang === 'ko' ? '종료' : 'completed')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, opacity: 0.6, letterSpacing: '0.12em', fontWeight: 600 }}>WEEK</div>
            <div className="display" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, marginTop: 4 }}>
              {dDay > 0 ? '—' : (weekNum >= 1 && weekNum <= totalWeeks) ? weekNum : '—'}
            </div>
            <div style={{ fontSize: 9, opacity: 0.55, marginTop: 3 }}>
              {dDay > 0
                ? (lang === 'ko' ? '시작 전' : 'not started')
                : (weekNum >= 1 && weekNum <= totalWeeks)
                  ? (lang === 'ko' ? `/ ${totalWeeks}주 과정` : `of ${totalWeeks} weeks`)
                  : (lang === 'ko' ? '종료' : 'completed')}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 14, height: 4, background: 'rgba(245,239,224,0.12)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: '#C45A3F', transition: 'width 0.8s' }} />
        </div>
      </Card>

      {/* 오늘의 수업 — BIG */}
      <SectionTitle kicker={lang === 'ko' ? `${dayKoMap[todayKey]}요일 · TODAY` : `${todayKey.toUpperCase()} · TODAY`}>
        {lang === 'ko' ? '오늘의 수업' : "Today's Classes"}
      </SectionTitle>
      <Card>
        {todayClasses.length === 0 ? (
          <div style={{ padding: '8px 0', fontSize: 13, color: '#7A8E7E' }}>
            {lang === 'ko' ? '오늘은 수업이 없어요. ' : 'No classes today. '}
            <button onClick={() => goTo('schedule')} style={inlineLink}>
              {lang === 'ko' ? '시간표 편집 →' : 'Edit schedule →'}
            </button>
          </div>
        ) : (
          <div>
            {todayClasses.map((c, i) => {
              const [h,m] = c.time.split(':').map(Number);
              const startMin = h * 60 + m;
              // 끝시간: endTime이 있으면 그걸 쓰고, 없으면 +45분 (기본 어학원 수업)
              let endMin;
              if (c.endTime) {
                const [eh, em] = c.endTime.split(':').map(Number);
                endMin = eh * 60 + em;
              } else {
                endMin = startMin + 45;
              }
              const isPast = endMin < nowMinutes;
              const isNow = startMin <= nowMinutes && endMin >= nowMinutes;
              const endStr = c.endTime || `${String(Math.floor(endMin/60)).padStart(2,'0')}:${String(endMin%60).padStart(2,'0')}`;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 0',
                  opacity: isPast ? 0.4 : 1,
                  borderBottom: i < todayClasses.length - 1 ? '1px dashed rgba(31,58,46,0.15)' : 'none'
                }}>
                  <div className="display" style={{
                    minWidth: 64,
                    color: isPast ? '#7A8E7E' : '#C45A3F'
                  }}>
                    <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1 }}>{c.time}</div>
                    <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>~ {endStr}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, textDecoration: isPast ? 'line-through' : 'none' }}>
                      {c.subject || '수업'}
                    </div>
                    {(c.teacher || c.room || c.floor) && (
                      <div style={{ fontSize: 11, color: '#7A8E7E', marginTop: 3 }}>
                        {[c.teacher, c.room, c.floor].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                  {isNow && (
                    <div style={{
                      fontSize: 9, padding: '3px 7px', borderRadius: 4,
                      background: '#C45A3F', color: '#F5EFE0', letterSpacing: '0.1em', fontWeight: 700
                    }}>NOW</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* 오늘 할 일 */}
      <SectionTitle kicker="TODO · TODAY">{lang === 'ko' ? '오늘 할 일' : "Today's Tasks"}</SectionTitle>
      <Card style={{ padding: visibleTodos.length === 0 ? 18 : 6 }}>
        {visibleTodos.length === 0 ? (
          <div style={{ fontSize: 13, color: '#7A8E7E' }}>
            {lang === 'ko' ? '할 일이 없어요. ' : 'No tasks. '}
            <button onClick={() => goTo('plan')} style={inlineLink}>
              {lang === 'ko' ? '추가하기 →' : 'Add →'}
            </button>
          </div>
        ) : (
          <>
            {visibleTodos.map((c, i) => {
              const groupEn = { '오늘': 'Today', '과제': 'Homework', '영어': 'English', '읽기': 'Reading', '단어': 'Vocab', '준비': 'Prep', '기타': 'Other' }[c.group] || c.group;
              return (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px',
                  borderBottom: i < visibleTodos.length - 1 ? '1px dashed rgba(31,58,46,0.08)' : 'none'
                }}>
                  <button onClick={() => toggleTodo(c.id)} style={{
                    width: 20, height: 20, borderRadius: 5,
                    border: '2px solid #1F3A2E',
                    background: 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flexShrink: 0
                  }} />
                  <span style={{ flex: 1, fontSize: 13 }}>{c.text}</span>
                  <span style={{
                    fontSize: 9, padding: '2px 6px', borderRadius: 6,
                    background: 'rgba(31,58,46,0.06)', color: '#5C6F62',
                    letterSpacing: '0.05em', fontWeight: 600
                  }}>{lang === 'ko' ? c.group : groupEn}</span>
                </div>
              );
            })}
            {hiddenTodosCount > 0 && (
              <button onClick={() => goTo('plan')} style={{
                ...btnLink, width: '100%', justifyContent: 'center',
                padding: '10px 12px', marginTop: 0
              }}>
                {lang === 'ko' ? `+ ${hiddenTodosCount}개 더 보기` : `+ ${hiddenTodosCount} more`}
                <ChevronRight size={12} />
              </button>
            )}
          </>
        )}
      </Card>

      {/* 오늘의 표현 — 플래시카드 */}
      {todayExpression && (
        <>
          <SectionTitle kicker="DAILY">{lang === 'ko' ? '오늘의 표현' : "Today's Phrase"}</SectionTitle>
          <Card
            style={{ cursor: 'pointer', padding: 22, minHeight: 130, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
            onClick={() => setExprSide(exprSide === 'en' ? 'ko' : 'en')}
          >
            <div style={{ fontSize: 9, color: '#7A8E7E', letterSpacing: '0.15em', marginBottom: 10, fontWeight: 600 }}>
              {todayExpression.cat} · TAP TO FLIP
            </div>
            {exprSide === 'en' ? (
              <div className="display" style={{ fontSize: 18, fontWeight: 500, lineHeight: 1.4 }}>{todayExpression.en}</div>
            ) : (
              <div className="display-italic" style={{ fontSize: 18, color: '#C45A3F', lineHeight: 1.4 }}>{todayExpression.ko}</div>
            )}
            <button onClick={(e) => { e.stopPropagation(); goTo('english'); }} style={{ ...btnLink, marginTop: 12, alignSelf: 'flex-start' }}>
              전체 단어장 <ChevronRight size={12} />
            </button>
          </Card>
        </>
      )}

      {/* 하단 요약 — 지출 + 할 일 (컴팩트) */}
      <SectionTitle kicker="OVERVIEW">간단히 보기</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Card style={{ padding: 14, cursor: 'pointer' }} onClick={() => goTo('money')}>
          <div style={{ fontSize: 9, letterSpacing: '0.15em', color: '#7A8E7E', fontWeight: 600 }}>지출 · ₱</div>
          <div className="display" style={{ fontSize: 20, fontWeight: 700, lineHeight: 1, marginTop: 4 }}>
            {totalSpentPhp.toFixed(0)}
          </div>
          <div style={{ fontSize: 9, color: '#7A8E7E', marginTop: 4 }}>
            {expenses.length}건 · 1₱={phpRate.toFixed(1)}₩
          </div>
        </Card>
        <Card style={{ padding: 14, cursor: 'pointer' }} onClick={() => goTo('plan')}>
          <div style={{ fontSize: 9, letterSpacing: '0.15em', color: '#7A8E7E', fontWeight: 600 }}>할 일</div>
          <div className="display" style={{ fontSize: 20, fontWeight: 700, lineHeight: 1, marginTop: 4 }}>
            {pendingCount}<span style={{ color: '#7A8E7E', fontSize: 14 }}> 남음</span>
          </div>
          <div style={{ fontSize: 9, color: '#7A8E7E', marginTop: 4 }}>완료 {doneCount}건</div>
        </Card>
      </div>
    </>
  );
}

// ============================================================
//  할 일 (TODO) 탭 — 할 일 + 루틴 + 완료 로그
// ============================================================
function SortableTodoItem({ item, isLast, onToggle, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? 'rgba(196,90,63,0.06)' : 'transparent',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 8px',
    borderBottom: !isLast ? '1px dashed rgba(31,58,46,0.08)' : 'none',
    touchAction: 'none'
  };
  return (
    <div ref={setNodeRef} style={style}>
      {/* 드래그 핸들 — 터치/마우스 양쪽 */}
      <button
        {...attributes}
        {...listeners}
        aria-label="순서 변경 핸들"
        style={{
          background: 'transparent', border: 'none', padding: 4,
          cursor: 'grab', touchAction: 'none', display: 'flex', alignItems: 'center',
          color: '#A8B8AB'
        }}
      >
        <GripVertical size={16} />
      </button>
      <button onClick={() => onToggle(item.id)} style={{
        width: 22, height: 22, borderRadius: 6,
        border: '2px solid #1F3A2E',
        background: 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', flexShrink: 0
      }} />
      <span style={{ flex: 1, fontSize: 14 }}>{item.text}</span>
      <button onClick={() => onRemove(item.id)} style={iconBtn}>
        <X size={14} color="#7A8E7E" />
      </button>
    </div>
  );
}

function PlanTab({ lang = 'ko', checklist, setChecklist, routines, setRoutines }) {
  // 그룹명 표시용 한↔영 매핑 (저장된 group 값은 한글 유지 — 데이터 호환)
  const groupLabel = (g) => {
    if (lang === 'ko') return g;
    const map = { '오늘': 'Today', '과제': 'Homework', '영어': 'English', '읽기': 'Reading', '단어': 'Vocab', '준비': 'Prep', '기타': 'Other' };
    return map[g] || g;
  };
  const [newItem, setNewItem] = useState('');
  const [newGroup, setNewGroup] = useState('오늘');
  const [newRoutineName, setNewRoutineName] = useState('');
  const [showLog, setShowLog] = useState(false);

  const DEFAULT_GROUPS = ['오늘', '과제', '영어', '읽기', '단어', '준비', '기타'];
  const active = checklist
    .filter(c => !c.done)
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const done = checklist
    .filter(c => c.done)
    .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));

  // 활성 그룹 (기본 순서 유지 + 사용자 정의 그룹은 뒤에)
  const activeGroupSet = new Set(active.map(c => c.group));
  const orderedGroups = [
    ...DEFAULT_GROUPS.filter(g => activeGroupSet.has(g)),
    ...[...activeGroupSet].filter(g => !DEFAULT_GROUPS.includes(g))
  ];

  // ===== DnD 센서 (마우스 + 터치 + 키보드) =====
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // 항목 ID로 그룹 찾기 (Sortable에서 over 대상이 항목일 때)
  const findContainer = (id) => {
    if (orderedGroups.includes(id)) return id; // 빈 그룹 placeholder
    const item = active.find(c => c.id === id);
    return item ? item.group : null;
  };

  const handleDragEnd = (event) => {
    const { active: a, over } = event;
    if (!over) return;
    const fromGroup = findContainer(a.id);
    const toGroup = findContainer(over.id);
    if (!fromGroup || !toGroup) return;
    if (a.id === over.id && fromGroup === toGroup) return;

    if (fromGroup === toGroup) {
      // 같은 그룹 내 순서 변경
      const groupItems = active.filter(c => c.group === fromGroup);
      const oldIdx = groupItems.findIndex(c => c.id === a.id);
      const newIdx = groupItems.findIndex(c => c.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;
      const reordered = arrayMove(groupItems, oldIdx, newIdx);
      const reorderedIds = new Set(reordered.map(c => c.id));
      setChecklist(checklist.map(c => {
        if (!reorderedIds.has(c.id)) return c;
        const newPos = reordered.findIndex(r => r.id === c.id);
        return { ...c, order: newPos };
      }));
    } else {
      // 다른 그룹으로 이동
      const toGroupItems = active.filter(c => c.group === toGroup);
      const overIdx = toGroupItems.findIndex(c => c.id === over.id);
      const insertAt = overIdx === -1 ? toGroupItems.length : overIdx;
      // 대상 그룹: 삽입 위치 이후 order +1
      // 출발 그룹: 그대로 (compaction은 자동으로 안 해도 동작)
      const newChecklist = checklist.map(c => {
        if (c.id === a.id) return { ...c, group: toGroup, order: insertAt };
        if (c.group === toGroup && !c.done && (c.order ?? 0) >= insertAt) {
          return { ...c, order: (c.order ?? 0) + 1 };
        }
        return c;
      });
      setChecklist(newChecklist);
    }
  };

  // 드롭다운에 표시할 모든 그룹
  const allGroupOptions = [...new Set([...DEFAULT_GROUPS, ...checklist.map(c => c.group)])];

  const toggle = (id) => {
    setChecklist(checklist.map(c =>
      c.id === id
        ? { ...c, done: !c.done, completedAt: !c.done ? new Date().toISOString() : null }
        : c
    ));
  };
  const removeItem = (id) => setChecklist(checklist.filter(c => c.id !== id));
  const restore = (id) => {
    setChecklist(checklist.map(c =>
      c.id === id ? { ...c, done: false, completedAt: null } : c
    ));
  };
  const add = () => {
    if (!newItem.trim()) return;
    const maxOrder = checklist
      .filter(c => c.group === newGroup && !c.done)
      .reduce((m, c) => Math.max(m, c.order ?? 0), -1);
    setChecklist([...checklist, {
      id: `todo-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      text: newItem.trim(),
      done: false,
      group: newGroup,
      order: maxOrder + 1,
      completedAt: null
    }]);
    setNewItem('');
  };
  const clearLog = () => {
    if (typeof window !== 'undefined' && window.confirm('완료 로그를 모두 삭제할까요? 복구할 수 없습니다.')) {
      setChecklist(checklist.filter(c => !c.done));
    }
  };

  // ===== 루틴 핸들러 =====
  const addRoutine = () => {
    if (!newRoutineName.trim()) return;
    setRoutines([...routines, {
      id: `routine-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      name: newRoutineName.trim(),
      history: {}
    }]);
    setNewRoutineName('');
  };
  const deleteRoutine = (id) => {
    if (typeof window !== 'undefined' && window.confirm('이 루틴을 삭제할까요? 기록도 함께 사라집니다.')) {
      setRoutines(routines.filter(r => r.id !== id));
    }
  };
  // 오늘 루틴 완료 토글
  const toggleRoutineToday = (routineId) => {
    const todayKey = getDateKey(new Date());
    setRoutines(routines.map(r => {
      if (r.id !== routineId) return r;
      const current = r.history[todayKey];
      const newHistory = { ...r.history };
      if (current === 'done') delete newHistory[todayKey];
      else newHistory[todayKey] = 'done';
      return { ...r, history: newHistory };
    }));
  };

  const todayKey = getDateKey(new Date());

  return (
    <>
      <SectionTitle kicker="TODO">{lang === 'ko' ? '할 일' : 'Tasks'}</SectionTitle>

      {active.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#7A8E7E', fontSize: 13 }}>
            {lang === 'ko' ? '할 일이 없어요. 아래에서 새로 추가해보세요.' : 'No tasks. Add one below.'}
          </div>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          {orderedGroups.map(g => {
            const items = active.filter(c => c.group === g);
            if (items.length === 0) return null;
            return (
              <div key={g} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span className="display-italic" style={{ fontSize: 16, fontWeight: 500, color: '#1F3A2E' }}>
                    {groupLabel(g)}
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(31,58,46,0.12)' }} />
                  <span style={{ fontSize: 10, color: '#7A8E7E' }}>{items.length}</span>
                </div>
                <Card style={{ padding: 6 }}>
                  <SortableContext items={items.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    {items.map((c, i) => (
                      <SortableTodoItem
                        key={c.id}
                        item={c}
                        isLast={i === items.length - 1}
                        onToggle={toggle}
                        onRemove={removeItem}
                      />
                    ))}
                  </SortableContext>
                </Card>
              </div>
            );
          })}
        </DndContext>
      )}

      {/* 추가 폼 */}
      <SectionTitle kicker="ADD">{lang === 'ko' ? '새 할 일' : 'New Task'}</SectionTitle>
      <Card>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={newItem} onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder={lang === 'ko' ? '예: 챕터 3 읽기, 단어 20개 외우기' : 'e.g., Read Chapter 3, Memorize 20 words'}
            style={{ ...inputStyle, flex: 1, minWidth: 140 }}
          />
          <select value={newGroup} onChange={(e) => setNewGroup(e.target.value)} style={{ ...inputStyle, width: 100 }}>
            {allGroupOptions.map(g => <option key={g} value={g}>{groupLabel(g)}</option>)}
          </select>
          <button onClick={add} style={primaryBtn}>
            <Plus size={14} /> {lang === 'ko' ? '추가' : 'Add'}
          </button>
        </div>
      </Card>

      {/* ===== 루틴 ===== */}
      <SectionTitle kicker="ROUTINE">{lang === 'ko' ? '매일 루틴' : 'Daily Routines'}</SectionTitle>
      <div style={{ fontSize: 11, color: '#7A8E7E', marginTop: -4, marginBottom: 10 }}>
        {lang === 'ko'
          ? <>오늘 했으면 동그라미를 탭하세요. 캘린더에 <strong style={{ color: '#1F3A2E' }}>\</strong> 표식으로 기록돼요.</>
          : <>Tap the circle when done. Marked on calendar as <strong style={{ color: '#1F3A2E' }}>\</strong>.</>}
      </div>

      {routines.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#7A8E7E', fontSize: 13 }}>
            {lang === 'ko' ? '아직 루틴이 없어요. 아래에서 추가해보세요.' : 'No routines yet. Add one below.'}
          </div>
        </Card>
      ) : (
        <Card style={{ padding: 6 }}>
          {routines.map((r, i) => {
            const isDone = r.history[todayKey] === 'done';
            const streak = getRoutineStreak(r.history);
            return (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 12px',
                borderBottom: i < routines.length - 1 ? '1px solid rgba(31,58,46,0.08)' : 'none'
              }}>
                <button onClick={() => toggleRoutineToday(r.id)} style={{
                  width: 28, height: 28, borderRadius: 14,
                  background: isDone ? '#1F3A2E' : 'transparent',
                  border: isDone ? 'none' : '2px solid rgba(31,58,46,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
                  padding: 0
                }}>
                  {isDone && <Check size={16} color="#F5EFE0" strokeWidth={3} />}
                </button>
                <span style={{
                  flex: 1, fontSize: 15,
                  color: isDone ? '#7A8E7E' : '#1F3A2E',
                  fontWeight: 500
                }}>{r.name}</span>
                {streak > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Flame size={11} color="#C45A3F" fill="#C45A3F" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#C45A3F' }}>{streak}</span>
                  </div>
                )}
                <button onClick={() => deleteRoutine(r.id)} style={iconBtn}>
                  <X size={14} color="#A8B8AB" />
                </button>
              </div>
            );
          })}
        </Card>
      )}

      {/* 루틴 추가 */}
      <Card style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={newRoutineName} onChange={(e) => setNewRoutineName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRoutine()}
            placeholder={lang === 'ko' ? '새 루틴 (예: 영자 신문 10분 읽기)' : 'New routine (e.g., Read English news 10 min)'}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={addRoutine} style={primaryBtn}>
            <Plus size={14} /> {lang === 'ko' ? '루틴' : 'Routine'}
          </button>
        </div>
      </Card>

      {/* ===== 성취 캘린더 ===== */}
      <AchievementCalendar lang={lang} checklist={checklist} routines={routines} />

      {/* 완료 로그 */}
      <SectionTitle kicker="LOG">{lang === 'ko' ? '완료 기록' : 'Completed Log'}</SectionTitle>
      <Card>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          paddingBottom: showLog && done.length > 0 ? 10 : 0,
          borderBottom: showLog && done.length > 0 ? '1px dashed rgba(31,58,46,0.15)' : 'none'
        }}>
          <div className="display" style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>
            {done.length}<span style={{ color: '#7A8E7E', fontSize: 14, fontWeight: 500 }}>
              {lang === 'ko' ? ' 건 완료' : ' done'}
            </span>
          </div>
          {done.length > 0 && (
            <button onClick={() => setShowLog(!showLog)} style={btnLink}>
              {showLog
                ? (lang === 'ko' ? '접기' : 'Collapse')
                : (lang === 'ko' ? '펼치기' : 'Expand')}
              <ChevronRight size={12} style={{ transform: showLog ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
          )}
        </div>

        {showLog && done.length > 0 && (
          <div style={{ marginTop: 4 }}>
            {done.map((c, i) => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 0',
                borderBottom: i < done.length - 1 ? '1px dashed rgba(31,58,46,0.08)' : 'none'
              }}>
                <Check size={14} color="#7A8E7E" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, color: '#7A8E7E',
                    textDecoration: 'line-through',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>{c.text}</div>
                  <div style={{ fontSize: 9, color: '#A8B8AB', letterSpacing: '0.03em', marginTop: 1 }}>
                    {groupLabel(c.group)} · {formatRelativeTime(c.completedAt)}
                  </div>
                </div>
                <button onClick={() => restore(c.id)} title={lang === 'ko' ? '복구' : 'Restore'} style={iconBtn}>
                  <RotateCcw size={12} color="#7A8E7E" />
                </button>
                <button onClick={() => removeItem(c.id)} title={lang === 'ko' ? '영구 삭제' : 'Delete permanently'} style={iconBtn}>
                  <Trash2 size={12} color="#C45A3F" />
                </button>
              </div>
            ))}
            <button onClick={clearLog} style={{
              ...btnLink, marginTop: 10, color: '#C45A3F', display: 'flex', alignItems: 'center'
            }}>
              <Trash2 size={11} style={{ marginRight: 4 }} /> {lang === 'ko' ? '로그 전체 삭제' : 'Clear all log'}
            </button>
          </div>
        )}
      </Card>
    </>
  );
}

// ============================================================
//  성취 캘린더 — 월별 그리드 + 표식 (X, /, \, 〇)
// ============================================================
function AchievementCalendar({ checklist, routines }) {
  const [monthOffset, setMonthOffset] = useState(0); // 0=이번달, -1=지난달
  const today = new Date();
  const viewDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = `${year}.${String(month+1).padStart(2,'0')}`;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  // 월요일 시작 (0=월, 6=일)
  const firstWeekday = (firstDay.getDay() + 6) % 7;

  const todayKey = getDateKey(today);
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const key = getDateKey(date);
    const isFuture = date > today && key !== todayKey;
    const ach = isFuture ? null : getDayAchievement(key, checklist, routines);
    cells.push({ day: d, key, isToday: key === todayKey, isFuture, ach });
  }

  return (
    <>
      <SectionTitle kicker="CALENDAR">성취 달력</SectionTitle>

      {/* 월 네비게이션 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={() => setMonthOffset(monthOffset - 1)} style={{
          ...iconBtn, width: 32, height: 32, borderRadius: 16,
          border: '1px solid rgba(31,58,46,0.15)'
        }}>
          <ChevronRight size={14} color="#1F3A2E" style={{ transform: 'rotate(180deg)' }} />
        </button>
        <div className="display" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>
          {monthLabel}
        </div>
        <button onClick={() => setMonthOffset(Math.min(0, monthOffset + 1))} disabled={monthOffset >= 0} style={{
          ...iconBtn, width: 32, height: 32, borderRadius: 16,
          border: '1px solid rgba(31,58,46,0.15)',
          opacity: monthOffset >= 0 ? 0.3 : 1,
          cursor: monthOffset >= 0 ? 'default' : 'pointer'
        }}>
          <ChevronRight size={14} color="#1F3A2E" />
        </button>
      </div>

      <Card style={{ padding: 14 }}>
        {/* 요일 헤더 */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4,
          marginBottom: 8
        }}>
          {['월','화','수','목','금','토','일'].map((d, i) => (
            <div key={d} style={{
              fontSize: 10, fontWeight: 600,
              color: i === 6 ? '#C45A3F' : '#7A8E7E',
              textAlign: 'center', letterSpacing: '0.05em'
            }}>{d}</div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {cells.map((cell, idx) => {
            if (!cell) return <div key={`empty-${idx}`} />;
            return (
              <div key={cell.key} style={{
                position: 'relative',
                aspectRatio: '1',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 8,
                background: cell.isToday ? 'rgba(196,90,63,0.08)' : 'transparent',
                border: cell.isToday ? '1.5px solid #C45A3F' : '1px solid transparent'
              }}>
                {/* 날짜 숫자 */}
                <span style={{
                  fontSize: 12,
                  fontWeight: cell.isToday ? 700 : 500,
                  color: cell.isFuture ? '#C8CFC8' : cell.isToday ? '#C45A3F' : '#1F3A2E',
                  zIndex: 2,
                  position: 'relative'
                }}>{cell.day}</span>

                {/* 성취 표식 — SVG 오버레이 */}
                {cell.ach && (cell.ach.x || cell.ach.slash || cell.ach.backslash || cell.ach.dot) && (
                  <svg
                    viewBox="0 0 40 40"
                    style={{
                      position: 'absolute', inset: 0, width: '100%', height: '100%',
                      pointerEvents: 'none', zIndex: 1
                    }}
                  >
                    {/* 부분 성취 동그라미 (제일 안쪽) */}
                    {cell.ach.dot && (
                      <circle cx="20" cy="20" r="14"
                        fill="none" stroke="#7A8E7E" strokeWidth="1.5" opacity="0.5" />
                    )}
                    {/* \  왼쪽위→오른쪽아래 (루틴) */}
                    {cell.ach.backslash && !cell.ach.x && (
                      <line x1="6" y1="6" x2="34" y2="34"
                        stroke="#1F3A2E" strokeWidth="2.2" strokeLinecap="round" />
                    )}
                    {/* /  오른쪽위→왼쪽아래 (영어) */}
                    {cell.ach.slash && !cell.ach.x && (
                      <line x1="34" y1="6" x2="6" y2="34"
                        stroke="#C45A3F" strokeWidth="2.2" strokeLinecap="round" />
                    )}
                    {/* X — 모두 완료 시 두꺼운 빨간 X */}
                    {cell.ach.x && (
                      <>
                        <line x1="6" y1="6" x2="34" y2="34"
                          stroke="#C45A3F" strokeWidth="3" strokeLinecap="round" />
                        <line x1="34" y1="6" x2="6" y2="34"
                          stroke="#C45A3F" strokeWidth="3" strokeLinecap="round" />
                      </>
                    )}
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* 범례 */}
      <div style={{
        marginTop: 10,
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
        fontSize: 10
      }}>
        {[
          { label: '90% 달성', svg: (
            <>
              <line x1="6" y1="6" x2="22" y2="22" stroke="#C45A3F" strokeWidth="3" strokeLinecap="round" />
              <line x1="22" y1="6" x2="6" y2="22" stroke="#C45A3F" strokeWidth="3" strokeLinecap="round" />
            </>
          )},
          { label: '루틴 완료', svg: (
            <line x1="6" y1="6" x2="22" y2="22" stroke="#1F3A2E" strokeWidth="2.2" strokeLinecap="round" />
          )},
          { label: '영어/단어', svg: (
            <line x1="22" y1="6" x2="6" y2="22" stroke="#C45A3F" strokeWidth="2.2" strokeLinecap="round" />
          )},
          { label: '부분 성취', svg: (
            <circle cx="14" cy="14" r="9" fill="none" stroke="#7A8E7E" strokeWidth="1.5" opacity="0.5" />
          )},
        ].map(item => (
          <div key={item.label} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            color: '#5C6F62'
          }}>
            <svg viewBox="0 0 28 28" style={{ width: 22, height: 22, flexShrink: 0 }}>{item.svg}</svg>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ============================================================
//  시간표 탭 — 한 주 그리드 뷰
// ============================================================
// 'HH:MM' → 분 단위 정수 (0 ~ 1439)
function timeToMinutes(t) {
  if (!t || typeof t !== 'string') return 0;
  const [h, m] = t.split(':').map(n => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}
// 분 단위 정수 → 'HH:MM'
function minutesToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
// endTime이 없으면 time + 45분으로 자동 계산 (어학원 기본 수업 길이)
function getEndTime(cls) {
  if (cls.endTime) return cls.endTime;
  return minutesToTime(Math.min(timeToMinutes(cls.time) + 45, 23 * 60 + 59));
}

function ScheduleTab({ lang = 'ko', schedule, setSchedule }) {
  const [editing, setEditing] = useState(null); // index or null
  const [form, setForm] = useState({ day: 'mon', time: '09:00', endTime: '09:45', subject: '', teacher: '', room: '', floor: '' });

  const allDays = [
    { key: 'mon', ko: '월', en: 'Mon' }, { key: 'tue', ko: '화', en: 'Tue' }, { key: 'wed', ko: '수', en: 'Wed' },
    { key: 'thu', ko: '목', en: 'Thu' }, { key: 'fri', ko: '금', en: 'Fri' }, { key: 'sat', ko: '토', en: 'Sat' }, { key: 'sun', ko: '일', en: 'Sun' }
  ];

  // 표시할 요일: 월-금 + (실제 데이터가 있으면) 토/일
  const usedDayKeys = new Set(schedule.map(s => s.day));
  const visibleDays = allDays.filter(d =>
    ['mon','tue','wed','thu','fri'].includes(d.key) || usedDayKeys.has(d.key)
  );

  // 오늘 요일 (하이라이트용)
  const todayJsDay = new Date().getDay(); // 0=일, 1=월…
  const jsDayToKey = { 0:'sun', 1:'mon', 2:'tue', 3:'wed', 4:'thu', 5:'fri', 6:'sat' };
  const todayDayKey = jsDayToKey[todayJsDay];

  // 30분 단위 그리드 — 기본 08:00 ~ 18:00.
  // 데이터가 그 범위 바깥(예: 07:30 시작, 20:00 끝)이면 범위 자동 확장.
  const SLOT_MINUTES = 30;
  let gridStartMin = 8 * 60;  // 08:00
  let gridEndMin = 18 * 60;   // 18:00 (마지막 슬롯 시작)
  for (const s of schedule) {
    const startMin = timeToMinutes(s.time);
    const endMin = timeToMinutes(getEndTime(s));
    if (startMin < gridStartMin) gridStartMin = Math.floor(startMin / SLOT_MINUTES) * SLOT_MINUTES;
    if (endMin > gridEndMin + SLOT_MINUTES) gridEndMin = Math.ceil(endMin / SLOT_MINUTES) * SLOT_MINUTES - SLOT_MINUTES;
  }
  const totalSlots = ((gridEndMin - gridStartMin) / SLOT_MINUTES) + 1; // 슬롯 개수
  const SLOT_HEIGHT = 30; // 30분당 30px → 1분당 1px
  const PIXELS_PER_MIN = SLOT_HEIGHT / SLOT_MINUTES;
  const slotTimes = Array.from({ length: totalSlots }, (_, i) => gridStartMin + i * SLOT_MINUTES);

  // 빈 칸 클릭 시 사용할 day/time 계산
  const slotKey = (time, day) => `${day}-${time}`;

  const save = () => {
    if (!form.subject.trim()) return;
    // endTime이 비어있거나 잘못된 경우 보정
    let endTime = form.endTime;
    if (!endTime || timeToMinutes(endTime) <= timeToMinutes(form.time)) {
      endTime = minutesToTime(Math.min(timeToMinutes(form.time) + 45, 23 * 60 + 59));
    }
    const next = { ...form, endTime };
    if (editing !== null) {
      setSchedule(schedule.map((s, i) => i === editing ? next : s));
    } else {
      setSchedule([...schedule, next]);
    }
    setForm({ day: 'mon', time: '09:00', endTime: '09:45', subject: '', teacher: '', room: '', floor: '' });
    setEditing(null);
  };
  const editItem = (i) => {
    const s = schedule[i];
    setForm({
      day: s.day || 'mon',
      time: s.time || '09:00',
      endTime: s.endTime || getEndTime(s),
      subject: s.subject || '',
      teacher: s.teacher || '',
      room: s.room || '',
      floor: s.floor || '',
    });
    setEditing(i);
    setTimeout(() => {
      const el = typeof document !== 'undefined' ? document.getElementById('schedule-editor') : null;
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };
  const removeItem = () => {
    if (editing !== null) {
      setSchedule(schedule.filter((_, idx) => idx !== editing));
      setForm({ day: 'mon', time: '09:00', endTime: '09:45', subject: '', teacher: '', room: '', floor: '' });
      setEditing(null);
    }
  };
  const addAtSlot = (time, day) => {
    const endTime = minutesToTime(timeToMinutes(time) + 45);
    setForm({ day, time, endTime, subject: '', teacher: '', room: '', floor: '' });
    setEditing(null);
    setTimeout(() => {
      const el = typeof document !== 'undefined' ? document.getElementById('schedule-editor') : null;
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  // 시작 시간 변경 시 끝 시간이 자동으로 +45분 따라옴 (사용자가 끝 시간을 명시적으로 바꾸기 전까지)
  const handleStartChange = (newStart) => {
    const startMin = timeToMinutes(newStart);
    const oldStartMin = timeToMinutes(form.time);
    const oldEndMin = timeToMinutes(form.endTime || getEndTime(form));
    // 기존 길이 유지 (사용자가 한 번 endTime을 직접 잡았다면 그 길이 보존)
    const duration = oldEndMin - oldStartMin;
    const newEndMin = startMin + (duration > 0 ? duration : 45);
    setForm({ ...form, time: newStart, endTime: minutesToTime(Math.min(newEndMin, 23 * 60 + 59)) });
  };

  // 수업 카테고리에 따라 색상 (간단 분류)
  const getClassColor = (subject) => {
    const s = (subject || '').toLowerCase();
    if (s.includes('speak')) return '#C45A3F';
    if (s.includes('read')) return '#5C6F62';
    if (s.includes('writ')) return '#8A5A3B';
    if (s.includes('listen')) return '#1F3A2E';
    if (s.includes('group') || s.includes('class')) return '#D4A53A';
    return '#1F3A2E';
  };

  return (
    <>
      <SectionTitle kicker="WEEKLY">{lang === 'ko' ? '시간표' : 'Schedule'}</SectionTitle>
      <div style={{ fontSize: 11, color: '#7A8E7E', marginTop: -4, marginBottom: 10 }}>
        {lang === 'ko'
          ? '수업 칸을 탭하면 수정, 빈 칸을 탭하면 그 시간에 새 수업을 추가합니다.'
          : 'Tap a class to edit, tap an empty slot to add a new class.'}
      </div>

      {/* ===== 한 주 그리드 ===== */}
      <Card style={{ padding: 8 }}>
        {/* 요일 헤더 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `26px repeat(${visibleDays.length}, 1fr)`,
          gap: 3, marginBottom: 4
        }}>
          <div />
          {visibleDays.map(d => {
            const isToday = d.key === todayDayKey;
            return (
              <div key={d.key} style={{
                textAlign: 'center',
                fontSize: 11,
                fontWeight: isToday ? 800 : 700,
                color: isToday ? '#C45A3F' : '#1F3A2E',
                padding: '6px 0 4px',
                borderBottom: isToday ? '2px solid #C45A3F' : '2px solid transparent'
              }}>
                {lang === 'ko' ? d.ko : d.en}
              </div>
            );
          })}
        </div>

        {/* 30분 단위 그리드 + 카드 절대 위치 (실제 길이대로 늘어남) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `26px repeat(${visibleDays.length}, 1fr)`,
          gap: 3,
          position: 'relative',
        }}>
          {/* 왼쪽 시간 레이블 컬럼 */}
          <div style={{ position: 'relative' }}>
            {slotTimes.map((min, i) => (
              <div key={min} className="display" style={{
                height: SLOT_HEIGHT,
                fontSize: 9,
                color: '#7A8E7E',
                fontWeight: 700,
                textAlign: 'right',
                paddingRight: 2,
                letterSpacing: '-0.02em',
                // 정시(00분)만 진하게, 30분은 흐리게
                opacity: min % 60 === 0 ? 1 : 0.45,
                lineHeight: '12px',
              }}>
                {min % 60 === 0 ? minutesToTime(min) : ''}
              </div>
            ))}
          </div>

          {/* 각 요일 컬럼 */}
          {visibleDays.map(d => {
            const isToday = d.key === todayDayKey;
            // 이 요일의 수업들
            const dayClasses = schedule
              .map((s, idx) => ({ s, idx }))
              .filter(({ s }) => s.day === d.key);

            return (
              <div key={d.key} style={{
                position: 'relative',
                background: isToday ? 'rgba(196,90,63,0.04)' : 'transparent',
                borderRadius: 6,
              }}>
                {/* 빈 슬롯들 (배경 — 클릭으로 추가) */}
                {slotTimes.map((min) => {
                  const time = minutesToTime(min);
                  return (
                    <button key={min} onClick={() => addAtSlot(time, d.key)} style={{
                      position: 'absolute',
                      top: ((min - gridStartMin) * PIXELS_PER_MIN),
                      left: 0,
                      right: 0,
                      height: SLOT_HEIGHT,
                      background: 'transparent',
                      border: 'none',
                      borderTop: min % 60 === 0
                        ? '1px solid rgba(31,58,46,0.1)'
                        : '1px dashed rgba(31,58,46,0.06)',
                      cursor: 'pointer',
                      padding: 0,
                      fontFamily: 'inherit',
                    }} aria-label={`${time} ${d.ko}요일에 추가`} />
                  );
                })}

                {/* 수업 카드 — 절대 위치 */}
                {dayClasses.map(({ s, idx }) => {
                  const startMin = timeToMinutes(s.time);
                  const endMin = timeToMinutes(getEndTime(s));
                  const top = (startMin - gridStartMin) * PIXELS_PER_MIN;
                  const height = Math.max((endMin - startMin) * PIXELS_PER_MIN, 18);
                  const bg = getClassColor(s.subject);
                  const isEditing = editing === idx;
                  // 짧은 수업(45분 미만)은 정보 축약
                  const showTeacher = height >= 40 && s.teacher;
                  const roomLine = [s.room, s.floor].filter(Boolean).join(' · ');
                  const showRoom = height >= 55 && roomLine;
                  return (
                    <button
                      key={idx}
                      onClick={(e) => { e.stopPropagation(); editItem(idx); }}
                      style={{
                        position: 'absolute',
                        top: top + 1,
                        left: 1,
                        right: 1,
                        height: height - 2,
                        background: bg,
                        color: '#F5EFE0',
                        border: isEditing ? '2px solid #F5EFE0' : 'none',
                        outline: isEditing ? `2px solid ${bg}` : 'none',
                        borderRadius: 5,
                        padding: '3px 4px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-start',
                        alignItems: 'flex-start',
                        textAlign: 'left',
                        gap: 1,
                        overflow: 'hidden',
                        fontFamily: 'inherit',
                        zIndex: 2,
                      }}
                    >
                      <div style={{ fontSize: 8, opacity: 0.75, fontWeight: 600, letterSpacing: '0.02em', lineHeight: 1 }}>
                        {s.time}–{getEndTime(s)}
                      </div>
                      <div style={{
                        fontSize: 10, fontWeight: 700, lineHeight: 1.15,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: height < 35 ? 1 : 2,
                        WebkitBoxOrient: 'vertical',
                        wordBreak: 'break-word',
                        width: '100%',
                      }}>
                        {s.subject}
                      </div>
                      {showTeacher && (
                        <div style={{
                          fontSize: 8, opacity: 0.7, lineHeight: 1.1,
                          overflow: 'hidden', textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap', maxWidth: '100%',
                        }}>
                          {s.teacher.replace('Teacher ', 'T. ')}
                        </div>
                      )}
                      {showRoom && (
                        <div style={{
                          fontSize: 8, opacity: 0.85, fontWeight: 600, lineHeight: 1.1,
                          overflow: 'hidden', textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap', maxWidth: '100%',
                        }}>
                          {roomLine}
                        </div>
                      )}
                    </button>
                  );
                })}

                {/* 컬럼 높이 확보용 spacer */}
                <div style={{ height: totalSlots * SLOT_HEIGHT, pointerEvents: 'none' }} />
              </div>
            );
          })}
        </div>

        {/* 새 시간대 추가 힌트 */}
        <div style={{
          marginTop: 8, paddingTop: 8,
          borderTop: '1px dashed rgba(31,58,46,0.1)',
          fontSize: 10, color: '#A8B8AB', textAlign: 'center'
        }}>
          빈 시간을 탭하면 그 시간에 새 수업을 추가합니다 (기본 45분)
        </div>
      </Card>

      {/* ===== 수업 카테고리 범례 ===== */}
      {schedule.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 8,
          marginTop: 10, fontSize: 10, color: '#5C6F62'
        }}>
          {[
            { label: 'Speaking', color: '#C45A3F' },
            { label: 'Reading', color: '#5C6F62' },
            { label: 'Writing', color: '#8A5A3B' },
            { label: 'Listening', color: '#1F3A2E' },
            { label: 'Group', color: '#D4A53A' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color }} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ===== 에디터 ===== */}
      <div id="schedule-editor" />
      <SectionTitle kicker={editing !== null ? "EDIT" : "ADD"}>
        {editing !== null ? '수업 수정' : '수업 추가'}
      </SectionTitle>
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={labelStyle}>요일</div>
            <select value={form.day} onChange={(e) => setForm({...form, day: e.target.value})} style={inputStyle}>
              {allDays.map(d => <option key={d.key} value={d.key}>{d.ko}요일</option>)}
            </select>
          </div>
          <div>
            <div style={labelStyle}>시작 시간</div>
            <input
              type="time"
              step="300"
              value={form.time}
              onChange={(e) => handleStartChange(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <div style={labelStyle}>끝 시간</div>
            <input
              type="time"
              step="300"
              value={form.endTime}
              onChange={(e) => setForm({...form, endTime: e.target.value})}
              style={inputStyle}
            />
          </div>
          <div style={{ gridColumn: '1 / -1', fontSize: 10, color: '#7A8E7E', marginTop: -4 }}>
            기본 45분 수업. 5분 단위로 조정 가능. 주말 긴 일정은 끝 시간을 늘려요.
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={labelStyle}>수업명</div>
            <input value={form.subject} onChange={(e) => setForm({...form, subject: e.target.value})} placeholder="예) Speaking 1:1" style={inputStyle} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={labelStyle}>선생님</div>
            <input value={form.teacher} onChange={(e) => setForm({...form, teacher: e.target.value})} placeholder="예: Teacher Maria" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>강의실</div>
            <input value={form.room} onChange={(e) => setForm({...form, room: e.target.value})} placeholder="예: G103" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>층</div>
            <input value={form.floor} onChange={(e) => setForm({...form, floor: e.target.value})} placeholder="예: B5" style={inputStyle} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={save} style={{ ...primaryBtn, flex: 1, justifyContent: 'center' }}>
            <Save size={14} /> {editing !== null ? '수정 저장' : '추가'}
          </button>
          {editing !== null && (
            <>
              <button onClick={removeItem} style={{ ...secondaryBtn, color: '#C45A3F', borderColor: 'rgba(196,90,63,0.3)' }}>
                <Trash2 size={14} />
              </button>
              <button onClick={() => { setEditing(null); setForm({ day: 'mon', time: '09:00', endTime: '09:45', subject: '', teacher: '', room: '', floor: '' }); }} style={secondaryBtn}>
                취소
              </button>
            </>
          )}
        </div>
      </Card>
    </>
  );
}

// ============================================================
//  환율 + 가계부 탭
// ============================================================
// ============================================================
//  기기 간 동기화 섹션 — 매직 링크로 이메일 연결
// ============================================================
function SyncSection({ lang = 'ko' }) {
  const t = (ko, en) => lang === 'ko' ? ko : en;
  const remembered = getRememberedEmail() || '';
  const [email, setEmail] = useState(remembered);
  const [code, setCode] = useState('');
  const [linkedEmail, setLinkedEmailState] = useState(null);
  // 풀린 적 있음을 감지 (연결됐다가 안 됨)
  const wasLinked = !!remembered;
  const [mode, setMode] = useState(wasLinked ? 'login' : 'attach'); // attach | login
  const [step, setStep] = useState('email');
  const [sentEmail, setSentEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    (async () => {
      const e = await getLinkedEmail();
      setLinkedEmailState(e);
    })();
  }, []);

  // 인증 상태가 바뀌면 (예: 코드 인증 성공으로 user swap) UI 갱신
  useEffect(() => {
    const id = setInterval(async () => {
      const e = await getLinkedEmail();
      if (e !== linkedEmail) setLinkedEmailState(e);
    }, 2000);
    return () => clearInterval(id);
  }, [linkedEmail]);

  const submitEmail = async () => {
    setMsg(null);
    setBusy(true);
    const fn = mode === 'attach' ? attachEmailToCurrentSession : sendOtpCode;
    const { ok, error } = await fn(email.trim());
    setBusy(false);
    if (ok) {
      if (mode === 'attach') {
        setMsg({
          type: 'ok',
          text: t(`${email}로 확인 메일을 보냈습니다. 메일의 링크를 한 번 눌러주세요.`,
                  `Confirmation email sent to ${email}. Open it and click the link once.`),
        });
        setEmail('');
      } else {
        setSentEmail(email.trim());
        setStep('code');
        setMsg({
          type: 'ok',
          text: t(`${email}로 인증 코드를 보냈습니다. 메일을 확인 후 아래에 입력하세요.`,
                  `Code sent to ${email}. Check your email and enter it below.`),
        });
        setEmail('');
      }
    } else {
      setMsg({ type: 'err', text: error || t('요청 실패', 'Request failed') });
    }
  };

  const submitCode = async () => {
    setMsg(null);
    setBusy(true);
    const { ok, error } = await verifyOtpCode(sentEmail, code);
    setBusy(false);
    if (ok) {
      setMsg({ type: 'ok', text: t('연결되었어요. 데이터를 가져오는 중...', 'Linked. Fetching data...') });
      setCode('');
      setTimeout(() => { if (typeof window !== 'undefined') window.location.reload(); }, 1000);
    } else {
      setMsg({ type: 'err', text: error || t('코드가 올바르지 않습니다.', 'Invalid code.') });
    }
  };

  return (
    <>
      <SectionTitle kicker="SYNC">{t('기기 간 동기화', 'Device Sync')}</SectionTitle>
      <Card>
        {linkedEmail ? (
          <>
            <div style={{ fontSize: 13, color: '#1F3A2E', marginBottom: 6 }}>
              <strong>{linkedEmail}</strong> {t('에 연결됨', 'linked')}
            </div>
            <div style={{ fontSize: 11, color: '#7A8E7E', lineHeight: 1.5, marginBottom: 12 }}>
              {t('다른 기기에서 이 이메일로 인증 코드를 받으면 같은 데이터를 볼 수 있어요.',
                  'On other devices, request a code with this email to view the same data.')}
            </div>
            {step === 'email' ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder={linkedEmail}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  onClick={() => { setMode('login'); submitEmail(); }}
                  disabled={busy || !email}
                  style={primaryBtn}
                >{t('코드 보내기', 'Send Code')}</button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text" inputMode="numeric" maxLength={8}
                    value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder={t('인증 코드', 'Code')}
                    style={{ ...inputStyle, flex: 1, fontSize: 18, letterSpacing: '0.3em', textAlign: 'center' }}
                  />
                  <button onClick={submitCode} disabled={busy || code.length < 6} style={primaryBtn}>{t('인증', 'Verify')}</button>
                </div>
                <button
                  onClick={() => { setStep('email'); setCode(''); setMsg(null); }}
                  style={{ background: 'none', border: 'none', color: '#7A8E7E', fontSize: 11, marginTop: 8, cursor: 'pointer', padding: 0 }}
                >← {t('이메일 다시 입력', 'Re-enter email')}</button>
              </div>
            )}
          </>
        ) : (
          <>
            {wasLinked ? (
              <div style={{
                fontSize: 12, lineHeight: 1.5, marginBottom: 12,
                padding: '10px 12px', borderRadius: 8,
                background: 'rgba(196,90,63,0.08)', color: '#C45A3F',
              }}>
                {t(`세션이 끊겼어요. ${remembered} 로 코드를 받아 다시 연결해주세요.`,
                    `Session expired. Re-link with ${remembered} by requesting a new code.`)}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: '#7A8E7E', lineHeight: 1.5, marginBottom: 12 }}>
                {t('이메일을 연결하면 다른 기기 (폰·태블릿·다른 노트북) 에서도 같은 데이터를 볼 수 있어요. 지금 이 기기에 쌓아둔 데이터는 그대로 유지됩니다.',
                    'Link an email to see the same data on other devices (phone, tablet, another laptop). Your current data on this device stays.')}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              {[
                { id: 'attach', label: t('이 기기에 이메일 연결', 'Link email here') },
                { id: 'login', label: t('다른 기기 데이터 받기', 'Get data from other device') },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => { setMode(opt.id); setStep('email'); setMsg(null); }}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    border: '1px solid ' + (mode === opt.id ? '#1F3A2E' : 'rgba(31,58,46,0.15)'),
                    borderRadius: 8,
                    background: mode === opt.id ? '#1F3A2E' : 'transparent',
                    color: mode === opt.id ? '#F5EFE0' : '#1F3A2E',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >{opt.label}</button>
              ))}
            </div>
            {step === 'email' ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button onClick={submitEmail} disabled={busy || !email} style={primaryBtn}>
                  {busy ? t('전송 중...', 'Sending...') : (mode === 'attach' ? t('메일 보내기', 'Send Email') : t('코드 보내기', 'Send Code'))}
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text" inputMode="numeric" maxLength={8}
                    value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder={t('인증 코드', 'Code')}
                    style={{ ...inputStyle, flex: 1, fontSize: 18, letterSpacing: '0.3em', textAlign: 'center' }}
                  />
                  <button onClick={submitCode} disabled={busy || code.length < 6} style={primaryBtn}>{t('인증', 'Verify')}</button>
                </div>
                <button
                  onClick={() => { setStep('email'); setCode(''); setMsg(null); }}
                  style={{ background: 'none', border: 'none', color: '#7A8E7E', fontSize: 11, marginTop: 8, cursor: 'pointer', padding: 0 }}
                >← {t('이메일 다시 입력', 'Re-enter email')}</button>
              </div>
            )}
          </>
        )}
        {msg && (
          <div style={{
            marginTop: 12, padding: '8px 12px', borderRadius: 8, fontSize: 12,
            background: msg.type === 'ok' ? 'rgba(31,58,46,0.06)' : 'rgba(196,90,63,0.1)',
            color: msg.type === 'ok' ? '#1F3A2E' : '#C45A3F',
            lineHeight: 1.5,
          }}>
            {msg.text}
          </div>
        )}
      </Card>
    </>
  );
}

function MoneyTab({ lang = 'ko', phpRate, setPhpRate, rateUpdated, setRateUpdated, expenses, setExpenses, tripStart, setTripStart, tripEnd, setTripEnd }) {
  const [amount, setAmount] = useState('100');
  const [direction, setDirection] = useState('php_to_krw'); // or krw_to_php
  const [newExp, setNewExp] = useState({ desc: '', amount: '', currency: 'PHP', category: '식비' });
  const [editRate, setEditRate] = useState(false);
  const [draftRate, setDraftRate] = useState(phpRate.toString());

  const converted = useMemo(() => {
    const v = parseFloat(amount) || 0;
    return direction === 'php_to_krw' ? v * phpRate : v / phpRate;
  }, [amount, phpRate, direction]);

  const addExp = () => {
    if (!newExp.desc.trim() || !newExp.amount) return;
    setExpenses([{
      ...newExp,
      amount: parseFloat(newExp.amount),
      date: new Date().toISOString().slice(0, 10),
      id: Date.now()
    }, ...expenses]);
    setNewExp({ desc: '', amount: '', currency: 'PHP', category: '식비' });
  };
  const removeExp = (id) => setExpenses(expenses.filter(e => e.id !== id));

  const byCategory = expenses.reduce((acc, e) => {
    const amt = e.currency === 'PHP' ? e.amount : e.amount / phpRate;
    acc[e.category] = (acc[e.category] || 0) + amt;
    return acc;
  }, {});
  const totalPhp = Object.values(byCategory).reduce((s, v) => s + v, 0);

  return (
    <>
      {/* 환율 카드 */}
      <SectionTitle kicker="RATE">{lang === 'ko' ? '환율' : 'Exchange Rate'}</SectionTitle>
      <Card accent>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 10, opacity: 0.7, letterSpacing: '0.15em' }}>1 PHP =</div>
            {!editRate ? (
              <div className="display" style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, color: '#F5EFE0' }}>
                ₩{phpRate.toFixed(2)}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number" step="0.01"
                  value={draftRate} onChange={(e) => setDraftRate(e.target.value)}
                  style={{ ...inputStyle, width: 100, color: '#1F3A2E', fontSize: 18, fontWeight: 700 }}
                />
                <button onClick={() => {
                  const v = parseFloat(draftRate);
                  if (v > 0) { setPhpRate(v); setRateUpdated(new Date().toISOString().slice(0,10)); }
                  setEditRate(false);
                }} style={{ ...primaryBtn, background: '#C45A3F', color: '#F5EFE0' }}>
                  <Save size={12} />
                </button>
              </div>
            )}
            <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>마지막 업데이트: {rateUpdated || '—'}</div>
          </div>
          <button onClick={() => { setEditRate(!editRate); setDraftRate(phpRate.toString()); }} style={{
            background: 'rgba(245,239,224,0.12)', color: '#F5EFE0', border: 'none',
            borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4
          }}>
            <RefreshCw size={12} /> 수정
          </button>
        </div>
      </Card>

      {/* 변환 계산기 */}
      <SectionTitle kicker="CONVERTER">{lang === 'ko' ? '환전 계산' : 'Converter'}</SectionTitle>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <input
            type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
            style={{ ...inputStyle, flex: 1, fontSize: 22, fontWeight: 600, fontFamily: "'Fraunces', serif", textAlign: 'right' }}
          />
          <span style={{ fontWeight: 600, fontSize: 14, color: '#7A8E7E' }}>
            {direction === 'php_to_krw' ? 'PHP' : 'KRW'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <button onClick={() => setDirection(direction === 'php_to_krw' ? 'krw_to_php' : 'php_to_krw')} style={{
            background: '#1F3A2E', color: '#F5EFE0', border: 'none',
            borderRadius: '50%', width: 36, height: 36, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <ArrowRightLeft size={16} />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#F5EFE0', borderRadius: 10 }}>
          <div className="display" style={{ flex: 1, fontSize: 22, fontWeight: 700, textAlign: 'right', color: '#C45A3F' }}>
            {direction === 'php_to_krw'
              ? `₩${converted.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
              : `₱${converted.toFixed(2)}`}
          </div>
          <span style={{ fontWeight: 600, fontSize: 14, color: '#7A8E7E' }}>
            {direction === 'php_to_krw' ? 'KRW' : 'PHP'}
          </span>
        </div>
      </Card>

      {/* 가계부 */}
      <SectionTitle kicker="LEDGER">가계부</SectionTitle>
      <Card>
        {/* 카테고리별 요약 */}
        {totalPhp > 0 && (
          <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px dashed rgba(31,58,46,0.15)' }}>
            <div className="display" style={{ fontSize: 24, fontWeight: 700 }}>
              ₱{totalPhp.toFixed(0)}
              <span style={{ fontSize: 13, color: '#7A8E7E', marginLeft: 8 }}>
                · ₩{(totalPhp * phpRate).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 10, height: 6, borderRadius: 3, overflow: 'hidden' }}>
              {Object.entries(byCategory).map(([cat, amt], i) => {
                const colors = ['#C45A3F','#1F3A2E','#D4A53A','#5C6F62','#8A5A3B'];
                return <div key={cat} style={{ width: `${(amt/totalPhp)*100}%`, background: colors[i % colors.length] }} />;
              })}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {Object.entries(byCategory).sort((a,b) => b[1]-a[1]).map(([cat, amt], i) => {
                const colors = ['#C45A3F','#1F3A2E','#D4A53A','#5C6F62','#8A5A3B'];
                return (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: colors[i % colors.length] }} />
                    <span>{cat}</span>
                    <span style={{ color: '#7A8E7E' }}>₱{amt.toFixed(0)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 추가 폼 */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
          <input value={newExp.desc} onChange={(e) => setNewExp({...newExp, desc: e.target.value})} placeholder="내용 (예: 점심 silog)" style={inputStyle} />
          <input type="number" value={newExp.amount} onChange={(e) => setNewExp({...newExp, amount: e.target.value})} placeholder="금액" style={inputStyle} />
          <select value={newExp.category} onChange={(e) => setNewExp({...newExp, category: e.target.value})} style={inputStyle}>
            {['식비','교통','학원','쇼핑','관광','기타'].map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={newExp.currency} onChange={(e) => setNewExp({...newExp, currency: e.target.value})} style={inputStyle}>
            <option value="PHP">PHP</option>
            <option value="KRW">KRW</option>
          </select>
        </div>
        <button onClick={addExp} style={{ ...primaryBtn, marginTop: 10, width: '100%', justifyContent: 'center' }}>
          <Plus size={14} /> 기록 추가
        </button>
      </Card>

      {/* 지출 내역 */}
      {expenses.length > 0 && (
        <>
          <SectionTitle kicker="HISTORY">내역</SectionTitle>
          <Card style={{ padding: 4 }}>
            {expenses.map((e) => (
              <div key={e.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px',
                borderBottom: '1px dashed rgba(31,58,46,0.08)'
              }}>
                <div style={{
                  fontSize: 9, padding: '3px 7px', borderRadius: 10,
                  background: '#1F3A2E', color: '#F5EFE0', letterSpacing: '0.05em', fontWeight: 600
                }}>{e.category}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{e.desc}</div>
                  <div style={{ fontSize: 10, color: '#7A8E7E' }}>{e.date}</div>
                </div>
                <div className="display" style={{ fontSize: 15, fontWeight: 600 }}>
                  {e.currency === 'PHP' ? '₱' : '₩'}{e.amount.toFixed(e.currency === 'PHP' ? 0 : 0)}
                </div>
                <button onClick={() => removeExp(e.id)} style={iconBtn}><X size={13} color="#7A8E7E" /></button>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* 학기 기간 */}
      <SectionTitle kicker="PROGRAM">{lang === 'ko' ? '학기 기간' : 'Program Period'}</SectionTitle>
      <Card style={{ padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: '#7A8E7E', marginBottom: 4, fontWeight: 600 }}>시작</div>
            <input type="date" value={tripStart} onChange={(e) => setTripStart(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#7A8E7E', marginBottom: 4, fontWeight: 600 }}>종료</div>
            <input type="date" value={tripEnd} onChange={(e) => setTripEnd(e.target.value)} style={inputStyle} />
          </div>
        </div>
      </Card>

      <SyncSection lang={lang} />
    </>
  );
}

// ============================================================
//  영어 학습 탭 — 표현 + 글쓰기
// ============================================================
// ============================================================
//  Diary 섹션 — 한·영 일기 목록 + 마크다운 붙여넣기 + 상세 보기
// ============================================================
// 저장된 일기 페어에서 ko/en이 뒤집혀 있으면 자동으로 바로잡음.
// 새 일기는 파서가 이미 분류해서 저장하지만, 기존에 잘못 저장된 일기도
// 표시 시점에 한 번 더 분류해서 화면엔 항상 한국어=작게, 영어=크게로 표시.
function ensureKoEnOrder(pair) {
  const koRatio = (text) => {
    if (!text) return 0;
    const ko = (text.match(/[가-힣]/g) || []).length;
    const en = (text.match(/[A-Za-z]/g) || []).length;
    if (ko + en === 0) return 0.5;
    return ko / (ko + en);
  };
  const ra = koRatio(pair.ko);
  const rb = koRatio(pair.en);
  // ko 자리의 한국어 비율이 en 자리보다 낮으면 뒤집혀 있는 것 → 스왑
  if (ra < rb) return { ko: pair.en, en: pair.ko };
  return pair;
}

function DiarySection({ lang = 'ko', diaries, saveDiary, deleteDiary, pendingOpenId, onPendingOpenConsumed }) {
  const t = (ko, en) => lang === 'ko' ? ko : en;
  const [view, setView] = useState('list'); // list | add | detail
  const [openId, setOpenId] = useState(null);

  // 외부에서 "이 일기 열어"라는 신호가 오면 자동으로 detail view로
  useEffect(() => {
    if (pendingOpenId) {
      // 해당 일기가 실제로 있을 때만 점프
      if (diaries.some(d => d.id === pendingOpenId)) {
        setOpenId(pendingOpenId);
        setView('detail');
      }
      onPendingOpenConsumed && onPendingOpenConsumed();
    }
  }, [pendingOpenId, diaries, onPendingOpenConsumed]);
  // 추가 모달 상태
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [raw, setRaw] = useState('');
  const [parsed, setParsed] = useState(null);

  const sorted = [...diaries].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const goAdd = () => {
    setDate(new Date().toISOString().slice(0, 10));
    setRaw('');
    setParsed(null);
    setView('add');
  };
  const goPreview = () => {
    if (!raw.trim()) return;
    const p = parseDiaryMarkdown(raw);
    setParsed(p);
  };
  const goSave = () => {
    if (!parsed) return;
    const diary = {
      id: `diary-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date,
      title: parsed.title || t('제목 없음', 'Untitled'),
      paragraphs: parsed.paragraphs,
      vocabulary: parsed.vocabulary,
      phrasal_verbs: parsed.phrasal_verbs,
      expressions: parsed.expressions,
      raw,
      createdAt: new Date().toISOString(),
    };
    const phrases = diaryToPhrases(diary);
    saveDiary(diary, phrases);
    setView('list');
    setRaw('');
    setParsed(null);
  };

  // 상세 보기
  if (view === 'detail' && openId) {
    const d = diaries.find(x => x.id === openId);
    if (!d) { setView('list'); setOpenId(null); return null; }
    return (
      <>
        <button onClick={() => { setView('list'); setOpenId(null); }} style={{
          background: 'none', border: 'none', color: '#7A8E7E', fontSize: 12,
          marginBottom: 8, cursor: 'pointer', padding: 0,
        }}>← {t('목록으로', 'Back to list')}</button>
        <SectionTitle kicker={d.date}>{d.title}</SectionTitle>

        {/* 본문 페어들 — 표시 시점에 한 번 더 한·영 자동 분류 (이전에 뒤집혀 저장된 일기도 바로잡음) */}
        <Card style={{ padding: 18 }}>
          {d.paragraphs.map((p, i) => {
            const fixed = ensureKoEnOrder(p);
            return (
              <div key={i} style={{ marginBottom: i < d.paragraphs.length - 1 ? 22 : 0 }}>
                {fixed.ko && (
                  <div style={{ fontSize: 12, color: '#7A8E7E', lineHeight: 1.6, marginBottom: 6 }}>
                    {fixed.ko}
                  </div>
                )}
                {fixed.en && (
                  <div style={{ fontSize: 15, color: '#1F3A2E', lineHeight: 1.6, fontWeight: 500 }}>
                    {fixed.en}
                  </div>
                )}
              </div>
            );
          })}
        </Card>

        {/* Vocabulary */}
        {d.vocabulary && d.vocabulary.length > 0 && (
          <>
            <SectionTitle kicker={`VOCABULARY (${d.vocabulary.length})`}>{t('단어', 'Vocabulary')}</SectionTitle>
            <Card style={{ padding: 4 }}>
              {d.vocabulary.map((v, i) => (
                <div key={i} style={{
                  padding: '10px 12px',
                  borderBottom: i < d.vocabulary.length - 1 ? '1px dashed rgba(31,58,46,0.1)' : 'none',
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{v.word}</div>
                  <div style={{ fontSize: 12, color: '#C45A3F', marginTop: 2 }}>{v.meaning}</div>
                  {v.example && (
                    <div style={{ fontSize: 11, color: '#7A8E7E', marginTop: 4, fontStyle: 'italic' }}>
                      "{v.example}"
                    </div>
                  )}
                </div>
              ))}
            </Card>
          </>
        )}

        {/* Phrasal Verbs */}
        {d.phrasal_verbs && d.phrasal_verbs.length > 0 && (
          <>
            <SectionTitle kicker={`PHRASAL VERBS (${d.phrasal_verbs.length})`}>{t('구동사', 'Phrasal Verbs')}</SectionTitle>
            <Card style={{ padding: 4 }}>
              {d.phrasal_verbs.map((p, i) => (
                <div key={i} style={{
                  padding: '10px 12px',
                  borderBottom: i < d.phrasal_verbs.length - 1 ? '1px dashed rgba(31,58,46,0.1)' : 'none',
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#C45A3F' }}>{p.verb}</div>
                  <div style={{ fontSize: 12, color: '#1F3A2E', marginTop: 2 }}>{p.meaning}</div>
                  {p.example && (
                    <div style={{ fontSize: 11, color: '#7A8E7E', marginTop: 4, fontStyle: 'italic' }}>
                      "{p.example}"
                    </div>
                  )}
                </div>
              ))}
            </Card>
          </>
        )}

        {/* Expressions */}
        {d.expressions && d.expressions.length > 0 && (
          <>
            <SectionTitle kicker={`EXPRESSIONS (${d.expressions.length})`}>{t('표현', 'Useful Expressions')}</SectionTitle>
            <Card style={{ padding: 4 }}>
              {d.expressions.map((e, i) => (
                <div key={i} style={{
                  padding: '10px 12px',
                  borderBottom: i < d.expressions.length - 1 ? '1px dashed rgba(31,58,46,0.1)' : 'none',
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{e.expression}</div>
                  <div style={{ fontSize: 12, color: '#C45A3F', marginTop: 2 }}>{e.meaning}</div>
                  {e.note && (
                    <div style={{ fontSize: 11, color: '#7A8E7E', marginTop: 4 }}>
                      {t('노트', 'Note')}: {e.note}
                    </div>
                  )}
                </div>
              ))}
            </Card>
          </>
        )}

        <Card style={{ marginTop: 12 }}>
          <button
            onClick={() => { deleteDiary(d.id); setView('list'); setOpenId(null); }}
            style={{ ...secondaryBtn, color: '#C45A3F', borderColor: 'rgba(196,90,63,0.3)', width: '100%', justifyContent: 'center' }}
          >
            <Trash2 size={14} /> {t('일기 삭제', 'Delete diary')}
          </button>
        </Card>
      </>
    );
  }

  // 추가 모달
  if (view === 'add') {
    return (
      <>
        <button onClick={() => setView('list')} style={{
          background: 'none', border: 'none', color: '#7A8E7E', fontSize: 12,
          marginBottom: 8, cursor: 'pointer', padding: 0,
        }}>← {t('취소', 'Cancel')}</button>
        <SectionTitle kicker="NEW">{t('새 일기 붙여넣기', 'New Diary (paste)')}</SectionTitle>

        <Card>
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <div style={labelStyle}>{t('날짜', 'Date')}</div>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>{t('마크다운 붙여넣기', 'Paste markdown')}</div>
              <textarea
                value={raw}
                onChange={(e) => { setRaw(e.target.value); setParsed(null); }}
                placeholder={`# ${t('제목', 'Title')}\n\n${t('한국어 문단', 'Korean paragraph')}\n\n${t('영어 문단', 'English paragraph')}\n\n...\n\n## Vocabulary\n| Word | Meaning | Example |\n| --- | --- | --- |\n| ... | ... | ... |`}
                style={{
                  ...inputStyle,
                  minHeight: 220, fontFamily: 'ui-monospace, monospace',
                  fontSize: 12, lineHeight: 1.5, resize: 'vertical',
                }}
              />
            </div>
            <button onClick={goPreview} disabled={!raw.trim()} style={{ ...primaryBtn, justifyContent: 'center' }}>
              {t('미리보기', 'Preview')} →
            </button>
          </div>
        </Card>

        {parsed && (
          <>
            <SectionTitle kicker="PREVIEW">{t('파싱 결과', 'Preview')}</SectionTitle>
            <Card>
              <div style={{ fontSize: 13, marginBottom: 8 }}>
                <strong>{t('제목', 'Title')}:</strong> {parsed.title || <span style={{ color: '#C45A3F' }}>{t('(없음)', '(missing)')}</span>}
              </div>
              <div style={{ fontSize: 12, color: '#5C6F62', lineHeight: 1.8 }}>
                {t('본문 페어', 'Paragraph pairs')}: <strong>{parsed.paragraphs.length}</strong><br />
                {t('단어', 'Vocabulary')}: <strong>{parsed.vocabulary.length}</strong><br />
                {t('구동사', 'Phrasal Verbs')}: <strong>{parsed.phrasal_verbs.length}</strong><br />
                {t('표현', 'Expressions')}: <strong>{parsed.expressions.length}</strong>
              </div>
              {parsed.warnings.length > 0 && (
                <div style={{
                  marginTop: 12, padding: '8px 12px', borderRadius: 8,
                  background: 'rgba(196,90,63,0.08)', color: '#C45A3F',
                  fontSize: 11, lineHeight: 1.6,
                }}>
                  ⚠️ {t('주의', 'Warnings')}:
                  <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                    {parsed.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
              <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                <button onClick={goSave} style={{ ...primaryBtn, flex: 1, justifyContent: 'center' }}>
                  <Save size={14} /> {t('저장', 'Save')}
                </button>
                <button onClick={() => setParsed(null)} style={secondaryBtn}>{t('다시 파싱', 'Re-parse')}</button>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: '#7A8E7E', lineHeight: 1.5 }}>
                {t('저장하면 단어 · 구동사 · 표현이 자동으로 단어장(Phrases)에 추가돼요.',
                    'On save, vocabulary, phrasal verbs, and expressions are auto-added to your Wordbook (Phrases).')}
              </div>
            </Card>
          </>
        )}
      </>
    );
  }

  // 목록
  return (
    <>
      <SectionTitle kicker="DIARY">{t('일기', 'Diary')}</SectionTitle>

      <Card style={{ marginBottom: 12 }}>
        <button onClick={goAdd} style={{ ...primaryBtn, width: '100%', justifyContent: 'center', padding: '14px' }}>
          <Plus size={16} /> {t('새 일기 추가', 'New Diary')}
        </button>
      </Card>

      {sorted.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#7A8E7E', fontSize: 13, lineHeight: 1.6 }}>
            {t('아직 일기가 없어요.', 'No diaries yet.')}<br />
            {t('한·영 병기 마크다운을 붙여넣으면', 'Paste a Korean/English markdown')}<br />
            {t('단어와 표현이 자동으로 정리됩니다.', 'and vocabulary will be organized automatically.')}
          </div>
        </Card>
      ) : (
        <Card style={{ padding: 4 }}>
          {sorted.map((d, i) => (
            <button
              key={d.id}
              onClick={() => { setOpenId(d.id); setView('detail'); }}
              style={{
                width: '100%', textAlign: 'left',
                padding: '14px 16px',
                background: 'transparent', border: 'none',
                borderBottom: i < sorted.length - 1 ? '1px dashed rgba(31,58,46,0.1)' : 'none',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <div className="display" style={{ fontSize: 15, fontWeight: 600, color: '#1F3A2E', lineHeight: 1.3 }}>
                  {d.title}
                </div>
                <div style={{ fontSize: 11, color: '#7A8E7E', flexShrink: 0 }}>{d.date}</div>
              </div>
              <div style={{ fontSize: 10, color: '#7A8E7E', marginTop: 6, letterSpacing: '0.03em' }}>
                {t('단어', 'Vocab')} {d.vocabulary?.length || 0} · {t('구동사', 'PV')} {d.phrasal_verbs?.length || 0} · {t('표현', 'Expr')} {d.expressions?.length || 0}
              </div>
            </button>
          ))}
        </Card>
      )}
    </>
  );
}

function EnglishTab({ lang = 'ko', vocab, setVocab, articles, setArticles, diaries = [], setDiaries = () => {} }) {
  const t = (ko, en) => lang === 'ko' ? ko : en;
  const [section, setSection] = useState('phrases'); // phrases | writing | diary
  const [showLearned, setShowLearned] = useState(false); // Phrases: 외운 것 보기 토글
  const [pendingDiaryOpen, setPendingDiaryOpen] = useState(null); // 일기로 점프 신호

  // 단어 카드 → 일기 상세로 점프
  const jumpToDiary = (diaryId) => {
    setPendingDiaryOpen(diaryId);
    setSection('diary');
  };

  // 표현 (phrases) 상태
  const [cat, setCat] = useState('전체');
  const [mode, setMode] = useState('list');
  const [flashIdx, setFlashIdx] = useState(0);
  const [flashSide, setFlashSide] = useState('en');
  const [newCard, setNewCard] = useState({ cat: '교실', en: '', ko: '' });

  // 글쓰기 (writing) 상태
  const [editingId, setEditingId] = useState(null); // null | 'new' | <id>
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');

  const cats = ['전체', ...new Set(vocab.map(v => v.cat))];
  // 카테고리 + 외운 것 토글 필터
  const filtered = vocab.filter(v => {
    if (cat !== '전체' && v.cat !== cat) return false;
    // 외운 것 보기 OFF면 안 외운 것만, ON이면 다 보임
    if (!showLearned && v.learned === true) return false;
    return true;
  });
  // 카테고리 라벨 (영문 모드일 때 자주 쓰는 한글 카테고리만 매핑)
  const catLabel = (c) => {
    if (lang === 'ko' || c === '전체') return c === '전체' ? t('전체', 'All') : c;
    const map = { '단어': 'Words', '구동사': 'Phrasal Verbs', '표현': 'Expressions', '교실': 'Class', '식당': 'Food', '교통': 'Transit', '쇼핑': 'Shopping', '일상': 'Daily', '필리핀어': 'Filipino' };
    return map[c] || c;
  };

  const next = () => { setFlashSide('en'); setFlashIdx((flashIdx + 1) % filtered.length); };
  const prev = () => { setFlashSide('en'); setFlashIdx((flashIdx - 1 + filtered.length) % filtered.length); };

  const addCard = () => {
    if (!newCard.en.trim() || !newCard.ko.trim()) return;
    setVocab([{ ...newCard }, ...vocab]);
    setNewCard({ cat: newCard.cat, en: '', ko: '' });
  };
  const removeCard = (en) => setVocab(vocab.filter(v => v.en !== en));
  // 외움 토글
  const toggleLearned = (en) => {
    setVocab(vocab.map(v =>
      v.en === en
        ? { ...v, learned: !v.learned, learnedAt: !v.learned ? new Date().toISOString() : null }
        : v
    ));
  };

  // Diary 저장 (DiarySection이 부른다)
  const saveDiary = (diary, phrasesToAdd) => {
    setDiaries([diary, ...diaries]);
    // 중복(en이 이미 있는 것) 제외하고 Phrases에 통합
    const existingEnSet = new Set(vocab.map(v => v.en));
    const fresh = phrasesToAdd.filter(p => !existingEnSet.has(p.en));
    if (fresh.length > 0) setVocab([...fresh, ...vocab]);
  };
  const deleteDiary = (id) => {
    if (typeof window !== 'undefined' && window.confirm(t('이 일기를 삭제할까요? 단어장에 추가된 단어는 그대로 남습니다.', 'Delete this diary? Words added to your wordbook will stay.'))) {
      setDiaries(diaries.filter(d => d.id !== id));
    }
  };

  // 글쓰기 핸들러
  const startNewArticle = () => {
    setEditingId('new');
    setDraftTitle('');
    setDraftContent('');
  };
  const startEditArticle = (article) => {
    setEditingId(article.id);
    setDraftTitle(article.title);
    setDraftContent(article.content);
  };
  const saveArticle = () => {
    if (!draftTitle.trim() && !draftContent.trim()) {
      setEditingId(null);
      return;
    }
    const now = new Date().toISOString();
    const title = draftTitle.trim() || '제목 없음';
    if (editingId === 'new') {
      setArticles([{
        id: `art-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        title, content: draftContent,
        createdAt: now, updatedAt: now
      }, ...articles]);
    } else {
      setArticles(articles.map(a =>
        a.id === editingId
          ? { ...a, title, content: draftContent, updatedAt: now }
          : a
      ));
    }
    setEditingId(null);
  };
  const deleteArticle = (id) => {
    if (typeof window !== 'undefined' && window.confirm('이 글을 삭제할까요?')) {
      setArticles(articles.filter(a => a.id !== id));
      setEditingId(null);
    }
  };

  return (
    <>
      <SectionTitle kicker="STUDY">{t('영어', 'English')}</SectionTitle>

      {/* 섹션 토글: 표현 / 글쓰기 / 일기 */}
      <Card style={{ padding: 4, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { k: 'phrases', l: t('표현', 'Phrases'), i: Languages },
            { k: 'writing', l: t('글쓰기', 'Writing'), i: Pencil },
            { k: 'diary', l: t('일기', 'Diary'), i: FileText },
          ].map(s => (
            <button key={s.k} onClick={() => { setSection(s.k); setEditingId(null); }} style={{
              flex: 1, padding: '11px 8px',
              background: section === s.k ? '#1F3A2E' : 'transparent',
              color: section === s.k ? '#F5EFE0' : '#1F3A2E',
              border: 'none', borderRadius: 10, cursor: 'pointer',
              fontSize: 11, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5
            }}>
              <s.i size={13} /> {s.l}
            </button>
          ))}
        </div>
      </Card>

      {/* ===== 표현 섹션 ===== */}
      {section === 'phrases' && (
        <>
          {/* 모드 토글 + 외운 것 보기 */}
          <Card style={{ padding: 4, marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {[{k:'list', l: t('목록', 'List')}, {k:'flash', l: t('플래시카드', 'Flashcard')}].map(m => (
                <button key={m.k} onClick={() => setMode(m.k)} style={{
                  flex: 1, padding: '10px',
                  background: mode === m.k ? '#5C6F62' : 'transparent',
                  color: mode === m.k ? '#F5EFE0' : '#1F3A2E',
                  border: 'none', borderRadius: 10, cursor: 'pointer',
                  fontSize: 11, fontWeight: 600
                }}>{m.l}</button>
              ))}
              <button
                onClick={() => setShowLearned(!showLearned)}
                title={showLearned ? t('외운 것 보임 ON', 'Showing learned') : t('외운 것 숨김', 'Learned hidden')}
                style={{
                  padding: '8px 12px',
                  background: showLearned ? '#C45A3F' : 'transparent',
                  color: showLearned ? '#F5EFE0' : '#7A8E7E',
                  border: '1px solid ' + (showLearned ? '#C45A3F' : 'rgba(31,58,46,0.15)'),
                  borderRadius: 10, cursor: 'pointer',
                  fontSize: 11, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                {showLearned ? '★' : '☆'} {t('외움', 'Learned')}
              </button>
            </div>
          </Card>

          {/* 카테고리 칩 */}
          <div className="scrollbar-hidden" style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12, paddingBottom: 4 }}>
            {cats.map(c => (
              <button key={c} onClick={() => { setCat(c); setFlashIdx(0); }} style={{
                background: cat === c ? '#C45A3F' : '#FAF7EC',
                color: cat === c ? '#F5EFE0' : '#1F3A2E',
                border: '1px solid rgba(31,58,46,0.1)',
                borderRadius: 100, padding: '6px 14px', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', whiteSpace: 'nowrap'
              }}>{catLabel(c)}</button>
            ))}
          </div>

          {/* 플래시카드 모드 */}
          {mode === 'flash' && filtered.length > 0 && (
            <>
              <Card style={{ minHeight: 220, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', padding: 28 }}
                onClick={() => setFlashSide(flashSide === 'en' ? 'ko' : 'en')}>
                <div style={{ fontSize: 10, color: '#7A8E7E', letterSpacing: '0.15em', marginBottom: 14 }}>
                  {flashIdx + 1} / {filtered.length} · {filtered[flashIdx].cat}
                </div>
                {flashSide === 'en' ? (
                  <div className="display" style={{ fontSize: 22, fontWeight: 500, textAlign: 'center', lineHeight: 1.3 }}>
                    {filtered[flashIdx].en}
                  </div>
                ) : (
                  <div className="display-italic" style={{ fontSize: 22, color: '#C45A3F', textAlign: 'center', lineHeight: 1.3 }}>
                    {filtered[flashIdx].ko}
                  </div>
                )}
                <div style={{ marginTop: 18, fontSize: 10, color: '#7A8E7E', letterSpacing: '0.1em' }}>
                  TAP TO {flashSide === 'en' ? '한국어' : 'ENGLISH'}
                </div>
              </Card>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={prev} style={{ ...secondaryBtn, flex: 1, justifyContent: 'center' }}>← 이전</button>
                <button onClick={next} style={{ ...primaryBtn, flex: 1, justifyContent: 'center' }}>다음 →</button>
              </div>
            </>
          )}

          {/* 리스트 모드 */}
          {mode === 'list' && (
            filtered.length === 0 ? (
              <Card>
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#7A8E7E', fontSize: 13 }}>
                  {showLearned
                    ? t('항목이 없어요.', 'No items.')
                    : t('안 외운 단어가 없어요. 우상단 ★ 외움 토글로 외운 단어도 보기.', 'No unlearned items. Tap ★ Learned to show learned.')}
                </div>
              </Card>
            ) : (
              <Card style={{ padding: 4 }}>
                {filtered.map((v, i) => {
                  const learned = v.learned === true;
                  return (
                    <div key={`${v.en}-${i}`} style={{
                      padding: '12px 14px',
                      borderBottom: i < filtered.length - 1 ? '1px dashed rgba(31,58,46,0.1)' : 'none',
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                      opacity: learned ? 0.55 : 1,
                    }}>
                      <div style={{
                        fontSize: 8, padding: '3px 6px', borderRadius: 8,
                        background: v.cat === '구동사' ? '#C45A3F' : '#1F3A2E',
                        color: '#F5EFE0', letterSpacing: '0.05em', fontWeight: 600,
                        flexShrink: 0, marginTop: 2
                      }}>{catLabel(v.cat)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="display" style={{
                          fontSize: 14, fontWeight: 500, lineHeight: 1.4,
                          textDecoration: learned ? 'line-through' : 'none',
                        }}>{v.en}</div>
                        <div className="display-italic" style={{ fontSize: 12, color: '#C45A3F', marginTop: 2 }}>{v.ko}</div>
                        {v.example && (
                          <div style={{ fontSize: 11, color: '#7A8E7E', marginTop: 4, fontStyle: 'italic' }}>
                            "{v.example}"
                          </div>
                        )}
                      </div>
                      {v.fromDiaryId && diaries.some(d => d.id === v.fromDiaryId) && (
                        <button
                          onClick={() => jumpToDiary(v.fromDiaryId)}
                          title={t('출처 일기 보기', 'View source diary')}
                          style={{
                            background: 'transparent', border: 'none', padding: 4,
                            cursor: 'pointer', flexShrink: 0,
                            color: '#7A8E7E',
                            display: 'flex', alignItems: 'center',
                          }}
                        ><BookOpen size={14} /></button>
                      )}
                      <button
                        onClick={() => toggleLearned(v.en)}
                        title={learned ? t('외움 해제', 'Mark unlearned') : t('외움', 'Mark learned')}
                        style={{
                          background: 'transparent', border: 'none', padding: 4,
                          cursor: 'pointer', flexShrink: 0,
                          fontSize: 18, color: learned ? '#C45A3F' : '#A8B8AB',
                          lineHeight: 1,
                        }}
                      >{learned ? '★' : '☆'}</button>
                      <button onClick={() => removeCard(v.en)} style={iconBtn}><X size={12} color="#7A8E7E" /></button>
                    </div>
                  );
                })}
              </Card>
            )
          )}

          {/* 카드 추가 */}
          <SectionTitle kicker="ADD">{t('카드 추가', 'New Card')}</SectionTitle>
          <Card>
            <div style={{ display: 'grid', gap: 8 }}>
              <select value={newCard.cat} onChange={(e) => setNewCard({...newCard, cat: e.target.value})} style={inputStyle}>
                {['단어','구동사','표현','교실','식당','교통','쇼핑','일상','필리핀어','기타'].map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
              </select>
              <input value={newCard.en} onChange={(e) => setNewCard({...newCard, en: e.target.value})} placeholder={t('영어 표현', 'English expression')} style={inputStyle} />
              <input value={newCard.ko} onChange={(e) => setNewCard({...newCard, ko: e.target.value})} placeholder={t('한국어 뜻', 'Korean meaning')} style={inputStyle} />
              <button onClick={addCard} style={{ ...primaryBtn, justifyContent: 'center' }}>
                <Plus size={14} /> {t('단어장에 추가', 'Add to Wordbook')}
              </button>
            </div>
          </Card>
        </>
      )}

      {/* ===== 글쓰기 섹션 ===== */}
      {section === 'writing' && editingId === null && (
        <>
          <button onClick={startNewArticle} style={{
            ...primaryBtn, width: '100%', justifyContent: 'center',
            padding: '14px', fontSize: 13, marginBottom: 14
          }}>
            <Plus size={16} /> 새 글 작성
          </button>

          {articles.length === 0 ? (
            <Card>
              <div style={{ textAlign: 'center', padding: '32px 16px', color: '#7A8E7E' }}>
                <FileText size={28} style={{ marginBottom: 10, opacity: 0.5 }} />
                <div className="display-italic" style={{ fontSize: 16, marginBottom: 6 }}>
                  글이 비어 있어요.
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                  읽고 있는 기사를 요약하거나,<br />
                  관심사를 영어로 정리해보세요.
                </div>
              </div>
            </Card>
          ) : (
            <Card style={{ padding: 4 }}>
              {articles.map((a, i) => (
                <div key={a.id} onClick={() => startEditArticle(a)} style={{
                  padding: '14px',
                  cursor: 'pointer',
                  borderBottom: i < articles.length - 1 ? '1px dashed rgba(31,58,46,0.1)' : 'none'
                }}>
                  <div className="display" style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>
                    {a.title}
                  </div>
                  {a.content && (
                    <div style={{
                      fontSize: 12, color: '#7A8E7E', marginTop: 6, lineHeight: 1.5,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {a.content}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: '#A8B8AB', marginTop: 8, letterSpacing: '0.05em' }}>
                    {formatRelativeTime(a.updatedAt)}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {/* 글쓰기 — 에디터 */}
      {section === 'writing' && editingId !== null && (
        <>
          <div style={{ marginBottom: 4 }}>
            <button onClick={() => setEditingId(null)} style={{
              ...btnLink, color: '#5C6F62', marginBottom: 8
            }}>
              ← 목록으로
            </button>
          </div>
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="제목 (예: BBC — Climate change)"
            className="display"
            style={{
              width: '100%', boxSizing: 'border-box',
              border: 'none', borderBottom: '2px solid #1F3A2E',
              padding: '10px 0', fontSize: 22, fontWeight: 600,
              fontFamily: "'Fraunces', serif",
              background: 'transparent', color: '#1F3A2E', outline: 'none',
              marginBottom: 12, letterSpacing: '-0.01em'
            }}
          />
          <Card>
            <textarea
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              placeholder="기사 요약, 새 표현 정리, 관심사 자유 작성…&#10;&#10;영어로 써도, 한국어로 써도 좋아요."
              style={{
                width: '100%', minHeight: 280,
                border: 'none', resize: 'vertical',
                background: 'transparent',
                fontFamily: 'inherit', fontSize: 14,
                color: '#1F3A2E', outline: 'none',
                lineHeight: 1.75
              }}
            />
          </Card>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={saveArticle} style={{ ...primaryBtn, flex: 1, justifyContent: 'center' }}>
              <Save size={14} /> 저장
            </button>
            <button onClick={() => setEditingId(null)} style={secondaryBtn}>{t('취소', 'Cancel')}</button>
            {editingId !== 'new' && (
              <button onClick={() => deleteArticle(editingId)} style={{ ...secondaryBtn, color: '#C45A3F', borderColor: 'rgba(196,90,63,0.3)' }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </>
      )}

      {/* ===== 일기(Diary) 섹션 ===== */}
      {section === 'diary' && (
        <DiarySection
          lang={lang}
          diaries={diaries}
          saveDiary={saveDiary}
          deleteDiary={deleteDiary}
          pendingOpenId={pendingDiaryOpen}
          onPendingOpenConsumed={() => setPendingDiaryOpen(null)}
        />
      )}
    </>
  );
}

// ============================================================
//  공통 스타일
// ============================================================
const inputStyle = {
  border: '1px solid rgba(31,58,46,0.18)',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
  fontFamily: 'inherit',
  background: '#F5EFE0',
  color: '#1F3A2E',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box'
};
const labelStyle = { fontSize: 10, color: '#7A8E7E', marginBottom: 4, fontWeight: 600, letterSpacing: '0.05em' };
const primaryBtn = {
  background: '#1F3A2E', color: '#F5EFE0', border: 'none',
  borderRadius: 8, padding: '10px 14px', cursor: 'pointer',
  fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6
};
const secondaryBtn = {
  background: '#FAF7EC', color: '#1F3A2E', border: '1px solid rgba(31,58,46,0.2)',
  borderRadius: 8, padding: '10px 14px', cursor: 'pointer',
  fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6
};
const iconBtn = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center'
};
const btnLink = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  fontSize: 11, color: '#C45A3F', fontWeight: 600,
  marginTop: 6, padding: 0, display: 'flex', alignItems: 'center', gap: 2
};
const inlineLink = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  fontSize: 13, color: '#C45A3F', fontWeight: 600, padding: 0
};

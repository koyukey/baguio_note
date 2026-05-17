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
import { initSync, syncStorage, subscribeRemoteChanges } from './lib/syncStorage';

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

const STARTER_SCHEDULE = [
  // 월요일 — 풀 스케줄 예시 (어학원에서 받으면 본인 시간표로 수정)
  { day: 'mon', time: '08:00', subject: 'Speaking 1:1', teacher: 'Teacher Maria', room: 'Room 201' },
  { day: 'mon', time: '09:00', subject: 'Reading 1:1', teacher: 'Teacher Joy', room: 'Room 203' },
  { day: 'mon', time: '10:00', subject: 'Listening 1:1', teacher: 'Teacher Anne', room: 'Room 205' },
  { day: 'mon', time: '11:00', subject: 'Writing 1:1', teacher: 'Teacher Sam', room: 'Room 207' },
  { day: 'mon', time: '13:00', subject: 'Pattern Class', teacher: 'Teacher Mark', room: 'Room 105' },
  { day: 'mon', time: '14:00', subject: 'Vocab Class', teacher: 'Teacher Eve', room: 'Room 105' },
  { day: 'mon', time: '15:00', subject: 'CNN Class', teacher: 'Teacher Leo', room: 'Room 106' },
  { day: 'mon', time: '16:00', subject: 'Group Class', teacher: 'Teacher Mark', room: 'Room 105' },
];

const STARTER_ROUTINES = [
  { id: 'r-seed-1', name: '단어 20개 외우기', history: {} },
  { id: 'r-seed-2', name: '쉐도잉 10분', history: {} },
  { id: 'r-seed-3', name: '영어 일기 쓰기', history: {} },
];

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

  // 체크리스트, 시간표, 가계부, 단어장, 루틴, 글쓰기
  const [checklist, setChecklist] = useState(STARTER_CHECKLIST);
  const [schedule, setSchedule] = useState(STARTER_SCHEDULE);
  const [expenses, setExpenses] = useState([]);
  const [vocab, setVocab] = useState(STARTER_PHRASES);
  const [routines, setRoutines] = useState(STARTER_ROUTINES);
  const [articles, setArticles] = useState([]);

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
      if (s) { try { setSchedule(JSON.parse(s)); } catch {} }
      const e = await storage.get('baguio:expenses');
      if (e) { try { setExpenses(JSON.parse(e)); } catch {} }
      const v = await storage.get('baguio:vocab');
      if (v) { try { setVocab(JSON.parse(v)); } catch {} }
      const ro = await storage.get('baguio:routines');
      if (ro) { try { setRoutines(JSON.parse(ro)); } catch {} }
      const ar = await storage.get('baguio:articles');
      if (ar) { try { setArticles(JSON.parse(ar)); } catch {} }
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
            {/* KO / EN 토글 */}
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
            checklist={checklist} setChecklist={setChecklist}
            routines={routines} setRoutines={setRoutines}
          />
        )}
        {tab === 'schedule' && (
          <ScheduleTab schedule={schedule} setSchedule={setSchedule} />
        )}
        {tab === 'money' && (
          <MoneyTab
            phpRate={phpRate} setPhpRate={setPhpRate}
            rateUpdated={rateUpdated} setRateUpdated={setRateUpdated}
            expenses={expenses} setExpenses={setExpenses}
            tripStart={tripStart} setTripStart={setTripStart}
            tripEnd={tripEnd} setTripEnd={setTripEnd}
          />
        )}
        {tab === 'english' && (
          <EnglishTab
            vocab={vocab} setVocab={setVocab}
            articles={articles} setArticles={setArticles}
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
          { key: 'home', icon: Compass, label: '홈' },
          { key: 'plan', icon: Check, label: '할 일' },
          { key: 'schedule', icon: CalendarDays, label: '시간표' },
          { key: 'money', icon: Wallet, label: '머니' },
          { key: 'english', icon: Languages, label: '영어' },
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
      <SectionTitle kicker={`${dayKoMap[todayKey]}요일 · TODAY`}>오늘의 수업</SectionTitle>
      <Card>
        {todayClasses.length === 0 ? (
          <div style={{ padding: '8px 0', fontSize: 13, color: '#7A8E7E' }}>
            오늘은 수업이 없어요. <button onClick={() => goTo('schedule')} style={inlineLink}>시간표 편집 →</button>
          </div>
        ) : (
          <div>
            {todayClasses.map((c, i) => {
              const [h,m] = c.time.split(':').map(Number);
              const isPast = h * 60 + m + 60 < nowMinutes; // 1시간 이상 지난 수업
              const isNow = upcomingToday && c.time !== upcomingToday.time && h * 60 + m <= nowMinutes && h * 60 + m + 60 >= nowMinutes;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 0',
                  opacity: isPast ? 0.4 : 1,
                  borderBottom: i < todayClasses.length - 1 ? '1px dashed rgba(31,58,46,0.15)' : 'none'
                }}>
                  <div className="display" style={{
                    fontSize: 22, fontWeight: 600, minWidth: 64,
                    color: isPast ? '#7A8E7E' : '#C45A3F'
                  }}>{c.time}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, textDecoration: isPast ? 'line-through' : 'none' }}>
                      {c.subject || '수업'}
                    </div>
                    {(c.teacher || c.room) && (
                      <div style={{ fontSize: 11, color: '#7A8E7E', marginTop: 3 }}>
                        {c.teacher}{c.teacher && c.room ? ' · ' : ''}{c.room}
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
      <SectionTitle kicker="TODO · TODAY">오늘 할 일</SectionTitle>
      <Card style={{ padding: visibleTodos.length === 0 ? 18 : 6 }}>
        {visibleTodos.length === 0 ? (
          <div style={{ fontSize: 13, color: '#7A8E7E' }}>
            할 일이 없어요. <button onClick={() => goTo('plan')} style={inlineLink}>추가하기 →</button>
          </div>
        ) : (
          <>
            {visibleTodos.map((c, i) => (
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
                }}>{c.group}</span>
              </div>
            ))}
            {hiddenTodosCount > 0 && (
              <button onClick={() => goTo('plan')} style={{
                ...btnLink, width: '100%', justifyContent: 'center',
                padding: '10px 12px', marginTop: 0
              }}>
                + {hiddenTodosCount}개 더 보기 <ChevronRight size={12} />
              </button>
            )}
          </>
        )}
      </Card>

      {/* 오늘의 표현 — 플래시카드 */}
      {todayExpression && (
        <>
          <SectionTitle kicker="DAILY">오늘의 표현</SectionTitle>
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

function PlanTab({ checklist, setChecklist, routines, setRoutines }) {
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
      <SectionTitle kicker="TODO">할 일</SectionTitle>

      {active.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#7A8E7E', fontSize: 13 }}>
            할 일이 없어요. 아래에서 새로 추가해보세요.
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
                    {g}
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
      <SectionTitle kicker="ADD">새 할 일</SectionTitle>
      <Card>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={newItem} onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="예: 챕터 3 읽기, 단어 20개 외우기"
            style={{ ...inputStyle, flex: 1, minWidth: 140 }}
          />
          <select value={newGroup} onChange={(e) => setNewGroup(e.target.value)} style={{ ...inputStyle, width: 100 }}>
            {allGroupOptions.map(g => <option key={g}>{g}</option>)}
          </select>
          <button onClick={add} style={primaryBtn}>
            <Plus size={14} /> 추가
          </button>
        </div>
      </Card>

      {/* ===== 루틴 ===== */}
      <SectionTitle kicker="ROUTINE">매일 루틴</SectionTitle>
      <div style={{ fontSize: 11, color: '#7A8E7E', marginTop: -4, marginBottom: 10 }}>
        오늘 했으면 동그라미를 탭하세요. 캘린더에 <strong style={{ color: '#1F3A2E' }}>\</strong> 표식으로 기록돼요.
      </div>

      {routines.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#7A8E7E', fontSize: 13 }}>
            아직 루틴이 없어요. 아래에서 추가해보세요.
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
            placeholder="새 루틴 (예: 영자 신문 10분 읽기)"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={addRoutine} style={primaryBtn}>
            <Plus size={14} /> 루틴
          </button>
        </div>
      </Card>

      {/* ===== 성취 캘린더 ===== */}
      <AchievementCalendar checklist={checklist} routines={routines} />

      {/* 완료 로그 */}
      <SectionTitle kicker="LOG">완료 기록</SectionTitle>
      <Card>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          paddingBottom: showLog && done.length > 0 ? 10 : 0,
          borderBottom: showLog && done.length > 0 ? '1px dashed rgba(31,58,46,0.15)' : 'none'
        }}>
          <div className="display" style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>
            {done.length}<span style={{ color: '#7A8E7E', fontSize: 14, fontWeight: 500 }}> 건 완료</span>
          </div>
          {done.length > 0 && (
            <button onClick={() => setShowLog(!showLog)} style={btnLink}>
              {showLog ? '접기' : '펼치기'} <ChevronRight size={12} style={{ transform: showLog ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
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
                    {c.group} · {formatRelativeTime(c.completedAt)}
                  </div>
                </div>
                <button onClick={() => restore(c.id)} title="복구" style={iconBtn}>
                  <RotateCcw size={12} color="#7A8E7E" />
                </button>
                <button onClick={() => removeItem(c.id)} title="영구 삭제" style={iconBtn}>
                  <Trash2 size={12} color="#C45A3F" />
                </button>
              </div>
            ))}
            <button onClick={clearLog} style={{
              ...btnLink, marginTop: 10, color: '#C45A3F', display: 'flex', alignItems: 'center'
            }}>
              <Trash2 size={11} style={{ marginRight: 4 }} /> 로그 전체 삭제
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
function ScheduleTab({ schedule, setSchedule }) {
  const [editing, setEditing] = useState(null); // index or null
  const [form, setForm] = useState({ day: 'mon', time: '09:00', subject: '', teacher: '', room: '' });

  const allDays = [
    { key: 'mon', ko: '월' }, { key: 'tue', ko: '화' }, { key: 'wed', ko: '수' },
    { key: 'thu', ko: '목' }, { key: 'fri', ko: '금' }, { key: 'sat', ko: '토' }, { key: 'sun', ko: '일' }
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

  // 시간 슬롯 — 실제 데이터의 시간 + 비어있을 때 기본값
  const uniqueTimes = [...new Set(schedule.map(s => s.time))].sort();
  const timeRows = uniqueTimes.length > 0
    ? uniqueTimes
    : ['08:00','09:00','10:00','11:00','13:00','14:00','15:00','16:00'];

  // 셀에 해당하는 수업 찾기
  const findClass = (time, day) =>
    schedule.findIndex(s => s.time === time && s.day === day);

  const save = () => {
    if (!form.subject.trim()) return;
    if (editing !== null) {
      setSchedule(schedule.map((s, i) => i === editing ? form : s));
    } else {
      setSchedule([...schedule, form]);
    }
    setForm({ day: 'mon', time: '09:00', subject: '', teacher: '', room: '' });
    setEditing(null);
  };
  const editItem = (i) => {
    setForm(schedule[i]);
    setEditing(i);
    // 폼으로 스크롤
    setTimeout(() => {
      const el = typeof document !== 'undefined' ? document.getElementById('schedule-editor') : null;
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };
  const removeItem = () => {
    if (editing !== null) {
      setSchedule(schedule.filter((_, idx) => idx !== editing));
      setForm({ day: 'mon', time: '09:00', subject: '', teacher: '', room: '' });
      setEditing(null);
    }
  };
  const addAtSlot = (time, day) => {
    setForm({ day, time, subject: '', teacher: '', room: '' });
    setEditing(null);
    setTimeout(() => {
      const el = typeof document !== 'undefined' ? document.getElementById('schedule-editor') : null;
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
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
      <SectionTitle kicker="WEEKLY">시간표</SectionTitle>
      <div style={{ fontSize: 11, color: '#7A8E7E', marginTop: -4, marginBottom: 10 }}>
        수업 칸을 탭하면 수정, 빈 칸을 탭하면 그 시간에 새 수업을 추가합니다.
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
                {d.ko}
              </div>
            );
          })}
        </div>

        {/* 시간별 행 */}
        {timeRows.map(time => (
          <div key={time} style={{
            display: 'grid',
            gridTemplateColumns: `26px repeat(${visibleDays.length}, 1fr)`,
            gap: 3, marginBottom: 3
          }}>
            {/* 시간 레이블 */}
            <div className="display" style={{
              fontSize: 10,
              color: '#7A8E7E',
              fontWeight: 700,
              textAlign: 'right',
              paddingRight: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              letterSpacing: '-0.02em'
            }}>
              {time.split(':')[0]}
            </div>

            {/* 각 요일 셀 */}
            {visibleDays.map(d => {
              const idx = findClass(time, d.key);
              const isToday = d.key === todayDayKey;
              if (idx >= 0) {
                const cls = schedule[idx];
                const bg = getClassColor(cls.subject);
                const isEditing = editing === idx;
                return (
                  <button key={d.key} onClick={() => editItem(idx)} style={{
                    background: bg,
                    color: '#F5EFE0',
                    border: isEditing ? '2px solid #F5EFE0' : 'none',
                    outline: isEditing ? `2px solid ${bg}` : 'none',
                    borderRadius: 6,
                    padding: '5px 3px',
                    minHeight: 58,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: 2,
                    overflow: 'hidden',
                    fontFamily: 'inherit',
                    transition: 'transform 0.15s',
                  }}>
                    <div style={{ fontSize: 8, opacity: 0.6, fontWeight: 600, letterSpacing: '0.02em' }}>
                      {cls.time}
                    </div>
                    <div style={{
                      fontSize: 10, fontWeight: 700, lineHeight: 1.15,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      wordBreak: 'break-word'
                    }}>
                      {cls.subject}
                    </div>
                    {cls.teacher && (
                      <div style={{
                        fontSize: 8, opacity: 0.7, lineHeight: 1.1,
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap', maxWidth: '100%'
                      }}>
                        {cls.teacher.replace('Teacher ', 'T. ')}
                      </div>
                    )}
                  </button>
                );
              }
              return (
                <button key={d.key} onClick={() => addAtSlot(time, d.key)} style={{
                  background: isToday ? 'rgba(196,90,63,0.04)' : 'transparent',
                  border: '1px dashed rgba(31,58,46,0.13)',
                  borderRadius: 6,
                  minHeight: 58,
                  cursor: 'pointer',
                  padding: 0,
                  fontFamily: 'inherit'
                }} />
              );
            })}
          </div>
        ))}

        {/* 새 시간대 추가 힌트 */}
        <div style={{
          marginTop: 8, paddingTop: 8,
          borderTop: '1px dashed rgba(31,58,46,0.1)',
          fontSize: 10, color: '#A8B8AB', textAlign: 'center'
        }}>
          새 시간대는 아래 폼에서 직접 입력하세요
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
          <div>
            <div style={labelStyle}>요일</div>
            <select value={form.day} onChange={(e) => setForm({...form, day: e.target.value})} style={inputStyle}>
              {allDays.map(d => <option key={d.key} value={d.key}>{d.ko}요일</option>)}
            </select>
          </div>
          <div>
            <div style={labelStyle}>시간</div>
            <input type="time" value={form.time} onChange={(e) => setForm({...form, time: e.target.value})} style={inputStyle} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={labelStyle}>수업명</div>
            <input value={form.subject} onChange={(e) => setForm({...form, subject: e.target.value})} placeholder="예) Speaking 1:1" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>선생님</div>
            <input value={form.teacher} onChange={(e) => setForm({...form, teacher: e.target.value})} placeholder="예: Teacher Maria" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>강의실</div>
            <input value={form.room} onChange={(e) => setForm({...form, room: e.target.value})} placeholder="예: Room 201" style={inputStyle} />
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
              <button onClick={() => { setEditing(null); setForm({ day: 'mon', time: '09:00', subject: '', teacher: '', room: '' }); }} style={secondaryBtn}>
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
function MoneyTab({ phpRate, setPhpRate, rateUpdated, setRateUpdated, expenses, setExpenses, tripStart, setTripStart, tripEnd, setTripEnd }) {
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
      <SectionTitle kicker="RATE">환율</SectionTitle>
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
      <SectionTitle kicker="CONVERTER">환전 계산</SectionTitle>
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
      <SectionTitle kicker="PROGRAM">학기 기간</SectionTitle>
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
    </>
  );
}

// ============================================================
//  영어 학습 탭 — 표현 + 글쓰기
// ============================================================
function EnglishTab({ vocab, setVocab, articles, setArticles }) {
  const [section, setSection] = useState('phrases'); // phrases | writing

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
  const filtered = cat === '전체' ? vocab : vocab.filter(v => v.cat === cat);

  const next = () => { setFlashSide('en'); setFlashIdx((flashIdx + 1) % filtered.length); };
  const prev = () => { setFlashSide('en'); setFlashIdx((flashIdx - 1 + filtered.length) % filtered.length); };

  const addCard = () => {
    if (!newCard.en.trim() || !newCard.ko.trim()) return;
    setVocab([{ ...newCard }, ...vocab]);
    setNewCard({ cat: newCard.cat, en: '', ko: '' });
  };
  const removeCard = (en) => setVocab(vocab.filter(v => v.en !== en));

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
      <SectionTitle kicker="STUDY">영어</SectionTitle>

      {/* 섹션 토글: 표현 ↔ 글쓰기 */}
      <Card style={{ padding: 4, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { k: 'phrases', l: '표현', i: Languages },
            { k: 'writing', l: '글쓰기', i: Pencil }
          ].map(s => (
            <button key={s.k} onClick={() => { setSection(s.k); setEditingId(null); }} style={{
              flex: 1, padding: '11px 10px',
              background: section === s.k ? '#1F3A2E' : 'transparent',
              color: section === s.k ? '#F5EFE0' : '#1F3A2E',
              border: 'none', borderRadius: 10, cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
            }}>
              <s.i size={14} /> {s.l}
            </button>
          ))}
        </div>
      </Card>

      {/* ===== 표현 섹션 ===== */}
      {section === 'phrases' && (
        <>
          {/* 모드 토글 */}
          <Card style={{ padding: 4, marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[{k:'list', l:'목록'}, {k:'flash', l:'플래시카드'}].map(m => (
                <button key={m.k} onClick={() => setMode(m.k)} style={{
                  flex: 1, padding: '10px',
                  background: mode === m.k ? '#5C6F62' : 'transparent',
                  color: mode === m.k ? '#F5EFE0' : '#1F3A2E',
                  border: 'none', borderRadius: 10, cursor: 'pointer',
                  fontSize: 11, fontWeight: 600
                }}>{m.l}</button>
              ))}
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
              }}>{c}</button>
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
            <Card style={{ padding: 4 }}>
              {filtered.map((v, i) => (
                <div key={i} style={{
                  padding: '12px 14px',
                  borderBottom: i < filtered.length - 1 ? '1px dashed rgba(31,58,46,0.1)' : 'none',
                  display: 'flex', gap: 10, alignItems: 'flex-start'
                }}>
                  <div style={{
                    fontSize: 8, padding: '3px 6px', borderRadius: 8,
                    background: '#1F3A2E', color: '#F5EFE0', letterSpacing: '0.05em', fontWeight: 600,
                    flexShrink: 0, marginTop: 2
                  }}>{v.cat}</div>
                  <div style={{ flex: 1 }}>
                    <div className="display" style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.4 }}>{v.en}</div>
                    <div className="display-italic" style={{ fontSize: 12, color: '#C45A3F', marginTop: 2 }}>{v.ko}</div>
                  </div>
                  <button onClick={() => removeCard(v.en)} style={iconBtn}><X size={12} color="#7A8E7E" /></button>
                </div>
              ))}
            </Card>
          )}

          {/* 카드 추가 */}
          <SectionTitle kicker="ADD">카드 추가</SectionTitle>
          <Card>
            <div style={{ display: 'grid', gap: 8 }}>
              <select value={newCard.cat} onChange={(e) => setNewCard({...newCard, cat: e.target.value})} style={inputStyle}>
                {['교실','식당','교통','쇼핑','일상','필리핀어','기타'].map(c => <option key={c}>{c}</option>)}
              </select>
              <input value={newCard.en} onChange={(e) => setNewCard({...newCard, en: e.target.value})} placeholder="영어 표현" style={inputStyle} />
              <input value={newCard.ko} onChange={(e) => setNewCard({...newCard, ko: e.target.value})} placeholder="한국어 뜻" style={inputStyle} />
              <button onClick={addCard} style={{ ...primaryBtn, justifyContent: 'center' }}>
                <Plus size={14} /> 단어장에 추가
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
            <button onClick={() => setEditingId(null)} style={secondaryBtn}>취소</button>
            {editingId !== 'new' && (
              <button onClick={() => deleteArticle(editingId)} style={{ ...secondaryBtn, color: '#C45A3F', borderColor: 'rgba(196,90,63,0.3)' }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </>
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

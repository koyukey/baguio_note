import { supabase, ensureAnonymousSession, isSupabaseConfigured } from './supabase';

const COLUMN_MAP = {
  'baguio:trip': 'trip',
  'baguio:rate': 'rate',
  'baguio:lang': 'lang',
  'baguio:checklist': 'checklist',
  'baguio:schedule': 'schedule',
  'baguio:expenses': 'expenses',
  'baguio:vocab': 'vocab',
  'baguio:routines': 'routines',
  'baguio:articles': 'articles',
  'baguio:diaries': 'diaries',
};
// 시드 플래그 등 메타 키 — localStorage에만 저장하고 Supabase에는 안 올림
const LOCAL_ONLY_KEYS = new Set(['baguio:seeded:diary-v1']);

// 컬럼별 타임스탬프를 로컬에 저장하는 키 접두사
const TS_PREFIX = 'baguio:_ts:';

// 메모리 캐시 — 한 row를 통째로 들고 있다가 부분 업데이트 시 합쳐서 upsert
let rowCache = null;
let userId = null;
let pendingUpserts = {}; // { col: { v, t } }
let upsertTimer = null;
let manualRefetch = null; // initSync에서 할당, refreshNow()에서 호출
const subscribers = new Set(); // 다른 기기에서 변경 알림 받을 콜백들

function localGet(key) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {}
  return null;
}

function localSet(key, value) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {}
}

// 컬럼의 로컬 타임스탬프 — 마지막으로 이 기기에서 인지한 값의 시간
function getLocalTs(col) {
  const raw = localGet(TS_PREFIX + col);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

function setLocalTs(col, ts) {
  localSet(TS_PREFIX + col, String(ts));
}

// 원격에서 받은 값에서 v(실제 값)과 t(타임스탬프) 분리
// 기존 형식(래퍼 없음)도 지원: 그 경우 t=0으로 간주 (가장 오래된 것)
function unwrap(remote) {
  if (remote && typeof remote === 'object' && 'v' in remote && 't' in remote && typeof remote.t === 'number') {
    return { v: remote.v, t: remote.t };
  }
  return { v: remote, t: 0 };
}

// 업로드용 래핑 — 항상 { v, t }
function wrap(value, ts) {
  return { v: value, t: ts };
}

async function flushUpserts() {
  if (!supabase) return;
  // 항상 현재 활성 세션의 user_id를 사용 (auth swap 후에도 정확)
  const { data: { user } } = await supabase.auth.getUser();
  const activeUserId = user?.id || userId;
  if (!activeUserId) return;
  userId = activeUserId; // 캐시도 갱신

  const updates = pendingUpserts;
  pendingUpserts = {};
  upsertTimer = null;
  if (Object.keys(updates).length === 0) return;
  const payload = { user_id: activeUserId, ...updates };
  const { error } = await supabase
    .from('user_data')
    .upsert(payload, { onConflict: 'user_id' })
    .select();
  if (error) {
    console.warn('[sync] upsert failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      user_id: activeUserId,
      keys: Object.keys(updates),
    });
    // 실패한 변경은 다음 flush에 재시도되도록 다시 큐에 넣기
    pendingUpserts = { ...updates, ...pendingUpserts };
    if (!upsertTimer) upsertTimer = setTimeout(flushUpserts, 5000);
    return;
  }
  // 성공 시 rowCache 갱신
  rowCache = { ...(rowCache || {}), ...updates };
}

function scheduleUpsert(column, wrapped) {
  pendingUpserts[column] = wrapped;
  if (upsertTimer) clearTimeout(upsertTimer);
  upsertTimer = setTimeout(flushUpserts, 500); // 500ms debounce
}

// 외부에서 변경 알림을 받을 콜백 등록
export function subscribeRemoteChanges(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

function notify(column, value) {
  for (const cb of subscribers) {
    try { cb(column, value); } catch (e) { console.warn('[sync] subscriber error', e); }
  }
}

// 원격에서 받은 row를 로컬에 반영 — 단, 원격 타임스탬프가 로컬보다 새로울 때만.
// 옛날 데이터가 새 데이터를 덮어쓰는 last-write-wins 버그 방지의 핵심 함수.
function applyRow(row, { notifyChanges }) {
  for (const [key, col] of Object.entries(COLUMN_MAP)) {
    const remote = row[col];
    if (remote === null || remote === undefined) continue;
    const { v, t: remoteTs } = unwrap(remote);
    const localTs = getLocalTs(col);
    // 원격이 같거나 오래되면 무시 (내가 더 새 데이터를 갖고 있음)
    if (remoteTs <= localTs) continue;

    const serialized = typeof v === 'string' ? v : JSON.stringify(v);
    const prev = localGet(key);
    if (prev !== serialized) {
      localSet(key, serialized);
      setLocalTs(col, remoteTs);
      if (notifyChanges) notify(key, serialized);
    } else {
      // 값은 같지만 타임스탬프는 따라잡기
      setLocalTs(col, remoteTs);
    }
  }
}

// 첫 부팅: 세션 보장 → row fetch → localStorage 시드 → realtime 구독
export async function initSync() {
  if (!isSupabaseConfigured) {
    return { ok: false, reason: 'not-configured' };
  }
  const session = await ensureAnonymousSession();
  if (!session) return { ok: false, reason: 'no-session' };
  userId = session.user.id;

  // 원격에서 row 가져오기
  const { data, error } = await supabase
    .from('user_data')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[sync] initial fetch failed', error.message);
    return { ok: false, reason: 'fetch-failed' };
  }

  if (data) {
    rowCache = data;
    // 첫 로드는 원격을 신뢰 (notify는 불필요 — 아직 UI 로드 전)
    applyRow(data, { notifyChanges: false });
  } else {
    // 원격에 데이터 없음 → 현재 localStorage 내용을 원격에 업로드 (첫 마이그레이션)
    rowCache = { user_id: userId };
    const seed = {};
    const now = Date.now();
    for (const [key, col] of Object.entries(COLUMN_MAP)) {
      const raw = localGet(key);
      if (raw === null) continue;
      // lang은 plain text, 나머지는 JSON
      let v;
      if (col === 'lang') {
        v = raw;
      } else {
        try { v = JSON.parse(raw); } catch { continue; }
      }
      seed[col] = wrap(v, now);
      setLocalTs(col, now);
    }
    if (Object.keys(seed).length > 0) {
      pendingUpserts = seed;
      await flushUpserts();
    }
  }

  // 포커스 복귀 시 자동 재fetch — 다른 기기에서 변경된 내용 따라잡기
  // (Realtime WebSocket 대신 가벼운 polling-on-focus 전략)
  const refetchAndApply = async () => {
    if (!supabase || !userId) return;
    const { data: row, error } = await supabase
      .from('user_data')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !row) return;
    applyRow(row, { notifyChanges: true });
    rowCache = row;
  };

  if (typeof window !== 'undefined') {
    // 탭이 다시 보일 때 (백그라운드 → 포그라운드)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refetchAndApply();
    });
    // 윈도우 포커스 (다른 앱에서 돌아옴)
    window.addEventListener('focus', refetchAndApply);
    // 폴링: 화면이 보이는 동안만 30초마다 (PWA에서도 안정적 동기화)
    setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refetchAndApply();
      }
    }, 30000);
  }

  // 수동 새로고침 트리거 — 새로고침 버튼에서 호출
  manualRefetch = refetchAndApply;

  // 인증 상태 변화 감시 — 매직 링크 클릭 후 user_id가 바뀌면 새 user 데이터로 갈아끼우기
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (!session) return;
    const newUserId = session.user.id;
    if (newUserId === userId) return; // 같은 user면 무시
    userId = newUserId;
    // user swap 시에는 새 user의 데이터를 무조건 받음 (옛 user의 ts는 다른 user의 것)
    // 그래서 로컬 ts를 0으로 리셋해 applyRow가 무조건 받아들이도록 함
    for (const col of Object.values(COLUMN_MAP)) setLocalTs(col, 0);

    const { data: row } = await supabase
      .from('user_data')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (row) {
      applyRow(row, { notifyChanges: true });
      rowCache = row;
    } else {
      // 새 user에 데이터 없음 → 현재 localStorage 통째 업로드
      const seed = {};
      const now = Date.now();
      for (const [key, col] of Object.entries(COLUMN_MAP)) {
        const raw = localGet(key);
        if (raw === null) continue;
        let v;
        if (col === 'lang') v = raw;
        else { try { v = JSON.parse(raw); } catch { continue; } }
        seed[col] = wrap(v, now);
        setLocalTs(col, now);
      }
      if (Object.keys(seed).length > 0) {
        pendingUpserts = seed;
        await flushUpserts();
      }
    }
  });

  return { ok: true, userId };
}

// 수동 새로고침 — 새로고침 버튼 클릭 시 호출
export async function refreshNow() {
  if (manualRefetch) await manualRefetch();
}

// 외부 인터페이스 — 기존 storage.get/set과 호환
export const syncStorage = {
  async get(key) {
    return localGet(key); // 항상 캐시에서 즉시 반환 (Supabase는 백그라운드 동기화)
  },
  async set(key, value) {
    if (LOCAL_ONLY_KEYS.has(key)) {
      localSet(key, value);
      return; // 시드 플래그 등은 클라우드 동기화 제외
    }
    const col = COLUMN_MAP[key];
    // 원격에서 방금 받은 것과 값이 같으면 업로드 스킵 (에코 방지)
    // subscribeRemoteChanges → setState → useEffect → set 으로 들어온 케이스 차단
    if (col) {
      const prev = localGet(key);
      if (prev === value) {
        // 값이 똑같다 → 실제 사용자 변경이 아님. localStorage만 갱신하고 끝
        localSet(key, value);
        return;
      }
    }
    localSet(key, value);
    if (!col || !supabase || !userId) return;
    // lang은 plain text, 나머지는 JSON 파싱해서 jsonb로 저장
    let v = value;
    if (col !== 'lang') {
      try { v = JSON.parse(value); } catch { return; }
    }
    // 이 기기에서 실제 변경 발생 → 새 타임스탬프 부여하여 업로드
    const now = Date.now();
    setLocalTs(col, now);
    scheduleUpsert(col, wrap(v, now));
  },
};

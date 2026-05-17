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
};

// 메모리 캐시 — 한 row를 통째로 들고 있다가 부분 업데이트 시 합쳐서 upsert
let rowCache = null;
let userId = null;
let pendingUpserts = {};
let upsertTimer = null;
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

async function flushUpserts() {
  if (!supabase || !userId) return;
  const updates = pendingUpserts;
  pendingUpserts = {};
  upsertTimer = null;
  if (Object.keys(updates).length === 0) return;
  const payload = { user_id: userId, ...updates };
  const { error } = await supabase
    .from('user_data')
    .upsert(payload, { onConflict: 'user_id' });
  if (error) {
    console.warn('[sync] upsert failed', error.message);
    // 실패한 변경은 다음 flush에 재시도되도록 다시 큐에 넣기
    pendingUpserts = { ...updates, ...pendingUpserts };
    if (!upsertTimer) upsertTimer = setTimeout(flushUpserts, 5000);
    return;
  }
  // 성공 시 rowCache 갱신
  rowCache = { ...(rowCache || {}), ...updates };
}

function scheduleUpsert(column, value) {
  pendingUpserts[column] = value;
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
    // 원격 데이터로 localStorage 시드 (원격이 truth)
    for (const [key, col] of Object.entries(COLUMN_MAP)) {
      const v = data[col];
      if (v === null || v === undefined) continue;
      const serialized = typeof v === 'string' ? v : JSON.stringify(v);
      localSet(key, serialized);
    }
  } else {
    // 원격에 데이터 없음 → 현재 localStorage 내용을 원격에 업로드 (첫 마이그레이션)
    rowCache = { user_id: userId };
    const seed = {};
    for (const [key, col] of Object.entries(COLUMN_MAP)) {
      const raw = localGet(key);
      if (raw === null) continue;
      // lang은 plain text, 나머지는 JSON
      if (col === 'lang') {
        seed[col] = raw;
      } else {
        try { seed[col] = JSON.parse(raw); } catch { /* skip malformed */ }
      }
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
    for (const [key, col] of Object.entries(COLUMN_MAP)) {
      const v = row[col];
      if (v === null || v === undefined) continue;
      const serialized = typeof v === 'string' ? v : JSON.stringify(v);
      const prev = localGet(key);
      if (prev !== serialized) {
        localSet(key, serialized);
        notify(key, serialized);
      }
    }
    rowCache = row;
  };

  if (typeof window !== 'undefined') {
    // 탭이 다시 보일 때 (백그라운드 → 포그라운드)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refetchAndApply();
    });
    // 윈도우 포커스 (다른 앱에서 돌아옴)
    window.addEventListener('focus', refetchAndApply);
  }

  return { ok: true, userId };
}

// 외부 인터페이스 — 기존 storage.get/set과 호환
export const syncStorage = {
  async get(key) {
    return localGet(key); // 항상 캐시에서 즉시 반환 (Supabase는 백그라운드 동기화)
  },
  async set(key, value) {
    localSet(key, value);
    const col = COLUMN_MAP[key];
    if (!col || !supabase || !userId) return;
    // lang은 plain text, 나머지는 JSON 파싱해서 jsonb로 저장
    let toSave = value;
    if (col !== 'lang') {
      try { toSave = JSON.parse(value); } catch { return; }
    }
    scheduleUpsert(col, toSave);
  },
};

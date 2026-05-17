import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY;

export const isSupabaseConfigured = !!(url && key);

export const supabase = isSupabaseConfigured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,   // 매직 링크 콜백에서 URL hash 토큰 자동 처리
        flowType: 'pkce',
        storageKey: 'baguio-auth',
      },
    })
  : null;

// 익명 세션 보장: 기존 세션이 있으면 재사용, 없으면 새로 생성.
// 같은 브라우저에서는 storageKey 덕분에 영구 재사용됨.
export async function ensureAnonymousSession() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.warn('[supabase] anonymous sign-in failed', error.message);
    return null;
  }
  return data.session;
}

// 현재 세션의 이메일 (있으면) — UI 표시용
export async function getLinkedEmail() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  // is_anonymous=true이면 익명, email이 있으면 연결됨
  return user.email && !user.is_anonymous ? user.email : null;
}

// 이 기기 (첫 기기) — 익명 세션에 이메일 연결.
// 익명 데이터를 보존하면서 이메일을 attach한다.
// updateUser({ email })가 confirm email 메일을 보내며, 클릭 시 익명 user에 이메일이 영구 결합.
export async function attachEmailToCurrentSession(email) {
  if (!supabase) return { ok: false, error: 'Supabase not configured' };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: '이메일 형식이 올바르지 않습니다.' };
  }
  const { error } = await supabase.auth.updateUser(
    { email },
    {
      emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    }
  );
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// 다른 기기 — OTP 6자리 코드 발송 (매직 링크 대신).
// 클릭 의존 X, cross-tab 격리 문제 없음. 이메일에 6자리 숫자가 옴.
export async function sendOtpCode(email) {
  if (!supabase) return { ok: false, error: 'Supabase not configured' };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: '이메일 형식이 올바르지 않습니다.' };
  }
  // shouldCreateUser:false → 등록된 이메일에만 보냄 (오타 시 새 user 생성 방지)
  // emailRedirectTo 생략 → Supabase가 매직 링크 대신 6자리 코드만 보냄
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// 받은 OTP 코드로 실제 로그인 (Supabase는 보통 6자리지만 6~8자리 가능)
export async function verifyOtpCode(email, code) {
  if (!supabase) return { ok: false, error: 'Supabase not configured' };
  const clean = (code || '').trim();
  if (!/^\d{6,8}$/.test(clean)) {
    return { ok: false, error: '6~8자리 숫자 코드를 입력하세요.' };
  }
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: clean,
    type: 'email',
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// 현재 세션이 익명인지
export async function isAnonymous() {
  if (!supabase) return true;
  const { data: { user } } = await supabase.auth.getUser();
  return !user || user.is_anonymous === true;
}

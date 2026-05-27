// ============================================================
//  바기오 일기 마크다운 파서
//
//  입력 형식 (claude.md 규칙 기반):
//    # 제목
//
//    한국어 문단
//
//    영어 문단
//
//    한국어 문단
//
//    영어 문단
//    ...
//
//    ---
//
//    ## Vocabulary
//    | Word | Meaning | Example |
//    | --- | --- | --- |
//    | ... | ... | ... |
//
//    ## Phrasal Verbs   (있을 수도, 없을 수도)
//    | Verb | Meaning | Example |
//    ...
//
//    ## Useful Expressions
//    | Expression | Meaning | Note |
//    ...
//
//  반환:
//    { title, paragraphs: [{ko,en}], vocabulary, phrasal_verbs, expressions, warnings }
// ============================================================

const SECTION_HEADER_PATTERNS = {
  vocabulary: /^##\s+(vocabulary|vocab|단어)\s*$/i,
  phrasal_verbs: /^##\s+(phrasal\s*verbs?|구동사)\s*$/i,
  expressions: /^##\s+(useful\s*expressions?|expressions?|표현)\s*$/i,
};

// 텍스트가 한국어인지 영어인지 판별 — 한글 글자 수와 라틴 글자 수 비교
function koreanRatio(text) {
  if (!text) return 0;
  const koChars = (text.match(/[가-힣]/g) || []).length;
  const enChars = (text.match(/[A-Za-z]/g) || []).length;
  if (koChars + enChars === 0) return 0.5; // 둘 다 없음 (숫자·구두점만)
  return koChars / (koChars + enChars);
}

// 두 문단을 받아서 한국어/영어로 분류. 한국어 비율이 높은 쪽을 ko로 배치.
function classifyPair(a, b) {
  const ra = koreanRatio(a);
  const rb = koreanRatio(b);
  // a가 한국어일 가능성이 더 높으면 그대로, 아니면 스왑
  if (ra >= rb) return { ko: a, en: b };
  return { ko: b, en: a };
}

// 마크다운 표 한 행을 파싱 — `| a | b | c |` → ['a', 'b', 'c']
function parseTableRow(line) {
  if (!line.includes('|')) return null;
  const cells = line.split('|').map(c => c.trim());
  // 양 끝 빈 셀 제거 (`| a | b |` 분리하면 ['', 'a', 'b', ''])
  if (cells[0] === '') cells.shift();
  if (cells[cells.length - 1] === '') cells.pop();
  if (cells.length === 0) return null;
  // separator 행 (`| --- | --- |`) 감지
  if (cells.every(c => /^:?-+:?$/.test(c))) return 'separator';
  return cells;
}

// 표 블록 파싱 — 첫 헤더 행 + separator + 데이터 행들
function parseTableBlock(lines, startIdx) {
  const rows = [];
  let i = startIdx;
  let hasHeader = false;
  let sawSeparator = false;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === '') {
      // 표 중간 빈 줄은 종료 신호
      if (rows.length > 0) break;
      i++;
      continue;
    }
    if (line.startsWith('##') || line === '---') break;
    const parsed = parseTableRow(line);
    if (parsed === null) break;
    if (parsed === 'separator') {
      sawSeparator = true;
      i++;
      continue;
    }
    if (!hasHeader) {
      // 첫 행은 헤더로 간주 (skip)
      hasHeader = true;
      i++;
      continue;
    }
    rows.push(parsed);
    i++;
  }
  return { rows, nextIdx: i, sawSeparator };
}

export function parseDiaryMarkdown(text) {
  const warnings = [];
  const result = {
    title: '',
    paragraphs: [],
    vocabulary: [],
    phrasal_verbs: [],
    expressions: [],
    warnings,
  };

  if (!text || typeof text !== 'string') {
    warnings.push('빈 입력');
    return result;
  }

  const lines = text.replace(/\r\n/g, '\n').split('\n');

  // 1) 제목 찾기 — 첫 # ... 줄
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      result.title = line.replace(/^#\s+/, '').trim();
      bodyStart = i + 1;
      break;
    }
  }
  if (!result.title) {
    warnings.push('제목(# ...) 찾지 못함');
  }

  // 본문 끝 판정 — `---`(섹션 구분선) 또는 *알려진 표 섹션 헤더*(## Vocabulary 등)만.
  // 알려지지 않은 ## 헤딩(예: `## Version A`)은 본문 안의 그룹 헤더로 사용 가능.
  const isKnownSection = (line) => {
    for (const pattern of Object.values(SECTION_HEADER_PATTERNS)) {
      if (pattern.test(line)) return true;
    }
    return false;
  };
  let bodyEnd = lines.length;
  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '---' || isKnownSection(line)) {
      bodyEnd = i;
      break;
    }
  }

  // 본문 블록 → 토큰 시퀀스: { type: 'heading', text } 또는 { type: 'para', text }
  // 빈 줄로 문단 분리하되, `## ...` 줄은 즉시 heading 토큰으로 끊어냄.
  const bodyLines = lines.slice(bodyStart, bodyEnd);
  const tokens = [];
  let buffer = [];
  const flushBuffer = () => {
    if (buffer.length > 0) {
      tokens.push({ type: 'para', text: buffer.join('\n').trim() });
      buffer = [];
    }
  };
  for (const line of bodyLines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      flushBuffer();
    } else if (trimmed.startsWith('## ')) {
      // 알려지지 않은 ## 헤딩 — 그룹 헤더로 본문에 보존
      flushBuffer();
      tokens.push({ type: 'heading', text: trimmed.replace(/^##\s+/, '').trim() });
    } else {
      buffer.push(line);
    }
  }
  flushBuffer();

  // 헤딩을 기준으로 그룹화 → 각 그룹 안의 문단들끼리만 페어링.
  // 그래야 `## Version A` 다음 5문단 / `## Version B` 다음 5문단이 어긋나지 않음.
  const groups = []; // [{ heading?: string, paragraphs: string[] }]
  let current = { heading: null, paragraphs: [] };
  for (const tok of tokens) {
    if (tok.type === 'heading') {
      if (current.paragraphs.length > 0 || current.heading) groups.push(current);
      current = { heading: tok.text, paragraphs: [] };
    } else {
      current.paragraphs.push(tok.text);
    }
  }
  if (current.paragraphs.length > 0 || current.heading) groups.push(current);

  // 각 그룹 안에서 한·영 페어 분류 → result.paragraphs에 평탄화.
  // heading은 별도 항목으로 같이 넣어서 화면이 소제목처럼 표시할 수 있게.
  for (const g of groups) {
    if (g.heading) {
      result.paragraphs.push({ heading: g.heading });
    }
    const ps = g.paragraphs;
    for (let i = 0; i < ps.length; i += 2) {
      const a = ps[i];
      const b = ps[i + 1] || '';
      const { ko, en } = classifyPair(a, b);
      result.paragraphs.push({ ko, en });
    }
    if (ps.length % 2 === 1) {
      warnings.push(`${g.heading ? `"${g.heading}" 그룹의 ` : ''}본문 문단 수가 홀수(${ps.length}). 마지막 문단에 짝이 없음.`);
    }
  }

  // 3) 표 섹션 — 헤더 매칭 후 표 파싱
  let i = bodyEnd;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === '---' || line === '') {
      i++;
      continue;
    }

    let matchedKey = null;
    for (const [key, pattern] of Object.entries(SECTION_HEADER_PATTERNS)) {
      if (pattern.test(line)) {
        matchedKey = key;
        break;
      }
    }

    if (!matchedKey) {
      // 알 수 없는 ## 헤더 — 표 없는 섹션이거나 노트 등
      if (line.startsWith('## ')) {
        warnings.push(`알 수 없는 섹션: "${line}"`);
      }
      i++;
      continue;
    }

    const { rows, nextIdx, sawSeparator } = parseTableBlock(lines, i + 1);

    if (rows.length === 0) {
      warnings.push(`${matchedKey} 표가 비어있음`);
    } else if (!sawSeparator) {
      warnings.push(`${matchedKey} 표에 separator(---) 줄 없음 — 잘못 파싱됐을 수 있음`);
    }

    if (matchedKey === 'vocabulary') {
      result.vocabulary = rows.map(r => ({
        word: r[0] || '',
        meaning: r[1] || '',
        example: r[2] || '',
      })).filter(o => o.word);
    } else if (matchedKey === 'phrasal_verbs') {
      result.phrasal_verbs = rows.map(r => ({
        verb: r[0] || '',
        meaning: r[1] || '',
        example: r[2] || '',
      })).filter(o => o.verb);
    } else if (matchedKey === 'expressions') {
      result.expressions = rows.map(r => ({
        expression: r[0] || '',
        meaning: r[1] || '',
        note: r[2] || '',
      })).filter(o => o.expression);
    }

    i = nextIdx;
  }

  return result;
}

// 일기 객체에서 Phrases 항목들을 생성 — 자동 통합 시 사용
// 반환: [{ en, ko, cat, example, fromDiaryId }]
export function diaryToPhrases(diary) {
  const out = [];
  for (const v of diary.vocabulary || []) {
    if (!v.word) continue;
    out.push({
      en: v.word,
      ko: v.meaning || '',
      cat: '단어',
      example: v.example || '',
      fromDiaryId: diary.id,
    });
  }
  for (const p of diary.phrasal_verbs || []) {
    if (!p.verb) continue;
    out.push({
      en: p.verb,
      ko: p.meaning || '',
      cat: '구동사',
      example: p.example || '',
      fromDiaryId: diary.id,
    });
  }
  for (const e of diary.expressions || []) {
    if (!e.expression) continue;
    const ko = e.note ? `${e.meaning} (${e.note})` : e.meaning;
    out.push({
      en: e.expression,
      ko: ko || '',
      cat: '표현',
      example: '',
      fromDiaryId: diary.id,
    });
  }
  return out;
}

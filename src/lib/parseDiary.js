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

  // 2) 본문 — 제목 다음 ~ 첫 `---` 또는 `## ` 직전까지
  let bodyEnd = lines.length;
  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '---' || line.startsWith('## ')) {
      bodyEnd = i;
      break;
    }
  }

  // 본문 블록 → 빈 줄로 분리된 문단 모음
  const bodyLines = lines.slice(bodyStart, bodyEnd);
  const paragraphs = [];
  let buffer = [];
  for (const line of bodyLines) {
    if (line.trim() === '') {
      if (buffer.length > 0) {
        paragraphs.push(buffer.join('\n').trim());
        buffer = [];
      }
    } else {
      buffer.push(line);
    }
  }
  if (buffer.length > 0) paragraphs.push(buffer.join('\n').trim());

  // 짝수면 한·영 페어, 홀수면 마지막은 ko-only
  for (let i = 0; i < paragraphs.length; i += 2) {
    const ko = paragraphs[i];
    const en = paragraphs[i + 1] || '';
    result.paragraphs.push({ ko, en });
  }
  if (paragraphs.length % 2 === 1) {
    warnings.push(`본문 문단 수가 홀수(${paragraphs.length}). 마지막 한국어에 영어 짝이 없음.`);
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

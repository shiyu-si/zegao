export const RECORD = 'plugin:zegao/group'
export const SELECTION = 'zegao-selection'
export const MAX_TEXT = 80000

export function assertText(value, label = '正文') {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_TEXT) {
    throw new Error(`${label}必须非空，且不超过 ${MAX_TEXT} 字符`)
  }
  return value
}

export function validateGroup(group) {
  if (!group || group.schema !== 1 || typeof group.id !== 'string'
    || !/^[a-zA-Z0-9-]{1,80}$/.test(group.id)
    || !Number.isSafeInteger(group.revision) || group.revision < 0
    || !['generating', 'ready', 'failed', 'selected', 'dismissed'].includes(group.status)
    || !Number.isSafeInteger(group.count) || group.count < 1
    || !Array.isArray(group.candidates) || group.candidates.length > group.count) {
    throw new Error('选稿记录格式不正确')
  }
  if (group.attempts !== undefined && (!Array.isArray(group.attempts) || new Set(group.attempts.map(row => row.id)).size !== group.attempts.length)) throw new Error('用量记录无效')
  assertText(group.prompt, '写作要求')
  const ids = new Set()
  for (const candidate of group.candidates) {
    if (typeof candidate.id !== 'string' || ids.has(candidate.id)) throw new Error('候选稿标识重复或无效')
    ids.add(candidate.id)
    assertText(candidate.text)
  }
  if (group.pending && (typeof group.pending.id !== 'string' || !['rewrite', 'revise', 'partial'].includes(group.pending.mode)
    || typeof group.pending.instruction !== 'string' || group.pending.instruction.length > 8000)) throw new Error('生成请求格式不正确')
  if (group.selectedId !== null && !ids.has(group.selectedId)) throw new Error('选中稿不存在')
  if (group.selectedId !== null) assertText(group.selectedText)
  return group
}

export function newGroup(id, prompt, count = 1) {
  return { schema: 1, id, prompt: assertText(prompt, '写作要求'), count,
    revision: 0, status: 'generating', candidates: [], selectedId: null,
    selectedText: null, selectionSeq: null, error: null, createdAt: Date.now() }
}

// Only plugin records archive alternatives. They never join the model surface.
// A selection is one atomic, durable user/message containing the chosen text only.
export function reduceState(state, event) {
  if (event.type === RECORD && event.ignorable === true) {
    const group = validateGroup(event.data)
    const old = state.groups[group.id]
    if (old && group.revision <= old.revision) return state
    return { groups: { ...state.groups, [group.id]: { ...group, anchorSeq: old?.anchorSeq ?? event.seq } } }
  }
  if (event.type === 'user/message' && event.data?.source?.kind === SELECTION) {
    const source = event.data.source
    let old = state.groups[source.groupId]
    if (source.manualCandidate) {
      if (!old || source.revision !== old.revision + 1) throw new Error('手工稿版本冲突')
      old = appendManualCandidate(old, source.manualCandidate)
      if (source.manualCandidate.id !== source.candidateId || source.manualCandidate.text !== source.text) throw new Error('手工稿确认不一致')
    }
    if (!old || source.revision !== old.revision + 1
      || !old.candidates.some(candidate => candidate.id === source.candidateId)) {
      throw new Error('选稿确认记录无法关联候选稿')
    }
    const selectedText = assertText(source.text)
    const group = { ...old, selectedId: source.candidateId, selectedText,
      selectionSeq: event.seq, revision: source.revision, status: 'selected' }
    return { groups: { ...state.groups, [old.id]: group } }
  }
  return state
}

export function parseCommand(input) {
  const raw = input.trim()
  const match = /^([23])(?:\s+)([\s\S]+)$/.exec(raw)
  return { count: 1, prompt: assertText(match ? match[2] : raw, '写作要求') }
}

export function selectionContent(group, text) {
  return `作者已确认以下正文。后续续写以此为准，不要重复输出本段。\n写作要求：${group.prompt}\n\n【已确认正文】\n${text}`
}

export function plainHistory(messages, maxChars = 48000) {
  // A bounded, text-only auxiliary request: no dangling tool protocols or private replay state.
  const chunks = messages.filter(message => ['user', 'assistant'].includes(message.role)).map(message => {
    const text = message.content.filter(block => block.type === 'text').map(block => block.text).join('\n')
    return text ? `${message.role === 'user' ? '作者/上下文' : '助手'}：${text}` : ''
  }).filter(Boolean)
  let total = 0
  const kept = []
  for (let index = chunks.length - 1; index >= 0; index--) {
    const chunk = chunks[index]
    if (total + chunk.length > maxChars) {
      if (!kept.length) kept.unshift(chunk.slice(-maxChars))
      break
    }
    total += chunk.length
    kept.unshift(chunk)
  }
  return kept.join('\n\n')
}

export function exportMarkdown(groups) {
  return '# 择稿备份\n\n' + Object.values(groups).map(group => {
    const selected = group.selectedId === null ? '尚未选择' : group.selectedText
    return `## ${group.prompt}\n\n### 当前采用\n\n${selected}\n\n`
      + group.candidates.map((candidate, i) => `### 候选 ${i + 1}\n\n${candidate.instruction ? `修改要求：${candidate.instruction}\n\n` : ''}${candidate.text}\n`).join('\n')
  }).join('\n---\n\n')
}

// Manual candidates have independent identities; the original and its usage stay intact.
export function appendManualCandidate(group, candidate) {
  if (!candidate || candidate.origin !== 'manual' || typeof candidate.id !== 'string'
    || typeof candidate.requestId !== 'string' || typeof candidate.manualAdopt !== 'boolean'
    || !group.candidates.some(item => item.id === candidate.baseId)
    || group.candidates.some(item => item.id === candidate.id || item.requestId === candidate.requestId)) {
    throw new Error('手工稿来源无效')
  }
  assertText(candidate.text)
  if (candidate.baseRevision !== group.revision || typeof candidate.baseTextHash !== 'string') throw new Error('修改底稿版本无效')
  return validateGroup({ ...group, candidates: [...group.candidates, candidate],
    count: Math.max(group.count, group.candidates.length + 1) })
}

export function textExportSnapshot(groups) {
  const all = Object.values(groups)
  for (const group of all) validateGroup(group)
  const selected = all.filter(group => group.selectedId !== null)
  const anchors = new Set()
  for (const group of selected) {
    if (!Number.isSafeInteger(group.anchorSeq) || group.anchorSeq < 0 || anchors.has(group.anchorSeq)) {
      throw new Error('采用稿顺序记录不完整，不能可靠导出')
    }
    anchors.add(group.anchorSeq)
  }
  selected.sort((a, b) => a.anchorSeq - b.anchorSeq)
  // Never trim, normalize, or rewrite an author's internal whitespace.
  const text = selected.map(group => group.selectedText).join('\n\n')
  return {
    text, segments:selected.map(group=>({groupId:group.id,candidateId:group.selectedId,text:group.selectedText})), adoptedCount: selected.length,
    pendingCount: all.filter(group => group.selectedId === null && group.status !== 'dismissed' && group.candidates.length > 0).length,
    generatingCount: all.filter(group => group.status === 'generating').length,
    characterCount: Array.from(text.replace(/\s/gu, '')).length,
    revisionKey: JSON.stringify(all.map(group => [group.id, group.revision]).sort((a, b) => a[0].localeCompare(b[0]))),
  }
}

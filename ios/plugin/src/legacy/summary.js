export const SUMMARY_RECORD = 'plugin:zegao/summary'
export const emptySummary = () => ({ schema: 1, revision: 0, drafts: [], activeId: null, attempts: [], pending: null })
export function validateSummary(s) {
  if (!s || s.schema !== 1 || !Number.isSafeInteger(s.revision) || s.revision < 0 || !Array.isArray(s.drafts) || !Array.isArray(s.attempts)
    || s.drafts.some(d => !d || typeof d.id !== 'string' || typeof d.text !== 'string' || !d.text.trim() || d.text.length > 16000 || !Array.isArray(d.sources))
    || (s.activeId !== null && !s.drafts.some(d => d.id === s.activeId))) throw new Error('剧情摘要记录无效')
  return s
}
export function reduceSummary(state, event) {
  if (event.type !== SUMMARY_RECORD || event.ignorable !== true) return state
  const next = validateSummary(event.data)
  return next.revision > state.revision ? next : state
}

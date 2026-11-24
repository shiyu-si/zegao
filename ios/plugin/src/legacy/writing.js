export const WRITING_RECORD = 'plugin:zegao/writing'
export const defaultWriting = () => ({ schema: 1, revision: 0, enabled: false, longTerm: '', progress: '' })
export function validateWriting(value) {
  if (!value || value.schema !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0
    || typeof value.enabled !== 'boolean' || !['longTerm', 'progress'].every(key => typeof value[key] === 'string' && value[key].length <= 16000)) throw new Error('写作设定格式无效')
  return value
}
export function reduceWriting(state, event) {
  if (event.type !== WRITING_RECORD || event.ignorable !== true) return state
  const next = validateWriting(event.data)
  return next.revision > state.revision ? next : state
}
export function writingText(settings) {
  if (!settings.enabled || (!settings.longTerm.trim() && !settings.progress.trim())) return ''
  return `【作者手工维护的写作设定 v${settings.revision}，仅当前对话】\n长期设定：\n${settings.longTerm || '（未填写）'}\n当前进度：\n${settings.progress || '（未填写）'}\n本次修改意见不自动变更以上设定；不推测或自动补充既定事实。`
}

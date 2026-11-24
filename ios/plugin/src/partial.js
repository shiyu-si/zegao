export function paragraphs(text) {
  // Offsets refer to the original UTF-16 string; delimiters are never normalized.
  return [...text.matchAll(/[^\r\n]+/g)].filter(match => match[0].trim()).map((match, index) => ({ index, start: match.index, end: match.index + match[0].length, text: match[0] }))
}
export function partialRange(text, from, to) {
  const parts = paragraphs(text)
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to < from || to >= parts.length) throw new Error('请选择连续有效自然段')
  return { from, to, start: parts[from].start, end: parts[to].end }
}
export function mergePartial(text, range, replacement) {
  const expected = partialRange(text, range.from, range.to)
  if (expected.start !== range.start || expected.end !== range.end || typeof replacement !== 'string' || !replacement.trim()
    || replacement.includes('```')) throw new Error('局部输出或范围异常')
  const prefix = text.slice(0, range.start), suffix = text.slice(range.end)
  if ((prefix.length >= 24 && replacement.includes(prefix)) || (suffix.length >= 24 && replacement.includes(suffix))) throw new Error('模型返回了未选中的正文，请检查后重试')
  return prefix + replacement + suffix
}

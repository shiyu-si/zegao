// No paid classification call. Ambiguous input always asks the author.
export function classifyInput(value,mode='auto'){
 if(mode==='discuss'||mode==='continue')return mode
 if(value.length>300&&/[。！？\n]/.test(value)&&!/^\s*(请|帮|写|续写|继续)/.test(value))return 'import'
 const writing=/^(请|帮我|麻烦)?\s*(续写|接着写|继续写|往下写|写下一段|下一段|写一段|写一个|写雨夜)/.test(value.trim())
 const talk=/设定|人设|世界观|分析|讨论|会不会|为什么|合理吗|怎么样|怎么理解|你觉得/.test(value)
 return writing&&!talk?'continue':talk&&!writing?'discuss':'ask'
}

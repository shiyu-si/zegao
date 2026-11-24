import {build} from 'esbuild'
import {fileURLToPath} from 'node:url'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),loop=require.resolve('@deepseek-ai/dsh-agent-loop'),r=createRequire(loop)
const agent=fileURLToPath(new URL('../src/agent.ts','file://'+loop)),inbox=fileURLToPath(new URL('../src/inbox.ts','file://'+loop))
await build({stdin:{contents:`export {ReactLoopAgent} from ${JSON.stringify(agent)};export {inboxProjectionDefinition} from ${JSON.stringify(inbox)};export {Session} from ${JSON.stringify(r.resolve('@deepseek-ai/dsh-session'))};export {modelSelectionProjectionDefinition} from ${JSON.stringify(r.resolve('@deepseek-ai/dsh-agent'))};export {Context} from ${JSON.stringify(r.resolve('@deepseek-ai/cordis'))};`,resolveDir:process.cwd()},outfile:'work/engine-harness.mjs',bundle:true,format:'esm',platform:'node',target:'node24'})

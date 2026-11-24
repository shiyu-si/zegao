import {build} from 'esbuild'
import {createHash} from 'node:crypto'
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
process.chdir(fileURLToPath(new URL('..',import.meta.url)))
await mkdir('lib',{recursive:true});await mkdir('work',{recursive:true})
await writeFile('src/assets.js',`export const brandLogo=${JSON.stringify('data:image/webp;base64,'+(await readFile('assets/brand.webp')).toString('base64'))};\nexport const projectIcon=${JSON.stringify('data:image/webp;base64,'+(await readFile('assets/project.webp')).toString('base64'))};\n`)
await build({absWorkingDir:process.cwd(),entryPoints:['src/host.js'],outfile:'lib/index.js',bundle:true,format:'esm',platform:'node',target:'node24',packages:'external'})
await build({absWorkingDir:process.cwd(),entryPoints:['src/client.jsx'],outfile:'lib/client.js',bundle:true,format:'cjs',platform:'browser',target:['safari17'],external:['react','react-dom','react/jsx-runtime'],loader:{'.css':'text'},banner:{js:'window.__ModuleLoader__.load({id:"dsh-zegao-ios",factory:(require)=>{var module={exports:{}};var exports=module.exports;'},footer:{js:'return module.exports;}});'}})
await build({absWorkingDir:process.cwd(),entryPoints:['src/UI.jsx'],outfile:'work/UI.mjs',bundle:true,format:'esm',platform:'node',packages:'external'})
const buildId='0.1.0-txt-fold-r5'
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const sourceSha256={}
for(const file of (await readdir('src',{recursive:true,withFileTypes:true})).filter(x=>x.isFile())){
 const path=file.parentPath+'/'+file.name
 sourceSha256[path]=sha(await readFile(path))
}
await writeFile('lib/build-info.json',JSON.stringify({name:'dsh-zegao-ios',version:'0.1.0',buildId,target:{app:'Fish Pocket 1.2.1 (120)',engine:'0.2.2-rc.4',surface:'official web UI'},changeScope:'TXT materials, collapsible bubbles and rounded toolbar; retain r4 input and r3 turn fixes',sourceSha256,builtFiles:{'index.js':sha(await readFile('lib/index.js')),'client.js':sha(await readFile('lib/client.js'))},status:'local-checks-only-phone-acceptance-pending'},null,2)+'\n')
console.log(`Built dsh-zegao-ios ${buildId} (DSH rc.4); iPhone acceptance pending.`)

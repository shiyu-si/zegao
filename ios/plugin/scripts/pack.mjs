import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
process.chdir(fileURLToPath(new URL('..',import.meta.url)))
await mkdir('outputs',{recursive:true})
const p=spawnSync('pnpm',['pack','--out','outputs/dsh-zegao-ios-0.1.0.tgz'],{stdio:'inherit'})
if(p.status!==0)throw Error('打包未完成')
const bytes=await readFile('outputs/dsh-zegao-ios-0.1.0.tgz')
await writeFile('outputs/安装包_SHA256.txt',createHash('sha256').update(bytes).digest('hex')+'  dsh-zegao-ios-0.1.0.tgz\n')

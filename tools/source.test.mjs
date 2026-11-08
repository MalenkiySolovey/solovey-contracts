import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import {test} from 'node:test'
import {execFileSync, spawnSync} from 'node:child_process'
import {root,verifySource} from './verify-source.mjs'

function fixture(run) {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'solovey-contracts-source-'))
  try {
    for(const name of ['management/v1','tools/generate.mjs','go.mod','LICENSE','SOURCE_PROVENANCE.json']) {
      const destination=path.join(directory,name)
      fs.mkdirSync(path.dirname(destination),{recursive:true})
      fs.cpSync(path.join(root,name),destination,{recursive:true})
    }
    run(directory)
  } finally {
    assert.equal(path.dirname(directory),os.tmpdir())
    assert.ok(path.basename(directory).startsWith('solovey-contracts-source-'))
    fs.rmSync(directory,{recursive:true,force:true})
  }
}

test('accepted source preserves all 115 frozen R6 fixture IDs',()=>assert.equal(verifySource().vectors,115))
for(const name of ['schema.json','vectors.json','manifest.json','types.gen.go','codec.go'])
  test(`altered ${name} with old manifest is rejected`,()=>fixture(directory=>{
    const filename=path.join(directory,'management/v1',name)
    if(name==='manifest.json') {
      const manifest=JSON.parse(fs.readFileSync(filename))
      manifest.bundleSHA256='0'.repeat(64)
      fs.writeFileSync(filename,JSON.stringify(manifest)+'\n')
    } else fs.appendFileSync(filename,'\n')
    assert.throws(()=>verifySource(directory))
  }))

test('altered generator with old identity is rejected',()=>fixture(directory=>{
  fs.appendFileSync(path.join(directory,'tools/generate.mjs'),'\n')
  assert.throws(()=>verifySource(directory),/generator drift/)
}))

test('wrong source module and local source substitution are rejected',()=>fixture(directory=>{
  fs.appendFileSync(path.join(directory,'go.mod'),'\nreplace example.invalid/source => ../source\n')
  assert.throws(()=>verifySource(directory),/module identity/)
}))

test('generator detects output drift and rejects unsupported schema assertions',()=>fixture(directory=>{
  const generated=path.join(directory,'management/v1/types.gen.go')
  fs.appendFileSync(generated,'\n// drift\n')
  const run=()=>spawnSync(process.execPath,[path.join(directory,'tools/generate.mjs'),'--check'],{cwd:directory,encoding:'utf8'})
  const drift=run()
  assert.notEqual(drift.status,0)
  assert.match(drift.stderr,/Contract drift: types.gen.go/)
  const filename=path.join(directory,'management/v1/schema.json')
  const schema=JSON.parse(fs.readFileSync(filename))
  schema.$defs.HostRef.not={}
  fs.writeFileSync(filename,JSON.stringify(schema)+'\n')
  const unsupported=run()
  assert.notEqual(unsupported.status,0)
  assert.match(unsupported.stderr,/Unsupported schema assertion: not/)
}))

test('generation is reproducible in isolation',()=>fixture(directory=>{
  const before=fs.readFileSync(path.join(directory,'management/v1/manifest.json'))
  execFileSync(process.execPath,[path.join(directory,'tools/generate.mjs')],{cwd:directory})
  assert.deepEqual(fs.readFileSync(path.join(directory,'management/v1/manifest.json')),before)
  assert.equal(verifySource(directory).status,'PASS')
}))

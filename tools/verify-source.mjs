import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'

export const root = fileURLToPath(new URL('../', import.meta.url))
const digest = value => createHash('sha256').update(value).digest('hex')
const frozen = {
  'schema.json': '629e9397122bb06e3534cd5753137d6acd4f51016bf96a038558bb0f5e434b8b',
  'types.gen.go': '90d6b8bfd66a2167b410f4044f8b1ba05653a9dd8d971d3ef24f67b3dde35aec',
  'vectors.json': '1e3e87c62ad4bbdd47a1c34d41b0a0be156d9c76851ecef61bf2d9fde3ab90ff',
  'codec.go': 'ccad977308ce4dd48bf4792a61fa1234cc336118d0dc6b739df6da8f82cfb442',
  'codec_test.go': '449cfa58cd884178603db8cf334e89edeca321152f28ece3c8801bee0ec96c62',
}
const generatorSHA256 = '23aa4df0d97f342e616ad943f7c13e131ebe0777089386115c50a23759d6593e'

export function verifySource(directory = root) {
  const read = name => fs.readFileSync(path.join(directory,name),'utf8').replaceAll('\r\n','\n')
  assert.equal(read('go.mod'),'module github.com/MalenkiySolovey/solovey-contracts\n\ngo 1.26.10\n','module identity/dependency drift')
  const provenance = JSON.parse(read('SOURCE_PROVENANCE.json'))
  assert.equal(provenance.source.repository,'MalenkiySolovey/solovey-ui')
  assert.equal(provenance.source.contractCommit,'72753f9f37b134e9949a766496b658415401e0f7')
  assert.equal(digest(read('LICENSE')),provenance.license.sha256,'original GPL license drift')
  const manifest = JSON.parse(read('management/v1/manifest.json'))
  assert.equal(manifest.contractVersion,'solovey.management/v1')
  assert.deepEqual(Object.keys(manifest.files).sort(),[...Object.keys(frozen),'README.md'].sort(),'unexpected bundle file set')
  for(const [name,hash] of Object.entries(manifest.files)) {
    assert.equal(digest(read(`management/v1/${name}`)),hash,`bundle drift: ${name}`)
    if(frozen[name]) assert.equal(hash,frozen[name],`frozen R6 source changed: ${name}`)
  }
  assert.equal(manifest.schemaSHA256,frozen['schema.json'])
  assert.equal(manifest.generatedSHA256,frozen['types.gen.go'])
  assert.equal(manifest.vectorsSHA256,frozen['vectors.json'])
  assert.equal(manifest.vectorsVersion,'solovey.management.conformance/v1')
  assert.equal(manifest.generator.id,'solovey-schema-go/v1')
  assert.equal(manifest.generator.gofmt,'go1.26.10')
  assert.equal(manifest.generator.sha256,generatorSHA256)
  assert.equal(digest(read('tools/generate.mjs')),generatorSHA256,'generator drift')
  const bundle = Object.entries(manifest.files).sort(([a],[b])=>a<b?-1:1).map(([name,hash])=>`${name}\0${hash}\n`).join('')
  assert.equal(digest(bundle),manifest.bundleSHA256,'canonical bundle digest drift')
  const vectors = JSON.parse(read('management/v1/vectors.json'))
  assert.equal(vectors.version,manifest.vectorsVersion)
  assert.equal(vectors.cases.length,115)
  assert.equal(new Set(vectors.cases.map(v=>v.id)).size,115,'duplicate conformance ID')
  const schema=JSON.parse(read('management/v1/schema.json'))
  assert.equal(schema.$id,'https://github.com/MalenkiySolovey/solovey-ui/contracts/management/v1/schema.json','legacy schema identity changed')
  return {status:'PASS',contract:manifest.contractVersion,vectors:115,schemaSHA256:manifest.schemaSHA256,bundleSHA256:manifest.bundleSHA256}
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  console.log(JSON.stringify(verifySource()))

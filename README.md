# Solovey Contracts

Independent source authority for the existing `solovey.management/v1` semantic
and wire contract. This is a source library, not a Node agent or a product release.

Public Go package: `github.com/MalenkiySolovey/solovey-contracts/management/v1`.
The root Go module uses ordinary semantic versions, independently of Solovey UI's
product CalVer. The initial qualified module is intended to be `v1.0.0`; no tag
is published until the producer PR and source CI are accepted. Tags are immutable.

With Go 1.26.10 and Node 24.16.0 installed:

```text
node tools/generate.mjs --check
node tools/verify-source.mjs
node --test tools/source.test.mjs
go test -race ./...
go vet ./...
```

The schema, codec, generated Go types, generator and all 115 golden vectors are
byte-identical to accepted R6 source. Only the contract README's ownership and
invocation paths, and its derived manifest/bundle digest, change on relocation.
`SOURCE_PROVENANCE.json` retains the original source manifest, Git blobs,
authorship history and GPLv3 license digest. The schema's legacy `$id` deliberately
remains unchanged; this repository is its authoritative editable source.

The codec tests validate shape, strict decoding, canonical digest and reason
semantics. Stateful conformance cases are independently executed by Panel's real
owner adapters and Node's fixture harness; this library adds no runtime to run them.

During the M1 producer → Panel → Node cutover, contract meaning is frozen at the
accepted R6 baseline. Consumers must use the same qualified immutable module
version with checksum verification and `GOWORK=off`. No local `replace`, mutable
branch or copied implementation is an accepted source dependency. Product
publication remains owned by `MalenkiySolovey/solovey-ui`.

License: GNU General Public License version 3; see [LICENSE](LICENSE).
The source license and authorship of extracted files are retained, without
relicensing. See the extraction provenance accompanying the producer PR.

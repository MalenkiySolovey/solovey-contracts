# Solovey Contracts

[English](README.md) | [Русский](README.ru.md)

`solovey-contracts` is the authoritative, versioned semantic management contract repository for Solovey UI and future Solovey Node integrations. It defines the formal contract schema, generated Go types, bounded validation codec, and conformance vectors shared across independently maintained Solovey repositories.

This repository serves strictly as a specification and contract library. It does not implement a management server, Node runtime, network transport, database, or privileged execution daemon.

## Architecture and Responsibilities

The contracts repository provides a shared semantic specification that decouples the management control plane (Solovey Panel) from the managed target (Solovey Host and future Solovey Node):

```text
+-------------------------------------------------------+
|                     Solovey Panel                     |
|  (Orchestration, Session Auth, Web UI, State Storage) |
+-------------------------------------------------------+
                           |
                           | imports immutable Go module
                           v
+-------------------------------------------------------+
|                   solovey-contracts                   |
|  - JSON Schema 2020-12 (solovey.management/v1)        |
|  - Generated Go data models (managementv1)            |
|  - Zero-dependency bounded codec & validation         |
|  - Canonical command & input digest calculation       |
|  - 115 golden conformance vectors                     |
+-------------------------------------------------------+
                           ^
                           | imports immutable Go module
                           |
+-------------------------------------------------------+
|           Solovey Host / future Solovey Node          |
|    (Target Host Execution, Domain Adapters, Health)   |
+-------------------------------------------------------+
```

### Scope and Boundaries

- **In Scope**:
  - Declarative schema definitions for commands, resources, grants, capabilities, and health evidence.
  - Generated Go models strictly matching the schema (`types.gen.go`).
  - Strict, deterministic JSON validation and canonical digest generation (`codec.go`).
  - Fixed conformance vectors verifying wire compatibility and state invariants (`vectors.json`).
  - Verification scripts and generation tooling (`tools/`).
- **Out of Scope**:
  - Server daemons, listeners, or RPC dispatchers.
  - Network transport protocols (HTTP, gRPC, WebSocket).
  - Authentication schemes, MFA token generation, or credential vaults.
  - Database persistence, transaction logging, or state storage.
  - Operating system commands, shell execution, or firewall/routing manipulation (`nftables`, `iptables`).
  - Production Node agent runtime.

## Repository Structure

The repository contains the following components:

```text
solovey-contracts/
├── management/
│   └── v1/
│       ├── schema.json          # JSON Schema 2020-12 with x-actions, x-inputs, x-reasons
│       ├── types.gen.go         # Generated Go structs for managementv1 package
│       ├── codec.go             # Bounded JSON validation, decoding, and digest functions
│       ├── codec_test.go        # Codec unit tests and conformance vector assertions
│       ├── vectors.json         # 115 golden conformance vectors
│       ├── manifest.json        # Checksums of schemas, models, generator, and vectors
│       └── README.md            # Internal contract specification and boundaries
├── tools/
│   ├── generate.mjs             # Go struct and manifest generator from schema.json
│   ├── verify-source.mjs        # Source integrity and immutability verification
│   └── source.test.mjs          # Conformance and generator determinism test suite
├── SOURCE_PROVENANCE.json       # Upstream git commit, blob SHA-256, and authorship tracking
├── CHANGELOG.md                 # Contract release history
├── OWNERS.md                    # Maintainer and review boundaries
├── go.mod                       # Go 1.26.10 module definition (zero external dependencies)
├── LICENSE                      # GNU General Public License v3 (GPL-3.0)
├── README.md                    # Primary documentation (English)
└── README.ru.md                 # Primary documentation (Russian)
```

## Core Contract Concepts

The `solovey.management/v1` contract defines closed semantic structures with fail-closed validation rules.

### Host and Resource References

- **`HostRef`**: Identifies target execution scope.
  - Local Host: strictly `{ "kind": "LOCAL", "id": "local" }`.
  - Remote Node: `{ "kind": "NODE", "id": "node:<opaque>" }` with an opaque, stable `NodeID`.
  - Whitespace trimming, host aliases, and IP/MAC addresses are rejected as host identifiers.
- **`ResourceRef`**: Identifies a specific managed entity within a host scope via three properties:
  - `host` (`HostRef`): The host where the resource resides.
  - `owner` (`string`): The semantic domain owning the resource (e.g., `data`, `component-lifecycle`).
  - `resourceId` (`string`): The domain-qualified identifier (e.g., `database`, `component:panel-update-ui`).

### Actions and Mutation Commands

- **`ActionDescriptor`**: Metadata describing an admitted operation:
  - `id`: Unique action identifier (e.g., `backup.restore`, `component.remove`).
  - `owner`: Managing semantic domain (`data`, `component-lifecycle`).
  - `permission`: Required permission scope.
  - `hostScope`: Scope boundary, strictly `TARGET_HOST`.
  - `resourceScope`: Admitted target resource pattern.
  - `riskClass`: Operational risk rating (`HIGH`, `CRITICAL`).
  - `inputSchema`: Schema identifier governing typed input.
  - `preview`: Indicates if dry-run preview is supported.
  - `stepUpPolicy`: Elevated authorization policy (e.g., `existing_browser_one_use`).
  - `auditClass`: Classification for audit logs.
  - `revisionFence`: Concurrency fence type (`OWNER_REQUIRED` or `OWNER_LIFECYCLE`).
- **`Command`**: Mutation instruction submitted to a target host. Contains `contractVersion`, `commandId`, `actionId`, `host`, `resource`, `generation`, `inputSchema`, `inputDigest`, `input`, `correlationId`, `grantRef`, and an optional `expectedRevision`.
- **`CommandDigest`**: Deterministic SHA-256 hash computed over normalized, key-sorted JSON of execution-affecting fields (`contractVersion`, `actionId`, `host`, `resource`, `generation`, `inputSchema`, `inputDigest`, `input`, and `expectedRevision`). Delivery metadata (`commandId`, `correlationId`, `grantRef`) is excluded so that delivery retries with refreshed credentials do not alter semantic intent.
- **`OwnerInputDigest`**: Canonical hash of typed inputs, preserving byte-exact format: `SHA256(inputSchema + "\x00" + typedInput)`.

### Authority and Idempotency

- **`ManagementGrant`**: Semantic authorization binding linking actor identity, issuing authority, target action, permission, host, resource, input digest, authorization/credential/MFA generation counters, expiry timestamp, and single-use nonce.
  - A grant JSON does not self-authenticate; authorization must be verified by the host authority before executing actions.
- **Idempotency vs Conflict**:
  - Resending an identical command (`same commandId` + `same CommandDigest`) returns the recorded `CommandResult` or `Job` with `replay: true`, without repeating execution.
  - Resending an identical `commandId` with a different payload or intent results in a conflict error (`RESOURCE_CONFLICT` / `INVALID_INPUT`).
  - Submitting an unexpected or stale `expectedRevision` results in `REVISION_CONFLICT`.

### Observability and State

- **`Capability`**: Reports operational capabilities (`value`: `yes`, `no`, or `unknown`). Unavailable facts fail closed as `unknown`.
- **`Change` and `Job`**: Tracks execution progress through discrete states: `PENDING`, `COMMITTED`, `FAILED`, `ROLLED_BACK`, and `RECOVERY_REQUIRED`. Cancellation is non-preemptive and only processed at safe synchronization points. Progress is reported in bounded integer units (`completed` / `total`), never guessed percentages.
- **`HealthEvidence`**: Time-bounded proof of health. Includes `resource`, `proofKind`, `source`, `observedRevision`, `evidenceRevision`, observation timestamp (`observedAt`), and time-to-live (`maxAgeSeconds`, bounded between 1 and 60 seconds). Expired evidence immediately degrades to `UNKNOWN`.
- **`ArtifactTrust`**: Content-addressed artifact identity (`kind + "\x00" + contentDigest`) evaluated to an explicit trust status (`VERIFIED`). Checksums alone do not establish trust without verification.
- **`SecretRef`**: Masked reference indicating the presence and policy of a secret within an owner domain, without exposing raw secret data.

## Code Examples

### 1. Identifying a Host (`HostRef`)

Local Host representation:

```json
{
  "kind": "LOCAL",
  "id": "local"
}
```

Remote Node representation:

```json
{
  "kind": "NODE",
  "id": "node:worker-node-01"
}
```

### 2. Qualified Resource Reference (`ResourceRef`)

Referencing the primary database resource on the local host:

```json
{
  "host": {
    "kind": "LOCAL",
    "id": "local"
  },
  "owner": "data",
  "resourceId": "database"
}
```

### 3. Submitting a Mutation Command (`Command`)

A database restore command with optimistic revision fencing and bound input digest:

```json
{
  "contractVersion": "solovey.management/v1",
  "commandId": "cmd-2026-11-09-001",
  "actionId": "backup.restore",
  "host": {
    "kind": "LOCAL",
    "id": "local"
  },
  "resource": {
    "host": {
      "kind": "LOCAL",
      "id": "local"
    },
    "owner": "data",
    "resourceId": "database"
  },
  "expectedRevision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "generation": "7",
  "inputSchema": "solovey.action/backup.restore/v1",
  "inputDigest": "79aa3c625100c984a6a4c562001973c06f9a9ed7d768ece8973d5a758ae19185",
  "input": {
    "rehearsalRevision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  "correlationId": "corr-session-8421",
  "grantRef": "grant-op-4096"
}
```

### 4. Decoding and Validating Documents in Go

```go
package main

import (
	"fmt"
	"log"

	managementv1 "github.com/MalenkiySolovey/solovey-contracts/management/v1"
)

func main() {
	rawJSON := []byte(`{
		"kind": "LOCAL",
		"id": "local"
	}`)

	var host managementv1.HostRef
	if err := managementv1.Decode("HostRef", rawJSON, &host); err != nil {
		log.Fatalf("Validation failed: %v", err)
	}

	fmt.Printf("Validated host: %s (%s)\n", host.ID, host.Kind)
}
```

## Contract Versioning and Compatibility

| Dimension | Identifier | Governance |
| :--- | :--- | :--- |
| **Contract Protocol** | `solovey.management/v1` | Protocol wire contract and JSON Schema specification. |
| **Go Module** | `v1.0.0` (Semantic Versioning) | Git release tags for this Go repository. |
| **Product Release** | CalVer (e.g., `2026.3.2-beta.10`) | Managed independently by `MalenkiySolovey/solovey-ui`. |

### Validation Rules and Constraints

- **Closed Objects**: Unknown object fields, unmapped action schemas, or unrecognized enum states fail closed.
- **Document Size Limits**: Maximum payload size is 256 KiB; maximum object nesting depth is 24; maximum object properties count is 48; maximum array elements count is 256.
- **Numbers**: Integers must fall strictly within the safe floating-point range: `-(2^53 - 1)` to `2^53 - 1` (`±9007199254740991`). Generations and counters exceeding this range are encoded as positive decimal strings.
- **String Identifiers**: ASCII characters only (`^[A-Za-z0-9._:@+-]+$`), case-sensitive, no leading or trailing whitespace.

## Development and Verification

### Prerequisites

- Go `1.26.10` or compatible.
- Node.js `24.16.0` (uses standard library modules; no external npm packages required).

### Verification Commands

Verify that checked-in Go code matches the schema without regenerating files:

```bash
node tools/generate.mjs --check
```

Verify repository source integrity, manifest checksums, and license provenance:

```bash
node tools/verify-source.mjs
```

Execute generator and provenance conformance tests:

```bash
node --test tools/source.test.mjs
```

Run Go unit tests and conformance suite with the race detector enabled:

```bash
go test -race ./...
```

Run Go static analysis:

```bash
go vet ./...
```

### Code Generation

To regenerate Go models and manifest digests when schema definitions are updated:

```bash
node tools/generate.mjs
```

## Consuming in Other Repositories

Consuming projects (such as `solovey-ui` and future Node components) import the qualified Go package:

```bash
go get github.com/MalenkiySolovey/solovey-contracts@v1.0.0
```

```go
import "github.com/MalenkiySolovey/solovey-contracts/management/v1"
```

Consuming repositories must adhere to the following integration guidelines:
- Depend only on immutable, published release tags (e.g., `v1.0.0`).
- Ensure Go checksum verification is active via `go.sum`.
- Do not use mutable local `replace` directives or copy contract source code directly into consuming repositories.
- Keep `GOWORK=off` during CI validation to prevent cross-workspace contamination.

## License and Provenance

- **License**: GNU General Public License v3 (`GPL-3.0`). See [LICENSE](LICENSE).
- **Source Provenance**: Extracted from `MalenkiySolovey/solovey-ui` at baseline commit `6e557aac84ac6c23cb7141c8ed4ce93d93c77bcd`. Original authorship, Git blob digests, and GPLv3 licensing are preserved without relicensing. See [SOURCE_PROVENANCE.json](SOURCE_PROVENANCE.json).

# Source ownership and compatibility

`@MalenkiySolovey` maintains the public contract schema, bounded codec, generator,
golden vectors, source provenance and immutable module versions.

Contract representation does not transfer runtime ownership. Authentication,
authorization, one-use consumption, persistence, execution and product signing
remain with their existing Panel/Node/domain owners. Security-sensitive semantic
changes require affected domain review and independently qualified consumers.

Changes use source branches, normal pull requests, exact-head source CI and
ordinary merges. M1 freezes existing R6 semantics through both consumer cutovers.
After adoption this repository is the sole editable management/v1 authority.
Published module tags must never be moved or republished with different bytes.

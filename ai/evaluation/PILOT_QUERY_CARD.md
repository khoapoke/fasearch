# Pilot query card v1

`evaluation/pilot_queries.v1.jsonl` contains 24 manually authored pipeline queries. They are permanently marked `pilot_only: true` and must never be copied into the frozen final benchmark.

Coverage:

- 12 text-only queries;
- 6 image-only queries with exact self excluded and a distinct synthetic variant as target;
- 6 equal-weight image-plus-text pairs;
- Vietnamese with and without diacritics;
- colloquial and code-switched wording;
- color, category, season/usage wording;
- simple negation.

The target IDs refer only to the generated Dataset A fixture. When the real Dataset A catalog is installed, create a separately versioned pilot query mapping; do not silently reuse these target IDs.

The fixture relevance grades are deterministic code-test labels derived from expected category/color. They are not human judgments and cannot support scientific model-quality claims.

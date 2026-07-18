#!/usr/bin/env bash
set -euo pipefail

required_files=(
  "AGENTS.md"
  "CANONICAL_TRUTH.md"
  "PLANS.md"
  "memory_bank/memory_bank_index.md"
  "memory_bank/projectbrief.md"
  "memory_bank/activeContext.md"
  "planning/DECISION_LOG.md"
  "planning/BLOCKERS.md"
  "planning/VALIDATION_MATRIX.md"
  "docs/handoff/SOURCE_MANIFEST.md"
  "docs/research/BUILD_WEEK_RULES_SNAPSHOT.md"
)

for file in "${required_files[@]}"; do
  test -f "${file}" || {
    echo "Missing canonical file: ${file}"
    exit 1
  }
done

if rg -n '(^|[^[:alnum:]_])(TODO|TBD)([^[:alnum:]_]|$)' \
  CANONICAL_TRUTH.md memory_bank planning PLANS.md; then
  echo "Canonical truth contains an unresolved placeholder. Use an explicit status and blocker instead."
  exit 1
fi

if ! rg -q 'Live GitHub truth' memory_bank/activeContext.md; then
  echo "Active context must separate live GitHub truth."
  exit 1
fi

if ! rg -q 'Browser or hosted truth' memory_bank/activeContext.md; then
  echo "Active context must separate browser or hosted truth."
  exit 1
fi

if ! rg -q 'Human acceptance' memory_bank/activeContext.md; then
  echo "Active context must separate human acceptance."
  exit 1
fi

echo "Canonical truth validation passed."

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

search_lines() {
  if command -v rg >/dev/null 2>&1; then
    rg -n "$@"
  else
    grep -REn "$@"
  fi
}

search_quiet() {
  if command -v rg >/dev/null 2>&1; then
    rg -q "$@"
  else
    grep -Eq "$@"
  fi
}

if search_lines '(^|[^[:alnum:]_])(TODO|TBD)([^[:alnum:]_]|$)' \
  CANONICAL_TRUTH.md memory_bank planning PLANS.md; then
  echo "Canonical truth contains an unresolved placeholder. Use an explicit status and blocker instead."
  exit 1
fi

if ! search_quiet 'Live GitHub truth' memory_bank/activeContext.md; then
  echo "Active context must separate live GitHub truth."
  exit 1
fi

if ! search_quiet 'Browser or hosted truth' memory_bank/activeContext.md; then
  echo "Active context must separate browser or hosted truth."
  exit 1
fi

if ! search_quiet 'Human acceptance' memory_bank/activeContext.md; then
  echo "Active context must separate human acceptance."
  exit 1
fi

echo "Canonical truth validation passed."

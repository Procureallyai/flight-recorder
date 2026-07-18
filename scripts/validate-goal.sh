#!/usr/bin/env bash
set -euo pipefail

bash scripts/validate-canonical-truth.sh

skill_dirs=(
  ".agents/skills/flight-recorder-delivery"
  ".agents/skills/flight-recorder-devpost"
)

for skill_dir in "${skill_dirs[@]}"; do
  LOCAL_HOME/.agents/skills/.venv/bin/python \
    LOCAL_HOME/.agents/skills/skill-creator/scripts/quick_validate.py \
    "${skill_dir}"
done

echo "Flight Recorder goal validation passed."

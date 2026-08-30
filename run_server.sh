#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ -x ./venv/bin/python ]]; then
  exec ./venv/bin/python word_bank_gui.py
fi
exec python3 word_bank_gui.py

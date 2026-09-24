#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

# Try a few interpreters in order and use the first one that can actually
# create a working virtualenv (some systems ship a python without its venv/
# ensurepip module installed, e.g. python3.12 needing python3.12-venv).
if [ ! -d .venv ]; then
  for cand in python3.12 python3.11 python3.13 python3; do
    command -v "$cand" >/dev/null 2>&1 || continue
    rm -rf .venv
    if "$cand" -m venv .venv 2>/tmp/venv_err.log && .venv/bin/python -m pip --version >/dev/null 2>&1; then
      echo "Using $cand"
      break
    fi
    rm -rf .venv
  done
  if [ ! -d .venv ]; then
    echo "Could not create a virtualenv with any available Python (venv/ensurepip missing)." >&2
    echo "Last error:" >&2
    cat /tmp/venv_err.log >&2 2>/dev/null || true
    echo "Try: sudo apt update && sudo apt install -y python3-venv" >&2
    exit 1
  fi
fi

source .venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt
[ -f .env ] || cp .env.example .env
python -m app.seed
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

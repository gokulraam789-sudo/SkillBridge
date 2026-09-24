#!/usr/bin/env bash
# Starts the API and the web app together. Ctrl-C stops both.
set -e
cd "$(dirname "$0")"
trap 'kill 0' EXIT

./backend/run.sh &

cd frontend
[ -d node_modules ] || npm install
npm run dev &

wait

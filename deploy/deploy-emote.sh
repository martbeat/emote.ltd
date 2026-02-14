#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   deploy/deploy-emote.sh [repo_dir] [remote]
# Defaults:
#   repo_dir=/home/martin/emote.ltd
#   remote=origin/main

REPO_DIR="${1:-/home/martin/emote.ltd}"
REMOTE_REF="${2:-origin/main}"

cd "$REPO_DIR"

echo "[deploy] Fetching latest changes..."
git fetch origin main

if [[ -n "$(git status --porcelain)" ]]; then
  STASH_MSG="autostash-before-deploy-$(date +%Y%m%d-%H%M%S)"
  echo "[deploy] Local changes detected; stashing as: ${STASH_MSG}"
  git stash push -u -m "$STASH_MSG" >/dev/null
fi

echo "[deploy] Resetting to ${REMOTE_REF}"
git reset --hard "$REMOTE_REF"

echo "[deploy] Cleaning untracked files"
git clean -fd

echo "[deploy] Deploy complete at $(git rev-parse --short HEAD)"

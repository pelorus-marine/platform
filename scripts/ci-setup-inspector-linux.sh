#!/usr/bin/env bash
# Linux packages + minimal frontend stub for CI jobs that build the full workspace
# (workspace includes pelorus-inspector / Tauri).
set -euo pipefail

sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf \
  libsoup-3.0-dev \
  libjavascriptcoregtk-4.1-dev

mkdir -p pelorus-inspector/dist
printf '%s\n' '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>' \
  > pelorus-inspector/dist/index.html

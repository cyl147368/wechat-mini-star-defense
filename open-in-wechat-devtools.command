#!/bin/zsh
set -e
SCRIPT_DIR="${0:A:h}"
cd "${SCRIPT_DIR}"
npm run build:release
/Applications/wechatwebdevtools.app/Contents/MacOS/cli open --project "${SCRIPT_DIR:h}/wechat-mini-star-defense-release" --port 9420 --lang zh

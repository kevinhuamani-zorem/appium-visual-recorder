#!/bin/bash
echo "Limpiando puerto 4723..."
lsof -ti :4723 | xargs kill -9 2>/dev/null || true
sleep 1

echo "Iniciando Appium en background..."
appium --port 4723 --log-level error --relaxed-security &
APPIUM_PID=$!
echo "Appium PID: $APPIUM_PID"

echo "Esperando Appium..."
sleep 4

echo "Iniciando Electron..."
# tsc compila recorder/src/main.ts → dist/recorder/src/main.js (definido en package.json "main")
npm run build && ./node_modules/.bin/electron .

echo "Cerrando Appium..."
kill $APPIUM_PID 2>/dev/null || true

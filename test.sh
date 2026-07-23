#!/bin/bash
set -e

# ─── Leer tipo de sesión desde session_config.json ───────────────────────────
SESSION_TYPE=$(node -e "
  try {
    const c = require('./resources/session_config.json');
    process.stdout.write(c.type || 'local');
  } catch(e) {
    process.stdout.write('local');
  }
" 2>/dev/null || echo "local")

SESSION_PLATFORM=$(node -e "
  try {
    const c = require('./resources/session_config.json');
    process.stdout.write(c.platform || 'android');
  } catch(e) {
    process.stdout.write('android');
  }
" 2>/dev/null || echo "android")

SESSION_DEVICE=$(node -e "
  try {
    const c = require('./resources/session_config.json');
    process.stdout.write(c.deviceName || '');
  } catch(e) {
    process.stdout.write('');
  }
" 2>/dev/null || echo "")

echo ""
echo "══════════════════════════════════════════════"
echo "  Appium Visual Recorder — Ejecución de Tests"
echo "══════════════════════════════════════════════"
echo "  Modo      : $SESSION_TYPE"
echo "  Plataforma : $SESSION_PLATFORM"
echo "  Dispositivo: $SESSION_DEVICE"
echo "══════════════════════════════════════════════"
echo ""

APPIUM_PID=""

if [ "$SESSION_TYPE" = "local" ]; then
    echo "▶ Iniciando servidor Appium local en puerto 4723..."
    lsof -ti :4723 | xargs kill -9 2>/dev/null || true
    sleep 1
    appium --port 4723 --log-level error --relaxed-security &
    APPIUM_PID=$!
    echo "  Appium PID: $APPIUM_PID"
    sleep 4
else
    echo "▶ Modo BrowserStack — omitiendo Appium local"
fi

echo ""
echo "▶ Ejecutando tests con Cucumber..."
echo ""

set +e
npm test
TEST_EXIT=$?
set -e

echo ""
if [ "$SESSION_TYPE" = "local" ] && [ -n "$APPIUM_PID" ]; then
    echo "▶ Deteniendo servidor Appium (PID $APPIUM_PID)..."
    kill $APPIUM_PID 2>/dev/null || true
fi

echo ""
if [ $TEST_EXIT -eq 0 ]; then
    echo "✓ Tests completados correctamente"
else
    echo "✗ Tests fallaron (exit code: $TEST_EXIT)"
fi
echo ""
exit $TEST_EXIT

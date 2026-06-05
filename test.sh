#!/bin/bash
lsof -ti :4723 | xargs kill -9 2>/dev/null || true
sleep 1
appium --port 4723 --log-level error --relaxed-security &
APPIUM_PID=$!
sleep 4
npm test
kill $APPIUM_PID 2>/dev/null || true

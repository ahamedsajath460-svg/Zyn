#!/bin/bash
# Runs INSIDE the Android emulator started by cloud-android-test.yml.
# usage: emulator-smoke.sh <apk> <package> <out_dir> <monkey_events>
# Installs the APK, launches it, takes screenshots, drives it with random UI events (basic automated UI test),
# collects logcat and reports crashes / ANRs. Exit 0 = no crash, 1 = crash or install failure.
set -u
APK=$1; PKG=$2; OUT=$3; EVENTS=${4:-200}
mkdir -p "$OUT"; : > "$OUT/crash-report.txt"
adb wait-for-device
adb shell input keyevent 82 >/dev/null 2>&1 || true
adb logcat -c
if ! adb install -r -t "$APK" > "$OUT/install.txt" 2>&1; then echo "INSTALL FAILED"; cat "$OUT/install.txt"; echo "install failed" >> "$OUT/crash-report.txt"; adb logcat -d > "$OUT/logcat.txt"; exit 1; fi
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 > "$OUT/launch.txt" 2>&1
sleep 8
adb exec-out screencap -p > "$OUT/01-launch.png"
# monkey = basic automated UI test: taps, swipes, key events, seeded so the run can be repeated
adb shell monkey -p "$PKG" -s 42 --throttle 250 --pct-syskeys 0 --pct-appswitch 0 --ignore-security-exceptions "$EVENTS" > "$OUT/monkey.txt" 2>&1
MONKEY=$?
sleep 2
adb exec-out screencap -p > "$OUT/02-after-ui-test.png"
adb shell am force-stop "$PKG"; sleep 1
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep 5     # restart check
adb exec-out screencap -p > "$OUT/03-restart.png"
adb logcat -d -v time > "$OUT/logcat.txt"
python3 "$(dirname "$0")/cloud_tools.py" redact < "$OUT/logcat.txt" > "$OUT/logcat.redacted" && mv "$OUT/logcat.redacted" "$OUT/logcat.txt"
grep -E "FATAL EXCEPTION|ANR in $PKG|Process: $PKG.*PID|AndroidRuntime: .*Exception" "$OUT/logcat.txt" | head -40 >> "$OUT/crash-report.txt"
grep -q -E "// CRASH|// NOT RESPONDING" "$OUT/monkey.txt" && grep -E "// CRASH|// NOT RESPONDING|// Long Msg|// Short Msg" "$OUT/monkey.txt" | head -20 >> "$OUT/crash-report.txt"
if [ -s "$OUT/crash-report.txt" ] || [ "$MONKEY" -ne 0 ]; then echo "CRASH OR MONKEY FAILURE (monkey exit $MONKEY)"; cat "$OUT/crash-report.txt"; exit 1; fi
echo "No crash detected in launch, $EVENTS random UI events and restart."

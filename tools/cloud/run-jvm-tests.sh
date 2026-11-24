#!/bin/bash
# Compiles CloudCore.kt (pure JVM) and runs CloudCoreTest against a local fake GitHub server. No Android SDK needed.
set -e
H=$(cd "$(dirname "$0")/.." && pwd); L=${GRADLE_LIB:-/opt/gradle-8.14.3/lib}
CP="$L/kotlin-compiler-embeddable-2.0.21.jar:$L/kotlin-stdlib-2.0.21.jar:$L/kotlin-script-runtime-2.0.21.jar:$L/kotlin-reflect-2.0.21.jar:$L/kotlin-daemon-embeddable-2.0.21.jar:$L/trove4j-1.0.20200330.jar:$L/annotations-24.0.1.jar:$L/kotlinx-coroutines-core-jvm-1.6.4.jar"
OUT=${TMPDIR:-/tmp}/cloudcore_out; rm -rf "$OUT"; mkdir -p "$OUT"
java -cp "$CP" org.jetbrains.kotlin.cli.jvm.K2JVMCompiler -no-stdlib -no-reflect -nowarn -jvm-target 17 -cp "$L/kotlin-stdlib-2.0.21.jar:$L/junit-4.13.2.jar:$L/hamcrest-core-1.3.jar" -d "$OUT" "$H/../app/src/main/java/com/a2z/ai/CloudCore.kt" "$H/jvm-harness/it/CloudCoreTest.kt" 2>&1 | grep -v "^warning" || true
java -cp "$OUT:$L/kotlin-stdlib-2.0.21.jar:$L/junit-4.13.2.jar:$L/hamcrest-core-1.3.jar" org.junit.runner.JUnitCore com.a2z.ai.CloudCoreTest

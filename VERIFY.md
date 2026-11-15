# Verify your Zyn Ai download

Each release shows: package name `com.a2z.ai`, the **APK SHA-256**, and the **signing certificate SHA-256**. A `.sha256` file is attached to every release.

## 1. Check the file hash
- Android: any hash-checker app (choose SHA-256) on the downloaded APK.
- Linux / macOS: `sha256sum Zyn-Ai-vX.apk` (macOS: `shasum -a 256 Zyn-Ai-vX.apk`)
- Windows: `certutil -hashfile Zyn-Ai-vX.apk SHA256`

The result must equal the APK SHA-256 in the release notes. If not, delete the file.

## 2. Check the signing certificate (optional, needs Android build-tools)
`apksigner verify --print-certs Zyn-Ai-vX.apk`
The line "certificate SHA-256 digest" must equal the signing certificate SHA-256 in the release notes. It is the same on every genuine release. A different value means it is not an official build.

## 3. Check where it was built (public repositories)
`gh attestation verify Zyn-Ai-vX.apk --repo ahamedsajath460-svg/Zyn`
This confirms GitHub Actions built the file from this repository.

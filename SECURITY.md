# Security policy

## Reporting a vulnerability
Please do not open a public issue. Use this repository's **Security > Report a vulnerability** (private advisory) or email ahamedsajath160@gmail.com. Include the Zyn Ai version, Android version and steps to reproduce.

## Supported versions
Only the latest release on the Releases page receives fixes.

## Install only from this repository
Genuine releases: package `com.a2z.ai`, signed with the certificate whose SHA-256 is printed in each release's notes. See VERIFY.md. Zyn Ai does not ask you to disable Google Play Protect.

## Known limitation: built-in API keys
To work right after install, the APK can include shared API keys supplied at build time. Anyone can extract strings from an APK, so treat those keys as public: they are limited, free-tier or spend-capped keys that can be rotated at any time. Keys you add yourself stay on your device.

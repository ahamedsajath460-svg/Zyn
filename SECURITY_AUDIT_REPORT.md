# Zyn Ai – Security audit and distribution report

Date: 2026-11-16  ·  Package: `com.a2z.ai`  ·  Reviewed: Zyn-Ai.zip (a2z-android), release-apk.yml, Play Protect screenshot

**Method and limits.** Static review of the manifest, Gradle files, workflow, Kotlin sources and the WebView app. I could not compile or run the project here (no network for Gradle), so every code change below is **unbuilt and untested**: the first GitHub Actions run is the real test. I could not scan dependencies against a vulnerability database offline. Nothing here is a Google approval, and none of it can promise that Play Protect warnings disappear.

## 1. Why Play Protect blocks the app
Dialog: "App blocked to protect your device. Play Protect hasn't seen an app from this developer before."
- **Unknown developer / new key:** expected for a new signing identity. Improves with developer verification, stable key, install history.
- **Sensitive-permission block:** Google documents automatic blocking of internet-sideloaded apps that declare `BIND_ACCESSIBILITY_SERVICE` (in select markets). Zyn Ai declares it, so this is the most likely cause of the *block* (as opposed to a mere scan prompt).
- Overlay + screen capture + accessibility together look like patterns used by banking malware, which raises scrutiny.
- The manifest does **not** set `isAccessibilityTool`, which is correct for an automation agent. Do not add it.

Because Agent Control must stay, the realistic route is: clean permissions and disclosures, verified developer identity, stable signing key, then a Play Protect appeal (see DEVELOPER_VERIFICATION_AND_APPEAL.md). Outcome is Google's decision.

## 2. Your 15 requirements

| # | Requirement | Status |
|---|---|---|
| 1 | Audit manifest and permissions | Done. All 17 permissions map to a feature; each is now commented in the manifest and documented in PERMISSIONS.md |
| 2 | Accessibility transparent and consent-based | Improved. Native "I agree / No thanks" disclosure before Accessibility settings open (replaces a short JS confirm). Service description corrected: the old text said every action needs approval, but Full Auto skips approval for normal actions |
| 3 | MediaProjection, overlay, background services | Reviewed. System consent for capture, persistent Pause/Stop notification, overlay only after user enables it, keep-alive stops itself after 30 minutes. No change needed |
| 4 | Remove unnecessary permissions | Nothing safely removable without a device test. Only candidate: `MODIFY_AUDIO_SETTINGS` (no direct use in code; kept because WebView voice capture may rely on it). Test removal on a real phone before dropping it |
| 5 | Audit libraries | Manual only: androidx core/appcompat/webkit, play-services-tasks/auth, ML Kit text recognition (Latin, Devanagari). Run Dependabot / OSV-Scanner and update; check newer versions of play-services-auth and ML Kit |
| 6 | Signing and certificate consistency | Done in workflow: fails if debug-signed; reads the certificate SHA-256; fails if it differs from repo variable `EXPECTED_CERT_SHA256` (you must set it once) |
| 7 | Consistent package/identity | Done in workflow: fails if package is not `com.a2z.ai`. versionCode = run number; versionName now `1.0.<run>` to match the release tag |
| 8 | Signed release APKs | Already signed in CI from your 4 secrets; kept, with stronger checks |
| 9 | SHA-256 checksums | Done: `Zyn-Ai-vX.apk.sha256` attached to every release, hash and certificate shown in release notes, provenance attestation added |
| 10 | Keys, network, data protection | See findings H1, H2, M1, M2. Cleartext already off; added network security config |
| 11 | Developer verification / ownership docs | DEVELOPER_VERIFICATION_AND_APPEAL.md |
| 12 | Target SDK | See M4: targetSdk 34 is fine for now but ageing. Not changed without a build |
| 13 | Privacy policy and permission disclosure | PRIVACY_POLICY.md, PERMISSIONS.md (fill the bracketed fields) |
| 14 | Classification risks | Section 1 above |
| 15 | Review / appeal readiness | Appeal pack with draft text and evidence list |

## 3. Findings

**H1 – Built-in API keys are inside the APK (not changed).** `default-keys.json` is created at build time from the `AI_API` secret and packed into the APK. Hiding them in the UI does not stop anyone who unzips the APK. Impact: key theft, quota abuse, and your accounts blamed for misuse. You asked to keep "works without a key", so I did not remove it. Options: (a) interim: only free-tier or spend-capped keys, rotate often, never a paid unrestricted key; (b) proper fix: put the keys behind a small server (Firebase Cloud Function or Cloudflare Worker) that checks the signed-in user and rate-limits, and have the app call that.

**H2 – JavaScript bridge reachable from every frame (not changed).** `A2ZNative` is added with `addJavascriptInterface`, which Android injects into all frames of the page, including iframes. The Code Writer preview runs AI-generated code in sandboxed iframes (sandbox without `allow-same-origin`). A sandbox limits the iframe's origin but, as far as I know, does not hide an injected interface. If generated or pasted code can reach `A2ZNative`, it could call bridge methods such as Agent start or file save. Please test this on a device. Proper fix: move to `WebViewCompat.addWebMessageListener` restricted to `https://appassets.androidplatform.net`, or at minimum make the preview use a separate WebView without the bridge. This is a larger change; I did not attempt it unbuilt.

**M1 – Third-party relay services.** allorigins.win, corsproxy.io, codetabs and r.jina.ai can see which addresses are fetched. Now disclosed in the privacy policy. Better: your own relay.

**M2 – User-added API keys sit in WebView local storage in plain text.** App-private and backups are off, so risk is low on a non-rooted phone. Later: encrypt with Android Keystore.

**M3 – `MODIFY_AUDIO_SETTINGS`** see requirement 4.

**M4 – Target SDK 34.** Google Play Protect warns when targetSdk is more than two API levels below the phone's Android version, so newer phones will eventually show a "built for an older version of Android" notice. Moving to 35/36 needs: newer Android Gradle Plugin and Gradle (AGP 8.5.2 / Gradle 8.7 are old for API 35+), edge-to-edge layout checks in the WebView UI, foreground-service type rules (mediaProjection, dataSync timeouts), overlay/foreground-service start rules, and 16 KB page-size support for ML Kit native libraries. Do this as its own tested step.

**M5 – Small manifest notes.** `MainActivity` is `exported=true` without an intent filter (the launcher aliases point at it). Left as is; changing it without a device test could break the launcher icons. The `<queries>` launcher entry is broad; it is needed for "open an app" and is disclosed.

**L1 – Workflow supply chain.** The workflow builds the newest `.zip` in the repo and publishes on every push. Turn on 2-factor sign-in, protect `main`, and consider pinning actions to commit SHAs (Dependabot config added for Actions).

**L2 – Firebase web key and owner email** are in client files. The Firebase web key is a public identifier: restrict it (HTTP referrer `https://appassets.androidplatform.net/*`) and keep your Firestore rules from ADMIN_PANEL_SETUP.md.

**Good already:** cleartext traffic off; backup off; WebView file access off; assets served over `https://appassets.androidplatform.net`; internal services non-exported; FileProvider non-exported; web permission requests mediated through Android; Agent never touches password fields, installer or permission screens; optional secure-screen mode; Accessibility config requests only what it uses (window content, gestures, one event type).

## 4. Files changed in the project
- `AndroidManifest.xml`: network security config attribute; permission rationale comments
- `res/xml/network_security_config.xml` (new): HTTPS only, system CAs only
- `AccessibilityDisclosure.kt` (new); `MainActivity.kt` and `FloatingPanelController.kt`: show the disclosure before Accessibility settings (floating panel sends you to the app until you have agreed)
- `MainActivity.kt`: external links limited to http, https, mailto, tel
- `strings.xml`: accurate Accessibility description
- `a2z.html`: two old JS confirms removed (native disclosure replaces them)
- `app/build.gradle.kts`: versionName `1.0.<run>`
- Workflow: certificate check, package check, permission list in run summary, SHA-256 file, release notes with hashes, provenance attestation
- Docs added under `docs/`

## 5. Do these next
1. Upload the new workflow and project zip; run the build; open the run summary and copy the **certificate SHA-256**.
2. Add repository variable `EXPECTED_CERT_SHA256` with that value.
3. Fill `Sajath Ahamed`, `ahamedsajath160@gmail.com`, `https://github.com/ahamedsajath460-svg/Zyn` in the docs; put them at the repository root; use the PRIVACY_POLICY.md link in the login screen text.
4. Register `com.a2z.ai` + certificate in the Android Developer Console.
5. Test on a real phone: Accessibility disclosure, floating-panel Accessibility button, links, voice chat.
6. Submit the Play Protect appeal with the draft text.
7. Plan H1 (key proxy) and H2 (bridge restriction).

# Zyn Ai – Developer verification, package ownership and Play Protect appeal

Last updated: 2026-11-16. Google's programs change often: check the linked pages before you act. Nothing here guarantees that a warning will disappear. Only Google can change how Play Protect treats the app.

## 1. What the warning on your phone means
The dialog says **"App blocked to protect your device – Play Protect hasn't seen an app from this developer before."** Two separate Play Protect behaviours can be involved (source: Google, "Developer Guidance for Google Play Protect Warnings"):

1. **Unknown developer / app not seen before.** New signing key, new package, little install history.
2. **Sensitive-permission block.** In select markets Play Protect automatically blocks apps installed from browsers, messaging apps or file managers if they declare high-risk permissions. `BIND_ACCESSIBILITY_SERVICE` is on that list. Zyn Ai declares it for Agent Control, so this is the most likely reason for the hard block.

Because you want to keep Agent Control, the Accessibility declaration stays. That means code changes alone cannot remove the block. What you can do is make the app and the developer identity as clearly legitimate as possible, then ask Google to review.

Do not tell users to turn Play Protect off. Zyn Ai does not try to bypass it.

## 2. Developer verification (Android Developer Console)
Per Google's published timeline: registration opened to all developers in March 2026; from **30 September 2026** apps must be registered by a verified developer to be installed on certified devices in **Brazil, Indonesia, Singapore and Thailand**; global rollout is planned for 2027 and later. Unregistered apps can still be installed with adb or Google's "advanced flow". Limited-distribution accounts for students and hobbyists exist. Check https://developer.android.com/developer-verification for the current rules for Sri Lanka and your users' countries.

Do this once:
1. Create an account in the **Android Developer Console** (for apps distributed outside Google Play) with the Google account you want tied to Zyn Ai. Choose the account type that fits you (individual / limited distribution / organisation) and complete the identity check it asks for.
2. **Register the app:** package name `com.a2z.ai` and the **signing certificate SHA-256** printed in your release notes (workflow step "Check release certificate fingerprint").
3. Complete the **proof of ownership** step the console shows for the package and key.
4. Re-check the registration status after each release.

Package ownership rules to keep:
- Never change the package name `com.a2z.ai`. The workflow now fails if it changes.
- Never change the release keystore. Back up `KEYSTORE_BASE64`, the passwords and the alias in at least two safe places. Losing the key means a new identity, a new Play Protect reputation, and users cannot update in place.
- Set the repository variable `EXPECTED_CERT_SHA256` (Settings > Secrets and variables > Actions > Variables) so any accidental key change stops the build.

## 3. Make the public evidence easy to check
- Public GitHub repository with source (or at least the manifest), this file, PRIVACY_POLICY.md, PERMISSIONS.md, SECURITY.md, VERIFY.md.
- Release notes list package name, APK SHA-256 and certificate SHA-256 (the workflow writes these).
- Build provenance attestation is attached (public repositories).
- Use the same developer name on GitHub, in the privacy policy and in the console.
- Upload each release APK to https://www.virustotal.com and keep the report link. A clean report is helpful evidence, not proof.

## 4. Ask Google to review (appeal)
Form: https://support.google.com/googleplay/android-developer/contact/protectappeals ("File a Play Protect appeal"). In the past the form has asked for a contact email, the app's package name, a link to the APK (or its SHA-256 / a VirusTotal result) and an explanation; fields can change. If the APK link is rejected, use a plain public GitHub release link.

Draft explanation (edit the brackets):

> Zyn Ai (package com.a2z.ai) is an AI assistant app distributed as a signed APK from GitHub Releases: https://github.com/ahamedsajath460-svg/Zyn. It is blocked by Play Protect with "App blocked to protect your device" on install. I believe this is a misclassification and ask for review.
>
> The app declares an AccessibilityService for a user-initiated "Agent Control" feature. The service does nothing until the user taps I agree on a full-screen disclosure, enables the service in Android settings and starts a task. A status bar with a Stop button is always visible while it runs. It never reads or fills password fields, does not interact with the lock screen, the package installer or permission dialogs, does not log keystrokes and does not run in the background on its own. Per-action approval is the default; Full Auto is opt-in and still asks for payments, passwords and irreversible account actions. The app does not declare isAccessibilityTool.
>
> Other permissions (overlay, screen capture, camera, microphone, location, calendar) are each tied to a visible feature and listed in PERMISSIONS.md. It does not request SMS, notification-listener or install-packages access. Traffic is HTTPS only and Android backup is disabled. The privacy policy is at https://github.com/ahamedsajath460-svg/Zyn/blob/main/PRIVACY_POLICY.md.
>
> Developer: Sajath Ahamed, contact ahamedsajath160@gmail.com. Release signing certificate SHA-256: [CERT SHA-256]. APK SHA-256: [APK SHA-256]. VirusTotal report: [LINK]. The same signing key is used for every release.

Expect no reply email; test the newest release on a phone afterwards. Appeal again only if something material changes.

## 5. The "scan this app" prompt is different
The prompt "Play Protect hasn't seen this app before … send some info about the app to Google for scanning" is answered by the *user* choosing Scan / Send. Google says appeals do not remove that prompt.

## 6. Say only what is true
- Do not write "Google approved" or "Play Protect certified" anywhere.
- Do not promise users the warning will not appear. Say: "Zyn Ai is installed outside Google Play, so Android or Play Protect may show a warning. Here is how to verify the file you downloaded."
- Do not hide permissions or the Accessibility feature in release notes or screenshots.

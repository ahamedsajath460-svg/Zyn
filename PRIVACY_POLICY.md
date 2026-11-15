# Zyn Ai – Privacy Policy

Last updated: 2026-11-16  ·  App package: `com.a2z.ai`
Developer: Sajath Ahamed  ·  Contact: ahamedsajath160@gmail.com  ·  Source: https://github.com/ahamedsajath460-svg/Zyn


## 1. What Zyn Ai is
Zyn Ai is an Android AI assistant: chat, voice, vision, screen sharing, a floating assistant and an Agent that can operate your phone for tasks you start. It is distributed as a signed APK through GitHub Releases, not Google Play.

## 2. Data we collect

**Account data.** When you sign in with Google (through Firebase Authentication) we receive your name, email address and profile photo. We store a record in Google Firebase Firestore (`users/{uid}`): name, email, photo, first-seen date, last-open date and number of opens. The app owner can see this list. We use it to know who uses the app and to run the service.

**Data that stays on your device.** Chats, settings, themes, API keys you add yourself and cached content are stored in the app's private storage on your phone. Zyn Ai does not upload your chat history to its own servers. Android backup is turned off for the app. Removing the app or clearing its data deletes this data.

**Data sent to AI and tool providers when you use a feature.** Your message text, files or images you attach, camera photos, screen-share frames or OCR text, the visible screen text of an Agent task, and your approximate or precise location (only if you allow it and ask a location question) may be sent to the provider that answers your request.

**Sensors, only on your request.** Microphone (voice chat, dictation), camera, location, calendar events (read/add), and screen capture are used only while the matching feature is in use and only after you grant permission. Screen-capture frames and OCR text are kept in memory and wiped when sharing stops.

**Accessibility service.** If you turn it on, Zyn Ai reads the text and layout of the visible screen while an Agent task runs. Password fields are never read or filled. This data is used only to carry out your task and is not sold.

## 3. Who receives data (third parties)
Depending on the features you use and the providers configured:
- **Google (Firebase Authentication, Firestore, Google Sign-In, Google Gemini, YouTube Data API, ML Kit on-device OCR, Google Fonts).** ML Kit text recognition runs on your device.
- **AI providers:** Pollinations, OpenRouter, Groq, Google Gemini and any provider for which *you* add your own key (for example OpenAI, xAI, NVIDIA, Together, Mistral, DeepSeek).
- **Search and information services:** Tavily, DuckDuckGo, Wikipedia, OpenStreetMap Nominatim, Open-Meteo, CoinGecko, REST Countries and similar public APIs.
- **File-link tools (only when you use them):** imgbb, catbox.moe and is.gd receive the file or link you ask Zyn Ai to convert.
- **Relay services:** some web-page reads may pass through public relay services (such as allorigins.win, corsproxy.io, codetabs, r.jina.ai) so that a page can be fetched. These services can see the address being fetched.

Each provider has its own privacy policy. Do not enter or show information you do not want them to receive.

**Built-in keys.** The app can use shared API keys supplied by the developer so it works without setup. These keys belong to the developer; your requests made through them go to the provider named above. Keys you add yourself are used only for requests you make and are stored on your device.

We do not sell your personal data and we do not use it for advertising.

## 4. Retention and deletion
Device data: deleted when you clear app data or uninstall. Account record in Firestore: kept while you use the app; email ahamedsajath160@gmail.com from the account's address to have it deleted. Provider-side retention is controlled by each provider.

## 5. Security
HTTPS only (cleartext traffic disabled); Android backup disabled; WebView file access disabled; password fields are never read or filled by the Agent; releases are signed with one fixed key and published with SHA-256 checksums. No system is perfectly secure. Note: built-in API keys are packaged inside the APK; see SECURITY.md.

## 6. Your choices
Deny or revoke any permission in Android Settings at any time; switch off the Accessibility service, overlay, notifications; use Read-only agent mode; sign out; clear app data; ask for deletion of your account record.

## 7. Children
Zyn Ai is not directed to children. [Confirm the minimum age you want to state, for example 13 or 16, and keep it consistent with your login screen.]

## 8. Changes
We will update this page and its date when this policy changes.

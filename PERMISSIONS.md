# Zyn Ai – Permission disclosure

Package name: `com.a2z.ai`  ·  Last updated: 2026-11-16

Every permission below is used by a feature you can see in the app. Runtime permissions (camera, microphone, location, calendar, notifications) are asked only when you use the feature that needs them. If you say no, that feature does not work and the rest of the app keeps working.

## Normal permissions (granted at install)

| Permission | Why Zyn Ai needs it |
|---|---|
| INTERNET | Send your messages to the AI provider, run web search, Google sign-in |
| ACCESS_NETWORK_STATE | Know if you are offline or on mobile data (Data saver, offline messages) |
| FOREGROUND_SERVICE (+ MEDIA_PROJECTION, SPECIAL_USE, DATA_SYNC types) | Run Screen Share, the floating assistant and long-running tools with a visible notification |
| WAKE_LOCK | Keep a running tool alive when you switch apps. Stops itself after 30 minutes |
| MODIFY_AUDIO_SETTINGS | Audio routing for voice chat |

## Permissions you grant when you use the feature

| Permission | Feature | When asked |
|---|---|---|
| RECORD_AUDIO | Voice chat, dictation | When you tap the microphone |
| CAMERA | Take a photo or use Vision in chat | When you use the camera |
| ACCESS_FINE / COARSE_LOCATION | Location-aware answers | When an answer needs your location |
| READ_CALENDAR / WRITE_CALENDAR | Calendar tool (read and add events) | When you use the calendar tool |
| POST_NOTIFICATIONS | Screen-share, running-tool and reminder notifications | When a feature needs a notification |

## Special access you turn on yourself

| Access | Feature | What it does | What it does not do |
|---|---|---|---|
| **Accessibility service** ("Zyn Ai Agent") | **Agent Control** | Reads the text and layout of the screen while an Agent task you started is running; taps, swipes, scrolls, types and navigates for you | No background watching, no keystroke logging, never reads or fills password fields, does not touch the lock screen, the app installer or Android permission dialogs. A status bar with a Stop button is visible while it runs |
| **Display over other apps** (SYSTEM_ALERT_WINDOW) | Floating bubble and panel, Agent status bar and Stop button, highlights, touch indicator, screen pencil | Draws Zyn Ai's own controls on top of other apps | Does not read what is under it |
| **Screen capture** (Android MediaProjection) | Screen Share and Vision | Captures the screen only after Android's own consent dialog; a notification with Pause and Stop stays visible | Frames and on-device OCR text are kept in memory and wiped when sharing stops |

Before the Accessibility settings open, Zyn Ai shows a full explanation with **I agree / No thanks**. You can switch the service off at any time in Android Settings > Accessibility > Zyn Ai Agent.

**Approval modes.** By default every Agent action asks for your approval. If you choose **Full Auto**, normal taps and typing run without asking, but payments, passwords and irreversible account actions still ask. Read-only mode never performs actions.

**Data leaving your phone.** To decide the next step, the visible screen text of an Agent task, a screen-share frame or your chat text may be sent to the AI provider that answers it. See PRIVACY_POLICY.md.

## Package visibility
The manifest contains a `<queries>` entry for launcher apps so the Agent can open an app you ask for. Zyn Ai does not collect or upload the list of installed apps.

## What Zyn Ai does NOT request
SMS, call log, contacts, notification-listener access, install-packages permission, all-files storage, `QUERY_ALL_PACKAGES`, device-admin, or `isAccessibilityTool` (Zyn Ai is an automation agent, not an assistive-technology tool, so it does not claim to be one).

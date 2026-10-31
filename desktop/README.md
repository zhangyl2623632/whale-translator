# Whale Desktop spike / 鲸译桌面版 spike

A Windows-only proof of concept for the all-app selection translator. It is **not** the final desktop product and is not part of the Edge Add-ons package.

Windows-only 全应用划词翻译的 **技术 spike**，不是最终桌面产品，也不包含在 Edge 加载项包里。

## What it does

- Runs in the notification area; no main window.
- Installs a low-level mouse hook.
- After a mouse drag (not a click), reads the selection with UI Automation.
- If UI Automation has no selection, falls back to clipboard copy/restore.
- Supports a global hotkey for keyboard selections: **Ctrl+Alt+W** (falls back to Ctrl+Alt+T / Ctrl+Shift+Alt+T if taken).
- Shows a small topmost toolbar near the cursor.
- Click **翻译** to call Microsoft's Edge translator endpoint and show the result in a card.
- Copy the translation; close with the X or the tray menu.

## What it deliberately does not do

- No code signing, auto-update, or settings UI.
- No target-language picker; it auto-detects Chinese/English and uses the opposite language.
- No macOS version.
- No Chromium/Electron host integration; it is a standalone WinForms process.
- No guarantee for elevated apps or apps that block UI Automation/clipboard.

## Build

Requirements: Windows with .NET Framework 4.8 (built into Windows 10/11) and the built-in C# compiler. No .NET SDK install is required.

```powershell
powershell -ExecutionPolicy Bypass -File .\desktop\build.ps1
```

Output:

```text
desktop\bin\WhaleDesktop.exe
```

## Install (per-user)

```powershell
powershell -ExecutionPolicy Bypass -File .\desktop\install.ps1
```

This copies the app to `%LOCALAPPDATA%\WhaleDesktop` and creates Start Menu and Desktop shortcuts. It does not require admin rights and does not add a startup entry.

Uninstall:

```powershell
powershell -ExecutionPolicy Bypass -File .\desktop\uninstall.ps1
```

## Run

1. Start from the **Whale Translator** shortcut, or run `WhaleDesktop.exe`.
2. A whale tray icon appears. There is no main window.
3. In Word, WeChat, Notepad, or a browser, **drag-select** text with the mouse and release.
4. A dark toolbar appears above/below the cursor.
5. Click **翻译**. The card shows the translation; **复制译文** copies it.
6. Keyboard selection: select with Shift+arrows/Ctrl+A, then press **Ctrl+Alt+W**.
7. Exit from the tray icon menu; the menu also has “翻译当前选区”.

## Test checklist

- [ ] Notepad: drag-select one English line → toolbar → translation
- [ ] Word: drag-select a paragraph → translation preserves reasonable line breaks
- [ ] WeChat: drag-select a message → toolbar appears (clipboard fallback if UIA is unavailable)
- [ ] Edge/Chrome: drag-select page text
- [ ] Keyboard: select with Shift+arrows → Ctrl+Alt+W → toolbar
- [ ] Copy result
- [ ] Click outside closes the toolbar
- [ ] Tray → 退出 stops the hook

## Debug

Log file:

```text
%TEMP%\whale-desktop.log
```

Boot marker:

```text
%TEMP%\whale-desktop-boot.txt
```

## Known limitations in this spike

- **Mouse drag is automatic; keyboard selection needs Ctrl+Alt+W.** If that hotkey is taken, the app tries Ctrl+Alt+T and Ctrl+Shift+Alt+T; the tray menu always works.
- **Clipboard fallback may replace the clipboard.** It restores the previous text when possible; non-text clipboard contents cannot be restored.
- **Clipboard fallback sends Ctrl+C** after a drag or hotkey; apps that use Ctrl+C for something else may react unexpectedly.
- **UIA support varies by app.** Word/Notepad/Chromium usually expose TextPattern; WeChat may only work through the clipboard path.
- **Topmost/no-activate overlay** may behave differently under some apps; if the toolbar steals focus, the selection can collapse.
- **Translation is Bing-only** in this spike and shares the same network dependency as the extension.
- **No authentication** is involved; the selected text is sent only after **翻译** is clicked.
- **No persistence**: no history and no settings.

## Next step after the spike

If Word/WeChat selection and the overlay pass:

1. Add a target-language picker and a configurable hotkey.
2. Add code signing and auto-update.
3. Consider a native WinUI/Windows App SDK host for a more modern UI.
4. Keep the privacy rule: send text only after an explicit translate action.

# Edge Add-ons submission kit / Edge 加载项上架材料

This folder contains everything needed for the **Microsoft Edge Add-ons** submission. The extension is ready to package; the remaining steps require the publisher's Microsoft account and Partner Center identity.

这个目录是 **Microsoft Edge 加载项**上架材料。扩展代码和素材已经准备好；最后几步必须由发布者本人的 Microsoft 账号和 Partner Center 身份完成。

- Publisher: individual (no company required)
- Registration fee: **none** for the Microsoft Edge program
- Recommended visibility: **Hidden** (share the listing URL with friends; no public search)
- Current version: `1.0.0`
- Certification time: Microsoft says up to **7 business days**
- Official guide: [Publish a Microsoft Edge extension](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)
- Developer registration: [Register as a Microsoft Edge extension developer](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account)

## What is ready

| Item | File |
|---|---|
| Store ZIP | Build with `build-package.ps1`; output in `dist/` |
| Listing copy (zh-CN) | `listing.zh-CN.md` |
| Privacy policy source | `../PRIVACY.md` |
| Rendered privacy policy | `../docs/privacy.html` (GitHub Pages) |
| Review notes | `review-notes.md` |
| Permission rationale | `permissions.md` |
| Logo 300×300 | `assets/logo-300x300.png` |
| Screenshots 1280×800 | `assets/screenshot-1-1280x800.png`, `assets/screenshot-2-1280x800.png` |
| Small promo tile 440×280 | `assets/promo-440x280.png` |
| Large promo tile 1400×560 | `assets/promo-1400x560.png` |

Build the package:

```powershell
powershell -ExecutionPolicy Bypass -File .\store\build-package.ps1
```
Output:

```text
store/dist/whale-translator-1.0.0.zip
```

## What you must do

These steps need your own Microsoft account; they cannot be delegated to the assistant.

1. **Create/sign in to a Microsoft account.**
2. Open [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/public/login?ref=dd), choose **Edge**, and register for the Microsoft Edge program as an **Individual**.
   - No company name, tax ID, or team is required.
   - Complete the contact/identity fields the dashboard asks for.
3. **Create a new extension**, upload `store/dist/whale-translator-1.0.0.zip`.
4. Fill **Availability**:
   - Visibility: **Hidden** recommended if this is only for you and friends. The extension is not searchable; share its listing URL.
   - Choose **Public** only if you want it discoverable by everyone.
   - Markets: all markets (or China only, if you prefer).
5. Fill **Properties**:
   - Category: **Productivity**
   - Website: `https://github.com/zhangyl2623632/whale-translator`
   - Support contact: `https://github.com/zhangyl2623632/whale-translator/issues`
   - Mature content: **No**
6. Fill **Privacy** using `permissions.md` and the values in `listing.zh-CN.md`:
   - Single purpose
   - Permission justifications
   - Remote code: **No**
   - Data usage: selected text / user content is transmitted to Bing **only after the user clicks Translate**
   - Privacy policy URL: `https://zhangyl2623632.github.io/whale-translator/privacy.html`
7. Fill **Store listings → 中文（简体）**:
   - Copy the description from `listing.zh-CN.md`.
   - Upload the logo, both screenshots, and the two promo tiles.
   - Extension name and short description come from `manifest.json`; they are read-only in Partner Center.
8. Fill **Notes for certification** with `review-notes.md`.
9. Click **Publish**. Certification can take up to 7 business days.
10. After approval, copy the store listing URL and send it back so the README and release notes can link to it.

## Data usage disclosure

Be precise in Partner Center. The extension:

- Transmits the **selected text** and the requested source/target language to `https://edge.microsoft.com` **only when the user clicks Translate**.
- Does **not** collect browsing history, page URLs, account identifiers, analytics, or advertising IDs.
- Does **not** keep a translation history and does **not** write translations to disk.
- Uses the clipboard only when the user clicks copy.
- Does **not** use remote code.

Select the data category that matches **“text or other user content”** and do not select categories the extension does not collect. The privacy policy must match these answers.

## After approval

- Send me the listing URL; I will add it to the README and a release note.
- For updates, increment `manifest.json` `version`, rebuild the ZIP, and upload a new package.
- Keep the extension name and short description stable unless you intentionally want to re-list.

## Notes

- **A `.crx` is not the store package.** Edge Add-ons accepts a ZIP; Microsoft signs and hosts the store build.
- A **Hidden** listing still needs review and a privacy policy.
- **Developer mode is not required** for users who install from the store.
- The store listing is public metadata even when the extension is Hidden; do not put private contact details in the description.
- Chrome Web Store is a separate program with its own registration requirements. This kit targets Edge first.

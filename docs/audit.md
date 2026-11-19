# Utextility 2.1 · Implementation and audit

**19 November 2026 · Local release · Letterpress proof room**

The editor is ready for a first-use pilot. Someone with text to clean can paste it, read the result alongside the original, and copy it immediately. Each of the four common tasks has a plain-language button. Someone who does the same job every week can combine tools and save the steps. The local release passed 47 transformation and storage tests and 150 browser test runs. Whether first-time users understand every control and return the following week still needs observation.

[Open the editor](../index.html) · [How to run it](../README.md) · [Original codebase audit and revamp plan](revamp.html)

## What a person can do

| Job | What to try | Acceptance check |
| --- | --- | --- |
| Clean a pasted paragraph | Paste two wrapped paragraphs with extra spaces. Open **Changes** after cleanup. | Paragraph breaks survive. Marked bullets, headings, quotations, table rows and fenced code keep their boundaries. Removed spaces and line breaks are visible. |
| Combine two lists | Paste `Ink`, `Paper`, `ink` and `Paper` on separate lines. Choose **Tidy a list**. | The exact-match default yields three lines. Turn on the capitalization option and the result becomes `Ink` then `Paper`, in the original order. |
| Prepare page links | Enter `Café Notes` and `Café-Notes` on separate lines, then choose **Make link names**. | Both lines read `café-notes`. A notice identifies the two result lines so the author can decide which heading to edit. |
| Update repeated wording | Choose **Find and replace**, enter `draft` and `report`, then inspect the match count. | Every exact occurrence changes. A blank replacement removes the match. The original stays available throughout. |
| Meet an editor’s limit | Select **Your text** or **Result** under **Text counts**, then set a limit. | The count and budget refer to the same version. The app reports the amount remaining, the exact limit or the excess. |
| Reuse Friday’s edits | Add or reorder steps, name the sequence and reopen it from **Saved steps**. | The sequence survives a reload. A portable steps file previews its name, operations and configured replacement words before saving. **Use** applies it to the current text. |

The library contains 25 operations. **More tools** opens with four common choices, a search field and folded categories. **Use** applies a single tool. Opening **Edit current steps** changes the action to **Add**. Code-specific terms remain searchable for people who already know them. [Tool definitions](../engine.js)

## Design and interaction

The print-room identity comes from the serif result, cream paper, pine masthead, rust-colored copy button and registration marks. The editor uses **Your text**, **Result**, **Changes** and **Copy result**. A first-time visitor can type immediately. **Try an example** is a deliberate action and **Undo** can recover the text it replaced.

The wide layout gives the original and result equal width. On a phone they stack in reading order, and **View result** moves both focus and the viewport to the output. At 320 CSS pixels long tool names wrap, secondary controls move to another line, and the text areas keep their width. In short landscape windows the tool dialog scrolls with its close control at the top. The change legend uses the same strikethrough and underline as the edited text, leaving the copy button in a consistent position. [Desktop](audit/desktop.png) · [Phone](audit/phone.png) · [Dark-mode changes](audit/dark-changes.png)

| Design check | Result |
| --- | --- |
| Responsive layouts | At widths of 320, 390, 667, 768, 1024 and 1440 CSS pixels the main editor, step editor and saved-step transfer controls passed the horizontal overflow checks. The editor and step dialog also passed with doubled root text at 960 pixels. |
| Keyboard and touch | First Tab reaches the skip link. Enter focuses the editor. The library opens with search focused. Escape returns focus to the opener. At 390 pixels the checked primary controls have a touch area of at least 44 × 44 CSS pixels. Section links move immediately. |
| Color and change marks | Main text against the page measured 11.10∶1 in light mode and 13.02∶1 in dark mode. Copy-button text measured 6.09∶1 and 6.85∶1. Changed text also has an underline or strikethrough, visible whitespace and a label for assistive technology. |
| Automated accessibility | axe-core 4.14.1 reported zero violations under the selected WCAG A/AA and best-practice rules. The ten states covered the blank editor, changes, list options, replacement fields, limit form, dark editor, tool library, step editor, naming and saved-step transfer. Each state ran twice in each engine. |

The reflow and touch checks use CSS pixels. Visual inspection also covered a 320-pixel tool library and a 667 × 375 saved-step dialog. Keyboard checks and automated scans give concrete coverage. A screen-reader walkthrough remains part of the release pilot. [W3C on reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) · [W3C on target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) · [Playwright on accessibility testing](https://playwright.dev/docs/accessibility-testing)

## Findings resolved during implementation

| Priority | Finding | Resolution and verification |
| --- | --- | --- |
| High | Joining lines and trimming spaces could damage indentation in a fenced code sample. | The three prose-cleanup steps preserve fenced blocks. Fixtures cover backtick and tilde fences, inner blank lines and surrounding prose. |
| High | A slow file read or earlier background computation could finish after a new edit. | File loads check the source revision. Results carry an edit number and copying is disabled while waiting. Delayed-completion browser tests confirmed the latest edit wins. |
| High | Concurrent saves, storage denial or damaged records could cost someone a reusable sequence. | Named records have separate keys. Supported browsers serialize writes across tabs. Tests cover migration, interruption, damaged data, simultaneous saves and recovery. A declined save leaves the editor usable. |
| Medium | An example already in the editor and print terminology made the first action ambiguous. | The editor opens blank. The sample is optional. Plain-language controls expose four tasks immediately. The first-keystroke, example, original-text and undo paths passed in all engines. |
| Medium | WebKit could skip the keyboard entry link. Firefox could surface a page error on rejected saves, including duplicate names. | The link has an explicit position in the natural tab order. Storage errors are handled inside the lock callback and presented in the dialog. Both regressions have browser coverage. |
| Medium | A limit control’s accessible name included the list of choices. A long change explanation also moved the copy button at some widths. | The count selector has its own label. A compact change legend keeps the action aligned. Role-based checks, the dark-mode screenshot and the accessibility scans cover these changes. |

Plain text can have intentional line breaks with no markup, as in an address or a poem. **Clean up text** treats adjacent unmarked lines as wrapped prose. The original and **Changes** make that judgment visible. **Edit steps → Remove Join wrapped lines** preserves those breaks while cleaning spacing. This is a useful case for the pilot.

## Functionality, privacy and recovery

- **Files and clipboard**. UTF-8 imports handled a byte-order mark, Windows line endings, accents and Hindi text. The download bytes matched the expected result. Invalid encoding, binary content and oversized files left the existing text available. Controlled clipboard tests covered a successful write and a denied write that selects the result for manual copying. OS clipboard prompts are a device check.
- **What gets stored**. The editor keeps drafts, results and limits in tab memory. Choosing an appearance or saving steps writes to local browser storage. Saved field values and exported settings include literal find-and-replace words. The save dialog explains this. Tests inspected storage, cookies and exported bytes, refreshed a private draft, and confirmed that pasted HTML markup rendered as ordinary text.
- **Local operation**. HTTP editing used the local origin for app assets. Request observation recorded zero external requests. All three engines opened and edited the app directly from the folder. A separate Chromium check with networking disabled loaded the three local fonts and correctly displayed cleaned Arabic text right-to-left.
- **Large inputs**. The input ceiling is 100,000 UTF-16 units. The displayed character count uses grapheme clusters where supported. Edits of 4,000 units or more normally use a worker over HTTP. The same engine handled blocked worker creation and loading. Above the detailed comparison limit, the full result remains available to read, copy and download. [Operating limits](../README.md#operating-limits)
- **Project isolation**. All 75 files under the legacy project, including repository metadata, matched their original SHA-256 hashes after the work. The implementation, tests, screenshots and this audit live in the separate v2 folder.

## Measured performance

The following desktop Chromium measurements start when an input event fires and end when the app enables **Copy result**. They include the 65 ms typing delay and result calculation. Each cell summarizes 20 edits after a warm-up using the same wrapped prose and **Clean up text** on loopback HTTP.

| Input size in UTF-16 units | Desktop median | Desktop 95th percentile | Simulated 4× CPU slowdown median | Simulated 4× CPU slowdown 95th percentile |
| --- | ---: | ---: | ---: | ---: |
| 1,000 | 67 ms | 71 ms | 235 ms | 316 ms |
| 100,000 | 84 ms | 92 ms | 177 ms | 219 ms |

The large input uses a worker. Chromium’s CPU slowdown is synthetic and the two paths can be scheduled differently. A physical midrange phone is needed for a mobile latency figure. On the first page load, Resource Timing reported **164,907 decoded bytes** across HTML, CSS, three scripts and three local font files. That count covers the eight measured entries. The worker loads when a large edit needs it. [Repeat the measurement](../scripts/audit.cjs)

## Verification and release decision

Node.js 24.18.0 passed **47** engine and storage tests. Playwright 1.65.1 ran **25** functional and design scenarios in Chromium 159.0.8154.6, Firefox 159.0 and WebKit 27.2 on Windows. Two passes per engine produced **150 passes, zero failures and zero retries**. The browser suite covers local HTTP and direct-file use. Playwright WebKit provides engine coverage. Safari on Apple hardware remains an open device check. [Engine tests](../tests/engine.test.cjs) · [Storage tests](../tests/saved-steps.test.cjs) · [Editor scenarios](../tests/browser/editor.spec.cjs) · [Design checks](../tests/browser/design.spec.cjs) · [Browser testing documentation](https://playwright.dev/docs/browsers)

The next decision is whether this earns a place in someone’s regular workflow. The approved plan sets the following pilot gates.

1. Give five people who already clean text weekly a paragraph, a repeated list or one of their own tasks. Include keyboard and screen-reader use, a physical Android phone and Safari on an Apple device. Record their time, corrections and words they hesitate over. Keep their pasted content private.
2. Observe whether at least four of five can copy a correct first result within 30 seconds of pasting, without coaching. Ask what the person thought would happen before they used an unfamiliar control.
3. After a week, check whether at least three of five returned for a second real task and why. A hosted offline installation or an AI step picker remains a later experiment tied to observed friction. Those decisions and a public deployment follow the pilot.

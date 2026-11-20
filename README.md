# Utextility

Clean up text, check what changed, and copy the result. Open [the editor](index.html) in a current browser. The complete folder works offline, including the fonts. The editor starts blank. **Try an example** loads a short sample for the selected tool.

**Quick guide** opens six editable practice lessons, a before-and-after index of every tool, and help with files, counts, keyboard controls and saved steps. You can visit it mid-edit and come back to your draft in the same tab. On the hosted app the guide has its own address at `/guide`, and a lesson link such as `/guide#list` opens that exercise directly.

## Everyday tasks

| To do this | Choose | What happens |
| --- | --- | --- |
| Fix a paragraph pasted from a PDF | **Clean up text** | Removes extra spaces and joins wrapped prose. Blank paragraphs, marked list items and fenced code keep their boundaries. Select **Keep my line breaks** for addresses or verse. |
| Clean a list of labels | **Tidy a list** | Trims each row, drops empty lines and keeps the first copy of each item. The checkbox lets `Ink` and `ink` count as the same item while keeping the first spelling. |
| Turn headings into link names | **Make link names** | `Summer Reading` becomes `summer-reading`. Enter one heading per line. A notice identifies the first pair of repeated result lines. |
| Update a word or phrase | **Find and replace** | Shows the number of exact, case-sensitive matches. Leave **Replace with** empty to remove them. Punctuation, newlines and dollar signs are treated literally. |

Your original stays in **Your text** as you try tools. **Changes** marks removed and added text, including spaces and line breaks. **Copy result** copies the edited text. **Download** saves it as a UTF-8 text file. **Open file** accepts UTF-8 plain text, including Markdown and comma- or tab-separated text. When a file, example or clear action replaces your text, **Undo** can restore the previous text until you type again.

**Text counts** shows words, characters, lines, sentences and estimated reading time. Choose **Your text** or **Result** to count either version. **Set a limit** checks the chosen version against a word or character budget. Reading time assumes 200 words per minute. Counts use the browser’s Unicode segmentation when available.

## Reuse a set of steps

**More tools** opens a searchable list of 25 operations. **Use** runs a single tool. **Edit steps** lets you add, reorder or remove operations, then **Save these steps** gives the sequence a name. Saved steps and the chosen appearance are kept in this browser. Draft text, results and limits last for the current tab session.

To move a saved sequence, open **Saved steps → Move steps to another browser** and choose **Download steps file**. In the other browser, **Open steps file** lets you review the settings and choose a name. Importing adds it to the list. **Use** applies it. A steps file includes the name, tools and any words entered into **Find** or **Replace with**. An ordinary text download contains the result.

## Run locally

Opening the [HTML file](index.html) is sufficient for everyday use. To run the same app over HTTP with background processing for long inputs, use Node.js from this folder. The development server binds to this computer’s loopback address.

```sh
npm start
```

Open [the local editor](http://127.0.0.1:4389/). Press Ctrl+C in the terminal to stop it. Runtime assets are included with the app. Installing npm packages is only necessary for the browser tests and performance checks.

## Tests and measurements

The suites were verified with Node.js 24. Run the transformation and storage tests directly.

```sh
npm test
```

To run the browser, keyboard, layout and accessibility checks, install the locked development dependencies and the Playwright browsers.

```sh
npm ci
npm run test:browser:install
npm run test:browser
```

The suite starts and stops its own local server. Run `npm run audit:measure` for desktop Chromium timing and page-size measurements. Add `-- --screenshots` to regenerate the three audit images.

## Operating limits

- Each input can contain 100,000 UTF-16 code units. Some emoji use several units. The displayed character count measures user-perceived characters where the browser supports it.
- A sequence can contain up to 16 steps. Each find or replacement field accepts 1,000 code units. The maximum intermediate or final result is 300,000 units.
- Long edits keep their full result. Detailed highlighting stops above 32,000 combined source and result units or a 250,000-cell comparison table.
- On HTTP, inputs of 4,000 units and above normally run in a worker. Opening the file directly or using a browser that blocks workers uses the same operations on the page. If clipboard permission is denied, the app selects the result for manual copying.

## Deploying on Vercel

The [Vercel configuration](vercel.json) copies the editor, guide and their local assets into `dist/`. The editor and guide share a document so moving between them keeps the draft in memory. Vercel resolves direct requests to `/guide` to that entry point. The old `/about` address redirects to the editor.

Use the pull request's preview on the Vercel project that owns `utextility.vercel.app` to check editing, copying, downloading and the old address. Production follows `main` when automatic deployments are enabled. The [legacy-v1 branch](https://github.com/pranshu911/Utextility/tree/legacy-v1) preserves the previous React implementation.

## Project documents

The [implementation and audit report](docs/audit.md) records the 2.1 release, screenshots, verification results and remaining user research. The [illustrated revamp proposal](docs/revamp.html) and [print edition](docs/Utextility-revamp.pdf) document the earlier codebase and the three original design directions.

The processing code lives in [engine.js](engine.js). The [editor controller](workbench.js), [background worker](worker.js) and [saved-step storage](saved-steps.js) share the same tool definitions. DM Sans and DM Serif Text are bundled locally under the SIL Open Font License. [DM Sans license](assets/dmsans-OFL.txt) · [DM Serif Text license](assets/dmseriftext-OFL.txt)

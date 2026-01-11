# JavDB Actress Organizer

This small Node.js utility scans a selected folder for `.mp4` files, extracts AV numbers from filenames, looks up actress names using JavDB (via `getActressFromJavdb.js`), and organizes files into actress-named subfolders.

Behavior

- Prompts a Windows folder picker.
- Scans the chosen folder for top-level `.mp4` files.
- Extracts AV numbers from filenames (e.g. `ABP-123`).
- Uses `list.json` (in the project folder) as a local cache of AV → [actresses].
  - If an AV exists in `list.json`, no network query is made.
  - New AVs are appended to `list.json`.
- If a single actress is found, the MP4 is moved into a subfolder named after the actress.
- If multiple actresses are found, the file is left in place and the mapping is recorded.
- Results and DB are stored in `list.json` at the project root.

Usage

1. Install dependencies:

```bash
npm install
```

2. Run:

```bash
npm start
```

3. Pick a folder when the dialog appears.

Notes

- `list.json` is ignored by git by default (see `.gitignore`).
- You can edit `getActressFromJavdb.js` if you need to change the JavDB base URL or parsing rules.

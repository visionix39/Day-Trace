// SQLite in the browser is a WebAssembly file that ships inside the sql.js
// package. The browser fetches it at runtime, so it has to be in public/.
// Runs automatically after `npm install` and before `dev` / `build`.

import { copyFileSync, mkdirSync } from "node:fs";

const from = new URL("../node_modules/sql.js/dist/sql-wasm.wasm", import.meta.url);
const to = new URL("../public/sql-wasm.wasm", import.meta.url);

mkdirSync(new URL("../public/", import.meta.url), { recursive: true });
copyFileSync(from, to);

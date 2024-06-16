# Obsidian Sample Plugin modif


## developpement

Prompts are guiding you

- in dev mode, plugins have not necessary to be in a vault, and result files are sent to your `TEST_VAULT` in `.env` (.../.osbidian/plugins)
- in prod mode, needed files are generated in same folder where your code is. Then you can use `npm run release`...  

- `npm start`: npm i + npm run dev (see `TEST_VAULT` path, in `.env`)

- `npm run acp`: add commit push (no build)
- `npm run bacp`: build + acp

- `npm run test`: build and test in another path. prompt asking for the destination path
- `npm run real`: same as test but no prompt (see `REAL_VAULT` path in `.env`) and you must set `REAL` to 1.

- `npm run version`: better than default one with prompts
- `npm run release`: make a tag and release (update the version first). can be multiline using `\n`



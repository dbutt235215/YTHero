[Tempo data via GetSongBPM.com](https://getsongbpm.com)


This contains everything you need to run your app locally.



## Run Locally

**Prerequisites:**  Node.js



1. Install dependencies:
`npm install`
2. Set the `GEMINI\_API\_KEY` in [.env.local](.env.local) to your Gemini API key
3. (Recommended) Set `GETSONGBPM\_API\_KEY` in `.env.local` — get a free key at
[getsongbpm.com/api](https://getsongbpm.com/api). Without it, imported tracks
fall back to a deterministic tempo/key guess instead of a real match; tracks
in the UI are labeled "verified" or "\~" (estimated) accordingly.
4. Run the app:
`npm run dev`


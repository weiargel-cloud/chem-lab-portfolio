# Chemistry Lab Portfolio

Our semestral chemistry laboratory portfolio: one website with the video, report, photos and write-up for each of our 8 lab activities.

It's a plain static site (HTML, CSS and JavaScript, no build step), hosted on GitHub Pages.

## Where the content lives

| File | What it holds |
|---|---|
| `data/site.json` | Course name, headline, semester, section, instructor, members, group photo |
| `data/experiments.json` | The 8 experiments, one block each |
| `images/` | Photos stored in the repo (optional; Drive links also work) |
| `reports/` | PDF reports stored in the repo (optional; Drive links also work) |

**You only need to edit the two JSON files.** You don't need to touch `index.html`, `styles.css` or `app.js`.

### Filling in an experiment

Each block in `data/experiments.json` looks like this:

```json
{
  "num": 1,
  "title": "Determination of acetic acid in vinegar",
  "symbol": "Ti",
  "date": "2026-08-12",
  "group": "acid",
  "authors": "Names of who performed it",
  "equation": "CH3COOH + NaOH -> CH3COONa + H2O",
  "videos": [
    "https://drive.google.com/file/d/CLIP_1_ID/view",
    "https://drive.google.com/file/d/CLIP_2_ID/view"
  ],
  "report": "https://drive.google.com/file/d/FILE_ID/view",
  "reportName": "EXP-1 Lab Report",
  "photos": ["images/exp1-setup.jpg", "https://drive.google.com/file/d/FILE_ID/view"],
  "objective": "One or more paragraphs. Leave a blank line between paragraphs.",
  "materials": "One item per line",
  "procedure": "One step per line; they're numbered automatically",
  "observations": "",
  "results": "",
  "conclusion": "",
  "safety": ""
}
```

- `description` is a short summary (2–3 sentences) shown on the experiment's card and under its title.
- `videos` is a list of clips in the order they should play. One clip is fine, and the first clip's thumbnail becomes the floating card.
- An experiment shows as **"coming soon"** until it has a title, a video or a report. Without a title it shows as "Experiment N".
- `group` sets the colour and must be one of: `acid`, `redox`, `organic`, `stoich`, `thermo`, `other`.
- `symbol` is the 1–3 letter "element" on its card. Leave it empty and one is made from the title.
- In `equation`, numbers after letters become subscripts and `->` becomes an arrow.
- In JSON, a line break inside text is written as `\n`. You can also give `materials` and `procedure` as a list: `["step one", "step two"]`.

### Videos

- **Google Drive (recommended):** open the video in Drive, click **Share**, set it to **Anyone with the link**, copy the link and paste it into `video`. It plays inside the page, and its thumbnail becomes the floating card.
- **YouTube** links work the same way.
- A video file in the repo (`.mp4`) also works, but GitHub refuses files over 100 MB, so use Drive for big videos.

## Working on it with your lab partner

Split the experiments, for example Labs 1–4 and Labs 5–8, so you don't edit the same block at the same time.

```
git pull          # get your partner's latest changes first
# ...edit the JSON files...
git add -A
git commit -m "Add Lab 3 write-up"
git push
```

If `git push` is rejected, run `git pull` and push again.

## Previewing on your computer

The page loads its JSON with `fetch`, so opening `index.html` by double-clicking won't load the content. Run a small local server from this folder instead:

```
python -m http.server 8000
```

Then open http://localhost:8000.

## Publishing with GitHub Pages

1. On GitHub, open the repo, then go to **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, and click **Save**.
3. After a minute the site is live at `https://YOUR-USERNAME.github.io/REPO-NAME/`. Every push updates it.

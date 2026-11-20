# examplesample

A four-graph sampling-distribution tool with editable populations and animated samples.
The interface is React. The simulation, probabilities, and statistics are real Python.
This project is independent of any other GitHub repository you own.

## Run it locally

Open a terminal in this folder and run either:

```sh
python -m http.server 8000
```

Then visit http://localhost:8000/ . Python 3.10 or newer is recommended for the
standalone lessons and tests. If you already have Node.js, you can instead run:

```sh
node scripts/serve.mjs
```

Then visit http://127.0.0.1:4173/examplesample/ . The nested path deliberately
checks the same relative URLs used by a GitHub Pages project site.

Open the site over HTTP, not by double-clicking index.html. Module workers need
a web server. No npm installation or build step is required for local use.
The first visit downloads React and the Pyodide Python runtime from CDNs.

## Publish in a separate GitHub repository

1. Create a NEW repository, for example `examplesample`. Do not use your
   hackathon repository or rename an existing `<username>.github.io` repository.
2. Upload the CONTENTS of this folder to the new repository's root. `index.html`
   should be at the top level, not inside another `examplesample` folder.
3. Include `python/`, `scripts/`, and the hidden `.nojekyll` file. Git tracks
   folders when their files are present.
4. In that repository, open Settings > Pages.
5. Under Build and deployment, choose Deploy from a branch, then `main` and
   `/(root)`. Save.
6. GitHub will provide a link such as
   `https://YOUR-USERNAME.github.io/examplesample/`.

That project URL is separate from other repositories' Pages URLs. Publishing
here does not change a hackathon repository, its source, or its deployed link.
Repository visibility determines who can read the source; Pages access depends
on your GitHub plan and Pages settings. The common setup is a public repository.

For an optional static output folder, run `node scripts/build.mjs`. It copies the
runtime files into `dist/`; upload that folder's contents to another static host.
The source folder itself already works on GitHub Pages without this step.

## What the four graphs mean

- **Parent population:** preset or hand-drawn relative frequencies. Drag across
  the graph to set bar heights. Mouse, pen, and touch use pointer events. For a
  keyboard, Tab to a bar and press Up/Down (or Home/End).
- **Sample data:** the most recent sample, with one block per observation.
  Animated draws drop the observations into their value bins sequentially.
- **Primary sampling distribution:** one calculated statistic per primary
  sample. Five observations produce ONE sample mean, not five sample means.
- **Second sampling distribution:** an optional, independently drawn comparison
  with its own statistic and sample size. Its sample is shown after the primary
  sample, matching the original simulator's sequence.

Changing a population, statistic, sample size, or seed clears the lower three
graphs. Clear samples preserves your population and configuration. A batch adds
results immediately. At large counts, tiny blocks merge into solid bars.

## Statistical choices

The population contains 40 possible values: 1.25, 3.75, ..., 98.75. Presets are
finite, quantized approximations to familiar shapes. The normal preset is not an
unbounded continuous Gaussian. Each editable block is one unit of relative
weight; presets have peak height 15 and drawing supports heights 0 through 20.
Python divides all weights by their sum. Zero-height bars have zero probability.
An all-zero drawing is rejected and the previous population is restored.

Every draw is independent, WITH replacement. The population mean and SD are
computed from the exact model probabilities, including custom drawings.

Available statistics:

| Statistic | Definition |
| --- | --- |
| Mean | Sum of observations divided by n |
| Median | Middle value; average of the two middle values for even n |
| SD (N) | Square root of variance with divisor n |
| Variance (N) | Average squared deviation from the sample mean |
| Variance (N - 1) | Unbiased sample variance, using divisor n - 1 |
| Mean absolute deviation | Average absolute deviation from the sample mean |
| Range | Largest observation minus smallest |

The observed spread across repetitions is estimated with sample SD (divisor
R - 1), where R is the number of repetitions. It is unavailable until R >= 2.
For sample means, this estimates the standard error. The exact theoretical SE
for our independent draws is sigma / sqrt(n). The formula is not applied to
other statistics. The optional dashed normal reference uses population mu and
this theoretical SE; it is an approximation that may fit poorly at small n.

Variance charts use a different horizontal range so values are not clipped.
Means, medians, SD, MAD, and ranges use 0-100. These fixed ranges prioritize
honest comparison over zooming in automatically.

The parent strip reports exact weighted moments. The sample strip reports
descriptive moments with divisor n. `Excess kurtosis` subtracts 3. At zero SD,
standardized skew and kurtosis are displayed as 0 by convention.

The primary and comparison experiments use separate seeded random streams.
Enabling comparison does not change the primary experiment's sequence. Each
active experiment is limited to 100,000 repetitions per reset.

## Learn the Python

Start with `python/lesson_01.py`, which needs only the standard library:

```sh
python python/lesson_01.py
```

Then read `python/engine.py` in this order:

1. `make_population`: values + relative weights -> normalized probabilities.
2. `draw_sample`: `random.choices` draws n values with replacement.
3. `calculate_statistic`: turn one sample into one number.
4. `run`: repeat and append one result per sample.
5. `distribution_summary`: turn all those results into histogram counts,
   a center, and an observed spread.
6. `dispatch_json`: the small boundary between Python and the interface.

A useful first question: if bar A has height 2 and bar B has height 6, with all
other bars at zero, what probabilities should Python give A and B?

Next, trace a single mean from `draw_sample` to `results.append`. Distinguish
`len(latest_sample)` (sample size) from `len(results)` (repetitions).

For the learning exercise, compare n=5 and n=50 at 10,000 repetitions. Then keep
n fixed and change repetitions. Explain which setting changes the true sampling
distribution and which changes the quality of its Monte Carlo approximation.

SQL is not used in this version because the app does not need a database.
CSV export provides one row per statistic, with experiment, repetition,
statistic, value, sample size, population name, and seed. For a custom parent,
the exported name is `custom`; keep its bar weights separately to reproduce it.
A future SQL lesson could store configurations and compare saved runs.

## Code map

| File | Purpose |
| --- | --- |
| `python/engine.py` | The actual Python engine used by the app |
| `python/lesson_01.py` | A small standalone learning exercise |
| `worker.js` | Loads Python off the UI thread and exchanges JSON messages |
| `app.js` | React components, graph editing, and animation |
| `styles.css` | Visual design, responsive layout, reduced-motion behavior |
| `scripts/serve.mjs` | Dependency-free local development server |
| `scripts/build.mjs` | Optional static-file packaging |
| `tests/test_engine.py` | Behavioral and numerical checks |

You do not need to learn or edit the React files to work on the Python lessons.

## Verification

```sh
python -m unittest discover -s tests -v
node --check app.js
node --check worker.js
node scripts/build.mjs
```

Tests cover custom probabilities, invalid populations, deterministic seeds,
independent comparison streams, statistic definitions, the JSON bridge, CSV
export, and Monte Carlo agreement with the theoretical mean and SE.

## Loading and privacy

React 19.2.0 is loaded from esm.sh; Pyodide 314.0.8 is loaded from jsDelivr.
The optional DM Sans font is loaded from Google Fonts, with system-font
fallbacks. Internet access is required on first load; this app does not promise
offline availability. After loading, simulation runs locally in the browser.
The app has no analytics, accounts, backend, or persistent database.
External CDNs and your hosting provider receive the usual web requests.

## Inspiration and references

- Original simulator: https://onlinestatbook.com/stat_sim/sampling_dist/index.html
- Interactive implementation inspected: https://onlinestatbook.com/stat_sim/samp_dist_js/index.html
- Original instructions: https://onlinestatbook.com/stat_sim/sampling_dist/instructions.html
- Pyodide workers: https://pyodide.org/en/stable/usage/webworker.html
- GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages

The Python engine, React interface, and styling in this project are newly written.

## Appearance and motion

The appearance control supports System, Light, and Dark. The selection is saved
in this browser. Glass surfaces use backdrop blur, saturation, layered highlights,
and fine edge reflections, with an opaque fallback where blur is unavailable.
Graph geometry transitions use native browser transform animations. Individual
observations still fall one at a time. Reduced-motion preferences disable both.
Python lessons remain in the source files; the simulator has no tutorial panel.

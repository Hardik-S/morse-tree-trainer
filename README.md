# Morse Tree Trainer

A fast static web app for learning Morse code with a decision-tree explorer, audio playback, and two focused quiz modes.

## Features

- Explore Morse paths by walking the dot/dash decision tree.
- Practice `Letter -> Morse` by entering the code for a target letter.
- Practice `Morse -> Letter` by reading or playing a code and typing the matching letter.
- Track local attempts, correct answers, and accuracy for both quiz modes.
- Use keyboard controls, touch controls, and accessible tab navigation.

## Local Use

Open `index.html` directly, or run a small local server:

```powershell
npm run serve
```

Then open the printed local URL.

## Checks

```powershell
npm run check
```

The check validates the expected static files and the A-Z Morse map exposed in `src/app.js`.

## Deploy

This repo is configured for Netlify as a static site:

- Build command: none
- Publish directory: `.`


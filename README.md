# Airbnb Walkthrough Prompt Tool

Paste an Airbnb listing URL, pick which photos actually belong to the unit,
and get back a Higgsfield-ready walkthrough video prompt.

## How it works

1. You paste a listing URL.
2. The app fetches that page and pulls out the photos.
3. You review the grid and uncheck anything that isn't the unit (neighborhood shots, host photos, etc.).
4. Claude looks at your selected photos and writes a structured Higgsfield prompt (shot structure, space, camera moves, lighting).
5. You copy the prompt into Higgsfield yourself.

Nothing is stored. Photos are only held in memory for the request, and the
prompt output isn't saved anywhere once you leave the page.

## 1. Get an Anthropic API key

Go to https://console.anthropic.com, create an account, add billing, and
generate an API key under "API Keys." This is pay-as-you-go, separate from
any claude.ai subscription.

## 2. Push this to GitHub

From this folder:

```bash
git init
git add .
git commit -m "Initial commit"
```

Then create a new empty repo on GitHub and follow the push instructions it
gives you (`git remote add origin ...`, `git push -u origin main`).

## 3. Deploy on Vercel

1. In Vercel, click "Add New Project" and import the GitHub repo you just created.
2. Before deploying, open the "Environment Variables" section and add:
   - `ANTHROPIC_API_KEY` — your key from step 1
   - `SITE_PASSWORD` — any password you want to use to open the app
3. Deploy. Vercel will give you a live URL.

Every time you push a change to GitHub, Vercel redeploys automatically.

## 4. Using it

Open your Vercel URL, enter the `SITE_PASSWORD` you set, paste an Airbnb
listing link, and go.

## Notes and limitations

- Airbnb doesn't provide an official API for this, so the app reads the
  listing page's own HTML to find photos. If Airbnb changes their page
  structure at some point, the photo-fetching step may need updating.
- Automated fetching from Airbnb sits in a gray area relative to their
  terms of service. This is built for personal, low-volume use.
- Very large listings (60+ photos) are capped so requests stay fast and
  cheap; you can always run it again with different photos if needed.
- Each run costs a small amount on your Anthropic account based on how
  many photos you select, typically well under a dollar per listing.

## Local development (optional)

```bash
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev
```

Visit http://localhost:3000

# Airbnb Walkthrough Prompt Tool

Paste an Airbnb listing URL, pick which photos actually belong to the unit,
and get back a Higgsfield-ready walkthrough video prompt.

## How it works

1. You paste a listing URL.
2. The app fetches that page and pulls out the photos.
3. You review the grid and uncheck anything that isn't the unit (neighborhood shots, host photos, etc.).
4. Claude (or ChatGPT, if you pick it) looks at your selected photos and writes a structured Higgsfield prompt (shot structure, space, camera moves, lighting).
5. You copy the prompt into Higgsfield yourself.
6. Each run is saved to "Recent listings" at the bottom of the page, so you
   can reload a past listing with its photos, selection and settings intact.

Photos are only held in memory for the request. Generated prompts are saved
to your own database (see step 3) so the history survives closing the page;
delete any entry from the history list to remove it.

## 1. Get an Anthropic API key

Go to https://console.anthropic.com, create an account, add billing, and
generate an API key under "API Keys." This is pay-as-you-go, separate from
any claude.ai subscription.

### Optional: an OpenAI API key

The app can write the prompt with either Claude or ChatGPT, picked with the
"Write the prompt with" toggle. If you want the ChatGPT option, go to
https://platform.openai.com, create an account, add billing, and generate an
API key under "API keys." This is also pay-as-you-go and separate from any
ChatGPT subscription.

Skip this if you're happy with Claude — the app defaults to Claude and works
fine without an OpenAI key. (Selecting ChatGPT without one returns an error.)

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
   - `OPENAI_API_KEY` — optional, only if you want the ChatGPT option
   - `SITE_PASSWORD` — any password you want to use to open the app
3. Deploy. Vercel will give you a live URL.

Every time you push a change to GitHub, Vercel redeploys automatically.

## 4. Add a database for the listing history

The "Recent listings" panel needs somewhere to store past runs. Vercel no
longer runs its own Postgres — it's provisioned from Neon through the
marketplace, billed on your Vercel invoice, with a free tier that's far more
than this app needs.

1. Open your project in Vercel and go to the **Storage** tab.
2. Click **Create Database**, pick **Neon** (Postgres), and choose a region
   near you.
3. When prompted, connect it to this project. Vercel adds `DATABASE_URL` to
   your environment variables automatically.
4. Redeploy so the running app picks up the new variable.

The table is created automatically the first time the app saves a run, so
there's no migration to run by hand.

If you skip this step everything else still works — the app just shows a
note in place of the history list.

## 5. Using it

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
- Each run costs a small amount on whichever provider you picked (Anthropic
  or OpenAI) based on how many photos you select, typically well under a
  dollar per listing.

## Local development (optional)

```bash
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev
```

Visit http://localhost:3000

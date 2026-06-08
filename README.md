# 🤖 WP Chatbot — DraftSight SA & Simutron

Embeddable AI chat widgets for WordPress, powered by Claude (Anthropic).  
Both bots share one codebase — separated by `botId`.

---

## What you'll need (all free tiers work)

| Service | What it does | Free? |
|---------|-------------|-------|
| **Supabase** | Stores your knowledge base documents | ✅ Free |
| **Vercel** | Hosts the API backend | ✅ Free |
| **Anthropic** | Powers the AI chat | Paid by usage |

---

## STEP 1 — Set up Supabase

1. Go to **https://supabase.com** → Create a free account
2. Click **New Project** → give it a name (e.g. `wp-chatbot`) → set a database password → Create
3. Wait ~2 minutes for the project to provision
4. In the left sidebar, click **SQL Editor**
5. Click **+ New query**
6. Open the file `supabase/schema.sql` from this project and **paste the entire contents** into the editor
7. Click **Run** → you should see "Success. No rows returned"

**Get your Supabase credentials:**
- Left sidebar → **Project Settings** → **API**
- Copy **Project URL** → this is your `SUPABASE_URL`
- Copy **service_role** key (under "Project API keys" → reveal) → this is your `SUPABASE_SERVICE_KEY`
  ⚠️ Keep the service_role key secret — it bypasses row-level security

---

## STEP 2 — Deploy to Vercel

### Option A — GitHub (recommended)

1. Create a **GitHub account** at https://github.com if you don't have one
2. Create a new repository called `wp-chatbot`
3. Upload all the files from this project into the repository
4. Go to **https://vercel.com** → Sign up with your GitHub account
5. Click **Add New Project** → Import your `wp-chatbot` repository
6. Click **Deploy** (don't change any settings yet)
7. Once deployed, go to **Settings → Environment Variables** and add these:

| Variable Name | Value |
|---------------|-------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (from https://console.anthropic.com) |
| `SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_SERVICE_KEY` | Your Supabase service_role key |
| `ADMIN_API_KEY` | Make up a strong password (e.g. `MyAdminPass2024!`) |

8. After adding variables, go to **Deployments** → click the **3-dot menu** on the latest deployment → **Redeploy**

### Option B — Vercel CLI (advanced)

```bash
npm install -g vercel
cd wp-chatbot
vercel
# Follow prompts, then:
vercel env add ANTHROPIC_API_KEY
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_KEY
vercel env add ADMIN_API_KEY
vercel --prod
```

**Your API URL will be:** `https://your-project-name.vercel.app`

---

## STEP 3 — Upload documents to the knowledge base

1. Open your browser and go to:  
   `https://your-project-name.vercel.app/admin`

2. Enter:
   - **Vercel API URL:** `https://your-project-name.vercel.app`
   - **Admin Key:** the `ADMIN_API_KEY` value you set in Vercel

3. Select the bot tab (**DraftSight SA** or **Simutron**)

4. Upload your documents:
   - Product brochures (PDF)
   - Price lists (PDF, DOCX, CSV)
   - Technical specs (PDF, DOCX)
   - Screenshots of products (PNG, JPG)
   - Any Word documents or plain text files

5. Repeat for both bots with their respective documents

**Supported formats:** PDF, DOCX, DOC, TXT, MD, CSV, JSON, PNG, JPG, GIF, WEBP

---

## STEP 4 — Add the widget to WordPress

### DraftSight SA website

1. In WordPress, go to **Appearance → Widgets** (or use Elementor/Divi HTML block)
2. Add a **Custom HTML** widget to any area (footer works well)
3. Paste this code:

```html
<script>
  window.ChatbotConfig = {
    botId:          'draftsight',
    apiUrl:         'https://YOUR-PROJECT.vercel.app',
    primaryColor:   '#0066B3',
    title:          'DraftSight SA Assistant',
    welcomeMessage: 'Hi! I can help you with DraftSight products, licensing, and pricing. What would you like to know?',
    position:       'right'
  };
</script>
<script src="https://YOUR-PROJECT.vercel.app/chatbot.js"></script>
```

Replace `YOUR-PROJECT` with your actual Vercel project name.

---

### Simutron website

```html
<script>
  window.ChatbotConfig = {
    botId:          'simutron',
    apiUrl:         'https://YOUR-PROJECT.vercel.app',
    primaryColor:   '#E8500A',
    title:          'Simutron Assistant',
    welcomeMessage: 'Hello! Ask me about Altair simulation products, HPC solutions, or Simutron licensing.',
    position:       'right'
  };
</script>
<script src="https://YOUR-PROJECT.vercel.app/chatbot.js"></script>
```

---

## Widget configuration options

| Option | Default | Description |
|--------|---------|-------------|
| `botId` | `'draftsight'` | Which bot to use: `'draftsight'` or `'simutron'` |
| `apiUrl` | *(required)* | Your Vercel deployment URL |
| `primaryColor` | `'#0066B3'` | Main colour for the widget |
| `title` | `'Chat Assistant'` | Name shown in the chat header |
| `welcomeMessage` | `'Hi! How can I help?'` | First message the bot sends |
| `position` | `'right'` | `'right'` or `'left'` side of screen |

---

## Troubleshooting

**Widget doesn't appear:**
- Check the browser console for errors
- Verify the `apiUrl` is correct and doesn't have a trailing slash
- Make sure the Vercel deployment is live (green checkmark in Vercel dashboard)

**Bot says it has no documents:**
- Go to the Admin panel and confirm documents are uploaded
- Check the Supabase `document_chunks` table has rows: SQL Editor → `SELECT count(*) FROM document_chunks;`

**"Invalid admin key" error in admin panel:**
- Double-check the `ADMIN_API_KEY` in Vercel matches what you're typing
- Make sure you redeployed after adding environment variables

**Uploads fail:**
- File may be over 10 MB — compress it first
- Check the Vercel function logs: Vercel Dashboard → your project → **Functions** tab

**Costs:**
- Supabase free tier: 500 MB database, plenty for documents
- Vercel free tier: 100 GB bandwidth, 100,000 function executions/month
- Anthropic: roughly $0.003 per conversation (Claude Sonnet pricing)

---

## File structure

```
wp-chatbot/
├── api/
│   ├── chat.js          # Chat endpoint — handles RAG + Claude responses
│   ├── ingest.js        # Document upload + chunking endpoint
│   └── documents.js     # List + delete documents endpoint
├── public/
│   ├── chatbot.js       # Embeddable widget (paste <script> tag into WordPress)
│   └── admin/
│       └── index.html   # Admin dashboard for managing documents
├── supabase/
│   └── schema.sql       # Run this once in Supabase SQL Editor
├── package.json
├── vercel.json
└── README.md
```

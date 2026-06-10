// api/chat.js
// POST /api/chat  — handles chat requests with RAG (retrieval-augmented generation)

const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

// ── Bot personality configs ────────────────────────────────────────────────
const BOT_CONFIGS = {
  draftsight: {
    company:     'DraftSight SA',
    description: 'the authorised South African reseller of DraftSight CAD software by Dassault Systèmes',
    website:     'https://draftsightsa.co.za',
    products:    'DraftSight Standard, Professional, Premium, Enterprise, Enterprise Plus, and DraftSight Mechanical',
    fallback:    'Please visit https://draftsightsa.co.za or email the DraftSight SA team for further assistance.',
  },
  simutron: {
    company:     'Simutron',
    description: 'a South African reseller of Siemens Simcenter simulation, HPC, and AI-driven engineering software',
    website:     'https://simutron.co.za',
    products:    'Siemens Simcenter simulation tools, HPC solutions, and units-based licensing',
    fallback:    'Please visit https://simutron.co.za or contact the Simutron team for further assistance.',
  },
};

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function buildSearchQuery(text) {
  return text
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 12)
    .join(' | ');
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { message, botId, history = [] } = req.body || {};

    if (!message) return res.status(400).json({ error: '"message" is required' });
    if (!botId)   return res.status(400).json({ error: '"botId" is required' });

    const bot = BOT_CONFIGS[botId] || {
      company: 'the company', description: 'a company',
      website: '', products: 'various products',
      fallback: 'Please contact us for more information.',
    };

    const supabase = getSupabase();

    // ── Search knowledge base ───────────────────────────────────────────────
    let chunks = [];
    const tsQuery = buildSearchQuery(message);

    if (tsQuery) {
      const { data } = await supabase
        .from('document_chunks')
        .select('content, source')
        .eq('bot_id', botId)
        .textSearch('search_vector', tsQuery, { type: 'plain' })
        .limit(6);
      chunks = data || [];
    }

    if (chunks.length === 0) {
      const { data } = await supabase
        .from('document_chunks')
        .select('content, source')
        .eq('bot_id', botId)
        .order('created_at', { ascending: false })
        .limit(6);
      chunks = data || [];
    }

    const knowledgeBase = chunks.length > 0
      ? chunks.map(c => `[Source: ${c.source}]\n${c.content}`).join('\n\n---\n\n')
      : null;

    const systemPrompt = `You are a helpful, professional sales and support assistant for ${bot.company}, ${bot.description}.

Your goal is to help customers understand and choose the right products, answer technical questions, assist with licensing queries, and provide general support.

Products you cover: ${bot.products}.

${knowledgeBase
  ? `KNOWLEDGE BASE (use this to answer accurately):\n\n${knowledgeBase}`
  : 'No documents have been uploaded to the knowledge base yet. Answer from general knowledge and be transparent about limitations.'
}

GUIDELINES:
- Be friendly, concise, and professional
- Always base product details, pricing, and specs on the knowledge base — never fabricate specifics
- If you are unsure, direct the customer to ${bot.website} or suggest they contact the team
- For multi-step technical issues, guide the customer step by step
- Respond in the same language the customer uses (English or Afrikaans are common)
- Keep responses under 200 words unless a detailed explanation is genuinely needed
- If a customer wants to buy or get a quote, direct them to ${bot.website}`;

    // ── Call OpenAI ─────────────────────────────────────────────────────────
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-8).filter(m => m.role && m.content),
      { role: 'user', content: message },
    ];

    const completion = await openai.chat.completions.create({
      model:      'gpt-4o-mini',   // Fast and cost-effective; change to 'gpt-4o' for more power
      max_tokens: 1024,
      messages,
    });

    const responseText = completion.choices[0].message.content;
    const sources = [...new Set(chunks.map(c => c.source))];

    return res.status(200).json({ response: responseText, sources });

  } catch (err) {
    console.error('[chat] Error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};

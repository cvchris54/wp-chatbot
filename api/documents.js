// api/documents.js
// GET    /api/documents?botId=&adminKey=   — list documents
// DELETE /api/documents                    — delete a document (body: { botId, adminKey, source })

const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ── Auth + params ─────────────────────────────────────────────────────
    const botId    = req.method === 'GET' ? req.query.botId    : req.body?.botId;
    const adminKey = req.method === 'GET' ? req.query.adminKey : req.body?.adminKey;
    const source   = req.method === 'GET' ? req.query.source   : req.body?.source;

    if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
      return res.status(401).json({ error: 'Invalid or missing admin key' });
    }
    if (!botId) {
      return res.status(400).json({ error: '"botId" is required' });
    }

    const supabase = getSupabase();

    // ── GET — list documents ──────────────────────────────────────────────
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('document_chunks')
        .select('source, chunk_index, created_at')
        .eq('bot_id', botId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group chunks by source filename
      const map = {};
      for (const row of data || []) {
        if (!map[row.source]) {
          map[row.source] = { source: row.source, chunks: 0, uploaded_at: row.created_at };
        }
        map[row.source].chunks++;
      }

      return res.status(200).json({ documents: Object.values(map) });
    }

    // ── DELETE — remove a document ────────────────────────────────────────
    if (req.method === 'DELETE') {
      if (!source) return res.status(400).json({ error: '"source" (filename) is required' });

      const { error } = await supabase
        .from('document_chunks')
        .delete()
        .eq('bot_id', botId)
        .eq('source', source);

      if (error) throw error;

      return res.status(200).json({ success: true, message: `"${source}" deleted.` });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('[documents] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

// api/ingest.js
// POST /api/ingest  — accepts a file as base64, extracts text, chunks it, stores in Supabase

const { createClient } = require('@supabase/supabase-js');
const Anthropic         = require('@anthropic-ai/sdk');

// ── Helpers ────────────────────────────────────────────────────────────────
function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── Text extraction ────────────────────────────────────────────────────────
async function extractText(fileData, fileType, fileName) {
  const buffer = Buffer.from(fileData, 'base64');

  // PDF
  if (fileType === 'application/pdf') {
    const pdfParse = require('pdf-parse');
    const result   = await pdfParse(buffer);
    return result.text;
  }

  // Word documents (.docx)
  if (
    fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileType === 'application/msword' ||
    fileName.toLowerCase().endsWith('.docx') ||
    fileName.toLowerCase().endsWith('.doc')
  ) {
    const mammoth = require('mammoth');
    const result  = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // Plain text, Markdown, CSV, JSON
  if (
    fileType.startsWith('text/') ||
    fileType === 'application/json' ||
    /\.(txt|md|csv|json)$/i.test(fileName)
  ) {
    return buffer.toString('utf-8');
  }

  // Images — use Claude Vision to extract all visible text
  if (fileType.startsWith('image/')) {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response  = await anthropic.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{
        role:    'user',
        content: [
          {
            type:   'image',
            source: { type: 'base64', media_type: fileType, data: fileData },
          },
          {
            type: 'text',
            text: 'Extract ALL text from this image verbatim. Include headings, body text, labels, prices, specs, and any other visible text. Format clearly with line breaks. Do not summarise — extract every word.',
          },
        ],
      }],
    });
    return response.content[0].text;
  }

  throw new Error(
    `Unsupported file type: ${fileType}. Supported: PDF, DOCX, TXT, MD, CSV, PNG, JPG, GIF, WEBP`
  );
}

// ── Text chunking ──────────────────────────────────────────────────────────
function chunkText(text, maxWords = 400) {
  // Normalise line endings
  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split into paragraphs
  const paragraphs = clean
    .split(/\n{2,}/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(p => p.length > 30);

  const chunks  = [];
  let current   = '';
  let wordCount = 0;

  for (const para of paragraphs) {
    const words = para.split(/\s+/).length;

    if (wordCount + words > maxWords && current.length > 0) {
      chunks.push(current.trim());
      current   = para;
      wordCount = words;
    } else {
      current   = current ? `${current}\n\n${para}` : para;
      wordCount += words;
    }
  }

  if (current.trim().length > 30) {
    chunks.push(current.trim());
  }

  return chunks;
}

// ── Main handler ───────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { botId, adminKey, fileName, fileType, fileData } = req.body || {};

    // ── Auth check ──────────────────────────────────────────────────────────
    if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
      return res.status(401).json({ error: 'Invalid or missing admin key' });
    }

    // ── Validate inputs ─────────────────────────────────────────────────────
    if (!botId)    return res.status(400).json({ error: '"botId" is required' });
    if (!fileName) return res.status(400).json({ error: '"fileName" is required' });
    if (!fileType) return res.status(400).json({ error: '"fileType" is required' });
    if (!fileData) return res.status(400).json({ error: '"fileData" (base64) is required' });

    // Rough size check — base64 of a 10 MB file ≈ 13.3 MB string
    if (fileData.length > 14_000_000) {
      return res.status(400).json({ error: 'File too large. Maximum size is 10 MB.' });
    }

    // ── Extract text ────────────────────────────────────────────────────────
    let text;
    try {
      text = await extractText(fileData, fileType, fileName);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    if (!text || text.trim().length < 20) {
      return res.status(400).json({ error: 'Could not extract meaningful text from this file.' });
    }

    // ── Chunk ───────────────────────────────────────────────────────────────
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      return res.status(400).json({ error: 'No usable text chunks generated.' });
    }

    // ── Store in Supabase ───────────────────────────────────────────────────
    const supabase = getSupabase();

    // Delete any existing chunks for this file (safe re-upload)
    await supabase
      .from('document_chunks')
      .delete()
      .eq('bot_id', botId)
      .eq('source', fileName);

    // Insert all chunks in one call
    const rows = chunks.map((content, idx) => ({
      bot_id:      botId,
      source:      fileName,
      content,
      chunk_index: idx,
    }));

    const { error: insertError } = await supabase
      .from('document_chunks')
      .insert(rows);

    if (insertError) throw insertError;

    return res.status(200).json({
      success: true,
      fileName,
      chunks:  chunks.length,
      message: `✓ ${fileName} processed successfully — ${chunks.length} knowledge chunks stored.`,
    });

  } catch (err) {
    console.error('[ingest] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

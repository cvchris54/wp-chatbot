const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function extractText(fileData, fileType, fileName) {
  const buffer = Buffer.from(fileData, 'base64');

  if (fileType === 'application/pdf') {
    const pdfParse = require('pdf-parse');
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileType === 'application/msword' ||
      fileName.toLowerCase().endsWith('.docx') ||
      fileName.toLowerCase().endsWith('.doc')) {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (fileType.startsWith('text/') || fileType === 'application/json' ||
      /\.(txt|md|csv|json)$/i.test(fileName)) {
    return buffer.toString('utf-8');
  }

  if (fileType.startsWith('image/')) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${fileType};base64,${fileData}` } },
          { type: 'text', text: 'Extract ALL text from this image verbatim. Include headings, body text, labels, prices, specs, and any other visible text. Do not summarise — extract every word.' }
        ]
      }]
    });
    return response.choices[0].message.content;
  }

  throw new Error(`Unsupported file type: ${fileType}. Supported: PDF, DOCX, TXT, MD, CSV, PNG, JPG, WEBP`);
}

function chunkText(text, maxWords = 400) {
  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const paragraphs = clean.split(/\n{2,}/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(p => p.length > 30);

  const chunks = [];
  let current = '';
  let wordCount = 0;

  for (const para of paragraphs) {
    const words = para.split(/\s+/).length;
    if (wordCount + words > maxWords && current.length > 0) {
      chunks.push(current.trim());
      current = para;
      wordCount = words;
    } else {
      current = current ? `${current}\n\n${para}` : para;
      wordCount += words;
    }
  }

  if (current.trim().length > 30) chunks.push(current.trim());
  return chunks;
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { botId, adminKey, fileName, fileType, fileData } = req.body || {};

    if (!adminKey || adminKey !== process.env.ADMIN_API_KEY)
      return res.status(401).json({ error: 'Invalid or missing admin key' });
    if (!botId)    return res.status(400).json({ error: '"botId" is required' });
    if (!fileName) return res.status(400).json({ error: '"fileName" is required' });
    if (!fileType) return res.status(400).json({ error: '"fileType" is required' });
    if (!fileData) return res.status(400).json({ error: '"fileData" is required' });
    if (fileData.length > 14_000_000)
      return res.status(400).json({ error: 'File too large. Maximum 10 MB.' });

    let text;
    try { text = await extractText(fileData, fileType, fileName); }
    catch (e) { return res.status(400).json({ error: e.message }); }

    if (!text || text.trim().length < 20)
      return res.status(400).json({ error: 'Could not extract meaningful text from this file.' });

    const chunks = chunkText(text);
    if (chunks.length === 0)
      return res.status(400).json({ error: 'No usable text chunks generated.' });

    const supabase = getSupabase();

    await supabase.from('document_chunks').delete()
      .eq('bot_id', botId).eq('source', fileName);

    const { error: insertError } = await supabase.from('document_chunks').insert(
      chunks.map((content, idx) => ({ bot_id: botId, source: fileName, content, chunk_index: idx }))
    );

    if (insertError) throw insertError;

    return res.status(200).json({
      success: true,
      fileName,
      chunks: chunks.length,
      message: `✓ ${fileName} processed — ${chunks.length} knowledge chunks stored.`,
    });

  } catch (err) {
    console.error('[ingest] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

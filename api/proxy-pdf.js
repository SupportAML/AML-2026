/**
 * /api/proxy-pdf — Server-side proxy for PubMed Central PDFs.
 * PMC blocks iframe embedding via X-Frame-Options, so we fetch the PDF
 * server-side and stream it back to the client.
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'url query parameter is required' });
  }

  // Only allow proxying from PMC / NCBI domains
  try {
    const parsed = new URL(url);
    const allowed = ['www.ncbi.nlm.nih.gov', 'ncbi.nlm.nih.gov', 'ftp.ncbi.nlm.nih.gov'];
    if (!allowed.includes(parsed.hostname)) {
      return res.status(403).json({ error: 'Only PubMed Central URLs are allowed' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MedLegalResearchBot/1.0)',
        'Accept': 'application/pdf,*/*',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `PMC returned ${response.status}` });
    }

    const contentType = response.headers.get('content-type') || 'application/pdf';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache 24h

    // Stream the response body
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('proxy-pdf error:', error);
    return res.status(500).json({ error: 'Failed to fetch PDF' });
  }
}

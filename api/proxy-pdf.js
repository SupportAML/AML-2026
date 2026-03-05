/**
 * /api/proxy-pdf — Server-side proxy for PubMed Central PDFs.
 * PMC blocks iframe embedding via X-Frame-Options, so we fetch the PDF
 * server-side and stream it back to the client.
 *
 * PMC's /pdf/ endpoint sometimes returns an HTML landing page listing
 * individual PDF files instead of the actual PDF.  When that happens we
 * parse the HTML to find the real PDF link and follow it.
 */

const ALLOWED_HOSTS = ['www.ncbi.nlm.nih.gov', 'ncbi.nlm.nih.gov', 'ftp.ncbi.nlm.nih.gov'];

function isAllowedUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return ALLOWED_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

async function fetchWithPdfValidation(url) {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; MedLegalResearchBot/1.0)',
      'Accept': 'application/pdf,*/*',
    },
    redirect: 'follow',
  });

  if (!resp.ok) {
    throw new Error(`PMC returned ${resp.status}`);
  }

  const buffer = Buffer.from(await resp.arrayBuffer());
  const contentType = resp.headers.get('content-type') || '';

  // Check if the response is actually a PDF (magic bytes: %PDF)
  const isPdf = buffer.length > 4 && buffer.slice(0, 5).toString('ascii').startsWith('%PDF');

  return { buffer, contentType, isPdf };
}

/**
 * If PMC returned HTML instead of a PDF, try to extract the real PDF link.
 * PMC landing pages contain links like /pmc/articles/PMC.../pdf/main.pdf
 */
function extractPdfUrlFromHtml(html, baseUrl) {
  // Look for links to actual PDF files within the PMC article
  // Pattern: href="/pmc/articles/PMC.../pdf/something.pdf"
  const pdfLinkRegex = /href=["'](\/pmc\/articles\/PMC\d+\/pdf\/[^"']+\.pdf)["']/gi;
  const matches = [];
  let match;
  while ((match = pdfLinkRegex.exec(html)) !== null) {
    matches.push(match[1]);
  }

  if (matches.length > 0) {
    // Prefer the first .pdf link (usually the main article)
    return new URL(matches[0], baseUrl).href;
  }

  // Fallback: look for any direct PDF link on NCBI domain
  const genericPdfRegex = /href=["'](https?:\/\/[^"']*ncbi\.nlm\.nih\.gov[^"']*\.pdf)["']/gi;
  while ((match = genericPdfRegex.exec(html)) !== null) {
    return match[1];
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'url query parameter is required' });
  }

  if (!isAllowedUrl(url)) {
    return res.status(403).json({ error: 'Only PubMed Central URLs are allowed' });
  }

  try {
    let { buffer, contentType, isPdf } = await fetchWithPdfValidation(url);

    // If we got HTML instead of a PDF, try to extract the real PDF URL
    if (!isPdf) {
      const html = buffer.toString('utf-8');
      const realPdfUrl = extractPdfUrlFromHtml(html, url);

      if (realPdfUrl && isAllowedUrl(realPdfUrl)) {
        const retry = await fetchWithPdfValidation(realPdfUrl);
        if (retry.isPdf) {
          buffer = retry.buffer;
          contentType = retry.contentType;
          isPdf = true;
        }
      }

      if (!isPdf) {
        return res.status(422).json({
          error: 'PDF not available for inline preview. The article may only offer HTML full text.',
        });
      }
    }

    res.setHeader('Content-Type', contentType || 'application/pdf');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache 24h
    res.send(buffer);
  } catch (error) {
    console.error('proxy-pdf error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch PDF' });
  }
}

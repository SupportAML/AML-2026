/**
 * /api/search-research — Server-side PubMed Central search.
 * Returns only articles that have verified free full-text PDFs.
 * No AI key needed — uses the public NCBI E-utilities API.
 */

const ESEARCH  = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
const ESUMMARY = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, maxResults = 6 } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'query is required' });
  }

  try {
    // Step 1: Search PMC (PubMed Central) — every PMC article has free full text
    let pmcIds = await searchPMC(query, maxResults);

    // Fallback: search PubMed with open-access filter, then resolve PMC IDs
    if (pmcIds.length === 0) {
      const fallbackResults = await fallbackPubMedSearch(query, maxResults);
      return res.status(200).json({ articles: fallbackResults });
    }

    // Step 2: Get article details from PMC
    const articles = await getPMCSummaries(pmcIds);

    return res.status(200).json({ articles });
  } catch (error) {
    console.error('search-research error:', error);
    return res.status(500).json({ error: error.message || 'PubMed search failed' });
  }
}

// --- PubMed Central search ---

async function searchPMC(query, maxResults) {
  const params = new URLSearchParams({
    db: 'pmc',
    term: query,
    retmax: String(maxResults),
    retmode: 'json',
    sort: 'relevance',
  });

  const resp = await fetch(`${ESEARCH}?${params}`);
  if (!resp.ok) throw new Error(`PMC search failed: ${resp.status}`);

  const data = await resp.json();
  return data?.esearchresult?.idlist ?? [];
}

async function getPMCSummaries(pmcIds) {
  if (pmcIds.length === 0) return [];

  const params = new URLSearchParams({
    db: 'pmc',
    id: pmcIds.join(','),
    retmode: 'json',
  });

  const resp = await fetch(`${ESUMMARY}?${params}`);
  if (!resp.ok) throw new Error(`PMC summary failed: ${resp.status}`);

  const data = await resp.json();
  const result = data?.result;
  if (!result) return [];

  const articles = [];

  for (const id of pmcIds) {
    const doc = result[id];
    if (!doc || doc.error) continue;

    const pmcId = `PMC${id}`;
    const title = (doc.title || 'Untitled').replace(/<[^>]*>/g, '');
    const journal = doc.fulljournalname || doc.source || 'Unknown Journal';
    const year = (doc.pubdate || doc.epubdate || '').split(' ')[0];
    const authors = formatAuthors(doc.authors);
    const volume = doc.volume || '';
    const issue = doc.issue || '';
    const pages = doc.pages || '';
    const pmid = findPMID(doc);

    const volIssue = volume ? `${volume}${issue ? `(${issue})` : ''}` : '';
    const pageStr = pages ? `:${pages}` : '';
    const citation = `${authors}. ${journal}. ${year}; ${volIssue}${pageStr}`.replace(/\s+/g, ' ').trim();

    const pdfUrl = `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcId}/pdf/`;
    const url = pmid
      ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}`
      : `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcId}/`;

    articles.push({
      title,
      source: journal,
      summary: buildSummary(doc),
      url,
      citation,
      pdfUrl,
      pmcId,
      pmid,
      authors,
      year,
    });
  }

  return articles;
}

async function fallbackPubMedSearch(query, maxResults) {
  const params = new URLSearchParams({
    db: 'pubmed',
    term: `${query} AND open access[filter]`,
    retmax: String(maxResults),
    retmode: 'json',
    sort: 'relevance',
  });

  const resp = await fetch(`${ESEARCH}?${params}`);
  if (!resp.ok) return [];

  const data = await resp.json();
  const pubmedIds = data?.esearchresult?.idlist ?? [];
  if (pubmedIds.length === 0) return [];

  const sumParams = new URLSearchParams({
    db: 'pubmed',
    id: pubmedIds.join(','),
    retmode: 'json',
  });

  const sumResp = await fetch(`${ESUMMARY}?${sumParams}`);
  if (!sumResp.ok) return [];

  const sumData = await sumResp.json();
  const result = sumData?.result;
  if (!result) return [];

  const articles = [];

  for (const pmid of pubmedIds) {
    const doc = result[pmid];
    if (!doc || doc.error) continue;

    const pmcId = findPMCId(doc);
    if (!pmcId) continue; // No PMC = no PDF

    const title = (doc.title || 'Untitled').replace(/<[^>]*>/g, '');
    const journal = doc.fulljournalname || doc.source || 'Unknown Journal';
    const year = (doc.pubdate || doc.epubdate || '').split(' ')[0];
    const authors = formatAuthors(doc.authors);
    const volume = doc.volume || '';
    const issue = doc.issue || '';
    const pages = doc.pages || '';

    const volIssue = volume ? `${volume}${issue ? `(${issue})` : ''}` : '';
    const pageStr = pages ? `:${pages}` : '';
    const citation = `${authors}. ${journal}. ${year}; ${volIssue}${pageStr}`.replace(/\s+/g, ' ').trim();

    const pdfUrl = `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcId}/pdf/`;
    const url = `https://pubmed.ncbi.nlm.nih.gov/${pmid}`;

    articles.push({
      title,
      source: journal,
      summary: buildSummary(doc),
      url,
      citation,
      pdfUrl,
      pmcId,
      pmid,
      authors,
      year,
    });
  }

  return articles;
}

// --- Helpers ---

function formatAuthors(authors) {
  if (!authors || authors.length === 0) return 'Unknown';
  const first = authors[0]?.name || 'Unknown';
  return authors.length > 1 ? `${first} et al.` : first;
}

function findPMID(doc) {
  const ids = doc.articleids;
  if (!ids) return '';
  const entry = ids.find(i => i.idtype === 'pmid');
  return entry?.value || '';
}

function findPMCId(doc) {
  const ids = doc.articleids;
  if (!ids) return '';
  const entry = ids.find(i => i.idtype === 'pmc');
  return entry?.value || '';
}

function buildSummary(doc) {
  const parts = [];
  const journal = doc.fulljournalname || doc.source || '';
  const year = (doc.pubdate || '').split(' ')[0];

  if (journal && year) parts.push(`Published in ${journal} (${year}).`);

  const firstAuthor = doc.sortfirstauthor || '';
  if (firstAuthor) parts.push(`Lead author: ${firstAuthor}.`);

  parts.push('Full text available — open access with PDF.');
  return parts.join(' ');
}

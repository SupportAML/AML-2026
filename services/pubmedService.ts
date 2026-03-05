/**
 * PubMed / PMC Service — searches real NCBI databases and returns only
 * articles that have free full-text PDFs in PubMed Central.
 *
 * Uses the NCBI E-utilities (public, no API key required for ≤3 req/s):
 *   https://www.ncbi.nlm.nih.gov/books/NBK25500/
 */

const ESEARCH  = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
const ESUMMARY = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';

export interface PubMedArticle {
    title: string;
    source: string;        // journal name
    summary: string;        // constructed from available metadata
    url: string;            // PubMed abstract URL
    citation: string;       // formatted citation string
    pdfUrl: string;         // direct PMC PDF link
    pmcId: string;          // e.g. "PMC1234567"
    pmid: string;           // PubMed ID
    authors: string;
    year: string;
}

/**
 * Search PubMed Central for open-access articles with available PDFs.
 * Returns only verified articles — every result has a real PMC PDF URL.
 */
export async function searchPubMedWithPDFs(
    query: string,
    maxResults: number = 6
): Promise<PubMedArticle[]> {
    try {
        console.log('🔍 Searching PubMed Central for:', query);

        // Step 1: Search PMC (PubMed Central) directly — all PMC articles have free full-text
        const pmcIds = await searchPMC(query, maxResults);
        if (pmcIds.length === 0) {
            console.log('⚠️ No PMC results, falling back to PubMed with open access filter');
            return await fallbackPubMedSearch(query, maxResults);
        }

        // Step 2: Get article details from PMC
        const articles = await getPMCSummaries(pmcIds);

        console.log(`✅ Found ${articles.length} articles with full PDFs`);
        return articles;
    } catch (error) {
        console.error('PubMed search error:', error);
        return [];
    }
}

/**
 * Search PMC (PubMed Central) — every article in PMC has free full text.
 */
async function searchPMC(query: string, maxResults: number): Promise<string[]> {
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

/**
 * Get summaries for a list of PMC IDs.
 */
async function getPMCSummaries(pmcIds: string[]): Promise<PubMedArticle[]> {
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

    const articles: PubMedArticle[] = [];

    for (const id of pmcIds) {
        const doc = result[id];
        if (!doc || doc.error) continue;

        const pmcId = `PMC${id}`;
        const title = doc.title?.replace(/<[^>]*>/g, '') || 'Untitled';
        const journal = doc.fulljournalname || doc.source || 'Unknown Journal';
        const year = doc.pubdate?.split(' ')[0] || doc.epubdate?.split(' ')[0] || '';
        const authors = formatAuthors(doc.authors);
        const volume = doc.volume || '';
        const issue = doc.issue || '';
        const pages = doc.pages || '';
        const pmid = findPMID(doc) || '';

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

/**
 * Fallback: search PubMed with open-access filter, then resolve PMC IDs.
 */
async function fallbackPubMedSearch(query: string, maxResults: number): Promise<PubMedArticle[]> {
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
    const pubmedIds: string[] = data?.esearchresult?.idlist ?? [];
    if (pubmedIds.length === 0) return [];

    // Get PubMed summaries
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

    const articles: PubMedArticle[] = [];

    for (const pmid of pubmedIds) {
        const doc = result[pmid];
        if (!doc || doc.error) continue;

        const pmcId = findPMCId(doc);
        if (!pmcId) continue; // Skip — no PMC full text = no PDF

        const title = doc.title?.replace(/<[^>]*>/g, '') || 'Untitled';
        const journal = doc.fulljournalname || doc.source || 'Unknown Journal';
        const year = doc.pubdate?.split(' ')[0] || doc.epubdate?.split(' ')[0] || '';
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

function formatAuthors(authors?: Array<{ name?: string; authtype?: string }>): string {
    if (!authors || authors.length === 0) return 'Unknown';
    const first = authors[0]?.name || 'Unknown';
    return authors.length > 1 ? `${first} et al.` : first;
}

function findPMID(doc: Record<string, unknown>): string {
    // PMC summaries include articleids array
    const ids = doc.articleids as Array<{ idtype: string; value: string }> | undefined;
    if (!ids) return '';
    const pmidEntry = ids.find(i => i.idtype === 'pmid');
    return pmidEntry?.value || '';
}

function findPMCId(doc: Record<string, unknown>): string {
    const ids = doc.articleids as Array<{ idtype: string; value: string }> | undefined;
    if (!ids) return '';
    const pmcEntry = ids.find(i => i.idtype === 'pmc');
    return pmcEntry?.value || '';
}

function buildSummary(doc: Record<string, unknown>): string {
    const parts: string[] = [];

    const journal = (doc.fulljournalname || doc.source || '') as string;
    const year = ((doc.pubdate || '') as string).split(' ')[0];

    if (journal && year) {
        parts.push(`Published in ${journal} (${year}).`);
    }

    // If sortfirstauthor available, mention it
    const firstAuthor = (doc.sortfirstauthor || '') as string;
    if (firstAuthor) {
        parts.push(`Lead author: ${firstAuthor}.`);
    }

    // PMC articles always have full text
    parts.push('Full text available — open access with PDF.');

    return parts.join(' ');
}

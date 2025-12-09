import './common.css';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // added

const Home = () => {
  const [urlInput, setUrlInput] = useState('');
  const [submitStatus, setSubmitStatus] = useState({ loading: false, success: null, error: null });
  const [readyToAnalyze, setReadyToAnalyze] = useState(false); // added
  const [analyzing, setAnalyzing] = useState(false); // added earlier
  const [analysisStage, setAnalysisStage] = useState(null); // added
  const navigate = useNavigate(); // added

  const recommendedUrls = [
    'https://techcommunity.microsoft.com/',
    'https://adoption.microsoft.com/en-us/microsoft-global-community-initiative/',
    'https://feedbackportal.microsoft.com/feedback/forum/f9bcd76b-51a7-ed11-aad0-000d3a1f4287',
    'https://feedbackportal.microsoft.com/feedback/forum/35b8eb89-b9c6-ee11-9079-00224827362a',
    'https://feedbackportal.microsoft.com/feedback/forum/2e2b445a-bc38-ef11-a316-000d3a13b945',
    'https://techcommunity.microsoft.com/category/azure-ai-foundry',
    'https://techcommunity.microsoft.com/category/azuredatabases',
    'https://techcommunity.microsoft.com/category/educationsector',
    'https://techcommunity.microsoft.com/category/microsoft365copilot',
    'https://techcommunity.microsoft.com/category/microsoftcopilotforfinance',
    'https://techcommunity.microsoft.com/category/microsoft365copilot',
    'https://techcommunity.microsoft.com/category/microsoft-copilot-service',
    'https://techcommunity.microsoft.com/category/microsoft-learn-for-educators',
    'https://adoption.microsoft.com/en-us/microsoft-global-community-initiative/'
  ];

  const appendRecommended = (url) => {
    setUrlInput(prev => {
      const list = prev.split(/\s+/).filter(Boolean);
      if (list.includes(url)) return prev; // avoid duplicates
      const sep = (!prev || prev.endsWith('\n')) ? '' : '\n';
      return prev + sep + url + '\n';
    });
    setReadyToAnalyze(false); // reset if modifying list post-submit
  };

  const addAllRecommended = () => {
    setUrlInput(prev => {
      const current = prev.split(/\s+/).filter(Boolean);
      const toAdd = recommendedUrls.filter(u => !current.includes(u));
      if (!toAdd.length) return prev;
      const suffix = prev && !prev.endsWith('\n') ? '\n' : '';
      return prev + suffix + toAdd.join('\n') + '\n';
    });
    setReadyToAnalyze(false); // reset
  };

  const API_URL = 'https://vocsentimentapi.azurewebsites.net/api/urls'; // added (no trailing slash)
  const SCRAPE_API = 'http://localhost:5103/api/urls/scrape'; // added
  const CREATE_INDEX_API = 'http://localhost:5103/api/search/create-index'; // added
  const INGEST_LATEST_API = 'http://localhost:5103/api/search/ingest-latest'; // added

  // POST only occurs when the user clicks the Submit button (form submit); chips never trigger network calls.
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitStatus.loading) return; // guard against rapid double clicks
    const urls = Array.from(new Set(urlInput.split(/\s+/).filter(Boolean))); // dedupe
    if (!urls.length) return;
    setSubmitStatus({ loading: true, success: null, error: null });
    try {
      // Body must use property "Urls" (capital U) as required by backend
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Urls: urls })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSubmitStatus({ loading: false, success: `Submitted ${urls.length} URL(s).`, error: null });
      setReadyToAnalyze(true); // enable Start Analysis phase + disable other controls
    } catch (err) {
      console.error('URL submit failed:', err); // added
      setSubmitStatus({ loading: false, success: null, error: err.message || 'Submit failed' });
      setReadyToAnalyze(false);
    }
  };

  // Updated: robust step-driven pipeline ensuring ingest always attempted
  const handleStartAnalysis = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    setAnalysisStage('scrape');
    try {
      // Scrape
      const res1 = await fetch(SCRAPE_API, { method: 'GET' });
      if (!res1.ok) throw new Error(`Scrape failed: HTTP ${res1.status}`);

      // Create Index
      setAnalysisStage('createIndex');
      const res2 = await fetch(CREATE_INDEX_API, { method: 'POST' });
      if (!res2.ok) throw new Error(`Create index failed: HTTP ${res2.status}`);

      // Ingest Latest
      setAnalysisStage('ingest');
      const res3 = await fetch(INGEST_LATEST_API, { method: 'POST' });
      if (!res3.ok) throw new Error(`Ingest latest failed: HTTP ${res3.status}`);

      setAnalysisStage('done');

      // Delay redirect a bit so user sees completed pipeline
      setTimeout(() => navigate('/analysis'), 1000);
    } catch (err) {
      console.error('Analysis sequence failed:', err);
      setAnalysisStage('error');
    } finally {
      setAnalyzing(false);
    }
  };

  // Progress calculation (added earlier)
  const stageOrder = ['scrape', 'createIndex', 'ingest', 'done'];
  const currentIndex = stageOrder.indexOf(analysisStage ?? '');
  const progressPercent = currentIndex < 0 ? 0 : (currentIndex / (stageOrder.length - 1)) * 100;

  // FIX: define urlsCount (was missing causing no-undef)
  const urlsCount = urlInput.trim()
    ? urlInput.split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <main className="voc-home" aria-label="Voice of Customer for Microsoft Skilling">
      {/* <style>{mintLikeStyles}</style> removed; styles now in common.css */}

      {/* Billboard Hero */}
      <header className="voc-billboard" role="banner">
        <div className="voc-hero-shell">
          <h1 className="voc-hero-headline">
            Voice of Customer Sentiment. <br /> Actionable Signals. Faster Impact.
          </h1>
            <p className="voc-hero-sub">
              Centralize community & feedback sources, extract sentiment and friction patterns,
              and accelerate data‑driven content improvements.
            </p>
          <div style={{display:'flex', gap:'0.75rem', flexWrap:'wrap'}}>
            <button
              type="button"
              className="voc-cta-primary"
              onClick={addAllRecommended}
              disabled={recommendedUrls.every(u => urlInput.includes(u))}
            >
              Quick Start: Add Recommended
            </button>
            <button
              type="button"
              className="voc-btn-analyze-now"
              onClick={() => navigate('/analysis')}
            >
              Analyse Now
            </button>
          </div>
        </div>
      </header>

      {/* Features + Submission */}
      <section className="voc-feature-band" aria-label="Capabilities and submission">
        <div className="voc-feature-grid">
          {/* Feature Cards */}
          <article className="voc-feature-card" aria-labelledby="feat-ingest-h">
            <div className="voc-feature-eyebrow">Pipeline</div>
            <h3 id="feat-ingest-h">Smart Ingestion</h3>
            <p>Deduplicated URL queue with async crawl + text extraction keeps your signal stream clean.</p>
          </article>
          <article className="voc-feature-card" aria-labelledby="feat-sentiment-h">
            <div className="voc-feature-eyebrow">Analytics</div>
            <h3 id="feat-sentiment-h">Multi‑Model Sentiment</h3>
            <p>Blended scoring surfaces early friction themes and opportunity trends across sources.</p>
          </article>
          <article className="voc-feature-card" aria-labelledby="feat-roadmap-h">
            <div className="voc-feature-eyebrow">Roadmap</div>
            <h3 id="feat-roadmap-h">Insights Roadmap</h3>
            <p>Topic clustering, longitudinal dashboards and export APIs coming to extend visibility.</p>
          </article>

          {/* Submission Panel (original logic preserved) */}
          <div className="voc-submit-panel">
            {/* ...existing heading & description replaced stylistically... */}
            <h2 className="voc-submit-title">Submit URLs for Sentiment Analysis</h2>
            <p className="voc-submit-desc">
              Paste or click recommended sources. Each URL is queued then processed asynchronously for sentiment & friction highlights.
            </p>

            {/* ...existing recommended block... */}
            <div className="voc-rec-block">
              <div className="voc-subheading-label">Recommended URLs</div>
              <div className="voc-chip-row">
                <button
                  type="button"
                  onClick={addAllRecommended}
                  disabled={readyToAnalyze || recommendedUrls.every(u => urlInput.includes(u))}
                  className="voc-chip-addall"
                >
                  Add All
                </button>
                {recommendedUrls.map((u, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => appendRecommended(u)}
                    className="voc-url-chip"
                    disabled={readyToAnalyze}
                  >
                    {u.replace('https://', '').replace(/\/$/, '')}
                  </button>
                ))}
              </div>
            </div>

            {/* ...existing form... */}
            <form onSubmit={handleSubmit} className="voc-url-form">
              <textarea
                rows={10}
                placeholder="Enter one URL per line or use the chips above..."
                value={urlInput}
                onChange={(e) => { if (readyToAnalyze) setReadyToAnalyze(false); setUrlInput(e.target.value); }}
                className="voc-url-textarea"
                disabled={submitStatus.loading || readyToAnalyze} // added
              />
              <div className="voc-form-actions">
                <button
                  type="submit"
                  className="voc-action-btn voc-action-btn--primary voc-submit-btn voc-btn-submit"
                  disabled={readyToAnalyze || submitStatus.loading || !urlsCount}
                >
                  {submitStatus.loading ? 'Submitting...' : `Submit (${urlsCount})`}
                </button>
                {readyToAnalyze && (
                  <button
                    type="button"
                    className="voc-action-btn voc-action-btn--primary voc-btn-analyze"
                    onClick={handleStartAnalysis}
                    disabled={analyzing}
                  >
                    {analyzing
                      ? (analysisStage === 'scrape'
                          ? 'Scraping...'
                          : analysisStage === 'createIndex'
                            ? 'Creating Index...'
                            : analysisStage === 'ingest'
                              ? 'Ingesting Content...'
                              : analysisStage === 'done'
                                ? 'Done'
                                : 'Working...')
                      : 'Start Analysis'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setUrlInput('');
                    setSubmitStatus({ loading: false, success: null, error: null });
                    setReadyToAnalyze(false);
                    setAnalysisStage(null); // reset stage
                  }}
                  className="voc-action-btn voc-action-btn--alt voc-clear-btn voc-btn-clear"
                  disabled={readyToAnalyze || (!urlInput && !readyToAnalyze)}
                >
                  Clear
                </button>
                {submitStatus.success && <span className="voc-delta voc-delta--up voc-fw-600">{submitStatus.success}</span>}
                {submitStatus.error && <span className="voc-delta voc-delta--down">{submitStatus.error}</span>}
              </div>
              <div className="voc-form-footer">
                <span>
                  {readyToAnalyze
                    ? 'Submission complete'
                    : (urlsCount ? `${urlsCount} URL${urlsCount > 1 ? 's' : ''} ready` : 'No URLs yet')}
                </span>
                <span>
                  {readyToAnalyze
                    ? (analyzing
                        ? (analysisStage === 'done'
                            ? 'Complete'
                            : (analysisStage === 'error' ? 'Error' : (analysisStage || 'Starting')))
                        : 'Ready to analyze')
                    : 'Async queue'}
                </span>
              </div>

              {/* Pipeline progress block (added) */}
              {readyToAnalyze && (analyzing || ['done','error'].includes(analysisStage || '')) && (
                <div className="voc-analysis-wrap" role="status" aria-live="polite">
                  <div className="voc-linear-track">
                    <div
                      className="voc-linear-bar"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <ol className="voc-pipeline">
                    {['scrape','createIndex','ingest'].map((st, i) => {
                      const isDone = stageOrder.indexOf(analysisStage || '') > stageOrder.indexOf(st);
                      const isActive = analysisStage === st;
                      const isError = analysisStage === 'error';
                      return (
                        <li
                          key={st}
                          className={
                            'voc-pipeline-step ' +
                            (isError && isActive ? 'voc-pipeline-step--error ' : '') +
                            (isActive ? 'voc-pipeline-step--active ' : '') +
                            (isDone ? 'voc-pipeline-step--done ' : '')
                          }
                        >
                          <div className="voc_step-node">
                            {isDone ? '✓' : isError && isActive ? '!' : i + 1}
                          </div>
                          <span className="voc-step-label">
                            {st === 'scrape' ? 'Scrape'
                              : st === 'createIndex' ? 'Index'
                              : 'Ingest'}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                  <div className={
                    'voc-pipeline-status ' +
                    (analysisStage === 'error' ? 'voc-pipeline-status--error' : '')
                  }>
                    <span>
                      {analysisStage === 'scrape' && 'Scraping URLs'}
                      {analysisStage === 'createIndex' && 'Creating Index'}
                      {analysisStage === 'ingest' && 'Ingesting Content'}
                      {analysisStage === 'done' && 'Complete'}
                      {analysisStage === 'error' && 'Error'}
                    </span>
                    <span>
                      {analysisStage === 'done'
                        ? 'Redirecting...'
                        : `${Math.round(progressPercent)}%`}
                    </span>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Home;
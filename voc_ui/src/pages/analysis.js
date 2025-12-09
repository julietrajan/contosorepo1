import './common.css';
import React, { useState, useEffect, useRef } from 'react';

const Analysis = () => {
  const [view, setView] = useState('overall'); // 'overall' | 'chat' | 'research'
  const [overallData, setOverallData] = useState(null);
  const [overallLoading, setOverallLoading] = useState(false);
  const [overallError, setOverallError] = useState(null);

  const fetchOverall = async (force = false) => {
    if (overallLoading) return;
    if (!force && overallData) return;
    setOverallError(null);
    setOverallLoading(true);
    try {
      const res = await fetch('https://vocsentimentapi.azurewebsites.net/api/Gpt/overall', {
        method: 'GET',
        headers: { Accept: 'application/json' }
      });
      if (!res.ok) throw new Error('Request failed: ' + res.status);
      const json = await res.json();
      setOverallData(json);
    } catch (e) {
      setOverallError(e.message || 'Unknown error');
    } finally {
      setOverallLoading(false);
    }
  };

  const handleSelectOverall = () => {
    setView('overall');
    fetchOverall();
  };

  const renderSentimentBars = (dist) => {
    const total = Object.values(dist).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0) || 1;
    return (
      <div className="voc-sentiment-block">
        <div className="voc-sentiment-bar">
          {Object.entries(dist).map(([k, v]) => {
            const pct = total ? (v / total) * 100 : 0;
            const colorClass = `voc-sentiment-${k}`;
            return (
              <div
                key={k}
                className={`voc-sentiment-seg ${colorClass}`}
                style={{ width: pct + '%' }}
                title={`${k}: ${v} (${pct.toFixed(1)}%)`}
              >
                {pct > 12 && k}
              </div>
            );
          })}
        </div>
        <ul className="voc-sentiment-legend">
          {Object.entries(dist).map(([k, v]) => {
            const pct = total ? (v / total) * 100 : 0;
            return (
              <li key={k}><strong>{k}</strong>: {pct.toFixed(1)}%</li>
            );
          })}
        </ul>
      </div>
    );
  };

  const renderMetricChips = (data) => {
    const skip = new Set(['sentimentDistribution','topThemes','frictionCategories','periodDelta']);
    const numericEntries = Object.entries(data).filter(
      ([k,v]) => !skip.has(k) && (typeof v === 'number')
    );
    if (!numericEntries.length) return null;
    return (
      <section className="voc-metrics">
        <h3 className="voc-section-title">Metrics Overview</h3>
        <div className="voc-metric-chip-wrap">
          {numericEntries.map(([k,v])=>(
            <div key={k} className="voc-metric-chip">
              <strong className="voc-metric-label">{k}</strong>: {v.toLocaleString()}
            </div>
          ))}
        </div>
      </section>
    );
  };

  const renderIndividualSections = (data) => {
    const skip = new Set([
      'sentimentDistribution',
      'topThemes',
      'frictionCategories',
      'periodDelta',
      'reportPrompt',
      'context',
      'reportMarkdown'
    ]);
    const keys = Object.keys(data).filter(k => !skip.has(k) && typeof data[k] !== 'number');

    const getSectionColor = (key) => {
      const map = {
        meta: 'meta',
        insights: 'insights',
        strengths: 'strengths',
        weaknesses: 'weaknesses'
      };
      for (const k of Object.keys(map)) {
        if (key.toLowerCase().includes(k)) return map[k];
      }
      return 'default';
    };

    return keys.map(key => {
      const value = data[key];
      const heading = key.replace(/([A-Z])/g, ' $1').trim()
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      const tone = getSectionColor(key);
      const baseCls = `voc-json-section tone-${tone}`;

      if (key === 'meta' && value && typeof value === 'object') {
        return (
          <section key={key} className={baseCls}>
            <div className="voc-json-head"><h3>{heading}</h3></div>
            <div className="voc-json-body">
              <div className="voc-meta-grid">
                {Object.entries(value).map(([mk, mv]) => (
                  <div key={mk} className="voc-meta-row">
                    <span className="voc-meta-key">{mk}:</span>
                    <span className="voc-meta-val">{Array.isArray(mv) ? mv.join(', ') : String(mv)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      }

      if (Array.isArray(value)) {
        const formatObj = (obj) => {
          if (!obj || typeof obj !== 'object') return String(obj);
          // Sentiment style objects
          if ('text' in obj && 'explanation' in obj) {
            const metaBits = [];
            if (obj.category) metaBits.push(obj.category);
            if (obj.impact) metaBits.push(`Impact: ${obj.impact}`);
            if (typeof obj.confidence === 'number') metaBits.push(`Conf: ${(obj.confidence * 100).toFixed(0)}%`);
            const meta = metaBits.length ? <span className="voc-item-meta"> ({metaBits.join(' · ')})</span> : null;
            return <span>&quot;{obj.text}&quot; — {obj.explanation}{meta}</span>;
          }
          // Recommendation extended objects
          if ('action' in obj && 'rationale' in obj) {
            const details = [];
            if (obj.priority) details.push(`Priority: ${obj.priority}`);
            if (obj.effort) details.push(`Effort: ${obj.effort}`);
            if (obj.owner) details.push(`Owner: ${obj.owner}`);
            const metrics = Array.isArray(obj.successMetrics) && obj.successMetrics.length
              ? <div className="voc-subline">Metrics: {obj.successMetrics.join(', ')}</div>
              : null;
            return (
              <div className="voc-rec-item">
                <div className="voc-line-main"><strong>{obj.action}</strong> — {obj.rationale}</div>
                {(details.length > 0) && <div className="voc-subline">{details.join(' | ')}</div>}
                {metrics}
              </div>
            );
          }
          return JSON.stringify(obj);
        };
        return (
          <section key={key} className={baseCls}>
            <div className="voc-json-head"><h3>{heading}</h3></div>
            <div className="voc-json-body">
              <ul className="voc-list">
                {value.map((item,i)=>(
                  <li key={i} className="voc-list-item">
                    {formatObj(item)}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        );
      }

      if (value && typeof value === 'object') {
        return (
          <section key={key} className={baseCls}>
            <div className="voc-json-head"><h3>{heading}</h3></div>
            <div className="voc-json-body">
              <ul className="voc-list">
                {Object.entries(value).map(([ik,iv])=>(
                  <li key={ik} className="voc-list-item">
                    <strong>{ik}:</strong> {typeof iv === 'object' ? JSON.stringify(iv) : String(iv)}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        );
      }

      if (typeof value === 'string') {
        return (
          <section key={key} className={baseCls}>
            <div className="voc-json-head"><h3>{heading}</h3></div>
            <div className="voc-json-body">
              <div className="voc-text-block">{value}</div>
            </div>
          </section>
        );
      }
      return null;
    });
  };

  // NEW chat state
  const [threadId, setThreadId] = useState(null); // Azure Agents thread id
  const [chatMessages, setChatMessages] = useState([]); // {id, role, text, createdAt, sources}
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [chatEnded, setChatEnded] = useState(false);
  const chatEndRef = useRef(null);

  // NEW auto scroll
  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  // NEW auto-resize textarea ref
  const chatInputRef = useRef(null);

  // NEW auto-resize handler
  const autoSize = () => {
    if (!chatInputRef.current) return;
    const el = chatInputRef.current;
    el.style.height = '0px';
    const newH = Math.min(240, el.scrollHeight);
    el.style.height = newH + 'px';
  };

  useEffect(autoSize, [chatInput]);

  // Chat API endpoint
  const CHAT_ENDPOINT = 'https://vocsentimentapi.azurewebsites.net/api/chat';

  // Send chat message via unified endpoint (creates or continues thread)
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    setChatError(null);
    setChatLoading(true);
    try {
      const res = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ message: chatInput.trim(), threadId: threadId })
      });
      if (!res.ok) throw new Error('Chat request failed: ' + res.status);
      const json = await res.json();
      if (json.threadId && json.threadId !== threadId) setThreadId(json.threadId);
      const msgs = (json.messages || []).map(m => ({
        id: m.id,
        role: m.role,
        text: m.text,
        createdAt: m.createdAt,
        sources: m.sources || null
      }));
      setChatMessages(msgs);
      // capture sources from last assistant message for sidebar style display (optional)
  // (Optional) Could derive sources inline per message now; no separate state needed.
      setChatInput('');
      requestAnimationFrame(autoSize);
    } catch (e) {
      setChatError(e.message || 'Chat error');
    } finally {
      setChatLoading(false);
    }
  };

  // NEW start / end handlers
  const startNewChat = () => {
    setChatEnded(false);
    setThreadId(null);
    setChatMessages([]);
    setChatInput('');
  };
  const endChat = () => {
    setChatEnded(true);
    setChatInput('');
  };

  // OPTIONAL: when user sends while ended → restart automatically
  const safeSend = () => {
    if (chatEnded) startNewChat();
    sendChat();
  };

  // New: external research app URL
  const RESEARCH_EMBED_URL = 'https://app-pdt223-qaipe.azurewebsites.net/';

  return (
    <main className="voc-home voc-analysis-bg" aria-label="Analysis">
      <section className="voc-analysis-shell">
        <header className="voc-header">
          <div className="voc-header-top">
            <h1 className="voc-title">Voice of Customer Analysis</h1>
        {/*   <a
              href="/"
              className="voc-back-home-btn"
              aria-label="Back to Home"
            >
              <span role="img" aria-hidden="true">🏠</span>
              <span>Home</span>
            </a>  */}
          </div>
          <p className="voc-subtitle">
            Explore aggregated sentiment, discover themes and friction points, and drill into derived metrics.
          </p>
        </header>

        <div
          role="tablist"
          aria-label="Analysis Mode"
          className="voc-tab-bar"
        >
          <button
            role="tab"
            aria-selected={view === 'overall'}
            onClick={handleSelectOverall}
            className={`voc-tab-btn ${view === 'overall' ? 'active' : ''}`}
            disabled={view === 'overall' && overallLoading}
          >
            Overall Analysis
          </button>
          <button
            role="tab"
            aria-selected={view === 'chat'}
            onClick={() => { setView('chat'); }}
            className={`voc-tab-btn ${view === 'chat' ? 'active' : ''}`}
            disabled={view === 'chat'}
          >
            Chat with Agent
          </button>
          <button
            role="tab"
            aria-selected={view === 'research'}
            onClick={() => setView('research')}
            className={`voc-tab-btn ${view === 'research' ? 'active' : ''}`}
            disabled={view === 'research'}
          >
            Deep Research with Web
          </button>
        </div>

        {view === 'overall' && (
          <div role="tabpanel" aria-label="Overall Analysis" className="voc-analysis-card">
            <div className="voc-card-head">
              <h2 className="voc-card-title">Overall Analysis</h2>
              <button
                onClick={() => fetchOverall(true)}
                disabled={overallLoading}
                className="voc-refresh-btn"
                aria-label="Refresh overall analysis"
              >
                {overallLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {!overallData && !overallLoading && !overallError && (
              <p className="voc-empty-msg">
                Data not loaded yet. Click Refresh if it does not load automatically.
              </p>
            )}
            {overallLoading && (
              <p className="voc-loading-msg">Loading overall analysis...</p>
            )}
            {overallError && (
              <p className="voc-error-msg">
                Error: {overallError}
              </p>
            )}

            {overallData && !overallLoading && (
              <div className="voc-results">
                {/* Sentiment Summary (new simplified schema) */}
                {(overallData.PositiveSentiments || overallData.NegativeSentiments) && (
                  <section className="voc-section">
                    <h3 className="voc-section-title">Sentiment Summary</h3>
                    <div className="voc-sent-summary">
                      {overallData.PositiveSentiments && overallData.PositiveSentiments.length > 0 && (
                        <div className="voc-sent-block">
                          <h4 className="voc-sent-heading">🔹 Positive Sentiments</h4>
                          <ul className="voc-list">
                            {overallData.PositiveSentiments.map((p,i)=>(
                              <li key={i} className="voc-list-item">&quot;{p.Text}&quot; — {p.Explanation}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {overallData.NegativeSentiments && overallData.NegativeSentiments.length > 0 && (
                        <div className="voc-sent-block">
                          <h4 className="voc-sent-heading">🔸 Negative Sentiments</h4>
                          <ul className="voc-list">
                            {overallData.NegativeSentiments.map((n,i)=>(
                              <li key={i} className="voc-list-item">&quot;{n.Text}&quot; — {n.Explanation}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {overallData.Recommendations && overallData.Recommendations.length > 0 && (
                        <div className="voc-sent-block">
                          <h4 className="voc-sent-heading">✅ Recommendations</h4>
                          <ul className="voc-list">
                            {overallData.Recommendations.map((r,i)=>(
                              <li key={i} className="voc-list-item">{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </section>
                )}
                {overallData.sentimentDistribution && (
                  <section className="voc-section">
                    <h3 className="voc-section-title">Sentiment</h3>
                    {renderSentimentBars(overallData.sentimentDistribution)}
                  </section>
                )}

                {overallData.topThemes && Array.isArray(overallData.topThemes) && (
                  <section className="voc-section">
                    <h3 className="voc-section-title">Themes</h3>
                    <ul className="voc-theme-columns">
                      {overallData.topThemes.map((t,i)=>(
                        <li key={i} className="voc-theme-item">
                          {typeof t === 'string' ? t : JSON.stringify(t)}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {overallData.frictionCategories && (
                  <section className="voc-section">
                    <h3 className="voc-section-title">Friction Categories</h3>
                    <ul className="voc-friction-grid">
                      {Object.entries(overallData.frictionCategories).map(([k,v])=>(
                        <li key={k} className="voc-friction-item">
                          <strong>{k}:</strong> {typeof v === 'number' ? v.toLocaleString() : String(v)}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {overallData.periodDelta && (
                  <section className="voc-section">
                    <h3 className="voc-section-title">Period Delta</h3>
                    <ul className="voc-delta-wrap">
                      {Object.entries(overallData.periodDelta).map(([k,v])=>(
                        <li key={k} className="voc-delta-chip">
                          <strong>{k}:</strong> {typeof v === 'number' ? v.toLocaleString() : String(v)}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {renderMetricChips(overallData)}
                {renderIndividualSections(overallData)}
              </div>
            )}
          </div>
        )}

        {view === 'chat' && (
          <div role="tabpanel" aria-label="Chat with Agent" className="voc-analysis-card voc-chat-panel">
            <div className="voc-convo-header">
              <div className="voc-convo-pills">
                <button
                  type="button"
                  className="voc-pill-btn"
                  onClick={startNewChat}
                  disabled={chatLoading}
                >
                  New Conversation
                </button>
                <button
                  type="button"
                  className="voc-pill-btn danger"
                  onClick={endChat}
                  disabled={chatLoading || chatEnded}
                >
                  End Conversation
                </button>
              </div>
              <div className="voc-session-tag">{threadId ? `Thread: ${threadId}` : 'No active thread'}</div>
            </div>

            <div
              className="voc-chat-window convo-v2"
              aria-live="polite"
              aria-busy={chatLoading ? 'true' : 'false'}
            >
              {chatMessages.length === 0 && !chatLoading && !chatError && !chatEnded && (
                <div className="voc-chat-empty-v2">
                  <p>Ask something to begin.</p>
                  <ul>
                    <li>What’s driving negative sentiment?</li>
                    <li>Summarize top themes.</li>
                    <li>Give improvement steps.</li>
                  </ul>
                </div>
              )}
              {chatEnded && (
                <div className="voc-chat-ended-banner">
                  Conversation ended. Start a new one to continue.
                </div>
              )}

              {chatMessages.map((m,i)=>{
                const agent = m.role === 'assistant';
                const roleLabel = agent ? 'Agent' : 'You';
                return (
                  <div key={m.id || i} className={`voc-bubble-row ${agent ? 'is-agent' : 'is-user'}`}>
                    <div className={`voc-bubble-shell ${agent ? 'agent' : 'user'}`}>
                      <div className="voc-bubble-roleline">
                        <span className="voc-bubble-role">{roleLabel}</span>
                        {m.createdAt && (
                          <time className="voc-bubble-time">
                            {new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                          </time>
                        )}
                      </div>
                      <div className="voc-bubble-text">
                        {m.text}
                        {agent && m.sources && m.sources.length > 0 && (
                          <div className="voc-sources-list">
                            <div className="voc-sources-label">Sources:</div>
                            <ul>
                              {m.sources.map((s,si)=>(
                                <li key={si}>
                                  {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.url}</a> : (s.label || 'source')}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {chatLoading && !chatEnded && (
                <div className="voc-bubble-row is-agent">
                  <div className="voc-bubble-shell agent thinking">
                    <div className="voc-bubble-roleline">
                      <span className="voc-bubble-role">Agent</span>
                      <span className="voc-bubble-time">…</span>
                    </div>
                    <div className="voc-bubble-text">
                      <span className="voc-dot pulse"></span>
                      <span className="voc-dot pulse delay1"></span>
                      <span className="voc-dot pulse delay2"></span>
                    </div>
                  </div>
                </div>
              )}

              {chatError && (
                <div className="voc-chat-error-banner">{chatError}</div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input composer */}
            <div className="voc-chat-input-shell">
              <form
                className={`voc-chat-composer flat v2 fullwidth ${chatEnded ? 'disabled' : ''}`}
                onSubmit={(e)=>{e.preventDefault(); if(!chatEnded) safeSend();}}
              >
                <textarea
                  ref={chatInputRef}
                  className="voc-chat-entry v2 fullwidth"
                  placeholder={chatEnded ? 'Conversation ended. Start a new conversation to continue…' : 'Type your response...'}
                  value={chatInput}
                  onChange={e=>setChatInput(e.target.value)}
                  onKeyDown={(e)=>{
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if(!chatEnded) safeSend();
                    }
                  }}
                  onInput={autoSize}
                  disabled={chatLoading || chatEnded}
                />
                <button
                  type="submit"
                  className="voc-send-btn v2 fw-pos"
                  disabled={chatLoading || !chatInput.trim() || chatEnded}
                >
                  {chatLoading ? 'Sending…' : 'Send'}
                </button>
              </form>
              <div className="voc-chat-hint-bar minimal v2">
                <span>{chatEnded ? 'Conversation is read‑only.' : 'Enter = send • Shift+Enter = newline'}</span>
              </div>
            </div>
          </div>
        )}

        {view === 'research' && (
          <div
            role="tabpanel"
            aria-label="Deep Research with Web"
            className="voc-analysis-card voc-research-panel"
          >
            <div className="voc-card-head">
              <h2 className="voc-card-title">Deep Research</h2>
            </div>
            <p className="voc-help-text">
              Embedded web research experience.
            </p>
            <div className="voc-research-embed-wrapper">
              <iframe
                src={RESEARCH_EMBED_URL}
                title="Deep Research with Web"
                className="voc-research-embed"
                loading="lazy"
                allow="clipboard-read; clipboard-write"
              />
            </div>
          </div>
        )}
      </section>
    </main>
  );
};

export default Analysis;
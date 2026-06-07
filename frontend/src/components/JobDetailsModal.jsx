import React, { useState } from 'react';
import { X, ExternalLink, ShieldCheck, AlertCircle, RefreshCw, CheckCircle } from 'lucide-react';

export default function JobDetailsModal({ job, onClose, apiBaseUrl, onUpdateJob }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

  // Parse JSON columns safely
  const matchingKeywords = job.ats_matching ? JSON.parse(job.ats_matching) : [];
  const missingKeywords = job.ats_missing ? JSON.parse(job.ats_missing) : [];
  const recommendations = job.ats_recommendations ? JSON.parse(job.ats_recommendations) : [];

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError('');
    
    try {
      const headers = { 'Content-Type': 'application/json' };

      const response = await fetch(`${apiBaseUrl}/api/winjobapplier/jobs/${job.id}/ats-analyze`, {
        method: 'POST',
        headers: headers
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'ATS analysis failed.');
      }

      // Notify parent to update jobs list state
      onUpdateJob(job.id, {
        ats_score: data.ats_score,
        ats_matching: data.ats_matching,
        ats_missing: data.ats_missing,
        ats_recommendations: data.ats_recommendations
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error occurred while contacting Google Gemini.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Color picker for score rings
  const getScoreColorClass = (score) => {
    if (score >= 80) return 'score-high';
    if (score >= 50) return 'score-med';
    return 'score-low';
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content glassmorphism">
        
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2>{job.title}</h2>
            <p className="modal-company">{job.company} • {job.location || 'Remote'}</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="modal-body">
          {error && (
            <div className="auth-alert auth-alert-error" style={{ marginBottom: '16px' }}>
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          <div className="modal-grid">
            
            {/* Left side: Job details & Description */}
            <div className="modal-left">
              <h3 className="section-subtitle">Job Description</h3>
              <div className="job-description-content">
                {job.description ? job.description : 'No description provided.'}
              </div>
              
              <div style={{ marginTop: '16px' }}>
                {job.url && (
                  <a href={job.url} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display: 'inline-flex', width: 'auto', textDecoration: 'none' }}>
                    <span>Open Apply Page</span>
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>

            {/* Right side: ATS Compatibility Scorecard */}
            <div className="modal-right">
              <div className="ats-scorecard-box">
                <div className="scorecard-header">
                  <ShieldCheck size={16} style={{ color: 'var(--primary-light)' }} />
                  <span>ATS Match Compatibility</span>
                </div>

                <div className="ats-gauge-container">
                  <div className={`ats-gauge ${getScoreColorClass(job.ats_score || 0)}`}>
                    <span className="gauge-number">{job.ats_score !== null && job.ats_score !== undefined ? `${job.ats_score}%` : '--'}</span>
                    <span className="gauge-label">Score</span>
                  </div>
                  
                  <button 
                    className="btn-secondary" 
                    onClick={handleAnalyze} 
                    disabled={analyzing}
                    style={{ width: '100%', marginTop: '14px', fontSize: '0.78rem' }}
                  >
                    {analyzing ? <RefreshCw size={12} className="spinner" /> : <ShieldCheck size={12} />}
                    <span>{analyzing ? 'Analyzing Alignment...' : job.ats_score ? 'Re-Analyze Resume' : 'Analyze Resume Compatibility'}</span>
                  </button>
                </div>

                {job.ats_score !== null && job.ats_score !== undefined && (
                  <div className="ats-details-results">
                    {/* Matching Keywords */}
                    <div className="keyword-section">
                      <h4>Matching Skills & Keywords</h4>
                      <div className="keywords-tags">
                        {matchingKeywords.length > 0 ? (
                          matchingKeywords.map((tag, idx) => (
                            <span key={idx} className="keyword-tag match">{tag}</span>
                          ))
                        ) : (
                          <span className="no-tags">No matching keywords detected.</span>
                        )}
                      </div>
                    </div>

                    {/* Missing Keywords */}
                    <div className="keyword-section" style={{ marginTop: '12px' }}>
                      <h4>Missing/ATS Required Keywords</h4>
                      <div className="keywords-tags">
                        {missingKeywords.length > 0 ? (
                          missingKeywords.map((tag, idx) => (
                            <span key={idx} className="keyword-tag miss">{tag}</span>
                          ))
                        ) : (
                          <span className="no-tags text-success">Excellent! No missing core keywords.</span>
                        )}
                      </div>
                    </div>

                    {/* AI Recommendations */}
                    <div className="keyword-section" style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                      <h4>Resume Tailoring Checklist</h4>
                      <ul className="recs-list">
                        {recommendations.map((rec, idx) => (
                          <li key={idx}>
                            <CheckCircle size={11} className="rec-icon" />
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

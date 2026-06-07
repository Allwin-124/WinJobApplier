import React, { useState, useEffect } from 'react';
import { 
  Briefcase, 
  Settings, 
  Terminal as TerminalIcon, 
  Search, 
  RefreshCw, 
  User, 
  Mail, 
  Phone, 
  FileText, 
  Globe, 
  Tag, 
  Play, 
  AlertCircle, 
  CheckCircle2, 
  MapPin, 
  Clock, 
  ExternalLink 
} from 'lucide-react';
import './App.css';

const GithubIcon = ({ size = 24, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

const API_BASE_URL = 'http://localhost:8000';

function App() {
  const [activeTab, setActiveTab] = useState('jobs');
  const [jobs, setJobs] = useState([]);
  const [settings, setSettings] = useState({
    name: '',
    email: '',
    phone: '',
    resume_path: '',
    github: '',
    portfolio: '',
    keywords: ''
  });
  
  // Loading states
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [scraperRunning, setScraperRunning] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  
  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Logs & Notification Toast
  const [logs, setLogs] = useState([
    'System initialized.',
    'Ready to scrape jobs or apply profile parameters.'
  ]);
  const [toast, setToast] = useState(null);

  // Auto-close Toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Fetch Jobs on Mount
  useEffect(() => {
    fetchJobs();
    fetchSettings();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const fetchJobs = async () => {
    setLoadingJobs(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/winjobapplier/jobs`);
      if (!response.ok) throw new Error('Failed to fetch jobs.');
      const data = await response.json();
      setJobs(data);
    } catch (error) {
      console.error(error);
      showToast('Error loading jobs from backend. Make sure the FastAPI server is running.', 'error');
    } finally {
      setLoadingJobs(false);
    }
  };

  const fetchSettings = async () => {
    setLoadingSettings(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/winjobapplier/settings`);
      if (!response.ok) throw new Error('Failed to fetch settings.');
      const data = await response.json();
      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error(error);
      // Don't show hard error here in case DB is not initialized yet
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleStatusChange = async (jobId, newStatus) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/winjobapplier/jobs/${jobId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!response.ok) throw new Error('Failed to update status.');
      
      // Update local state directly
      setJobs(prevJobs => 
        prevJobs.map(job => 
          job.id === jobId ? { ...job, status: newStatus } : job
        )
      );
      showToast(`Job status updated to ${newStatus}`);
    } catch (error) {
      console.error(error);
      showToast('Failed to update job status.', 'error');
    }
  };

  const handleResumeUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast('File size must be under 10MB.', 'error');
      return;
    }

    setUploadingResume(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/api/winjobapplier/settings/resume`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Upload failed.');
      }

      setSettings(data.settings);
      showToast('Resume uploaded successfully.');
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Failed to upload resume.', 'error');
    } finally {
      setUploadingResume(false);
    }
  };

  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/winjobapplier/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (!response.ok) throw new Error('Failed to save settings.');
      const data = await response.json();
      setSettings(data.settings);
      showToast('Profile settings saved successfully.');
    } catch (error) {
      console.error(error);
      showToast('Failed to save settings. Please verify inputs.', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const triggerScraper = async () => {
    setScraperRunning(true);
    const newLogs = [...logs, `\n> [${new Date().toLocaleTimeString()}] Executing scraper process...` ];
    setLogs(newLogs);
    showToast('Job scraper started...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/winjobapplier/scraper/trigger`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Scraper run failed.');
      }
      
      setLogs(prev => [
        ...prev,
        `> [${new Date().toLocaleTimeString()}] Scraper executed successfully.`,
        data.output || 'No output log returned.'
      ]);
      showToast('Job scraper completed successfully!');
      fetchJobs(); // reload jobs
    } catch (error) {
      console.error(error);
      setLogs(prev => [
        ...prev,
        `> [${new Date().toLocaleTimeString()}] Error: ${error.message}`
      ]);
      showToast(error.message, 'error');
    } finally {
      setScraperRunning(false);
    }
  };

  // Compute Stats
  const totalJobsCount = jobs.length;
  const pendingCount = jobs.filter(j => j.status?.toLowerCase() === 'pending').length;
  const appliedCount = jobs.filter(j => j.status?.toLowerCase() === 'applied').length;
  const interviewCount = jobs.filter(j => j.status?.toLowerCase() === 'interviewing').length;
  const offeredCount = jobs.filter(j => j.status?.toLowerCase() === 'offered').length;
  const rejectedCount = jobs.filter(j => j.status?.toLowerCase() === 'rejected').length;

  // Filter & Search Jobs
  const filteredJobs = jobs.filter(job => {
    const matchesSearch = 
      job.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.location?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'all' || 
      job.status?.toLowerCase() === statusFilter.toLowerCase();
      
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="app-container">
      {/* Sidebar navigation */}
      <aside className="sidebar">
        <div className="logo-container">
          <div className="logo-icon">W</div>
          <span className="logo-text">WinJobApplier</span>
        </div>
        
        <nav className="nav-menu">
          <button 
            className={`nav-item ${activeTab === 'jobs' ? 'active' : ''}`}
            onClick={() => setActiveTab('jobs')}
          >
            <Briefcase size={18} />
            <span>Job Board</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'scraper' ? 'active' : ''}`}
            onClick={() => setActiveTab('scraper')}
          >
            <TerminalIcon size={18} />
            <span>Scraper Console</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={18} />
            <span>Profile Settings</span>
          </button>
        </nav>
        
        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginBottom: '8px' }}>
            <span className={`status-dot ${scraperRunning ? 'active' : ''}`}></span>
            <span>{scraperRunning ? 'Scraper Running' : 'Scraper Idle'}</span>
          </div>
          v1.0.0
        </div>
      </aside>

      {/* Main View Area */}
      <main className="main-content">
        
        {/* Toast Notifier */}
        {toast && (
          <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
            {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
            <span>{toast.message}</span>
          </div>
        )}

        {/* Tab content rendering */}
        {activeTab === 'jobs' && (
          <div>
            <div className="view-header">
              <div className="header-title">
                <h1>Job Application Board</h1>
                <p>Track, manage, and transition your active job application pipelines</p>
              </div>
              <button className="btn-primary" onClick={fetchJobs} disabled={loadingJobs}>
                <RefreshCw size={16} className={loadingJobs ? 'spinner' : ''} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Metrics cards */}
            <div className="stats-grid">
              <div className="stat-card glassmorphism">
                <div className="stat-header">
                  <span>Total Jobs</span>
                  <div className="stat-icon-wrapper" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                    <Briefcase size={16} />
                  </div>
                </div>
                <div className="stat-value">{totalJobsCount}</div>
              </div>
              
              <div className="stat-card glassmorphism">
                <div className="stat-header">
                  <span>Applied</span>
                  <div className="stat-icon-wrapper" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                    <CheckCircle2 size={16} />
                  </div>
                </div>
                <div className="stat-value" style={{ color: '#3b82f6' }}>{appliedCount}</div>
              </div>

              <div className="stat-card glassmorphism">
                <div className="stat-header">
                  <span>Interviews</span>
                  <div className="stat-icon-wrapper" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
                    <Clock size={16} />
                  </div>
                </div>
                <div className="stat-value" style={{ color: '#a78bfa' }}>{interviewCount}</div>
              </div>

              <div className="stat-card glassmorphism">
                <div className="stat-header">
                  <span>Offers</span>
                  <div className="stat-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                    <CheckCircle2 size={16} />
                  </div>
                </div>
                <div className="stat-value" style={{ color: '#10b981' }}>{offeredCount}</div>
              </div>

              <div className="stat-card glassmorphism">
                <div className="stat-header">
                  <span>Rejections</span>
                  <div className="stat-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                    <AlertCircle size={16} />
                  </div>
                </div>
                <div className="stat-value" style={{ color: '#ef4444' }}>{rejectedCount}</div>
              </div>
            </div>

            {/* Filters */}
            <div className="filters-container">
              <div className="search-wrapper">
                <Search size={18} className="search-icon" />
                <input 
                  type="text" 
                  className="search-input" 
                  placeholder="Search jobs by title, company, or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <select 
                className="filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="applied">Applied</option>
                <option value="interviewing">Interviewing</option>
                <option value="offered">Offered</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Jobs card list */}
            {loadingJobs ? (
              <div className="empty-state">
                <RefreshCw size={40} className="spinner empty-state-icon" />
                <h3>Loading jobs...</h3>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="empty-state glassmorphism">
                <Briefcase size={48} className="empty-state-icon" />
                <h3>No jobs found</h3>
                <p>Try clearing filters, searching something else, or run the scraper to find jobs.</p>
              </div>
            ) : (
              <div className="jobs-grid">
                {filteredJobs.map(job => (
                  <div className="job-card glassmorphism" key={job.id}>
                    <div>
                      <div className="job-header">
                        <div className="job-info">
                          <h3>{job.title}</h3>
                          <div className="job-company">{job.company}</div>
                        </div>
                        <span className={`status-pill status-${job.status?.toLowerCase() || 'pending'}`}>
                          {job.status || 'Pending'}
                        </span>
                      </div>
                      
                      <div className="job-meta-row">
                        <div className="job-meta-item">
                          <MapPin size={12} />
                          <span>{job.location || 'Remote'}</span>
                        </div>
                        {job.posted_date && (
                          <div className="job-meta-item">
                            <Clock size={12} />
                            <span>{job.posted_date}</span>
                          </div>
                        )}
                        {job.source && (
                          <div className="job-meta-item">
                            <Tag size={12} />
                            <span>{job.source}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="job-footer">
                      {job.url ? (
                        <a 
                          href={job.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="btn-primary" 
                          style={{ padding: '8px 12px', fontSize: '0.8rem', gap: '4px', textDecoration: 'none' }}
                        >
                          <span>Apply Page</span>
                          <ExternalLink size={12} />
                        </a>
                      ) : <div />}
                      
                      <div className="job-actions">
                        <select 
                          className="status-select" 
                          value={job.status || 'Pending'}
                          onChange={(e) => handleStatusChange(job.id, e.target.value)}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Applied">Applied</option>
                          <option value="Interviewing">Interviewing</option>
                          <option value="Offered">Offered</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'scraper' && (
          <div>
            <div className="view-header">
              <div className="header-title">
                <h1>Scraper Console</h1>
                <p>Control and monitor the Rust-based background job scraper</p>
              </div>
            </div>

            <div className="scraper-control-card glassmorphism">
              <div className="scraper-status-info">
                <span className={`status-dot ${scraperRunning ? 'active' : ''}`}></span>
                <div className="scraper-status-text">
                  <h2>{scraperRunning ? 'Scraper active and running' : 'Scraper is currently idle'}</h2>
                  <p>
                    {scraperRunning 
                      ? 'The scraper is fetching active jobs based on settings profile parameters...' 
                      : 'Trigger the scraping process to scan platforms for job postings.'}
                  </p>
                </div>
              </div>
              <button 
                className="btn-primary" 
                onClick={triggerScraper} 
                disabled={scraperRunning}
                style={{ padding: '16px 32px' }}
              >
                {scraperRunning ? <RefreshCw size={18} className="spinner" /> : <Play size={18} />}
                <span>{scraperRunning ? 'Scraping...' : 'Trigger Scraper'}</span>
              </button>
            </div>

            {/* Terminal console */}
            <div className="terminal-container">
              <div className="terminal-header">
                <div className="terminal-dots">
                  <span className="terminal-dot dot-red"></span>
                  <span className="terminal-dot dot-yellow"></span>
                  <span className="terminal-dot dot-green"></span>
                </div>
                <div className="terminal-title">scraper_agent_runner.log</div>
                <div style={{ width: '42px' }}></div>
              </div>
              <div className="terminal-body">
                {logs.map((log, idx) => {
                  let cls = 'terminal-line';
                  if (log.startsWith('> [') || log.startsWith('\n> [')) cls += ' command';
                  else if (log.toLowerCase().includes('success')) cls += ' success';
                  else if (log.toLowerCase().includes('failed') || log.toLowerCase().includes('error')) cls += ' error';
                  return (
                    <div className={cls} key={idx}>
                      {log}
                    </div>
                  );
                })}
                {scraperRunning && (
                  <div className="terminal-line system">
                    &gt; Running rust binary... details will stream back upon process completion...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div>
            <div className="view-header">
              <div className="header-title">
                <h1>Profile Settings</h1>
                <p>Manage your application materials and search keywords for automated scraping</p>
              </div>
            </div>

            <div className="settings-container glassmorphism">
              <form onSubmit={handleSettingsSubmit} className="settings-form">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">
                      <User size={14} />
                      <span>Full Name</span>
                    </label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. John Doe"
                      value={settings.name || ''}
                      onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <Mail size={14} />
                      <span>Email Address</span>
                    </label>
                    <input 
                      type="email" 
                      className="form-input" 
                      placeholder="e.g. john@example.com"
                      value={settings.email || ''}
                      onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <Phone size={14} />
                      <span>Phone Number</span>
                    </label>
                    <input 
                      type="tel" 
                      className="form-input" 
                      placeholder="e.g. +1 234 567 890"
                      value={settings.phone || ''}
                      onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <FileText size={14} />
                      <span>Resume Document (PDF/Word)</span>
                    </label>
                    <div className="file-upload-wrapper">
                      <input 
                        type="file" 
                        id="resume-file"
                        className="file-upload-input" 
                        accept=".pdf,.docx,.doc"
                        onChange={handleResumeUpload}
                        disabled={uploadingResume}
                      />
                      <label htmlFor="resume-file" className="file-upload-label">
                        {uploadingResume ? (
                          <>
                            <RefreshCw size={16} className="spinner" />
                            <span>Uploading document...</span>
                          </>
                        ) : settings.resume_path ? (
                          <>
                            <CheckCircle2 size={16} style={{ color: 'var(--secondary)' }} />
                            <span className="file-name">
                              {settings.resume_path.split('/').pop()}
                            </span>
                          </>
                        ) : (
                          <>
                            <FileText size={16} />
                            <span>Choose resume file...</span>
                          </>
                        )}
                      </label>
                      {settings.resume_path && (
                        <a 
                          href={`${API_BASE_URL}/${settings.resume_path}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="btn-download"
                          title="Download/View Current Resume"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <GithubIcon size={14} />
                      <span>GitHub URL</span>
                    </label>
                    <input 
                      type="url" 
                      className="form-input" 
                      placeholder="e.g. https://github.com/johndoe"
                      value={settings.github || ''}
                      onChange={(e) => setSettings({ ...settings, github: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <Globe size={14} />
                      <span>Portfolio/Website URL</span>
                    </label>
                    <input 
                      type="url" 
                      className="form-input" 
                      placeholder="e.g. https://johndoe.com"
                      value={settings.portfolio || ''}
                      onChange={(e) => setSettings({ ...settings, portfolio: e.target.value })}
                    />
                  </div>

                  <div className="form-group full-width">
                    <label className="form-label">
                      <Tag size={14} />
                      <span>Search Keywords (Comma Separated)</span>
                    </label>
                    <textarea 
                      className="form-input" 
                      rows="3"
                      placeholder="e.g. Rust, WebAssembly, React, Frontend Developer, Backend Engineer"
                      value={settings.keywords || ''}
                      onChange={(e) => setSettings({ ...settings, keywords: e.target.value })}
                      style={{ resize: 'vertical' }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button 
                    type="submit" 
                    className="btn-primary" 
                    disabled={savingSettings}
                    style={{ minWidth: '160px' }}
                  >
                    {savingSettings && <RefreshCw size={16} className="spinner" />}
                    <span>{savingSettings ? 'Saving...' : 'Save Settings'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

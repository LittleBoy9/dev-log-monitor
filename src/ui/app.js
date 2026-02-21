// dev-log UI Application
(function() {
  'use strict';

  // State
  let logs = [];
  let ws = null;
  let selectedIndex = -1;
  let filters = {
    search: '',
    level: 'all',
    time: 'all',
    context: '',
    source: '',
    useRegex: false,
    caseSensitive: false
  };

  // Metrics state
  let metrics = {
    total: 0,
    errors: 0,
    warnings: 0,
    startTime: Date.now()
  };

  // DOM Elements
  const elements = {
    status: document.getElementById('status'),
    search: document.getElementById('search'),
    regexToggle: document.getElementById('regexToggle'),
    caseSensitive: document.getElementById('caseSensitive'),
    timeFilter: document.getElementById('timeFilter'),
    contextFilter: document.getElementById('contextFilter'),
    sourceFilter: document.getElementById('sourceFilter'),
    clearLogs: document.getElementById('clearLogs'),
    logList: document.getElementById('logList'),
    levelBtns: document.querySelectorAll('.level-btn'),
    themeToggle: document.getElementById('themeToggle'),
    metricsToggle: document.getElementById('metricsToggle'),
    metricsPanel: document.getElementById('metricsPanel'),
    exportBtn: document.getElementById('exportBtn'),
    exportModal: document.getElementById('exportModal'),
    exportCount: document.getElementById('exportCount'),
    closeExport: document.getElementById('closeExport'),
    keyboardHelp: document.getElementById('keyboardHelp'),
    shortcutsModal: document.getElementById('shortcutsModal'),
    closeShortcuts: document.getElementById('closeShortcuts'),
    metricTotal: document.getElementById('metricTotal'),
    metricErrors: document.getElementById('metricErrors'),
    metricWarnings: document.getElementById('metricWarnings'),
    metricRate: document.getElementById('metricRate')
  };

  // Initialize
  function init() {
    loadTheme();
    connectWebSocket();
    fetchLogs();
    fetchContexts();
    bindEvents();
    bindKeyboardShortcuts();
    updateMetricsDisplay();
  }

  // Theme management
  function loadTheme() {
    const savedTheme = localStorage.getItem('dev-log-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('dev-log-theme', next);
  }

  // WebSocket connection
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = function() {
      updateStatus('connected');
    };

    ws.onclose = function() {
      updateStatus('disconnected');
      setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = function() {
      updateStatus('disconnected');
    };

    ws.onmessage = function(event) {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'log') {
          addLog(message.data);
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message', e);
      }
    };
  }

  function updateStatus(status) {
    const dot = elements.status.querySelector('.status-dot');
    const text = elements.status.querySelector('.status-text');

    dot.className = 'status-dot ' + status;
    text.textContent = status === 'connected' ? 'Live' :
                       status === 'disconnected' ? 'Disconnected' : 'Connecting...';
  }

  // Fetch initial logs
  async function fetchLogs() {
    try {
      const response = await fetch('/api/logs?limit=500');
      const data = await response.json();
      logs = data.logs || [];
      updateMetrics();
      renderLogs();
    } catch (e) {
      console.error('Failed to fetch logs', e);
    }
  }

  // Fetch contexts
  async function fetchContexts() {
    try {
      const response = await fetch('/api/contexts');
      const data = await response.json();
      const contexts = data.contexts || [];

      elements.contextFilter.innerHTML = '<option value="">All contexts</option>';
      contexts.forEach(function(ctx) {
        const option = document.createElement('option');
        option.value = ctx;
        option.textContent = ctx;
        elements.contextFilter.appendChild(option);
      });
    } catch (e) {
      console.error('Failed to fetch contexts', e);
    }
  }

  // Add new log
  function addLog(entry) {
    logs.unshift(entry);
    if (logs.length > 1000) {
      logs = logs.slice(0, 1000);
    }

    // Update metrics
    metrics.total++;
    if (entry.level === 'error') metrics.errors++;
    if (entry.level === 'warn') metrics.warnings++;
    updateMetricsDisplay();

    // Update context filter if new context
    if (entry.context) {
      const options = Array.from(elements.contextFilter.options);
      const exists = options.some(function(opt) { return opt.value === entry.context; });
      if (!exists) {
        const option = document.createElement('option');
        option.value = entry.context;
        option.textContent = entry.context;
        elements.contextFilter.appendChild(option);
      }
    }

    renderLogs();
  }

  // Update metrics
  function updateMetrics() {
    metrics.total = logs.length;
    metrics.errors = logs.filter(l => l.level === 'error').length;
    metrics.warnings = logs.filter(l => l.level === 'warn').length;
    updateMetricsDisplay();
  }

  function updateMetricsDisplay() {
    const elapsed = (Date.now() - metrics.startTime) / 1000;
    const rate = elapsed > 0 ? (metrics.total / elapsed).toFixed(2) : '0';

    if (elements.metricTotal) elements.metricTotal.textContent = metrics.total;
    if (elements.metricErrors) elements.metricErrors.textContent = metrics.errors;
    if (elements.metricWarnings) elements.metricWarnings.textContent = metrics.warnings;
    if (elements.metricRate) elements.metricRate.textContent = rate;
  }

  // Render logs
  function renderLogs() {
    const filtered = filterLogs();

    // Update export count
    if (elements.exportCount) {
      elements.exportCount.textContent = filtered.length;
    }

    if (filtered.length === 0) {
      elements.logList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <div class="empty-text">No logs match your filters</div>
          <div class="empty-hint">Try adjusting your search or filters</div>
        </div>
      `;
      return;
    }

    elements.logList.innerHTML = filtered.map((entry, index) =>
      renderLogEntry(entry, index)
    ).join('');

    // Restore selection
    if (selectedIndex >= 0 && selectedIndex < filtered.length) {
      const entries = elements.logList.querySelectorAll('.log-entry');
      if (entries[selectedIndex]) {
        entries[selectedIndex].classList.add('selected');
      }
    }
  }

  function renderLogEntry(entry, index) {
    const time = formatTime(entry.timestamp);
    const hasDetails = entry.metadata || entry.stack || entry.parsedStack || entry.breadcrumbs || entry.caller;
    const metadataStr = entry.metadata ? JSON.stringify(entry.metadata, null, 2) : '';
    const isSelected = index === selectedIndex;

    // Format timing delta
    const timingHtml = renderTiming(entry.timing);

    // Format caller info for header
    const callerHtml = entry.caller ?
      `<span class="log-caller"><span class="log-caller-icon">←</span> ${escapeHtml(entry.caller.file)}:${entry.caller.line}</span>` : '';

    // Trace ID badge
    const traceHtml = entry.traceId ?
      `<span class="trace-badge">${escapeHtml(entry.traceId.slice(0, 8))}</span>` : '';

    return `
      <div class="log-entry level-${entry.level}${isSelected ? ' selected' : ''}" data-id="${entry.id}" data-index="${index}">
        <div class="log-header">
          <span class="log-level">${entry.level}</span>
          ${entry.context ? `<span class="log-context">${escapeHtml(entry.context)}</span>` : ''}
          <span class="source-badge">${entry.source}</span>
          ${traceHtml}
          ${timingHtml}
          ${callerHtml}
          <span class="log-time">${time}</span>
        </div>
        <div class="log-message">${escapeHtml(entry.message)}</div>
        ${hasDetails ? `
          <div class="log-details">
            ${entry.caller ? renderSourceLocation(entry.caller) : ''}
            ${entry.breadcrumbs && entry.breadcrumbs.length > 0 ? renderBreadcrumbs(entry.breadcrumbs) : ''}
            ${entry.parsedStack && entry.parsedStack.length > 0 ? renderParsedStack(entry.parsedStack, entry.stack) : ''}
            ${!entry.parsedStack && entry.stack ? `<pre class="log-stack">${escapeHtml(entry.stack)}</pre>` : ''}
            ${metadataStr ? `<pre class="log-metadata">${escapeHtml(metadataStr)}</pre>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderTiming(timing) {
    if (!timing || !timing.sinceLast || timing.sinceLast < 1) return '';

    const delta = timing.sinceLast;
    let text, className = 'log-timing';

    if (delta < 100) {
      text = `+${delta}ms`;
    } else if (delta < 1000) {
      text = `+${delta}ms`;
      className += ' slow';
    } else if (delta < 60000) {
      text = `+${(delta / 1000).toFixed(1)}s`;
      className += ' very-slow';
    } else {
      text = `+${(delta / 60000).toFixed(1)}m`;
      className += ' very-slow';
    }

    return `<span class="${className}">${text}</span>`;
  }

  function renderSourceLocation(caller) {
    return `
      <div class="log-source-location">
        <span class="icon">📍</span>
        <span class="file">${escapeHtml(caller.file)}</span>
        <span class="line">:${caller.line}:${caller.column}</span>
        <span class="arrow">→</span>
        <span class="function">${escapeHtml(caller.function)}()</span>
      </div>
    `;
  }

  function renderBreadcrumbs(breadcrumbs) {
    if (!breadcrumbs || breadcrumbs.length === 0) return '';

    const maxMs = Math.max(...breadcrumbs.map(b => b.msAgo));
    const timeRange = maxMs < 1000 ? `last ${maxMs}ms` : `last ${(maxMs / 1000).toFixed(1)}s`;

    const items = breadcrumbs.map((b, i) => {
      const isLast = i === breadcrumbs.length - 1;
      const msAgoText = b.msAgo < 1000 ? `${b.msAgo}ms ago` : `${(b.msAgo / 1000).toFixed(1)}s ago`;

      return `
        <div class="breadcrumb-item ${isLast ? 'current' : ''}">
          <span class="time">${formatTime(b.timestamp)}</span>
          <span class="level ${b.level}">${b.level}</span>
          ${b.context ? `<span class="context">[${escapeHtml(b.context)}]</span>` : ''}
          <span class="message">${escapeHtml(b.message)}</span>
          <span class="ms-ago">${msAgoText}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="breadcrumbs-section">
        <div class="breadcrumbs-header">
          <span><span class="icon">📚</span> BREADCRUMBS (what happened before)</span>
          <span class="time-range">${timeRange}</span>
        </div>
        <div class="breadcrumbs-list">
          ${items}
        </div>
      </div>
    `;
  }

  function renderParsedStack(frames, rawStack) {
    if (!frames || frames.length === 0) return '';

    const appFrames = frames.filter(f => f.isApp);
    const libFrames = frames.filter(f => !f.isApp && !f.isNative);
    const hiddenCount = frames.length - appFrames.length;

    const appFramesHtml = appFrames.map((frame, i) => `
      <div class="stack-frame app-code">
        <span class="indicator">${i === 0 ? '❯' : ' '}</span>
        <span class="function-name">${escapeHtml(frame.function)}</span>
        <span class="file-location">
          <span class="file">${escapeHtml(frame.file)}</span>:${frame.line}:${frame.column}
        </span>
      </div>
    `).join('');

    const collapsedHtml = hiddenCount > 0 ? `
      <div class="stack-frame collapsed" onclick="this.classList.toggle('expanded'); this.nextElementSibling.classList.toggle('hidden');">
        ··· ${hiddenCount} more frames (node_modules) [click to expand]
      </div>
      <div class="hidden">
        ${libFrames.slice(0, 5).map(frame => `
          <div class="stack-frame">
            <span class="indicator"> </span>
            <span class="function-name">${escapeHtml(frame.function)}</span>
            <span class="file-location">${escapeHtml(frame.path)}:${frame.line}</span>
          </div>
        `).join('')}
      </div>
    ` : '';

    const stackId = 'stack-' + Math.random().toString(36).substring(2, 11);

    return `
      <div class="parsed-stack-section">
        <div class="parsed-stack-header">
          <span>📋 STACK TRACE</span>
          <div class="actions">
            <button onclick="copyStack('${stackId}')">Copy</button>
            <button onclick="toggleRawStack('${stackId}')">Raw</button>
          </div>
        </div>
        <div class="parsed-stack-list" id="${stackId}">
          ${appFramesHtml}
          ${collapsedHtml}
        </div>
        <pre class="log-stack hidden" id="${stackId}-raw">${escapeHtml(rawStack || '')}</pre>
      </div>
    `;
  }

  // Filter logs
  function filterLogs() {
    return logs.filter(function(entry) {
      // Level filter
      if (filters.level !== 'all' && entry.level !== filters.level) {
        return false;
      }

      // Context filter
      if (filters.context && entry.context !== filters.context) {
        return false;
      }

      // Source filter
      if (filters.source && entry.source !== filters.source) {
        return false;
      }

      // Search filter
      if (filters.search) {
        const searchText = filters.caseSensitive ? filters.search : filters.search.toLowerCase();

        if (filters.useRegex) {
          try {
            const regex = new RegExp(filters.search, filters.caseSensitive ? '' : 'i');
            const matchesMessage = regex.test(entry.message);
            const matchesContext = entry.context && regex.test(entry.context);
            const matchesMetadata = entry.metadata && regex.test(JSON.stringify(entry.metadata));

            if (!matchesMessage && !matchesContext && !matchesMetadata) {
              return false;
            }
          } catch (e) {
            return entry.message.includes(filters.search);
          }
        } else {
          const messageText = filters.caseSensitive ? entry.message : entry.message.toLowerCase();
          const contextText = entry.context ? (filters.caseSensitive ? entry.context : entry.context.toLowerCase()) : '';
          const metadataText = entry.metadata ? (filters.caseSensitive ? JSON.stringify(entry.metadata) : JSON.stringify(entry.metadata).toLowerCase()) : '';

          const matchesMessage = messageText.includes(searchText);
          const matchesContext = contextText.includes(searchText);
          const matchesMetadata = metadataText.includes(searchText);

          if (!matchesMessage && !matchesContext && !matchesMetadata) {
            return false;
          }
        }
      }

      // Time filter
      if (filters.time !== 'all') {
        const entryTime = new Date(entry.timestamp).getTime();
        const now = Date.now();
        let cutoff;

        switch (filters.time) {
          case '5m': cutoff = now - 5 * 60 * 1000; break;
          case '15m': cutoff = now - 15 * 60 * 1000; break;
          case '1h': cutoff = now - 60 * 60 * 1000; break;
          case '24h': cutoff = now - 24 * 60 * 60 * 1000; break;
          default: cutoff = 0;
        }

        if (entryTime < cutoff) {
          return false;
        }
      }

      return true;
    });
  }

  // Bind events
  function bindEvents() {
    // Search
    let searchTimeout;
    elements.search.addEventListener('input', function(e) {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(function() {
        filters.search = e.target.value;
        selectedIndex = -1;
        renderLogs();
      }, 200);
    });

    // Regex toggle
    if (elements.regexToggle) {
      elements.regexToggle.addEventListener('change', function(e) {
        filters.useRegex = e.target.checked;
        renderLogs();
      });
    }

    // Case sensitive toggle
    if (elements.caseSensitive) {
      elements.caseSensitive.addEventListener('change', function(e) {
        filters.caseSensitive = e.target.checked;
        renderLogs();
      });
    }

    // Level filter
    elements.levelBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        elements.levelBtns.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        filters.level = btn.dataset.level;
        selectedIndex = -1;
        renderLogs();
      });
    });

    // Time filter
    elements.timeFilter.addEventListener('change', function(e) {
      filters.time = e.target.value;
      selectedIndex = -1;
      renderLogs();
    });

    // Context filter
    elements.contextFilter.addEventListener('change', function(e) {
      filters.context = e.target.value;
      selectedIndex = -1;
      renderLogs();
    });

    // Source filter
    if (elements.sourceFilter) {
      elements.sourceFilter.addEventListener('change', function(e) {
        filters.source = e.target.value;
        selectedIndex = -1;
        renderLogs();
      });
    }

    // Clear logs
    elements.clearLogs.addEventListener('click', clearLogs);

    // Toggle log details
    elements.logList.addEventListener('click', function(e) {
      const entry = e.target.closest('.log-entry');
      if (entry && entry.querySelector('.log-details')) {
        const index = parseInt(entry.dataset.index, 10);
        selectLog(index);
        entry.classList.toggle('expanded');
      }
    });

    // Theme toggle
    if (elements.themeToggle) {
      elements.themeToggle.addEventListener('click', toggleTheme);
    }

    // Metrics toggle
    if (elements.metricsToggle && elements.metricsPanel) {
      elements.metricsToggle.addEventListener('click', function() {
        elements.metricsPanel.classList.toggle('hidden');
      });
    }

    // Export button
    if (elements.exportBtn && elements.exportModal) {
      elements.exportBtn.addEventListener('click', function() {
        elements.exportModal.classList.remove('hidden');
      });
    }

    // Close export modal
    if (elements.closeExport && elements.exportModal) {
      elements.closeExport.addEventListener('click', function() {
        elements.exportModal.classList.add('hidden');
      });
    }

    // Export options
    document.querySelectorAll('.export-option').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const format = btn.dataset.format;
        exportLogs(format);
        if (elements.exportModal) {
          elements.exportModal.classList.add('hidden');
        }
      });
    });

    // Keyboard help button
    if (elements.keyboardHelp && elements.shortcutsModal) {
      elements.keyboardHelp.addEventListener('click', function() {
        elements.shortcutsModal.classList.remove('hidden');
      });
    }

    // Close shortcuts modal
    if (elements.closeShortcuts && elements.shortcutsModal) {
      elements.closeShortcuts.addEventListener('click', function() {
        elements.shortcutsModal.classList.add('hidden');
      });
    }

    // Close modals on backdrop click
    [elements.exportModal, elements.shortcutsModal].forEach(function(modal) {
      if (modal) {
        modal.addEventListener('click', function(e) {
          if (e.target === modal) {
            modal.classList.add('hidden');
          }
        });
      }
    });
  }

  // Keyboard shortcuts
  function bindKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
      // Don't trigger shortcuts when typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
          e.target.blur();
          elements.search.value = '';
          filters.search = '';
          renderLogs();
        }
        return;
      }

      // Close modals on Escape
      if (e.key === 'Escape') {
        if (elements.exportModal) elements.exportModal.classList.add('hidden');
        if (elements.shortcutsModal) elements.shortcutsModal.classList.add('hidden');
        return;
      }

      switch (e.key) {
        case '/':
          e.preventDefault();
          elements.search.focus();
          break;

        case 'j':
          e.preventDefault();
          navigateLog(1);
          break;

        case 'k':
          e.preventDefault();
          navigateLog(-1);
          break;

        case 'Enter':
          e.preventDefault();
          toggleSelectedLog();
          break;

        case '1':
          setLevelFilter('all');
          break;

        case '2':
          setLevelFilter('info');
          break;

        case '3':
          setLevelFilter('warn');
          break;

        case '4':
          setLevelFilter('error');
          break;

        case 't':
          toggleTheme();
          break;

        case 'm':
          if (elements.metricsPanel) {
            elements.metricsPanel.classList.toggle('hidden');
          }
          break;

        case 'e':
          if (elements.exportModal) {
            elements.exportModal.classList.remove('hidden');
          }
          break;

        case 'c':
          clearLogs();
          break;

        case '?':
          if (elements.shortcutsModal) {
            elements.shortcutsModal.classList.remove('hidden');
          }
          break;
      }
    });
  }

  function navigateLog(direction) {
    const filtered = filterLogs();
    if (filtered.length === 0) return;

    selectedIndex += direction;
    if (selectedIndex < 0) selectedIndex = 0;
    if (selectedIndex >= filtered.length) selectedIndex = filtered.length - 1;

    selectLog(selectedIndex);
  }

  function selectLog(index) {
    selectedIndex = index;

    const entries = elements.logList.querySelectorAll('.log-entry');
    entries.forEach(function(entry, i) {
      entry.classList.toggle('selected', i === index);
    });

    if (entries[index]) {
      entries[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function toggleSelectedLog() {
    const entries = elements.logList.querySelectorAll('.log-entry');
    if (entries[selectedIndex]) {
      entries[selectedIndex].classList.toggle('expanded');
    }
  }

  function setLevelFilter(level) {
    elements.levelBtns.forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.level === level);
    });
    filters.level = level;
    selectedIndex = -1;
    renderLogs();
  }

  async function clearLogs() {
    if (!confirm('Are you sure you want to clear all logs?')) {
      return;
    }

    try {
      await fetch('/api/logs', { method: 'DELETE' });
      logs = [];
      metrics = { total: 0, errors: 0, warnings: 0, startTime: Date.now() };
      updateMetricsDisplay();
      selectedIndex = -1;
      renderLogs();
    } catch (e) {
      console.error('Failed to clear logs', e);
    }
  }

  // Export functions
  function exportLogs(format) {
    const filtered = filterLogs();
    let content, filename, mimeType;

    switch (format) {
      case 'json':
        content = JSON.stringify(filtered, null, 2);
        filename = `dev-log-export-${formatDate(new Date())}.json`;
        mimeType = 'application/json';
        break;

      case 'csv':
        content = logsToCSV(filtered);
        filename = `dev-log-export-${formatDate(new Date())}.csv`;
        mimeType = 'text/csv';
        break;

      case 'txt':
        content = logsToText(filtered);
        filename = `dev-log-export-${formatDate(new Date())}.txt`;
        mimeType = 'text/plain';
        break;

      default:
        return;
    }

    downloadFile(content, filename, mimeType);
    showToast(`Exported ${filtered.length} logs as ${format.toUpperCase()}`);
  }

  function logsToCSV(logs) {
    const headers = ['timestamp', 'level', 'context', 'source', 'message', 'metadata'];
    const rows = logs.map(function(log) {
      return [
        log.timestamp,
        log.level,
        log.context || '',
        log.source,
        log.message.replace(/"/g, '""'),
        log.metadata ? JSON.stringify(log.metadata).replace(/"/g, '""') : ''
      ].map(function(cell) {
        return '"' + cell + '"';
      }).join(',');
    });

    return headers.join(',') + '\n' + rows.join('\n');
  }

  function logsToText(logs) {
    return logs.map(function(log) {
      let line = `[${log.timestamp}] ${log.level.toUpperCase().padEnd(5)} `;
      if (log.context) line += `[${log.context}] `;
      line += log.message;
      if (log.metadata) line += '\n  ' + JSON.stringify(log.metadata);
      if (log.stack) line += '\n' + log.stack;
      return line;
    }).join('\n\n');
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Helpers
  function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
  }

  function formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Global helper functions for stack trace actions
  window.copyStack = function(stackId) {
    const rawEl = document.getElementById(stackId + '-raw');
    if (rawEl) {
      navigator.clipboard.writeText(rawEl.textContent).then(function() {
        showToast('Stack trace copied!');
      });
    }
  };

  window.toggleRawStack = function(stackId) {
    const parsedEl = document.getElementById(stackId);
    const rawEl = document.getElementById(stackId + '-raw');
    if (parsedEl && rawEl) {
      parsedEl.classList.toggle('hidden');
      rawEl.classList.toggle('hidden');
    }
  };

  function showToast(message) {
    let toast = document.querySelector('.copy-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'copy-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(function() {
      toast.classList.remove('show');
    }, 2000);
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/**
 * DevSync Analytics Controller
 * Features data-driven Contribution Intelligence and interactive Chart.js visualizations
 */

import { AnalyticsService } from '../services/analytics-service.js';

let currentRange = '30d';
let currentProject = 'all';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function initAnalyticsPage() {
  const commitCanvas = document.getElementById('commitTrendsChart');
  const repoCanvas = document.getElementById('repoActivityChart');

  // Initialize Contribution Intelligence
  initContributionIntelligence();

  // Check if Chart.js is loaded
  if (typeof window.Chart !== 'undefined') {
    if (commitCanvas) {
      const trendData = await AnalyticsService.getCommitTrends();
      new window.Chart(commitCanvas, {
        type: 'line',
        data: trendData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { grid: { color: '#F0F4F2' } },
            y: { grid: { color: '#F0F4F2' } }
          }
        }
      });
    }

    if (repoCanvas) {
      const repoData = await AnalyticsService.getRepoActivity();
      new window.Chart(repoCanvas, {
        type: 'bar',
        data: repoData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { grid: { display: false } },
            y: { grid: { color: '#F0F4F2' } }
          }
        }
      });
    }
  }
}

function initContributionIntelligence() {
  const rangeBtns = document.querySelectorAll('.contrib-range-btn');
  const projectSelect = document.getElementById('contribProjectSelect');
  const tooltipBtn = document.getElementById('impactTooltipBtn');
  const tooltipBox = document.getElementById('contribTooltipBox');

  // Time range filtering
  rangeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      rangeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRange = btn.getAttribute('data-range') || '30d';
      refreshContributionIntelligence();
    });
  });

  // Project filter
  if (projectSelect) {
    projectSelect.addEventListener('change', (e) => {
      currentProject = e.target.value;
      refreshContributionIntelligence();
    });
  }

  // Info tooltip toggle
  if (tooltipBtn && tooltipBox) {
    tooltipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      tooltipBox.style.display = tooltipBox.style.display === 'none' ? 'block' : 'none';
    });

    document.addEventListener('click', (e) => {
      if (!tooltipBox.contains(e.target) && e.target !== tooltipBtn) {
        tooltipBox.style.display = 'none';
      }
    });
  }

  // Initial load
  refreshContributionIntelligence();
}

async function refreshContributionIntelligence() {
  try {
    const data = await AnalyticsService.getContributionIntelligence(currentRange, currentProject);
    renderContributionIntelligence(data);
  } catch (err) {
    console.error('Failed to load Contribution Intelligence:', err);
    renderContributionError();
  }
}

function renderContributionIntelligence(data) {
  // 1. Render Gauge and Score
  const scoreValEl = document.getElementById('contribScoreValue');
  const gaugeArcEl = document.getElementById('contribGaugeArc');
  const trendBadgeEl = document.getElementById('contribTrendBadge');
  const explanationEl = document.getElementById('contribExplanation');

  const ARC_LENGTH = 188.5; // Arc perimeter for R=60 semicircle

  if (data.hasSufficientData && typeof data.score === 'number') {
    if (scoreValEl) scoreValEl.textContent = data.score;
    if (gaugeArcEl) {
      const offset = ARC_LENGTH - (ARC_LENGTH * (data.score / 100));
      gaugeArcEl.style.strokeDashoffset = Math.max(0, offset);
      gaugeArcEl.style.stroke = '#10B981';
    }
    if (trendBadgeEl) {
      trendBadgeEl.textContent = `${data.trendDirection === 'up' ? '↑' : (data.trendDirection === 'down' ? '↓' : '•')} ${data.trendPercent} ${data.priorPeriodLabel || ''}`;
      trendBadgeEl.className = `contrib-trend-badge ${data.trendDirection || 'up'}`;
      trendBadgeEl.style.display = 'inline-block';
    }
    if (explanationEl) {
      explanationEl.textContent = data.explanation || 'Verified development activity.';
    }
  } else {
    // Insufficient data state
    if (scoreValEl) scoreValEl.textContent = '—';
    if (gaugeArcEl) {
      gaugeArcEl.style.strokeDashoffset = ARC_LENGTH;
      gaugeArcEl.style.stroke = '#CBD5E1';
    }
    if (trendBadgeEl) {
      trendBadgeEl.textContent = 'Insufficient data';
      trendBadgeEl.className = 'contrib-trend-badge neutral';
    }
    if (explanationEl) {
      explanationEl.textContent = data.message || 'Insufficient activity recorded in this period.';
    }
  }

  // 2. Render 3 Compact Indicators
  const ind = data.indicators || {};
  const impactVal = document.getElementById('indImpactVal');
  const impactStatus = document.getElementById('indImpactStatus');
  if (impactVal && ind.impact) {
    impactVal.textContent = ind.impact.value;
    if (impactStatus) {
      impactStatus.textContent = ind.impact.status;
      impactStatus.className = `contrib-ind-status ${(ind.impact.status || 'steady').toLowerCase()}`;
    }
  }

  const flowVal = document.getElementById('indFlowVal');
  const flowStatus = document.getElementById('indFlowStatus');
  if (flowVal && ind.flow) {
    flowVal.textContent = ind.flow.value;
    if (flowStatus) {
      flowStatus.textContent = ind.flow.status;
      flowStatus.className = `contrib-ind-status ${(ind.flow.status || 'active').toLowerCase()}`;
    }
  }

  const collabVal = document.getElementById('indCollabVal');
  const collabStatus = document.getElementById('indCollabStatus');
  if (collabVal && ind.collaboration) {
    collabVal.textContent = ind.collaboration.value;
    if (collabStatus) {
      collabStatus.textContent = ind.collaboration.status;
      collabStatus.className = `contrib-ind-status ${(ind.collaboration.status || 'active').toLowerCase()}`;
    }
  }

  // 3. Render Engineering Strengths (Lightweight SVG Radar Chart)
  renderRadarChart(data.strengths || [], data.hasSufficientData);

  // 4. Render Project Contribution Breakdown
  renderProjectDistribution(data.projectDistribution || []);
}

function renderRadarChart(strengths, hasData) {
  const wrapper = document.getElementById('contribRadarWrapper');
  if (!wrapper) return;

  if (!hasData || !strengths || strengths.length < 3) {
    wrapper.innerHTML = `
      <div class="text-center py-5 text-secondary" style="font-size: 13px;">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="1.5" style="margin: 0 auto 8px auto; display: block;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        Insufficient activity to plot engineering strengths.
      </div>
    `;
    return;
  }

  const cx = 135;
  const cy = 110;
  const R = 70;
  const numAxes = strengths.length;

  // Background Web concentric rings
  const webLevels = [0.33, 0.66, 1.0];
  let webPolygons = '';
  webLevels.forEach(lvl => {
    const pts = [];
    for (let i = 0; i < numAxes; i++) {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / numAxes;
      const x = cx + R * lvl * Math.cos(angle);
      const y = cy + R * lvl * Math.sin(angle);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    webPolygons += `<polygon points="${pts.join(' ')}" fill="none" stroke="#E2E8F0" stroke-width="1" />`;
  });

  // Spokes & Labels
  let spokes = '';
  let labels = '';
  const dataPoints = [];

  strengths.forEach((s, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / numAxes;
    const endX = cx + R * Math.cos(angle);
    const endY = cy + R * Math.sin(angle);
    spokes += `<line x1="${cx}" y1="${cy}" x2="${endX.toFixed(1)}" y2="${endY.toFixed(1)}" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="2 2" />`;

    // Data polygon point
    const valRatio = Math.max(0.1, Math.min(1.0, (s.value || 0) / (s.max || 100)));
    const dataX = cx + R * valRatio * Math.cos(angle);
    const dataY = cy + R * valRatio * Math.sin(angle);
    dataPoints.push(`${dataX.toFixed(1)},${dataY.toFixed(1)}`);

    // Label positioning
    const labelR = R + 18;
    const lx = cx + labelR * Math.cos(angle);
    const ly = cy + labelR * Math.sin(angle);
    let textAnchor = 'middle';
    if (Math.cos(angle) > 0.3) textAnchor = 'start';
    else if (Math.cos(angle) < -0.3) textAnchor = 'end';

    labels += `
      <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="10.5" font-weight="600" fill="#475569" text-anchor="${textAnchor}" dominant-baseline="middle">
        ${escapeHtml(s.axis)} <tspan font-weight="700" fill="#059669">(${s.value})</tspan>
      </text>
    `;
  });

  // Data Polygon
  const dataPolygon = `
    <polygon points="${dataPoints.join(' ')}" fill="rgba(16, 185, 129, 0.16)" stroke="#10B981" stroke-width="2" stroke-linejoin="round" />
  `;

  // Vertex circles
  let vertices = '';
  dataPoints.forEach(pt => {
    const [vx, vy] = pt.split(',');
    vertices += `<circle cx="${vx}" cy="${vy}" r="3.5" fill="#10B981" stroke="#FFFFFF" stroke-width="1.5" />`;
  });

  wrapper.innerHTML = `
    <svg viewBox="0 0 270 220" width="100%" height="220" style="max-width: 320px; overflow: visible;">
      ${webPolygons}
      ${spokes}
      ${dataPolygon}
      ${vertices}
      ${labels}
    </svg>
  `;
}

function renderProjectDistribution(projects) {
  const listEl = document.getElementById('contribProjectsList');
  const countEl = document.getElementById('contribProjCount');
  if (!listEl) return;

  if (countEl) {
    countEl.textContent = `${projects.length} active`;
  }

  if (!projects || projects.length === 0) {
    listEl.innerHTML = `
      <div class="text-center py-4 text-secondary" style="font-size: 13px;">
        No active repository contributions recorded in this time range.
      </div>
    `;
    return;
  }

  listEl.innerHTML = projects.map(p => `
    <div class="contrib-proj-row">
      <div class="contrib-proj-top">
        <a href="../repositories/detail.html?repo=${encodeURIComponent(p.name)}" class="contrib-proj-name">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${p.languageColor || '#10B981'};"></span>
          ${escapeHtml(p.name)}
        </a>
        <span class="contrib-proj-share">${p.sharePercent}%</span>
      </div>
      <div class="contrib-proj-bar">
        <div class="contrib-proj-fill" style="width: ${p.sharePercent}%; background-color: ${p.languageColor || '#10B981'};"></div>
      </div>
      <div class="contrib-proj-meta">
        <span>${escapeHtml(p.recentActivity || 'Activity recorded')}</span>
        <span>${p.eventCount} action${p.eventCount === 1 ? '' : 's'}</span>
      </div>
    </div>
  `).join('');
}

function renderContributionError() {
  const scoreValEl = document.getElementById('contribScoreValue');
  const explanationEl = document.getElementById('contribExplanation');
  if (scoreValEl) scoreValEl.textContent = '—';
  if (explanationEl) explanationEl.textContent = 'Unable to connect to Contribution Intelligence service.';
}

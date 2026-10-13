/**
 * DevSync Analytics Controller
 * Interactive Chart.js charts and contribution heatmap
 */

import { AnalyticsService } from '../services/analytics-service.js';

export async function initAnalyticsPage() {
  const commitCanvas = document.getElementById('commitTrendsChart');
  const repoCanvas = document.getElementById('repoActivityChart');
  const heatmapGrid = document.getElementById('heatmapGrid');

  // Render Heatmap Grid
  if (heatmapGrid) {
    const totalCells = 52 * 7; // 52 weeks
    let html = '';
    for (let i = 0; i < totalCells; i++) {
      // Generate realistic distribution
      const rand = Math.random();
      let level = 0;
      if (rand > 0.85) level = 4;
      else if (rand > 0.65) level = 3;
      else if (rand > 0.45) level = 2;
      else if (rand > 0.25) level = 1;
      html += `<div class="heatmap-cell" data-level="${level}" title="${level * 3} contributions"></div>`;
    }
    heatmapGrid.innerHTML = html;
  }

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

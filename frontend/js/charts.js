// ═══════════════════════════════════════════════════════════════
// CHARTS.JS — Chart.js comparison charts
// ═══════════════════════════════════════════════════════════════

let timeChart = null;
let loadChart = null;
let efficiencyChart = null;

const chartColors = {
    fast: { bg: 'rgba(248,203,70,0.7)', border: '#f8cb46' },
    balanced: { bg: 'rgba(74,144,217,0.7)', border: '#4A90D9' },
    optimal: { bg: 'rgba(12,131,31,0.7)', border: '#0c831f' }
};

function destroyCharts() {
    if (timeChart) { timeChart.destroy(); timeChart = null; }
    if (loadChart) { loadChart.destroy(); loadChart = null; }
    if (efficiencyChart) { efficiencyChart.destroy(); efficiencyChart = null; }
}

function renderComparisonCharts(results, warehouseNames) {
    destroyCharts();

    const strategies = ['fast', 'balanced', 'optimal'];
    const labels = ['Fast Mode', 'Balanced Mode', 'Optimal Mode'];
    const bgColors = strategies.map(s => chartColors[s].bg);
    const borderColors = strategies.map(s => chartColors[s].border);

    // ─── Time Comparison Bar Chart ──────────────────────────
    const timeCtx = document.getElementById('chart-time');
    if (timeCtx) {
        timeChart = new Chart(timeCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Total Delivery Time (min)',
                    data: strategies.map(s => results.strategies[s].totalTime),
                    backgroundColor: bgColors,
                    borderColor: borderColors,
                    borderWidth: 2,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#f0f0f0' } },
                    x: { grid: { display: false } }
                },
                animation: { duration: 800, easing: 'easeOutQuart' }
            }
        });
    }

    // ─── Load Distribution Grouped Bar Chart ────────────────
    const loadCtx = document.getElementById('chart-load');
    if (loadCtx) {
        const datasets = strategies.map((s, i) => ({
            label: labels[i],
            data: results.strategies[s].loadDistribution,
            backgroundColor: chartColors[s].bg,
            borderColor: chartColors[s].border,
            borderWidth: 2,
            borderRadius: 6
        }));

        loadChart = new Chart(loadCtx, {
            type: 'bar',
            data: { labels: warehouseNames, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10, font: { size: 10 } } }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#f0f0f0' } },
                    x: { grid: { display: false } }
                },
                animation: { duration: 800, easing: 'easeOutQuart' }
            }
        });
    }

    // ─── Efficiency Doughnut Chart ──────────────────────────
    const effCtx = document.getElementById('chart-efficiency');
    if (effCtx) {
        efficiencyChart = new Chart(effCtx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: strategies.map(s => results.strategies[s].efficiency),
                    backgroundColor: bgColors,
                    borderColor: borderColors,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10, font: { size: 10 } } }
                },
                animation: { duration: 800, easing: 'easeOutQuart' }
            }
        });
    }
}

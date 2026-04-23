// ═══════════════════════════════════════════════════════════════
// GRAPH.JS — vis-network graph visualization
// ═══════════════════════════════════════════════════════════════

let network = null;
let heroNetwork = null;

function initGraph(containerId, customers, warehouses, distanceMatrix) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const nodes = new vis.DataSet();
    const edges = new vis.DataSet();

    const cCount = customers.length;
    const wCount = warehouses.length;
    const maxCount = Math.max(cCount, wCount);
    const spacing = Math.max(80, Math.min(140, 600 / maxCount));

    customers.forEach((c, i) => {
        nodes.add({
            id: `c${c.id}`,
            label: `${c.name}\n📦 ${c.orderSize} units`,
            shape: 'dot',
            size: 22 + c.orderSize * 2,
            color: { background: '#4A90D9', border: '#2a6cb8', highlight: { background: '#3178c6', border: '#1a5096' } },
            font: { color: '#333', size: 11, face: 'Inter', multi: true },
            x: -250,
            y: (i - (cCount - 1) / 2) * spacing,
            shadow: { enabled: true, size: 8, color: 'rgba(74,144,217,0.3)' }
        });
    });

    warehouses.forEach((w, j) => {
        nodes.add({
            id: `w${w.id}`,
            label: `${w.name}\n🏭 Cap: ${w.capacity}`,
            shape: 'box',
            size: 25,
            color: { background: '#0c831f', border: '#064d13', highlight: { background: '#0a6d18', border: '#043d0f' } },
            font: { color: 'white', size: 10, face: 'Inter', multi: true },
            x: 250,
            y: (j - (wCount - 1) / 2) * spacing,
            shadow: { enabled: true, size: 8, color: 'rgba(12,131,31,0.3)' },
            borderWidth: 2, borderWidthSelected: 3
        });
    });

    for (let i = 0; i < cCount; i++) {
        for (let j = 0; j < wCount; j++) {
            edges.add({
                id: `e${i}_${j}`,
                from: `c${customers[i].id}`, to: `w${warehouses[j].id}`,
                label: `${distanceMatrix[i][j]} min`,
                color: { color: '#ddd', highlight: '#0c831f', opacity: 0.5 },
                font: { size: 8, color: '#999', strokeWidth: 2, strokeColor: '#fff' },
                width: 1,
                smooth: { type: 'curvedCW', roundness: 0.05 + 0.04 * (j - i) },
                arrows: { to: { enabled: false } }
            });
        }
    }

    const options = {
        physics: { enabled: false },
        interaction: { hover: true, tooltipDelay: 200, zoomView: true, dragView: true },
        layout: { randomSeed: 42 }
    };

    if (network && containerId === 'network-graph') { network.destroy(); }

    const net = new vis.Network(container, { nodes, edges }, options);

    if (containerId === 'network-graph') {
        network = net;
        network.nodesDS = nodes;
        network.edgesDS = edges;
    }

    setTimeout(() => net.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } }), 100);
    return net;
}

function highlightAssignments(assignments, customers, warehouses) {
    if (!network || !network.edgesDS) return;
    const allEdges = network.edgesDS.get();
    allEdges.forEach(e => {
        network.edgesDS.update({ id: e.id, color: { color: '#e0e0e0', opacity: 0.3 }, width: 1, arrows: { to: { enabled: false } }, dashes: false });
    });
    assignments.forEach((a, idx) => {
        const edgeId = `e${a.customerId}_${a.warehouseId}`;
        const edge = network.edgesDS.get(edgeId);
        if (edge) {
            setTimeout(() => {
                network.edgesDS.update({
                    id: edgeId, color: { color: '#0c831f', opacity: 1 }, width: 3,
                    arrows: { to: { enabled: true, scaleFactor: 0.6 } }, dashes: false,
                    shadow: { enabled: true, color: 'rgba(12,131,31,0.4)', size: 6 }
                });
            }, idx * 150);
        }
    });
}

function initHeroGraph() {
    const container = document.getElementById('hero-graph');
    if (!container) return;
    const nodes = new vis.DataSet([
        { id: 1, label: '📦 Order 1', shape: 'dot', size: 18, color: { background: '#4A90D9', border: '#2a6cb8' }, font: { color: '#333', size: 10 }, x: -150, y: -80 },
        { id: 2, label: '📦 Order 2', shape: 'dot', size: 15, color: { background: '#4A90D9', border: '#2a6cb8' }, font: { color: '#333', size: 10 }, x: -150, y: 0 },
        { id: 3, label: '📦 Order 3', shape: 'dot', size: 20, color: { background: '#4A90D9', border: '#2a6cb8' }, font: { color: '#333', size: 10 }, x: -150, y: 80 },
        { id: 4, label: '🏭 WH-A', shape: 'box', color: { background: '#0c831f', border: '#064d13' }, font: { color: 'white', size: 10 }, x: 150, y: -50 },
        { id: 5, label: '🏭 WH-B', shape: 'box', color: { background: '#0c831f', border: '#064d13' }, font: { color: 'white', size: 10 }, x: 150, y: 50 }
    ]);
    const edges = new vis.DataSet([
        { from: 1, to: 4, color: { color: '#0c831f' }, width: 2, arrows: { to: { enabled: true, scaleFactor: 0.5 } }, label: '5 min', font: { size: 9, color: '#666' } },
        { from: 2, to: 5, color: { color: '#0c831f' }, width: 2, arrows: { to: { enabled: true, scaleFactor: 0.5 } }, label: '3 min', font: { size: 9, color: '#666' } },
        { from: 3, to: 4, color: { color: '#ddd' }, width: 1, dashes: true, label: '8 min', font: { size: 9, color: '#aaa' } },
        { from: 3, to: 5, color: { color: '#0c831f' }, width: 2, arrows: { to: { enabled: true, scaleFactor: 0.5 } }, label: '4 min', font: { size: 9, color: '#666' } },
        { from: 1, to: 5, color: { color: '#ddd' }, width: 1, dashes: true, label: '12 min', font: { size: 9, color: '#aaa' } },
        { from: 2, to: 4, color: { color: '#ddd' }, width: 1, dashes: true, label: '10 min', font: { size: 9, color: '#aaa' } }
    ]);
    heroNetwork = new vis.Network(container, { nodes, edges }, {
        physics: { enabled: false },
        interaction: { dragNodes: false, dragView: false, zoomView: false }
    });
}

// ═══════════════════════════════════════════════════════════════
// SIMULATION.JS — Two-phase delivery simulation with pickup + delivery
// ═══════════════════════════════════════════════════════════════

let simNetwork = null;
let simNodes = null;
let simEdges = null;
let simAnimating = false;

function initSimGraph(order) {
    const container = document.getElementById('sim-graph');
    if (!container || !order.decisionSteps) return;

    const ds = order.decisionSteps;
    const whCandidates = ds.warehouseCandidates || [];
    const ptCandidates = ds.partnerCandidates || [];

    const nodes = [];
    const edges = [];

    // Customer node (bottom-left)
    nodes.push({
        id: 'customer', label: '📦 ' + order.customerName,
        x: -280, y: 180,
        shape: 'dot', size: 30,
        color: { background: '#4A90D9', border: '#2c6fbb' },
        font: { size: 13, color: '#1a1a2e', bold: true },
        fixed: true, shadow: true
    });

    // Warehouse nodes (center column)
    whCandidates.forEach((wh, i) => {
        const yOff = (i - (whCandidates.length - 1) / 2) * 140;
        nodes.push({
            id: 'wh_' + wh.id, label: '🏭 ' + wh.name,
            x: 0, y: yOff,
            shape: 'dot', size: 25,
            color: { background: '#ccc', border: '#999' },
            font: { size: 11, color: '#666' },
            fixed: true, shadow: false
        });
        edges.push({
            id: 'cw_' + wh.id, from: 'customer', to: 'wh_' + wh.id,
            label: wh.distance + ' min',
            color: { color: '#ddd' }, width: 1, dashes: true,
            font: { size: 10, color: '#999', strokeWidth: 3, strokeColor: '#fff' },
            smooth: { type: 'curvedCW', roundness: 0.12 * (i % 2 === 0 ? 1 : -1) }
        });
    });

    // Partner nodes (right column)
    ptCandidates.forEach((pt, i) => {
        const yOff = (i - (ptCandidates.length - 1) / 2) * 100;
        nodes.push({
            id: 'pt_' + pt.id, label: '🛵 ' + pt.name,
            x: 300, y: yOff,
            shape: 'dot', size: 20,
            color: { background: '#ccc', border: '#999' },
            font: { size: 10, color: '#666' },
            fixed: true, shadow: false
        });
    });

    simNodes = new vis.DataSet(nodes);
    simEdges = new vis.DataSet(edges);

    simNetwork = new vis.Network(container, { nodes: simNodes, edges: simEdges }, {
        physics: false,
        interaction: { dragNodes: false, zoomView: true, dragView: true },
        edges: { arrows: { to: { enabled: true, scaleFactor: 0.5 } } }
    });
    simNetwork.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
}

// ─── Main Animation Sequence ─────────────────────────────────
async function runSimAnimation(order) {
    if (simAnimating) return;
    simAnimating = true;
    const ds = order.decisionSteps;
    if (!ds) { simAnimating = false; return; }

    const statusEl = document.getElementById('sim-status-text');
    const progressBar = document.getElementById('sim-progress');
    const progressFill = document.getElementById('sim-progress-fill');
    const stepsEl = document.getElementById('sim-steps');
    const detailPanel = document.getElementById('sim-detail');

    if (detailPanel) detailPanel.style.display = 'block';
    if (progressBar) progressBar.style.display = 'block';
    document.getElementById('detail-order-id').textContent = order.id;

    const whCandidates = ds.warehouseCandidates || [];
    const ptCandidates = ds.partnerCandidates || [];
    const selWhId = ds.selectedWarehouseId;
    const selPtId = ds.selectedPartnerId;

    stepsEl.innerHTML = '';

    const addStep = (icon, label, detail, isActive) => {
        const el = document.createElement('div');
        el.className = 'sim-step' + (isActive ? ' active' : '');
        el.innerHTML = '<div class="sim-step-dot">' + icon + '</div>' +
            '<div class="sim-step-body"><strong>' + label + '</strong>' +
            (detail ? '<span>' + detail + '</span>' : '') + '</div>';
        stepsEl.appendChild(el);
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return el;
    };
    const setProgress = (pct) => { if (progressFill) progressFill.style.width = pct + '%'; };
    const setBadge = (text, color) => {
        const b = document.getElementById('detail-stage-badge');
        if (b) { b.textContent = text; b.style.background = color; }
    };
    const wait = (ms) => new Promise(r => setTimeout(r, ms));

    // ═══════════════════════════════════════════════════════════
    // STEP 1: ORDER PLACED
    // ═══════════════════════════════════════════════════════════
    statusEl.textContent = '📦 New order received!';
    setBadge('Order Placed', '#6b7280');
    setProgress(5);
    addStep('📦', 'Order Placed', order.totalItems + ' items · ₹' + order.totalPrice, true);

    if (simNodes) simNodes.update({
        id: 'customer',
        color: { background: '#4A90D9', border: '#1565c0' },
        shadow: { enabled: true, color: 'rgba(74,144,217,0.5)', size: 20 }
    });
    await wait(1800);

    // ═══════════════════════════════════════════════════════════
    // STEP 2: EVALUATING STORES
    // ═══════════════════════════════════════════════════════════
    statusEl.textContent = '🔍 Evaluating available stores...';
    setProgress(12);
    addStep('🔍', 'Finding Nearest Store', 'Checking ' + whCandidates.length + ' stores...', true);

    for (let i = 0; i < whCandidates.length; i++) {
        const wh = whCandidates[i];
        // Highlight current candidate
        if (simNodes) simNodes.update({ id: 'wh_' + wh.id, color: { background: '#fff3cd', border: '#f8cb46' }, font: { color: '#333', size: 12 } });
        if (simEdges) simEdges.update({ id: 'cw_' + wh.id, color: { color: '#f8cb46' }, width: 2.5, dashes: false });
        statusEl.textContent = '🔍 ' + wh.name + ' → ' + wh.distance + ' min (capacity: ' + wh.capacity + ')';
        setProgress(12 + ((i + 1) / whCandidates.length) * 13);
        await wait(1200);

        // Dim if not selected
        if (wh.id !== selWhId) {
            if (simNodes) simNodes.update({ id: 'wh_' + wh.id, color: { background: '#e5e7eb', border: '#ccc' }, font: { color: '#aaa' } });
            if (simEdges) simEdges.update({ id: 'cw_' + wh.id, color: { color: '#e5e7eb' }, width: 1, dashes: true });
        }
    }

    // ═══════════════════════════════════════════════════════════
    // STEP 3: STORE SELECTED
    // ═══════════════════════════════════════════════════════════
    statusEl.textContent = '✅ ' + ds.selectedWarehouseName + ' selected! (' + ds.warehouseDistance + ' min away)';
    setProgress(30);
    setBadge('Store Assigned', '#0c831f');
    addStep('🏭', 'Store: ' + ds.selectedWarehouseName, 'Distance: ' + ds.warehouseDistance + ' min · Nearest available', true);

    if (simNodes) simNodes.update({
        id: 'wh_' + selWhId,
        color: { background: '#0c831f', border: '#064d13' },
        font: { color: '#fff', size: 13, bold: true },
        shadow: { enabled: true, color: 'rgba(12,131,31,0.4)', size: 15 }
    });
    if (simEdges) simEdges.update({
        id: 'cw_' + selWhId,
        color: { color: '#0c831f' }, width: 4, dashes: false,
        font: { color: '#0c831f', bold: true }
    });
    await wait(1800);

    // ═══════════════════════════════════════════════════════════
    // STEP 4: FINDING DELIVERY PARTNER
    // ═══════════════════════════════════════════════════════════
    statusEl.textContent = '🛵 Finding nearest delivery partner...';
    setProgress(38);
    addStep('🔍', 'Finding Delivery Partner', 'Checking ' + ptCandidates.length + ' riders near store...', true);

    // Add edges from selected warehouse to all partners
    for (let i = 0; i < ptCandidates.length; i++) {
        const pt = ptCandidates[i];
        try {
            simEdges.add({
                id: 'wp_' + pt.id, from: 'wh_' + selWhId, to: 'pt_' + pt.id,
                label: pt.distanceToWarehouse + ' min',
                color: { color: '#ddd' }, width: 1, dashes: true,
                font: { size: 9, color: '#999', strokeWidth: 3, strokeColor: '#fff' },
                smooth: { type: 'curvedCW', roundness: 0.08 * (i % 2 === 0 ? 1 : -1) }
            });
        } catch (e) {}
    }
    await wait(600);

    // Evaluate each partner
    for (let i = 0; i < ptCandidates.length; i++) {
        const pt = ptCandidates[i];
        if (!pt.available) continue;
        if (simNodes) simNodes.update({ id: 'pt_' + pt.id, color: { background: '#fff3cd', border: '#ff9800' }, font: { color: '#333', size: 11 } });
        try { simEdges.update({ id: 'wp_' + pt.id, color: { color: '#ff9800' }, width: 2.5, dashes: false }); } catch (e) {}
        statusEl.textContent = '🛵 ' + pt.name + ' → ' + pt.distanceToWarehouse + ' min from store';
        setProgress(38 + ((i + 1) / ptCandidates.length) * 12);
        await wait(1000);

        if (pt.id !== selPtId) {
            if (simNodes) simNodes.update({ id: 'pt_' + pt.id, color: { background: '#e5e7eb', border: '#ccc' }, font: { color: '#aaa' } });
            try { simEdges.update({ id: 'wp_' + pt.id, color: { color: '#e5e7eb' }, width: 1, dashes: true }); } catch (e) {}
        }
    }

    // ═══════════════════════════════════════════════════════════
    // STEP 5: PARTNER SELECTED
    // ═══════════════════════════════════════════════════════════
    statusEl.textContent = '✅ ' + ds.selectedPartnerName + ' assigned! (Pickup: ' + ds.pickupTime + ' min)';
    setProgress(55);
    setBadge('Rider Assigned', '#ff9800');
    addStep('🛵', 'Rider: ' + ds.selectedPartnerName, 'Pickup time: ' + ds.pickupTime + ' min from store', true);

    if (simNodes) simNodes.update({
        id: 'pt_' + selPtId,
        color: { background: '#ff9800', border: '#e65100' },
        font: { color: '#fff', size: 12, bold: true },
        shadow: { enabled: true, color: 'rgba(255,152,0,0.4)', size: 15 }
    });
    try {
        simEdges.update({
            id: 'wp_' + selPtId,
            color: { color: '#ff9800' }, width: 4, dashes: false,
            font: { color: '#e65100', bold: true }
        });
    } catch (e) {}
    await wait(1500);

    // ═══════════════════════════════════════════════════════════
    // STEP 6: PICKUP PHASE — Rider moves to Store
    // ═══════════════════════════════════════════════════════════
    statusEl.textContent = '🟠 ' + ds.selectedPartnerName + ' heading to store for pickup...';
    setProgress(60);
    setBadge('Heading to Store', '#ff9800');
    addStep('🟠', 'Pickup: Rider → Store', ds.selectedPartnerName + ' traveling to ' + ds.selectedWarehouseName + '...', true);

    // Animate the pickup edge (partner → warehouse) with pulsing
    try {
        simEdges.update({
            id: 'wp_' + selPtId,
            color: { color: '#ff9800' }, width: 5,
            dashes: [10, 5],
            label: '🛵 Heading to store · ' + ds.pickupTime + ' min'
        });
    } catch (e) {}

    // Simulate rider movement along the pickup path
    const pickupSteps = 8;
    for (let i = 1; i <= pickupSteps; i++) {
        setProgress(60 + (i / pickupSteps) * 10);
        const remaining = (ds.pickupTime * (1 - i / pickupSteps)).toFixed(1);
        statusEl.textContent = '🟠 Rider heading to store... ' + remaining + ' min remaining';
        try {
            simEdges.update({
                id: 'wp_' + selPtId,
                dashes: i === pickupSteps ? false : [10, 5],
                width: 4 + (i % 2)
            });
        } catch (e) {}
        await wait(400);
    }

    // Pickup complete — rider arrived at warehouse
    statusEl.textContent = '📦 ' + ds.selectedPartnerName + ' arrived! Picking up order...';
    setProgress(72);
    addStep('📦', 'Order Picked Up', ds.selectedPartnerName + ' picked up from ' + ds.selectedWarehouseName, true);

    try {
        simEdges.update({
            id: 'wp_' + selPtId,
            color: { color: '#0c831f' }, width: 3, dashes: false,
            label: '✅ Picked up · ' + ds.pickupTime + ' min',
            font: { color: '#0c831f', bold: true }
        });
    } catch (e) {}

    // Flash the warehouse to show pickup
    if (simNodes) {
        simNodes.update({ id: 'wh_' + selWhId, shadow: { enabled: true, color: 'rgba(248,203,70,0.6)', size: 25 } });
    }
    await wait(1500);
    if (simNodes) {
        simNodes.update({ id: 'wh_' + selWhId, shadow: { enabled: true, color: 'rgba(12,131,31,0.3)', size: 10 } });
    }

    // ═══════════════════════════════════════════════════════════
    // STEP 7: DELIVERY PHASE — Rider moves from Store to Customer
    // ═══════════════════════════════════════════════════════════
    statusEl.textContent = '🔵 ' + ds.selectedPartnerName + ' out for delivery!';
    setProgress(75);
    setBadge('Out for Delivery', '#4A90D9');
    addStep('🔵', 'Delivery: Store → Customer', ds.selectedPartnerName + ' delivering to ' + order.customerName + '...', true);

    // Add delivery edge: warehouse → customer (blue)
    try {
        simEdges.add({
            id: 'delivery_route',
            from: 'wh_' + selWhId, to: 'customer',
            label: '🛵 Delivering · ' + ds.storeToCustomer + ' min',
            color: { color: '#4A90D9' }, width: 5,
            dashes: [10, 5],
            font: { size: 11, color: '#4A90D9', strokeWidth: 3, strokeColor: '#fff', bold: true },
            smooth: { type: 'curvedCCW', roundness: 0.25 }
        });
    } catch (e) {}

    // Simulate rider movement along the delivery path
    const deliverySteps = 10;
    for (let i = 1; i <= deliverySteps; i++) {
        setProgress(75 + (i / deliverySteps) * 20);
        const remaining = (ds.storeToCustomer * (1 - i / deliverySteps)).toFixed(1);
        statusEl.textContent = '🔵 Out for delivery... ' + remaining + ' min remaining';
        try {
            simEdges.update({
                id: 'delivery_route',
                dashes: i === deliverySteps ? false : [10, 5],
                width: 4 + (i % 2),
                label: i === deliverySteps ? '✅ Delivered!' : '🛵 ' + remaining + ' min left'
            });
        } catch (e) {}
        await wait(500);
    }

    // ═══════════════════════════════════════════════════════════
    // STEP 8: DELIVERED
    // ═══════════════════════════════════════════════════════════
    statusEl.textContent = '✅ Order delivered! Total time: ' + ds.totalTime + ' min';
    setProgress(100);
    setBadge('Delivered', '#22c55e');
    addStep('✅', 'Delivered!', 'Completed in ' + ds.totalTime + ' min (Pickup: ' + ds.pickupTime + ' min + Delivery: ' + ds.storeToCustomer + ' min)', true);

    // Final delivery edge solid blue
    try {
        simEdges.update({
            id: 'delivery_route',
            color: { color: '#22c55e' }, width: 5, dashes: false,
            label: '✅ Delivered · ' + ds.storeToCustomer + ' min',
            font: { color: '#22c55e', bold: true }
        });
    } catch (e) {}

    // Glow customer node green
    if (simNodes) simNodes.update({
        id: 'customer',
        color: { background: '#22c55e', border: '#16a34a' },
        shadow: { enabled: true, color: 'rgba(34,197,94,0.5)', size: 25 }
    });

    // Show summary
    const infoEl = document.getElementById('sim-info');
    if (infoEl) {
        infoEl.innerHTML =
            '<div class="sim-summary">' +
            '<div class="sim-summary-item"><span>🏭 Store</span><strong>' + ds.selectedWarehouseName + '</strong></div>' +
            '<div class="sim-summary-item"><span>🛵 Rider</span><strong>' + ds.selectedPartnerName + '</strong></div>' +
            '<div class="sim-summary-item"><span>🟠 Pickup</span><strong>' + ds.pickupTime + ' min</strong></div>' +
            '<div class="sim-summary-item"><span>🔵 Delivery</span><strong>' + ds.storeToCustomer + ' min</strong></div>' +
            '<div class="sim-summary-item"><span>⏱️ Total</span><strong>' + ds.totalTime + ' min</strong></div>' +
            '<div class="sim-summary-item"><span>🎯 Mode</span><strong>' + (StrategyLabels[order.strategy]?.name || order.strategy) + '</strong></div>' +
            '</div>';
    }

    simAnimating = false;
}

function startSimForOrder(order) {
    initSimGraph(order);
    setTimeout(() => runSimAnimation(order), 500);
}

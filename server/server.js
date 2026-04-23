const express = require('express');
const cors = require('cors');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// ─── In-Memory State ────────────────────────────────────────────
let orders = [];
let orderIdCounter = 1000;

const warehouseState = [
    { id: 0, name: 'FreshMart Central', capacity: 15, currentLoad: 0, orders: [] },
    { id: 1, name: 'QuickStore Hub', capacity: 12, currentLoad: 0, orders: [] },
    { id: 2, name: 'SpeedyMart Depot', capacity: 10, currentLoad: 0, orders: [] }
];

const partnerState = [
    { id: 0, name: 'Rider Amit', nearestWarehouse: 0, status: 'available', currentOrder: null },
    { id: 1, name: 'Rider Priya', nearestWarehouse: 1, status: 'available', currentOrder: null },
    { id: 2, name: 'Rider Rahul', nearestWarehouse: 2, status: 'available', currentOrder: null },
    { id: 3, name: 'Rider Sneha', nearestWarehouse: 0, status: 'available', currentOrder: null },
    { id: 4, name: 'Rider Karan', nearestWarehouse: 1, status: 'available', currentOrder: null }
];

// Customer-Warehouse distance matrix (3 customer zones x 3 warehouses)
const custWhDistance = [
    [3, 8, 12],
    [7, 4, 6],
    [10, 5, 3]
];

// Partner-Warehouse distance matrix (5 partners x 3 warehouses)
const partnerWhDistance = [
    [2, 9, 11],
    [8, 2, 7],
    [12, 6, 2],
    [3, 10, 9],
    [9, 3, 8]
];

const ORDER_STAGES = ['placed', 'processing', 'warehouse_assigned', 'partner_assigned', 'out_for_delivery', 'delivered'];

// ─── Health ─────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Place Order ────────────────────────────────────────────────
app.post('/api/order', (req, res) => {
    const { items, customerName, customerZone, strategy } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'No items in order' });
    }

    const orderId = 'ORD-' + (orderIdCounter++);
    const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
    const totalPrice = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const zone = customerZone || Math.floor(Math.random() * 3);

    // Build C++ input
    const inputData = {
        mode: 'order',
        strategy: strategy || 'optimal',
        customerIndex: 0,
        customers: [{ id: 0, name: customerName || 'Customer', orderSize: totalItems }],
        warehouses: warehouseState.map(w => ({ id: w.id, name: w.name, capacity: w.capacity - w.currentLoad })),
        distanceMatrix: [custWhDistance[zone]],
        partners: partnerState
            .filter(p => p.status === 'available')
            .map((p, idx) => ({ id: p.id, name: p.name, nearestWarehouse: p.nearestWarehouse, available: true })),
        partnerWarehouseDist: partnerState
            .filter(p => p.status === 'available')
            .map(p => partnerWhDistance[p.id])
    };

    const inputPath = path.join(dataDir, `input_${orderId}.json`);
    const outputPath = path.join(dataDir, `output_${orderId}.json`);

    fs.writeFileSync(inputPath, JSON.stringify(inputData, null, 2));

    const exePath = path.join(__dirname, '..', 'backend', 'smart_delivery.exe');
    if (!fs.existsSync(exePath)) {
        return res.status(500).json({ error: 'Backend not compiled' });
    }

    execFile(exePath, [inputPath, outputPath], { timeout: 15000 }, (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({ error: 'Backend failed: ' + (stderr || error.message) });
        }

        let result;
        try { result = JSON.parse(fs.readFileSync(outputPath, 'utf8')); }
        catch (err) { return res.status(500).json({ error: 'Failed to read output' }); }

        const or_ = result.orderResult || {};
        const ds = result.decisionSteps || {};

        const order = {
            id: orderId,
            items,
            totalItems,
            totalPrice,
            customerName: customerName || 'Customer',
            customerZone: zone,
            stage: 'placed',
            stageIndex: 0,
            warehouseId: or_.warehouseId,
            warehouseName: or_.warehouseName || 'Unknown',
            partnerId: or_.partnerId,
            partnerName: or_.partnerName || 'Unknown',
            pickupTime: or_.pickupTime || 0,
            storeToCustomer: or_.storeToCustomer || 0,
            totalTime: or_.totalTime || 0,
            strategy: or_.strategy || strategy || 'optimal',
            placedAt: Date.now(),
            decisionSteps: ds,
            timeline: [{ stage: 'placed', time: Date.now(), message: 'Order placed successfully' }]
        };

        // Update warehouse state
        if (order.warehouseId >= 0 && order.warehouseId < warehouseState.length) {
            warehouseState[order.warehouseId].currentLoad += totalItems;
            warehouseState[order.warehouseId].orders.push(orderId);
        }

        orders.push(order);

        // Auto-advance order through stages
        autoAdvanceOrder(orderId);

        // Cleanup temp files
        try { fs.unlinkSync(inputPath); fs.unlinkSync(outputPath); } catch(e) {}

        res.json({ orderId, order });
    });
});

// ─── Auto-advance order stages ──────────────────────────────────
function autoAdvanceOrder(orderId) {
    const delays = [1500, 2500, 3500, 5000, 7000]; // ms for each stage transition
    const messages = [
        'Finding nearest store...',
        'Store accepted! Packing your order...',
        'Delivery partner assigned!',
        'Your order is on the way!',
        'Order delivered! Thank you!'
    ];

    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            const order = orders.find(o => o.id === orderId);
            if (!order || order.stage === 'delivered') return;

            order.stageIndex = i + 1;
            order.stage = ORDER_STAGES[i + 1];
            order.timeline.push({
                stage: ORDER_STAGES[i + 1],
                time: Date.now(),
                message: messages[i]
            });

            // Update partner status
            if (ORDER_STAGES[i + 1] === 'partner_assigned' && order.partnerId >= 0) {
                const partner = partnerState.find(p => p.id === order.partnerId);
                if (partner) { partner.status = 'assigned'; partner.currentOrder = orderId; }
            }
            if (ORDER_STAGES[i + 1] === 'out_for_delivery' && order.partnerId >= 0) {
                const partner = partnerState.find(p => p.id === order.partnerId);
                if (partner) partner.status = 'delivering';
            }
            if (ORDER_STAGES[i + 1] === 'delivered') {
                // Free up partner
                if (order.partnerId >= 0) {
                    const partner = partnerState.find(p => p.id === order.partnerId);
                    if (partner) { partner.status = 'available'; partner.currentOrder = null; }
                }
                // Free up warehouse
                if (order.warehouseId >= 0 && order.warehouseId < warehouseState.length) {
                    warehouseState[order.warehouseId].currentLoad = Math.max(0, warehouseState[order.warehouseId].currentLoad - order.totalItems);
                    warehouseState[order.warehouseId].orders = warehouseState[order.warehouseId].orders.filter(id => id !== orderId);
                }
            }
        }, delays[i]);
    }
}

// ─── Get Orders ─────────────────────────────────────────────────
app.get('/api/orders', (req, res) => {
    res.json(orders.slice().reverse());
});

app.get('/api/orders/:id', (req, res) => {
    const order = orders.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
});

// ─── Warehouse State ────────────────────────────────────────────
app.get('/api/warehouses', (req, res) => {
    res.json(warehouseState);
});

// ─── Partner State ──────────────────────────────────────────────
app.get('/api/partners', (req, res) => {
    res.json(partnerState);
});

// ─── Full Simulation (Analytics) ────────────────────────────────
app.post('/api/simulate', (req, res) => {
    const inputData = req.body;
    if (!inputData.customers || !inputData.warehouses || !inputData.distanceMatrix) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    inputData.mode = 'simulate';
    const inputPath = path.join(dataDir, 'input.json');
    const outputPath = path.join(dataDir, 'output.json');

    fs.writeFileSync(inputPath, JSON.stringify(inputData, null, 2));

    const exePath = path.join(__dirname, '..', 'backend', 'smart_delivery.exe');
    if (!fs.existsSync(exePath)) return res.status(500).json({ error: 'Backend not compiled' });

    execFile(exePath, [inputPath, outputPath], { timeout: 30000 }, (error, stdout, stderr) => {
        if (error) return res.status(500).json({ error: 'Backend failed: ' + (stderr || error.message) });
        try {
            const outputData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
            res.json(outputData);
        } catch (err) { res.status(500).json({ error: 'Failed to read output' }); }
    });
});

// ─── Reset ──────────────────────────────────────────────────────
app.post('/api/reset', (req, res) => {
    orders = [];
    orderIdCounter = 1000;
    warehouseState.forEach(w => { w.currentLoad = 0; w.orders = []; });
    partnerState.forEach(p => { p.status = 'available'; p.currentOrder = null; });
    res.json({ success: true });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n🚀 Smart Delivery Optimizer`);
    console.log(`   Dashboard: http://localhost:${PORT}`);
    console.log(`   API:       http://localhost:${PORT}/api/health\n`);
});

// ═══════════════════════════════════════════════════════════════
// APP.JS — Main application logic
// ═══════════════════════════════════════════════════════════════

let cart = [];
let currentCategory = 'All';
let activeOrderId = null;
let pollInterval = null;
let simState = { customers: [], warehouses: [], distanceMatrix: [], results: null, currentStrategy: null };

// ─── Navigation ──────────────────────────────────────────────
function navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const t = document.getElementById('page-' + page);
    const n = document.getElementById('nav-' + page);
    if (t) t.classList.add('active');
    if (n) n.classList.add('active');
    if (page === 'order') renderProducts();
    if (page === 'live') { loadOrders(); startPolling(); }
    if (page === 'stores') loadStores();
    if (page === 'partners') loadPartners();
    if (page !== 'live') stopPolling();
}
document.querySelectorAll('.nav-link').forEach(b => b.addEventListener('click', () => navigateTo(b.dataset.page)));

// ─── Server Check ────────────────────────────────────────────
async function checkServer() {
    try {
        const r = await fetch('/api/health');
        if (r.ok) { document.getElementById('server-status').className = 'status-dot online'; document.getElementById('server-status-text').textContent = 'Online'; return true; }
    } catch(e) {}
    document.getElementById('server-status').className = 'status-dot offline';
    document.getElementById('server-status-text').textContent = 'Offline';
    return false;
}
setInterval(checkServer, 10000); checkServer();

// ─── Toast ───────────────────────────────────────────────────
function showToast(msg, type) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div'); t.className = 'toast ' + (type||'info'); t.textContent = msg;
    c.appendChild(t); setTimeout(() => { t.style.opacity='0'; setTimeout(() => t.remove(), 300); }, 3000);
}

// ═══════════════════════════════════════════════════════════════
// ORDER PAGE — Products & Cart
// ═══════════════════════════════════════════════════════════════

function renderCategories() {
    const tabs = document.getElementById('category-tabs');
    if (!tabs) return;
    tabs.innerHTML = '';
    Categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'cat-tab' + (cat === currentCategory ? ' active' : '');
        btn.textContent = cat;
        btn.onclick = () => { currentCategory = cat; renderCategories(); renderProducts(); };
        tabs.appendChild(btn);
    });
}

function renderProducts() {
    renderCategories();
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const items = currentCategory === 'All' ? ProductCatalog : ProductCatalog.filter(p => p.category === currentCategory);
    items.forEach(p => {
        const inCart = cart.find(c => c.id === p.id);
        const qty = inCart ? inCart.quantity : 0;
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = '<div class="product-emoji">' + p.emoji + '</div>' +
            '<div class="product-info"><h3>' + p.name + '</h3><span class="product-unit">' + p.unit + '</span>' +
            '<div class="product-bottom"><span class="product-price">₹' + p.price + '</span>' +
            (qty > 0
                ? '<div class="qty-control"><button class="qty-btn" onclick="updateCart(' + p.id + ',-1)">−</button><span class="qty-val">' + qty + '</span><button class="qty-btn" onclick="updateCart(' + p.id + ',1)">+</button></div>'
                : '<button class="btn btn-primary btn-sm add-btn" onclick="addToCart(' + p.id + ')">ADD</button>'
            ) + '</div></div>';
        grid.appendChild(card);
    });
}

function addToCart(id) {
    const p = ProductCatalog.find(x => x.id === id);
    if (!p) return;
    const existing = cart.find(c => c.id === id);
    if (existing) existing.quantity++;
    else cart.push({ ...p, quantity: 1 });
    renderProducts(); renderCart();
}

function updateCart(id, delta) {
    const item = cart.find(c => c.id === id);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) cart = cart.filter(c => c.id !== id);
    renderProducts(); renderCart();
}

function renderCart() {
    const items = document.getElementById('cart-items');
    const footer = document.getElementById('cart-footer');
    const empty = document.getElementById('cart-empty');
    const countEl = document.getElementById('cart-count');
    const badge = document.getElementById('cart-badge-nav');
    if (!items) return;

    const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const count = cart.reduce((s, i) => s + i.quantity, 0);

    if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'inline-flex' : 'none'; }
    if (countEl) countEl.textContent = count + ' items';

    if (cart.length === 0) {
        if (empty) empty.style.display = 'block';
        if (footer) footer.style.display = 'none';
        items.querySelectorAll('.cart-item').forEach(e => e.remove());
        return;
    }
    if (empty) empty.style.display = 'none';
    if (footer) footer.style.display = 'block';

    // Clear old items but keep empty div
    items.querySelectorAll('.cart-item').forEach(e => e.remove());

    cart.forEach(item => {
        const el = document.createElement('div');
        el.className = 'cart-item';
        el.innerHTML = '<span class="cart-item-emoji">' + item.emoji + '</span>' +
            '<div class="cart-item-info"><span class="cart-item-name">' + item.name + '</span>' +
            '<span class="cart-item-price">₹' + (item.price * item.quantity) + '</span></div>' +
            '<div class="qty-control"><button class="qty-btn" onclick="updateCart(' + item.id + ',-1)">−</button>' +
            '<span class="qty-val">' + item.quantity + '</span>' +
            '<button class="qty-btn" onclick="updateCart(' + item.id + ',1)">+</button></div>';
        items.appendChild(el);
    });

    document.getElementById('cart-total').textContent = '₹' + total;
}

// ─── Place Order ─────────────────────────────────────────────
async function placeOrder() {
    if (cart.length === 0) { showToast('Cart is empty!', 'error'); return; }
    const online = await checkServer();
    if (!online) { showToast('Server offline', 'error'); return; }

    document.getElementById('loading-overlay').style.display = 'flex';

    try {
        const res = await fetch('/api/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity, emoji: i.emoji })),
                customerName: 'Customer',
                customerZone: Math.floor(Math.random() * 6),
                strategy: document.getElementById('order-strategy').value
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        activeOrderId = data.orderId;
        cart = [];
        renderCart(); renderProducts();
        showToast('Order placed! ' + data.orderId, 'success');
        navigateTo('live');
    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        document.getElementById('loading-overlay').style.display = 'none';
    }
}

// ═══════════════════════════════════════════════════════════════
// LIVE SIMULATION PAGE
// ═══════════════════════════════════════════════════════════════

let lastSimmedOrder = null;

function startPolling() { stopPolling(); pollInterval = setInterval(loadOrders, 2000); }
function stopPolling() { if (pollInterval) { clearInterval(pollInterval); pollInterval = null; } }

async function loadOrders() {
    try {
        const res = await fetch('/api/orders');
        const orders = await res.json();
        renderOrderList(orders);
    } catch(e) {}
}

function renderOrderList(orders) {
    const container = document.getElementById('live-orders');
    const empty = document.getElementById('live-empty');
    if (!container) return;

    container.querySelectorAll('.order-card').forEach(e => e.remove());
    if (orders.length === 0) { if (empty) empty.style.display = 'block'; return; }
    if (empty) empty.style.display = 'none';

    orders.forEach(order => {
        const card = document.createElement('div');
        card.className = 'order-card' + (order.id === activeOrderId ? ' active' : '');
        card.onclick = () => {
            activeOrderId = order.id;
            loadOrders();
            // Only run simulation if not already simmed for this order
            if (lastSimmedOrder !== order.id && order.decisionSteps) {
                lastSimmedOrder = order.id;
                startSimForOrder(order);
            }
        };
        const stageInfo = STAGE_LABELS[order.stage] || order.stage;
        const color = STAGE_COLORS[order.stage] || '#666';
        card.innerHTML = '<div class="order-card-top"><strong>' + order.id + '</strong>' +
            '<span class="stage-badge" style="background:' + color + '">' + stageInfo + '</span></div>' +
            '<div class="order-card-body"><span>' + order.totalItems + ' items · ₹' + order.totalPrice + '</span>' +
            '<span class="order-card-info">🏭 ' + order.warehouseName + ' · 🛵 ' + order.partnerName + '</span></div>';
        container.appendChild(card);
    });

    // Auto-trigger simulation for the active/new order
    if (activeOrderId && lastSimmedOrder !== activeOrderId) {
        const order = orders.find(o => o.id === activeOrderId);
        if (order && order.decisionSteps) {
            lastSimmedOrder = activeOrderId;
            startSimForOrder(order);
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// STORES & PARTNERS PAGES
// ═══════════════════════════════════════════════════════════════

async function loadStores() {
    try {
        const res = await fetch('/api/warehouses');
        const stores = await res.json();
        const grid = document.getElementById('stores-grid');
        if (!grid) return;
        grid.innerHTML = '';
        stores.forEach(s => {
            const pct = s.capacity > 0 ? Math.round((s.currentLoad / s.capacity) * 100) : 0;
            const color = pct > 80 ? '#ef4444' : pct > 50 ? '#f8cb46' : '#0c831f';
            const card = document.createElement('div');
            card.className = 'store-card';
            card.innerHTML = '<div class="store-card-header"><h3>🏭 ' + s.name + '</h3>' +
                '<span class="store-status" style="color:' + color + '">' + pct + '% Full</span></div>' +
                '<div class="store-stats"><div class="store-stat"><span>Capacity</span><strong>' + s.capacity + '</strong></div>' +
                '<div class="store-stat"><span>Load</span><strong>' + s.currentLoad + '</strong></div>' +
                '<div class="store-stat"><span>Orders</span><strong>' + s.orders.length + '</strong></div></div>' +
                '<div class="load-bar-track"><div class="load-bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
                (s.orders.length > 0 ? '<div class="store-orders">' + s.orders.map(o => '<span class="order-tag">' + o + '</span>').join('') + '</div>' : '');
            grid.appendChild(card);
        });
    } catch(e) {}
}

async function loadPartners() {
    try {
        const res = await fetch('/api/partners');
        const partners = await res.json();
        const grid = document.getElementById('partners-grid');
        if (!grid) return;
        grid.innerHTML = '';
        const statusColors = { available: '#22c55e', assigned: '#f8cb46', delivering: '#4A90D9' };
        partners.forEach(p => {
            const card = document.createElement('div');
            card.className = 'partner-card';
            card.innerHTML = '<div class="partner-avatar">🛵</div>' +
                '<div class="partner-info"><h3>' + p.name + '</h3>' +
                '<span class="partner-status" style="background:' + (statusColors[p.status]||'#999') + '">' + p.status.toUpperCase() + '</span></div>' +
                (p.currentOrder ? '<div class="partner-order">📦 ' + p.currentOrder + '</div>' : '<div class="partner-order" style="color:#999">No active order</div>');
            grid.appendChild(card);
        });
    } catch(e) {}
}

// ═══════════════════════════════════════════════════════════════
// ANALYTICS PAGE (existing simulation logic)
// ═══════════════════════════════════════════════════════════════

function addCustomer(name, size) {
    const id = simState.customers.length;
    simState.customers.push({ id, name: name || 'Customer ' + String.fromCharCode(65+id), orderSize: parseInt(size)||1 });
    renderSimCustomers(); renderMatrix();
}
function removeCustomer(id) {
    simState.customers = simState.customers.filter(c=>c.id!==id).map((c,i)=>({...c,id:i}));
    simState.distanceMatrix.splice(id,1); renderSimCustomers(); renderMatrix();
}
function renderSimCustomers() {
    const list = document.getElementById('customer-list'); if(!list) return; list.innerHTML='';
    simState.customers.forEach(c => {
        const row = document.createElement('div'); row.className='input-row';
        row.innerHTML='<label>C'+(c.id+1)+'</label><input type="text" value="'+c.name+'" onchange="simState.customers['+c.id+'].name=this.value">' +
            '<input type="number" value="'+c.orderSize+'" min="1" style="width:50px" onchange="simState.customers['+c.id+'].orderSize=parseInt(this.value)||1">' +
            '<button class="btn-remove" onclick="removeCustomer('+c.id+')">&times;</button>';
        list.appendChild(row);
    });
}
function addWarehouse(name, cap) {
    const id = simState.warehouses.length;
    simState.warehouses.push({ id, name: name||'Warehouse '+String.fromCharCode(913+id), capacity: parseInt(cap)||10 });
    simState.distanceMatrix.forEach(r=>r.push(5)); renderSimWarehouses(); renderMatrix();
}
function removeWarehouse(id) {
    simState.warehouses = simState.warehouses.filter(w=>w.id!==id).map((w,i)=>({...w,id:i}));
    simState.distanceMatrix.forEach(r=>r.splice(id,1)); renderSimWarehouses(); renderMatrix();
}
function renderSimWarehouses() {
    const list = document.getElementById('warehouse-list'); if(!list) return; list.innerHTML='';
    simState.warehouses.forEach(w => {
        const row = document.createElement('div'); row.className='input-row';
        row.innerHTML='<label style="color:#0c831f;font-weight:700">W'+(w.id+1)+'</label><input type="text" value="'+w.name+'" onchange="simState.warehouses['+w.id+'].name=this.value">' +
            '<input type="number" value="'+w.capacity+'" min="1" style="width:55px" onchange="simState.warehouses['+w.id+'].capacity=parseInt(this.value)||1">' +
            '<button class="btn-remove" onclick="removeWarehouse('+w.id+')">&times;</button>';
        list.appendChild(row);
    });
}
function renderMatrix() {
    const c = document.getElementById('matrix-container');
    if(!c || simState.customers.length===0 || simState.warehouses.length===0) { if(c) c.innerHTML='<p class="matrix-hint">Add customers & warehouses</p>'; return; }
    while(simState.distanceMatrix.length<simState.customers.length) simState.distanceMatrix.push(new Array(simState.warehouses.length).fill(5));
    simState.distanceMatrix = simState.distanceMatrix.slice(0,simState.customers.length);
    simState.distanceMatrix.forEach((r,i)=>{ while(r.length<simState.warehouses.length)r.push(5); simState.distanceMatrix[i]=r.slice(0,simState.warehouses.length); });
    let h='<table class="matrix-table"><thead><tr><th></th>';
    simState.warehouses.forEach(w=>{h+='<th>W'+(w.id+1)+'</th>';}); h+='</tr></thead><tbody>';
    simState.customers.forEach((cu,i)=>{h+='<tr><td class="matrix-label-row">C'+(cu.id+1)+'</td>';
        simState.warehouses.forEach((w,j)=>{h+='<td><input type="number" min="1" max="99" value="'+simState.distanceMatrix[i][j]+'" onchange="simState.distanceMatrix['+i+']['+j+']=parseFloat(this.value)||1"></td>';});
        h+='</tr>';}); h+='</tbody></table>'; c.innerHTML=h;
}
function loadSampleData(size) {
    const s = SampleData[size||'small'];
    simState.customers=JSON.parse(JSON.stringify(s.customers));
    simState.warehouses=JSON.parse(JSON.stringify(s.warehouses));
    simState.distanceMatrix=JSON.parse(JSON.stringify(s.distanceMatrix));
    renderSimCustomers(); renderSimWarehouses(); renderMatrix(); showToast('Loaded sample data','success');
}
function resetSim() {
    simState={customers:[],warehouses:[],distanceMatrix:[],results:null,currentStrategy:null};
    renderSimCustomers(); renderSimWarehouses(); renderMatrix();
    document.getElementById('results-placeholder').style.display='block';
    document.getElementById('results-content').style.display='none';
    document.getElementById('comparison-section').style.display='none';
    document.getElementById('graph-overlay').classList.remove('hidden');
    document.getElementById('graph-legend').style.display='none';
    ['btn-fast-mode','btn-balanced-mode','btn-optimal-mode','btn-compare-all'].forEach(id=>{const b=document.getElementById(id);if(b){b.disabled=true;b.classList.remove('active');}});
    destroyCharts(); showToast('Reset','info');
}
async function runSimulation() {
    const input = { customers:simState.customers, warehouses:simState.warehouses, distanceMatrix:simState.distanceMatrix };
    const errors = validateInput(input); if(errors.length>0){showToast(errors[0],'error');return;}
    if(!(await checkServer())){showToast('Server offline','error');return;}
    document.getElementById('loading-overlay').style.display='flex';
    try {
        const res = await fetch('/api/simulate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
        if(!res.ok){const e=await res.json();throw new Error(e.error);}
        simState.results = await res.json();
        ['btn-fast-mode','btn-balanced-mode','btn-optimal-mode','btn-compare-all'].forEach(id=>{const b=document.getElementById(id);if(b)b.disabled=false;});
        document.getElementById('graph-overlay').classList.add('hidden');
        document.getElementById('graph-legend').style.display='flex';
        initGraph('network-graph',simState.customers,simState.warehouses,simState.distanceMatrix);
        showStrategy('optimal'); showToast('Simulation complete!','success');
    } catch(e){showToast(e.message,'error');} finally{document.getElementById('loading-overlay').style.display='none';}
}
function showStrategy(key) {
    if(!simState.results) return;
    const s = simState.results.strategies[key]; if(!s) return;
    simState.currentStrategy=key;
    ['fast','balanced','optimal'].forEach(k=>{const b=document.getElementById('btn-'+k+'-mode');if(b)b.classList.toggle('active',k===key);});
    const badge=document.getElementById('current-strategy-badge');
    if(badge){badge.textContent=StrategyLabels[key].icon+' '+StrategyLabels[key].name;badge.className='strategy-badge '+key;badge.style.display='inline-block';}
    document.getElementById('results-placeholder').style.display='none';
    document.getElementById('results-content').style.display='block';
    document.getElementById('result-total-time').textContent=s.totalTime;
    document.getElementById('result-max-load').textContent=s.maxLoad;
    document.getElementById('result-efficiency').textContent=s.efficiency;
    const list=document.getElementById('assignment-list'); list.innerHTML='';
    s.assignments.forEach(a=>{
        const cn=simState.customers.find(c=>c.id===a.customerId)?.name||'C'+a.customerId;
        const wn=simState.warehouses.find(w=>w.id===a.warehouseId)?.name||'W'+a.warehouseId;
        const el=document.createElement('div');el.className='assignment-item';
        el.innerHTML='<span><span class="dot dot-blue"></span> '+cn+'</span><span>→</span><span style="color:#0c831f;font-weight:600">'+wn+'</span><span style="color:#999">'+a.time+' min</span>';
        list.appendChild(el);
    });
    const bars=document.getElementById('load-bars'); bars.innerHTML='';
    simState.warehouses.forEach((w,i)=>{
        const load=s.loadDistribution[i]||0; const pct=Math.min(100,(load/w.capacity)*100);
        const el=document.createElement('div');el.className='load-bar-item';
        el.innerHTML='<div class="load-bar-label"><span>'+w.name+'</span><span>'+load+'/'+w.capacity+'</span></div><div class="load-bar-track"><div class="load-bar-fill" style="width:'+pct+'%"></div></div>';
        bars.appendChild(el);
    });
    highlightAssignments(s.assignments,simState.customers,simState.warehouses);
}
function showCompareAll() {
    if(!simState.results)return;
    const sec=document.getElementById('comparison-section');sec.style.display='block';sec.scrollIntoView({behavior:'smooth'});
    const best=simState.results.bestStrategy;
    document.getElementById('best-strategy-name').textContent='Best: '+StrategyLabels[best].icon+' '+StrategyLabels[best].name;
    ['fast','balanced','optimal'].forEach(s=>{
        const d=simState.results.strategies[s];
        document.getElementById(s+'-time').textContent=d.totalTime+' min';
        document.getElementById(s+'-load').textContent=d.maxLoad+' units';
        document.getElementById(s+'-efficiency').textContent=d.efficiency+'%';
        const card=document.getElementById('card-'+s);if(card)card.classList.toggle('winner',s===best);
    });
    renderComparisonCharts(simState.results,simState.warehouses.map(w=>w.name));
}

// ─── Event Listeners ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    renderProducts(); renderCart();
    const el = (id,fn) => { const e=document.getElementById(id); if(e) e.addEventListener('click',fn); };
    el('btn-place-order', placeOrder);
    el('btn-add-customer', ()=>addCustomer());
    el('btn-add-warehouse', ()=>addWarehouse());
    el('btn-run-simulation', runSimulation);
    el('btn-fast-mode', ()=>showStrategy('fast'));
    el('btn-balanced-mode', ()=>showStrategy('balanced'));
    el('btn-optimal-mode', ()=>showStrategy('optimal'));
    el('btn-compare-all', showCompareAll);
    el('btn-sample-data', ()=>loadSampleData('small'));
    el('btn-reset', resetSim);
});

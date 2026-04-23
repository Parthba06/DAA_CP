// ═══════════════════════════════════════════════════════════════
// DATA.JS — Product catalog, sample data, helpers
// ═══════════════════════════════════════════════════════════════

const ProductCatalog = [
    { id: 1, name: 'Milk (1L)', price: 55, category: 'Dairy', emoji: '🥛', unit: '1 litre' },
    { id: 2, name: 'Bread', price: 40, category: 'Bakery', emoji: '🍞', unit: '1 pack' },
    { id: 3, name: 'Eggs (12)', price: 72, category: 'Dairy', emoji: '🥚', unit: '12 pcs' },
    { id: 4, name: 'Rice (1kg)', price: 60, category: 'Staples', emoji: '🍚', unit: '1 kg' },
    { id: 5, name: 'Onions (1kg)', price: 35, category: 'Vegetables', emoji: '🧅', unit: '1 kg' },
    { id: 6, name: 'Tomatoes (1kg)', price: 30, category: 'Vegetables', emoji: '🍅', unit: '1 kg' },
    { id: 7, name: 'Butter', price: 52, category: 'Dairy', emoji: '🧈', unit: '100g' },
    { id: 8, name: 'Sugar (1kg)', price: 45, category: 'Staples', emoji: '🍬', unit: '1 kg' },
    { id: 9, name: 'Bananas (6)', price: 40, category: 'Fruits', emoji: '🍌', unit: '6 pcs' },
    { id: 10, name: 'Apples (4)', price: 120, category: 'Fruits', emoji: '🍎', unit: '4 pcs' },
    { id: 11, name: 'Chips', price: 20, category: 'Snacks', emoji: '🍟', unit: '1 pack' },
    { id: 12, name: 'Juice (1L)', price: 85, category: 'Beverages', emoji: '🧃', unit: '1 litre' },
    { id: 13, name: 'Curd (400g)', price: 35, category: 'Dairy', emoji: '🥣', unit: '400g' },
    { id: 14, name: 'Potatoes (1kg)', price: 28, category: 'Vegetables', emoji: '🥔', unit: '1 kg' },
    { id: 15, name: 'Cookies', price: 30, category: 'Snacks', emoji: '🍪', unit: '1 pack' }
];

const Categories = ['All', 'Dairy', 'Vegetables', 'Fruits', 'Staples', 'Bakery', 'Snacks', 'Beverages'];

const ORDER_STAGES = ['placed', 'processing', 'warehouse_assigned', 'partner_assigned', 'out_for_delivery', 'delivered'];
const STAGE_LABELS = {
    placed: '📦 Order Placed',
    processing: '⚙️ Processing',
    warehouse_assigned: '🏭 Store Accepted',
    partner_assigned: '🛵 Rider Assigned',
    out_for_delivery: '🚀 Out for Delivery',
    delivered: '✅ Delivered'
};
const STAGE_COLORS = {
    placed: '#6b7280',
    processing: '#f8cb46',
    warehouse_assigned: '#0c831f',
    partner_assigned: '#4A90D9',
    out_for_delivery: '#ff9800',
    delivered: '#22c55e'
};

const SampleData = {
    small: {
        label: 'Standard (4 customers, 6 warehouses)',
        customers: [
            { id: 0, name: 'Customer A', orderSize: 3 },
            { id: 1, name: 'Customer B', orderSize: 2 },
            { id: 2, name: 'Customer C', orderSize: 5 },
            { id: 3, name: 'Customer D', orderSize: 1 }
        ],
        warehouses: [
            { id: 0, name: 'QuickStore Hub', capacity: 10 },
            { id: 1, name: 'FreshMart Central', capacity: 8 },
            { id: 2, name: 'SpeedyMart Depot', capacity: 9 },
            { id: 3, name: 'UrbanBasket Store', capacity: 7 },
            { id: 4, name: 'DailyNeeds Hub', capacity: 11 },
            { id: 5, name: 'ExpressMart Point', capacity: 6 }
        ],
        distanceMatrix: [
            [3, 9, 14, 7, 11, 5],
            [12, 4, 6, 10, 3, 8],
            [7, 11, 3, 5, 9, 13],
            [15, 6, 10, 2, 8, 4]
        ]
    }
};

const StrategyLabels = {
    fast: { name: 'Fast Mode', icon: '⚡', color: '#f8cb46' },
    balanced: { name: 'Balanced Mode', icon: '⚖️', color: '#4A90D9' },
    optimal: { name: 'Optimal Mode', icon: '🎯', color: '#0c831f' }
};

function validateInput(data) {
    const errors = [];
    if (!data.customers || data.customers.length === 0) errors.push('Add at least one customer');
    if (!data.warehouses || data.warehouses.length === 0) errors.push('Add at least one warehouse');
    return errors;
}

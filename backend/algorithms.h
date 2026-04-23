#ifndef ALGORITHMS_H
#define ALGORITHMS_H

#include <vector>
#include <string>
#include <algorithm>
#include <climits>
#include <queue>
#include <cmath>
#include <numeric>
#include <functional>

using namespace std;

// ─── Data Structures ────────────────────────────────────────────

struct Customer {
    int id;
    string name;
    int orderSize;
};

struct Warehouse {
    int id;
    string name;
    int capacity;
};

struct DeliveryPartner {
    int id;
    string name;
    int nearestWarehouse; // warehouse this partner is closest to
    bool available;
};

struct Assignment {
    int customerId;
    int warehouseId;
    double time;
    int orderSize;
};

struct PartnerAssignment {
    int partnerId;
    int warehouseId;
    int customerId;
    double pickupTime;        // rider → warehouse travel
    double storeToCustomer;   // warehouse → customer travel
};

struct StrategyResult {
    string strategyName;
    vector<Assignment> assignments;
    double totalTime;
    double maxLoad;
    vector<double> loadDistribution;
    double efficiency;
    bool feasible;
};

struct FullOrderResult {
    int customerId;
    int warehouseId;
    int partnerId;
    double pickupTime;        // rider → warehouse time
    double storeToCustomer;   // warehouse → customer time
    double totalTime;         // pickupTime + storeToCustomer
    string warehouseName;
    string partnerName;
    string strategyUsed;
};

// ─── Shortest Path (Dijkstra) ───────────────────────────────────

vector<vector<double>> computeShortestPaths(
    const vector<vector<double>>& distMatrix,
    int numCustomers,
    int numWarehouses
) {
    int totalNodes = numCustomers + numWarehouses;
    vector<vector<pair<int,double>>> adj(totalNodes);
    
    for (int i = 0; i < numCustomers; i++) {
        for (int j = 0; j < numWarehouses; j++) {
            double w = distMatrix[i][j];
            int wNode = numCustomers + j;
            adj[i].push_back(make_pair(wNode, w));
            adj[wNode].push_back(make_pair(i, w));
        }
    }
    
    vector<vector<double>> shortest(numCustomers, vector<double>(numWarehouses, 1e9));
    
    for (int src = 0; src < numCustomers; src++) {
        vector<double> dist(totalNodes, 1e9);
        priority_queue<pair<double,int>, vector<pair<double,int>>, greater<pair<double,int>>> pq;
        dist[src] = 0;
        pq.push(make_pair(0.0, src));
        
        while (!pq.empty()) {
            double d = pq.top().first;
            int u = pq.top().second;
            pq.pop();
            if (d > dist[u]) continue;
            
            for (size_t ei = 0; ei < adj[u].size(); ei++) {
                int v = adj[u][ei].first;
                double ew = adj[u][ei].second;
                if (dist[u] + ew < dist[v]) {
                    dist[v] = dist[u] + ew;
                    pq.push(make_pair(dist[v], v));
                }
            }
        }
        
        for (int j = 0; j < numWarehouses; j++) {
            shortest[src][j] = dist[numCustomers + j];
        }
    }
    
    return shortest;
}

// ─── Strategy 1: Fast Mode (Greedy) ────────────────────────────

StrategyResult greedyAssign(
    const vector<Customer>& customers,
    const vector<Warehouse>& warehouses,
    const vector<vector<double>>& shortestPaths
) {
    StrategyResult result;
    result.strategyName = "fast";
    result.feasible = true;
    int n = customers.size();
    int m = warehouses.size();
    
    vector<int> remainingCapacity(m);
    for (int j = 0; j < m; j++) remainingCapacity[j] = warehouses[j].capacity;
    
    vector<double> load(m, 0);
    double totalTime = 0;
    
    vector<int> order(n);
    iota(order.begin(), order.end(), 0);
    sort(order.begin(), order.end(), [&](int a, int b) {
        return customers[a].orderSize > customers[b].orderSize;
    });
    
    for (int oi = 0; oi < (int)order.size(); oi++) {
        int idx = order[oi];
        int bestWH = -1;
        double bestTime = 1e9;
        
        for (int j = 0; j < m; j++) {
            if (remainingCapacity[j] >= customers[idx].orderSize && shortestPaths[idx][j] < bestTime) {
                bestTime = shortestPaths[idx][j];
                bestWH = j;
            }
        }
        if (bestWH == -1) {
            bestTime = 1e9;
            for (int j = 0; j < m; j++) {
                if (shortestPaths[idx][j] < bestTime) { bestTime = shortestPaths[idx][j]; bestWH = j; }
            }
            result.feasible = false;
        }
        
        Assignment a; a.customerId = customers[idx].id; a.warehouseId = bestWH;
        a.time = bestTime; a.orderSize = customers[idx].orderSize;
        result.assignments.push_back(a);
        remainingCapacity[bestWH] -= customers[idx].orderSize;
        load[bestWH] += customers[idx].orderSize;
        totalTime += bestTime;
    }
    
    sort(result.assignments.begin(), result.assignments.end(),
         [](const Assignment& a, const Assignment& b) { return a.customerId < b.customerId; });
    
    result.totalTime = totalTime;
    result.loadDistribution = load;
    result.maxLoad = *max_element(load.begin(), load.end());
    
    double totalOrders = 0;
    for (int i = 0; i < n; i++) totalOrders += customers[i].orderSize;
    double loadBalance = 0, avgLoad = totalOrders / m;
    for (int j = 0; j < m; j++) loadBalance += (load[j] - avgLoad) * (load[j] - avgLoad);
    loadBalance = sqrt(loadBalance / m);
    double maxPossibleTime = n * 100.0;
    result.efficiency = max(0.0, min(100.0, 100.0 * (1.0 - totalTime / maxPossibleTime) * (1.0 - loadBalance / max(totalOrders, 1.0))));
    
    return result;
}

// ─── Strategy 2: Balanced Mode ──────────────────────────────────

StrategyResult balancedAssign(
    const vector<Customer>& customers,
    const vector<Warehouse>& warehouses,
    const vector<vector<double>>& shortestPaths
) {
    StrategyResult result;
    result.strategyName = "balanced";
    result.feasible = true;
    int n = customers.size(); int m = warehouses.size();
    
    vector<int> remainingCapacity(m);
    for (int j = 0; j < m; j++) remainingCapacity[j] = warehouses[j].capacity;
    vector<double> load(m, 0);
    double totalTime = 0;
    double alpha = 0.4, beta = 0.6;
    
    double maxDist = 0;
    for (int i = 0; i < n; i++)
        for (int j = 0; j < m; j++)
            maxDist = max(maxDist, shortestPaths[i][j]);
    if (maxDist == 0) maxDist = 1;
    
    for (int idx = 0; idx < n; idx++) {
        int bestWH = -1; double bestScore = 1e9;
        for (int j = 0; j < m; j++) {
            if (remainingCapacity[j] >= customers[idx].orderSize) {
                double score = alpha * (shortestPaths[idx][j] / maxDist) + beta * (load[j] / warehouses[j].capacity);
                if (score < bestScore) { bestScore = score; bestWH = j; }
            }
        }
        if (bestWH == -1) {
            int maxCap = -1;
            for (int j = 0; j < m; j++) { if (remainingCapacity[j] > maxCap) { maxCap = remainingCapacity[j]; bestWH = j; } }
            result.feasible = false;
        }
        
        Assignment a; a.customerId = customers[idx].id; a.warehouseId = bestWH;
        a.time = shortestPaths[idx][bestWH]; a.orderSize = customers[idx].orderSize;
        result.assignments.push_back(a);
        remainingCapacity[bestWH] -= customers[idx].orderSize;
        load[bestWH] += customers[idx].orderSize;
        totalTime += shortestPaths[idx][bestWH];
    }
    
    result.totalTime = totalTime;
    result.loadDistribution = load;
    result.maxLoad = *max_element(load.begin(), load.end());
    
    double totalOrders = 0;
    for (int i = 0; i < n; i++) totalOrders += customers[i].orderSize;
    double loadBalance = 0, avgLoad = totalOrders / m;
    for (int j = 0; j < m; j++) loadBalance += (load[j] - avgLoad) * (load[j] - avgLoad);
    loadBalance = sqrt(loadBalance / m);
    double maxPossibleTime = n * 100.0;
    result.efficiency = max(0.0, min(100.0, 100.0 * (1.0 - totalTime / maxPossibleTime) * (1.0 - loadBalance / max(totalOrders, 1.0))));
    
    return result;
}

// ─── Strategy 3: Optimal Mode (Branch & Bound) ─────────────────

static void bbSolve(
    int idx, int n, int m,
    vector<int>& assign, vector<int>& cap,
    double curTime,
    double& bestTotalTime, vector<int>& bestAssign,
    const vector<Customer>& cust, const vector<Warehouse>& wh,
    const vector<vector<double>>& sp
) {
    if (curTime >= bestTotalTime) return;
    if (idx == n) {
        if (curTime < bestTotalTime) { bestTotalTime = curTime; bestAssign = assign; }
        return;
    }
    vector<int> whOrder(m);
    iota(whOrder.begin(), whOrder.end(), 0);
    sort(whOrder.begin(), whOrder.end(), [&](int a, int b) { return sp[idx][a] < sp[idx][b]; });
    
    for (int wi = 0; wi < (int)whOrder.size(); wi++) {
        int j = whOrder[wi];
        if (cap[j] >= cust[idx].orderSize) {
            assign[idx] = j; cap[j] -= cust[idx].orderSize;
            double lb = curTime + sp[idx][j];
            for (int k = idx + 1; k < n; k++) {
                double minD = 1e9;
                for (int jj = 0; jj < m; jj++) if (cap[jj] >= cust[k].orderSize) minD = min(minD, sp[k][jj]);
                if (minD < 1e9) lb += minD;
            }
            if (lb < bestTotalTime) bbSolve(idx + 1, n, m, assign, cap, curTime + sp[idx][j], bestTotalTime, bestAssign, cust, wh, sp);
            cap[j] += cust[idx].orderSize; assign[idx] = -1;
        }
    }
}

StrategyResult optimalAssign(
    const vector<Customer>& customers, const vector<Warehouse>& warehouses,
    const vector<vector<double>>& shortestPaths
) {
    StrategyResult result;
    result.strategyName = "optimal"; result.feasible = true;
    int n = customers.size(); int m = warehouses.size();
    vector<int> bestAssignment(n, -1); double bestTotalTime = 1e9;
    
    if (n <= 15 && m <= 10) {
        StrategyResult gr = greedyAssign(customers, warehouses, shortestPaths);
        bestTotalTime = gr.totalTime;
        for (size_t ai = 0; ai < gr.assignments.size(); ai++) bestAssignment[gr.assignments[ai].customerId] = gr.assignments[ai].warehouseId;
        vector<int> assign(n, -1), cap(m);
        for (int j = 0; j < m; j++) cap[j] = warehouses[j].capacity;
        bbSolve(0, n, m, assign, cap, 0, bestTotalTime, bestAssignment, customers, warehouses, shortestPaths);
    } else {
        StrategyResult bal = balancedAssign(customers, warehouses, shortestPaths);
        for (size_t ai = 0; ai < bal.assignments.size(); ai++) bestAssignment[bal.assignments[ai].customerId] = bal.assignments[ai].warehouseId;
        bestTotalTime = bal.totalTime;
        vector<int> cap(m);
        for (int j = 0; j < m; j++) cap[j] = warehouses[j].capacity;
        for (int i = 0; i < n; i++) cap[bestAssignment[i]] -= customers[i].orderSize;
        bool improved = true; int iterations = 0;
        while (improved && iterations < 1000) {
            improved = false; iterations++;
            for (int i = 0; i < n; i++) {
                int curWH = bestAssignment[i]; double curTime = shortestPaths[i][curWH];
                for (int j = 0; j < m; j++) {
                    if (j == curWH) continue;
                    if (cap[j] >= customers[i].orderSize && shortestPaths[i][j] < curTime) {
                        cap[curWH] += customers[i].orderSize; cap[j] -= customers[i].orderSize;
                        bestAssignment[i] = j; bestTotalTime += (shortestPaths[i][j] - curTime);
                        curWH = j; curTime = shortestPaths[i][j]; improved = true;
                    }
                }
            }
        }
    }
    
    vector<double> load(m, 0); double totalTime = 0;
    for (int i = 0; i < n; i++) {
        Assignment a; a.customerId = customers[i].id; a.warehouseId = bestAssignment[i];
        a.time = shortestPaths[i][bestAssignment[i]]; a.orderSize = customers[i].orderSize;
        result.assignments.push_back(a);
        load[bestAssignment[i]] += customers[i].orderSize; totalTime += a.time;
        if (bestAssignment[i] == -1) result.feasible = false;
    }
    result.totalTime = totalTime; result.loadDistribution = load;
    result.maxLoad = *max_element(load.begin(), load.end());
    
    double totalOrders = 0;
    for (int i = 0; i < n; i++) totalOrders += customers[i].orderSize;
    double loadBalance = 0, avgLoad = totalOrders / m;
    for (int j = 0; j < m; j++) loadBalance += (load[j] - avgLoad) * (load[j] - avgLoad);
    loadBalance = sqrt(loadBalance / m);
    double maxPossibleTime = n * 100.0;
    result.efficiency = max(0.0, min(100.0, 100.0 * (1.0 - totalTime / maxPossibleTime) * (1.0 - loadBalance / max(totalOrders, 1.0))));
    return result;
}

// ─── Assign Delivery Partner ────────────────────────────────────

PartnerAssignment assignPartner(
    int customerId, int warehouseId,
    const vector<DeliveryPartner>& partners,
    const vector<vector<double>>& partnerWarehouseDist,
    const vector<vector<double>>& customerWarehouseDist,
    int numCustomers
) {
    PartnerAssignment pa;
    pa.customerId = customerId;
    pa.warehouseId = warehouseId;
    pa.partnerId = -1;
    pa.pickupTime = 1e9;
    pa.storeToCustomer = customerWarehouseDist[customerId][warehouseId];
    
    // Find nearest available partner to the assigned warehouse
    for (size_t p = 0; p < partners.size(); p++) {
        if (partners[p].available) {
            double dist = partnerWarehouseDist[p][warehouseId];
            if (dist < pa.pickupTime) {
                pa.pickupTime = dist;
                pa.partnerId = partners[p].id;
            }
        }
    }
    
    return pa;
}

// ─── Process Full Order ─────────────────────────────────────────

FullOrderResult processFullOrder(
    const Customer& customer,
    const vector<Warehouse>& warehouses,
    const vector<DeliveryPartner>& partners,
    const vector<vector<double>>& custWhDist,
    const vector<vector<double>>& partnerWhDist,
    const string& strategy
) {
    FullOrderResult result;
    result.customerId = customer.id;
    
    // Create single-customer vectors for the algorithms
    vector<Customer> custs = {customer};
    vector<vector<double>> singleDist = {custWhDist[customer.id]};
    
    auto shortestPaths = computeShortestPaths(singleDist, 1, warehouses.size());
    
    StrategyResult sr;
    if (strategy == "fast") sr = greedyAssign(custs, warehouses, shortestPaths);
    else if (strategy == "balanced") sr = balancedAssign(custs, warehouses, shortestPaths);
    else sr = optimalAssign(custs, warehouses, shortestPaths);
    
    if (!sr.assignments.empty()) {
        result.warehouseId = sr.assignments[0].warehouseId;
    }
    result.warehouseName = warehouses[result.warehouseId].name;
    result.strategyUsed = strategy;
    
    // Assign delivery partner
    PartnerAssignment pa = assignPartner(
        customer.id, result.warehouseId,
        partners, partnerWhDist, custWhDist, custs.size()
    );
    
    result.partnerId = pa.partnerId;
    result.pickupTime = pa.pickupTime;           // rider → store
    result.storeToCustomer = pa.storeToCustomer; // store → customer
    result.totalTime = pa.pickupTime + pa.storeToCustomer; // total = pickup + delivery
    
    if (pa.partnerId >= 0) {
        result.partnerName = partners[pa.partnerId].name;
    } else {
        result.partnerName = "No partner available";
    }
    
    return result;
}

// ─── Determine Best Strategy ────────────────────────────────────

string determineBest(const StrategyResult& fast, const StrategyResult& balanced, const StrategyResult& optimal) {
    double bestTime = 1e18; string best = "optimal";
    if (fast.feasible && fast.totalTime < bestTime) { bestTime = fast.totalTime; best = "fast"; }
    if (balanced.feasible && balanced.totalTime < bestTime) { bestTime = balanced.totalTime; best = "balanced"; }
    if (optimal.feasible && optimal.totalTime < bestTime) { bestTime = optimal.totalTime; best = "optimal"; }
    return best;
}

#endif // ALGORITHMS_H

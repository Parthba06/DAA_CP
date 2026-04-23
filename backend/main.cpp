#include <iostream>
#include <fstream>
#include <string>
#include <vector>
#include "json.hpp"
#include "algorithms.h"

using json = nlohmann::json;
using namespace std;

int main(int argc, char* argv[]) {
    string inputPath = "../data/input.json";
    string outputPath = "../data/output.json";
    
    if (argc >= 3) { inputPath = argv[1]; outputPath = argv[2]; }
    
    // ─── Read Input ─────────────────────────────────────────────
    ifstream inFile(inputPath);
    if (!inFile.is_open()) { cerr << "Error: Cannot open " << inputPath << endl; return 1; }
    
    json inputJson;
    try { inFile >> inputJson; } catch (const json::parse_error& e) {
        cerr << "Error: " << e.what() << endl; return 1;
    }
    inFile.close();
    
    // ─── Parse Customers ────────────────────────────────────────
    vector<Customer> customers;
    for (auto& c : inputJson["customers"]) {
        Customer cust; cust.id = c["id"]; cust.name = c["name"]; cust.orderSize = c["orderSize"];
        customers.push_back(cust);
    }
    
    // ─── Parse Warehouses ───────────────────────────────────────
    vector<Warehouse> warehouses;
    for (auto& w : inputJson["warehouses"]) {
        Warehouse wh; wh.id = w["id"]; wh.name = w["name"]; wh.capacity = w["capacity"];
        warehouses.push_back(wh);
    }
    
    // ─── Parse Distance Matrix ──────────────────────────────────
    vector<vector<double>> distMatrix;
    for (auto& row : inputJson["distanceMatrix"]) {
        vector<double> r;
        for (auto& val : row) r.push_back(val.get<double>());
        distMatrix.push_back(r);
    }
    
    // ─── Parse Delivery Partners (optional) ─────────────────────
    vector<DeliveryPartner> partners;
    if (inputJson.count("partners")) {
        for (auto& p : inputJson["partners"]) {
            DeliveryPartner dp;
            dp.id = p["id"]; dp.name = p["name"];
            dp.nearestWarehouse = p["nearestWarehouse"];
            dp.available = p.value("available", true);
            partners.push_back(dp);
        }
    }
    
    // ─── Parse Partner-Warehouse Distance (optional) ────────────
    vector<vector<double>> partnerWhDist;
    if (inputJson.count("partnerWarehouseDist")) {
        for (auto& row : inputJson["partnerWarehouseDist"]) {
            vector<double> r;
            for (auto& val : row) r.push_back(val.get<double>());
            partnerWhDist.push_back(r);
        }
    }
    
    int numCustomers = customers.size();
    int numWarehouses = warehouses.size();
    
    // ─── Compute Shortest Paths ─────────────────────────────────
    auto shortestPaths = computeShortestPaths(distMatrix, numCustomers, numWarehouses);
    
    // ─── Check mode ─────────────────────────────────────────────
    string mode = inputJson.value("mode", "simulate");
    
    json output;
    
    if (mode == "order" && !partners.empty()) {
        string strategy = inputJson.value("strategy", "optimal");
        int custIdx = inputJson.value("customerIndex", 0);
        
        if (custIdx >= 0 && custIdx < numCustomers) {
            FullOrderResult fr = processFullOrder(
                customers[custIdx], warehouses, partners,
                distMatrix, partnerWhDist, strategy
            );
            
            output["orderResult"]["customerId"] = fr.customerId;
            output["orderResult"]["warehouseId"] = fr.warehouseId;
            output["orderResult"]["warehouseName"] = fr.warehouseName;
            output["orderResult"]["partnerId"] = fr.partnerId;
            output["orderResult"]["partnerName"] = fr.partnerName;
            output["orderResult"]["pickupTime"] = round(fr.pickupTime * 100) / 100;
            output["orderResult"]["storeToCustomer"] = round(fr.storeToCustomer * 100) / 100;
            output["orderResult"]["totalTime"] = round(fr.totalTime * 100) / 100;
            output["orderResult"]["strategy"] = fr.strategyUsed;
            
            // ─── Decision Steps for Frontend Animation ──────────
            json steps;
            
            // Step: All warehouse candidates with distances
            json whCandidates = json::array();
            for (int j = 0; j < numWarehouses; j++) {
                json wc;
                wc["id"] = warehouses[j].id;
                wc["name"] = warehouses[j].name;
                wc["distance"] = round(distMatrix[custIdx][j] * 100) / 100;
                wc["capacity"] = warehouses[j].capacity;
                wc["selected"] = (j == fr.warehouseId);
                whCandidates.push_back(wc);
            }
            steps["warehouseCandidates"] = whCandidates;
            steps["selectedWarehouseId"] = fr.warehouseId;
            steps["selectedWarehouseName"] = fr.warehouseName;
            steps["warehouseDistance"] = round(distMatrix[custIdx][fr.warehouseId] * 100) / 100;
            
            // Step: All partner candidates with distances to selected warehouse
            json ptCandidates = json::array();
            for (size_t p = 0; p < partners.size(); p++) {
                json pc;
                pc["id"] = partners[p].id;
                pc["name"] = partners[p].name;
                pc["available"] = partners[p].available;
                if (p < partnerWhDist.size() && fr.warehouseId < (int)partnerWhDist[p].size()) {
                    pc["distanceToWarehouse"] = round(partnerWhDist[p][fr.warehouseId] * 100) / 100;
                } else {
                    pc["distanceToWarehouse"] = 99;
                }
                pc["selected"] = (partners[p].id == fr.partnerId);
                ptCandidates.push_back(pc);
            }
            steps["partnerCandidates"] = ptCandidates;
            steps["selectedPartnerId"] = fr.partnerId;
            steps["selectedPartnerName"] = fr.partnerName;
            steps["pickupTime"] = round(fr.pickupTime * 100) / 100;
            steps["storeToCustomer"] = round(fr.storeToCustomer * 100) / 100;
            steps["totalTime"] = round(fr.totalTime * 100) / 100;
            
            output["decisionSteps"] = steps;
        }
    } else {
        // ─── Full Simulation Mode ───────────────────────────────
        StrategyResult fastResult = greedyAssign(customers, warehouses, shortestPaths);
        StrategyResult balancedResult = balancedAssign(customers, warehouses, shortestPaths);
        StrategyResult optimalResult = optimalAssign(customers, warehouses, shortestPaths);
        string best = determineBest(fastResult, balancedResult, optimalResult);
        
        auto strategyToJson = [&](const StrategyResult& sr) -> json {
            json sj; json assignments = json::array();
            for (auto& a : sr.assignments) {
                json aj;
                aj["customerId"] = a.customerId; aj["warehouseId"] = a.warehouseId;
                aj["time"] = round(a.time * 100) / 100; aj["orderSize"] = a.orderSize;
                assignments.push_back(aj);
            }
            sj["assignments"] = assignments;
            sj["totalTime"] = round(sr.totalTime * 100) / 100;
            sj["maxLoad"] = sr.maxLoad;
            sj["loadDistribution"] = sr.loadDistribution;
            sj["efficiency"] = round(sr.efficiency * 100) / 100;
            sj["feasible"] = sr.feasible;
            return sj;
        };
        
        output["strategies"]["fast"] = strategyToJson(fastResult);
        output["strategies"]["balanced"] = strategyToJson(balancedResult);
        output["strategies"]["optimal"] = strategyToJson(optimalResult);
        output["bestStrategy"] = best;
        
        // Partner assignments for each strategy (optimal)
        if (!partners.empty() && !partnerWhDist.empty()) {
            json partnerResults = json::array();
            for (auto& a : optimalResult.assignments) {
                PartnerAssignment pa = assignPartner(
                    a.customerId, a.warehouseId, partners, partnerWhDist, distMatrix, numCustomers
                );
                json pj;
                pj["customerId"] = pa.customerId;
                pj["warehouseId"] = pa.warehouseId;
                pj["partnerId"] = pa.partnerId;
                pj["pickupTime"] = round(pa.pickupTime * 100) / 100;
                pj["storeToCustomer"] = round(pa.storeToCustomer * 100) / 100;
                pj["totalTime"] = round((pa.pickupTime + pa.storeToCustomer) * 100) / 100;
                if (pa.partnerId >= 0) pj["partnerName"] = partners[pa.partnerId].name;
                partnerResults.push_back(pj);
            }
            output["partnerAssignments"] = partnerResults;
        }
        
        json sp = json::array();
        for (auto& row : shortestPaths) {
            json r = json::array();
            for (auto& val : row) r.push_back(round(val * 100) / 100);
            sp.push_back(r);
        }
        output["shortestPaths"] = sp;
    }
    
    // ─── Write Output ───────────────────────────────────────────
    ofstream outFile(outputPath);
    if (!outFile.is_open()) { cerr << "Error: Cannot open " << outputPath << endl; return 1; }
    outFile << output.dump(2);
    outFile.close();
    
    cout << "Done. Output: " << outputPath << endl;
    return 0;
}

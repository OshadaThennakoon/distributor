# OshadaDistribute: Multi-Distributor Distribution, Route, Vehicle & Finance Management Platform

A commercial-grade Distribution Management and Financial Intelligence web application engineered for multiple distributors operating across diverse territories, routes, vehicles, and customer networks.

---

## 🌟 Key Capabilities

1. **Multi-Distributor Multi-Tenant Architecture**:
   - Manage unlimited distributors (*e.g., Example Distributor - Kekirawa, Colombo Metro, Hill Country - Kandy*).
   - Filter any operational or financial report by corporate aggregate ("All Distributors") or isolate a specific distributor tenant.
2. **Distribution Centers & Territories**:
   - Regional hubs, GPS coordinates, territory boundaries, and towns.
3. **Route Management & Cycle Operations**:
   - Starting/Ending hubs, stop sequences, manual distance & GPS distance.
   - Recurrence frequencies (*Daily, Weekly, Biweekly, Every 3 weeks / 21 days, Monthly*).
   - Automated monthly distance engine: $\text{Distance} \times (30 / \text{cycle days})$.
4. **Interactive OpenStreetMap Geospatial View**:
   - Zero external paid API dependencies (Leaflet + OpenStreetMap).
   - Visualizes Distribution Center hubs, shops, and route stop polylines.
5. **Customer Outlet Master Data & 21-Day Visit Engine**:
   - Real-time visit status categorization: *Due Today, Due This Week, Overdue, Upcoming*.
   - Multi-cycle visit projections (e.g. Sept 1 $\to$ Sept 22 $\to$ Oct 13 $\to$ Nov 3).
6. **Fleet Telemetry & Vehicle Fuel Management**:
   - Manufacturer expected vs actual km/L variance tracking.
   - Anomaly detection for abnormal consumption.
   - Maintenance logs, periodic service reminders, insurance and revenue license expirations.
   - Historical and active fuel price management (Diesel & Petrol).
7. **Sales, Invoicing & Inventory**:
   - Trade sales invoices, commercial discounts, line-item COGS calculation, and gross margins.
   - Payment collections and accounts receivables aging tracking.
8. **Decoupled Centralized Calculation Engine (`calculationEngine.js`)**:
   - Pure, tested financial formulas for cost-per-km, cost-per-shop, driver allocations, route profitability, and contribution margins.
9. **Executive Dashboard & BI Management Insights Engine**:
   - 11 Top KPI Cards: Sales, Gross Profit, Net Profit, OPEX, Fuel Cost, Total KM, Routes, Shops, Vehicles, Cost/KM, Receivables.
   - Dynamic natural-language operational takeaways.
   - Financial progression and route comparison visual charts.
10. **20 Financial & Management Reports**:
    - Daily Sales, Weekly Sales, Monthly Sales, P&L, Expenses, Fuel, Vehicle Fleet, Route Cost, Route Profitability, Distributor Profitability, Territory Profitability, Customer Sales, Product Margins, Driver Performance, Maintenance, Receivables Aging, Cost/KM, Cost/Shop, Monthly KM, Fuel Efficiency.
    - Export to Excel (.xlsx), CSV, and Print.
11. **Executive Monthly Management Report (Section 31)**:
    - 1-page financial and operational statement linking mileage and fuel to net profit.
12. **What-If Route Planning Simulator & Break-Even Calculator**:
    - Interactive parameter sliders (routes, distance, fuel price, efficiency, driver costs).
    - Scenario comparison matrix: Baseline vs 12 Routes vs Biweekly Frequency vs Fuel Price Hike vs Efficient Fleet.

---

## 🚀 Running the System

### 1. Start Backend API Server
```bash
cd server
npm install
node seed/seeder.js   # Generates 6 months of rich test data
npm test              # Executes 14 automated verification tests
npm start             # Starts Express REST API on http://localhost:5055
```

### 2. Start Frontend Web Client
```bash
cd client
npm install
npm run dev           # Starts Vite dev server on http://localhost:5185
```

### 3. Demo Credentials
- **Admin**: `admin` / `admin123` (Global multi-tenant corporate control)
- **Finance User**: `finance` / `finance123` (Financial reports, P&L, simulator)
- **Viewer**: `viewer` / `viewer123` (Read-only operational view)

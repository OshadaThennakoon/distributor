import bcrypt from 'bcryptjs';
import { db, initDatabase } from '../config/database.js';

export function runSeeder() {
  console.log('--- Initializing Database and Running Seeder ---');
  initDatabase();

  // Clear existing records in proper dependency order
  const tables = [
    'audit_logs', 'payments', 'sale_items', 'sales', 'odometer_readings',
    'fuel_transactions', 'shop_visits', 'maintenance', 'expenses', 'expense_categories',
    'route_runs', 'route_stops', 'shops', 'routes', 'towns', 'territories',
    'distribution_centers', 'vehicles', 'drivers', 'fuel_prices', 'products',
    'product_categories', 'users', 'distributors', 'system_settings'
  ];

  db.transaction(() => {
    for (const tbl of tables) {
      db.prepare(`DELETE FROM ${tbl}`).run();
    }
  })();

  console.log('Cleared existing data.');

  db.transaction(() => {
    // 1. System Settings
    const insertSetting = db.prepare(`INSERT INTO system_settings (key, value, description) VALUES (?, ?, ?)`);
    insertSetting.run('default_currency', 'LKR', 'Base operational currency');
    insertSetting.run('default_currency_symbol', 'Rs.', 'Base currency symbol');
    insertSetting.run('working_days_per_month', '26', 'Standard operational driver working days');
    insertSetting.run('company_name', 'OshadaDistribute Platform Ltd', 'Corporate system owner');

    // 2. Fuel Prices (Historical Progression)
    const insertFuelPrice = db.prepare(`INSERT INTO fuel_prices (fuel_type, price_per_litre, effective_date, notes) VALUES (?, ?, ?, ?)`);
    insertFuelPrice.run('Diesel', 365.00, '2025-10-01', 'Q4 2025 Standard Ceylon Petroleum price');
    insertFuelPrice.run('Diesel', 374.00, '2026-03-01', 'Q1 2026 Adjustment');
    insertFuelPrice.run('Diesel', 382.00, '2026-07-01', 'Current Active Diesel Price (July 2026)');
    insertFuelPrice.run('Petrol', 370.00, '2025-10-01', 'Q4 2025 92 Octane Petrol');
    insertFuelPrice.run('Petrol', 380.00, '2026-03-01', 'Q1 2026 92 Octane Petrol');
    insertFuelPrice.run('Petrol', 390.00, '2026-07-01', 'Current Active Petrol Price');

    // 3. Distributors
    const insertDist = db.prepare(`
      INSERT INTO distributors (id, code, name, reg_number, contact_person, phone, email, address, currency_code, currency_symbol, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertDist.run(1, 'DIST-KEK', 'Example Distributor - Kekirawa', 'PV-98214', 'Nalinda Jayasuriya', '+94 25 226 4890', 'admin@kekirawadist.lk', 'Main Street, Kekirawa, North Central', 'LKR', 'Rs.', 'active');
    insertDist.run(2, 'DIST-COL', 'Colombo Metro Distribution Ltd', 'PV-41092', 'Dinesh Rajapaksha', '+94 11 258 9012', 'operations@colombodist.lk', '140 Baseline Road, Colombo 09', 'LKR', 'Rs.', 'active');
    insertDist.run(3, 'DIST-KAN', 'Hill Country Distributors - Kandy', 'PV-67123', 'A. Wickramasinghe', '+94 81 223 4511', 'kandy@hilldist.lk', 'Peradeniya Road, Kandy', 'LKR', 'Rs.', 'active');

    // 4. Distribution Centers
    const insertDc = db.prepare(`
      INSERT INTO distribution_centers (id, distributor_id, name, code, address, town, district, province, latitude, longitude, contact_number, manager, opening_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertDc.run(1, 1, 'Kekirawa Central DC', 'DC-KEK-01', 'Old Station Road, Kekirawa', 'Kekirawa', 'Anuradhapura', 'North Central', 8.0433, 80.5922, '+94 25 226 4110', 'Kasun Weerasinghe', '2022-01-15', 'active');
    insertDc.run(2, 1, 'Dambulla Hub', 'DC-DAM-02', 'Kurunegala Junction, Dambulla', 'Dambulla', 'Matale', 'Central', 7.8742, 80.6511, '+94 66 228 3901', 'Pradeep Kumara', '2023-04-01', 'active');
    insertDc.run(3, 2, 'Colombo Port & City DC', 'DC-COL-01', 'Baseline Road, Orugodawatta', 'Colombo', 'Colombo', 'Western', 6.9412, 79.8821, '+94 11 254 1100', 'Mohamed Rizvi', '2021-08-10', 'active');
    insertDc.run(4, 2, 'Kurunegala Junction DC', 'DC-KUR-01', 'Negombo Road, Kurunegala', 'Kurunegala', 'Kurunegala', 'North Western', 7.4863, 80.3623, '+94 37 222 1980', 'Ravi Senanayake', '2023-01-10', 'active');
    insertDc.run(5, 3, 'Kandy Gatambe DC', 'DC-KAN-01', 'Gatambe, Kandy', 'Kandy', 'Kandy', 'Central', 7.2711, 80.6019, '+94 81 238 7720', 'S. Mahendran', '2022-06-01', 'active');

    // 5. Territories
    const insertTerritory = db.prepare(`
      INSERT INTO territories (id, distributor_id, distribution_center_id, name, code, district, province, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertTerritory.run(1, 1, 1, 'Kekirawa Town & Suburbs', 'TER-KEK', 'Anuradhapura', 'North Central', 'active');
    insertTerritory.run(2, 1, 1, 'Melsiripura', 'TER-MEL', 'Kurunegala', 'North Western', 'active');
    insertTerritory.run(3, 1, 1, 'Galewela', 'TER-GAL', 'Matale', 'Central', 'active');
    insertTerritory.run(4, 1, 2, 'Dambulla', 'TER-DAM', 'Matale', 'Central', 'active');
    insertTerritory.run(5, 1, 2, 'Sigiriya & Habarana', 'TER-SIG', 'Matale', 'Central', 'active');
    insertTerritory.run(6, 2, 3, 'Colombo North', 'TER-CLN', 'Colombo', 'Western', 'active');
    insertTerritory.run(7, 2, 3, 'Colombo South', 'TER-CLS', 'Colombo', 'Western', 'active');
    insertTerritory.run(8, 2, 4, 'Kurunegala Town', 'TER-KUR', 'Kurunegala', 'North Western', 'active');
    insertTerritory.run(9, 3, 5, 'Kandy Central', 'TER-KNC', 'Kandy', 'Central', 'active');
    insertTerritory.run(10, 3, 5, 'Gampola & Kadugannawa', 'TER-GAM', 'Kandy', 'Central', 'active');

    // 6. Users
    const passwordHash = bcrypt.hashSync('admin123', 8);
    const finHash = bcrypt.hashSync('finance123', 8);
    const viewHash = bcrypt.hashSync('viewer123', 8);

    const insertUser = db.prepare(`
      INSERT INTO users (id, username, email, password_hash, full_name, role, distributor_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);
    insertUser.run(1, 'admin', 'admin@oshadadistribute.lk', passwordHash, 'System Administrator', 'ADMIN', null);
    insertUser.run(2, 'finance', 'finance@kekirawadist.lk', finHash, 'Thilina Hettiarachchi (Finance)', 'FINANCE_USER', 1);
    insertUser.run(3, 'colombo_finance', 'fin@colombodist.lk', finHash, 'Niroshan Pieris (Colombo Fin)', 'FINANCE_USER', 2);
    insertUser.run(4, 'viewer', 'viewer@kekirawadist.lk', viewHash, 'Operations Viewer', 'VIEWER', 1);

    // 7. Drivers
    const insertDriver = db.prepare(`
      INSERT INTO drivers (id, distributor_id, full_name, nic, phone, license_number, license_expiry, monthly_salary, daily_allowance, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertDriver.run(1, 1, 'Sunimal Perera', '198214500912', '+94 77 123 4567', 'B-481902', '2028-04-15', 65000, 1500, 'active');
    insertDriver.run(2, 1, 'K. Bandara', '198730901234', '+94 71 987 6543', 'B-672190', '2027-11-20', 62000, 1500, 'active');
    insertDriver.run(3, 1, 'M. Farook', '199021809871', '+94 76 543 2109', 'B-901823', '2026-10-30', 68000, 1800, 'active');
    insertDriver.run(4, 1, 'Chaminda Silva', '198544102938', '+94 78 334 5566', 'B-341908', '2029-01-18', 60000, 1400, 'active');
    insertDriver.run(5, 1, 'R. Jayawardena', '198129003847', '+94 70 889 9001', 'B-129084', '2027-06-12', 70000, 1800, 'active');

    // 8. Vehicles
    const insertVehicle = db.prepare(`
      INSERT INTO vehicles (id, distributor_id, vehicle_number, vehicle_type, brand, model, year, fuel_type, fuel_tank_capacity_l, expected_kml, actual_kml, purchase_date, current_odometer, assigned_driver_id, insurance_expiry, revenue_license_expiry, service_interval_km, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertVehicle.run(1, 1, 'WP-DA-4821', 'Mini Truck', 'DIMO', 'Batta (Ace)', 2021, 'Diesel', 35, 18.0, 17.8, '2021-03-10', 58400, 1, '2027-03-09', '2027-03-09', 5000, 'active');
    insertVehicle.run(2, 1, 'WP-ND-1923', 'Mini Truck', 'Tata', 'Ace HT', 2020, 'Diesel', 38, 17.5, 17.1, '2020-07-22', 74200, 2, '2026-12-15', '2026-12-15', 5000, 'active');
    insertVehicle.run(3, 1, 'WP-LB-3819', 'Medium Lorry', 'Isuzu', 'Elf 14ft', 2019, 'Diesel', 70, 11.0, 10.4, '2019-11-05', 124500, 3, '2026-11-20', '2026-11-20', 7500, 'active');
    insertVehicle.run(4, 1, 'WP-PZ-6294', 'Pickup Truck', 'Mahindra', 'Bolero Maxi', 2022, 'Diesel', 45, 14.0, 13.9, '2022-09-14', 41800, 4, '2027-09-13', '2027-09-13', 5000, 'active');
    insertVehicle.run(5, 1, 'WP-GH-5510', 'Panel Van', 'Toyota', 'TownAce', 2018, 'Petrol', 45, 12.0, 11.6, '2018-05-30', 98700, 5, '2026-10-15', '2026-10-15', 5000, 'active');

    // 9. Product Categories & Products
    const insertCat = db.prepare(`INSERT INTO product_categories (id, distributor_id, name, code, description) VALUES (?, ?, ?, ?, ?)`);
    insertCat.run(1, 1, 'Beverages & Dairy', 'CAT-BEV', 'Teas, coffee, milk powders, and cordials');
    insertCat.run(2, 1, 'Packaged Foods & Grains', 'CAT-FOOD', 'Biscuits, noodles, pulses, spices');
    insertCat.run(3, 1, 'Personal Care', 'CAT-PC', 'Soaps, shampoos, oral care products');
    insertCat.run(4, 1, 'Household Care', 'CAT-HC', 'Detergents, cleaning liquids, matches');

    const insertProd = db.prepare(`
      INSERT INTO products (id, distributor_id, category_id, product_name, sku, brand, unit, cost_price, selling_price, stock_quantity, min_stock_level, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    insertProd.run(1, 1, 1, 'Highland Full Cream Milk Powder 400g', 'SKU-MLK-400', 'Highland', 'packet', 950.00, 1150.00, 650, 50);
    insertProd.run(2, 1, 1, 'Watawala Ceylon BOPF Tea 400g', 'SKU-TEA-400', 'Watawala', 'packet', 680.00, 850.00, 480, 40);
    insertProd.run(3, 1, 2, 'Munchee Cream Cracker Family Pack 500g', 'SKU-CRK-500', 'Munchee', 'packet', 390.00, 490.00, 920, 100);
    insertProd.run(4, 1, 2, 'Ratthi Instant Noodles Chicken 400g', 'SKU-NDL-400', 'Ratthi', 'packet', 280.00, 360.00, 750, 80);
    insertProd.run(5, 1, 2, 'McCurrie Roasted Curry Powder 100g', 'SKU-SP-100', 'McCurrie', 'packet', 160.00, 220.00, 1100, 120);
    insertProd.run(6, 1, 2, 'Marina Pure Coconut Cooking Oil 1L', 'SKU-OIL-1L', 'Marina', 'bottle', 620.00, 780.00, 340, 30);
    insertProd.run(7, 1, 2, 'Tess Jack Mackerel Canned Fish 425g', 'SKU-FSH-425', 'Tess', 'tin', 480.00, 620.00, 510, 50);
    insertProd.run(8, 1, 3, 'Kohomba Herbal Soap Bar 100g', 'SKU-SOP-100', 'Swadeshi', 'bar', 110.00, 150.00, 1400, 150);
    insertProd.run(9, 1, 3, 'Clogard Total Toothpaste 120g', 'SKU-TP-120', 'Clogard', 'tube', 190.00, 260.00, 890, 70);
    insertProd.run(10, 1, 4, 'Sunlight Detergent Powder 1kg', 'SKU-DET-1K', 'Sunlight', 'packet', 420.00, 540.00, 580, 60);

    // 10. 15 Routes for Kekirawa Distributor
    const routesData = [
      { id: 1, name: 'Route 001 - Kekirawa to Galewela Via Small Towns', code: 'R-001', dist: 125, time: 240, shops: 8, vId: 1, dId: 1, terr: 3 },
      { id: 2, name: 'Route 002 - Kekirawa to Dambulla Commercial Hub', code: 'R-002', dist: 135, time: 270, shops: 9, vId: 1, dId: 1, terr: 4 },
      { id: 3, name: 'Route 003 - Kekirawa to Sigiriya Tourism & Farm Belt', code: 'R-003', dist: 140, time: 280, shops: 7, vId: 2, dId: 2, terr: 5 },
      { id: 4, name: 'Route 004 - Kekirawa to Melsiripura Highway Run', code: 'R-004', dist: 155, time: 310, shops: 8, vId: 2, dId: 2, terr: 2 },
      { id: 5, name: 'Route 005 - Kekirawa Town Local Circuit', code: 'R-005', dist: 95, time: 180, shops: 10, vId: 4, dId: 4, terr: 1 },
      { id: 6, name: 'Route 006 - Habarana Forest Border Outlets', code: 'R-006', dist: 145, time: 290, shops: 6, vId: 3, dId: 3, terr: 5 },
      { id: 7, name: 'Route 007 - Galewela East Rural Groceries', code: 'R-007', dist: 130, time: 260, shops: 7, vId: 1, dId: 1, terr: 3 },
      { id: 8, name: 'Route 008 - Dambulla Wholesale Market Link', code: 'R-008', dist: 110, time: 220, shops: 11, vId: 3, dId: 3, terr: 4 },
      { id: 9, name: 'Route 009 - Melsiripura South Estates Line', code: 'R-009', dist: 165, time: 330, shops: 6, vId: 4, dId: 4, terr: 2 },
      { id: 10, name: 'Route 010 - Kekirawa North Tank Cascade Villages', code: 'R-010', dist: 115, time: 230, shops: 7, vId: 5, dId: 5, terr: 1 },
      { id: 11, name: 'Route 011 - Inamaluwa & Kandalama Resorts Line', code: 'R-011', dist: 138, time: 275, shops: 6, vId: 5, dId: 5, terr: 4 },
      { id: 12, name: 'Route 012 - Pallepola & Bambaragaswewa Circuit', code: 'R-012', dist: 142, time: 285, shops: 7, vId: 2, dId: 2, terr: 3 },
      { id: 13, name: 'Route 013 - Madatugama Agrarian Feeders', code: 'R-013', dist: 105, time: 210, shops: 8, vId: 1, dId: 1, terr: 1 },
      { id: 14, name: 'Route 014 - Naula Boundary Connector', code: 'R-014', dist: 150, time: 300, shops: 6, vId: 4, dId: 4, terr: 3 },
      { id: 15, name: 'Route 015 - Digampathana Crosslink Express', code: 'R-015', dist: 128, time: 255, shops: 7, vId: 3, dId: 3, terr: 5 }
    ];

    const insertRoute = db.prepare(`
      INSERT INTO routes (
        id, distributor_id, distribution_center_id, territory_id, route_name, route_code,
        starting_location, ending_location, route_distance_km, estimated_travel_time_mins,
        number_of_shops, visit_frequency, frequency_days, route_type, vehicle_id, driver_id, is_active, notes
      ) VALUES (?, 1, 1, ?, ?, ?, 'Kekirawa Distribution Center', 'Kekirawa Distribution Center', ?, ?, ?, 'Every 3 weeks', 21, 'Regular', ?, ?, 1, 'Standard 21-day replenishment loop')
    `);

    for (const r of routesData) {
      insertRoute.run(r.id, r.terr, r.name, r.code, r.dist, r.time, r.shops, r.vId, r.dId);
    }

    // 11. 100 Real Sri Lankan Shops
    const shopNames = [
      'Nimal Grocery & Tea Room', 'Shantha Super Stores', 'Wijaya General Traders', 'Sigiriya Farm Fresh Shop',
      'Dambulla Veg Mart', 'Sunitha Family Pharmacy', 'Central City Bakers', 'Randika Wholesale Mart',
      'Jayalath Stores', 'Perera & Sons Franchise', 'Kumara Mini Super', 'Bandara Enterprises',
      'Samanala Grocery', 'New Lucky Stores', 'Kekirawa Co-op Outlet', 'Melsiripura Green Grocer',
      'Galewela Sunrise Store', 'Habarana Express Shop', 'Kandalama Lake Mart', 'Inamaluwa Corner Shop',
      'Lanka Super Centre', 'Nuwara Traders', 'Rathnayake Food Mart', 'Pradeep Stores',
      'Sirisena Provisions', 'Golden Star Supermarket', 'Ritz Mini Mart', 'Mahaweli Agro Mart',
      'Thilaka Bakers & Grocery', 'Nalanda Trade Centre', 'Dambulu City Store', 'Priyanka Pharmacy',
      'Dammika Enterprises', 'Anuradha Stores', 'Gamage Food City', 'Subhasiri Grocery',
      'Devon Express Shop', 'Ruwan Mini Market', 'Sarath Trade Centre', 'Nilmini Stores',
      'Dayaratne & Sons', 'Senani Grocery', 'Kekirawa Main Street Super', 'Isuru Provisions',
      'Sanasa Retail Shop', 'Janatha Mart', 'Swarna Stores', 'Lakshmi Traders',
      'Rohana Family Store', 'Chaminda Mini Super', 'Sandun Grocery', 'Tharanga Traders',
      'City Food Point', 'Jayanthi Stores', 'Wasantha Mart', 'Manoj Enterprises',
      'Kekirawa Junction Mart', 'Pubudu Stores', 'Rasika Food Centre', 'Tharindu Super',
      'Anura Provisions', 'Sujeewa Stores', 'Ravi Trade Centre', 'Sanka Mini Mart',
      'Malinda Grocers', 'Indika Traders', 'Gayan Super Store', 'Nadeeka Pharmacy',
      'Sujith Enterprises', 'Chandana Stores', 'Lalith Mart', 'Upali Food Point',
      'Kithsiri Provisions', 'Sunil Traders', 'Dhanushka Super', 'Hemamali Stores',
      'Lasantha Mini Mart', 'Pramod Trade Centre', 'Jagath Stores', 'Manjula Grocery',
      'Kamal Enterprises', 'Suresh Mart', 'Ranjith Stores', 'Premadasa Provisions',
      'Asanka Mini Super', 'Chathura Traders', 'Sampath Food City', 'Sanjeewa Stores',
      'Buddhika Grocery', 'Ajith Enterprises', 'Nalaka Mart', 'Prasanna Stores',
      'Deepal Trade Centre', 'Roshan Stores', 'Suranga Provisions', 'Duminda Mini Mart',
      'Chinthaka Super', 'Kasun Traders', 'Mahesh Grocery', 'Sanjeevi Family Mart'
    ];

    const customerTypes = ['Retail shop', 'Grocery', 'Supermarket', 'Pharmacy', 'Restaurant', 'Retail shop', 'Grocery'];
    const insertShop = db.prepare(`
      INSERT INTO shops (
        id, distributor_id, territory_id, route_id, shop_name, shop_code, owner_name,
        telephone, address, town, district, latitude, longitude, customer_type, credit_limit, payment_terms_days, status
      ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `);

    let shopIdCounter = 1;
    for (let i = 0; i < 100; i++) {
      const routeIdx = (i % 15) + 1;
      const rData = routesData.find(r => r.id === routeIdx);
      const terrId = rData ? rData.terr : 1;
      const type = customerTypes[i % customerTypes.length];
      const code = `SH-${String(i + 1).padStart(3, '0')}`;
      const name = shopNames[i];
      const owner = `Mr. ${name.split(' ')[0]} ${name.split(' ')[1] || 'Perera'}`;
      const phone = `+94 77 ${1000000 + i * 478}`;
      // Coordinates around Kekirawa / Dambulla
      const lat = 7.85 + (i % 10) * 0.035;
      const lng = 80.55 + (Math.floor(i / 10)) * 0.030;
      const creditLimit = (20000 + (i % 8) * 15000);
      const terms = i % 2 === 0 ? 14 : 21;

      insertShop.run(
        shopIdCounter,
        terrId,
        routeIdx,
        name,
        code,
        owner,
        phone,
        `No. ${i + 12}, Main Road`,
        rData.name.split(' ')[2] || 'Kekirawa',
        'Anuradhapura',
        lat,
        lng,
        type,
        creditLimit,
        terms
      );
      shopIdCounter++;
    }

    // 12. Route Stops for the 15 Routes
    const insertStop = db.prepare(`
      INSERT INTO route_stops (route_id, stop_order, stop_name, stop_type, shop_id, distance_from_prev_km, latitude, longitude)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let r = 1; r <= 15; r++) {
      // Start DC stop
      insertStop.run(r, 1, 'Kekirawa Central DC', 'dc', null, 0, 8.0433, 80.5922);
      // Intermediate shop stops
      const assignedShops = db.prepare(`SELECT id, shop_name, latitude, longitude FROM shops WHERE route_id = ?`).all(r);
      assignedShops.forEach((sh, idx) => {
        insertStop.run(r, idx + 2, sh.shop_name, 'shop', sh.id, Number((12 + (idx * 2.5)).toFixed(1)), sh.latitude, sh.longitude);
      });
      // Return DC stop
      insertStop.run(r, assignedShops.length + 2, 'Kekirawa Central DC (Return)', 'dc', null, 15.0, 8.0433, 80.5922);
    }

    // 13. Expense Categories
    const insertExpCat = db.prepare(`INSERT INTO expense_categories (id, name, code, is_operating, is_fixed, is_system) VALUES (?, ?, ?, ?, ?, ?)`);
    insertExpCat.run(1, 'Fuel & Oil', 'EXP-FUEL', 1, 0, 1);
    insertExpCat.run(2, 'Vehicle Maintenance & Repairs', 'EXP-MAINT', 1, 0, 1);
    insertExpCat.run(3, 'Driver Base Salaries', 'EXP-DRV-SAL', 1, 1, 1);
    insertExpCat.run(4, 'Driver Route Allowances', 'EXP-DRV-ALW', 1, 0, 1);
    insertExpCat.run(5, 'Warehouse & Office Rent', 'EXP-RENT', 1, 1, 1);
    insertExpCat.run(6, 'Electricity & Utilities', 'EXP-UTIL', 1, 1, 0);
    insertExpCat.run(7, 'Highway Tolls & Parking', 'EXP-TOLL', 1, 0, 0);
    insertExpCat.run(8, 'Loading & Handling', 'EXP-LOAD', 1, 0, 0);
    insertExpCat.run(9, 'Vehicle Insurance & Licenses', 'EXP-INS', 1, 1, 1);
    insertExpCat.run(10, 'General Administration & Misc', 'EXP-GEN', 1, 1, 0);

    // 14. 6 Months Historical Data (March 2026 to August 2026 + September 2026 current)
    console.log('Generating 6 months of historical transactions (Sales, Payments, Fuel, Runs, Expenses, Visits)...');

    const months = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
    const insertSale = db.prepare(`
      INSERT INTO sales (
        id, distributor_id, invoice_number, date, route_id, shop_id, driver_id, sales_rep,
        total_gross, discount, net_sales, total_cogs, gross_profit, payment_type, collection_status
      ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertSaleItem = db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, unit_cost, discount_percent, net_amount, cogs_amount, gross_profit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertPayment = db.prepare(`
      INSERT INTO payments (sale_id, distributor_id, payment_date, amount, payment_method, receipt_number)
      VALUES (?, 1, ?, ?, ?, ?)
    `);

    const insertVisit = db.prepare(`
      INSERT INTO shop_visits (distributor_id, route_id, shop_id, driver_id, vehicle_id, planned_date, actual_visit_date, status, order_amount)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertFuelTx = db.prepare(`
      INSERT INTO fuel_transactions (
        distributor_id, vehicle_id, driver_id, route_id, transaction_date, fuel_type,
        litres, price_per_litre, total_amount, odometer_reading, fuel_station, receipt_number, payment_method
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertOdo = db.prepare(`
      INSERT INTO odometer_readings (distributor_id, vehicle_id, driver_id, route_id, reading_date, opening_odometer, closing_odometer, distance_km)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertRouteRun = db.prepare(`
      INSERT INTO route_runs (distributor_id, route_id, vehicle_id, driver_id, run_date, opening_odometer, closing_odometer, distance_km, status)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, 'completed')
    `);

    const insertExpense = db.prepare(`
      INSERT INTO expenses (
        distributor_id, category_id, date, amount, vehicle_id, route_id, driver_id, employee_name, supplier_name, payment_method, receipt_number, description
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, 'cash', ?, ?)
    `);

    let saleId = 1;
    let invNum = 1000;
    let baseOdometer = 45000;

    // Monthly fixed overhead expenses
    for (const m of months) {
      const firstOfMonth = `${m}-01`;
      // Warehouse Rent
      insertExpense.run(5, firstOfMonth, 85000, null, null, null, null, 'Lanka Realty', `RCP-RNT-${m}`, 'Kekirawa DC Warehouse Monthly Rent');
      // Driver base salaries
      insertExpense.run(3, `${m}-28`, 325000, null, null, null, '5 Drivers', 'Payroll', `PAY-${m}`, 'Consolidated Driver Monthly Salaries');
      // Utilities
      insertExpense.run(6, `${m}-15`, 32000, null, null, null, null, 'CEB & SLT', `BIL-${m}`, 'Warehouse Electricity & Internet');
      // Insurance & Licensing allocation
      insertExpense.run(9, `${m}-05`, 18000, null, null, null, null, 'Ceylinco Insurance', `INS-${m}`, 'Monthly fleet insurance & license provision');
    }

    // Loop through months and simulate cyclic route runs
    for (let mIdx = 0; mIdx < months.length; mIdx++) {
      const monthStr = months[mIdx];
      const isCurrent = (mIdx === months.length - 1); // September 2026

      for (let r = 1; r <= 15; r++) {
        const routeObj = routesData.find(x => x.id === r);
        const dayOfMonth = ((r * 2) % 25) + 1;
        const dateStr = `${monthStr}-${String(dayOfMonth).padStart(2, '0')}`;

        const openingOdo = baseOdometer;
        const closingOdo = openingOdo + routeObj.dist;
        baseOdometer = closingOdo;

        // Route Run
        insertRouteRun.run(r, routeObj.vId, routeObj.dId, dateStr, openingOdo, closingOdo, routeObj.dist);
        // Odometer reading
        insertOdo.run(routeObj.vId, routeObj.dId, r, dateStr, openingOdo, closingOdo, routeObj.dist);

        // Fuel transaction (Diesel Rs. 365 -> 374 -> 382)
        const fuelPrice = mIdx < 2 ? 365 : (mIdx < 4 ? 374 : 382);
        const efficiency = routeObj.vId === 1 ? 17.8 : (routeObj.vId === 2 ? 17.1 : (routeObj.vId === 3 ? 10.5 : 13.8));
        const litres = Number((routeObj.dist / efficiency).toFixed(2));
        const fuelTotal = Number((litres * fuelPrice).toFixed(2));
        insertFuelTx.run(
          routeObj.vId, routeObj.dId, r, dateStr, 'Diesel',
          litres, fuelPrice, fuelTotal, closingOdo,
          'Ceypetco Kekirawa Station', `RCP-FL-${mIdx}-${r}`, 'Fleet Card'
        );

        // Toll & Route variable expense
        insertExpense.run(
          7, dateStr, 1200, routeObj.vId, r, routeObj.dId,
          null, 'Expressway Authority', `TOL-${mIdx}-${r}`, `Highway tolls and parking during ${routeObj.name}`
        );

        // Driver Daily Allowance
        insertExpense.run(
          4, dateStr, 1500, routeObj.vId, r, routeObj.dId,
          'Driver', null, `ALW-${mIdx}-${r}`, `Daily route meal and trip allowance for driver`
        );

        // Sales to shops on this route
        const shopsOnRoute = db.prepare(`SELECT id, shop_name FROM shops WHERE route_id = ?`).all(r);
        for (const sh of shopsOnRoute) {
          invNum++;
          const curInv = `INV-2026-${invNum}`;
          // 2 to 4 random products bought
          const pCount = 2 + ((sh.id + r) % 3);
          let saleGross = 0;
          let saleCogs = 0;

          // Temporary line items array
          const items = [];
          for (let p = 1; p <= pCount; p++) {
            const prodId = ((sh.id * 3 + p) % 10) + 1;
            const prod = db.prepare(`SELECT id, cost_price, selling_price FROM products WHERE id = ?`).get(prodId);
            const qty = 5 + ((sh.id * 2 + p) % 15);
            const netAmt = qty * prod.selling_price;
            const cogsAmt = qty * prod.cost_price;
            const profit = netAmt - cogsAmt;
            saleGross += netAmt;
            saleCogs += cogsAmt;
            items.push({ prodId, qty, unitPrice: prod.selling_price, unitCost: prod.cost_price, netAmt, cogsAmt, profit });
          }

          const discount = Math.round(saleGross * 0.03); // 3% commercial discount
          const netSales = saleGross - discount;
          const grossProfit = netSales - saleCogs;

          // If current month (Sept), 20% credit unpaid to simulate receivables
          const isPaid = isCurrent ? (sh.id % 5 !== 0) : true;
          const collStatus = isPaid ? 'paid' : 'unpaid';

          insertSale.run(
            saleId, curInv, dateStr, r, sh.id, routeObj.dId, 'Priyantha (SR)',
            saleGross, discount, netSales, saleCogs, grossProfit, 'credit', collStatus
          );

          // Line items
          for (const item of items) {
            insertSaleItem.run(saleId, item.prodId, item.qty, item.unitPrice, item.unitCost, 3.0, item.netAmt, item.cogsAmt, item.profit);
          }

          // Payment record if paid
          if (isPaid) {
            insertPayment.run(saleId, dateStr, netSales, 'cash', `RCP-PAY-${saleId}`);
          }

          // Shop Visit record
          const visitStatus = isCurrent && (sh.id % 7 === 0) ? 'due' : 'completed';
          insertVisit.run(r, sh.id, routeObj.dId, routeObj.vId, dateStr, isPaid ? dateStr : null, visitStatus, netSales);

          saleId++;
        }
      }
    }

    // 15. Vehicle Maintenance Records
    const insertMaint = db.prepare(`
      INSERT INTO maintenance (
        distributor_id, vehicle_id, service_date, odometer, service_type,
        parts_cost, labor_cost, total_cost, next_service_odometer, next_service_date, garage, invoice_number, notes
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertMaint.run(1, '2026-04-12', 49500, 'routine', 18500, 6500, 25000, 54500, '2026-07-12', 'Dimo Lanka Service Centre', 'INV-DMO-4812', 'Periodic 5,000km engine oil, oil filter, air filter change');
    insertMaint.run(1, '2026-07-18', 55000, 'repair', 24000, 8000, 32000, 60000, '2026-10-18', 'Kekirawa Auto Engineers', 'INV-KAE-8902', 'Front brake pad replacement and drum skimming');
    insertMaint.run(2, '2026-05-10', 68000, 'routine', 21000, 7000, 28000, 73000, '2026-08-10', 'Tata Commercial Service Kurunegala', 'INV-TAT-9102', 'Standard 5k service + differential oil top-up');
    insertMaint.run(3, '2026-06-25', 120000, 'tires', 85000, 5000, 90000, 127500, '2026-11-25', 'Dambulla Tyre House', 'INV-DTH-2341', 'Two rear heavy duty radial tyre replacement');
    insertMaint.run(4, '2026-07-02', 39000, 'routine', 16500, 5500, 22000, 44000, '2026-10-02', 'Mahindra Care Dambulla', 'INV-MAH-1102', 'Engine tuning, filter replacements, suspension check');

    // 16. Audit Log Initial Records
    const insertAudit = db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertAudit.run(1, 'SYSTEM_INIT', 'database', null, null, JSON.stringify({ version: '1.0.0', seed: true }), '127.0.0.1', '2026-03-01 08:00:00');
    insertAudit.run(1, 'PRICE_CHANGE', 'fuel_prices', 3, JSON.stringify({ price: 374 }), JSON.stringify({ price: 382, fuel: 'Diesel' }), '127.0.0.1', '2026-07-01 09:30:00');
  })();

  console.log('--- Seed Data Generated Successfully ---');
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('seeder.js')) {
  runSeeder();
}

export default runSeeder;

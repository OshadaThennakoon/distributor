-- Multi-Distributor Distribution, Route, Vehicle & Finance Management System Schema
-- SQLite Relational Database with Full Foreign Key Support

PRAGMA foreign_keys = ON;

-- 1. Distributors (Tenants)
CREATE TABLE IF NOT EXISTS distributors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    reg_number TEXT,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    currency_code TEXT DEFAULT 'LKR',
    currency_symbol TEXT DEFAULT 'Rs.',
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Distribution Centers (Hubs)
CREATE TABLE IF NOT EXISTS distribution_centers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distributor_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    address TEXT,
    town TEXT,
    district TEXT,
    province TEXT,
    latitude REAL,
    longitude REAL,
    contact_number TEXT,
    manager TEXT,
    opening_date DATE,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE
);

-- 3. Territories
CREATE TABLE IF NOT EXISTS territories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distributor_id INTEGER NOT NULL,
    distribution_center_id INTEGER,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    district TEXT,
    province TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (distribution_center_id) REFERENCES distribution_centers(id) ON DELETE SET NULL
);

-- 4. Towns
CREATE TABLE IF NOT EXISTS towns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    territory_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    latitude REAL,
    longitude REAL,
    postal_code TEXT,
    FOREIGN KEY (territory_id) REFERENCES territories(id) ON DELETE CASCADE
);

-- 5. Drivers
CREATE TABLE IF NOT EXISTS drivers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distributor_id INTEGER NOT NULL,
    full_name TEXT NOT NULL,
    nic TEXT NOT NULL,
    phone TEXT NOT NULL,
    license_number TEXT NOT NULL,
    license_expiry DATE NOT NULL,
    monthly_salary REAL DEFAULT 0,
    daily_allowance REAL DEFAULT 0,
    assigned_vehicle_id INTEGER,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'on_leave')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE
);

-- 6. Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distributor_id INTEGER NOT NULL,
    vehicle_number TEXT NOT NULL UNIQUE,
    vehicle_type TEXT NOT NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER,
    fuel_type TEXT NOT NULL CHECK(fuel_type IN ('Diesel', 'Petrol', 'Hybrid', 'Electric')),
    fuel_tank_capacity_l REAL DEFAULT 40,
    expected_kml REAL NOT NULL,
    actual_kml REAL DEFAULT 0,
    purchase_date DATE,
    current_odometer REAL DEFAULT 0,
    assigned_route_id INTEGER,
    assigned_driver_id INTEGER,
    insurance_expiry DATE,
    revenue_license_expiry DATE,
    service_interval_km REAL DEFAULT 5000,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'maintenance', 'inactive')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_driver_id) REFERENCES drivers(id) ON DELETE SET NULL
);

-- Update drivers circular FK if needed
-- 7. Routes
CREATE TABLE IF NOT EXISTS routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distributor_id INTEGER NOT NULL,
    distribution_center_id INTEGER,
    territory_id INTEGER,
    route_name TEXT NOT NULL,
    route_code TEXT NOT NULL,
    starting_location TEXT NOT NULL,
    ending_location TEXT NOT NULL,
    route_distance_km REAL NOT NULL DEFAULT 0,
    estimated_travel_time_mins INTEGER DEFAULT 0,
    number_of_shops INTEGER DEFAULT 0,
    visit_frequency TEXT NOT NULL DEFAULT 'Every 3 weeks',
    frequency_days INTEGER NOT NULL DEFAULT 21,
    route_type TEXT DEFAULT 'Regular',
    vehicle_id INTEGER,
    driver_id INTEGER,
    is_active INTEGER DEFAULT 1,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (distribution_center_id) REFERENCES distribution_centers(id) ON DELETE SET NULL,
    FOREIGN KEY (territory_id) REFERENCES territories(id) ON DELETE SET NULL,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL
);

-- 8. Route Stops
CREATE TABLE IF NOT EXISTS route_stops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_id INTEGER NOT NULL,
    stop_order INTEGER NOT NULL,
    stop_name TEXT NOT NULL,
    stop_type TEXT NOT NULL CHECK(stop_type IN ('dc', 'town', 'shop')),
    shop_id INTEGER,
    distance_from_prev_km REAL DEFAULT 0,
    latitude REAL,
    longitude REAL,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL
);

-- 9. Shops (Customers)
CREATE TABLE IF NOT EXISTS shops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distributor_id INTEGER NOT NULL,
    territory_id INTEGER,
    route_id INTEGER,
    shop_name TEXT NOT NULL,
    shop_code TEXT NOT NULL,
    owner_name TEXT,
    telephone TEXT,
    address TEXT,
    town TEXT,
    district TEXT,
    latitude REAL,
    longitude REAL,
    customer_type TEXT DEFAULT 'Retail shop' CHECK(customer_type IN ('Retail shop', 'Supermarket', 'Grocery', 'Pharmacy', 'Restaurant', 'Hotel', 'Other')),
    credit_limit REAL DEFAULT 0,
    payment_terms_days INTEGER DEFAULT 14,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (territory_id) REFERENCES territories(id) ON DELETE SET NULL,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL
);

-- 10. Shop Visits
CREATE TABLE IF NOT EXISTS shop_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distributor_id INTEGER NOT NULL,
    route_id INTEGER NOT NULL,
    shop_id INTEGER NOT NULL,
    driver_id INTEGER,
    vehicle_id INTEGER,
    planned_date DATE NOT NULL,
    actual_visit_date DATE,
    status TEXT DEFAULT 'due' CHECK(status IN ('due', 'completed', 'missed', 'cancelled')),
    order_amount REAL DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
);

-- 11. Product Categories
CREATE TABLE IF NOT EXISTS product_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distributor_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE
);

-- 12. Products
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distributor_id INTEGER NOT NULL,
    category_id INTEGER,
    product_name TEXT NOT NULL,
    sku TEXT NOT NULL,
    brand TEXT,
    unit TEXT DEFAULT 'piece',
    cost_price REAL NOT NULL,
    selling_price REAL NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    min_stock_level INTEGER DEFAULT 10,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL
);

-- 13. Fuel Prices (Historical records)
CREATE TABLE IF NOT EXISTS fuel_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fuel_type TEXT NOT NULL CHECK(fuel_type IN ('Diesel', 'Petrol')),
    price_per_litre REAL NOT NULL,
    effective_date DATE NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 14. Fuel Transactions
CREATE TABLE IF NOT EXISTS fuel_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distributor_id INTEGER NOT NULL,
    vehicle_id INTEGER NOT NULL,
    driver_id INTEGER,
    route_id INTEGER,
    transaction_date DATE NOT NULL,
    fuel_type TEXT NOT NULL,
    litres REAL NOT NULL,
    price_per_litre REAL NOT NULL,
    total_amount REAL NOT NULL,
    odometer_reading REAL,
    fuel_station TEXT,
    receipt_number TEXT,
    payment_method TEXT DEFAULT 'Cash',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL
);

-- 15. Odometer Readings
CREATE TABLE IF NOT EXISTS odometer_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distributor_id INTEGER NOT NULL,
    vehicle_id INTEGER NOT NULL,
    driver_id INTEGER,
    route_id INTEGER,
    reading_date DATE NOT NULL,
    opening_odometer REAL NOT NULL,
    closing_odometer REAL NOT NULL,
    distance_km REAL NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL
);

-- 16. Sales Invoices
CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distributor_id INTEGER NOT NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    date DATE NOT NULL,
    route_id INTEGER,
    shop_id INTEGER NOT NULL,
    driver_id INTEGER,
    sales_rep TEXT,
    total_gross REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    net_sales REAL NOT NULL DEFAULT 0,
    total_cogs REAL NOT NULL DEFAULT 0,
    gross_profit REAL NOT NULL DEFAULT 0,
    payment_type TEXT DEFAULT 'credit' CHECK(payment_type IN ('cash', 'credit', 'bank_transfer', 'cheque')),
    collection_status TEXT DEFAULT 'unpaid' CHECK(collection_status IN ('paid', 'partial', 'unpaid')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL
);

-- 17. Sale Items
CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    unit_cost REAL NOT NULL,
    discount_percent REAL DEFAULT 0,
    net_amount REAL NOT NULL,
    cogs_amount REAL NOT NULL,
    gross_profit REAL NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 18. Payments
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    distributor_id INTEGER NOT NULL,
    payment_date DATE NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT DEFAULT 'cash' CHECK(payment_method IN ('cash', 'cheque', 'bank_transfer', 'other')),
    receipt_number TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE
);

-- 19. Expense Categories
CREATE TABLE IF NOT EXISTS expense_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    is_operating INTEGER DEFAULT 1,
    is_fixed INTEGER DEFAULT 0,
    is_system INTEGER DEFAULT 0
);

-- 20. Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distributor_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    date DATE NOT NULL,
    amount REAL NOT NULL,
    vehicle_id INTEGER,
    route_id INTEGER,
    driver_id INTEGER,
    employee_name TEXT,
    supplier_name TEXT,
    payment_method TEXT DEFAULT 'cash',
    receipt_number TEXT,
    description TEXT,
    is_recurring INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL
);

-- 21. Maintenance Records
CREATE TABLE IF NOT EXISTS maintenance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distributor_id INTEGER NOT NULL,
    vehicle_id INTEGER NOT NULL,
    service_date DATE NOT NULL,
    odometer REAL NOT NULL,
    service_type TEXT NOT NULL CHECK(service_type IN ('routine', 'repair', 'tires', 'battery', 'emergency', 'other')),
    parts_cost REAL DEFAULT 0,
    labor_cost REAL DEFAULT 0,
    total_cost REAL NOT NULL,
    next_service_odometer REAL,
    next_service_date DATE,
    garage TEXT,
    invoice_number TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- 22. Route Runs (Executed Trips)
CREATE TABLE IF NOT EXISTS route_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distributor_id INTEGER NOT NULL,
    route_id INTEGER NOT NULL,
    vehicle_id INTEGER NOT NULL,
    driver_id INTEGER NOT NULL,
    run_date DATE NOT NULL,
    opening_odometer REAL,
    closing_odometer REAL,
    distance_km REAL NOT NULL,
    status TEXT DEFAULT 'completed' CHECK(status IN ('completed', 'in_progress', 'cancelled')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
);

-- 23. Users & Authentication
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('ADMIN', 'FINANCE_USER', 'VIEWER')),
    distributor_id INTEGER,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE SET NULL
);

-- 24. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    old_values TEXT,
    new_values TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 25. System Settings
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 26. Operational Targets (Sales, Cost, KM)
CREATE TABLE IF NOT EXISTS targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distributor_id INTEGER NOT NULL,
    target_type TEXT NOT NULL CHECK(target_type IN ('sales', 'cost', 'km')),
    period_type TEXT NOT NULL CHECK(period_type IN ('daily', 'monthly')),
    target_period TEXT NOT NULL, -- 'YYYY-MM-DD' for daily or 'YYYY-MM' for monthly
    route_id INTEGER,
    vehicle_id INTEGER,
    driver_id INTEGER,
    target_value REAL NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL
);

-- Indexes for lightning-fast multi-tenant queries & financial reports
CREATE INDEX IF NOT EXISTS idx_distributors_code ON distributors(code);
CREATE INDEX IF NOT EXISTS idx_dc_distributor ON distribution_centers(distributor_id);
CREATE INDEX IF NOT EXISTS idx_territory_distributor ON territories(distributor_id);
CREATE INDEX IF NOT EXISTS idx_routes_distributor ON routes(distributor_id);
CREATE INDEX IF NOT EXISTS idx_routes_dc ON routes(distribution_center_id);
CREATE INDEX IF NOT EXISTS idx_shops_distributor ON shops(distributor_id);
CREATE INDEX IF NOT EXISTS idx_shops_route ON shops(route_id);
CREATE INDEX IF NOT EXISTS idx_shop_visits_planned_date ON shop_visits(planned_date);
CREATE INDEX IF NOT EXISTS idx_shop_visits_status ON shop_visits(status);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_distributor ON sales(distributor_id);
CREATE INDEX IF NOT EXISTS idx_sales_route ON sales(route_id);
CREATE INDEX IF NOT EXISTS idx_sales_shop ON sales(shop_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_fuel_distributor ON fuel_transactions(distributor_id);
CREATE INDEX IF NOT EXISTS idx_fuel_date ON fuel_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_fuel_vehicle ON fuel_transactions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_expenses_distributor ON expenses(distributor_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle ON maintenance(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_date ON maintenance(service_date);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_targets_period ON targets(distributor_id, target_period, target_type);


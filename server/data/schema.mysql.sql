-- Multi-Distributor Distribution, Route, Vehicle & Finance Management System Schema
-- MySQL / MariaDB Relational Database Schema
-- Matches 100% with SQLite schema.sql

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Distributors (Tenants)
CREATE TABLE IF NOT EXISTS distributors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    reg_number VARCHAR(100),
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    currency_code VARCHAR(10) DEFAULT 'LKR',
    currency_symbol VARCHAR(10) DEFAULT 'Rs.',
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Distribution Centers (Hubs)
CREATE TABLE IF NOT EXISTS distribution_centers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    distributor_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    address TEXT,
    town VARCHAR(100),
    district VARCHAR(100),
    province VARCHAR(100),
    latitude DOUBLE,
    longitude DOUBLE,
    contact_number VARCHAR(50),
    manager VARCHAR(255),
    opening_date DATE,
    status ENUM('active', 'inactive') DEFAULT 'active',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Territories
CREATE TABLE IF NOT EXISTS territories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    distributor_id INT NOT NULL,
    distribution_center_id INT,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    district VARCHAR(100),
    province VARCHAR(100),
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (distribution_center_id) REFERENCES distribution_centers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Towns
CREATE TABLE IF NOT EXISTS towns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    territory_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    latitude DOUBLE,
    longitude DOUBLE,
    postal_code VARCHAR(20),
    FOREIGN KEY (territory_id) REFERENCES territories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Drivers
CREATE TABLE IF NOT EXISTS drivers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    distributor_id INT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    nic VARCHAR(50) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    license_number VARCHAR(50) NOT NULL,
    license_expiry DATE NOT NULL,
    monthly_salary DOUBLE DEFAULT 0,
    daily_allowance DOUBLE DEFAULT 0,
    assigned_vehicle_id INT,
    status ENUM('active', 'inactive', 'on_leave') DEFAULT 'active',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    distributor_id INT NOT NULL,
    vehicle_number VARCHAR(50) NOT NULL UNIQUE,
    vehicle_type VARCHAR(100) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year INT,
    fuel_type ENUM('Diesel', 'Petrol', 'Hybrid', 'Electric') NOT NULL,
    fuel_tank_capacity_l DOUBLE DEFAULT 40,
    expected_kml DOUBLE NOT NULL,
    actual_kml DOUBLE DEFAULT 0,
    purchase_date DATE,
    current_odometer DOUBLE DEFAULT 0,
    assigned_route_id INT,
    assigned_driver_id INT,
    insurance_expiry DATE,
    revenue_license_expiry DATE,
    service_interval_km DOUBLE DEFAULT 5000,
    status ENUM('active', 'maintenance', 'inactive') DEFAULT 'active',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_driver_id) REFERENCES drivers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Routes
CREATE TABLE IF NOT EXISTS routes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    distributor_id INT NOT NULL,
    distribution_center_id INT,
    territory_id INT,
    route_name VARCHAR(255) NOT NULL,
    route_code VARCHAR(50) NOT NULL,
    starting_location VARCHAR(255) NOT NULL,
    ending_location VARCHAR(255) NOT NULL,
    route_distance_km DOUBLE NOT NULL DEFAULT 0,
    estimated_travel_time_mins INT DEFAULT 0,
    number_of_shops INT DEFAULT 0,
    visit_frequency VARCHAR(50) NOT NULL DEFAULT 'Every 3 weeks',
    frequency_days INT NOT NULL DEFAULT 21,
    route_type VARCHAR(50) DEFAULT 'Regular',
    vehicle_id INT,
    driver_id INT,
    is_active INT DEFAULT 1,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (distribution_center_id) REFERENCES distribution_centers(id) ON DELETE SET NULL,
    FOREIGN KEY (territory_id) REFERENCES territories(id) ON DELETE SET NULL,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Shops (Customers)
CREATE TABLE IF NOT EXISTS shops (
    id INT AUTO_INCREMENT PRIMARY KEY,
    distributor_id INT NOT NULL,
    territory_id INT,
    route_id INT,
    shop_name VARCHAR(255) NOT NULL,
    shop_code VARCHAR(50) NOT NULL,
    owner_name VARCHAR(255),
    telephone VARCHAR(50),
    address TEXT,
    town VARCHAR(100),
    district VARCHAR(100),
    latitude DOUBLE,
    longitude DOUBLE,
    customer_type VARCHAR(50) DEFAULT 'Retail shop',
    credit_limit DOUBLE DEFAULT 0,
    payment_terms_days INT DEFAULT 14,
    status ENUM('active', 'inactive') DEFAULT 'active',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (territory_id) REFERENCES territories(id) ON DELETE SET NULL,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Route Stops
CREATE TABLE IF NOT EXISTS route_stops (
    id INT AUTO_INCREMENT PRIMARY KEY,
    route_id INT NOT NULL,
    stop_order INT NOT NULL,
    stop_name VARCHAR(255) NOT NULL,
    stop_type ENUM('dc', 'town', 'shop') NOT NULL,
    shop_id INT,
    distance_from_prev_km DOUBLE DEFAULT 0,
    latitude DOUBLE,
    longitude DOUBLE,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Shop Visits
CREATE TABLE IF NOT EXISTS shop_visits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    distributor_id INT NOT NULL,
    route_id INT NOT NULL,
    shop_id INT NOT NULL,
    driver_id INT,
    vehicle_id INT,
    planned_date DATE NOT NULL,
    actual_visit_date DATE,
    status ENUM('due', 'completed', 'missed', 'cancelled') DEFAULT 'due',
    order_amount DOUBLE DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. Product Categories
CREATE TABLE IF NOT EXISTS product_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    distributor_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. Products
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    distributor_id INT NOT NULL,
    category_id INT,
    product_name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    brand VARCHAR(100),
    unit VARCHAR(50) DEFAULT 'piece',
    cost_price DOUBLE NOT NULL,
    selling_price DOUBLE NOT NULL,
    mrp DOUBLE DEFAULT 0,
    batch_number VARCHAR(100),
    expiry_date DATE,
    stock_quantity INT DEFAULT 0,
    min_stock_level INT DEFAULT 10,
    is_active INT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13. Fuel Prices (Historical records)
CREATE TABLE IF NOT EXISTS fuel_prices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fuel_type ENUM('Diesel', 'Petrol') NOT NULL,
    price_per_litre DOUBLE NOT NULL,
    effective_date DATE NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 14. Fuel Transactions
CREATE TABLE IF NOT EXISTS fuel_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    distributor_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    driver_id INT,
    route_id INT,
    transaction_date DATE NOT NULL,
    fuel_type VARCHAR(50) NOT NULL,
    litres DOUBLE NOT NULL,
    price_per_litre DOUBLE NOT NULL,
    total_amount DOUBLE NOT NULL,
    odometer_reading DOUBLE,
    fuel_station VARCHAR(255),
    receipt_number VARCHAR(100),
    payment_method VARCHAR(50) DEFAULT 'Cash',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 15. Odometer Readings
CREATE TABLE IF NOT EXISTS odometer_readings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    distributor_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    driver_id INT,
    route_id INT,
    reading_date DATE NOT NULL,
    opening_odometer DOUBLE NOT NULL,
    closing_odometer DOUBLE NOT NULL,
    distance_km DOUBLE NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 16. Sales Invoices
CREATE TABLE IF NOT EXISTS sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    distributor_id INT NOT NULL,
    invoice_number VARCHAR(100) NOT NULL UNIQUE,
    date DATE NOT NULL,
    route_id INT,
    shop_id INT NOT NULL,
    driver_id INT,
    sales_rep VARCHAR(255),
    total_gross DOUBLE NOT NULL DEFAULT 0,
    discount DOUBLE NOT NULL DEFAULT 0,
    net_sales DOUBLE NOT NULL DEFAULT 0,
    total_cogs DOUBLE NOT NULL DEFAULT 0,
    gross_profit DOUBLE NOT NULL DEFAULT 0,
    payment_type ENUM('cash', 'credit', 'bank_transfer', 'cheque') DEFAULT 'credit',
    collection_status ENUM('paid', 'partial', 'unpaid') DEFAULT 'unpaid',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 17. Sale Items
CREATE TABLE IF NOT EXISTS sale_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sale_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DOUBLE NOT NULL,
    unit_cost DOUBLE NOT NULL,
    discount_percent DOUBLE DEFAULT 0,
    net_amount DOUBLE NOT NULL,
    cogs_amount DOUBLE NOT NULL,
    gross_profit DOUBLE NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 18. Payments
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sale_id INT NOT NULL,
    distributor_id INT NOT NULL,
    payment_date DATE NOT NULL,
    amount DOUBLE NOT NULL,
    payment_method ENUM('cash', 'cheque', 'bank_transfer', 'other') DEFAULT 'cash',
    cheque_number VARCHAR(100),
    cheque_date DATE,
    bank_name VARCHAR(100),
    cheque_status ENUM('pending', 'cleared', 'bounced', 'deposited') DEFAULT 'pending',
    cleared_date DATE,
    bank_account_id INT,
    receipt_number VARCHAR(100),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 19. Expense Categories
CREATE TABLE IF NOT EXISTS expense_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    is_operating INT DEFAULT 1,
    is_fixed INT DEFAULT 0,
    is_system INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 20. Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    distributor_id INT NOT NULL,
    category_id INT NOT NULL,
    date DATE NOT NULL,
    amount DOUBLE NOT NULL,
    vehicle_id INT,
    route_id INT,
    driver_id INT,
    employee_name VARCHAR(255),
    supplier_name VARCHAR(255),
    payment_method VARCHAR(50) DEFAULT 'cash',
    receipt_number VARCHAR(100),
    description TEXT,
    is_recurring INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 21. Maintenance Records
CREATE TABLE IF NOT EXISTS maintenance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    distributor_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    service_date DATE NOT NULL,
    odometer DOUBLE NOT NULL,
    service_type ENUM('routine', 'repair', 'tires', 'battery', 'emergency', 'other') NOT NULL,
    parts_cost DOUBLE DEFAULT 0,
    labor_cost DOUBLE DEFAULT 0,
    total_cost DOUBLE NOT NULL,
    next_service_odometer DOUBLE,
    next_service_date DATE,
    garage VARCHAR(255),
    invoice_number VARCHAR(100),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 22. Route Runs (Executed Trips)
CREATE TABLE IF NOT EXISTS route_runs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    distributor_id INT NOT NULL,
    route_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    driver_id INT NOT NULL,
    run_date DATE NOT NULL,
    opening_odometer DOUBLE,
    closing_odometer DOUBLE,
    distance_km DOUBLE NOT NULL,
    status ENUM('completed', 'in_progress', 'cancelled') DEFAULT 'completed',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 23. Users & Authentication
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role ENUM('ADMIN', 'FINANCE_USER', 'VIEWER') NOT NULL,
    distributor_id INT,
    is_active INT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 24. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id INT,
    old_values LONGTEXT,
    new_values LONGTEXT,
    ip_address VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 25. System Settings
CREATE TABLE IF NOT EXISTS system_settings (
    `key` VARCHAR(100) PRIMARY KEY,
    `value` TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 26. Operational Targets (Sales, Cost, KM)
CREATE TABLE IF NOT EXISTS targets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    distributor_id INT NOT NULL,
    target_type ENUM('sales', 'cost', 'km') NOT NULL,
    period_type ENUM('daily', 'monthly') NOT NULL,
    target_period VARCHAR(50) NOT NULL,
    route_id INT,
    vehicle_id INT,
    driver_id INT,
    target_value DOUBLE NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 27. Bank Accounts
CREATE TABLE IF NOT EXISTS bank_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    distributor_id INT NOT NULL,
    account_name VARCHAR(100) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    branch VARCHAR(100),
    initial_balance DOUBLE DEFAULT 0,
    current_balance DOUBLE DEFAULT 0,
    is_active INT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 28. Cash Drawer Adjustments & Float Logs
CREATE TABLE IF NOT EXISTS cash_drawer_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    distributor_id INT NOT NULL,
    transaction_type ENUM('cash_in', 'cash_out') NOT NULL,
    amount DOUBLE NOT NULL,
    reason VARCHAR(255) NOT NULL,
    performed_by VARCHAR(100),
    date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 29. Stock Movements & Inventory Transaction Ledger
CREATE TABLE IF NOT EXISTS stock_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    distributor_id INT NOT NULL,
    product_id INT NOT NULL,
    movement_type ENUM('INWARD_GRN', 'OUTWARD_SALE', 'DISPATCH', 'DAMAGE_DISPOSAL', 'EXPIRED_WRITE_OFF', 'AUDIT_CORRECTION', 'RETURN_INWARD') NOT NULL,
    quantity INT NOT NULL,
    previous_stock INT NOT NULL,
    new_stock INT NOT NULL,
    unit_cost DOUBLE DEFAULT 0,
    batch_number VARCHAR(100),
    expiry_date DATE,
    reference_number VARCHAR(100),
    performed_by VARCHAR(100),
    notes TEXT,
    date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Indexes for performance
CREATE INDEX idx_distributors_code ON distributors(code);
CREATE INDEX idx_dc_distributor ON distribution_centers(distributor_id);
CREATE INDEX idx_territory_distributor ON territories(distributor_id);
CREATE INDEX idx_routes_distributor ON routes(distributor_id);
CREATE INDEX idx_routes_dc ON routes(distribution_center_id);
CREATE INDEX idx_shops_distributor ON shops(distributor_id);
CREATE INDEX idx_shops_route ON shops(route_id);
CREATE INDEX idx_shop_visits_planned_date ON shop_visits(planned_date);
CREATE INDEX idx_shop_visits_status ON shop_visits(status);
CREATE INDEX idx_sales_date ON sales(date);
CREATE INDEX idx_sales_distributor ON sales(distributor_id);
CREATE INDEX idx_sales_route ON sales(route_id);
CREATE INDEX idx_sales_shop ON sales(shop_id);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_fuel_distributor ON fuel_transactions(distributor_id);
CREATE INDEX idx_fuel_date ON fuel_transactions(transaction_date);
CREATE INDEX idx_fuel_vehicle ON fuel_transactions(vehicle_id);
CREATE INDEX idx_expenses_distributor ON expenses(distributor_id);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_maintenance_vehicle ON maintenance(vehicle_id);
CREATE INDEX idx_maintenance_date ON maintenance(service_date);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
CREATE INDEX idx_targets_period ON targets(distributor_id, target_period, target_type);
CREATE INDEX idx_stock_movements_prod ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_date ON stock_movements(date);

SET FOREIGN_KEY_CHECKS = 1;

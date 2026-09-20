import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import CalculationEngine from '../services/calculationEngine.js';

describe('Calculation Engine - Operational & Financial Formulas', () => {
  it('should accurately calculate monthly route cycle and distance (Section 11 & 46)', () => {
    // 130 km route, every 3 weeks (21 days)
    const result = CalculationEngine.calculateRouteCycle(130, 21, 30);
    assert.equal(result.routeDistanceKm, 130);
    assert.equal(result.frequencyDays, 21);
    assert.equal(result.monthlyCycles, 1.4286);
    assert.equal(result.monthlyDistanceKm, 185.71);

    // Fleet of 15 routes of 130 km each
    const fleetRoutes = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      route_name: `Route ${i + 1}`,
      route_distance_km: 130,
      frequency_days: 21,
      number_of_shops: 8
    }));

    const fleet = CalculationEngine.calculateFleetCycle(fleetRoutes, 30);
    assert.equal(fleet.totalRoutes, 15);
    assert.equal(fleet.totalCycleDistance, 1950); // 15 * 130
    // Monthly distance: 1950 * (30 / 21) = 2785.71 km
    assert.equal(Math.round(fleet.totalMonthlyDistance), 2786);
  });

  it('should accurately calculate fuel litres, total fuel cost, and cost/km (Section 14 & 46)', () => {
    // Monthly distance 2,786 km, 18 km/L, Diesel Rs. 382
    const fuel = CalculationEngine.calculateFuel({
      distanceKm: 2786,
      kmPerLitre: 18,
      pricePerLitre: 382
    });

    // Litres = 2786 / 18 = 154.78
    assert.equal(Math.round(fuel.fuelLitres), 155);
    // Cost = 154.78 * 382 = 59,125
    assert.ok(fuel.fuelCost > 59000 && fuel.fuelCost < 60000);
    // Cost per km = 382 / 18 = Rs. 21.22/km
    assert.equal(fuel.costPerKm, 21.22);
  });

  it('should detect abnormal vehicle fuel consumption variance (Section 13)', () => {
    // Actual 14.5 km/L vs Expected 18.0 km/L (-19.4% deficit)
    const anomaly = CalculationEngine.calculateFuelEfficiencyVariance(14.5, 18.0);
    assert.equal(anomaly.status, 'ABNORMAL_HIGH_CONSUMPTION');
    assert.ok(anomaly.variancePct < -15);

    // Normal operation: 17.8 km/L vs 18.0 km/L
    const normal = CalculationEngine.calculateFuelEfficiencyVariance(17.8, 18.0);
    assert.equal(normal.status, 'NORMAL');
  });

  it('should accurately allocate driver daily cost including allowance (Section 16)', () => {
    // Rs. 65,000 salary / 26 days = Rs. 2,500 + Rs. 1,500 allowance = Rs. 4,000/day
    const driver = CalculationEngine.calculateDriverDailyCost({
      monthlySalary: 65000,
      dailyAllowance: 1500,
      workingDaysPerMonth: 26
    });

    assert.equal(driver.baseDailyCost, 2500);
    assert.equal(driver.totalDailyCost, 4000);
  });

  it('should calculate total route cost, cost per km, and cost per shop visit (Section 16, 17, 18)', () => {
    const routeCost = CalculationEngine.calculateTotalRouteCost({
      distanceKm: 125,
      kmPerLitre: 18,
      fuelPricePerLitre: 382,
      driverMonthlySalary: 65000,
      driverDailyAllowance: 1500,
      workingDaysPerMonth: 26,
      maintenanceCostPerKm: 8,
      monthlyInsuranceAllocation: 2500,
      monthlyLicenseAllocation: 1000,
      monthlyDistanceEstimate: 2786,
      otherExpenses: 1200,
      numberOfShops: 8
    });

    // Fuel cost: 125 / 18 * 382 = 2,652.78
    // Driver cost: 4,000
    // Maintenance: 125 * 8 = 1,000
    // Other expenses: 1,200
    // Total should be around 8,852.78 + fixed allocation
    assert.ok(routeCost.totalRouteCost > 8800);
    assert.ok(routeCost.costPerKm > 60);
    assert.ok(routeCost.costPerShop > 1000);
    assert.ok(routeCost.breakdown.fuelPct > 25);
  });

  it('should calculate gross profit, net operating profit, and profit margins (Section 21)', () => {
    // Sales Rs. 1,000,000, COGS Rs. 700,000, OPEX Rs. 150,000
    const profit = CalculationEngine.calculateProfitability({
      salesRevenue: 1000000,
      cogs: 700000,
      operatingExpenses: 150000
    });

    assert.equal(profit.grossProfit, 300000);
    assert.equal(profit.grossMarginPct, 30.0);
    assert.equal(profit.netProfit, 150000);
    assert.equal(profit.netMarginPct, 15.0);
  });

  it('should calculate break-even sales revenue, shops, and contribution margins (Section 34)', () => {
    const breakEven = CalculationEngine.calculateBreakEven({
      fixedCosts: 150000,
      salesRevenue: 1000000,
      cogs: 700000,
      variableCosts: 100000,
      totalShops: 100,
      totalRoutes: 15
    });

    // Contribution Margin = 1,000,000 - 700,000 - 100,000 = 200,000
    assert.equal(breakEven.contributionMargin, 200000);
    assert.equal(breakEven.contributionMarginRatio, 0.2);
    // Break-even revenue = 150,000 / 0.2 = 750,000
    assert.equal(breakEven.breakEvenRevenue, 750000);
    assert.ok(breakEven.breakEvenShops > 0);
  });

  it('should simulate What-If route scenario variations dynamically (Section 32 & 33)', () => {
    const sim = CalculationEngine.simulateScenario({
      numRoutes: 15,
      avgRouteDistanceKm: 130,
      visitFrequencyDays: 21,
      vehicleEfficiencyKml: 18,
      fuelPricePerLitre: 382
    });

    assert.equal(sim.operational.totalCycleDistance, 1950);
    assert.equal(Math.round(sim.operational.monthlyDistanceKm), 2786);
    assert.ok(sim.financial.monthlyFuelCost > 50000);
    assert.ok(sim.unitEconomics.costPerKm > 0);
  });
});

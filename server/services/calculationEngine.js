/**
 * Centralized Calculation Engine for Multi-Distributor Management System
 * Pure, decoupled functions for operational, vehicle, route, and financial intelligence.
 */

export const CalculationEngine = {
  /**
   * 1. Route Cycle and Distance Calculations
   */
  calculateRouteCycle(routeDistanceKm, frequencyDays = 21, daysInMonth = 30) {
    const dist = Number(routeDistanceKm) || 0;
    const days = Math.max(Number(frequencyDays) || 21, 1);
    const monthlyCycles = daysInMonth / days;
    const monthlyDistanceKm = dist * monthlyCycles;

    return {
      routeDistanceKm: Number(dist.toFixed(2)),
      frequencyDays: days,
      monthlyCycles: Number(monthlyCycles.toFixed(4)),
      monthlyDistanceKm: Number(monthlyDistanceKm.toFixed(2)),
      formula: `${dist} km × (${daysInMonth} / ${days} days) = ${monthlyDistanceKm.toFixed(2)} km/month`
    };
  },

  /**
   * Fleet aggregate cycle distance
   */
  calculateFleetCycle(routes = [], daysInMonth = 30) {
    let totalCycleDistance = 0;
    let totalMonthlyDistance = 0;
    let totalShops = 0;

    const breakdown = routes.map(r => {
      const dist = Number(r.route_distance_km) || 0;
      const days = Number(r.frequency_days) || 21;
      const shops = Number(r.number_of_shops) || 0;
      const cycles = daysInMonth / days;
      const monthlyDist = dist * cycles;

      totalCycleDistance += dist;
      totalMonthlyDistance += monthlyDist;
      totalShops += shops;

      return {
        routeId: r.id,
        routeName: r.route_name,
        routeDistanceKm: dist,
        frequencyDays: days,
        monthlyCycles: Number(cycles.toFixed(2)),
        monthlyDistanceKm: Number(monthlyDist.toFixed(2)),
        shops
      };
    });

    return {
      totalRoutes: routes.length,
      totalCycleDistance: Number(totalCycleDistance.toFixed(2)),
      totalMonthlyDistance: Number(totalMonthlyDistance.toFixed(2)),
      totalShops,
      breakdown
    };
  },

  /**
   * 2. Fuel Consumption & Cost
   */
  calculateFuel({ distanceKm, kmPerLitre, pricePerLitre }) {
    const dist = Number(distanceKm) || 0;
    const kml = Math.max(Number(kmPerLitre) || 1, 0.1);
    const price = Number(pricePerLitre) || 0;

    const litres = dist / kml;
    const totalCost = litres * price;
    const costPerKm = dist > 0 ? totalCost / dist : price / kml;
    const litresPer100Km = dist > 0 ? (litres / dist) * 100 : (100 / kml);

    return {
      distanceKm: dist,
      kmPerLitre: kml,
      pricePerLitre: price,
      fuelLitres: Number(litres.toFixed(2)),
      fuelCost: Number(totalCost.toFixed(2)),
      costPerKm: Number(costPerKm.toFixed(2)),
      litresPer100Km: Number(litresPer100Km.toFixed(2)),
      formula: `${dist} km ÷ ${kml} km/L × Rs. ${price} = Rs. ${totalCost.toFixed(2)}`
    };
  },

  /**
   * Compare actual vs expected fuel consumption
   */
  calculateFuelEfficiencyVariance(actualKml, expectedKml) {
    const act = Number(actualKml) || 0;
    const exp = Number(expectedKml) || 0;
    if (exp <= 0) return { variancePct: 0, status: 'NORMAL' };

    const variancePct = ((act - exp) / exp) * 100;
    let status = 'NORMAL';
    if (variancePct < -10) status = 'ABNORMAL_HIGH_CONSUMPTION'; // Lower km/L means higher consumption
    else if (variancePct > 10) status = 'EFFICIENT';

    return {
      actualKml: act,
      expectedKml: exp,
      variancePct: Number(variancePct.toFixed(2)),
      status
    };
  },

  /**
   * 3. Driver Cost Allocation
   */
  calculateDriverDailyCost({ monthlySalary = 0, dailyAllowance = 0, workingDaysPerMonth = 26 }) {
    const salary = Number(monthlySalary) || 0;
    const allowance = Number(dailyAllowance) || 0;
    const days = Math.max(Number(workingDaysPerMonth) || 26, 1);

    const baseDaily = salary / days;
    const totalDaily = baseDaily + allowance;

    return {
      monthlySalary: salary,
      dailyAllowance: allowance,
      workingDaysPerMonth: days,
      baseDailyCost: Number(baseDaily.toFixed(2)),
      totalDailyCost: Number(totalDaily.toFixed(2))
    };
  },

  /**
   * 4. Comprehensive Route Cost Calculation
   */
  calculateTotalRouteCost({
    distanceKm = 0,
    kmPerLitre = 18,
    fuelPricePerLitre = 382,
    driverMonthlySalary = 65000,
    driverDailyAllowance = 1500,
    workingDaysPerMonth = 26,
    maintenanceCostPerKm = 8,
    monthlyInsuranceAllocation = 2500,
    monthlyLicenseAllocation = 1000,
    monthlyDistanceEstimate = 2786,
    otherExpenses = 0, // tolls, food, parking
    numberOfShops = 1
  }) {
    // 1. Fuel cost
    const fuel = this.calculateFuel({ distanceKm, kmPerLitre, pricePerLitre: fuelPricePerLitre });

    // 2. Driver cost (1 trip)
    const driver = this.calculateDriverDailyCost({
      monthlySalary: driverMonthlySalary,
      dailyAllowance: driverDailyAllowance,
      workingDaysPerMonth
    });
    const driverCost = driver.totalDailyCost;

    // 3. Maintenance cost
    const maintenanceCost = distanceKm * (Number(maintenanceCostPerKm) || 0);

    // 4. Fixed vehicle allocation per trip (based on ratio of trip distance to estimated monthly distance)
    const monthlyFixed = (Number(monthlyInsuranceAllocation) || 0) + (Number(monthlyLicenseAllocation) || 0);
    const fixedCostPerKm = monthlyDistanceEstimate > 0 ? monthlyFixed / monthlyDistanceEstimate : 0;
    const fixedAllocation = distanceKm * fixedCostPerKm;

    // 5. Total
    const totalRouteCost = fuel.fuelCost + driverCost + maintenanceCost + fixedAllocation + (Number(otherExpenses) || 0);

    // 6. Unit economics
    const costPerKm = distanceKm > 0 ? totalRouteCost / distanceKm : 0;
    const validShops = Math.max(Number(numberOfShops) || 1, 1);
    const costPerShop = totalRouteCost / validShops;

    return {
      distanceKm,
      fuelCost: fuel.fuelCost,
      fuelLitres: fuel.fuelLitres,
      driverCost: Number(driverCost.toFixed(2)),
      maintenanceCost: Number(maintenanceCost.toFixed(2)),
      fixedAllocation: Number(fixedAllocation.toFixed(2)),
      otherExpenses: Number(otherExpenses.toFixed(2)),
      totalRouteCost: Number(totalRouteCost.toFixed(2)),
      costPerKm: Number(costPerKm.toFixed(2)),
      costPerShop: Number(costPerShop.toFixed(2)),
      breakdown: {
        fuelPct: totalRouteCost > 0 ? Number(((fuel.fuelCost / totalRouteCost) * 100).toFixed(1)) : 0,
        driverPct: totalRouteCost > 0 ? Number(((driverCost / totalRouteCost) * 100).toFixed(1)) : 0,
        maintenancePct: totalRouteCost > 0 ? Number(((maintenanceCost / totalRouteCost) * 100).toFixed(1)) : 0,
        otherPct: totalRouteCost > 0 ? Number((((fixedAllocation + otherExpenses) / totalRouteCost) * 100).toFixed(1)) : 0
      }
    };
  },

  /**
   * 5. Profitability & Margins
   */
  calculateProfitability({ salesRevenue = 0, cogs = 0, operatingExpenses = 0 }) {
    const rev = Number(salesRevenue) || 0;
    const costOfGoods = Number(cogs) || 0;
    const opex = Number(operatingExpenses) || 0;

    const grossProfit = rev - costOfGoods;
    const grossMarginPct = rev > 0 ? (grossProfit / rev) * 100 : 0;

    const netProfit = grossProfit - opex;
    const netMarginPct = rev > 0 ? (netProfit / rev) * 100 : 0;

    return {
      salesRevenue: rev,
      cogs: costOfGoods,
      grossProfit: Number(grossProfit.toFixed(2)),
      grossMarginPct: Number(grossMarginPct.toFixed(2)),
      operatingExpenses: opex,
      netProfit: Number(netProfit.toFixed(2)),
      netMarginPct: Number(netMarginPct.toFixed(2)),
      formula: `Net Profit = Gross Profit (Rs. ${grossProfit.toFixed(2)}) - OPEX (Rs. ${opex.toFixed(2)}) = Rs. ${netProfit.toFixed(2)}`
    };
  },

  /**
   * 6. Route Profitability Report Item
   */
  calculateRouteProfitability({
    routeId,
    routeName,
    shopsCount = 0,
    visitsCount = 0,
    distanceKm = 0,
    salesRevenue = 0,
    cogs = 0,
    routeOperatingCost = 0
  }) {
    const margin = this.calculateProfitability({
      salesRevenue,
      cogs,
      operatingExpenses: routeOperatingCost
    });

    const shops = Math.max(Number(shopsCount) || 1, 1);
    const dist = Math.max(Number(distanceKm) || 0, 0);

    const revenuePerKm = dist > 0 ? salesRevenue / dist : 0;
    const costPerKm = dist > 0 ? routeOperatingCost / dist : 0;
    const profitPerKm = dist > 0 ? margin.netProfit / dist : 0;

    const revenuePerShop = salesRevenue / shops;
    const costPerShop = routeOperatingCost / shops;
    const profitPerShop = margin.netProfit / shops;

    return {
      routeId,
      routeName,
      shopsCount: Number(shopsCount),
      visitsCount: Number(visitsCount),
      distanceKm: dist,
      salesRevenue: Number(salesRevenue.toFixed(2)),
      cogs: Number(cogs.toFixed(2)),
      grossProfit: margin.grossProfit,
      grossMarginPct: margin.grossMarginPct,
      routeCost: Number(routeOperatingCost.toFixed(2)),
      netProfit: margin.netProfit,
      netMarginPct: margin.netMarginPct,
      unitEconomics: {
        revenuePerKm: Number(revenuePerKm.toFixed(2)),
        costPerKm: Number(costPerKm.toFixed(2)),
        profitPerKm: Number(profitPerKm.toFixed(2)),
        revenuePerShop: Number(revenuePerShop.toFixed(2)),
        costPerShop: Number(costPerShop.toFixed(2)),
        profitPerShop: Number(profitPerShop.toFixed(2))
      }
    };
  },

  /**
   * 7. Break-Even Analysis Calculator
   */
  calculateBreakEven({
    fixedCosts = 0,
    salesRevenue = 0,
    cogs = 0,
    variableCosts = 0,
    totalShops = 0,
    totalRoutes = 0
  }) {
    const fixed = Number(fixedCosts) || 0;
    const rev = Number(salesRevenue) || 0;
    const costOfGoods = Number(cogs) || 0;
    const variable = Number(variableCosts) || 0;

    // Contribution Margin = Sales - COGS - Variable Operating Costs
    const contributionMargin = rev - costOfGoods - variable;
    const contributionMarginRatio = rev > 0 ? contributionMargin / rev : 0;

    const breakEvenRevenue = contributionMarginRatio > 0 ? fixed / contributionMarginRatio : 0;

    // Unit level break-even
    const shops = Math.max(Number(totalShops) || 1, 1);
    const contributionPerShop = contributionMargin / shops;
    const breakEvenShops = contributionPerShop > 0 ? Math.ceil(fixed / contributionPerShop) : 0;

    const routes = Math.max(Number(totalRoutes) || 1, 1);
    const breakEvenRevenuePerRoute = breakEvenRevenue / routes;

    return {
      fixedCosts: fixed,
      variableCosts: variable,
      contributionMargin: Number(contributionMargin.toFixed(2)),
      contributionMarginRatio: Number(contributionMarginRatio.toFixed(4)),
      breakEvenRevenue: Number(breakEvenRevenue.toFixed(2)),
      breakEvenShops,
      breakEvenRevenuePerRoute: Number(breakEvenRevenuePerRoute.toFixed(2)),
      safetyMarginRevenue: Number(Math.max(rev - breakEvenRevenue, 0).toFixed(2)),
      safetyMarginPct: rev > 0 ? Number((((rev - breakEvenRevenue) / rev) * 100).toFixed(2)) : 0
    };
  },

  /**
   * 8. "What If?" Scenario Simulator
   */
  simulateScenario({
    numRoutes = 15,
    avgRouteDistanceKm = 130,
    visitFrequencyDays = 21,
    vehicleEfficiencyKml = 18,
    fuelPricePerLitre = 382,
    driverMonthlyCost = 75000,
    maintenancePerKm = 8,
    fixedOverheadsMonthly = 150000,
    avgShopsPerRoute = 12,
    avgSalesPerShop = 25000,
    cogsRatio = 0.70 // 70% COGS -> 30% Gross margin
  }) {
    const daysInMonth = 30;
    const totalCycleDistance = numRoutes * avgRouteDistanceKm;
    const monthlyCycles = daysInMonth / visitFrequencyDays;
    const monthlyDistanceKm = totalCycleDistance * monthlyCycles;

    // Fuel
    const monthlyFuelLitres = monthlyDistanceKm / vehicleEfficiencyKml;
    const monthlyFuelCost = monthlyFuelLitres * fuelPricePerLitre;

    // Drivers & Maintenance
    const totalVehicles = Math.min(numRoutes, Math.ceil(numRoutes / 2)); // assume fleet size
    const monthlyDriverCost = totalVehicles * driverMonthlyCost;
    const monthlyMaintenanceCost = monthlyDistanceKm * maintenancePerKm;

    // Total monthly route operating cost
    const monthlyRouteOperatingCost = monthlyFuelCost + monthlyDriverCost + monthlyMaintenanceCost;
    const totalMonthlyCost = monthlyRouteOperatingCost + fixedOverheadsMonthly;

    // Sales & Gross Profit
    const totalShops = numRoutes * avgShopsPerRoute;
    const totalShopVisitsMonthly = totalShops * monthlyCycles;
    const monthlySales = totalShopVisitsMonthly * avgSalesPerShop;
    const monthlyCogs = monthlySales * cogsRatio;
    const monthlyGrossProfit = monthlySales - monthlyCogs;
    const monthlyNetProfit = monthlyGrossProfit - totalMonthlyCost;
    const netProfitMarginPct = monthlySales > 0 ? (monthlyNetProfit / monthlySales) * 100 : 0;

    // Unit economics
    const costPerKm = monthlyDistanceKm > 0 ? totalMonthlyCost / monthlyDistanceKm : 0;
    const costPerShopVisit = totalShopVisitsMonthly > 0 ? totalMonthlyCost / totalShopVisitsMonthly : 0;

    // Break-even
    const grossMarginPct = 1 - cogsRatio;
    const variableCostPerVisit = (monthlyFuelCost + monthlyMaintenanceCost) / (totalShopVisitsMonthly || 1);
    const contributionPerVisit = (avgSalesPerShop * grossMarginPct) - variableCostPerVisit;
    const totalFixedCosts = fixedOverheadsMonthly + monthlyDriverCost;
    const breakEvenVisits = contributionPerVisit > 0 ? Math.ceil(totalFixedCosts / contributionPerVisit) : 0;
    const breakEvenSales = breakEvenVisits * avgSalesPerShop;

    return {
      inputs: {
        numRoutes,
        avgRouteDistanceKm,
        visitFrequencyDays,
        vehicleEfficiencyKml,
        fuelPricePerLitre,
        driverMonthlyCost,
        maintenancePerKm,
        fixedOverheadsMonthly,
        avgShopsPerRoute,
        avgSalesPerShop,
        cogsRatio
      },
      operational: {
        totalCycleDistance: Number(totalCycleDistance.toFixed(2)),
        monthlyCycles: Number(monthlyCycles.toFixed(2)),
        monthlyDistanceKm: Number(monthlyDistanceKm.toFixed(2)),
        monthlyFuelLitres: Number(monthlyFuelLitres.toFixed(2)),
        totalShopVisitsMonthly: Math.round(totalShopVisitsMonthly)
      },
      financial: {
        monthlyFuelCost: Number(monthlyFuelCost.toFixed(2)),
        monthlyDriverCost: Number(monthlyDriverCost.toFixed(2)),
        monthlyMaintenanceCost: Number(monthlyMaintenanceCost.toFixed(2)),
        monthlyRouteOperatingCost: Number(monthlyRouteOperatingCost.toFixed(2)),
        totalMonthlyCost: Number(totalMonthlyCost.toFixed(2)),
        monthlySales: Number(monthlySales.toFixed(2)),
        monthlyCogs: Number(monthlyCogs.toFixed(2)),
        monthlyGrossProfit: Number(monthlyGrossProfit.toFixed(2)),
        monthlyNetProfit: Number(monthlyNetProfit.toFixed(2)),
        netProfitMarginPct: Number(netProfitMarginPct.toFixed(2))
      },
      unitEconomics: {
        costPerKm: Number(costPerKm.toFixed(2)),
        costPerShopVisit: Number(costPerShopVisit.toFixed(2)),
        revenuePerKm: Number((monthlySales / (monthlyDistanceKm || 1)).toFixed(2)),
        profitPerKm: Number((monthlyNetProfit / (monthlyDistanceKm || 1)).toFixed(2))
      },
      breakEven: {
        breakEvenSales: Number(breakEvenSales.toFixed(2)),
        breakEvenVisits,
        breakEvenShops: Math.ceil(breakEvenVisits / monthlyCycles)
      }
    };
  }
};

export default CalculationEngine;

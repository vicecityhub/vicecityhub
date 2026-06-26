import React, { useState } from 'react';
import { Home, Percent, ShieldCheck, Flame, Compass, Calculator, Landmark, Info } from 'lucide-react';

interface Neighborhood {
  name: string;
  tier: 'S' | 'A' | 'B' | 'C';
  desc: string;
  annualYield: number; // percentage e.g. 12 = 12%
  risk: 'Low' | 'Medium' | 'High';
  avgPrice: string;
  icon: string;
}

const NEIGHBORHOODS: Neighborhood[] = [
  {
    name: 'Ocean Beach Marina & Penthouses',
    tier: 'S',
    desc: 'The playground of billionaires. Ultra-luxury high-rise beachfront penthouses overlooking pristine sands. Demands highest rents with low vacancy rates, perfect for blue-chip portfolios.',
    annualYield: 12.5,
    risk: 'Low',
    avgPrice: '$6,500,000',
    icon: '🏝️'
  },
  {
    name: 'Downtown Vice Financial District',
    tier: 'A',
    desc: 'Metropolitan corporate skyscrapers and premium lofts. High demand from white-collar executives and institutional holdings. Steady long-term capital appreciation with stable returns.',
    annualYield: 9.8,
    risk: 'Low',
    avgPrice: '$4,200,000',
    icon: '🏙️'
  },
  {
    name: 'Vice Keys Coastal Cottages & Estates',
    tier: 'A',
    desc: 'Secluded luxury estates spread across interconnected islands. High tourism yields via short-term rental portals. Susceptible to seasonal storm volatility but extremely premium pricing.',
    annualYield: 11.2,
    risk: 'Medium',
    avgPrice: '$5,800,000',
    icon: '⛵'
  },
  {
    name: 'Homestead Suburban Houses',
    tier: 'B',
    desc: 'Suburban residential expansion sector. Growing middle-class families populate this area. Stable long-term rental market with affordable acquisition pricing and high volume.',
    annualYield: 7.5,
    risk: 'Low',
    avgPrice: '$850,000',
    icon: '🏡'
  },
  {
    name: 'Port Gellhorn Industrial Sector',
    tier: 'B',
    desc: 'Western industrial hub. Cargo warehouses, oil drilling operations, and refinery worker compounds. High cash-flow yields with low speculative growth. Excellent for pure cash generation.',
    annualYield: 8.4,
    risk: 'Medium',
    avgPrice: '$1,900,000',
    icon: '🏭'
  },
  {
    name: 'Grasslands & Everglades Outposts',
    tier: 'C',
    desc: 'Smuggling hangars, rural trailer parks, and swamp tours. Extremely high risk due to contraband operations and police raids. Low acquisition costs with high potential short-term windfalls.',
    annualYield: 14.0,
    risk: 'High',
    avgPrice: '$350,000',
    icon: '🐊'
  }
];

export default function RealEstate() {
  // Calculator state
  const [propertyPrice, setPropertyPrice] = useState<number>(1500000);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>(NEIGHBORHOODS[0].name);
  const [mortgageRate, setMortgageRate] = useState<number>(4.5);
  const [mortgageTerm, setMortgageTerm] = useState<number>(30);
  const [useMortgage, setUseMortgage] = useState<boolean>(false);

  const activeNeighborhood = NEIGHBORHOODS.find(n => n.name === selectedNeighborhood) || NEIGHBORHOODS[0];

  // Mathematical Yield Calculations
  const calcYields = () => {
    const annualRentalGross = propertyPrice * (activeNeighborhood.annualYield / 100);
    const monthlyRentalGross = annualRentalGross / 12;

    // Maintenance & property tax (estimate 1.5% annually)
    const annualExpenses = propertyPrice * 0.015;
    const monthlyExpenses = annualExpenses / 12;

    let monthlyMortgage = 0;
    if (useMortgage) {
      // Simple Mortgage formula (70% LTV)
      const loanAmount = propertyPrice * 0.7;
      const monthlyRate = (mortgageRate / 100) / 12;
      const numberOfPayments = mortgageTerm * 12;
      if (monthlyRate > 0) {
        monthlyMortgage = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
      } else {
        monthlyMortgage = loanAmount / numberOfPayments;
      }
    }

    const netMonthlyYield = monthlyRentalGross - monthlyExpenses - monthlyMortgage;
    const netAnnualYield = netMonthlyYield * 12;
    const netYieldPercent = (netAnnualYield / propertyPrice) * 100;

    // Break even analysis in months
    const initialCashOutlay = useMortgage ? propertyPrice * 0.3 : propertyPrice;
    const breakEvenMonths = netMonthlyYield > 0 ? Math.ceil(initialCashOutlay / netMonthlyYield) : 0;
    const breakEvenYears = (breakEvenMonths / 12).toFixed(1);

    return {
      grossMonthly: monthlyRentalGross.toFixed(0),
      netMonthly: netMonthlyYield.toFixed(0),
      netPercent: netYieldPercent.toFixed(2),
      breakEvenMonths,
      breakEvenYears,
      initialOutlay: initialCashOutlay.toFixed(0),
      mortgagePay: monthlyMortgage.toFixed(0)
    };
  };

  const yields = calcYields();

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'S': return 'text-neonPink border-neonPink/30 bg-neonPink/5 neon-text-pink';
      case 'A': return 'text-neonCyan border-neonCyan/30 bg-neonCyan/5 neon-text-cyan';
      case 'B': return 'text-neonOrange border-neonOrange/30 bg-neonOrange/5';
      default: return 'text-gray-400 border-white/10 bg-white/5';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return 'text-green-400';
      case 'Medium': return 'text-neonOrange';
      default: return 'text-neonPink animate-pulse';
    }
  };

  return (
    <div className="w-full">
      {/* HEADER BANNER */}
      <header className="min-h-[40vh] flex flex-col items-center justify-center text-center px-6 relative overflow-hidden bg-radial-hero py-16">
        <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_80%_50%_at_50%_85%,rgba(0,255,255,0.07)_0%,transparent_60%)]" />
        
        <div className="relative z-10 flex flex-col items-center max-w-4xl">
          <div className="font-orbitron text-[10px] sm:text-xs font-bold tracking-[0.3em] text-neonCyan uppercase border border-neonCyan/40 px-6 py-2.5 rounded-full bg-neonCyan/5 shadow-[0_0_15px_rgba(0,255,255,0.15)] mb-6 animate-pulse">
            DYNASTY 8 EXECUTIVE &mdash; METAVERSE INVESTMENTS
          </div>

          <h1 className="font-orbitron font-black text-5xl sm:text-7xl uppercase tracking-tighter bg-gradient-to-br from-white via-neonCyan to-neonPink bg-clip-text text-transparent filter drop-shadow-2xl">
            DYNASTY 8
          </h1>

          <p className="text-xs sm:text-sm text-gray-400 font-bold max-w-lg mx-auto mt-4 leading-relaxed font-rajdhani uppercase tracking-widest">
            Evaluate neighborhood yields, run investment projections, and calculate break-even timelines across the State of Leonida.
          </p>
        </div>
      </header>

      <div className="gradient-line" />

      {/* CALCULATOR & PROJECTIONS */}
      <section className="py-20 px-6 max-w-[1280px] mx-auto z-10 relative">
        <div className="flex items-baseline gap-3 border-b border-white/5 pb-5 mb-12">
          <span className="font-orbitron text-xs text-neonCyan font-extrabold tracking-widest">01</span>
          <h2 className="font-orbitron font-extrabold text-3xl tracking-widest uppercase">
            ROI <span className="text-neonCyan">Calculator</span>
          </h2>
          <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase ml-auto">
            Projections &amp; Yield Engine
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {/* Inputs Column */}
          <div className="lg:col-span-1 glass-card p-8 border-white/5 flex flex-col gap-6 shadow-2xl">
            <h3 className="font-orbitron font-bold text-lg text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-3">
              <Calculator size={18} className="text-neonCyan" /> Asset Parameters
            </h3>

            {/* Input 1: Property Price */}
            <div className="flex flex-col gap-2.5">
              <div className="flex justify-between items-baseline font-orbitron text-xs uppercase font-bold tracking-wider">
                <label className="text-gray-400">Acquisition Price</label>
                <span className="text-neonCyan">${propertyPrice.toLocaleString()} USD</span>
              </div>
              <input
                type="range"
                min={200000}
                max={15000000}
                step={50000}
                value={propertyPrice}
                onChange={e => setPropertyPrice(Number(e.target.value))}
                className="w-full h-1 bg-[#050508] border border-white/10 outline-none rounded appearance-none cursor-pointer accent-neonCyan"
              />
            </div>

            {/* Input 2: Neighborhood Selector */}
            <div className="flex flex-col gap-2.5">
              <label className="text-xs text-gray-400 font-bold uppercase tracking-wider font-orbitron">Neighborhood Sector</label>
              <select
                value={selectedNeighborhood}
                onChange={e => setSelectedNeighborhood(e.target.value)}
                className="w-full bg-[#050508] border border-white/10 outline-none rounded-lg p-3 text-sm text-white font-rajdhani font-bold focus:border-neonCyan transition-all"
              >
                {NEIGHBORHOODS.map(n => (
                  <option key={n.name} value={n.name}>
                    {n.icon} {n.name} ({n.annualYield}% gross yield)
                  </option>
                ))}
              </select>
            </div>

            {/* Input 3: Leverage checkbox */}
            <div className="flex items-center gap-3 border-t border-white/5 pt-4">
              <input
                type="checkbox"
                id="mortgage-toggle"
                checked={useMortgage}
                onChange={e => setUseMortgage(e.target.checked)}
                className="w-4 h-4 rounded border-white/10 bg-[#050508] checked:bg-neonCyan accent-neonCyan"
              />
              <label htmlFor="mortgage-toggle" className="text-xs text-white font-bold uppercase tracking-wider font-orbitron cursor-pointer">
                Employ Financing (70% LTV)
              </label>
            </div>

            {/* Mortgage Details */}
            {useMortgage && (
              <div className="flex flex-col gap-4 pl-4 border-l border-neonCyan/20 animate-fade-in">
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-baseline font-orbitron text-xs font-bold uppercase tracking-wider">
                    <span className="text-gray-400">Financing Interest Rate</span>
                    <span className="text-neonCyan">{mortgageRate}%</span>
                  </div>
                  <input
                    type="range"
                    min={2.0}
                    max={12.0}
                    step={0.1}
                    value={mortgageRate}
                    onChange={e => setMortgageRate(Number(e.target.value))}
                    className="w-full h-1 bg-[#050508] outline-none rounded appearance-none cursor-pointer accent-neonCyan"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-baseline font-orbitron text-xs font-bold uppercase tracking-wider">
                    <span className="text-gray-400">Loan Term</span>
                    <span className="text-neonCyan">{mortgageTerm} Years</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={40}
                    step={5}
                    value={mortgageTerm}
                    onChange={e => setMortgageTerm(Number(e.target.value))}
                    className="w-full h-1 bg-[#050508] outline-none rounded appearance-none cursor-pointer accent-neonCyan"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Results Column */}
          <div className="lg:col-span-2 glass-card p-8 border-neonCyan/30 flex flex-col justify-between shadow-[0_0_25px_rgba(0,255,255,0.05)] h-full">
            <div>
              <h3 className="font-orbitron font-bold text-lg text-neonCyan uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-3">
                <Compass size={18} className="text-neonCyan" /> Yield Analysis Report
              </h3>

              {/* Stat grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mt-6">
                <div className="glass-card p-5 border-white/5 flex flex-col">
                  <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-widest font-orbitron">Initial Cash Outlay</span>
                  <span className="text-xl font-orbitron font-extrabold text-white mt-1">
                    ${Number(yields.initialOutlay).toLocaleString()}
                  </span>
                  <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-1">
                    {useMortgage ? '30% Down payment' : '100% Cash payment'}
                  </span>
                </div>
                <div className="glass-card p-5 border-white/5 flex flex-col">
                  <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-widest font-orbitron">Est. Monthly Gross Rent</span>
                  <span className="text-xl font-orbitron font-extrabold text-neonCyan neon-text-cyan mt-1">
                    ${Number(yields.grossMonthly).toLocaleString()}
                  </span>
                  <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-1">
                    Based on {activeNeighborhood.annualYield}% gross yield
                  </span>
                </div>
                <div className="glass-card p-5 border-white/5 flex flex-col">
                  <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-widest font-orbitron">Net Monthly Profit</span>
                  <span className={`text-xl font-orbitron font-extrabold mt-1 ${Number(yields.netMonthly) >= 0 ? 'text-green-400' : 'text-neonPink'}`}>
                    ${Number(yields.netMonthly).toLocaleString()}
                  </span>
                  <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-1">
                    After expenses &amp; debts
                  </span>
                </div>
              </div>

              {/* Net Yield Percent and Break even box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div className="border border-white/5 p-6 rounded bg-[#050508]/60 flex flex-col items-center justify-center text-center">
                  <span className="text-xs text-gray-500 uppercase tracking-widest font-bold font-orbitron">Net Annual Return</span>
                  <span className="text-3xl font-orbitron font-black text-neonCyan neon-text-cyan mt-2">
                    {yields.netPercent}%
                  </span>
                  <span className="text-[10px] text-gray-500 mt-1 uppercase font-bold tracking-widest">Calculated net ROI</span>
                </div>
                <div className="border border-white/5 p-6 rounded bg-[#050508]/60 flex flex-col items-center justify-center text-center">
                  <span className="text-xs text-gray-500 uppercase tracking-widest font-bold font-orbitron">Break-Even Timeline</span>
                  <span className="text-3xl font-orbitron font-black text-neonOrange mt-2">
                    {Number(yields.netMonthly) > 0 ? `${yields.breakEvenMonths} Months` : 'Infinite'}
                  </span>
                  <span className="text-[10px] text-gray-500 mt-1 uppercase font-bold tracking-widest">
                    {Number(yields.netMonthly) > 0 ? `(~${yields.breakEvenYears} Years to recoup outlay)` : 'Expenses exceed revenues'}
                  </span>
                </div>
              </div>
            </div>

            {useMortgage && Number(yields.mortgagePay) > 0 && (
              <div className="mt-6 flex items-center gap-3 text-xs text-neonOrange border border-neonOrange/20 bg-neonOrange/5 p-3 rounded font-rajdhani font-bold uppercase tracking-wider">
                <Landmark size={18} className="shrink-0" /> Note: Estimated Monthly Debt Service Payments: ${Number(yields.mortgagePay).toLocaleString()} USD
              </div>
            )}
            
            <div className="mt-8 border-t border-white/5 pt-4 text-[10px] text-gray-500 font-bold uppercase tracking-widest font-orbitron leading-relaxed">
              Calculations account for standard 1.5% annual upkeep &amp; insurance costs in Leonida. Projections will vary depending on city tax code fluctuations.
            </div>
          </div>
        </div>
      </section>

      <div className="gradient-line" />

      {/* NEIGHBORHOOD TIERS */}
      <section className="py-20 px-6 max-w-[1280px] mx-auto z-10 relative">
        <div className="flex items-baseline gap-3 border-b border-white/5 pb-5 mb-10">
          <span className="font-orbitron text-xs text-neonPink font-extrabold tracking-widest">02</span>
          <h2 className="font-orbitron font-extrabold text-3xl tracking-widest uppercase">
            Neighborhood <span className="text-neonPink">Tiers</span>
          </h2>
          <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase ml-auto">
            Leonida Property Index
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {NEIGHBORHOODS.map(n => (
            <div
              key={n.name}
              className="glass-card border border-white/5 hover:border-neonPink transition-all duration-300 flex flex-col justify-between shadow-2xl p-6 group min-h-[340px]"
            >
              <div>
                <div className="flex justify-between items-center mb-5 font-orbitron font-extrabold uppercase">
                  <span className="text-2xl">{n.icon}</span>
                  <span className={`border text-xs font-black tracking-widest px-3 py-1 uppercase rounded ${getTierColor(n.tier)}`}>
                    Tier {n.tier}
                  </span>
                </div>

                <h3 className="font-orbitron font-bold text-lg text-white group-hover:text-neonPink transition-colors mb-3">
                  {n.name}
                </h3>

                <p className="text-xs text-gray-400 leading-relaxed font-bold font-rajdhani line-clamp-4 mb-6">
                  {n.desc}
                </p>
              </div>

              <div className="border-t border-white/5 pt-4 mt-auto">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest font-orbitron mb-3">
                  <span className="text-gray-500">Average Valuation</span>
                  <span className="text-white">{n.avgPrice}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest font-orbitron mb-3">
                  <span className="text-gray-500">Annual Return (ROI)</span>
                  <span className="text-neonCyan">{n.annualYield}% Gross</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest font-orbitron">
                  <span className="text-gray-500">Speculative Risk Factor</span>
                  <span className={getRiskColor(n.risk)}>{n.risk}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Informative notice at bottom */}
        <div className="mt-16 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-start gap-3 border border-white/5 p-6 rounded-lg bg-[#050508]/60 text-left font-rajdhani font-semibold text-xs leading-relaxed text-gray-400">
            <Info size={24} className="text-neonCyan shrink-0 mt-0.5" />
            <div>
              <span className="text-white uppercase font-bold font-orbitron tracking-wider block mb-1">Dynasty 8 Brokerage Operations</span>
              Properties purchased inside the upcoming State of Leonida requires alignment with local street gangs and corporate syndicates. Be sure to budget enough capital for backup weapon armor and vehicle modifications to secure your holdings!
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

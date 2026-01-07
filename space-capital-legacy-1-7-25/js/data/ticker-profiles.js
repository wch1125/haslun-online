// =========================================================================
// TICKER PROFILES — Pip-Boy style dossiers for each position
// Extracted from app.js for modularity
// =========================================================================

(function() {
  const TICKER_PROFILES = {
  RKLB: {
    name: "Rocket Lab USA",
    codename: "ELECTRON",
    sector: "Space Launch & Satellites",
    threat_level: "MODERATE",
    summary: "Small-launch pioneer now building medium-lift Neutron rocket. Vertically integrated: they make the rocket, the satellite bus, and increasingly the payload itself.",
    thesis: "Rocket Lab is betting that owning the entire stack — from launch to spacecraft to ground systems — creates compounding margin advantages as the space economy scales.",
    catalysts: [
      { date: "Q1 2026", event: "Neutron First Flight", impact: "HIGH" },
      { date: "Ongoing", event: "Electron Launch Cadence", impact: "MEDIUM" },
      { date: "2026", event: "Space Systems Revenue Growth", impact: "HIGH" }
    ],
    risks: [
      "Neutron development delays or cost overruns",
      "SpaceX pricing pressure on rideshare market",
      "Customer concentration in government contracts"
    ],
    vitals: {
      founded: 2006,
      hq: "Long Beach, CA",
      employees: "~1,800",
      launches: "50+"
    },
    lore: "In the orbital logistics game, Electron is the reliable shuttle bus — small, frequent, precise. Neutron is the freight train they're building next. If it works, they'll own both lanes of the highway to space."
  },
  LUNR: {
    name: "Intuitive Machines",
    codename: "MOONSHOT",
    sector: "Lunar Services",
    threat_level: "HIGH",
    summary: "Commercial lunar lander company. First private US company to soft-land on the Moon (IM-1, Feb 2024). NASA CLPS contractor building recurring lunar delivery business.",
    thesis: "The Moon is becoming infrastructure. Intuitive Machines is positioning as the FedEx of cislunar space — delivering payloads, building navigation networks, and eventually operating surface systems.",
    catalysts: [
      { date: "Feb 2026", event: "IM-2 Lunar Landing", impact: "HIGH" },
      { date: "2026", event: "Lunar Data Network Contracts", impact: "MEDIUM" },
      { date: "2027", event: "IM-3 Mission", impact: "HIGH" }
    ],
    risks: [
      "Mission failure risk (space is hard)",
      "NASA budget dependency",
      "Long timeline to profitability"
    ],
    vitals: {
      founded: 2013,
      hq: "Houston, TX",
      employees: "~500",
      landings: "1 (IM-1)"
    },
    lore: "They tipped over on landing and still counted it as a win. That's not copium — that's the reality of lunar exploration. Every data point is gold. They're learning faster than anyone else in the West."
  },
  ASTS: {
    name: "AST SpaceMobile",
    codename: "BLUEBIRD",
    sector: "Space-Based Cellular",
    threat_level: "EXTREME",
    summary: "Building the first space-based cellular broadband network. Giant satellites (64m² arrays) connect directly to unmodified smartphones. If it works, it's the biggest addressable market in telecom history.",
    thesis: "5 billion people have phones. 90% of Earth has no cellular coverage. AST is building orbital cell towers to close that gap — no new hardware required on the ground.",
    catalysts: [
      { date: "Q1 2026", event: "Commercial Service Launch", impact: "HIGH" },
      { date: "2026", event: "Block 2 Satellite Deployment", impact: "HIGH" },
      { date: "Ongoing", event: "MNO Partnership Expansion", impact: "MEDIUM" }
    ],
    risks: [
      "Unproven technology at scale",
      "Regulatory complexity across jurisdictions",
      "Capital-intensive deployment phase",
      "Competition from Starlink Direct-to-Cell"
    ],
    vitals: {
      founded: 2017,
      hq: "Midland, TX",
      employees: "~500",
      satellites: "5 (BlueBird test constellation)"
    },
    lore: "The satellites are the size of basketball courts. The engineering is borderline absurd. But if they pull it off, every phone on Earth becomes a satellite phone. That's not a product — that's a paradigm shift."
  },
  ACHR: {
    name: "Archer Aviation",
    codename: "MIDNIGHT",
    sector: "eVTOL / Urban Air Mobility",
    threat_level: "MODERATE",
    summary: "Electric vertical takeoff and landing aircraft for urban air taxi service. Partnership with United Airlines. Manufacturing facility in Georgia.",
    thesis: "Traffic is broken. Archer is betting that electric flight becomes cheap and quiet enough to create a new transportation layer above cities.",
    catalysts: [
      { date: "Q1 2026", event: "FAA Type Certification", impact: "HIGH" },
      { date: "2026", event: "Commercial Launch (UAE)", impact: "HIGH" },
      { date: "2027", event: "US Commercial Operations", impact: "HIGH" }
    ],
    risks: [
      "FAA certification timeline uncertainty",
      "Battery energy density limitations",
      "Infrastructure buildout costs",
      "Public acceptance of urban air traffic"
    ],
    vitals: {
      founded: 2018,
      hq: "San Jose, CA",
      employees: "~900",
      aircraft: "Midnight (4+1 passenger)"
    },
    lore: "The Jetsons promised us flying cars. Archer is delivering electric helicopters that don't sound like helicopters. Close enough."
  },
  JOBY: {
    name: "Joby Aviation",
    codename: "S4",
    sector: "eVTOL / Urban Air Mobility",
    threat_level: "MODERATE",
    summary: "Furthest along in eVTOL certification. Toyota-backed. Building manufacturing at scale. Air taxi service planned for 2025.",
    thesis: "First mover advantage in a winner-take-most market. Joby has more flight hours, more capital, and more regulatory progress than any competitor.",
    catalysts: [
      { date: "2025-2026", event: "FAA Type Certification", impact: "HIGH" },
      { date: "2025", event: "Initial Commercial Ops (Dubai)", impact: "HIGH" },
      { date: "2026", event: "US Market Launch", impact: "HIGH" }
    ],
    risks: [
      "Certification delays",
      "High cash burn pre-revenue",
      "Competitive pressure from Archer, Lilium",
      "Noise and safety perception issues"
    ],
    vitals: {
      founded: 2009,
      hq: "Santa Cruz, CA",
      employees: "~1,500",
      aircraft: "S4 (4+1 passenger)"
    },
    lore: "They've been at this longer than anyone. The Toyota money helps. But the real moat is the million+ miles of flight test data. That's not something you can buy."
  },
  GME: {
    name: "GameStop Corp",
    codename: "DIAMOND HANDS",
    sector: "Retail / Meme",
    threat_level: "CHAOTIC",
    summary: "Video game retailer turned meme stock phenomenon. Now pivoting toward... something. Cash-rich balance sheet. Ryan Cohen steering the ship into uncharted waters.",
    thesis: "This isn't a thesis. This is volatility exposure with a side of cultural commentary. The balance sheet is real; the business model is TBD.",
    catalysts: [
      { date: "Ongoing", event: "Social Media Sentiment Spikes", impact: "HIGH" },
      { date: "Unknown", event: "Strategic Pivot Announcements", impact: "MEDIUM" },
      { date: "Quarterly", event: "Earnings Surprises", impact: "MEDIUM" }
    ],
    risks: [
      "Fundamental business decline in physical games",
      "Meme momentum can reverse violently",
      "No clear path to sustainable growth",
      "Regulatory scrutiny on retail trading"
    ],
    vitals: {
      founded: 1984,
      hq: "Grapevine, TX",
      employees: "~8,000",
      stores: "~4,000"
    },
    lore: "The stock that broke the internet in 2021. Whether it's a movement, a trade, or a cautionary tale depends on your entry price and your exit strategy. We hold it because the volatility is useful. Not financial advice."
  },
  BKSY: {
    name: "BlackSky Technology",
    codename: "SPECTRA",
    sector: "Geospatial Intelligence",
    threat_level: "LOW",
    summary: "Real-time Earth observation satellite constellation. AI-powered analytics platform. Defense and intelligence community customers.",
    thesis: "Imagery is becoming a utility. BlackSky is building the always-on, AI-analyzed feed of what's happening on Earth — updated hourly, not daily.",
    catalysts: [
      { date: "Ongoing", event: "Constellation Expansion", impact: "MEDIUM" },
      { date: "2026", event: "Gen-3 Satellite Deployment", impact: "MEDIUM" },
      { date: "Ongoing", event: "Government Contract Wins", impact: "MEDIUM" }
    ],
    risks: [
      "Competition from Planet, Maxar",
      "Government budget cycles",
      "Small constellation limits revisit rates"
    ],
    vitals: {
      founded: 2014,
      hq: "Herndon, VA",
      employees: "~350",
      satellites: "18"
    },
    lore: "They photograph the same spot on Earth multiple times per day. The value isn't in any single image — it's in the delta. What changed? When? That's intelligence."
  },
  RDW: {
    name: "Redwire Corporation",
    codename: "FORGE",
    sector: "Space Infrastructure",
    threat_level: "LOW",
    summary: "Space infrastructure company. On-orbit manufacturing, solar arrays, sensors. Rolls up smaller space tech companies. Supplies components across the industry.",
    thesis: "Every satellite needs stuff — solar panels, antennas, sensors, structures. Redwire is the Home Depot of space hardware.",
    catalysts: [
      { date: "Ongoing", event: "M&A Integration", impact: "MEDIUM" },
      { date: "2026", event: "In-Space Manufacturing Demos", impact: "MEDIUM" },
      { date: "Ongoing", event: "NASA/DoD Contracts", impact: "MEDIUM" }
    ],
    risks: [
      "Integration risk from acquisitions",
      "Customer concentration",
      "Supply chain dependencies"
    ],
    vitals: {
      founded: 2020,
      hq: "Jacksonville, FL",
      employees: "~700",
      facilities: "20+"
    },
    lore: "While everyone argues about who gets to launch the rockets, Redwire quietly sells picks and shovels to all of them. Boring but effective."
  },
  PL: {
    name: "Planet Labs",
    codename: "DOVE",
    sector: "Earth Observation",
    threat_level: "LOW",
    summary: "Largest Earth observation satellite constellation. Daily imaging of the entire planet. Commercial, government, and NGO customers.",
    thesis: "A daily photo of every spot on Earth creates unprecedented visibility into human activity. Agriculture, supply chains, climate — it's all visible from orbit.",
    catalysts: [
      { date: "Ongoing", event: "Data Services Revenue Growth", impact: "MEDIUM" },
      { date: "2026", event: "Pelican Constellation Launch", impact: "MEDIUM" },
      { date: "Ongoing", event: "Government Contract Expansion", impact: "MEDIUM" }
    ],
    risks: [
      "Path to profitability unclear",
      "Competition from free/low-cost imagery",
      "Data commoditization pressure"
    ],
    vitals: {
      founded: 2010,
      hq: "San Francisco, CA",
      employees: "~800",
      satellites: "200+"
    },
    lore: "They image the entire Earth every single day. Every field, every port, every construction site. The value is in what you can see changing over time."
  },
  EVEX: {
    name: "Eve Holding",
    codename: "VECTOR",
    sector: "eVTOL / Urban Air Mobility",
    threat_level: "MODERATE",
    summary: "Embraer-backed eVTOL company. Leveraging decades of aerospace manufacturing experience. Urban air mobility focus with global ambitions.",
    thesis: "Embraer knows how to build and certify aircraft at scale. Eve inherits that DNA for the electric age.",
    catalysts: [
      { date: "2026", event: "Prototype Flight Testing", impact: "MEDIUM" },
      { date: "2027", event: "Certification Progress", impact: "HIGH" },
      { date: "Ongoing", event: "Pre-order Conversions", impact: "MEDIUM" }
    ],
    risks: [
      "Later to market than Joby/Archer",
      "Brazil HQ complicates US certification",
      "Competitive pressure in crowded market"
    ],
    vitals: {
      founded: 2020,
      hq: "Melbourne, FL / São Paulo",
      employees: "~600",
      aircraft: "eVTOL (4+1 passenger)"
    },
    lore: "The Embraer connection is the whole story. These are the people who built the E-Jets. They know certification, they know manufacturing, they know airlines."
  },
  KTOS: {
    name: "Kratos Defense",
    codename: "VALKYRIE",
    sector: "Defense Technology",
    threat_level: "LOW",
    summary: "Unmanned systems and hypersonic tech. Affordable attritable drones for the DoD. Satellite ground systems. The affordable end of the defense contractor spectrum.",
    thesis: "Future warfare is drone warfare. Kratos builds the cheap, expendable, AI-piloted aircraft that will fly alongside manned fighters.",
    catalysts: [
      { date: "Ongoing", event: "CCA Program Contracts", impact: "HIGH" },
      { date: "2026", event: "Hypersonic Testing", impact: "MEDIUM" },
      { date: "Ongoing", event: "DoD Budget Allocations", impact: "MEDIUM" }
    ],
    risks: [
      "Defense budget politics",
      "Program cancellation risk",
      "Competition from larger primes"
    ],
    vitals: {
      founded: 1994,
      hq: "Colorado Springs, CO",
      employees: "~3,500",
      focus: "Drones, Missiles, Space"
    },
    lore: "While Lockheed builds the $100M jets, Kratos builds the $2M wingmen. In an era of attrition warfare, cheap and many beats expensive and few."
  },
  IRDM: {
    name: "Iridium Communications",
    codename: "CONSTELLATION",
    sector: "Satellite Communications",
    threat_level: "LOW",
    summary: "Global satellite phone and IoT network. 66-satellite constellation provides pole-to-pole coverage. Government, maritime, aviation customers.",
    thesis: "The original satellite phone network, now focused on IoT and specialty markets where Starlink can't compete on coverage or reliability.",
    catalysts: [
      { date: "Ongoing", event: "IoT Revenue Growth", impact: "MEDIUM" },
      { date: "Ongoing", event: "Government Contract Renewals", impact: "MEDIUM" },
      { date: "Long-term", event: "Next-Gen Constellation Planning", impact: "LOW" }
    ],
    risks: [
      "Technology disruption from LEO constellations",
      "Limited growth runway",
      "Commodity pricing pressure"
    ],
    vitals: {
      founded: 2000,
      hq: "McLean, VA",
      employees: "~600",
      satellites: "66 active"
    },
    lore: "They went bankrupt once and came back. The constellation is paid for. The cash flows. It's not sexy, but it's the only network that works everywhere on Earth."
  },
  MP: {
    name: "MP Materials",
    codename: "RARE EARTH",
    sector: "Critical Minerals",
    threat_level: "LOW",
    summary: "Largest rare earth mining and processing company in the Western Hemisphere. Mountain Pass mine in California. Essential materials for EVs, wind turbines, defense systems.",
    thesis: "China controls 60%+ of rare earth processing. MP is the US answer to that dependency. National security meets clean energy transition.",
    catalysts: [
      { date: "Ongoing", event: "Magnetics Facility Ramp", impact: "HIGH" },
      { date: "2026", event: "Downstream Processing Expansion", impact: "MEDIUM" },
      { date: "Ongoing", event: "Auto OEM Supply Deals", impact: "MEDIUM" }
    ],
    risks: [
      "Commodity price volatility",
      "China supply chain disruption",
      "Environmental/permitting challenges"
    ],
    vitals: {
      founded: 2017,
      hq: "Las Vegas, NV",
      employees: "~800",
      facility: "Mountain Pass Mine"
    },
    lore: "Every EV motor, every wind turbine, every F-35 needs rare earths. China has the market cornered. MP is the insurance policy."
  },
  HON: {
    name: "Honeywell International",
    codename: "INDUSTRIAL",
    sector: "Aerospace & Industrial",
    threat_level: "LOW",
    summary: "Diversified industrial conglomerate. Aerospace systems, building technologies, performance materials. The boring backbone of global infrastructure.",
    thesis: "When everyone else is chasing moonshots, sometimes you want the company that makes the avionics, the thermostats, and the jet engines.",
    catalysts: [
      { date: "Ongoing", event: "Aerospace Aftermarket Growth", impact: "MEDIUM" },
      { date: "Ongoing", event: "Energy Transition Products", impact: "MEDIUM" },
      { date: "Quarterly", event: "Earnings & Guidance", impact: "LOW" }
    ],
    risks: [
      "Industrial cyclicality",
      "Conglomerate discount",
      "Spin-off execution risk"
    ],
    vitals: {
      founded: 1906,
      hq: "Charlotte, NC",
      employees: "~95,000",
      segments: "Aerospace, Building Tech, PMT, SPS"
    },
    lore: "Not every position needs to be a moonshot. Sometimes you hold the company that makes parts for everyone else's moonshots."
  },
  ATI: {
    name: "ATI Inc",
    codename: "ALLOY",
    sector: "Specialty Materials",
    threat_level: "LOW",
    summary: "Specialty materials company. Titanium, nickel alloys, specialty steels. Aerospace, defense, energy markets. When you need metal that doesn't melt, bend, or corrode.",
    thesis: "Next-gen aircraft and turbines require exotic alloys. ATI is one of the few Western suppliers who can make them at scale.",
    catalysts: [
      { date: "Ongoing", event: "Aerospace Production Ramp", impact: "MEDIUM" },
      { date: "Ongoing", event: "Defense Spending Tailwinds", impact: "MEDIUM" },
      { date: "Ongoing", event: "Titanium Supply Constraints", impact: "LOW" }
    ],
    risks: [
      "Aerospace cycle sensitivity",
      "Raw material cost volatility",
      "Labor and energy costs"
    ],
    vitals: {
      founded: 1996,
      hq: "Dallas, TX",
      employees: "~6,000",
      materials: "Titanium, Nickel, Steel"
    },
    lore: "The materials science behind every jet engine. Unglamorous, essential, and very hard to replicate."
  },
  CACI: {
    name: "CACI International",
    codename: "INTEL",
    sector: "Defense & Intelligence",
    threat_level: "LOW",
    summary: "Defense and intelligence IT services. Cybersecurity, signals intelligence, mission support. The quiet contractor that does the classified work.",
    thesis: "Government never stops needing IT and intelligence services. CACI has the clearances and the contracts.",
    catalysts: [
      { date: "Ongoing", event: "Contract Wins", impact: "MEDIUM" },
      { date: "Ongoing", event: "M&A Activity", impact: "MEDIUM" },
      { date: "Ongoing", event: "Defense Budget Stability", impact: "LOW" }
    ],
    risks: [
      "Contract recompete risk",
      "Clearance/talent constraints",
      "Budget uncertainty"
    ],
    vitals: {
      founded: 1962,
      hq: "Reston, VA",
      employees: "~23,000",
      clearances: "High"
    },
    lore: "When you need something done in the classified world, CACI picks up the phone. Boring to everyone except the people who need them."
  },
  LOAR: {
    name: "Loar Holdings",
    codename: "COMPONENT",
    sector: "Aerospace Components",
    threat_level: "LOW",
    summary: "Aerospace and defense component manufacturer. Actuators, valves, and precision systems. The small parts that make the big machines work.",
    thesis: "Aerospace OEMs are ramping production. Every aircraft needs thousands of precision components. Loar makes them.",
    catalysts: [
      { date: "Ongoing", event: "Aircraft Production Ramp", impact: "MEDIUM" },
      { date: "Ongoing", event: "Aftermarket Growth", impact: "MEDIUM" },
      { date: "Ongoing", event: "M&A Integration", impact: "LOW" }
    ],
    risks: [
      "Customer concentration",
      "Supply chain disruptions",
      "Integration execution"
    ],
    vitals: {
      founded: 2012,
      hq: "White Plains, NY",
      employees: "~2,500",
      products: "Aerospace Components"
    },
    lore: "Another picks-and-shovels play. While everyone argues about which plane is best, Loar sells parts to all of them."
  },
  COHR: {
    name: "Coherent Corp",
    codename: "PRISM",
    sector: "Optics & Photonics",
    threat_level: "MODERATE",
    summary: "Global leader in laser technology, optical materials, and photonic components. Products enable everything from fiber optics to semiconductor manufacturing.",
    thesis: "Lasers are the future of manufacturing, communications, and defense. Coherent owns key technologies across all three verticals.",
    catalysts: [
      { date: "2026", event: "AI Datacenter Optical Demand", impact: "HIGH" },
      { date: "Ongoing", event: "EUV Lithography Components", impact: "MEDIUM" }
    ],
    risks: [
      "Cyclical semiconductor demand",
      "China exposure",
      "Integration of II-VI acquisition"
    ],
    vitals: { founded: 1971, hq: "Saxonburg, PA", employees: "~28,000", products: "Lasers & Optical Components" },
    lore: "When you need a laser for anything from eye surgery to chip manufacturing, odds are Coherent made a piece of it."
  },
  RTX: {
    name: "RTX Corporation",
    codename: "RAYTHEON",
    sector: "Aerospace & Defense",
    threat_level: "LOW",
    summary: "Defense and aerospace giant formed from Raytheon and United Technologies merger. Makes everything from jet engines to missiles to avionics.",
    thesis: "The defense prime thesis: geopolitical instability is the new normal, and Western militaries are rebuilding after decades of underinvestment.",
    catalysts: [
      { date: "Ongoing", event: "Global Defense Spending Increase", impact: "HIGH" },
      { date: "2026", event: "GTF Engine Production Ramp", impact: "MEDIUM" }
    ],
    risks: [
      "Pratt & Whitney engine issues",
      "Supply chain constraints",
      "Government budget politics"
    ],
    vitals: { founded: 2020, hq: "Arlington, VA", employees: "~180,000", products: "Defense Systems & Aircraft Engines" },
    lore: "When the world gets dangerous, the phone rings in Arlington. The ultimate 'sleep at night' defense holding."
  },
  LHX: {
    name: "L3Harris Technologies",
    codename: "HELIX",
    sector: "Defense Electronics",
    threat_level: "LOW",
    summary: "Defense electronics powerhouse specializing in communications, sensors, and space systems. A key supplier across all military branches.",
    thesis: "Modern warfare is electronic warfare. L3Harris makes the eyes, ears, and nervous system of the US military.",
    catalysts: [
      { date: "2026", event: "Space Force Contract Awards", impact: "HIGH" },
      { date: "Ongoing", event: "EW System Modernization", impact: "MEDIUM" }
    ],
    risks: [
      "Integration complexity",
      "Classified program dependencies",
      "Defense budget volatility"
    ],
    vitals: { founded: 2019, hq: "Melbourne, FL", employees: "~47,000", products: "Defense Electronics & Communications" },
    lore: "If it beeps, blinks, or broadcasts on a battlefield, L3Harris probably had a hand in it."
  },
  GE: {
    name: "GE Aerospace",
    codename: "SPECTRE",
    sector: "Aerospace & Industrial",
    threat_level: "MODERATE",
    summary: "The jet engine division of the former conglomerate, now a pure-play aerospace company. Makes engines for Boeing, Airbus, and military aircraft.",
    thesis: "Aviation is recovering post-pandemic, and GE makes the engines that power most of the world's commercial and military aircraft.",
    catalysts: [
      { date: "2026", event: "LEAP Engine Production Increase", impact: "HIGH" },
      { date: "Ongoing", event: "Aftermarket Services Revenue", impact: "MEDIUM" }
    ],
    risks: [
      "Boeing 737 MAX production issues",
      "Supply chain constraints",
      "New engine development costs"
    ],
    vitals: { founded: 1892, hq: "Evendale, OH", employees: "~52,000", products: "Aircraft Engines & Services" },
    lore: "When you hear a jet overhead, there's a good chance GE built what's making that sound. Industrial aviation royalty."
  }
};

// Expose globally for use by other modules
  window.TICKER_PROFILES = TICKER_PROFILES;
})();

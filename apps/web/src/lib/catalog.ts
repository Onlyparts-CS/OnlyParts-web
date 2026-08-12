import type { Category, Product, Project } from "./types";
import { CATALOGUE_EMPTY } from "./demo";

/* Helper so the tree stays readable */
const l2 = (name: string, ...children: [string, number][]) => ({
  name,
  children: children.map(([name, count]) => ({ name, count })),
});

/* ============================================================
   13 top-level categories — docs/02-TAXONOMY.md §3
   ============================================================ */
export const CATEGORIES: Category[] = [
  {
    slug: "fasteners", name: "Fasteners", glyph: "hex", weight: "wide", count: 3412,
    blurb: "Screws, bolts, nuts, washers, inserts and pins. SS304, SS316, 12.9 alloy, brass and nylon.",
    subs: [
      l2("Screws — by Drive", ["Flat (Slotted)", 312], ["Cross (Phillips)", 486], ["Hex (Allen)", 524], ["Combination", 96], ["Star (Torx)", 140], ["Pozidriv", 72]),
      l2("Screws — by Head", ["Pan Head", 412], ["Countersunk (CSK)", 388], ["Button Head", 301], ["Socket Head Cap", 524], ["Cheese Head", 140], ["Flange Head", 96]),
      l2("Bolts", ["Hex Bolts", 280], ["Carriage Bolts", 94], ["Eye Bolts", 66], ["U-Bolts", 48], ["Shoulder Bolts", 72]),
      l2("Nuts", ["Hex Nuts", 240], ["Nyloc Nuts", 186], ["Wing Nuts", 54], ["T-Nuts", 88], ["Flange Nuts", 96]),
      l2("Washers", ["Flat / Plain", 210], ["Spring Lock", 144], ["Star / Tooth", 88], ["Belleville", 42], ["Nylon", 60]),
      l2("Threaded Inserts", ["Brass Heat-Set", 168], ["Knurled Press-Fit", 92], ["Helicoil", 74], ["Rivet Nuts", 86]),
      l2("Spacers & Standoffs", ["Brass Standoffs", 204], ["Nylon Standoffs", 148], ["PCB Spacers", 96]),
      l2("Rivets & Pins", ["Pop Rivets", 120], ["Dowel Pins", 96], ["Cotter Pins", 64], ["Circlips", 110]),
      l2("Grub & Set Screws", ["Cup Point", 86], ["Flat Point", 72], ["Cone Point", 48]),
      l2("Assorted Kits", ["Fastener Boxes", 48], ["3D Printing Kits", 22], ["Drone Kits", 18]),
    ],
  },
  {
    slug: "motors", name: "Motors", glyph: "rotor", weight: "wide", count: 1284,
    blurb: "BLDC, stepper, servo, geared DC and AC — plus the drivers and mounts to run them.",
    subs: [
      l2("BLDC Motors", ["Outrunner", 142], ["Inrunner", 64], ["Gimbal", 38], ["Ducted Fan", 26]),
      l2("Stepper Motors", ["NEMA 8", 18], ["NEMA 11", 24], ["NEMA 14", 32], ["NEMA 17", 96], ["NEMA 23", 58], ["NEMA 34", 22]),
      l2("Servo Motors", ["Micro Servos", 86], ["Standard Hobby", 74], ["Digital High-Torque", 52], ["Industrial AC Servo", 34]),
      l2("DC Motors", ["Brushed DC", 124], ["Geared DC (BO/TT)", 96], ["Planetary Gear", 48], ["Encoder Motors", 36]),
      l2("Motor Drivers", ["Stepper Drivers", 88], ["DC Motor Drivers", 72], ["BLDC ESCs", 94], ["Servo Controllers", 30]),
      l2("Motor Accessories", ["Mounts & Brackets", 78], ["Shaft Couplers", 66], ["Pulleys & Belts", 92], ["Encoders", 44]),
      // 48 shaded-pole / synchronous AC gearmotors had no shelf: every other
      // motor L2 here is DC or step. Same HSN drawer (8501), so this was
      // shelving rather than tax — but they were failing the importer entirely.
      l2("AC Motors", ["Induction", 30], ["Synchronous", 48], ["Shaded Pole", 18]),
      // Things that move without rotating. Pumps and solenoids were the largest
      // motor-adjacent gap in the feeds and had no shelf anywhere.
      l2("Actuators",["Solenoids & Electromagnets", 60], ["Water & Air Pumps", 175], ["Solenoid Valves", 40], ["Linear Actuators", 35]),
    ],
  },
  {
    slug: "electronic-components", name: "Electronic Components", glyph: "chip", weight: "wide", count: 8940,
    blurb: "Passives, semiconductors, ICs, dev boards, sensors, displays, connectors and power.",
    subs: [
      l2("Passive Components", ["Resistors (THT)", 640], ["Resistors (SMD)", 880], ["Ceramic Capacitors", 520], ["Electrolytic Caps", 340], ["Inductors", 180], ["Crystals", 120]),
      l2("Semiconductors", ["Diodes", 280], ["LEDs", 360], ["Transistors (BJT)", 240], ["MOSFETs", 300], ["Optocouplers", 90], ["Regulators", 210]),
      // "Logic ICs" was holding 8,200 rows because it was the only IC shelf
      // that was not a microcontroller: robu's line drivers, RS-485
      // transceivers, USB bridges and real-time clocks all landed in it. A
      // driver IC is not a logic gate and an RTC is not either.
      l2("Integrated Circuits", ["Microcontrollers", 180], ["Op-Amps", 160], ["Logic ICs", 220], ["Interface & Driver ICs", 2040], ["Clock & Timing", 173], ["ADC / DAC", 90], ["Memory", 110]),
      l2("Development Boards", ["Arduino & Compatible", 140], ["ESP32 / ESP8266", 96], ["Raspberry Pi & HATs", 120], ["STM32 / ARM", 74]),
      l2("Sensors", ["Temperature & Humidity", 110], ["Distance & Proximity", 96], ["IMU / Gyro", 72], ["Pressure", 54], ["Gas & Air Quality", 48], ["Load Cells", 36], ["Camera Modules", 140], ["Current & Voltage", 45]),
      l2("Displays", ["OLED", 68], ["LCD Character", 44], ["TFT / Graphic", 72], ["E-Paper", 26], ["LED Matrix", 38]),
      l2("Connectors & Cables", ["JST", 180], ["Dupont / Jumper", 96], ["XT / Bullet", 88], ["Terminal Blocks", 140], ["Headers", 160], ["DC Power Jacks", 50], ["Hook-up Wire", 111], ["Heat Shrink", 110]),
      l2("Power Supplies", ["Buck Converters", 120], ["Boost Converters", 88], ["SMPS Modules", 96], ["AC-DC Adapters", 74]),

      /*
        Added from the supplier feeds. Counts here are what the four catalogues
        actually carry, not estimates — these are shelves that exist because
        11,724 scraped rows had nowhere to go, and every one of them was
        rejected by the importer for want of an HSN code.
      */
      l2("Audio & Sound", ["Speakers", 520], ["Buzzers & Sirens", 90], ["Microphones", 40], ["Audio Amplifier Modules", 130]),
      l2("Thermal Management", ["Heat Sinks", 240], ["Cooling Fans", 170], ["Peltier / TEC", 60], ["Thermal Pads & Tape", 30]),
      l2("Wireless & RF", ["LoRa Modules", 90], ["RF Transceivers", 95], ["GPS / GNSS", 92], ["GSM / Cellular", 140], ["Antennas", 115], ["WiFi & Bluetooth Modules", 120], ["RFID & NFC", 59], ["IR Transmit / Receive", 40]),
      l2("Prototyping", ["Breadboards", 75], ["Zero PCB / Perfboard", 45], ["Enclosures & Cases", 60], ["Programmers & Debuggers", 56]),
      l2("Kits & Learning", ["DIY Project Kits", 85], ["Educational Robot Kits", 70], ["Starter Kits", 50]),
    ],
  },
  {
    slug: "batteries-power", name: "Batteries & Power", glyph: "cell", weight: "wide", count: 1620,
    blurb: "Cells, packs, BMS, chargers and everything needed to build a pack yourself.",
    subs: [
      l2("Lithium Cells", ["18650", 86], ["21700", 42], ["26650", 24], ["LiPo Pouch", 110], ["LiFePO4", 56], ["Coin Cells", 20]),
      l2("Battery Packs", ["LiPo Packs (RC)", 168], ["Li-ion Packs", 94], ["LiFePO4 Packs", 48], ["Custom Assembly", 12]),
      l2("Battery Management", ["BMS Boards", 124], ["Balance Chargers", 66], ["Protection Circuits", 58], ["Monitors", 40]),
      l2("Chargers", ["LiPo Balance", 72], ["Li-ion", 64], ["Solar Controllers", 52], ["USB-C PD", 48]),
      l2("Pack Building", ["Nickel Strip", 34], ["Cell Holders", 56], ["Spot Welders", 18], ["Busbars", 26]),
    ],
  },
  {
    /*
      Machines and consumables are two different purchases and they were sharing
      one drawer.

      Someone buying a printer is choosing between a Bambu Lab and a Creality on
      build volume and enclosure; someone buying filament wants PETG in black,
      today. Filing them together meant the person after a nozzle had to walk
      past six printers, and the person after a printer landed in a drawer whose
      other 1,800 rows were spares.

      Brand does *not* become a fourth level. "Bambu Lab 3D Printers" as a
      category is how a tree grows to five levels and how the same machine ends
      up filed twice. Brand is a facet and a landing page — see BRANDS below.
    */
    slug: "3d-printers", name: "3D Printers", glyph: "hub", weight: "std", count: 292,
    blurb: "FDM, resin and scanners — the machines themselves, by build volume and enclosure.",
    subs: [
      l2("FDM Printers", ["Entry-Level", 34], ["Bed-Slinger", 42], ["CoreXY", 38], ["Enclosed", 26], ["Multi-Material", 18]),
      l2("Resin Printers", ["MSLA", 30], ["Large-Format Resin", 12], ["Wash & Cure", 16]),
      l2("Printer Kits & Upgrades", ["Full Kits", 18], ["Upgrade Kits", 34]),
      l2("3D Scanners", ["Handheld", 14], ["Desktop", 10]),
    ],
  },
  {
    slug: "3d-printing", name: "3D Printing Supplies", glyph: "nozzle", weight: "wide", count: 2112,
    blurb: "Filament, resin, hotends, motion, electronics and build surfaces.",
    subs: [
      l2("Filament", ["PLA", 180], ["PLA+ / Silk", 120], ["ABS", 64], ["PETG", 96], ["TPU / Flexible", 72], ["Nylon (PA)", 38], ["Carbon Filled", 44]),
      l2("Resin & Consumables", ["Standard Resin", 42], ["Tough / ABS-Like", 26], ["Water-Washable", 18], ["Cleaning & Curing", 22]),
      l2("Hotends & Extruders", ["Hotend Assemblies", 86], ["Nozzles", 210], ["Heat Breaks", 68], ["Thermistors", 44], ["PTFE Tube", 32]),
      l2("Motion Components", ["Linear Rails (MGN)", 96], ["Linear Rods & Bearings", 110], ["Lead Screws", 64], ["GT2 Belts", 78], ["Pulleys & Idlers", 92]),
      l2("Electronics", ["Control Boards", 72], ["Stepper Drivers", 88], ["Bed Probes", 44], ["Endstops", 56], ["Cooling Fans", 94]),
      l2("Build Surfaces", ["PEI Sheets", 48], ["Glass Beds", 32], ["Magnetic Flex Plates", 40], ["Heated Beds", 36]),
    ],
  },
  {
    slug: "drones-parts", name: "Drones & Parts", glyph: "prop", weight: "std", count: 1860,
    blurb: "Frames, stacks, motors, props and the whole FPV chain.",
    subs: [
      l2("Frames", ["Freestyle", 72], ["Racing", 58], ["Cinewhoop", 44], ["Long Range", 38], ["Micro / Whoop", 52]),
      l2("Flight Controllers", ["FC Boards", 88], ["AIO (FC+ESC)", 64], ["Stack Combos", 56]),
      l2("ESCs", ["4-in-1 ESCs", 72], ["Single ESCs", 48], ["High Current", 26]),
      l2("Motors (Drone)", ["1103–1404", 66], ["2004–2306", 124], ["2506+", 58], ["Heavy Lift", 22]),
      l2("Propellers", ['2"–3"', 86], ['4"–5"', 140], ['6"–7"', 64], ['8"+', 38]),
      l2("FPV System", ["FPV Cameras", 72], ["VTX", 66], ["Antennas", 96], ["Goggles & RX", 34], ["Digital HD", 28]),
      l2("Drone Hardware", ["Drone Screws", 110], ["Standoffs", 88], ["Vibration Dampers", 44], ["Landing Gear", 36]),
      // The RC link is not the FPV link. Receivers and TX modules were landing
      // in `fpv-system.vtx`, which is video downlink — a different radio.
      l2("Radio Link", ["RC Receivers", 75], ["RC Transmitters", 60], ["TX Modules", 30], ["Telemetry", 40]),
    ],
  },
  {
    slug: "tools", name: "Tools", glyph: "wrench", weight: "std", count: 2760,
    blurb: "Hand, power, soldering, measuring, cutting and safety.",
    subs: [
      l2("Hand Tools", ["Screwdrivers & Sets", 186], ["Precision Screwdrivers", 94], ["Hex / Allen Keys", 110], ["Spanners", 132], ["Pliers", 148], ["Cutters", 96]),
      l2("Power Tools", ["Cordless Drills", 64], ["Impact Drivers", 38], ["Angle Grinders", 48], ["Rotary Tools", 36], ["Heat Guns", 28]),
      l2("Soldering & Rework", ["Soldering Irons", 72], ["Soldering Stations", 48], ["Hot Air Rework", 34], ["Solder Wire", 66], ["Flux", 42], ["Tips", 110]),
      l2("Measuring & Test", ["Multimeters", 86], ["Oscilloscopes", 26], ["Vernier Callipers", 64], ["Micrometers", 38], ["Thread Gauges", 30], ["Clamp Meters", 60], ["Bench Power Supplies", 40], ["Rules & Tapes", 37]),
      l2("Cutting & Drilling", ["Drill Bits", 240], ["Taps & Dies", 180], ["Hole Saws", 72], ["End Mills", 160]),
      l2("Adhesives & Chemicals", ["Super Glue", 44], ["Epoxy", 38], ["Threadlockers", 32], ["Lubricants", 56], ["Thermal Paste", 28], ["Tapes", 50]),
      l2("Abrasives & Finishing", ["Cutting & Saw Discs", 40], ["Sanding & Flap Discs", 35], ["Wire Brushes", 25], ["Polishing Pads", 20]),
      l2("Paints & Coatings", ["Spray Paint", 40], ["Primers & Undercoats", 20], ["Anti-Rust & Protective", 15]),
      l2("Safety Equipment", ["Safety Glasses", 34], ["Gloves", 66], ["Respirators", 28], ["ESD Straps", 22]),
      l2("Workbench", ["Anti-Static Mats", 30], ["Vices & Clamps", 55], ["Tool Kits & Cases", 100], ["Magnifiers & Lamps", 25]),
    ],
  },
  {
    slug: "bearings", name: "Bearings", glyph: "bearing", weight: "std", count: 1480,
    blurb: "Ball, roller, linear, plain and mounted units.",
    subs: [
      l2("Ball Bearings", ["Deep Groove", 420], ["Miniature", 280], ["Angular Contact", 86], ["Thrust Ball", 64], ["Flanged", 120]),
      l2("Roller Bearings", ["Cylindrical", 72], ["Tapered", 96], ["Needle", 110], ["Spherical", 44]),
      l2("Linear Motion", ["Linear Ball Bearings", 140], ["Linear Rails & Blocks", 96], ["Linear Bushings", 72], ["Linear Shafts", 88]),
      l2("Plain Bearings", ["Bronze Bushings", 86], ["Oilite / Sintered", 64], ["PTFE-Lined", 38], ["Nylon", 44]),
      l2("Mounted Units", ["Pillow Blocks", 72], ["Flange Units", 64], ["Take-up Units", 28]),
      l2("Accessories", ["Shaft Collars", 88], ["Seals & Shields", 56], ["Pullers", 24], ["Grease", 32]),
    ],
  },
  {
    slug: "magnets", name: "Magnets", glyph: "magnet", weight: "std", count: 640,
    blurb: "Neodymium N35–N52, ferrite, assemblies and electromagnets.",
    subs: [
      l2("Neodymium (NdFeB)", ["Disc", 180], ["Block / Cube", 120], ["Ring", 86], ["Cylinder / Rod", 72], ["Countersunk", 64], ["Arc / Segment", 34]),
      l2("Other Materials", ["Ferrite / Ceramic", 48], ["Samarium Cobalt", 18], ["Alnico", 14], ["Flexible", 26]),
      l2("Magnetic Assemblies", ["Pot Magnets", 42], ["Hook Magnets", 28], ["Magnetic Catches", 34]),
      l2("Sheet & Tape", ["Magnetic Sheets", 22], ["Magnetic Tape", 18]),
      l2("Electromagnets", ["Holding Electromagnets", 16], ["Solenoids", 38], ["EM Locks", 12]),
    ],
  },
  {
    slug: "cnc-machines-parts", name: "CNC Machines & Parts", glyph: "endmill", weight: "std", count: 1320,
    blurb: "Machines, spindles, motion, control and tooling.",
    subs: [
      l2("CNC Machines", ["Desktop Routers", 24], ["CNC Mills", 16], ["Laser Cutters", 22], ["Machine Kits", 14]),
      l2("Spindles & Drives", ["Air-Cooled Spindles", 32], ["Water-Cooled Spindles", 28], ["Spindle VFDs", 36], ["Collets (ER11/16/20)", 86]),
      l2("Motion System", ["Ball Screws", 96], ["Linear Guides", 110], ["Rack & Pinion", 44], ["Bearing Blocks", 72], ["Couplers", 66]),
      l2("Control Electronics", ["CNC Controllers", 48], ["Breakout Boards", 36], ["Stepper Drivers", 72], ["Limit Switches", 54], ["E-Stop", 28]),
      l2("Cutting Tools", ["End Mills", 210], ["V-Bits & Engraving", 96], ["Router Bits", 140], ["Thread Mills", 44]),
      l2("Workholding", ["Vices", 38], ["Clamp Kits", 46], ["T-Slot Hardware", 88], ["Fixture Plates", 24]),
    ],
  },
  {
    slug: "industrial-electricals", name: "Industrial Electricals", glyph: "contactor", weight: "std", count: 1980,
    blurb: "Switchgear, contactors, VFDs, PLCs, panel components and distribution.",
    subs: [
      l2("Switchgear & Protection", ["MCBs", 180], ["MCCBs", 96], ["RCCBs", 72], ["Fuses", 140], ["Isolators", 64], ["SPDs", 38]),
      l2("Contactors & Starters", ["Power Contactors", 120], ["DOL Starters", 56], ["Star-Delta", 34], ["Soft Starters", 28]),
      l2("Drives & Automation", ["VFDs", 88], ["PLCs", 64], ["HMIs", 42], ["I/O Modules", 56], ["Industrial Relays", 110]),
      l2("Industrial Sensors", ["Proximity", 96], ["Photoelectric", 72], ["Limit Switches", 88], ["Temperature Controllers", 54]),
      // A pilot lamp is not a meter. 545 panel indicator lights were sitting in
      // Panel Meters because that was the only panel-mount shelf — a customer
      // filtering for a 22mm indicator got a wall of voltmeters.
      l2("Panel Components", ["DIN Rail", 44], ["Terminal Blocks", 180], ["Push Buttons", 140], ["Indicator Lamps", 545], ["Panel Meters", 66], ["Enclosures", 96]),
      l2("Power Distribution", ["Busbars", 38], ["Cable Lugs", 120], ["Cable Glands", 96], ["Industrial Cable", 110], ["Cable Ties & Clips", 40]),
    ],
  },
  {
    slug: "ev-parts", name: "EV Parts", glyph: "hub", weight: "std", count: 980,
    blurb: "Hub motors, controllers, packs, charging, drivetrain and conversion kits.",
    subs: [
      l2("Traction Motors", ["Hub Motors", 72], ["Mid-Drive", 38], ["BLDC EV Motors", 56], ["PMSM", 24]),
      l2("Controllers", ["BLDC Controllers", 64], ["FOC / Sine Wave", 48], ["Throttles", 44], ["Displays", 36]),
      l2("EV Batteries", ["EV Packs", 52], ["EV BMS", 66], ["Battery Boxes", 28], ["EV Connectors", 72]),
      l2("Charging", ["On-board Chargers", 34], ["AC Charge Points", 22], ["Charging Guns", 18], ["Charge Controllers", 26]),
      l2("Drivetrain", ["Chains & Sprockets", 86], ["Belt Drives", 44], ["Freewheels", 28], ["Gearboxes", 22]),
      l2("Conversion Kits", ["E-Bike Kits", 34], ["E-Scooter Kits", 26], ["E-Rickshaw Kits", 18], ["Go-Kart Kits", 14]),
    ],
  },
  {
    slug: "hardware", name: "Hardware", glyph: "extrusion", weight: "std", count: 2450,
    blurb: "Extrusion, brackets, couplings, transmission, springs, seals and raw stock.",
    subs: [
      l2("Aluminium Extrusion", ["2020 Profile", 86], ["3030 Profile", 52], ["4040 Profile", 44], ["Corner Brackets", 120], ["T-Nuts", 96]),
      l2("Brackets & Mounts", ["L Brackets", 140], ["Corner Braces", 88], ["Mounting Plates", 72], ["Panel Mounts", 54]),
      l2("Shafts & Couplings", ["Precision Shafts", 96], ["Shaft Collars", 110], ["Rigid Couplings", 64], ["Flexible Couplings", 72]),
      l2("Power Transmission", ["Timing Belts", 120], ["Pulleys", 140], ["Chains & Sprockets", 96], ["Gears", 180], ["Gear Racks", 44]),
      l2("Springs", ["Compression", 180], ["Extension", 120], ["Torsion", 86]),
      l2("Seals & Gaskets", ["O-Rings", 240], ["Oil Seals", 110], ["Grommets", 64]),
      l2("Sheet, Rod & Stock", ["Aluminium Sheet", 72], ["Acrylic Sheet", 64], ["Delrin / Nylon", 48], ["Carbon Fibre", 56]),
      // Mecanum, omni and chassis wheels — 94 rows that are not a bearing and
      // not a pulley, which is where they kept half-landing.
      l2("Wheels", ["Mecanum", 37], ["Omni", 22], ["Rubber & Chassis", 35]),
      l2("Enclosures", ["ABS Project Boxes", 96], ["Die-Cast Aluminium", 44], ["Waterproof IP65+", 56]),
    ],
  },
];

/**
 * How many drawers there are, in figures and in words.
 *
 * "Thirteen" was written into six components, a footer heading split as
 * "Drawers 01–07" / "08–13", and three pages of body copy. Splitting one
 * category into two made every one of them wrong at once. The number is data;
 * the copy asks for it.
 */
export const DRAWER_COUNT = CATEGORIES.length;

const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen", "twenty",
];

/** "fourteen" — lowercase; capitalise at the call site if a sentence needs it. */
export const drawerWord = () => NUMBER_WORDS[DRAWER_COUNT] ?? String(DRAWER_COUNT);

/** ["01", "07"] and ["08", "14"] — the footer's two columns, split down the middle. */
export const drawerSplit = () => {
  const half = Math.ceil(DRAWER_COUNT / 2);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    firstHalf: CATEGORIES.slice(0, half),
    secondHalf: CATEGORIES.slice(half),
    firstLabel: `Drawers ${pad(1)}–${pad(half)}`,
    secondLabel: `Drawers ${pad(half + 1)}–${pad(DRAWER_COUNT)}`,
  };
};

/* ============================================================
   Brands
   ------------------------------------------------------------
   A brand is a **facet with a landing page**, not a level of the
   tree.

   The obvious move — after seeing how the big Indian parts stores
   do it — is to file "Bambu Lab 3D Printers" as a category under
   "3D Printers". That is how a three-level tree quietly becomes
   five, how the same machine gets filed twice, and how a buyer
   who does not care about brand has to walk through it anyway.

   Filed as a facet: `/c/3d-printers?brand=bambu-lab` narrows the
   category, and `/b/bambu-lab` is the brand's own shelf across
   every category it appears in. One record, two ways in.
   ============================================================ */
export type Brand = {
  slug: string;
  name: string;
  blurb: string;
  /** Category slugs this brand actually appears in — drives the brand page. */
  categories: string[];
  count: number;
};

export const BRANDS: Brand[] = [
  { slug: "bambu-lab", name: "Bambu Lab", blurb: "CoreXY machines with multi-material feeders.", categories: ["3d-printers", "3d-printing"], count: 38 },
  { slug: "creality", name: "Creality", blurb: "Ender and K-series printers, plus spares.", categories: ["3d-printers", "3d-printing"], count: 64 },
  { slug: "prusa", name: "Prusa", blurb: "Open-hardware FDM, kits and genuine spares.", categories: ["3d-printers", "3d-printing"], count: 29 },
  { slug: "elegoo", name: "Elegoo", blurb: "Resin machines, resin and wash-and-cure.", categories: ["3d-printers", "3d-printing"], count: 41 },
  { slug: "anycubic", name: "Anycubic", blurb: "FDM and MSLA, entry to large format.", categories: ["3d-printers", "3d-printing"], count: 33 },
  { slug: "e3d", name: "E3D", blurb: "Hotends, nozzles and extrusion hardware.", categories: ["3d-printing"], count: 86 },
  { slug: "arduino", name: "Arduino", blurb: "Boards, shields and the official ecosystem.", categories: ["electronic-components"], count: 74 },
  { slug: "raspberry-pi", name: "Raspberry Pi", blurb: "Single-board computers, Pico and HATs.", categories: ["electronic-components"], count: 52 },
  { slug: "espressif", name: "Espressif", blurb: "ESP32 and ESP8266 modules and dev boards.", categories: ["electronic-components"], count: 46 },
  { slug: "t-motor", name: "T-Motor", blurb: "BLDC motors and propellers for airframes.", categories: ["motors", "drones-parts"], count: 58 },
  { slug: "skf", name: "SKF", blurb: "Deep groove, thrust and linear bearings.", categories: ["bearings"], count: 44 },
  { slug: "wera", name: "Wera", blurb: "Drivers, bits and torque tools.", categories: ["tools"], count: 37 },
  { slug: "generic", name: "Generic", blurb: "Unbranded commodity stock — most fasteners.", categories: ["fasteners", "hardware"], count: 0 },
];

/** Brands worth showing in navigation — "Generic" is a fact, not a brand page. */
const featuredBrands = () => BRANDS.filter((b) => b.slug !== "generic");

export const brandsForCategory = (slug: string) =>
  featuredBrands().filter((b) => b.categories.includes(slug));

export const findBrand = (slug: string) => BRANDS.find((b) => b.slug === slug);

/* ============================================================
   Demo product documents — shape mirrors docs/09-SEARCH-SPEC.md §3
   ============================================================ */
export const PRODUCTS: Product[] = [
  { sku: "FS-SHC-M3-010-SS304", title: "M3 × 10mm Hex Socket Head Cap Screw, SS304", price: 420, bulkPrice: 260, bulkQty: 1000, cat: "Fasteners › Socket Head Cap", stock: 2480, dispatchHours: 24, glyph: "hex", attrs: { thread: "M3", length_mm: 10, material: "ss304", head_type: "socket-head-cap", drive_type: "hex" }, text: "allen socket cap screw stainless din912" },
  { sku: "FS-SHC-M3-010-129", title: "M3 × 10mm Hex Socket Head Cap Screw, Alloy 12.9", price: 310, bulkPrice: 190, bulkQty: 1000, cat: "Fasteners › Socket Head Cap", stock: 1240, dispatchHours: 24, glyph: "hex", attrs: { thread: "M3", length_mm: 10, material: "12.9", head_type: "socket-head-cap", drive_type: "hex" }, text: "allen socket cap screw black alloy high tensile" },
  { sku: "FS-BTN-M3-010-SS304", title: "M3 × 10mm Hex Button Head Screw, SS304", price: 460, bulkPrice: 300, bulkQty: 1000, cat: "Fasteners › Button Head", stock: 1860, dispatchHours: 24, glyph: "hex", attrs: { thread: "M3", length_mm: 10, material: "ss304", head_type: "button-head", drive_type: "hex" }, text: "allen button dome head stainless iso7380" },
  { sku: "FS-CSK-M3-010-SS304", title: "M3 × 10mm Hex Countersunk (CSK) Screw, SS304", price: 440, cat: "Fasteners › Countersunk", stock: 940, dispatchHours: 24, glyph: "hex", attrs: { thread: "M3", length_mm: 10, material: "ss304", head_type: "countersunk", drive_type: "hex" }, text: "csk flat flush head allen stainless" },
  { sku: "FS-SHC-M3-008-SS304", title: "M3 × 8mm Hex Socket Head Cap Screw, SS304", price: 390, cat: "Fasteners › Socket Head Cap", stock: 3120, dispatchHours: 24, glyph: "hex", attrs: { thread: "M3", length_mm: 8, material: "ss304", head_type: "socket-head-cap", drive_type: "hex" }, text: "allen socket cap screw stainless" },
  { sku: "FS-SHC-M3-016-SS304", title: "M3 × 16mm Hex Socket Head Cap Screw, SS304", price: 510, cat: "Fasteners › Socket Head Cap", stock: 1420, dispatchHours: 24, glyph: "hex", attrs: { thread: "M3", length_mm: 16, material: "ss304", head_type: "socket-head-cap", drive_type: "hex" }, text: "allen socket cap screw stainless" },
  { sku: "FS-SHC-M4-010-SS304", title: "M4 × 10mm Hex Socket Head Cap Screw, SS304", price: 520, cat: "Fasteners › Socket Head Cap", stock: 2210, dispatchHours: 24, glyph: "hex", attrs: { thread: "M4", length_mm: 10, material: "ss304", head_type: "socket-head-cap", drive_type: "hex" }, text: "allen socket cap screw stainless" },
  { sku: "FS-SHC-M5-020-SS304", title: "M5 × 20mm Hex Socket Head Cap Screw, SS304", price: 780, cat: "Fasteners › Socket Head Cap", stock: 860, dispatchHours: 24, glyph: "hex", attrs: { thread: "M5", length_mm: 20, material: "ss304", head_type: "socket-head-cap", drive_type: "hex" }, text: "allen socket cap screw stainless" },
  { sku: "FS-PAN-M4-012-SS304", title: "M4 × 12mm Phillips Pan Head Screw, SS304", price: 380, cat: "Fasteners › Pan Head", stock: 4200, dispatchHours: 24, glyph: "hex", attrs: { thread: "M4", length_mm: 12, material: "ss304", head_type: "pan-head", drive_type: "phillips" }, text: "cross phillips pan head stainless" },
  { sku: "FS-NUT-M3-NYL", title: "M3 Nyloc Nut, SS304 (Nylon Insert)", price: 290, cat: "Fasteners › Nyloc Nuts", stock: 5400, dispatchHours: 24, glyph: "hex", attrs: { thread: "M3", material: "ss304" }, text: "nylock nylon insert self locking nut stainless" },
  { sku: "FS-INS-M3-006-BR", title: "M3 × 6mm Brass Heat-Set Threaded Insert", price: 520, cat: "Fasteners › Brass Heat-Set", stock: 2860, dispatchHours: 24, glyph: "hex", attrs: { thread: "M3", length_mm: 6, material: "brass" }, text: "knurled heat set insert 3d printing brass" },

  { sku: "BR-608-ZZ", title: "608ZZ Deep Groove Ball Bearing (ID 8 · OD 22 · W 7)", price: 1800, bulkPrice: 1200, bulkQty: 100, cat: "Bearings › Deep Groove", stock: 1240, dispatchHours: 24, glyph: "bearing", attrs: { bearing_code: "608", bore_id_mm: 8, outer_od_mm: 22, width_mm: 7, seal_type: "ZZ" }, text: "skate bearing shielded steel" },
  { sku: "BR-608-2RS", title: "608-2RS Deep Groove Ball Bearing, Rubber Sealed", price: 2100, cat: "Bearings › Deep Groove", stock: 880, dispatchHours: 24, glyph: "bearing", attrs: { bearing_code: "608", bore_id_mm: 8, outer_od_mm: 22, width_mm: 7, seal_type: "2RS" }, text: "sealed rubber bearing" },
  { sku: "BR-686-ZZ", title: "686ZZ Miniature Ball Bearing (ID 6 · OD 13 · W 5)", price: 1400, cat: "Bearings › Miniature", stock: 1620, dispatchHours: 24, glyph: "bearing", attrs: { bearing_code: "686", bore_id_mm: 6, outer_od_mm: 13, width_mm: 5, seal_type: "ZZ" }, text: "mini shielded bearing" },
  { sku: "BR-6202-2RS", title: "6202-2RS Deep Groove Ball Bearing (ID 15 · OD 35)", price: 3200, cat: "Bearings › Deep Groove", stock: 460, dispatchHours: 24, glyph: "bearing", attrs: { bearing_code: "6202", bore_id_mm: 15, outer_od_mm: 35, width_mm: 11, seal_type: "2RS" }, text: "sealed bearing" },
  { sku: "BR-LM8UU", title: "LM8UU Linear Ball Bearing, 8mm Shaft", price: 1600, cat: "Bearings › Linear Ball", stock: 2140, dispatchHours: 24, glyph: "bearing", attrs: { bore_id_mm: 8, outer_od_mm: 15 }, text: "linear motion bushing 3d printer rod" },
  { sku: "BR-MGN12H-300", title: "MGN12H Linear Rail + Block, 300mm", price: 189000, cat: "Bearings › Linear Rails", stock: 86, dispatchHours: 48, glyph: "bearing", attrs: { rail_size: "MGN12", length_mm: 300 }, text: "linear guide carriage cnc 3d printer" },

  { sku: "MT-NEMA17-4401", title: "NEMA 17 Stepper Motor 1.8° 40Ncm (17HS4401)", price: 64000, bulkPrice: 52000, bulkQty: 50, cat: "Motors › NEMA 17", stock: 340, dispatchHours: 24, glyph: "rotor", attrs: { nema_size: 17, step_angle: 1.8, voltage_v: 12, torque_ncm: 40 }, text: "stepper motor 3d printer cnc bipolar" },
  { sku: "MT-NEMA17-5401", title: "NEMA 17 Stepper Motor 1.8° 59Ncm (17HS8401)", price: 82000, cat: "Motors › NEMA 17", stock: 180, dispatchHours: 24, glyph: "rotor", attrs: { nema_size: 17, step_angle: 1.8, voltage_v: 12, torque_ncm: 59 }, text: "high torque stepper motor" },
  { sku: "MT-NEMA23-2804", title: "NEMA 23 Stepper Motor 1.8° 1.9Nm", price: 186000, cat: "Motors › NEMA 23", stock: 64, dispatchHours: 48, glyph: "rotor", attrs: { nema_size: 23, step_angle: 1.8, voltage_v: 24 }, text: "stepper motor cnc router" },
  { sku: "MT-A4988", title: "A4988 Stepper Motor Driver Module with Heatsink", price: 9500, bulkPrice: 6800, bulkQty: 100, cat: "Motors › Stepper Drivers", stock: 1860, dispatchHours: 24, glyph: "chip", attrs: { current_a: 2, voltage_v: 35 }, text: "pololu stepper driver ramps 3d printer" },
  { sku: "MT-TMC2209", title: "TMC2209 v2.0 Silent Stepper Driver", price: 24000, cat: "Motors › Stepper Drivers", stock: 640, dispatchHours: 24, glyph: "chip", attrs: { current_a: 2.8, voltage_v: 29 }, text: "silent stealthchop stepper driver" },
  { sku: "MT-2205-2300", title: "2205 Brushless Motor 2300KV (FPV Freestyle)", price: 78000, cat: "Motors › BLDC Outrunner", stock: 220, dispatchHours: 24, glyph: "rotor", attrs: { kv_rating: 2300, motor_size: "2205", voltage_v: 16.8 }, text: "drone bldc brushless outrunner fpv" },
  { sku: "MT-2207-2200", title: "2207 Brushless Motor 2200KV", price: 89000, cat: "Motors › BLDC Outrunner", stock: 140, dispatchHours: 24, glyph: "rotor", attrs: { kv_rating: 2200, motor_size: "2207", voltage_v: 22.2 }, text: "drone bldc brushless outrunner" },
  { sku: "MT-SG90", title: "SG90 Micro Servo 9g, 180°", price: 11000, bulkPrice: 8200, bulkQty: 100, cat: "Motors › Micro Servos", stock: 2400, dispatchHours: 24, glyph: "rotor", attrs: { voltage_v: 5, torque_kgcm: 1.8 }, text: "micro servo hobby rc arduino" },

  { sku: "BT-18650-3000", title: "18650 Li-ion Cell 3000mAh 10A (Samsung 30Q)", price: 38000, bulkPrice: 30000, bulkQty: 100, cat: "Batteries › 18650", stock: 1480, dispatchHours: 24, glyph: "cell", attrs: { cell_format: "18650", capacity_mah: 3000, voltage_v: 3.7, max_discharge_a: 15 }, text: "lithium ion cell battery pack building" },
  { sku: "BT-21700-4000", title: "21700 Li-ion Cell 4000mAh 15A", price: 52000, cat: "Batteries › 21700", stock: 640, dispatchHours: 24, glyph: "cell", attrs: { cell_format: "21700", capacity_mah: 4000, voltage_v: 3.7, max_discharge_a: 15 }, text: "lithium ion cell ev pack" },
  { sku: "BT-LIPO-4S-1500", title: "LiPo Battery 4S 1500mAh 100C, XT60", price: 189000, cat: "Batteries › LiPo Packs", stock: 180, dispatchHours: 48, glyph: "cell", attrs: { cell_config: "4S", capacity_mah: 1500, voltage_v: 14.8, c_rating: 100, connector_type: "XT60" }, text: "drone fpv lipo pack lithium polymer" },
  { sku: "BT-BMS-4S-40A", title: "4S 40A LiFePO4 / Li-ion BMS with Balancing", price: 78000, cat: "Batteries › BMS Boards", stock: 320, dispatchHours: 24, glyph: "chip", attrs: { cell_config: "4S", max_discharge_a: 40 }, text: "battery management protection board balance" },

  { sku: "EC-R0805-10K", title: "10kΩ 1% SMD Resistor 0805 (pack of 100)", price: 6000, cat: "Electronics › Resistors SMD", stock: 860, dispatchHours: 24, glyph: "chip", attrs: { package: "0805", value: "10k", tolerance_pct: 1 }, text: "smd chip resistor surface mount" },
  { sku: "EC-R0603-10K", title: "10kΩ 1% SMD Resistor 0603 (pack of 100)", price: 5500, cat: "Electronics › Resistors SMD", stock: 940, dispatchHours: 24, glyph: "chip", attrs: { package: "0603", value: "10k", tolerance_pct: 1 }, text: "smd chip resistor surface mount" },
  { sku: "EC-C0805-100N", title: "100nF X7R Ceramic Capacitor 0805 50V (pack of 100)", price: 7000, cat: "Electronics › Ceramic Caps", stock: 720, dispatchHours: 24, glyph: "chip", attrs: { package: "0805", value: "100n", voltage_rating_v: 50 }, text: "smd mlcc decoupling capacitor" },
  { sku: "EC-ESP32-WROOM", title: "ESP32 WROOM-32 DevKit V1, WiFi + BLE", price: 38000, bulkPrice: 31000, bulkQty: 50, cat: "Electronics › ESP32", stock: 640, dispatchHours: 24, glyph: "chip", attrs: { interface: "uart", voltage_v: 3.3 }, text: "esp32 wifi bluetooth development board iot" },
  { sku: "EC-ARD-NANO", title: "Arduino Nano V3 Compatible, CH340, Soldered Headers", price: 24000, cat: "Electronics › Arduino", stock: 1120, dispatchHours: 24, glyph: "chip", attrs: { voltage_v: 5 }, text: "arduino nano atmega328 microcontroller board" },
  { sku: "EC-DUPONT-120", title: "Dupont Jumper Wire Set, 120pcs (M-M, M-F, F-F)", price: 19000, cat: "Electronics › Jumper Wires", stock: 1840, dispatchHours: 24, glyph: "chip", attrs: {}, text: "breadboard jumper dupont connecting wires" },
  { sku: "EC-BUCK-XL4015", title: "XL4015 5A Adjustable Buck Converter Module", price: 16000, cat: "Electronics › Buck Converters", stock: 960, dispatchHours: 24, glyph: "chip", attrs: { current_a: 5, voltage_v: 32 }, text: "dc dc step down buck converter module" },

  { sku: "MG-N52-15X3", title: "15 × 3mm Neodymium Disc Magnet N52 (pack of 10)", price: 34000, cat: "Magnets › Neodymium Disc", stock: 640, dispatchHours: 24, glyph: "magnet", attrs: { grade: "N52", dia_mm: 15, thickness_mm: 3, pull_force_kg: 2.4 }, text: "neodymium ndfeb rare earth disc magnet strong" },
  { sku: "MG-N35-15X3", title: "15 × 3mm Neodymium Disc Magnet N35 (pack of 10)", price: 22000, cat: "Magnets › Neodymium Disc", stock: 1240, dispatchHours: 24, glyph: "magnet", attrs: { grade: "N35", dia_mm: 15, thickness_mm: 3, pull_force_kg: 1.7 }, text: "neodymium ndfeb rare earth disc magnet" },
  { sku: "MG-N52-10X2", title: "10 × 2mm Neodymium Disc Magnet N52 (pack of 20)", price: 26000, cat: "Magnets › Neodymium Disc", stock: 880, dispatchHours: 24, glyph: "magnet", attrs: { grade: "N52", dia_mm: 10, thickness_mm: 2, pull_force_kg: 1.1 }, text: "small neodymium disc magnet" },

  { sku: "HW-EXT-2020-1000", title: "2020 V-Slot Aluminium Extrusion, 1000mm, Black", price: 62000, cat: "Hardware › 2020 Profile", stock: 240, dispatchHours: 48, glyph: "extrusion", attrs: { profile_size: "2020", length_mm: 1000, material: "aluminium" }, text: "v slot t slot aluminium profile frame cnc 3d printer" },
  { sku: "HW-EXT-2040-500", title: "2040 V-Slot Aluminium Extrusion, 500mm", price: 48000, cat: "Hardware › 2040 Profile", stock: 180, dispatchHours: 48, glyph: "extrusion", attrs: { profile_size: "2040", length_mm: 500, material: "aluminium" }, text: "v slot aluminium profile" },
  { sku: "HW-GT2-BELT-6", title: "GT2 Timing Belt 6mm, Fibreglass Core (per metre)", price: 9000, cat: "Hardware › Timing Belts", stock: 1420, dispatchHours: 24, glyph: "extrusion", attrs: { pitch: "GT2", width_mm: 6 }, text: "gt2 belt 3d printer cnc timing" },

  { sku: "3D-PLA-1KG-BLK", title: "PLA Filament 1.75mm, 1kg, Matte Black", price: 89000, cat: "3D Printing › PLA", stock: 420, dispatchHours: 24, glyph: "nozzle", attrs: { filament_dia_mm: 1.75, spool_weight_g: 1000, print_temp_c: 210 }, text: "pla filament 3d printing spool" },
  { sku: "3D-NOZ-V6-04", title: "V6 Brass Nozzle 0.4mm (M6 thread)", price: 9000, cat: "3D Printing › Nozzles", stock: 2600, dispatchHours: 24, glyph: "nozzle", attrs: { nozzle_dia_mm: 0.4, material: "brass" }, text: "e3d v6 hotend brass nozzle" },

  { sku: "TL-DMM-DT830", title: "DT830D Digital Multimeter with Probes", price: 26000, cat: "Tools › Multimeters", stock: 640, dispatchHours: 24, glyph: "wrench", attrs: {}, text: "multimeter dmm voltage current resistance tester" },
  { sku: "TL-SOLD-936", title: "936 Soldering Station 60W, Adjustable 200–480°C", price: 118000, cat: "Tools › Soldering Stations", stock: 180, dispatchHours: 24, glyph: "wrench", attrs: { power_w: 60 }, text: "soldering station iron temperature controlled" },
  { sku: "TL-HEX-9PC", title: "9-Piece Hex (Allen) Key Set, 1.5–10mm, CrV", price: 34000, cat: "Tools › Hex Keys", stock: 520, dispatchHours: 24, glyph: "wrench", attrs: { set_piece_count: 9 }, text: "allen key hex wrench set l-key" },
];

/* ============================================================
   Project collections — cross-category curation
   ============================================================ */
export const PROJECTS: Project[] = [
  { slug: "drone", name: "Drone", parts: 340, from: "₹2,100", glyph: "prop", spans: ["Drones", "Motors", "Batteries", "Fasteners", "Electronics"] },
  { slug: "3d-printer", name: "3D Printer", parts: 520, from: "₹8,400", glyph: "nozzle", spans: ["3D Printing", "Motors", "Bearings", "Hardware"] },
  { slug: "robot", name: "Robot", parts: 410, from: "₹1,900", glyph: "rotor", spans: ["Motors", "Electronics", "Batteries", "Hardware"] },
  { slug: "ev", name: "EV", parts: 280, from: "₹14,000", glyph: "hub", spans: ["EV Parts", "Batteries", "Motors", "Hardware"] },
  { slug: "cnc", name: "CNC", parts: 360, from: "₹22,000", glyph: "endmill", spans: ["CNC", "Motors", "Bearings", "Industrial"] },
  { slug: "repair-bench", name: "Repair Bench", parts: 190, from: "₹1,400", glyph: "wrench", spans: ["Tools", "Fasteners", "Electronics"] },
];

/**
 * Written testimonials from customers we do not have yet.
 *
 * These were sitting outside the demo gate, which meant a production build
 * shipped eight invented people vouching for a store that has not sold
 * anything. Invented inventory and invented praise are the same lie; both go
 * behind the same flag.
 */
export const REVIEWS: [string, string][] = CATALOGUE_EMPTY ? [] : [
  ["I needed exactly 4 screws. Four. No dealer would sell me four. OnlyParts did, and they matched the spec exactly.", "Binoy · Fasteners"],
  ["Searched “m3x10 ss304” and it just worked. First result. Every other site sends me to page three of keyword soup.", "Priya · Startup engineer"],
  ["Ordered a stepper, a rail, brass inserts and a spool of PLA in one cart. One shipping fee. That is the whole pitch.", "Rakesh · Maker"],
  ["GST invoice generated instantly with the right HSN. Our accounts team stopped complaining about me.", "Neha · Procurement"],
  ["Bearings were the real deal — no play, correct seals, correct dimensions to the hundredth.", "Anirudh · Drone builder"],
  ["Uploaded a STEP file at 11pm, had a priced quote before lunch the next day. 500 pieces delivered in three weeks.", "Karan · Product lead"],
  ["Bulk pricing is on the product page. I do not have to email anyone to find out what 1000 pieces costs.", "Ramesh · MSME"],
  ["Screws for a Steam Deck repair. Perfect fit and finish, and they arrived in two days to Guwahati.", "Harsh · Repair shop"],
];

/**
 * The `count` on every category is the **planned** SKU target from
 * `02-TAXONOMY.md` §6, not live inventory. Rendering it as though it were live
 * is the "ghost inventory" lie in a different costume, so it is only ever shown
 * through this helper — which returns null when there is no catalogue behind it.
 */
export const skuCountLabel = (planned: number): string | null =>
  CATALOGUE_EMPTY ? null : `${planned.toLocaleString("en-IN")} SKUs`;

/** What to show instead when the catalogue is empty. */
export const COMING_SOON = "Coming soon";

/**
 * A project's part count and entry price are properties of a cart we cannot
 * price until the catalogue exists, so they follow the same rule as the SKU
 * counts rather than being printed as fact.
 */
export const projectStatsLabel = (p: Project): string =>
  CATALOGUE_EMPTY ? "Curating" : `${p.parts} parts · from ${p.from}`;

/**
 * paise → ₹.
 *
 * Under ₹1,000 always shows two decimals so unit prices line up in a break
 * table — `₹3.00` above `₹2.70`, not `₹3`. Above that, paise are noise.
 */
export const inr = (paise: number) => {
  const v = paise / 100;
  const dp = v < 1000 ? 2 : paise % 100 ? 2 : 0;
  return "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp });
};

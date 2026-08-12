# OnlyParts — Category Taxonomy

**Version:** 1.0
**Depth:** exactly 3 levels — `L1 Category → L2 Subcategory → L3 Sub-subcategory`
**Relationship:** products are **many-to-many** with categories. One assignment per product is marked `is_primary` and drives the canonical URL and breadcrumb.

---

## 1. Rules

1. **Three levels, hard stop.** The DB allows a `parent_id` chain, but a check constraint enforces `depth ≤ 3`. Anything that wants a 4th level becomes a *facet*, not a category.
2. **Categories are for navigation. Attributes are for filtering.** "M3" is not a category — it is a value of the `thread` attribute on the *Socket Head Screws* L3 node. If you find yourself creating `Fasteners → Screws → Socket Head → M3`, stop: that is a facet.
3. **Cross-listing is normal, not exceptional.** A NEMA 17 stepper sits under Motors, 3D Printers & Parts, and CNC Machines & Parts. Every listing is a real edge in `product_categories`; only one is primary.
4. **Every L3 node has an attribute schema.** No schema, no node. This is what makes faceting work (see `07-DATA-MODEL.md` §4).
5. **Slugs are globally unique and immutable.** URL = `/c/{l1}/{l2}/{l3}`. Renaming a display name never changes a slug; a slug change requires a 301 in `category_redirects`.
6. **Leaf-only products.** Products attach to L3 nodes (or to an L2 node that has no children). Never to L1.

## 2. URL and canonical strategy

```
/c/fasteners                                   L1 landing
/c/fasteners/screws                            L2 landing
/c/fasteners/screws/socket-head-cap-screws     L3 PLP  ← facetable
/c/fasteners/screws/socket-head-cap-screws?thread=M3&material=ss304&length=10
/p/{product-slug}                              PDP — flat, category-independent
/projects/drone-build                          curated cross-category page
```

A product's PDP URL never contains a category, so cross-listing creates zero duplicate-content risk. Breadcrumbs on the PDP are rendered from the **primary** assignment; if the user arrived from a non-primary category the breadcrumb reflects the *navigation path* in the UI but the JSON-LD `BreadcrumbList` always uses the primary.

---

## 3. The tree

### L1-01 · Fasteners
*Seeded from the first two rows of the OnlyScrews category grid, then extended.*

| L2 | L3 |
|---|---|
| **Screws — by Drive** | Flat / Slotted · Cross / Phillips · Hex / Allen (Socket) · Combination (Slotted+Phillips) · Star / Torx · Pozidriv · Square / Robertson · Security & Tamper-proof |
| **Screws — by Head** | Pan Head · Countersunk (CSK) · Button Head · Socket Head Cap · Cheese Head · Round Head · Flange Head · Truss Head · Oval Head |
| **Bolts** | Hex Bolts · Carriage Bolts · Eye Bolts · U-Bolts · Foundation / Anchor Bolts · Shoulder Bolts · Flange Bolts · T-Bolts |
| **Nuts** | Hex Nuts · Nyloc / Nylon Insert · Wing Nuts · Flange Nuts · T-Nuts / Tee Nuts · Square Nuts · Dome / Cap Nuts · Coupling Nuts · Weld Nuts |
| **Washers** | Flat / Plain · Spring / Split Lock · Star / Tooth Lock · Fender · Belleville · Nylon / Insulating · Shim Washers |
| **Grub Screws & Set Screws** | Cup Point · Flat Point · Cone Point · Dog Point |
| **Threaded Inserts** | Brass Heat-Set (3D Printing) · Knurled Press-Fit · Helicoil / Wire Thread · Rivet Nuts (Rivnuts) · Wood Inserts |
| **Spacers & Standoffs** | Brass Standoffs (M/F) · Nylon Standoffs · Aluminium Standoffs · PCB Spacers · Shoulder Spacers |
| **Rivets & Pins** | Blind / Pop Rivets · Dowel Pins · Cotter Pins · Split Pins · Clevis Pins · Roll / Spring Pins · Circlips & Retaining Rings |
| **Self-Tapping & Wood Screws** | Wood Screws · Self-Drilling · Drywall · Chipboard · Roofing Screws |
| **Threaded Rods & Studs** | Fully Threaded Rod · Lead Screws (Trapezoidal) · Studs · Turnbuckles |
| **Micro & Precision Screws** | Laptop & Mobile Screws · Drone Screws · Optical / Eyewear · Watch Screws |
| **Anchors & Clamps** | Wall Plugs · Sleeve Anchors · Hose Clamps · P-Clips · Cable Zip Ties |
| **Assorted Kits** | Fastener Assortment Boxes · 3D Printing Kits · Drone Kits · Laptop Repair Kits |

**Key attributes:** `thread` (M1–M24, #4–#12, BSW, UNC/UNF), `length_mm`, `head_type`, `drive_type`, `material` (SS304, SS316, MS Zinc, Brass, Alloy 12.9, Nylon, Titanium), `grade`, `finish`, `pitch`, `pack_qty`.

---

### L1-02 · Motors

| L2 | L3 |
|---|---|
| **BLDC Motors** | Outrunner · Inrunner · Gimbal · Ducted Fan · Sensored BLDC |
| **Stepper Motors** | NEMA 8 · NEMA 11 · NEMA 14 · NEMA 17 · NEMA 23 · NEMA 34 · Linear Steppers · Geared Steppers |
| **Servo Motors** | Micro Servos (SG90 class) · Standard Hobby Servos · Digital High-Torque · Continuous Rotation · Industrial AC Servo · Servo Accessories & Horns |
| **DC Motors** | Brushed DC · Geared DC (BO / TT) · Planetary Gear · Worm Gear · Encoder Motors · Coreless / Vibration |
| **AC Motors** | Single Phase Induction · Three Phase Induction · Synchronous · Gear Motors |
| **Motor Drivers & Controllers** | Stepper Drivers (A4988/DRV8825/TMC) · DC Motor Drivers (L298/BTS) · BLDC ESCs · Servo Controllers · VFDs (→ also Industrial Electricals) |
| **Motor Accessories** | Motor Mounts & Brackets · Shaft Couplers · Pulleys & Belts · Encoders · Cooling Fans |
| **Linear Actuators** | Electric Linear Actuators · Linear Stepper Stages · Servo Linear |

**Key attributes:** `kv_rating`, `voltage_v`, `current_a`, `torque_kgcm` / `Nm`, `rpm`, `shaft_dia_mm`, `step_angle`, `frame_size`, `phases`, `holding_torque`.

---

### L1-03 · Electronic Components
*Largest tree. Detailed sub-subs to be finalised with the team — this is the working structure.*

| L2 | L3 |
|---|---|
| **Passive Components** | Resistors (Through-hole) · Resistors (SMD) · Resistor Networks & Arrays · Potentiometers & Trimmers · Ceramic Capacitors · Electrolytic Capacitors · Film / Tantalum Capacitors · Supercapacitors · Inductors & Chokes · Ferrite Beads · Crystals & Oscillators · Transformers |
| **Semiconductors** | Diodes (Rectifier/Schottky/Zener) · LEDs (Discrete) · Transistors (BJT) · MOSFETs · IGBTs · Thyristors / TRIACs / SCRs · Optocouplers · Voltage Regulators (Linear) · Voltage Regulators (Switching) |
| **Integrated Circuits** | Microcontrollers (ICs) · Op-Amps & Comparators · Logic ICs (74xx/CD4xxx) · Timers & Counters · ADC / DAC · Motor Driver ICs · Memory (EEPROM/Flash/SRAM) · Interface & Level Shifters · Audio ICs · Power Management ICs |
| **Development Boards** | Arduino & Compatible · ESP32 / ESP8266 · Raspberry Pi & HATs · STM32 / ARM · Nordic / BLE · FPGA Boards · Single Board Computers · Dev Board Accessories |
| **Sensors** | Temperature & Humidity · Distance & Proximity (IR/Ultrasonic/ToF) · IMU / Gyro / Accelerometer · Pressure & Altitude · Gas & Air Quality · Light & Colour · Current & Voltage · Load Cells & Force · Hall Effect & Magnetic · Flow & Level · Biometric (Fingerprint/Pulse) · Vibration & Sound |
| **Displays & Indicators** | OLED Displays · LCD (Character) · TFT / Graphic LCD · E-Paper · 7-Segment · LED Matrix · Touch Panels · Buzzers & Indicators |
| **Wireless & Communication** | WiFi Modules · Bluetooth / BLE · LoRa & LoRaWAN · GSM / GPRS / LTE · GPS / GNSS · RF Transceivers (nRF/433 MHz) · Zigbee · RFID / NFC · Ethernet & CAN |
| **Connectors & Cables** | JST Connectors · Dupont / Jumper Wires · XT / Bullet (Power) · Terminal Blocks & Screw Terminals · Headers & Sockets · USB & Type-C · Molex · D-Sub · RF (SMA/UFL) · Ribbon & FFC/FPC · Wire & Cable (by AWG) · Heat Shrink & Sleeving |
| **Switches & Relays** | Tactile / Push Buttons · Toggle & Rocker · Slide & DIP · Rotary & Encoders · Limit & Micro Switches · Electromechanical Relays · Solid State Relays (SSR) · Reed Switches |
| **Power Supplies** | Buck Converters · Boost Converters · Buck-Boost · SMPS Modules · AC-DC Adapters · Bench Power Supplies · DC-DC Isolated · LDO Modules |
| **PCB & Prototyping** | Breadboards · Perfboard & Zero PCB · PCB Blanks & Copper Clad · Etching Supplies · IC Sockets · Standoffs & PCB Hardware · Jumper Kits |
| **LEDs & Lighting** | Addressable LED Strips (WS2812/SK6812) · Analog LED Strips · High Power LEDs · LED Drivers · LED Modules & Panels · Neopixel Rings/Matrices |
| **Audio** | Speakers · Microphones · Amplifier Modules · Audio Codecs · Piezo Elements |
| **Component Kits** | Resistor Kits · Capacitor Kits · Semiconductor Assortments · Starter Kits · Sensor Kits |

**Key attributes:** `package` (0402/0603/0805/DIP-8/SOIC-8/TO-220…), `value`, `tolerance_pct`, `voltage_rating_v`, `power_rating_w`, `interface` (I2C/SPI/UART/CAN), `mounting` (THT/SMD), `pin_count`, `pitch_mm`, `manufacturer`, `mpn`.

---

### L1-04 · Batteries & Power

| L2 | L3 |
|---|---|
| **Lithium Cells** | 18650 Cells · 21700 Cells · 26650 Cells · LiPo Pouch Cells · LiFePO4 Cells · Coin / Button Cells |
| **Battery Packs** | LiPo Packs (RC/Drone) · Li-ion Packs · LiFePO4 Packs · Power Tool Packs · Custom Pack Assembly |
| **Battery Management** | BMS Boards (2S–24S) · Balance Chargers · Protection Circuits (PCM) · Cell Balancers · Battery Monitors & Coulomb Counters |
| **Chargers** | LiPo Balance Chargers · Li-ion Chargers · Lead Acid Chargers · Solar Charge Controllers · USB-C PD Chargers · Fast Chargers (EV) |
| **Other Chemistries** | Lead Acid / SMF · NiMH / NiCd · Alkaline · Supercapacitor Modules |
| **Pack Building Supplies** | Nickel Strip · Cell Holders & Spacers · Spot Welders · Busbars · Fish Paper & Insulation · Battery Cable & Lugs |
| **Power Conversion** | Inverters · UPS Modules · DC-DC Converters (High Power) · Isolation Transformers |
| **Solar** | Solar Panels · MPPT Controllers · Solar Inverters · Mounting Hardware |

**Key attributes:** `chemistry`, `nominal_voltage_v`, `capacity_mah` / `Ah`, `c_rating`, `max_discharge_a`, `cell_config` (3S1P…), `connector_type`, `dimensions_mm`, `cycle_life`.

---

### L1-05 · 3D Printers & Parts

| L2 | L3 |
|---|---|
| **3D Printers** | FDM Printers · Resin / SLA-MSLA Printers · Large Format · Printer Kits |
| **Filament** | PLA · PLA+ / Silk / Matte · ABS · PETG · TPU / Flexible · Nylon (PA) · Carbon / Glass Filled · ASA · PVA / HIPS (Support) · Specialty (Wood/Metal-fill) |
| **Resin** | Standard Resin · Tough / ABS-like · Flexible Resin · Castable · Water-Washable |
| **Hotends & Extruders** | Hotend Assemblies (V6/Volcano/Dragon) · Nozzles (Brass/Hardened/Ruby) · Heat Breaks · Heater Cartridges · Thermistors & Thermocouples · Extruder Gears & Drives · PTFE / Bowden Tube |
| **Motion Components** | Linear Rails (MGN) · Linear Rods & Bearings (LM) · Lead Screws & Nuts · GT2 Belts · Pulleys & Idlers · Couplers · Bed Springs & Levelling |
| **Electronics** | Control Boards (SKR/Duet/MKS) · Stepper Drivers · Display Modules · Bed Levelling Probes (BLTouch/Inductive) · Endstops · Cooling Fans · Wiring Harnesses |
| **Build Surfaces** | PEI Sheets · Glass Beds · Magnetic Flex Plates · Build Tak / Adhesion · Heated Beds |
| **Post-Processing** | Deburring & Finishing Tools · Wash & Cure Stations · IPA & Chemicals · Sanding & Polishing · Support Removal Tools |
| **Printer Hardware** | Aluminium Extrusion · Corner Brackets · Printer Fasteners · Enclosures · Filament Dryers & Storage |

**Key attributes:** `filament_dia_mm` (1.75/2.85), `nozzle_dia_mm`, `print_temp_c`, `bed_temp_c`, `spool_weight_g`, `colour`, `build_volume_mm`, `rail_size`.

---

### L1-06 · Drones & Parts

| L2 | L3 |
|---|---|
| **Ready-to-Fly Drones** | FPV Racing · Cinematic · Toy / Trainer · Agricultural · Survey / Mapping |
| **Frames** | Freestyle Frames · Racing Frames · Cinewhoop / Ducted · Long Range · Micro / Whoop · Frame Spares (Arms/Plates) |
| **Flight Controllers** | FC Boards · AIO (FC+ESC) · Stack Combos · Flight Controller Accessories |
| **ESCs** | 4-in-1 ESCs · Single ESCs · High Current / Industrial ESCs |
| **Motors (Drone)** | 1103–1404 (Micro) · 2004–2306 (Freestyle) · 2506+ (Long Range/Cine) · Agri / Heavy Lift Motors |
| **Propellers** | 2"–3" · 4"–5" · 6"–7" · 8"+ · Folding Props · Prop Guards |
| **FPV System** | FPV Cameras · Video Transmitters (VTX) · Antennas · Goggles & Receivers · Digital HD Systems · DVR & Accessories |
| **Radio & Control** | Transmitters (TX) · Receivers (RX) · Telemetry · Gimbal Sticks & Mods |
| **Payload & Gimbals** | Camera Gimbals · Sprayer Systems · Release Mechanisms · Payload Mounts |
| **Drone Batteries** | LiPo (Drone) · Li-ion Packs (Long Range) · Chargers & Adapters |
| **Drone Hardware** | Drone Screws · Standoffs · Vibration Dampers · Landing Gear · Zip Ties & Straps |
| **Ground Support** | Battery Cases · Field Chargers · Tool Kits · Carry Cases |

**Key attributes:** `frame_size_mm`, `prop_size_in`, `motor_size`, `kv_rating`, `esc_current_a`, `vtx_power_mw`, `protocol`, `mounting_pattern` (20×20/30.5×30.5).

---

### L1-07 · Tools

| L2 | L3 |
|---|---|
| **Hand Tools** | Screwdrivers & Sets · Precision Screwdrivers · Hex / Allen Keys · Torx Keys · Spanners & Wrenches · Socket Sets · Pliers · Cutters & Nippers · Hammers & Mallets · Files & Rasps · Vices & Clamps |
| **Power Tools** | Cordless Drills · Impact Drivers · Angle Grinders · Rotary Tools (Dremel-class) · Jigsaws & Circular Saws · Heat Guns · Bench Grinders · Power Tool Batteries & Chargers |
| **Soldering & Rework** | Soldering Irons · Soldering Stations · Hot Air Rework · Solder Wire & Paste · Flux · Desoldering Tools · Soldering Tips · Fume Extractors · PCB Holders |
| **Measuring & Test** | Digital Multimeters · Oscilloscopes · Vernier Callipers · Micrometers · Steel Rules & Tapes · Dial Gauges · Thread & Feeler Gauges · Bench Power Supplies · LCR Meters · Thermal Cameras · Logic Analysers |
| **Cutting & Drilling** | Drill Bits (HSS/Cobalt/Carbide) · Step Drills · Taps & Dies · Hole Saws · End Mills · Reamers · Countersinks |
| **Abrasives & Finishing** | Sandpaper & Sheets · Cutting Discs · Grinding Wheels · Flap Discs · Wire Brushes · Polishing Compounds |
| **Adhesives & Chemicals** | Cyanoacrylate / Super Glue · Epoxy · Threadlockers (Loctite class) · Silicone & Sealants · Lubricants & Greases · Contact Cleaner · Thermal Paste & Pads · Spray Paints |
| **Tapes & Consumables** | Kapton Tape · Electrical / PVC Tape · Double-Sided VHB · Masking Tape · Duct Tape · Heat Shrink Kits |
| **Storage & Organisation** | Component Storage Boxes · Tool Boxes & Bags · Parts Bins & Racks · ESD Trays · Anti-Static Bags |
| **Safety Equipment** | Safety Glasses · Gloves (Nitrile/Cut-resistant) · Dust Masks & Respirators · Ear Protection · ESD Wrist Straps & Mats · Face Shields · Fire Blankets |
| **Workshop Equipment** | Workbenches · Bench Vices · Magnifiers & Illuminated Lamps · Microscopes · 3rd Hand / Helping Hands |

**Key attributes:** `drive_size`, `size_mm`, `voltage_v`, `power_w`, `tip_type`, `accuracy`, `range`, `brand`, `set_piece_count`.

---

### L1-08 · Bearings

| L2 | L3 |
|---|---|
| **Ball Bearings** | Deep Groove (6xxx/62xx/63xx) · Miniature (68xx/69xx/MR) · Angular Contact · Self-Aligning · Thrust Ball · Flanged (F6xx/MF) |
| **Roller Bearings** | Cylindrical Roller · Tapered Roller · Needle Roller · Spherical Roller · Thrust Roller |
| **Linear Motion** | Linear Ball Bearings (LM/LMK/LMU) · Linear Rails & Blocks (MGN/HGR) · Linear Bushings · Linear Shafts |
| **Plain Bearings & Bushings** | Bronze Bushings · Oilite / Sintered · PTFE-Lined · Nylon / Plastic · Flanged Bushings |
| **Mounted Units** | Pillow Blocks (UCP) · Flange Units (UCF/UCFL) · Take-up Units · Cartridge Units |
| **Special Bearings** | Rod Ends / Heim Joints · Spherical Plain · Ceramic & Hybrid · Stainless Bearings · One-Way / Clutch Bearings · Turntable / Slewing |
| **Bearing Accessories** | Circlips & Retainers · Seals & Shields · Bearing Pullers · Grease & Lubricants · Shaft Collars |

**Key attributes:** `bore_id_mm`, `outer_od_mm`, `width_mm`, `seal_type` (ZZ/2RS/Open), `material`, `dynamic_load_c`, `max_rpm`, `precision_class` (ABEC).

---

### L1-09 · Magnets

| L2 | L3 |
|---|---|
| **Neodymium (NdFeB)** | Disc Magnets · Block / Cube Magnets · Ring Magnets · Cylinder / Rod Magnets · Countersunk Magnets · Arc / Segment Magnets · Sphere Magnets |
| **Other Materials** | Ferrite / Ceramic · Samarium Cobalt (SmCo) · Alnico · Flexible / Rubber Magnets |
| **Magnetic Assemblies** | Pot Magnets · Hook Magnets · Magnetic Catches · Mounting Magnets · Magnetic Separators |
| **Magnetic Sheet & Tape** | Magnetic Sheets · Magnetic Tape (Adhesive) · Whiteboard / Receptive Sheet |
| **Electromagnets** | Holding Electromagnets · Solenoids · Electromagnetic Locks |
| **Magnet Accessories** | Magnet Viewers · Keepers · Gauss Meters · Handling Tools |

**Key attributes:** `grade` (N35–N52), `shape`, `dia_mm`, `thickness_mm`, `pull_force_kg`, `magnetisation_direction`, `coating` (NiCuNi/Epoxy/Gold), `max_temp_c`.

---

### L1-10 · CNC Machines & Parts

| L2 | L3 |
|---|---|
| **CNC Machines** | Desktop CNC Routers · Industrial Routers · CNC Mills · CNC Lathes · Laser Cutters & Engravers · Plasma Cutters · Machine Kits |
| **Spindles & Drives** | Air-Cooled Spindles · Water-Cooled Spindles · Spindle VFDs · Spindle Mounts · Router Motors · Collets & Nuts (ER11/ER16/ER20) |
| **Motion System** | Ball Screws & Nuts · Linear Guides & Rails · Rack & Pinion · Lead Screws · Bearing Blocks (BK/BF) · Shaft Supports · Couplers |
| **Control Electronics** | CNC Controllers (Mach3/GRBL/LinuxCNC) · Breakout Boards · Stepper & Servo Drivers · Handwheels & Pendants · Limit Switches · E-Stop & Safety Relays |
| **Cutting Tools** | End Mills (Flat/Ball/Corner) · V-Bits & Engraving · Router Bits · Drill Bits (Machine) · Insert Tooling · Thread Mills · Chamfer Tools |
| **Workholding** | Vices · Clamp Kits · T-Slot Hardware · Vacuum Tables · Fixture Plates · Soft Jaws · Rotary Tables & 4th Axis |
| **Coolant & Chips** | Mist Systems · Coolant Pumps · Cutting Fluids · Chip Trays & Brushes · Air Blast |
| **Laser Parts** | Laser Tubes & Diodes · Lenses & Mirrors · Laser Power Supplies · Air Assist · Honeycomb Beds |
| **Machine Frames** | Aluminium Extrusion (Heavy) · Gantry Plates · Machine Feet · Cable Chains & Drag Chains · Bellows & Way Covers |

**Key attributes:** `travel_xyz_mm`, `spindle_power_kw`, `collet_size`, `shank_dia_mm`, `flutes`, `coating` (TiAlN/AlTiN), `rail_size`, `ballscrew_lead`.

---

### L1-11 · Industrial Electricals

| L2 | L3 |
|---|---|
| **Switchgear & Protection** | MCBs · MCCBs · RCCBs / RCBOs · Fuses & Fuse Holders · Isolators · Surge Protection (SPD) · Overload Relays |
| **Contactors & Starters** | Power Contactors · Auxiliary Contactors · DOL Starters · Star-Delta Starters · Soft Starters · Reversing Starters |
| **Drives & Automation** | VFDs / AC Drives · Servo Drives · PLCs · HMIs · I/O Modules · SCADA Gateways · Industrial Relays |
| **Industrial Sensors** | Proximity Sensors (Inductive/Capacitive) · Photoelectric Sensors · Limit Switches (Industrial) · Encoders (Industrial) · Level Sensors · Temperature Controllers & PT100/Thermocouples · Pressure Transmitters |
| **Panel Components** | DIN Rail · Cable Ducting / Trunking · Terminal Blocks (DIN) · Push Buttons & Pilot Lights · Selector Switches · Emergency Stops · Panel Meters · Enclosures & Cabinets · Panel Fans & Filters |
| **Power Distribution** | Busbars · Distribution Boards · Cable Lugs & Glands · Industrial Cable · Cable Trays · Earthing & Lightning |
| **Transformers & Supplies** | Control Transformers · Isolation Transformers · DIN Rail SMPS · Servo Stabilisers · Rectifiers |
| **Motors & Pumps (Industrial)** | Three Phase Motors · Gear Boxes · Pumps · Blowers |
| **Industrial Connectors** | M8 / M12 Sensor Connectors · Heavy Duty (Harting-class) · Aviation Connectors · Cable Assemblies |

**Key attributes:** `rated_current_a`, `rated_voltage_v`, `poles`, `breaking_capacity_ka`, `ip_rating`, `mounting` (DIN/Panel), `protocol` (Modbus/Profibus), `frame_size`.

---

### L1-12 · Electric Vehicle Parts

| L2 | L3 |
|---|---|
| **Traction Motors** | Hub Motors (Front/Rear) · Mid-Drive Motors · BLDC EV Motors · PMSM Motors · Motor Mounts & Adapters |
| **Controllers** | BLDC Controllers · FOC / Sine Wave Controllers · Programmable Controllers · Throttle & Brake Sensors · Display / Instrument Clusters |
| **EV Batteries** | EV Battery Packs · EV BMS · Battery Boxes & Enclosures · Cell Modules · Battery Cables & Connectors (Anderson/XT) |
| **Charging** | On-board Chargers · AC Charging Points · Charging Guns & Sockets · DC Fast Charge Modules · Charge Controllers |
| **Drivetrain** | Chains & Sprockets · Belt Drives · Freewheels · Gearboxes · Differentials |
| **Chassis & Running Gear** | Wheels & Rims · Tyres & Tubes · Suspension & Forks · Brakes (Disc/Drum) · Brake Levers & Cables · Steering & Handlebars |
| **EV Electricals** | DC-DC Converters (72V→12V) · Contactors & Relays (EV) · Fuses & Breakers (EV) · Wiring Harnesses · Lighting & Horns · Ignition & Key Switches |
| **Conversion Kits** | E-Bike Conversion Kits · E-Scooter Kits · E-Rickshaw Kits · Go-Kart / Buggy Kits |
| **Telematics** | GPS Trackers · IoT / CAN Loggers · Immobilisers |

**Key attributes:** `system_voltage_v` (24/36/48/60/72), `power_w`, `rated_current_a`, `wheel_size_in`, `connector_type`, `ip_rating`, `motor_type`.

---

### L1-13 · Hardware

| L2 | L3 |
|---|---|
| **Aluminium Extrusion** | 2020 Profile · 3030 Profile · 4040 Profile · 2040 / 4080 & Custom · Corner Brackets · T-Nuts & Connectors · End Caps · Extrusion Accessories |
| **Brackets & Mounts** | L Brackets · Corner Braces · Angle Brackets · Mounting Plates · Panel Mounts · VESA & Equipment Mounts |
| **Shafts & Couplings** | Precision Shafts · Shaft Collars · Rigid Couplings · Flexible / Jaw Couplings · Universal Joints · Keys & Keyways |
| **Power Transmission** | Timing Belts & Pulleys · V-Belts · Chains & Sprockets · Gears (Spur/Bevel/Worm) · Gear Racks · Tensioners |
| **Springs** | Compression Springs · Extension Springs · Torsion Springs · Constant Force · Spring Assortments |
| **Seals & Gaskets** | O-Rings · Oil Seals · Gasket Sheet · Washers (Sealing) · Grommets |
| **Handles & Latches** | Pull Handles · Knobs · Cam Locks · Toggle Latches · Draw Latches · Hinges · Gas Struts |
| **Casters & Feet** | Swivel Casters · Fixed Casters · Levelling Feet · Anti-Vibration Mounts · Rubber Feet |
| **Sheet, Rod & Raw Stock** | Aluminium Sheet & Plate · Steel Sheet · Acrylic / Polycarbonate Sheet · Delrin / Nylon Stock · Carbon Fibre Sheet & Tube · Brass & Copper Stock · Wood & Ply |
| **Enclosures** | ABS Project Boxes · Die-Cast Aluminium · DIN Rail Enclosures · Waterproof (IP65+) · Rack Enclosures |
| **Pipe & Fittings** | Pneumatic Fittings · Push-Fit Connectors · Hoses & Tubing · Valves · Compression Fittings |
| **Wire Management** | Cable Glands · Cable Chains · Spiral Wrap · Cable Ties & Mounts · Conduit |

**Key attributes:** `profile_size`, `length_mm`, `material`, `thickness_mm`, `bore_mm`, `od_mm`, `pitch`, `teeth`, `load_rating_kg`, `ip_rating`.

---

## 4. Cross-listing map

The many-to-many model is not an edge case — it is how the store is merchandised. Representative overlaps:

| Product family | Primary category | Also listed under |
|---|---|---|
| NEMA 17 stepper | Motors → Stepper → NEMA 17 | 3D Printers → Electronics · CNC → Control Electronics |
| A4988 driver | Motors → Motor Drivers | 3D Printers → Electronics · CNC → Control Electronics · Electronic Components → ICs |
| 608ZZ bearing | Bearings → Ball → Deep Groove | 3D Printers → Motion · Hardware → Power Transmission · CNC → Motion |
| LiPo 4S 1500 mAh | Batteries → Packs → LiPo | Drones → Drone Batteries |
| Neodymium disc 15×3 | Magnets → Neodymium → Disc | Motors (rotor building) · Hardware → Handles & Latches |
| M3×10 SS304 socket head | Fasteners → Screws by Head → Socket Head Cap | 3D Printers → Printer Hardware · Drones → Drone Hardware |
| 2020 extrusion | Hardware → Extrusion → 2020 | 3D Printers → Printer Hardware · CNC → Machine Frames |
| MGN12 rail + block | Bearings → Linear Motion | 3D Printers → Motion · CNC → Motion System |
| VFD 2.2 kW | Industrial Electricals → Drives | CNC → Spindles & Drives · Motors → Drivers |
| BLDC hub motor | EV Parts → Traction Motors | Motors → BLDC |
| ER11 collet set | CNC → Spindles & Drives | Tools → Cutting & Drilling |
| 18650 cell | Batteries → Lithium Cells | EV Parts → EV Batteries |
| Kapton tape | Tools → Tapes | 3D Printers → Build Surfaces · Electronic Components → Prototyping |
| Soldering station | Tools → Soldering | Electronic Components → Prototyping |

**Rule of thumb for ops:** if a buyer in category X would reasonably expect to find the part while shopping X, list it in X. Cross-listing costs nothing and is the main defence against the "I had to visit 4 sites" problem.

## 5. Project collections (cross-cutting, non-hierarchical)

Curated, hand-merchandised sets that cut across the tree. These are `collections`, not categories — separate table, separate URL space, no effect on canonicals.

| Collection | Pulls from |
|---|---|
| Build a Drone | Drones, Motors, Batteries, Fasteners, Electronic Components |
| Build a 3D Printer | 3D Printers, Motors, Bearings, Hardware, Electronic Components |
| Build a Robot | Motors, Electronic Components, Batteries, Hardware, Tools |
| Build an EV | EV Parts, Batteries, Motors, Hardware |
| Build a CNC | CNC, Motors, Bearings, Hardware, Industrial Electricals |
| Repair Bench Starter | Tools, Fasteners, Electronic Components |
| Laptop & Phone Repair | Fasteners (micro), Tools, Electronic Components |
| Home Automation | Electronic Components, Industrial Electricals, Tools |

Also merchandise by **audience**: Student · Hobbyist · Startup · MSME · Institution (ATL labs / colleges are a real Indian segment Robu monetises well).

## 6. Seeding plan

| Wave | Categories | Target SKUs | Why first |
|---|---|---|---|
| 1 | Fasteners, Bearings, Magnets, Hardware | 4,000 | Highest attribute density → proves the search thesis; cheapest inventory; OnlyScrews' proven demand |
| 2 | Electronic Components, Motors | 3,500 | Highest search volume; Robu's core |
| 3 | 3D Printers, Drones, Batteries | 2,000 | Highest AOV hobby segments |
| 4 | Tools, CNC, Industrial Electricals, EV Parts | 2,500 | Long tail, mostly made-to-order/dropship |

**12,000 excellent SKUs at launch beats 40,000 mediocre ones.** Every SKU in wave 1 must have: complete attributes, real photographs at 3 angles with scale reference, and price breaks. That standard is the launch gate.

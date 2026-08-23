/**
 * Static content — policies, guides and project collections.
 *
 * Lives in code for now so every page in the sitemap is real and reviewable.
 * When the backend lands these become Payload collections (`content` module,
 * docs/06 §2); the shape is already collection-flavoured so the migration is a
 * data move, not a rewrite.
 */

export type Section = { heading?: string; body: string[] };

export type Policy = {
  slug: string;
  title: string;
  summary: string;
  updated: string;
  sections: Section[];
};

/* ============================================================
   Policies & information pages
   ============================================================ */
export const POLICIES: Policy[] = [
  {
    slug: "shipping",
    title: "Shipping & delivery",
    summary: "What we promise, what it costs, and what happens when we miss.",
    updated: "31 July 2026",
    sections: [
      {
        heading: "Dispatch times",
        body: [
          "In-stock items ordered before 4:00 PM IST on a working day dispatch the same day. Orders after that cut-off dispatch the next working day.",
          "Made-to-order items show their lead time on the product page before you add them to the cart. That number is the working days before dispatch, not including transit.",
          "If a line in your order is delayed we tell you — by email and WhatsApp — with a new date, on the day we know. You should never have to ask us where your order is.",
        ],
      },
      {
        heading: "Charges",
        body: [
          "Shipping is ₹79 flat, and free on orders over ₹999. The threshold is calculated on the order value including GST, and the cart shows exactly how much more you need to add.",
          "We do not charge separate handling, packing or fuel surcharges. The number in the cart is the number you pay.",
        ],
      },
      {
        heading: "Transit times",
        body: [
          "Metro cities: 2–3 working days. Tier-2 cities: 3–5. Rest of India: 4–7. North-east, Kashmir and island territories: 6–10.",
          "Every order ships with a tracking number, sent the moment the courier scans it.",
        ],
      },
      {
        heading: "Packaging",
        body: [
          "Small parts ship in labelled zip bags inside a rigid box. Every bag carries the SKU, so a 14-line order arrives sorted rather than as a pile you have to identify.",
          "Static-sensitive components ship in anti-static bags. Batteries ship in accordance with courier dangerous-goods rules, which occasionally restricts them to surface transport.",
        ],
      },
    ],
  },
  {
    slug: "returns",
    title: "Returns & refunds",
    summary: "Seven days, no unboxing video required.",
    updated: "31 July 2026",
    sections: [
      {
        heading: "The short version",
        body: [
          "If we sent the wrong item, a damaged item, or an item that does not match its description, we pay the return shipping and refund you in full. No video, no photographs of the packaging, no argument.",
          "If you ordered the wrong thing, you can return unopened, unused items within 7 days of delivery. You pay the return shipping; we refund the rest in full.",
        ],
      },
      {
        heading: "What we will not take back",
        body: [
          "Opened static-sensitive components, once the anti-static bag is broken. Cut-to-length items such as wire, extrusion and belt. Custom-manufactured parts from Make-on-Demand, which are made to your drawing.",
          "These are the only exclusions. We do not use restocking fees.",
        ],
      },
      {
        heading: "How refunds are paid",
        body: [
          "Refunds go back to the original payment method, always. We will not push you towards store credit, and store credit is never the only option offered.",
          "Refunds are initiated within 2 working days of the return being received, and typically reach your account within 5–7 working days depending on your bank.",
        ],
      },
      {
        heading: "How to start one",
        body: [
          "Open the order in your account and choose Return. Tell us which lines and why. We arrange a pickup where the courier serves your pincode, and send a prepaid label where it does not.",
        ],
      },
    ],
  },
  {
    slug: "gst-invoices",
    title: "GST invoices",
    summary: "Every order, automatically, with correct HSN codes.",
    updated: "31 July 2026",
    sections: [
      {
        heading: "What you get",
        body: [
          "A GST-compliant tax invoice is generated for every order and attached to your confirmation email. It is also available from your account at any time.",
          "Each line shows its HSN code, taxable value and the tax split. Prices on the site are inclusive of GST, so the invoice back-computes the taxable value at the applicable rate.",
        ],
      },
      {
        heading: "Claiming input credit",
        body: [
          "Add your GSTIN at checkout, or save it once in your account and it will be applied to every future invoice automatically.",
          "The tax split follows the place of supply, which is your delivery state. Delivery within Karnataka is an intra-state supply and shows CGST and SGST. Delivery anywhere else is inter-state and shows IGST.",
          "If your GSTIN is registered in a different state from your delivery address we flag it at checkout, because input credit is claimed against the place of supply and the mismatch is usually unintentional.",
        ],
      },
      {
        heading: "Invoice numbering",
        body: [
          "Invoice numbers are a gapless sequence per financial year, in the format OP/2026-27/000001. Gaps are what GST audits look for, so there are none.",
        ],
      },
      {
        heading: "Corrections",
        body: [
          "If an invoice has the wrong GSTIN or address, contact us within the same financial year and we will issue a corrected invoice or a credit note as appropriate.",
        ],
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy policy",
    summary: "What we collect, why, and how to get it back or deleted.",
    updated: "31 July 2026",
    sections: [
      {
        heading: "Who we are",
        body: [
          "OnlyParts Retail Pvt Ltd is the Data Fiduciary for personal data processed through this site, under India's Digital Personal Data Protection Act 2023.",
          "Our Grievance Officer can be reached at privacy@onlyparts.in and will respond within 30 days.",
        ],
      },
      {
        heading: "What we collect and why",
        body: [
          "To fulfil an order: your name, delivery address and phone number. We cannot ship without these.",
          "To invoice you: your email, and your GSTIN if you provide one.",
          "To improve the site: a count of how often each page is viewed. That count is the whole of it — no cookie, no visitor identifier, no session, no IP address, no third-party analytics service. There is nothing in it to connect a page to a person, which is why there is nothing here for you to decline and no consent banner asking you to.",
          "We do not collect date of birth, gender or demographic information, because we have no use for it. Data we do not hold cannot be leaked.",
        ],
      },
      {
        heading: "What we never see",
        body: [
          "Card numbers, UPI PINs and banking credentials are handled entirely by our payment gateway. They never reach our servers, and we could not retrieve them if asked.",
        ],
      },
      {
        heading: "Your rights",
        body: [
          "You can export everything we hold about you, correct it, or have it erased, from your account. Exports are delivered within 7 days; erasure completes within 30.",
          "One limit worth stating plainly: tax law requires us to retain order and invoice records for 8 years. When you request erasure we anonymise those records — your personal identifiers are removed while the financial figures remain for audit. The invoice stays valid; you are no longer identifiable from it.",
          "Consent for marketing and WhatsApp messaging is separate and separately revocable. Withdrawing one does not affect the other or your ability to order. Analytics is absent from that list on purpose: it collects nothing about you, so there is no consent to withdraw.",
        ],
      },
      {
        heading: "Who we share with",
        body: [
          "Only the processors needed to fulfil your order: our payment gateway, our courier, our email and WhatsApp providers, and our cloud host. Each has a data-processing agreement.",
          "All of them store your data in India. We do not sell data, and we do not run third-party advertising trackers.",
        ],
      },
      {
        heading: "Breach notification",
        body: [
          "If a breach affects your data we will notify you and the Data Protection Board of India within 72 hours of becoming aware, and tell you what was affected and what to do about it.",
        ],
      },
    ],
  },
  {
    slug: "terms",
    title: "Terms of sale",
    summary: "The contract between us, in plain language.",
    updated: "31 July 2026",
    sections: [
      {
        heading: "Orders",
        body: [
          "Placing an order is an offer to buy. The contract forms when we dispatch, which is why we can cancel and refund in full if something is genuinely unavailable.",
          "We reserve the right to cancel an order where a price or specification is obviously wrong — a ₹4 bearing listed at ₹0.04, for example. We will tell you why and refund immediately rather than shipping the wrong thing quietly.",
        ],
      },
      {
        heading: "Prices",
        body: [
          "All prices are in Indian Rupees and inclusive of GST. Quantity price breaks are applied automatically in the cart; you never need a code.",
          "Prices can change, but never after you have paid.",
        ],
      },
      {
        heading: "Specifications",
        body: [
          "We publish the specification we buy against. Where a manufacturer changes a specification we update the listing; if you have already ordered against the old one we will tell you before dispatch and let you cancel.",
          "Photographs are representative. The specification table, not the photograph, is the contractual description.",
        ],
      },
      {
        heading: "Liability",
        body: [
          "Components are sold for you to design with. We are not liable for the performance of an assembly you build, and nothing we sell is certified for safety-critical, medical or aerospace use unless the listing says so explicitly.",
        ],
      },
      {
        heading: "Governing law",
        body: [
          "These terms are governed by the laws of India, with courts at Bengaluru having jurisdiction.",
        ],
      },
    ],
  },
];

export const policyBySlug = (slug: string) => POLICIES.find((p) => p.slug === slug);

/* ============================================================
   Guides — the acquisition channel from 12-COMPETITIVE-RESEARCH §4
   ============================================================ */
export type Guide = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readMins: number;
  published: string;
  sections: Section[];
};

export const GUIDES: Guide[] = [
  {
    slug: "how-to-measure-screw-length",
    title: "How to measure screw length",
    excerpt:
      "Where you start the measurement depends entirely on the head type — and getting it wrong is the most common ordering mistake we see.",
    category: "Fasteners",
    readMins: 4,
    published: "28 July 2026",
    sections: [
      {
        body: [
          "Screw length is measured from the seating surface to the tip. What counts as the seating surface changes with the head, which is why the same 10 mm screw can look like two different lengths.",
        ],
      },
      {
        heading: "Heads that sit on the surface",
        body: [
          "Pan, button, cheese, socket cap and hex head screws all sit on top of the material. Measure from directly under the head to the tip. The head itself is not part of the length.",
          "So an M3 × 10 socket head cap screw has 10 mm of shank below a head that is a further 3 mm tall — 13 mm overall.",
        ],
      },
      {
        heading: "Heads that sit flush",
        body: [
          "Countersunk (CSK) and oval heads sink into the material. Measure the whole screw, including the head, from the top of the head to the tip.",
          "This catches people out constantly. An M3 × 10 CSK is 10 mm overall, so it has noticeably less thread engagement than an M3 × 10 socket head. If you are swapping head styles, check your thread engagement.",
        ],
      },
      {
        heading: "Grub and set screws",
        body: [
          "No head at all, so the length is simply end to end.",
        ],
      },
      {
        heading: "A practical check",
        body: [
          "Thread engagement should be at least one thread diameter in steel and about two in aluminium or plastic. For an M4 in aluminium, aim for 8 mm of engagement — and remember that a CSK head eats into that budget.",
        ],
      },
    ],
  },
  {
    slug: "hex-nut-vs-nyloc",
    title: "Hex nut vs nyloc: when to use each",
    excerpt:
      "Both thread onto the same bolt. Only one of them survives vibration — and only one can be reused indefinitely.",
    category: "Fasteners",
    readMins: 3,
    published: "28 July 2026",
    sections: [
      {
        heading: "The difference",
        body: [
          "A plain hex nut relies purely on the clamp load between the nut and the bolt head to stay put. A nyloc nut adds a nylon collar at the top which deforms around the thread, adding friction that does not depend on clamp load.",
        ],
      },
      {
        heading: "Use a nyloc when",
        body: [
          "Anything vibrates — motors, drones, CNC gantries, vehicles. Vibration gradually releases clamp load, and once a plain nut loses it, it walks off.",
          "The joint is hard to inspect. A nut you cannot see is a nut you cannot check.",
        ],
      },
      {
        heading: "Use a plain hex nut when",
        body: [
          "Temperature exceeds about 120 °C — the nylon softens and stops doing its job. Use a nyloc's high-temperature equivalent, an all-metal locking nut, instead.",
          "The joint will be assembled and disassembled repeatedly. A nyloc loses effectiveness after roughly five cycles, and a plain nut plus threadlocker is more predictable.",
        ],
      },
      {
        heading: "What not to do",
        body: [
          "Do not use threadlocker on a nyloc — the adhesive attacks the nylon and you end up with neither mechanism working properly.",
          "Do not reuse a nyloc that spins on freely by hand. If the collar no longer grips, it is a plain nut with extra height.",
        ],
      },
    ],
  },
  {
    slug: "choosing-brass-threaded-inserts",
    title: "Choosing brass threaded inserts for 3D printing",
    excerpt:
      "Heat-set inserts give printed parts real metal threads. Getting the hole diameter right is 90% of the job.",
    category: "3D printing",
    readMins: 5,
    published: "28 July 2026",
    sections: [
      {
        heading: "Why bother",
        body: [
          "Threads printed directly into plastic strip after a handful of cycles. A brass insert melts into the plastic, and the surrounding material flows into its knurling, giving a metal thread that survives repeated assembly.",
        ],
      },
      {
        heading: "Sizing the hole",
        body: [
          "The hole should be very slightly smaller than the insert's minor diameter, so the insert displaces material as it sinks. Too tight and the part bulges; too loose and it spins under load.",
          "For a common M3 insert with a 4.0 mm outer diameter, print a 3.9–4.0 mm hole. For M4 at 5.6 mm, print 5.5–5.6 mm. Always test one in a coupon before committing to a plate of parts.",
        ],
      },
      {
        heading: "Wall thickness",
        body: [
          "Leave at least 1.5 mm of material around the insert, and more in PLA than in PETG or ABS. An insert set too close to a wall will bulge or split it.",
        ],
      },
      {
        heading: "Setting them",
        body: [
          "Use a soldering iron with a purpose-made insert tip at around 200–220 °C for PLA, 240 °C for PETG and ABS. Press slowly and let the plastic melt rather than forcing it.",
          "Stop when the insert is flush or a hair below the surface. Proud inserts prevent parts from mating flat.",
        ],
      },
      {
        heading: "When not to use them",
        body: [
          "For a part that is assembled once and never touched again, a screw straight into plastic with a generous boss is fine. Inserts cost money and time; use them where the joint actually cycles.",
        ],
      },
    ],
  },
  {
    slug: "reading-bearing-codes",
    title: "How to read a bearing code",
    excerpt:
      "608ZZ, 6202-2RS, MR105. The numbers are not arbitrary — they tell you the bore, the series and the seal.",
    category: "Bearings",
    readMins: 4,
    published: "29 July 2026",
    sections: [
      {
        heading: "The basic structure",
        body: [
          "For metric deep-groove bearings the last two digits give the bore. Multiply by 5 for codes from 04 upwards: 6204 has a 20 mm bore. Below that they are memorised: 00 is 10 mm, 01 is 12 mm, 02 is 15 mm, 03 is 17 mm.",
          "The digit before that is the series, which sets how much load it takes for a given bore. A 6200 is lighter and smaller in outer diameter than a 6300 with the same bore.",
        ],
      },
      {
        heading: "Small bearings",
        body: [
          "Codes like 623, 624, 608 and 688 follow a different pattern: the last digit is the bore directly. A 608 has an 8 mm bore, which is why it is the standard skate and 3D-printer idler bearing.",
        ],
      },
      {
        heading: "The suffix is the seal",
        body: [
          "ZZ or 2Z means two metal shields — lower friction, keeps dust out, not waterproof.",
          "2RS or RS means two rubber seals — higher friction, keeps contamination and moisture out. Use these anywhere near coolant, swarf or weather.",
          "No suffix means open. Cheapest, fastest, and only appropriate in a sealed or clean environment.",
        ],
      },
      {
        heading: "A worked example",
        body: [
          "6202-2RS: series 62, bore code 02 so a 15 mm bore, rubber sealed both sides. Outer diameter 35 mm, width 11 mm — which you can look up, but the code alone already told you the three things that decide fit.",
        ],
      },
    ],
  },
  {
    slug: "neodymium-magnet-grades",
    title: "Neodymium magnet grades explained",
    excerpt:
      "N35 to N52 is a 50% difference in strength — and a real difference in temperature tolerance you should know about first.",
    category: "Magnets",
    readMins: 3,
    published: "29 July 2026",
    sections: [
      {
        heading: "What the number means",
        body: [
          "The number after the N is the maximum energy product in mega-gauss-oersteds. Higher is stronger for the same size: an N52 disc pulls roughly 50% harder than an N35 of identical dimensions.",
        ],
      },
      {
        heading: "The trade-off nobody mentions",
        body: [
          "Higher grades generally tolerate less heat. A standard N52 starts losing strength permanently around 60–65 °C, while N35 is usually good to 80 °C. Near a motor, a hotend or in a car in summer, the stronger magnet can end up the weaker one.",
          "If you need both strength and heat, look for grades suffixed M, H, SH or UH, which trade a little strength for a much higher working temperature.",
        ],
      },
      {
        heading: "Coating",
        body: [
          "Neodymium corrodes readily. Nickel-copper-nickel plating is the default and is fine indoors. For outdoor or humid use, epoxy coating lasts considerably longer.",
        ],
      },
      {
        heading: "Handling",
        body: [
          "Anything above about 20 mm diameter can break skin if two are allowed to snap together. They are also brittle — they chip rather than dent. Keep them away from cards, pacemakers and hard drives.",
        ],
      },
    ],
  },
  {
    slug: "stainless-304-vs-316",
    title: "SS304 vs SS316 vs 12.9 alloy: which fastener",
    excerpt:
      "Three materials, three completely different jobs. Choosing on price alone is how joints fail.",
    category: "Fasteners",
    readMins: 4,
    published: "30 July 2026",
    sections: [
      {
        heading: "SS304 — the default",
        body: [
          "Good corrosion resistance, non-magnetic, about 700 MPa tensile. This is the right answer for most indoor and general-purpose work, and it is what we stock most deeply.",
        ],
      },
      {
        heading: "SS316 — marine and chemical",
        body: [
          "Adds molybdenum, which resists chlorides specifically. If the joint sees salt air, pool chemicals or road salt, the extra cost is worth it. Indoors it is money spent on nothing.",
        ],
      },
      {
        heading: "12.9 alloy — when strength matters",
        body: [
          "About 1,200 MPa, roughly 70% stronger than SS304. Use it for structural joints, motor mounts and anything carrying real load.",
          "The catch: it is not stainless. The black oxide finish is cosmetic and offers almost no corrosion protection, so it will rust outdoors or in humidity. It is also magnetic, which matters around sensors and compasses.",
        ],
      },
      {
        heading: "Brass and nylon",
        body: [
          "Brass for electrical contact and where you need a non-sparking, non-magnetic fastener. Nylon where you need electrical isolation or must not mark a surface. Neither carries meaningful load.",
        ],
      },
      {
        heading: "The quick rule",
        body: [
          "Indoors and unloaded: SS304. Outdoors and unloaded: SS304, or SS316 near salt. Loaded and indoors: 12.9. Loaded and outdoors: 12.9 with a protective coating, or accept SS304's lower strength and use a larger size.",
        ],
      },
    ],
  },
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug);

/* ============================================================
   FAQ
   ============================================================ */
export const FAQS: { q: string; a: string }[] = [
  {
    q: "Is there a minimum order?",
    a: "No. Buy one screw or ten thousand. There is no minimum order value and no minimum quantity on any line.",
  },
  {
    q: "How do quantity discounts work?",
    a: "Every product shows its price breaks on the product page. Discounts apply automatically in the cart as soon as you cross a threshold — there is never a code to enter, and the cart tells you how many more units would reach the next tier.",
  },
  {
    q: "Do you provide GST invoices?",
    a: "Every order, automatically, with correct HSN codes per line. Add your GSTIN at checkout or save it once in your account.",
  },
  {
    q: "How fast do you ship?",
    a: "In-stock items ordered before 4 PM IST on a working day dispatch the same day. Made-to-order items show their lead time on the product page before you buy.",
  },
  {
    q: "What if an item is out of stock?",
    a: "The product page says so before you add it, shows the lead time to make it to order, and suggests in-stock alternatives with the same dimensions in a different material or finish.",
  },
  {
    q: "Can you supply something not in the catalogue?",
    a: "Yes. Send us a drawing, a datasheet or even a photograph through Make-on-Demand and we will either source it or manufacture it. First response within 4 business hours, priced quote within 24.",
  },
  {
    q: "Do you sell to businesses and institutions?",
    a: "Yes. Add your GSTIN for input credit, and use the bulk quote link on any product for quantities above 1,000. We supply colleges, ATL labs and manufacturers, and can provide proforma invoices for procurement.",
  },
  {
    q: "How do returns work?",
    a: "Seven days on unopened items. If we sent the wrong or damaged thing, we pay return shipping and refund in full — no unboxing video required. Refunds always go back to your original payment method, never store credit only.",
  },
  {
    q: "Which payment methods do you accept?",
    a: "UPI, credit and debit cards, and netbanking. We do not offer cash on delivery — every order is paid online before it ships. Card details are handled entirely by our payment gateway and never reach our servers.",
  },
  {
    q: "Do you ship across all of India?",
    a: "Yes, to every serviceable pincode. Metro cities typically receive orders in 2–3 working days, the rest of India in 4–7, and remote territories in 6–10.",
  },
];

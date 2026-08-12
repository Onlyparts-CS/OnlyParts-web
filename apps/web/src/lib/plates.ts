/* ============================================================
   Plates — the source artwork the halftone screen prints from.
   ------------------------------------------------------------
   Every image on this site is processed, never raw. There are no
   photographs to process, so the source is authored: parts drawn
   as filled elevations on a canvas, then re-screened as dots.

   A plate is a draw function rather than a path string because
   these shapes need real holes — a bearing bore, a socket recess,
   a lightening hole — and `destination-out` gives that for free
   where an SVG path string would need hand-authored even-odd
   winding. The renderer paints black on transparent; colour is
   decided at screening time, by the plate the dots go on.
   ============================================================ */

export type PlateKey =
  | "screw" | "screwButton" | "screwCsk" | "screwPan"
  | "bearing" | "rotor" | "gear" | "extrusion"
  | "chip" | "cell" | "nozzle" | "prop" | "magnet";

/**
 * `p` is a normalised shape parameter in [0,1] taken from the part's own
 * attributes — length for a screw, bore ratio for a bearing, capacity for a
 * cell. Without it every socket-head screw in a 212-item listing screens to
 * an identical picture, and the image slot is decoration. With it, an M8×60
 * is visibly longer and fatter than an M2×8 before you read a word, which is
 * the one thing a photograph of a screw would have told you anyway.
 */
type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number, p: number) => void;

const mix = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));

/** Fit a design-space box into the canvas, centred, and return the scale. */
function fit(ctx: CanvasRenderingContext2D, w: number, h: number, dw: number, dh: number) {
  const s = Math.min(w / dw, h / dh) * 0.86;
  ctx.translate(w / 2, h / 2);
  ctx.scale(s, s);
  ctx.translate(-dw / 2, -dh / 2);
  return s;
}

const cut = (ctx: CanvasRenderingContext2D, fn: () => void) => {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  fn();
  ctx.restore();
};

/* ---------- screws, side elevation ----------
   One body, four heads. A listing of M3 × 10 screws is a listing of parts
   that differ *only* by head, so a plate that ignores the head is a plate
   that draws the same picture 212 times. */
type Head = "cap" | "button" | "csk" | "pan";

const makeScrew = (head: Head): Draw => (ctx, w, h, p) => {
  // p = 0 → short and stout · p = 1 → long and slender
  const DW = 320, DH = Math.round(mix(300, 700, p));
  fit(ctx, w, h, DW, DH);
  const cx = DW / 2;

  // proportions matter more than accuracy at this scale: with a small head and
  // a fine thread the silhouette reads as a nail, which is the one fastener we
  // do not sell. The head barely varies — length carries the difference, the
  // way it does on the shelf.
  // a countersunk head sits *in* the work, so it is wide and shallow; a button
  // head is a low dome; a pan head is wider than a cap and half the height
  const HEAD_W = { cap: 1, button: 1.06, csk: 1.24, pan: 1.14 }[head];
  const HEAD_H = { cap: 0.62, button: 0.42, csk: 0.4, pan: 0.34 }[head];
  const headW = Math.round(mix(154, 122, p) * HEAD_W);
  const headH = Math.round(mix(154, 122, p) * HEAD_H);
  const shankW = Math.round(mix(154, 122, p) * 0.55), shankTop = headH, shankLen = 74;
  const coreW = Math.round(shankW * 0.92), pitch = 34, crest = Math.round(shankW * 0.28);
  const threadTop = shankTop + shankLen;
  const threadLen = DH - threadTop - 40;
  const turns = Math.floor(threadLen / pitch);

  ctx.fillStyle = "#000";

  // head
  ctx.beginPath();
  if (head === "cap") {
    ctx.rect(cx - headW / 2, 0, headW, headH);
  } else if (head === "csk") {
    // 90° cone, flat on top, meeting the shank
    ctx.moveTo(cx - headW / 2, 0);
    ctx.lineTo(cx + headW / 2, 0);
    ctx.lineTo(cx + shankW / 2, headH);
    ctx.lineTo(cx - shankW / 2, headH);
  } else {
    // Button and pan are both domes; they differ by height, which HEAD_H
    // already carries. The control points sit at y=0 so the crown lands on
    // the top edge of the box — pulling them above it clipped the dome away
    // and left a rectangle.
    ctx.moveTo(cx - headW / 2, headH);
    ctx.quadraticCurveTo(cx - headW / 2, 0, cx, 0);
    ctx.quadraticCurveTo(cx + headW / 2, 0, cx + headW / 2, headH);
  }
  ctx.closePath();
  ctx.fill();

  // shank
  ctx.beginPath();
  ctx.rect(cx - shankW / 2, shankTop, shankW, shankLen);
  ctx.fill();

  // threaded body — a real cut profile, crests alternating down each flank
  ctx.beginPath();
  ctx.moveTo(cx - coreW / 2, threadTop);
  for (let i = 0; i < turns; i++) {
    const y = threadTop + i * pitch;
    ctx.lineTo(cx - coreW / 2 - crest, y + pitch * 0.5);
    ctx.lineTo(cx - coreW / 2, y + pitch);
  }
  const tipY = threadTop + turns * pitch;
  ctx.lineTo(cx - coreW / 2 + 12, tipY + 30);   // lead chamfer
  ctx.lineTo(cx + coreW / 2 - 12, tipY + 30);
  for (let i = turns - 1; i >= 0; i--) {
    const y = threadTop + i * pitch;
    ctx.lineTo(cx + coreW / 2, y + pitch);
    ctx.lineTo(cx + coreW / 2 + crest, y + pitch * 0.5);
  }
  ctx.lineTo(cx + coreW / 2, threadTop);
  ctx.closePath();
  ctx.fill();

  // the drive, recessed into the head
  cut(ctx, () => {
    // a dome has less flat to recess into, so the drive shrinks and sits low
    const r = Math.round(headW * (head === "cap" ? 0.26 : 0.2));
    const dy = head === "cap" ? headH / 2 : headH * 0.62;
    if (head === "pan") {
      // a cross recess, since pan heads on this catalogue are Phillips
      const t = Math.round(r * 0.42);
      ctx.beginPath();
      ctx.rect(cx - r, dy - t / 2, r * 2, t);
      ctx.rect(cx - t / 2, dy - r, t, r * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const x = cx + Math.cos(a) * r, y = dy + Math.sin(a) * r;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }
  });
};

const screw = makeScrew("cap");
const screwButton = makeScrew("button");
const screwCsk = makeScrew("csk");
const screwPan = makeScrew("pan");

/* ---------- deep-groove ball bearing, face on ---------- */
const bearing: Draw = (ctx, w, h, p) => {
  const D = 520;
  fit(ctx, w, h, D, D);
  const c = D / 2;
  ctx.fillStyle = "#000";

  // p = bore as a fraction of OD: a 608 is a small bore in a big ring, a
  // thin-section bearing is nearly all hole
  const bore = mix(52, 150, p);
  const pitchR = mix(168, 196, p);
  const ballR = mix(26, 16, p);

  const ring = (ro: number, ri: number) => {
    ctx.beginPath();
    ctx.arc(c, c, ro, 0, Math.PI * 2);
    ctx.fill();
    cut(ctx, () => { ctx.beginPath(); ctx.arc(c, c, ri, 0, Math.PI * 2); ctx.fill(); });
  };

  ring(250, pitchR + ballR + 4);        // outer race
  ring(pitchR - ballR - 4, bore);       // inner race

  const balls = Math.round(mix(8, 13, p));
  for (let i = 0; i < balls; i++) {
    const a = (Math.PI * 2 * i) / balls - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(c + Math.cos(a) * pitchR, c + Math.sin(a) * pitchR, ballR, 0, Math.PI * 2);
    ctx.fill();
  }
};

/* ---------- NEMA stepper, front elevation ---------- */
const rotor: Draw = (ctx, w, h) => {
  const D = 520;
  fit(ctx, w, h, D, D);
  ctx.fillStyle = "#000";
  const c = D / 2, half = 218, ch = 52;   // chamfer — a NEMA can has cut corners

  ctx.beginPath();
  ctx.moveTo(c - half + ch, c - half);
  ctx.lineTo(c + half - ch, c - half);
  ctx.lineTo(c + half, c - half + ch);
  ctx.lineTo(c + half, c + half - ch);
  ctx.lineTo(c + half - ch, c + half);
  ctx.lineTo(c - half + ch, c + half);
  ctx.lineTo(c - half, c + half - ch);
  ctx.lineTo(c - half, c - half + ch);
  ctx.closePath();
  ctx.fill();

  cut(ctx, () => {
    // the four mounting bores on the 31 mm PCD
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      ctx.beginPath();
      ctx.arc(c + dx * 155, c + dy * 155, 27, 0, Math.PI * 2);
      ctx.fill();
    }
    // the pilot boss, knocked out so the ring below reads as raised
    ctx.beginPath();
    ctx.arc(c, c, 96, 0, Math.PI * 2);
    ctx.fill();
  });

  // raised boss and the flat on the shaft
  ctx.beginPath();
  ctx.arc(c, c, 78, 0, Math.PI * 2);
  ctx.fill();
  cut(ctx, () => {
    ctx.beginPath();
    ctx.arc(c, c, 40, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.beginPath();
  ctx.arc(c, c, 40, 0, Math.PI * 2);
  ctx.fill();
  cut(ctx, () => {
    ctx.beginPath();
    ctx.rect(c - 40, c - 40, 80, 13);
    ctx.fill();
  });
};

/* ---------- spur gear ---------- */
const gear: Draw = (ctx, w, h) => {
  const D = 520;
  fit(ctx, w, h, D, D);
  const c = D / 2;
  ctx.fillStyle = "#000";

  const teeth = 22, rRoot = 196, rTip = 240;
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a0 = (Math.PI * 2 * i) / teeth;
    const step = (Math.PI * 2) / teeth / 4;
    const pts: [number, number][] = [
      [Math.cos(a0) * rRoot, Math.sin(a0) * rRoot],
      [Math.cos(a0 + step) * rTip, Math.sin(a0 + step) * rTip],
      [Math.cos(a0 + step * 2) * rTip, Math.sin(a0 + step * 2) * rTip],
      [Math.cos(a0 + step * 3) * rRoot, Math.sin(a0 + step * 3) * rRoot],
    ];
    pts.forEach(([x, y], j) => (i === 0 && j === 0 ? ctx.moveTo(c + x, c + y) : ctx.lineTo(c + x, c + y)));
  }
  ctx.closePath();
  ctx.fill();

  cut(ctx, () => {
    // bore with keyway
    ctx.beginPath();
    ctx.arc(c, c, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.rect(c - 14, c - 76, 28, 22);
    ctx.fill();
    // lightening holes
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(c + Math.cos(a) * 130, c + Math.sin(a) * 130, 36, 0, Math.PI * 2);
      ctx.fill();
    }
  });
};

/* ---------- 2020 V-slot extrusion, section ---------- */
const extrusion: Draw = (ctx, w, h) => {
  const D = 480;
  fit(ctx, w, h, D, D);
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.rect(20, 20, D - 40, D - 40);
  ctx.fill();

  cut(ctx, () => {
    // the four T-slots
    const t = 62, mid = D / 2, len = 150;
    const slot = (x: number, y: number, ww: number, hh: number) => {
      ctx.beginPath();
      ctx.rect(x, y, ww, hh);
      ctx.fill();
    };
    slot(mid - t / 2, 20, t, len);
    slot(mid - t / 2, D - 20 - len, t, len);
    slot(20, mid - t / 2, len, t);
    slot(D - 20 - len, mid - t / 2, len, t);
    // centre bore
    ctx.beginPath();
    ctx.arc(mid, mid, 46, 0, Math.PI * 2);
    ctx.fill();
  });
};

/* ---------- DIP integrated circuit ---------- */
const chip: Draw = (ctx, w, h) => {
  const DW = 480, DH = 380;
  fit(ctx, w, h, DW, DH);
  ctx.fillStyle = "#000";
  const bx = 92, bw = DW - 184;

  ctx.beginPath();
  ctx.rect(bx, 60, bw, DH - 120);
  ctx.fill();

  // pin-1 notch
  cut(ctx, () => {
    ctx.beginPath();
    ctx.arc(bx + bw / 2, 60, 36, 0, Math.PI);
    ctx.fill();
  });

  // legs
  const pins = 8, pitch = bw / pins;
  for (let i = 0; i < pins; i++) {
    const x = bx + pitch * (i + 0.5) - 13;
    ctx.beginPath(); ctx.rect(x, 12, 26, 52); ctx.fill();
    ctx.beginPath(); ctx.rect(x, DH - 64, 26, 52); ctx.fill();
  }
};

/* ---------- cylindrical cell ---------- */
const cell: Draw = (ctx, w, h, p) => {
  // p = 0 → a squat 26650 · p = 1 → a slim 14500
  const DW = Math.round(mix(300, 200, p)), DH = 560;
  fit(ctx, w, h, DW, DH);
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.rect(28, 46, DW - 56, DH - 92);
  ctx.fill();
  // positive terminal
  ctx.beginPath();
  ctx.rect(DW / 2 - 42, 12, 84, 40);
  ctx.fill();
  // wrap bands
  cut(ctx, () => {
    for (const y of [130, 260, 390]) {
      ctx.beginPath();
      ctx.rect(28, y, DW - 56, 16);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(DW / 2, 200, 34, 0, Math.PI * 2);
    ctx.fill();
  });
};

/* ---------- hotend nozzle ---------- */
const nozzle: Draw = (ctx, w, h) => {
  const DW = 300, DH = 460;
  fit(ctx, w, h, DW, DH);
  const cx = DW / 2;
  ctx.fillStyle = "#000";

  ctx.beginPath();
  ctx.moveTo(cx - 96, 30);
  ctx.lineTo(cx + 96, 30);
  ctx.lineTo(cx + 96, 210);
  ctx.lineTo(cx + 26, 400);
  ctx.lineTo(cx + 9, 430);
  ctx.lineTo(cx - 9, 430);
  ctx.lineTo(cx - 26, 400);
  ctx.lineTo(cx - 96, 210);
  ctx.closePath();
  ctx.fill();

  cut(ctx, () => {
    // hex flats
    for (const y of [70, 110, 150]) {
      ctx.beginPath();
      ctx.rect(cx - 96, y, 192, 8);
      ctx.fill();
    }
    // melt channel
    ctx.beginPath();
    ctx.rect(cx - 11, 30, 22, 390);
    ctx.fill();
  });
};

/* ---------- propeller ---------- */
const prop: Draw = (ctx, w, h) => {
  const D = 520;
  fit(ctx, w, h, D, D);
  const c = D / 2;
  ctx.fillStyle = "#000";

  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate((Math.PI * 2 * i) / 3);
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.bezierCurveTo(-46, -110, -22, -206, 24, -238);
    ctx.bezierCurveTo(62, -204, 52, -104, 26, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(c, c, 58, 0, Math.PI * 2);
  ctx.fill();
  cut(ctx, () => {
    ctx.beginPath();
    ctx.arc(c, c, 24, 0, Math.PI * 2);
    ctx.fill();
  });
};

/* ---------- horseshoe magnet ---------- */
const magnet: Draw = (ctx, w, h) => {
  const DW = 420, DH = 460;
  fit(ctx, w, h, DW, DH);
  ctx.fillStyle = "#000";
  const cx = DW / 2;

  ctx.beginPath();
  ctx.moveTo(60, DH - 20);
  ctx.lineTo(60, 200);
  ctx.arc(cx, 200, 150, Math.PI, 0);
  ctx.lineTo(360, DH - 20);
  ctx.lineTo(268, DH - 20);
  ctx.lineTo(268, 200);
  ctx.arc(cx, 200, 58, 0, Math.PI, true);
  ctx.lineTo(152, DH - 20);
  ctx.closePath();
  ctx.fill();

  // pole faces knocked out, the way they are painted on a real one
  cut(ctx, () => {
    ctx.beginPath(); ctx.rect(60, DH - 96, 92, 30); ctx.fill();
    ctx.beginPath(); ctx.rect(268, DH - 96, 92, 30); ctx.fill();
  });
};

export const PLATES: Record<PlateKey, Draw> = {
  screw, screwButton, screwCsk, screwPan,
  bearing, rotor, gear, extrusion, chip, cell, nozzle, prop, magnet,
};

/**
 * `head_type` → screw plate, matched on substrings.
 *
 * The generated catalogue stores the display name ("Hex Button Head") and the
 * hand-written demo documents store the slug ("button-head"), so an exact
 * lookup silently matched neither and every screw drew a socket cap.
 * Substrings cover both, and any future spelling of the same head.
 */
const HEAD_PLATE: [RegExp, PlateKey][] = [
  [/button/i, "screwButton"],
  [/countersunk|csk|flat/i, "screwCsk"],
  [/pan|flange/i, "screwPan"],
  [/socket|cap|cheese|hex/i, "screw"],
];

/**
 * Category slug → a real photograph of that category's parts.
 *
 * Screened through the same engine at the same angles as the drawn plates, so
 * photography and linework sit in one world rather than two. Only categories
 * with a licence-clean photograph appear here; the rest fall back to the drawn
 * plate, which is the correct behaviour and not a gap to be filled with
 * whatever stock image was nearest.
 *
 * These files are Public Domain / CC0 placeholders — see
 * `public/parts/CREDITS.md`. Replacing them with OnlyParts' own product
 * photography needs no design change at all.
 */
export const PHOTO_FOR_CATEGORY: Record<string, string> = {
  fasteners: "/parts/fasteners.jpg",
  "electronic-components": "/parts/electronic-components.jpg",
  "batteries-power": "/parts/batteries-power.jpg",
  "3d-printing": "/parts/3d-printers-parts.jpg",
  tools: "/parts/tools.jpg",
  magnets: "/parts/magnets.jpg",
  "industrial-electricals": "/parts/industrial-electricals.jpg",
  hardware: "/parts/hardware.jpg",
};

/** Category slug → the plate that represents it on a drawer front. */
export const PLATE_FOR_CATEGORY: Record<string, PlateKey> = {
  fasteners: "screw",
  motors: "rotor",
  "electronic-components": "chip",
  "batteries-power": "cell",
  // A printer is a frame before it is anything else, and the extrusion plate is
  // the only drawing in the set that reads as a machine rather than a part.
  "3d-printers": "extrusion",
  "3d-printing": "nozzle",
  "drones-parts": "prop",
  tools: "gear",
  bearings: "bearing",
  magnets: "magnet",
  "cnc-machines-parts": "gear",
  "industrial-electricals": "chip",
  "ev-parts": "rotor",
  hardware: "extrusion",
};

/** Line-art glyph key → plate, so a product tile can screen its own part. */
export const PLATE_FOR_GLYPH: Record<string, PlateKey> = {
  hex: "screw", rotor: "rotor", chip: "chip", cell: "cell", nozzle: "nozzle",
  prop: "prop", wrench: "gear", bearing: "bearing", magnet: "magnet",
  endmill: "nozzle", contactor: "chip", hub: "rotor", extrusion: "extrusion",
};

/**
 * The plate for one SKU. Starts from its category glyph, then refines on the
 * attributes that actually change the silhouette — a countersunk screw and a
 * button head are not the same picture, and in a listing filtered to `M3` and
 * `10 mm` the head is the only thing left to look at.
 */
export function plateFor(glyph: string | undefined, attrs: Record<string, unknown>): PlateKey {
  const head = typeof attrs.head_type === "string" ? attrs.head_type : "";
  if (head) {
    const hit = HEAD_PLATE.find(([re]) => re.test(head));
    if (hit) return hit[1];
  }
  return (glyph && PLATE_FOR_GLYPH[glyph]) || "screw";
}

const norm = (v: number, lo: number, hi: number) =>
  Math.min(1, Math.max(0, (v - lo) / (hi - lo)));

/**
 * The shape parameter for one SKU, read off its typed attributes.
 *
 * Falls back to a stable hash of the SKU code rather than a constant: two
 * parts with no dimensional attributes still deserve two different pictures,
 * and a random value would re-roll on every render.
 */
export function plateParam(attrs: Record<string, unknown>, sku: string): number {
  const num = (k: string) => (typeof attrs[k] === "number" ? (attrs[k] as number) : undefined);

  const len = num("length_mm");
  if (len !== undefined) return norm(len, 4, 60);

  const bore = num("bore_id_mm"), od = num("outer_od_mm");
  if (bore !== undefined && od) return norm(bore / od, 0.2, 0.62);
  if (bore !== undefined) return norm(bore, 3, 30);

  const dia = num("dia_mm");
  if (dia !== undefined) return norm(dia, 3, 30);

  const body = num("body_length_mm");
  if (body !== undefined) return norm(body, 20, 60);

  let hash = 0;
  for (let i = 0; i < sku.length; i++) hash = (hash * 31 + sku.charCodeAt(i)) >>> 0;
  return (hash % 1000) / 1000;
}

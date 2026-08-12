import Link from "next/link";
import Image from "next/image";
import mark from "@/../public/brand/mark.png";

/**
 * The mark: the supplied artwork, used as supplied.
 *
 * This was briefly a flat two-colour redraw. It is not any more, by
 * instruction — the redraw lost the bevel, the trace work and the chrome on
 * the pins, and a simplified logo is a worse logo even when it is a more
 * systematic one.
 *
 * What the source file needed was not redrawing but **keying**. It ships as a
 * 1774×887 raster on solid white with no alpha channel, so dropping it in
 * would have put a white rectangle on warm paper. `public/brand/mark.png` is
 * that file with the background flood-filled to transparent from the edges
 * inward — flood-filled rather than colour-keyed, because the "OP" inside the
 * die is also white and a global key punches straight through the letters.
 * Everything inside the silhouette, drop shadow included, is untouched.
 *
 * No coloured tile behind it. The artwork is already a complete green mark and
 * setting it on a second green square was reading as a badge on a badge.
 */
export function Logo({ className = "", size = "md" }: { className?: string; size?: "md" | "lg" }) {
  const lg = size === "lg";
  const px = lg ? 36 : 28;

  return (
    <Link
      href="/"
      aria-label="OnlyParts — home"
      className={`group inline-flex shrink-0 items-center ${className}`}
    >
      <Image
        src={mark}
        alt=""
        width={px}
        height={px}
        /*
          `priority` because this is in the header on every route and is
          therefore always in the first viewport — without it Next lazy-loads
          the mark and the wordmark lands alone for a beat.

          The source is 512px square against a 28px slot, which is deliberate:
          it covers a 3× display and Next serves the right size per device
          rather than shipping the half-megabyte original.
        */
        priority
        className="shrink-0 transition-opacity group-hover:opacity-85"
        style={{ width: px, height: px }}
      />
      <span
        /*
          The wordmark stays live type rather than becoming part of the image.
          Archivo at 118% width is within a hair of the supplied lettering, and
          as text it stays selectable, searchable, recolourable by token, and
          legible to a screen reader — none of which a raster gives back.
        */
        className={`monumental ml-2 text-ink-950 ${lg ? "text-[1.5rem]" : "text-[1.125rem]"}`}
      >
        Only<span className="text-spot-700">parts</span>
      </span>
    </Link>
  );
}

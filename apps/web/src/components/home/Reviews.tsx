import { REVIEWS } from "@/lib/catalog";
import { Reveal } from "@/components/Reveal";

/**
 * Filed testimonials.
 *
 * `REVIEWS` is empty until the catalogue is live, and an empty section is the
 * correct output — a pre-launch store with a wall of praise is worse than one
 * with none. The marquee this replaced also scrolled forever, which meant no
 * reader ever reached the end of it.
 */
export function Reviews() {
  if (!REVIEWS.length) return null;

  return (
    <section className="bg-bg py-16 lg:py-24">
      <div className="container-page">
        <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <h2 className="monumental max-w-[18ch] text-[clamp(2rem,5vw,4rem)]">
            People who measure things
          </h2>
          <p className="bin">{REVIEWS.length} filed</p>
        </Reveal>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {REVIEWS.slice(0, 8).map(([text, who], i) => (
            <Reveal key={who} delay={(Math.floor(i / 4) + (i % 4)) * 85}>
              <figure className="card-index flex h-full flex-col p-4">
                <span className="stamp self-start">Verified purchase</span>
                <blockquote className="mt-3 flex-1 text-[0.875rem] leading-relaxed text-body">
                  {text}
                </blockquote>
                <figcaption className="bin mt-4 border-t border-line pt-3">{who}</figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";
import type { Node } from "@/lib/taxonomy";

export function Breadcrumbs({ trail }: { trail: Node[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5">
      <ol className="flex flex-wrap items-center gap-1.5 text-[0.8125rem] text-faint">
        <li><Link href="/" className="hover:text-spot-700">Home</Link></li>
        {trail.map((n, i) => (
          <li key={n.slug} className="flex items-center gap-1.5">
            <span aria-hidden className="text-disabled">›</span>
            {i === trail.length - 1 ? (
              <span className="text-heading">{n.name}</span>
            ) : (
              <Link href={`/c/${n.path.join("/")}`} className="hover:text-spot-700">{n.name}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

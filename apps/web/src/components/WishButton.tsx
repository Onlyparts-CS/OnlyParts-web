"use client";

import { useStore, toggleWish } from "@/lib/store";
import { HeartIcon } from "@/components/Icons";

/**
 * Wishlist toggle.
 *
 * Sits inside product tiles, which are themselves links — hence the
 * preventDefault: a click on the heart must not navigate to the product. The
 * button carries its own accessible name because a lone icon inside a link is
 * otherwise announced as part of the link text.
 */
export function WishButton({
  sku, title, variant = "icon", className = "",
}: {
  sku: string;
  title: string;
  variant?: "icon" | "button";
  className?: string;
}) {
  const { wishlist } = useStore();
  const on = wishlist.includes(sku);

  const click = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWish(sku);
  };

  if (variant === "button") {
    return (
      <button
        onClick={click}
        aria-pressed={on}
        aria-label={on ? `Remove ${title} from wishlist` : `Save ${title} to wishlist`}
        className={`btn btn-secondary ${on ? "border-spot-600 text-spot-700" : ""} ${className}`}
      >
        <HeartIcon className={`size-[18px] ${on ? "fill-spot-500 text-spot-600" : ""}`} />
        {on ? "Saved" : "Save"}
      </button>
    );
  }

  return (
    <button
      onClick={click}
      aria-pressed={on}
      aria-label={on ? `Remove ${title} from wishlist` : `Save ${title} to wishlist`}
      className={`grid size-7 place-items-center rounded-xs border border-line bg-surface/90 backdrop-blur-sm transition-colors hover:border-spot-600 hover:text-spot-600 ${
        on ? "text-spot-600" : "text-disabled"
      } ${className}`}
    >
      <HeartIcon className={`size-3.5 ${on ? "fill-spot-500" : ""}`} />
    </button>
  );
}

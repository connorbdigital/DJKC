import { useEffect, useState, type MouseEvent } from "react";
import { Icon } from "./Icons";
import { DEPOSIT_PERCENT, TIERS, chargeFor, priceValue } from "../data";

const cheapest = priceValue(TIERS[0].price) ?? 0;
const deposit = chargeFor(cheapest, "deposit");
const money = (pounds: number) => `£${pounds.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;

/**
 * Phone-only bar pinned to the bottom of the screen: one tap from anywhere to
 * the booking form, with the holding deposit already selected so the route to
 * payment is a single choice rather than a hunt.
 */
export function BookBar() {
  const [scrolled, setScrolled] = useState(false);
  const [atForm, setAtForm] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 420);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const target = document.getElementById("book");
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setAtForm(entry.isIntersecting), {
      rootMargin: "0px 0px -45% 0px",
      threshold: 0,
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const visible = scrolled && !atForm;

  const goToForm = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    /* Booking listens for this and switches the payment choice to the deposit. */
    window.dispatchEvent(new CustomEvent("kc:pay-on-book"));
    /* On a phone the fields sit below the section heading, so land on the form
       itself, just clear of the sticky navbar. */
    const section = document.getElementById("book");
    const fields = section?.querySelector("form") ?? null;
    const target = (window.innerWidth < 640 ? fields : null) ?? section;
    if (target && window.scrollTo) {
      const top = target.getBoundingClientRect().top + window.scrollY - 84;
      window.scrollTo({ top, behavior: "smooth" });
    }
    if (typeof history !== "undefined" && history.replaceState) history.replaceState(null, "", "#book");
    window.setTimeout(() => document.getElementById("bk-name")?.focus({ preventScroll: true }), 700);
  };

  return (
    <div className={`kc-bookbar${visible ? " is-in" : ""}`} data-visible={visible ? "true" : "false"}>
      <div className="kc-bookbar-inner">
        <p className="kc-bookbar-copy">
          <strong className="text-ink">{money(cheapest)}</strong> from · {DEPOSIT_PERCENT}% deposit (
          {money(deposit)}) holds the date
        </p>
        <a
          href="#book"
          onClick={goToForm}
          className="kc-bookbar-cta"
          tabIndex={visible ? 0 : -1}
          aria-hidden={visible ? undefined : true}
        >
          Book now
          <Icon name="arrowRight" className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

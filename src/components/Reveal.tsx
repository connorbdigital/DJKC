import React, { useEffect, useRef, useState } from "react";

export function useInView<T extends HTMLElement>(threshold = 0.2, once = true) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            if (once) io.unobserve(e.target);
          } else if (!once) {
            setInView(false);
          }
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, once]);
  return { ref, inView };
}

export function Reveal({
  children,
  className = "",
  delay = 0,
  scale = false,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  scale?: boolean;
  as?: React.ElementType;
}) {
  const { ref, inView } = useInView<HTMLDivElement>(0.12);
  return (
    <Tag
      ref={ref}
      className={`reveal ${scale ? "reveal-scale" : ""} ${inView ? "is-in" : ""} ${className}`}
      style={{ "--rd": `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}
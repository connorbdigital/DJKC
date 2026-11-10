export function Logo({ className = "text-base" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center font-display font-extrabold tracking-[0.14em] leading-none border-[0.14em] border-current px-[0.55em] py-[0.38em] select-none ${className}`}
    >
      DJ&nbsp;KC
    </span>
  );
}
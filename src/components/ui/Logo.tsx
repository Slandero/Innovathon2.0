export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`font-extrabold tracking-tight ${className}`}>
      <span className="text-ink">Vive</span>
      <span className="text-futuro">CUU</span>
    </span>
  );
}

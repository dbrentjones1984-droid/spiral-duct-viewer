export function BrandLogo({ className = "h-auto w-48 max-w-full" }: { className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}logo.webp`}
      width={720}
      height={415}
      alt="Spiral Systems Incorporated, Nesbit, Mississippi and Nashville, Tennessee"
      className={className}
    />
  );
}

import { MapPin } from "lucide-react";

export function VerifiedBadge({ verified }: { verified: boolean | null }) {
  if (!verified) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
      <MapPin className="h-3 w-3" /> Location verified
    </span>
  );
}

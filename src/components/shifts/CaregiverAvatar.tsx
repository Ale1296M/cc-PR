import { firstName, initials } from "./shift-utils";

export function CaregiverAvatar({
  fullName,
  avatarUrl,
  size = 40,
}: {
  fullName: string | null | undefined;
  avatarUrl: string | null | undefined;
  size?: number;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`${firstName(fullName)}, caregiver`}
        loading="lazy"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="grid place-items-center rounded-full bg-primary/10 font-display text-primary"
    >
      {initials(fullName)}
    </span>
  );
}
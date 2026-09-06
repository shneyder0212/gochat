"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function UserAvatar({
  name,
  color,
  src,
  size = "default",
  className,
}: {
  name: string;
  color: string;
  src?: string;
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  return (
    <Avatar size={size} className={className}>
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback className={cn("font-semibold text-slate-950")} style={{ backgroundColor: color }}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

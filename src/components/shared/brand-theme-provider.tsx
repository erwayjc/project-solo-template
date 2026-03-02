"use client";

import { useBrandTheme } from "@/hooks/use-brand-theme";

interface BrandThemeProviderProps {
  children: React.ReactNode;
}

export function BrandThemeProvider({ children }: BrandThemeProviderProps) {
  const { colors } = useBrandTheme();

  return (
    <div
      style={
        {
          "--brand-primary": colors.primary,
          "--brand-secondary": colors.secondary,
          "--brand-accent": colors.accent,
          "--brand-background": colors.background,
          "--brand-text": colors.text,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

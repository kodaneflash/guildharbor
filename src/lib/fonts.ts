import localFont from "next/font/local";

export const openRunde = localFont({
  src: [
    {
      path: "../../public/family-wallet/open-runde-regular.woff",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/family-wallet/open-runde-medium.woff",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/family-wallet/open-runde-semibold.woff",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-open-runde",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
  preload: true,
});

interface TypographyScale {
  readonly body: {
    readonly lg: string;
    readonly md: string;
    readonly sm: string;
    readonly xs: string;
  };
  readonly display: {
    readonly lg: string;
    readonly md: string;
    readonly sm: string;
    readonly xl: string;
  };
  readonly heading: {
    readonly lg: string;
    readonly md: string;
    readonly sm: string;
    readonly xl: string;
  };
  readonly label: {
    readonly md: string;
    readonly sm: string;
  };
}

/** Semantic type roles shared by pages and reusable components. */
export const typography = {
  display: {
    xl: "font-display text-display-xl",
    lg: "font-display text-display-lg",
    md: "font-display text-display-md",
    sm: "font-display text-display-sm",
  },
  heading: {
    xl: "font-sans text-heading-xl",
    lg: "font-sans text-heading-lg",
    md: "font-sans text-heading-md",
    sm: "font-sans text-heading-sm",
  },
  body: {
    lg: "font-sans text-body-xl text-pretty",
    md: "font-sans text-body-md text-pretty",
    sm: "font-sans text-body-sm text-pretty",
    xs: "font-sans text-body-xs text-pretty",
  },
  label: {
    md: "font-sans text-label-md",
    sm: "font-sans text-label-sm",
  },
} as const satisfies TypographyScale;

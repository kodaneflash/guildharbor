type TelegramLogoProps = {
  className?: string;
};

function TelegramLogo({ className }: TelegramLogoProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 496 512"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M446.7 98.6l-67.6 318.8c-5.1 22.5-18.4 28.1-37.3 17.5l-103-75.9-49.7 47.8c-5.5 5.5-10.1 10.1-20.7 10.1l7.4-104.9 190.9-172.5c8.3-7.4-1.8-11.5-12.9-4.1l-235.8 148.3-101.5-31.7c-22.1-6.9-22.5-22.1 4.6-32.7L418.2 89.4c18.4-6.7 34.5 4.4 28.5 32.2z" />
    </svg>
  );
}

export function TelegramBadge() {
  return (
    <a
      href="https://t.me/cypherappsco"
      target="_blank"
      rel="noreferrer noopener"
      aria-label="Join our Telegram"
      className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[oklch(0.439_0_0/0.5)] px-3 py-1 text-sm text-[oklch(0.87_0_0)] focus:outline-none focus:ring-2 focus:ring-[oklch(0.708_0_0)]/60"
    >
      <TelegramLogo className="size-5" />
      <span className="whitespace-nowrap">Join our Telegram</span>
    </a>
  );
}

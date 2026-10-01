"use client";

import { OTPInput } from "input-otp";
import { ArrowRight, Fingerprint } from "lucide-react";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./family-wallet.module.css";
import type { DemoView } from "./family-wallet-demo";

interface ReturnProps { onBack: () => void; }
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_KEYS = ["first", "second", "third", "fourth", "fifth", "sixth"];
const methods = ["Email", "Phone", "Passkey"] as const;
type Method = (typeof methods)[number];
const providers = [
  ["Google", "google"],
  ["Discord", "discord"],
  ["GitHub", "github"],
  ["Apple", "apple"],
  ["Farcaster", "x"],
] as const;
const wallets = [
  ["Metamask", "metamask"],
  ["Coinbase", "coinbase"],
  ["Phantom", "phantom"],
  ["Trust Wallet", "trust"],
] as const;

export function DemoIcon({ name, size = 16 }: { name: string; size?: number }) {
  return (
    <Image
      alt=""
      aria-hidden
      height={size}
      src={`/family-wallet/${name}.svg`}
      unoptimized
      width={size}
    />
  );
}

export function SignInView({
  onEmailContinue,
  onGoogle,
  onNavigate,
  onUnavailable,
}: {
  onEmailContinue: (email: string) => void;
  onGoogle: () => void;
  onNavigate: (view: DemoView) => void;
  onUnavailable: (method: string) => void;
}) {
  const [method, setMethod] = useState<Method>("Email");
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const layoutId = useId();
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  const handleSubmit = () => {
    if (method === "Passkey") {
      onNavigate("passkey");
      return;
    }
    if (method === "Phone") {
      onUnavailable("Phone sign-in is unavailable until SMS is configured.");
      return;
    }
    if (!EMAIL_PATTERN.test(value)) {
      onUnavailable("Please enter a valid email address.");
      return;
    }
    onEmailContinue(value.trim());
  };
  return (
    <div className={styles.signIn}>
      <div className={styles.fields}>
        <div className={styles.socials}>
          {providers.map(([label, icon]) => (
            <button
              aria-label={`Sign in with ${label}`}
              key={label}
              onClick={label === "Google" ? onGoogle : undefined}
              type="button"
            >
              <DemoIcon name={icon} />
            </button>
          ))}
        </div>
        <div aria-label="Sign in method" className={styles.tabs} role="tablist">
          {methods.map((item, index) => (
            <button
              aria-selected={method === item}
              className={styles.tab}
              key={item}
              onClick={() => setMethod(item)}
              onKeyDown={(event) => {
                if (
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key
                  )
                ) {
                  return;
                }
                event.preventDefault();
                let next = (index + (event.key === "ArrowRight" ? 1 : 2)) % 3;
                if (event.key === "Home") {
                  next = 0;
                }
                if (event.key === "End") {
                  next = 2;
                }
                setMethod(methods[next]);
                const target =
                  event.currentTarget.parentElement?.children[next];
                if (target instanceof HTMLElement) {
                  target.focus();
                }
              }}
              role="tab"
              tabIndex={method === item ? 0 : -1}
              type="button"
            >
              {method === item && (
                <motion.div className={styles.indicator} layoutId={layoutId} />
              )}
              <span>{item}</span>
            </button>
          ))}
        </div>
        <form
          className={styles.entry}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          {method === "Passkey" ? (
            <span className={styles.passkeyLabel}>Login with passkey</span>
          ) : (
            <input
              aria-label={method}
              onChange={(event) => setValue(event.target.value)}
              placeholder={
                method === "Email" ? "yo@gxuri.me" : "+1 (555) 123-4567"
              }
              ref={inputRef}
              type={method === "Email" ? "email" : "tel"}
              value={value}
            />
          )}
          <button
            aria-label="Continue"
            className={styles.submit}
            disabled={method !== "Passkey" && !value.trim()}
            type="submit"
          >
            <ArrowRight aria-hidden size={20} />
          </button>
        </form>
      </div>
      <div className={styles.footer}>
        <div className={styles.separator}>
          <span>Or</span>
        </div>
        <button
          className={styles.primary}
          onClick={() => onNavigate("wallet")}
          type="button"
        >
          <DemoIcon name="wallet" size={20} />
          Connect Wallet
        </button>
      </div>
    </div>
  );
}

export function OtpView({
  method,
  destination,
  isPending,
  onVerify,
}: {
  method: "Email" | "Phone";
  destination?: string;
  isPending: boolean;
  onVerify?: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  const handleVerify = () => {
    if (onVerify && code.length === 6) onVerify(code);
  };
  return (
    <div className={styles.otpBody}>
      <div>
        <p>Enter the verification code sent to</p>
        <h3>{method === "Email" ? destination ?? "your email" : "+1 (555) 123-4567"}</h3>
      </div>
      <div className={styles.otpForm}>
        <OTPInput
          aria-label="Verification code"
          containerClassName={styles.otpSlots}
          maxLength={6}
          inputMode="numeric"
          pattern="[0-9]*"
          value={code}
          onChange={setCode}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleVerify();
            }
          }}
          ref={inputRef}
          render={({ slots }) => (
            <>
              {slots.map((slot, index) => (
                <div
                  aria-hidden
                  className={styles.otpSlot}
                  data-active={slot.isActive}
                  key={OTP_KEYS[index]}
                >
                  {slot.char}
                  {slot.hasFakeCaret && <span className={styles.caret} />}
                </div>
              ))}
            </>
          )}
        />
        <button
          className={`${styles.primary} ${styles.verify}`}
          disabled={!onVerify || code.length !== 6 || isPending}
          onClick={handleVerify}
          type="button"
        >
          Verify Code
        </button>
      </div>
    </div>
  );
}

export function PasswordView({ email, isPending, onSubmit }: {
  email: string;
  isPending: boolean;
  onSubmit: (password: string) => void;
}) {
  const [password, setPassword] = useState("");
  return (
    <form className={styles.passwordBody} onSubmit={(event) => { event.preventDefault(); onSubmit(password); }}>
      <p>Sign in as <strong>{email}</strong></p>
      <label htmlFor="family-wallet-password">Password</label>
      <div className={styles.entry}>
        <input id="family-wallet-password" autoComplete="current-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} />
      </div>
      <button className={styles.primary} disabled={!password || isPending}>Sign In</button>
    </form>
  );
}

export function GoogleCheckView({ children, isPending, isReady, onSubmit }: {
  children: React.ReactNode;
  isPending: boolean;
  isReady: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className={styles.googleBody}>
      <p>Complete the security check to continue with Google.</p>
      {children}
      <button className={styles.primary} disabled={!isReady || isPending} onClick={onSubmit} type="button">Continue with Google</button>
    </div>
  );
}

function PasskeySpinner() {
  const rectRef = useRef<SVGRectElement>(null);
  const progress = useMotionValue(0);
  const reducedMotion = useReducedMotion();
  // The border follows a rounded SVG path, as in the rendered reference.
  useAnimationFrame((time) => {
    const length = rectRef.current?.getTotalLength();
    if (length && !reducedMotion) {
      progress.set(((time * length) / 1500) % length);
    }
  });
  const x = useTransform(
    progress,
    (position) => rectRef.current?.getPointAtLength(position).x ?? 0
  );
  const y = useTransform(
    progress,
    (position) => rectRef.current?.getPointAtLength(position).y ?? 0
  );
  return (
    <div aria-hidden className={styles.spinner}>
      <svg
        aria-hidden="true"
        className={styles.spinnerPath}
        height="100%"
        preserveAspectRatio="none"
        width="100%"
      >
        <rect
          fill="none"
          height="100%"
          ref={rectRef}
          rx="30%"
          ry="30%"
          width="100%"
        />
      </svg>
      <motion.div className={styles.spark} style={{ x, y }} />
      <div className={styles.fingerprint}>
        <Fingerprint size={32} />
      </div>
    </div>
  );
}

export function PasskeyView({ onBack }: ReturnProps) {
  return (
    <div className={styles.passkeyBody}>
      <PasskeySpinner />
      <div>
        <h3>Waiting for passkey</h3>
        <p>Please follow prompts to verify your passkey.</p>
      </div>
      <button
        className={styles.primary}
        onClick={onBack}
        type="button"
      >
        Continue
      </button>
    </div>
  );
}

export function WalletView({ onBack }: ReturnProps) {
  return (
    <div className={styles.walletBody}>
      {wallets.map(([label, icon]) => (
        <button
          className={styles.walletRow}
          key={icon}
          onClick={onBack}
          type="button"
        >
          <span>{label}</span>
          <span className={icon === "phantom" ? styles.phantom : undefined}>
            <DemoIcon
              name={icon}
              size={
                { trust: 32, phantom: 16, metamask: 24, coinbase: 24 }[icon]
              }
            />
          </span>
        </button>
      ))}
      <button
        className={styles.walletRow}
        onClick={onBack}
        type="button"
      >
        <span className={styles.otherLabel}>
          Other Wallets<span className={styles.badge}>350+</span>
        </span>
        <span className={styles.walletBadge}>
          <DemoIcon name="wallet" size={20} />
        </span>
      </button>
      <button
        className={styles.noWallet}
        onClick={onBack}
        type="button"
      >
        <DemoIcon name="wallet" size={20} />I Don&apos;t Have a Wallet
      </button>
    </div>
  );
}

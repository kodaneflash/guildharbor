"use client";

import { ChevronLeft, Plus } from "lucide-react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Drawer } from "vaul";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Turnstile } from "@/components/turnstile";
import styles from "./family-wallet.module.css";
import {
  GoogleCheckView,
  OtpView,
  PasskeyView,
  PasswordView,
  SignInView,
  WalletView,
} from "./family-wallet-views";

export type DemoView =
  | "signin"
  | "password"
  | "email-otp"
  | "phone-otp"
  | "passkey"
  | "google-check"
  | "wallet";
interface FamilyWalletDemoProps {
  isConfigured: boolean;
  isGoogleConfigured: boolean;
  returnTo: string;
}
const titles: Record<DemoView, string> = {
  signin: "Sign In",
  password: "Enter Password",
  "email-otp": "Confirm Email",
  "phone-otp": "Confirm Phone",
  passkey: "Passkey",
  "google-check": "Security Check",
  wallet: "Connect Wallet",
};

export function FamilyWalletDemo({ isConfigured, isGoogleConfigured, returnTo }: FamilyWalletDemoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<DemoView>("signin");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [googleToken, setGoogleToken] = useState("");
  const [googleAttempt, setGoogleAttempt] = useState(0);
  const reducedMotion = useReducedMotion();
  const [height, setHeight] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);
  const measureView = useCallback((element: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(() => setHeight(element.offsetHeight));
    observer.observe(element);
    observerRef.current = observer;
  }, []);
  useEffect(() => () => observerRef.current?.disconnect(), []);
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setView("signin");
      setStatus("");
    }
    setIsOpen(open);
  };
  const handleBack = () => {
    setStatus("");
    setView("signin");
  };
  const handleEmailContinue = (value: string) => {
    if (!isConfigured) {
      setStatus("The account service is temporarily unavailable.");
      return;
    }
    setEmail(value);
    setStatus("");
    setView("password");
  };
  async function handlePasswordSignIn(password: string) {
    setIsPending(true);
    setStatus("");
    const result = await authClient.signIn.email({ email, password, callbackURL: returnTo });
    setIsPending(false);
    if (result.error) {
      if (result.error.code === "EMAIL_NOT_VERIFIED") {
        setView("email-otp");
        const response = await fetch("/api/auth/email-otp/send-verification-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, type: "email-verification" }),
        });
        setStatus(response.ok ? "A verification code has been requested." : "Unable to request a verification code. Try again.");
      } else {
        setStatus("Email or password is incorrect.");
      }
      return;
    }
    if (!result.data) {
      setStatus("Unable to sign in. Try again.");
      return;
    }
    if ("twoFactorRedirect" in result.data && result.data.twoFactorRedirect) return;
    window.location.assign(returnTo);
  }
  async function handleVerifyEmail(code: string) {
    setIsPending(true);
    setStatus("");
    const response = await fetch("/api/auth/email-otp/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp: code }),
    });
    setIsPending(false);
    if (!response.ok) {
      setStatus("Unable to verify that code. Check it and try again.");
      return;
    }
    window.location.assign(returnTo);
  }
  async function handleGoogleSignIn() {
    setIsPending(true);
    setStatus("");
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: `/onboarding/username?returnTo=${encodeURIComponent(returnTo)}`,
      newUserCallbackURL: `/onboarding/username?returnTo=${encodeURIComponent(returnTo)}`,
      errorCallbackURL: "/sign-in?error=oauth",
      fetchOptions: { headers: { "x-turnstile-token": googleToken } },
    });
    setIsPending(false);
    if (result.error) {
      setStatus(result.error.message ?? "Unable to sign in with Google.");
      setGoogleToken("");
      setGoogleAttempt((value) => value + 1);
    }
  }
  return (
    <MotionConfig reducedMotion="user">
      <div className={styles.demo}>
        <Drawer.Root onOpenChange={handleOpenChange} open={isOpen}>
          <div className={styles.stage}>
            <div className={styles.hint}>
              <span>Click to open sign in</span>
            </div>
            <Drawer.Trigger className={styles.trigger}>Sign In</Drawer.Trigger>
          </div>
          <p className={styles.caption}>
            New here? <Link href={`/sign-up?returnTo=${encodeURIComponent(returnTo)}`}>Create an account</Link>
            {" · "}<Link href="/forgot-password">Forgot password?</Link>
          </p>
          <Drawer.Portal>
            <Drawer.Overlay className={styles.overlay} />
            <Drawer.Content className={styles.drawer}>
              <Drawer.Title className={styles.srOnly}>
                {titles[view]}
              </Drawer.Title>
              <Drawer.Description className={styles.srOnly}>
                Sign in with email and password or Google. Phone and passkey sign-in are unavailable.
              </Drawer.Description>
              <motion.div
                animate={{ height }}
                transition={{
                  duration: reducedMotion ? 0 : 0.27,
                  ease: [0.25, 1, 0.5, 1],
                }}
              >
                <Drawer.Close
                  aria-label="Close sign in"
                  className={`${styles.circle} ${styles.close}`}
                >
                  <Plus aria-hidden className={styles.cross} size={24} />
                </Drawer.Close>
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.div
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className={styles.view}
                    exit={{ opacity: 0, scale: reducedMotion ? 1 : 0.96 }}
                    initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.96 }}
                    key={view}
                    ref={measureView}
                    transition={{
                      duration: reducedMotion ? 0 : 0.27,
                      ease: [0.26, 0.08, 0.25, 1],
                    }}
                  >
                    <div
                      className={`${styles.header} ${view === "signin" ? styles.initialHeader : ""}`}
                    >
                      {view !== "signin" && (
                        <button
                          aria-label="Back to sign in"
                          className={styles.circle}
                          onClick={handleBack}
                          type="button"
                        >
                          <ChevronLeft aria-hidden size={24} />
                        </button>
                      )}
                      <h2>{titles[view]}</h2>
                      {view !== "signin" && (
                        <span aria-hidden className={styles.headerSpacer} />
                      )}
                    </div>
                    {view === "signin" && (
                      <SignInView
                        onEmailContinue={handleEmailContinue}
                        onGoogle={() => {
                          if (!isConfigured || !isGoogleConfigured) {
                            setStatus("Google sign-in is unavailable.");
                            return;
                          }
                          setStatus("");
                          setGoogleToken("");
                          setView("google-check");
                        }}
                        onNavigate={(next) => { setStatus(""); setView(next); }}
                        onUnavailable={setStatus}
                      />
                    )}
                    {view === "password" && (
                      <PasswordView email={email} isPending={isPending || !isConfigured} onSubmit={handlePasswordSignIn} />
                    )}
                    {(view === "email-otp" || view === "phone-otp") && (
                      <OtpView
                        method={view === "email-otp" ? "Email" : "Phone"}
                        destination={view === "email-otp" ? email : undefined}
                        isPending={isPending}
                        onVerify={view === "email-otp" ? handleVerifyEmail : undefined}
                      />
                    )}
                    {view === "passkey" && (
                      <PasskeyView onBack={handleBack} />
                    )}
                    {view === "google-check" && (
                      <GoogleCheckView
                        isPending={isPending}
                        isReady={!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || Boolean(googleToken)}
                        onSubmit={handleGoogleSignIn}
                      >
                        <Turnstile onToken={setGoogleToken} attempt={googleAttempt} />
                      </GoogleCheckView>
                    )}
                    {view === "wallet" && (
                      <WalletView onBack={handleBack} />
                    )}
                    {status && <p className={styles.authStatus} role="status">{status}</p>}
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      </div>
    </MotionConfig>
  );
}

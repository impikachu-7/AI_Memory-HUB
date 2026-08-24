/** Quiet Intelligence Console authentication: generous calm space, unambiguous steps, and no fabricated account actions. */

import { BrandLockup } from "@/components/BrandMark";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { api } from "@/services/api";
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

type AuthMode = "login" | "register" | "google" | "verify" | "forgot" | "reset";

function AuthShell({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[0.9fr_1.1fr]">
      <div className="relative hidden overflow-hidden bg-[color:var(--ink-soft)] p-10 text-white lg:flex lg:flex-col">
        <Link href="/"><BrandLockup className="[&>span]:text-white" /></Link>
        <div className="relative z-10 my-auto max-w-[430px]"><p className="index-label text-white/55">{label}</p><h1 className="font-display mt-5 text-[52px] font-semibold leading-[0.98] tracking-[-0.06em]">A private memory layer for every model you choose.</h1><p className="mt-6 leading-7 text-white/65">Build a clear record of what matters, then carry that context between connected AI providers and local models.</p><div className="mt-10 space-y-4">{['Memory stays separate from conversation history', 'Model selection remains explicit', 'Data controls stay visible'].map((line) => <p key={line} className="flex items-center gap-3 text-sm text-white/75"><CheckCircle2 className="h-4 w-4 text-[color:var(--memory-teal-light)]" />{line}</p>)}</div></div>
        <div className="relative z-10 text-xs text-white/45">AI Memory Hub · User-controlled context</div><div className="absolute -bottom-16 -right-16 h-[360px] w-[360px] rounded-full border-[60px] border-white/[0.06]" /><div className="absolute left-0 top-[27%] h-px w-full bg-gradient-to-r from-transparent via-[color:var(--memory-teal)]/60 to-transparent" />
      </div>
      <div className="relative flex min-h-screen items-center justify-center px-5 py-10 sm:px-8"><div className="absolute right-6 top-5 flex items-center gap-3"><Link href="/" className="hidden text-xs font-bold text-muted-foreground hover:text-foreground sm:inline">Back to site</Link><ThemeToggle /></div><div className="w-full max-w-[430px]">{children}</div></div>
    </div>
  );
}

function AuthTitle({ title, subtitle }: { title: string; subtitle: string }) { return <><p className="index-label text-[color:var(--memory-teal-deep)] dark:text-[color:var(--memory-teal-light)]">Secure access</p><h2 className="font-display mt-3 text-[34px] font-semibold tracking-[-0.055em]">{title}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{subtitle}</p></>; }
function Field({
  label,
  type = "text",
  placeholder,
  icon,
  right,
  value,
  onChange,
  minLength,
}: {
  label: string;
  type?: string;
  placeholder: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-foreground">
        {label}
      </span>

      <span className="relative block">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </span>
        )}

        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          minLength={minLength}
          className={`h-11 w-full rounded-xl border border-input bg-card text-sm outline-none transition placeholder:text-muted-foreground/75 focus:border-[color:var(--memory-teal)] focus:ring-4 focus:ring-[color:color-mix(in_oklab,var(--memory-teal)_13%,transparent)] ${
            icon ? "pl-10" : "px-3.5"
          } ${right ? "pr-11" : "pr-3.5"}`}
        />

        {right}
      </span>
    </label>
  );
}
 function SolidButton({ children, onClick, disabled = false }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) { return <button onClick={onClick} disabled={disabled} type="button" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--memory-teal)] px-4 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[color:var(--memory-teal-deep)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60">{children}</button>; }
function GoogleButton({ onClick }: { onClick: () => void }) { return <button onClick={onClick} type="button" className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-card text-sm font-bold transition hover:bg-secondary active:scale-[0.97]"><span className="font-display text-lg font-bold text-[#4285F4]">G</span> Continue with Google</button>; }

export default function AuthPage({ mode }: { mode: AuthMode }) {
  const [, navigate] = useLocation();
  const { signIn, verifyEmail } = useAuth();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [notice, setNotice] = useState(false);
  const [email, setEmail] = useState(() => sessionStorage.getItem("ai-memory-hub.pending-email") ?? "");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const showError = (error: unknown) => toast.error(error instanceof Error ? error.message : "Request failed");

  const handleRegisterOrLogin = async () => {
    if (mode === "register" && password.length < 12) {
      showError("Password must be at least 12 characters.");
      return;
    }
    setIsLoading(true);
    try {
      if (mode === "register") {
        await api.auth.register(email, password, fullName);
        sessionStorage.setItem("ai-memory-hub.pending-email", email);
        navigate("/verify-email");
      } else {
        await signIn(email, password);
        navigate("/chat");
      }
    } catch (error) {
      showError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (otp.length !== 6) {
      showError("Enter the six-digit verification code.");
      return;
    }
    setIsLoading(true);
    try {
      await verifyEmail(email, otp);
      sessionStorage.removeItem("ai-memory-hub.pending-email");
      navigate("/chat");
    } catch (error) {
      showError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setIsLoading(true);
    try {
      await api.auth.resendVerification(email);
      setNotice(true);
    } catch (error) {
      showError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestReset = async () => {
    setIsLoading(true);
    try {
      await api.auth.requestPasswordReset(email);
      sessionStorage.setItem("ai-memory-hub.pending-email", email);
      navigate("/reset-password");
    } catch (error) {
      showError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyReset = async () => {
    if (otp.length !== 6) {
      showError("Enter the six-digit reset code.");
      return;
    }
    setIsLoading(true);
    try {
      const response = await api.auth.verifyReset(email, otp);
      setResetToken(response.reset_token);
      setNotice(true);
    } catch (error) {
      showError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 12) {
      showError("Password must be at least 12 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showError("Passwords do not match.");
      return;
    }
    setIsLoading(true);
    try {
      await api.auth.resetPassword(resetToken, newPassword);
      sessionStorage.removeItem("ai-memory-hub.pending-email");
      setNotice(true);
    } catch (error) {
      showError(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (mode === "verify") return <AuthShell label="Email verification"><div><Link href="/register" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground transition hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back to registration</Link><div className="mt-9"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:color-mix(in_oklab,var(--memory-teal)_13%,transparent)]"><Mail className="h-5 w-5 text-[color:var(--memory-teal)]" /></span><div className="mt-6"><AuthTitle title="Confirm your email" subtitle="Enter the six-digit code sent to your inbox. This first-time verification protects your workspace." /></div><div className="mt-8 space-y-5"><Field label="Email address" type="email" placeholder="you@example.com" icon={<Mail className="h-4 w-4" />} value={email} onChange={(event) => setEmail(event.target.value)} /><Field label="Verification code" placeholder="123456" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} /></div><div className="mt-5 space-y-3"><SolidButton onClick={handleVerifyEmail} disabled={isLoading}><ShieldCheck className="h-4 w-4" /> {isLoading ? "Verifying..." : "Verify email"}</SolidButton><button type="button" onClick={handleResendVerification} disabled={isLoading} className="w-full text-xs font-bold text-[color:var(--memory-teal-deep)] disabled:opacity-60 dark:text-[color:var(--memory-teal-light)]">{isLoading ? "Sending..." : "Resend verification code"}</button>{notice && <p className="text-center text-xs text-muted-foreground">If the account is eligible, a new code has been sent.</p>}</div></div></div></AuthShell>;

  if (mode === "google") return <AuthShell label="Google sign in"><div><Link href="/login" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground transition hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Other sign-in options</Link><div className="mt-9 rounded-2xl border border-border bg-card p-6 sm:p-8"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4285F4]/10 font-display text-2xl font-bold text-[#4285F4]">G</div><h2 className="font-display mt-6 text-[30px] font-semibold tracking-[-0.05em]">Continue with Google</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Your Google account handles sign-in. AI Memory Hub will request only the access needed to identify your account.</p><GoogleButton onClick={() => { api.auth.beginGoogleOAuth().then(({ authorization_url }) => { window.location.assign(authorization_url); }).catch(showError); }} /><p className="mt-5 text-center text-[11px] leading-5 text-muted-foreground">By continuing, you will be redirected to your configured authentication service.</p></div></div></AuthShell>;

  if (mode === "reset") return <AuthShell label="Account recovery"><div><Link href="/forgot-password" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground transition hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back to email entry</Link><div className="mt-9"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:color-mix(in_oklab,var(--memory-teal)_13%,transparent)]"><LockKeyhole className="h-5 w-5 text-[color:var(--memory-teal)]" /></span><div className="mt-6"><AuthTitle title={resetToken ? "Choose a new password" : "Enter your reset code"} subtitle={resetToken ? "Your reset code is verified. Choose a new password for your account." : "Enter the six-digit code sent if the account exists."} /></div><div className="mt-8 space-y-5"><Field label="Email address" type="email" placeholder="you@example.com" icon={<Mail className="h-4 w-4" />} value={email} onChange={(event) => setEmail(event.target.value)} />{!resetToken ? <><Field label="Reset code" placeholder="123456" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} /><SolidButton onClick={handleVerifyReset} disabled={isLoading}>{isLoading ? "Checking..." : "Verify reset code"} <ArrowRight className="h-4 w-4" /></SolidButton></> : <><Field label="New password" type="password" placeholder="At least 12 characters" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={12} /><Field label="Confirm new password" type="password" placeholder="Re-enter your password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={12} /><SolidButton onClick={handleResetPassword} disabled={isLoading}>{isLoading ? "Resetting..." : "Reset password"} <ArrowRight className="h-4 w-4" /></SolidButton></>}{notice && resetToken && <p className="rounded-xl border border-[color:color-mix(in_oklab,var(--memory-teal)_28%,transparent)] bg-[color:color-mix(in_oklab,var(--memory-teal)_7%,transparent)] p-3 text-xs leading-5 text-[color:var(--memory-teal-deep)] dark:text-[color:var(--memory-teal-light)]">Password reset successfully. <Link href="/login" className="font-bold underline">Return to sign in.</Link></p>}</div></div></div></AuthShell>;

  if (mode === "forgot") return <AuthShell label="Account recovery"><div><Link href="/login" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground transition hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back to sign in</Link><div className="mt-9"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:color-mix(in_oklab,var(--memory-teal)_13%,transparent)]"><LockKeyhole className="h-5 w-5 text-[color:var(--memory-teal)]" /></span><div className="mt-6"><AuthTitle title="Reset your password" subtitle="Enter your email to receive a password reset code if the account exists." /></div><div className="mt-8 space-y-5"><Field label="Email address" type="email" placeholder="you@example.com" icon={<Mail className="h-4 w-4" />} value={email} onChange={(event) => setEmail(event.target.value)} /><SolidButton onClick={handleRequestReset} disabled={isLoading}>{isLoading ? "Sending..." : "Send reset code"} <ArrowRight className="h-4 w-4" /></SolidButton>{notice && <p className="rounded-xl border border-[color:color-mix(in_oklab,var(--memory-teal)_28%,transparent)] bg-[color:color-mix(in_oklab,var(--memory-teal)_7%,transparent)] p-3 text-xs leading-5 text-[color:var(--memory-teal-deep)] dark:text-[color:var(--memory-teal-light)]">If the account exists, a password reset code has been sent.</p>}</div></div></div></AuthShell>;

  const isRegister = mode === "register";
  return <AuthShell label={isRegister ? "Create your workspace" : "Welcome back"}><div className="lg:hidden"><Link href="/"><BrandLockup /></Link></div><div className="mt-9 lg:mt-0"><AuthTitle title={isRegister ? "Create your private hub" : "Sign in to your workspace"} subtitle={isRegister ? "Start with a verified account, then connect only the AI providers you choose." : "Continue with your user-controlled AI memory workspace."} /><div className="mt-8 space-y-5">{isRegister && <Field label="Full name" placeholder="Alex Morgan" value={fullName} onChange={(event) => setFullName(event.target.value)} />}{isRegister && <Field label="Email address" type="email" placeholder="you@example.com" icon={<Mail className="h-4 w-4" />} value={email} onChange={(event) => setEmail(event.target.value)} />}{!isRegister && <Field label="Email address" type="email" placeholder="you@example.com" icon={<Mail className="h-4 w-4" />} value={email} onChange={(event) => setEmail(event.target.value)} />}<Field label="Password" type={passwordVisible ? "text" : "password"} placeholder="At least 12 characters" icon={<LockKeyhole className="h-4 w-4" />} value={password} onChange={(event) => setPassword(event.target.value)} minLength={isRegister ? 12 : undefined} right={<button type="button" onClick={() => setPasswordVisible((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={passwordVisible ? 'Hide password' : 'Show password'}>{passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>} />{!isRegister && <div className="flex justify-end"><Link href="/forgot-password" className="text-xs font-bold text-[color:var(--memory-teal-deep)] dark:text-[color:var(--memory-teal-light)]">Forgot password?</Link></div>}<SolidButton onClick={handleRegisterOrLogin} disabled={isLoading}>{isLoading ? (isRegister ? "Creating..." : "Signing in...") : (isRegister ? "Create account" : "Sign in")} <ArrowRight className="h-4 w-4" /></SolidButton></div><div className="my-6 flex items-center gap-3 text-[11px] text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">or</div><GoogleButton onClick={() => navigate("/auth/google")} /><p className="mt-7 text-center text-xs text-muted-foreground">{isRegister ? <>Already have an account? <Link href="/login" className="font-bold text-[color:var(--memory-teal-deep)] dark:text-[color:var(--memory-teal-light)]">Sign in</Link></> : <>New to AI Memory Hub? <Link href="/register" className="font-bold text-[color:var(--memory-teal-deep)] dark:text-[color:var(--memory-teal-light)]">Create account</Link></>}</p></div></AuthShell>;
}

"use client";

import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Field, PasswordInput, TextInput } from "@/components/ui/field";
import { useSensitive } from "@/components/providers";
import { call, errorText } from "@/lib/firebase/api";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { signInWithGoogle } from "@/lib/native/shell";
import { PASSWORD_RESET_NOTICE } from "@shared/auth-action";

const schema = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.string().trim().email("Adresse invalide."),
  password: z.string(),
});

export function AuthScreen({ mode }: { mode: "login" | "signup" | "reset" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const { setLocked } = useSensitive();
  const form = useForm({
    resolver: zodResolver(schema.superRefine((value, context) => {
      if (mode !== "reset" && value.password.length < 8) {
        context.addIssue({ code: "custom", path: ["password"], message: "8 caractères minimum." });
      }
    })),
    defaultValues: { name: "", email: "", password: "" },
  });

  async function onSubmit(values: { name?: string; email: string; password: string }) {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const auth = getFirebaseAuth();
      if (mode === "reset") {
        const result = await call<{ message: string }>("requestPasswordReset", { email: values.email });
        setInfo(result.message || PASSWORD_RESET_NOTICE);
        return;
      }
      if (mode === "signup") {
        if (!acceptedTerms) {
          setError("Cochez les conditions générales pour créer le compte.");
          return;
        }
        const credential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        if (values.name) await updateProfile(credential.user, { displayName: values.name });
        await call("ensureProfile", { acceptedTerms: true });
        if (!credential.user.emailVerified) await call("requestEmailVerification");
        setInfo("Compte créé. Si l'adresse n'est pas encore vérifiée, le message de confirmation part par le circuit Sous pli.");
      } else {
        await signInWithEmailAndPassword(auth, values.email, values.password);
      }
      router.push("/evenements");
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "login" ? "Connexion" : mode === "signup" ? "Créer un compte" : "Mot de passe oublié";

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="font-serif text-4xl text-pine-deep">{title}</h1>
      <form className="space-y-4 rounded-3xl border border-line bg-card p-5" onSubmit={form.handleSubmit(onSubmit)}>
        {mode === "signup" ? (
          <Field className="gap-4" label="Nom affiché" error={form.formState.errors.name?.message}>
            <TextInput {...form.register("name")} autoComplete="name" />
          </Field>
        ) : null}
        <Field className="gap-4" label="E-mail" error={form.formState.errors.email?.message}>
          <TextInput type="email" autoComplete="email" {...form.register("email")} />
        </Field>
        {mode !== "reset" ? (
          <Field className="gap-4" label="Mot de passe" error={form.formState.errors.password?.message}>
            <PasswordInput autoComplete={mode === "signup" ? "new-password" : "current-password"} {...form.register("password")} onFocus={() => setLocked(true)} onBlur={() => setLocked(false)} />
          </Field>
        ) : null}
        {mode === "signup" ? (
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={acceptedTerms} onChange={(input) => setAcceptedTerms(input.target.checked)} />
            <span>J'accepte les <Link className="text-pine" href="/conditions">conditions générales</Link>. La <Link className="text-pine" href="/confidentialite">politique de confidentialité</Link> se consulte à part. Cette case ne vaut pas consentement à la prospection.</span>
          </label>
        ) : null}
        {error ? <p className="text-sm text-burgundy">{error}</p> : null}
        {info ? <p className="text-sm text-pine">{info}</p> : null}
        <Button type="submit" busy={busy} className="w-full">{title}</Button>
      </form>
      {mode !== "reset" ? (
        <Button
          variant="secondary"
          className="w-full"
          onClick={async () => {
            setError("");
            try {
              if (mode === "signup" && !acceptedTerms) {
                setError("Cochez les conditions générales pour créer le compte.");
                return;
              }
              const result = await signInWithGoogle(getFirebaseAuth());
              if (mode === "signup") {
                await call("ensureProfile", { acceptedTerms: true });
                if (!result.user.emailVerified) await call("requestEmailVerification");
              }
              router.push("/evenements");
            } catch (caught) {
              setError(errorText(caught));
            }
          }}
        >
          Continuer avec Google
        </Button>
      ) : null}
      <div className="flex justify-between text-sm">
        <Link href={mode === "login" ? "/inscription" : "/connexion"} className="text-pine">{mode === "login" ? "Créer un compte" : "Déjà un compte"}</Link>
        <Link href="/mot-de-passe-oublie" className="text-pine">Mot de passe oublié</Link>
      </div>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { Camera, ChevronLeft, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { APP_NAME, DEMO_OTP, MAX_NAME_LENGTH } from "@/lib/constants";
import { formatPhone, getOrCreateUserId, saveProfile, type Profile } from "@/lib/profile";

const COUNTRIES = [
  { code: "+52", label: "México" },
  { code: "+57", label: "Colombia" },
  { code: "+34", label: "España" },
  { code: "+54", label: "Argentina" },
  { code: "+51", label: "Perú" },
  { code: "+56", label: "Chile" },
  { code: "+58", label: "Venezuela" },
  { code: "+1", label: "EE. UU." },
];

type Step = "welcome" | "phone" | "code" | "profile";

export function RegisterFlow({ onComplete }: { onComplete: (profile: Profile) => void }) {
  const [step, setStep] = useState<Step>("welcome");
  const [countryCode, setCountryCode] = useState("+52");
  const [national, setNational] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function go(next: Step) {
    setError(null);
    setStep(next);
  }

  function finish() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Escribe tu nombre (mínimo 2 letras).");
      return;
    }
    const profile: Profile = {
      userId: getOrCreateUserId(),
      name: trimmed.slice(0, MAX_NAME_LENGTH),
      phone: formatPhone(countryCode, national),
      countryCode,
      avatar,
    };
    saveProfile(profile);
    onComplete(profile);
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-auto bg-[#111b21] text-[#e9edef]">
      {step === "welcome" ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
          <div className="mb-8 flex size-28 items-center justify-center rounded-full bg-[#00a884]/15 ring-1 ring-[#00a884]/30">
            <MessageCircle className="size-14 text-[#00a884]" strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-light tracking-tight">{APP_NAME}</h1>
          <p className="mt-3 max-w-sm text-center text-sm leading-6 text-[#8696a0]">
            Mensajes, notas de voz, fotos, videos, documentos y llamadas grupales. Crea tu cuenta en un minuto.
          </p>
          <Button
            className="mt-10 h-11 w-full max-w-sm rounded-full bg-[#00a884] text-sm font-semibold text-[#111b21] hover:bg-[#06cf9c]"
            onClick={() => go("phone")}
          >
            Registrarme
          </Button>
          <p className="mt-6 max-w-xs text-center text-[11px] leading-4 text-[#667781]">
            Al continuar aceptas que este registro se guarda en este dispositivo. No enviamos SMS reales.
          </p>
        </div>
      ) : null}

      {step === "phone" ? (
        <form
          className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-8"
          onSubmit={(e) => {
            e.preventDefault();
            if (national.replace(/\D/g, "").length < 8) {
              setError("Escribe un número válido (al menos 8 dígitos).");
              return;
            }
            go("code");
          }}
        >
          <button
            type="button"
            className="mb-6 flex items-center gap-1 text-sm text-[#00a884]"
            onClick={() => go("welcome")}
          >
            <ChevronLeft className="size-4" /> Atrás
          </button>
          <h2 className="text-2xl font-light">Introduce tu número</h2>
          <p className="mt-2 text-sm text-[#8696a0]">
            {APP_NAME} usará este número para identificarte en los grupos. Elige tu país y escríbelo.
          </p>
          <label className="mt-8 block text-xs uppercase tracking-wide text-[#00a884]">País</label>
          <select
            value={countryCode}
            className="mt-1 h-11 w-full rounded-none border-0 border-b border-[#00a884] bg-transparent text-base outline-none"
            onChange={(e) => setCountryCode(e.target.value)}
          >
            {COUNTRIES.map((country) => (
              <option key={country.code} value={country.code} className="bg-[#111b21]">
                {country.label} ({country.code})
              </option>
            ))}
          </select>
          <label className="mt-6 block text-xs uppercase tracking-wide text-[#00a884]">Número de teléfono</label>
          <div className="mt-1 flex items-end gap-3">
            <span className="h-11 border-b border-[#00a884] px-1 pt-2 text-base">{countryCode}</span>
            <Input
              type="tel"
              inputMode="tel"
              enterKeyHint="next"
              autoComplete="tel-national"
              autoFocus
              value={national}
              placeholder="55 1234 5678"
              className="h-11 rounded-none border-0 border-b border-[#00a884] bg-transparent px-1 text-base shadow-none focus-visible:ring-0"
              onChange={(e) => setNational(e.target.value.replace(/[^\d\s]/g, ""))}
            />
          </div>
          {error ? <p className="mt-3 text-sm text-[#f87171]">{error}</p> : null}
          <Button
            type="submit"
            className="mt-10 h-11 w-full rounded-full bg-[#00a884] font-semibold text-[#111b21] hover:bg-[#06cf9c]"
          >
            Siguiente
          </Button>
        </form>
      ) : null}

      {step === "code" ? (
        <form
          className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-8"
          onSubmit={(e) => {
            e.preventDefault();
            if (code !== DEMO_OTP) {
              setError("El código no coincide. Usa el de la demo.");
              return;
            }
            go("profile");
          }}
        >
          <button
            type="button"
            className="mb-6 flex items-center gap-1 text-sm text-[#00a884]"
            onClick={() => go("phone")}
          >
            <ChevronLeft className="size-4" /> Atrás
          </button>
          <h2 className="text-2xl font-light">Verifica tu número</h2>
          <p className="mt-2 text-sm text-[#8696a0]">
            Introduce el código de 6 dígitos para {formatPhone(countryCode, national)}.
          </p>
          <p className="mt-4 rounded-lg bg-[#202c33] px-3 py-2 text-center text-sm text-[#00a884]">
            Código de esta demo: <span className="font-mono tracking-[0.35em]">{DEMO_OTP}</span>
          </p>
          <Input
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            enterKeyHint="done"
            autoFocus
            maxLength={6}
            value={code}
            placeholder="••••••"
            className="mt-8 h-14 rounded-none border-0 border-b border-[#00a884] bg-transparent text-center font-mono text-3xl tracking-[0.5em] shadow-none focus-visible:ring-0"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          {error ? <p className="mt-3 text-sm text-[#f87171]">{error}</p> : null}
          <Button
            type="submit"
            className="mt-10 h-11 w-full rounded-full bg-[#00a884] font-semibold text-[#111b21] hover:bg-[#06cf9c]"
          >
            Verificar
          </Button>
        </form>
      ) : null}

      {step === "profile" ? (
        <form
          className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-8"
          onSubmit={(e) => {
            e.preventDefault();
            finish();
          }}
        >
          <button
            type="button"
            className="mb-6 flex items-center gap-1 text-sm text-[#00a884]"
            onClick={() => go("code")}
          >
            <ChevronLeft className="size-4" /> Atrás
          </button>
          <h2 className="text-2xl font-light">Datos del perfil</h2>
          <p className="mt-2 text-sm text-[#8696a0]">
            Añade tu nombre y una foto. Así te verán en los grupos y las llamadas.
          </p>
          <div className="mt-10 flex flex-col items-center">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) {
                  setError("La foto debe pesar menos de 2 MB.");
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => setAvatar(String(reader.result));
                reader.readAsDataURL(file);
              }}
            />
            <button
              type="button"
              className="relative flex size-36 items-center justify-center overflow-hidden rounded-full bg-[#202c33] text-[#00a884] ring-2 ring-[#00a884]/40"
              onClick={() => fileRef.current?.click()}
            >
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" className="size-full object-cover" />
              ) : (
                <Camera className="size-12" />
              )}
            </button>
            <p className="mt-2 text-xs text-[#8696a0]">Toca para elegir foto</p>
          </div>
          <label className="mt-8 block text-xs uppercase tracking-wide text-[#00a884]">Tu nombre</label>
          <Input
            type="text"
            autoComplete="name"
            autoCapitalize="words"
            enterKeyHint="done"
            autoFocus
            maxLength={MAX_NAME_LENGTH}
            value={name}
            placeholder="¿Cómo te llamas?"
            className="mt-1 h-11 rounded-none border-0 border-b border-[#00a884] bg-transparent px-1 text-lg shadow-none focus-visible:ring-0"
            onChange={(e) => setName(e.target.value)}
          />
          {error ? <p className="mt-3 text-sm text-[#f87171]">{error}</p> : null}
          <Button
            type="submit"
            className="mt-10 h-11 w-full rounded-full bg-[#00a884] font-semibold text-[#111b21] hover:bg-[#06cf9c]"
          >
            Entrar a {APP_NAME}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

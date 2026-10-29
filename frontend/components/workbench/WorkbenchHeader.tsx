"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { readRememberedAccounts, rememberAccount, type RememberedPrismAccount } from "@/lib/prism-account-history";

export default function WorkbenchHeader() {
  const router = useRouter();
  const [user, setUser] = useState<RememberedPrismAccount | null>(null);
  const [accounts, setAccounts] = useState<RememberedPrismAccount[]>([]);
  const [open, setOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);

  useEffect(() => {
    fetch("/api/prism/auth").then((response) => response.json()).then((data) => {
      if (data.user?.email && (data.user.role === "admin" || data.user.role === "member")) {
        const current = { email: data.user.email, role: data.user.role } as RememberedPrismAccount;
        setUser(current);
        setAccounts(rememberAccount(window.localStorage, current));
      } else setAccounts(readRememberedAccounts(window.localStorage));
    });
  }, []);

  const useAccount = async (account: RememberedPrismAccount) => {
    const response = await fetch("/api/prism/auth/switch", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: account.email }),
    });
    if (response.ok) {
      setOpen(false); setSwitchOpen(false); router.refresh(); return;
    }
    router.push(`/login?email=${encodeURIComponent(account.email)}`);
  };

  const signOut = async () => {
    await fetch("/api/prism/auth", { method: "DELETE" });
    setUser(null); setOpen(false); setSwitchOpen(false);
    router.push("/login"); router.refresh();
  };

  return <header className="h-14 border-b border-[#dcdcdc] bg-white px-6 flex items-center justify-between shrink-0">
    <div><h1 className="text-base font-semibold">PRISM Workbench</h1><p className="text-xs text-[#525252]">Governed AI Platform</p></div>
    <div className="flex items-center gap-2 text-xs">
      <span className="rounded border p-1">{process.env.NEXT_PUBLIC_PRISM_ENV || "Production"}</span>
      {user ? <div className="relative">
        <button type="button" aria-expanded={open} onClick={() => { setOpen(!open); setSwitchOpen(false); }} className="rounded border px-2 py-1 text-left">{user.email} · {user.role}</button>
        {open && <div className="absolute right-0 z-20 mt-2 w-72 rounded border bg-white p-2 shadow-lg">
          <p className="px-2 py-1 text-xs text-[#525252]">Signed in as {user.email} ({user.role})</p>
          <button type="button" aria-expanded={switchOpen} className="w-full rounded px-2 py-2 text-left hover:bg-[#edf5ff]" onClick={() => setSwitchOpen(!switchOpen)}>Switch Account</button>
          {switchOpen && <div className="border-t pt-1">
            {accounts.map((account) => <button type="button" key={account.email} className="block w-full rounded px-2 py-2 text-left hover:bg-[#edf5ff]" onClick={() => useAccount(account)}>{account.email} <span className="text-[#525252]">· {account.role}</span></button>)}
            <button type="button" className="block w-full rounded px-2 py-2 text-left hover:bg-[#edf5ff]" onClick={() => router.push("/login")}>Use another account</button>
          </div>}
          <button type="button" className="block w-full rounded px-2 py-2 text-left text-red-700 hover:bg-[#fff1f1]" onClick={signOut}>Sign out</button>
        </div>}
      </div> : <Link href="/login" className="text-[#0f62fe]">Sign in</Link>}
    </div>
  </header>;
}

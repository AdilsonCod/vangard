import { useEffect, useState } from 'react';
import { collection, getDocs, increment, updateDoc, doc, addDoc } from 'firebase/firestore';
import { AlertTriangle, LoaderCircle } from 'lucide-react';
import { db } from '../firebase';
import { findSmartLinkByCode, resolveSmartLink, type SmartLink } from '../smartLinks';

function deviceType() {
  const width = window.innerWidth;
  return width < 768 ? 'mobile' : width < 1100 ? 'tablet' : 'desktop';
}

export default function PublicLinkRedirect({ code }: { code: string }) {
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'smart_links'));
        const record = findSmartLinkByCode(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as SmartLink)), code, new Date());
        if (!record) throw new Error('Este link não existe ou já foi removido.');
        const resolution = resolveSmartLink(record, new Date(), code);
        const target = resolution.url;
        if (!target) throw new Error(record.expiredMessage || resolution.reason);
        if (!/^https?:\/\//i.test(target)) throw new Error('O destino deste link não é válido.');
        await Promise.allSettled([
          updateDoc(doc(db, 'smart_links', record.id), { totalClicks: increment(1), lastClickAt: new Date().toISOString() }),
          addDoc(collection(db, 'smart_link_clicks'), {
            linkId: record.id,
            shortCode: record.shortCode,
            destinationUrl: target,
            phase: resolution.phase,
            cycleNumber: resolution.cycleNumber || null,
            timestamp: new Date().toISOString(),
            device: deviceType(),
            referrer: document.referrer || '',
          }),
        ]);
        if (!cancelled) window.location.replace(target);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Não foi possível abrir este link.');
      }
    };
    void resolve();
    return () => { cancelled = true; };
  }, [code]);

  return <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-white">
    <section className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-900 p-8 text-center shadow-2xl">
      {error ? <><AlertTriangle className="mx-auto h-10 w-10 text-amber-400"/><h1 className="mt-4 text-xl font-black">Link indisponível</h1><p className="mt-2 text-sm text-zinc-400">{error}</p></> : <><LoaderCircle className="mx-auto h-10 w-10 animate-spin text-emerald-400"/><h1 className="mt-4 text-xl font-black">Preparando seu acesso</h1><p className="mt-2 text-sm text-zinc-400">Você será direcionado em instantes.</p></>}
    </section>
  </main>;
}

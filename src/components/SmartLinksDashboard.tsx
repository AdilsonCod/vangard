import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import QRCode from "qrcode";
import {
  BarChart3,
  Copy,
  Download,
  ExternalLink,
  Link2,
  Pause,
  Play,
  Plus,
  QrCode,
  Search,
  TimerReset,
  Trash2,
  X,
} from "lucide-react";
import { db } from "../firebase";
import { useStore } from "../store";
import {
  resolveSmartLink,
  rotatingStatus,
  type SmartDestination,
  type SmartLink,
  type SmartLinkMode,
  type SmartSlugType,
  type SmartTimelineStep,
} from "../smartLinks";
import {
  AppBadge,
  AppButton,
  AppCard,
  AppEmptyState,
  AppPageHeader,
  AppSectionHeader,
  appControlClass,
} from "./ui/AppPrimitives";

type LinkDraft = {
  title: string;
  shortCode: string;
  baseSlug: string;
  mode: SmartLinkMode;
  slugType: SmartSlugType;
  customSlugs: string[];
  expireOldLinks: boolean;
  destinationUrl: string;
  destinations: SmartDestination[];
  rotationIntervalMinutes: number;
  rotationStartedAt: string;
  phaseOneUrl: string;
  phaseTwoUrl: string;
  switchDate: string;
  timelineSteps: SmartTimelineStep[];
  fallbackUrl: string;
  expiredMessage: string;
  maskUrl: boolean;
  maskTitle: string;
  maskFavicon: string;
  maxClicks?: number | null;
  tags: string[];
};
type ClickLog = {
  id: string;
  timestamp: string;
  device: string;
  destinationUrl: string;
  phase: string;
  shortCode: string;
};
type Filter = "all" | SmartLinkMode | "paused";
const localNow = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
const emptyDraft = (): LinkDraft => ({
  title: "",
  shortCode: "",
  baseSlug: "",
  mode: "infinite_loop",
  slugType: "hash_token",
  customSlugs: [],
  expireOldLinks: true,
  destinationUrl: "",
  destinations: [],
  rotationIntervalMinutes: 60,
  rotationStartedAt: new Date().toISOString(),
  phaseOneUrl: "",
  phaseTwoUrl: "",
  switchDate: new Date(Date.now() + 86400000).toISOString(),
  timelineSteps: [],
  fallbackUrl: "",
  expiredMessage: "Este link não está mais disponível.",
  maskUrl: false,
  maskTitle: "",
  maskFavicon: "",
  maxClicks: null,
  tags: [],
});
const url = (v: string) =>
  /^https?:\/\//i.test(v.trim()) ? v.trim() : `https://${v.trim()}`;
const slug = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
const labels: Record<SmartLinkMode, string> = {
  rotating_shortlink: "Link curto rotativo",
  infinite_loop: "Loop infinito",
  dual_switch: "Fase 1 → Fase 2",
  timeline: "Linha do tempo",
};

export default function SmartLinksDashboard() {
  const { currentUser } = useStore();
  const [links, setLinks] = useState<SmartLink[]>([]),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<SmartLink | null>(null),
    [draft, setDraft] = useState<LinkDraft>(emptyDraft()),
    [open, setOpen] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const [qr, setQr] = useState<{
      title: string;
      url: string;
      image: string;
    } | null>(null),
    [simulation, setSimulation] = useState<{
      link: SmartLink;
      at: string;
    } | null>(null),
    [analytics, setAnalytics] = useState<{
      link: SmartLink;
      logs: ClickLog[];
    } | null>(null);
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "smart_links"), orderBy("createdAt", "desc")),
        (s) =>
          setLinks(s.docs.map((x) => ({ id: x.id, ...x.data() }) as SmartLink)),
      ),
    [],
  );
  const visible = useMemo(
    () =>
      links
        .filter((x) =>
          filter === "all" || filter === "paused"
            ? !x.isActive
            : x.mode === filter,
        )
        .filter((x) =>
          `${x.title} ${x.shortCode} ${x.destinationUrl} ${x.tags?.join(" ")}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        ),
    [links, filter, search],
  );
  const origin = location.origin;
  const publicUrl = (code: string) => `${origin}/r/${code}`;
  const create = () => {
    setEditing(null);
    setDraft(emptyDraft());
    setError("");
    setOpen(true);
  };
  const edit = (x: SmartLink) => {
    setEditing(x);
    setDraft({
      title: x.title,
      shortCode: x.shortCode,
      baseSlug: x.baseSlug || x.shortCode,
      mode: x.mode || "infinite_loop",
      slugType: x.slugType || "hash_token",
      customSlugs: x.customSlugs || [],
      expireOldLinks: x.expireOldLinks !== false,
      destinationUrl: x.destinationUrl || "",
      destinations: x.destinations || [],
      rotationIntervalMinutes: x.rotationIntervalMinutes || 60,
      rotationStartedAt: x.rotationStartedAt || x.createdAt,
      phaseOneUrl: x.phaseOneUrl || "",
      phaseTwoUrl: x.phaseTwoUrl || "",
      switchDate: x.switchDate || new Date().toISOString(),
      timelineSteps: x.timelineSteps || [],
      fallbackUrl: x.fallbackUrl || "",
      expiredMessage: x.expiredMessage || "",
      maskUrl: !!x.maskUrl,
      maskTitle: x.maskTitle || "",
      maskFavicon: x.maskFavicon || "",
      maxClicks: x.maxClicks || null,
      tags: x.tags || [],
    });
    setError("");
    setOpen(true);
  };
  const save = async () => {
    const shortCode = slug(draft.shortCode || draft.title),
      baseSlug = slug(draft.baseSlug || shortCode);
    if (!draft.title.trim() || !shortCode)
      return setError("Informe o nome e o código do link.");
    if (
      links.some(
        (x) =>
          (x.shortCode === shortCode || x.baseSlug === baseSlug) &&
          x.id !== editing?.id,
      )
    )
      return setError("Este código ou prefixo já está em uso.");
    if (draft.mode === "rotating_shortlink" && !draft.destinationUrl.trim())
      return setError("Informe o destino fixo.");
    if (
      draft.mode === "infinite_loop" &&
      draft.destinations.filter((x) => x.url.trim()).length < 2
    )
      return setError("Adicione pelo menos dois destinos.");
    if (
      draft.mode === "dual_switch" &&
      (!draft.phaseOneUrl.trim() || !draft.phaseTwoUrl.trim())
    )
      return setError("Informe as URLs das duas fases.");
    if (
      draft.mode === "timeline" &&
      !draft.timelineSteps.some((x) => x.url.trim() && x.startDate)
    )
      return setError("Adicione uma etapa válida.");
    setSaving(true);
    try {
      const now = new Date().toISOString(),
        clean = (v: string) => (v.trim() ? url(v) : "");
      const payload = {
        ...draft,
        title: draft.title.trim(),
        shortCode,
        baseSlug,
        destinationUrl: clean(draft.destinationUrl),
        phaseOneUrl: clean(draft.phaseOneUrl),
        phaseTwoUrl: clean(draft.phaseTwoUrl),
        fallbackUrl: clean(draft.fallbackUrl),
        maskFavicon: clean(draft.maskFavicon),
        destinations: draft.destinations
          .filter((x) => x.url.trim())
          .map((x) => ({
            ...x,
            name: x.name.trim() || "Destino",
            url: url(x.url),
            durationMinutes: Math.max(1, +x.durationMinutes || 1),
          })),
        timelineSteps: draft.timelineSteps
          .filter((x) => x.url.trim() && x.startDate)
          .map((x) => ({
            ...x,
            name: x.name.trim() || "Etapa",
            url: url(x.url),
            maxClicks: x.maxClicks ? Math.max(1, +x.maxClicks) : null,
            clickCount: x.clickCount || 0,
          })),
        rotationIntervalMinutes: Math.max(
          1,
          +draft.rotationIntervalMinutes || 1,
        ),
        maxClicks: draft.maxClicks ? Math.max(1, +draft.maxClicks) : null,
        tags: draft.tags.map((x) => x.trim()).filter(Boolean),
        updatedAt: now,
      };
      editing
        ? await setDoc(doc(db, "smart_links", editing.id), payload, {
            merge: true,
          })
        : await addDoc(collection(db, "smart_links"), {
            ...payload,
            ownerId: currentUser?.id || "",
            createdAt: now,
            totalClicks: 0,
            isActive: true,
          });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };
  const showQr = async (x: SmartLink) => {
    const code =
        x.mode === "rotating_shortlink"
          ? rotatingStatus(x).current
          : x.shortCode,
      u = publicUrl(code);
    setQr({
      title: x.title,
      url: u,
      image: await QRCode.toDataURL(u, { width: 480, margin: 2 }),
    });
  };
  const showAnalytics = async (x: SmartLink) => {
    const s = await getDocs(
      query(collection(db, "smart_link_clicks"), where("linkId", "==", x.id)),
    );
    setAnalytics({
      link: x,
      logs: s.docs
        .map((d) => ({ id: d.id, ...d.data() }) as ClickLog)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    });
  };
  const toggle = (x: SmartLink) =>
    setDoc(
      doc(db, "smart_links", x.id),
      { isActive: !x.isActive, updatedAt: new Date().toISOString() },
      { merge: true },
    );
  const remove = async (x: SmartLink) => {
    if (confirm(`Excluir “${x.title}”?`))
      await deleteDoc(doc(db, "smart_links", x.id));
  };
  return (
    <div className="space-y-5">
      <AppPageHeader
        eyebrow="Comunicação"
        title="Links inteligentes"
        description="Links rotativos, destinos dinâmicos, campanhas com prazo e análise de tráfego."
        icon={<Link2 className="h-5 w-5" />}
        actions={
          <AppButton variant="primary" onClick={create}>
            <Plus className="h-4 w-4" />
            Novo link
          </AppButton>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Links" value={links.length} />
        <Stat label="Ativos" value={links.filter((x) => x.isActive).length} />
        <Stat
          label="Cliques"
          value={links.reduce((n, x) => n + (x.totalClicks || 0), 0)}
        />
      </div>
      <AppCard className="p-4 sm:p-5">
        <AppSectionHeader
          title="Seus links"
          description="Ciclos calculados automaticamente por timestamp, sem cronjobs."
        />
        <div className="mt-4 flex flex-col gap-2 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              className={`${appControlClass} w-full pl-9`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar título, código ou URL..."
            />
          </div>
          <select
            className={appControlClass}
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
          >
            <option value="all">Todos</option>
            {Object.entries(labels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
            <option value="paused">Pausados</option>
          </select>
        </div>
        {!visible.length ? (
          <AppEmptyState
            className="mt-5"
            icon={<Link2 />}
            title="Nenhum link"
            description="Crie o primeiro link inteligente."
            action={
              <AppButton variant="primary" onClick={create}>
                Criar link
              </AppButton>
            }
          />
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {visible.map((x) => (
              <Card
                key={x.id}
                link={x}
                origin={origin}
                edit={() => edit(x)}
                qr={() => void showQr(x)}
                simulate={() => setSimulation({ link: x, at: localNow() })}
                analytics={() => void showAnalytics(x)}
                toggle={() => void toggle(x)}
                remove={() => void remove(x)}
              />
            ))}
          </div>
        )}
      </AppCard>
      {open && (
        <Editor
          draft={draft}
          set={setDraft}
          editing={editing}
          error={error}
          saving={saving}
          close={() => setOpen(false)}
          save={() => void save()}
        />
      )}{" "}
      {qr && <Qr value={qr} close={() => setQr(null)} />}{" "}
      {simulation && (
        <Simulator
          value={simulation}
          set={setSimulation}
          close={() => setSimulation(null)}
        />
      )}{" "}
      {analytics && (
        <Analytics value={analytics} close={() => setAnalytics(null)} />
      )}
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <AppCard className="p-4">
      <p className="text-xs font-bold uppercase text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-black">
        {Number.isFinite(Number(value))
          ? Number(value).toLocaleString("pt-BR")
          : value}
      </p>
    </AppCard>
  );
}
function Card({
  link,
  origin,
  edit,
  qr,
  simulate,
  analytics,
  toggle,
  remove,
}: {
  link: SmartLink;
  origin: string;
  edit: () => void;
  qr: () => void;
  simulate: () => void;
  analytics: () => void;
  toggle: () => void;
  remove: () => void;
}) {
  const r = resolveSmartLink(link),
    code =
      link.mode === "rotating_shortlink" ? r.activeShortCode : link.shortCode,
    u = `${origin}/r/${code}`;
  return (
    <article className="rounded-2xl border border-gray-200 p-4 dark:border-zinc-800">
      <div className="flex justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <h3 className="font-black">{link.title}</h3>
            <AppBadge tone={link.isActive ? "success" : "warning"}>
              {link.isActive ? "Ativo" : "Pausado"}
            </AppBadge>
            <AppBadge tone="info">{labels[link.mode]}</AppBadge>
          </div>
          <button
            className="mt-1 flex max-w-full items-center gap-1 text-xs font-bold text-[var(--theme-color)]"
            onClick={() => void navigator.clipboard.writeText(u)}
          >
            <span className="truncate">{u}</span>
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
        <button
          className="rounded-xl border p-2 dark:border-zinc-700"
          onClick={toggle}
        >
          {link.isActive ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-zinc-800">
          <span className="text-gray-400">Status atual</span>
          <strong className="block truncate">{r.label}</strong>
          {r.nextSwitchAt && (
            <span className="text-gray-400">
              até {new Date(r.nextSwitchAt).toLocaleString("pt-BR")}
            </span>
          )}
          <div className="mt-2 h-1.5 overflow-hidden rounded bg-gray-200 dark:bg-zinc-700">
            <div
              className="h-full rounded bg-[var(--theme-color)]"
              style={{ width: `${r.progressPercent}%` }}
            />
          </div>
        </div>
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-zinc-800">
          <span className="text-gray-400">Cliques</span>
          <strong className="block text-lg">{link.totalClicks || 0}</strong>
          {r.nextShortCode && (
            <span className="truncate text-gray-400">
              próximo: {r.nextShortCode}
            </span>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <AppButton onClick={() => void navigator.clipboard.writeText(u)}>
          <Copy className="h-4 w-4" />
          Copiar link
        </AppButton>
        <AppButton onClick={edit}>Editar</AppButton>
        <AppButton onClick={simulate}>
          <TimerReset className="h-4 w-4" />
          Simular
        </AppButton>
        <AppButton onClick={analytics}>
          <BarChart3 className="h-4 w-4" />
          Analytics
        </AppButton>
        <AppButton onClick={qr}>
          <QrCode className="h-4 w-4" />
        </AppButton>
        <AppButton onClick={() => open(u, "_blank")}>
          <ExternalLink className="h-4 w-4" />
        </AppButton>
        <button className="ml-auto p-2 text-red-500" onClick={remove}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function Editor({
  draft,
  set,
  editing,
  error,
  saving,
  close,
  save,
}: {
  draft: LinkDraft;
  set: (x: LinkDraft) => void;
  editing: SmartLink | null;
  error: string;
  saving: boolean;
  close: () => void;
  save: () => void;
}) {
  const addDest = () =>
    set({
      ...draft,
      destinations: [
        ...draft.destinations,
        {
          id: crypto.randomUUID(),
          name: `Etapa ${draft.destinations.length + 1}`,
          url: "",
          durationMinutes: 60,
        },
      ],
    });
  const addStep = () =>
    set({
      ...draft,
      timelineSteps: [
        ...draft.timelineSteps,
        {
          id: crypto.randomUUID(),
          name: `Etapa ${draft.timelineSteps.length + 1}`,
          url: "",
          startDate: new Date().toISOString(),
          clickCount: 0,
        },
      ],
    });
  return (
    <Modal close={close}>
      <Head title={editing ? "Editar link" : "Novo link"} close={close} />
      {error && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Nome">
          <input
            className={`${appControlClass} w-full`}
            value={draft.title}
            onChange={(e) => set({ ...draft, title: e.target.value })}
          />
        </Field>
        <Field label="Modo">
          <select
            className={`${appControlClass} w-full`}
            value={draft.mode}
            onChange={(e) =>
              set({ ...draft, mode: e.target.value as SmartLinkMode })
            }
          >
            {Object.entries(labels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={
            draft.mode === "rotating_shortlink"
              ? "Prefixo inicial"
              : "Código curto"
          }
        >
          <input
            className={`${appControlClass} w-full`}
            value={draft.shortCode}
            onChange={(e) =>
              set({
                ...draft,
                shortCode: slug(e.target.value),
                baseSlug: slug(e.target.value),
              })
            }
          />
        </Field>
        <Field label="Destino se pausado/expirado">
          <input
            className={`${appControlClass} w-full`}
            value={draft.fallbackUrl}
            onChange={(e) => set({ ...draft, fallbackUrl: e.target.value })}
          />
        </Field>
      </div>
      {draft.mode === "rotating_shortlink" && (
        <Section title="Código rotativo">
          <Grid>
            <Field label="Destino fixo">
              <input
                className={`${appControlClass} w-full`}
                value={draft.destinationUrl}
                onChange={(e) =>
                  set({ ...draft, destinationUrl: e.target.value })
                }
              />
            </Field>
            <Field label="Intervalo em minutos">
              <input
                type="number"
                min="1"
                className={`${appControlClass} w-full`}
                value={draft.rotationIntervalMinutes}
                onChange={(e) =>
                  set({ ...draft, rotationIntervalMinutes: +e.target.value })
                }
              />
            </Field>
            <Field label="Tipo de slug">
              <select
                className={`${appControlClass} w-full`}
                value={draft.slugType}
                onChange={(e) =>
                  set({ ...draft, slugType: e.target.value as SmartSlugType })
                }
              >
                <option value="hash_token">Prefixo + token</option>
                <option value="sequential_number">Sequencial</option>
                <option value="custom_list">Lista personalizada</option>
              </select>
            </Field>
            {draft.slugType === "custom_list" && (
              <Field label="Lista de códigos">
                <input
                  className={`${appControlClass} w-full`}
                  value={draft.customSlugs.join(", ")}
                  onChange={(e) =>
                    set({
                      ...draft,
                      customSlugs: e.target.value
                        .split(",")
                        .map(slug)
                        .filter(Boolean),
                    })
                  }
                />
              </Field>
            )}
            <label className="flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={draft.expireOldLinks}
                onChange={(e) =>
                  set({ ...draft, expireOldLinks: e.target.checked })
                }
              />
              Expirar códigos antigos
            </label>
          </Grid>
        </Section>
      )}
      {draft.mode === "infinite_loop" && (
        <Section
          title="Loop de destinos"
          action={
            <AppButton onClick={addDest}>
              <Plus className="h-4 w-4" />
              Etapa
            </AppButton>
          }
        >
          <DestRows
            rows={draft.destinations}
            set={(x) => set({ ...draft, destinations: x })}
          />
        </Section>
      )}
      {draft.mode === "dual_switch" && (
        <Section title="Fases por prazo">
          <Grid>
            <Field label="URL da Fase 1">
              <input
                className={`${appControlClass} w-full`}
                value={draft.phaseOneUrl}
                onChange={(e) => set({ ...draft, phaseOneUrl: e.target.value })}
              />
            </Field>
            <Field label="URL da Fase 2">
              <input
                className={`${appControlClass} w-full`}
                value={draft.phaseTwoUrl}
                onChange={(e) => set({ ...draft, phaseTwoUrl: e.target.value })}
              />
            </Field>
            <Field label="Data/hora da troca">
              <input
                type="datetime-local"
                className={`${appControlClass} w-full`}
                value={toLocal(draft.switchDate)}
                onChange={(e) =>
                  set({
                    ...draft,
                    switchDate: new Date(e.target.value).toISOString(),
                  })
                }
              />
            </Field>
          </Grid>
        </Section>
      )}
      {draft.mode === "timeline" && (
        <Section
          title="Linha do tempo"
          action={
            <AppButton onClick={addStep}>
              <Plus className="h-4 w-4" />
              Etapa
            </AppButton>
          }
        >
          <TimeRows
            rows={draft.timelineSteps}
            set={(x) => set({ ...draft, timelineSteps: x })}
          />
        </Section>
      )}
      <Section title="Limites e aparência">
        <Grid>
          <Field label="Limite total de cliques">
            <input
              type="number"
              min="1"
              className={`${appControlClass} w-full`}
              value={draft.maxClicks || ""}
              onChange={(e) =>
                set({
                  ...draft,
                  maxClicks: e.target.value ? +e.target.value : null,
                })
              }
            />
          </Field>
          <Field label="Marcadores">
            <input
              className={`${appControlClass} w-full`}
              value={draft.tags.join(", ")}
              onChange={(e) =>
                set({ ...draft, tags: e.target.value.split(",") })
              }
            />
          </Field>
          <Field label="Mensagem de expiração" wide>
            <input
              className={`${appControlClass} w-full`}
              value={draft.expiredMessage}
              onChange={(e) =>
                set({ ...draft, expiredMessage: e.target.value })
              }
            />
          </Field>
          <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2">
            <input
              type="checkbox"
              checked={draft.maskUrl}
              onChange={(e) => set({ ...draft, maskUrl: e.target.checked })}
            />
            Ativar cloaking por proxy reverso
          </label>
          {draft.maskUrl && (
            <>
              <Field label="Título da aba">
                <input
                  className={`${appControlClass} w-full`}
                  value={draft.maskTitle}
                  onChange={(e) => set({ ...draft, maskTitle: e.target.value })}
                />
              </Field>
              <Field label="URL do favicon">
                <input
                  className={`${appControlClass} w-full`}
                  value={draft.maskFavicon}
                  onChange={(e) =>
                    set({ ...draft, maskFavicon: e.target.value })
                  }
                />
              </Field>
            </>
          )}
        </Grid>
      </Section>
      <div className="mt-6 flex justify-end gap-2">
        <AppButton onClick={close}>Cancelar</AppButton>
        <AppButton variant="primary" disabled={saving} onClick={save}>
          {saving ? "Salvando..." : "Salvar link"}
        </AppButton>
      </div>
    </Modal>
  );
}
const toLocal = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
function DestRows({
  rows,
  set,
}: {
  rows: SmartDestination[];
  set: (x: SmartDestination[]) => void;
}) {
  return (
    <div className="space-y-2">
      {rows.map((x, i) => (
        <div
          key={x.id}
          className="grid gap-2 rounded-xl border p-3 dark:border-zinc-800 sm:grid-cols-[1fr_2fr_110px_auto]"
        >
          <input
            aria-label={`Etapa ${i + 1}`}
            className={appControlClass}
            value={x.name}
            onChange={(e) =>
              set(
                rows.map((y) =>
                  y.id === x.id ? { ...y, name: e.target.value } : y,
                ),
              )
            }
          />
          <input
            aria-label={`URL ${i + 1}`}
            className={appControlClass}
            value={x.url}
            onChange={(e) =>
              set(
                rows.map((y) =>
                  y.id === x.id ? { ...y, url: e.target.value } : y,
                ),
              )
            }
          />
          <input
            aria-label={`Minutos ${i + 1}`}
            type="number"
            min="1"
            className={appControlClass}
            value={x.durationMinutes}
            onChange={(e) =>
              set(
                rows.map((y) =>
                  y.id === x.id
                    ? { ...y, durationMinutes: +e.target.value }
                    : y,
                ),
              )
            }
          />
          <button
            onClick={() => set(rows.filter((y) => y.id !== x.id))}
            className="p-2 text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
function TimeRows({
  rows,
  set,
}: {
  rows: SmartTimelineStep[];
  set: (x: SmartTimelineStep[]) => void;
}) {
  return (
    <div className="space-y-2">
      {rows.map((x, i) => (
        <div
          key={x.id}
          className="grid gap-2 rounded-xl border p-3 dark:border-zinc-800 lg:grid-cols-6"
        >
          <input
            aria-label={`Etapa ${i + 1}`}
            className={appControlClass}
            value={x.name}
            onChange={(e) =>
              set(
                rows.map((y) =>
                  y.id === x.id ? { ...y, name: e.target.value } : y,
                ),
              )
            }
          />
          <input
            aria-label={`URL ${i + 1}`}
            className={`${appControlClass} lg:col-span-2`}
            value={x.url}
            onChange={(e) =>
              set(
                rows.map((y) =>
                  y.id === x.id ? { ...y, url: e.target.value } : y,
                ),
              )
            }
          />
          <input
            aria-label={`Início ${i + 1}`}
            type="datetime-local"
            className={appControlClass}
            value={toLocal(x.startDate)}
            onChange={(e) =>
              set(
                rows.map((y) =>
                  y.id === x.id
                    ? {
                        ...y,
                        startDate: new Date(e.target.value).toISOString(),
                      }
                    : y,
                ),
              )
            }
          />
          <input
            aria-label={`Fim ${i + 1}`}
            type="datetime-local"
            className={appControlClass}
            value={x.endDate ? toLocal(x.endDate) : ""}
            onChange={(e) =>
              set(
                rows.map((y) =>
                  y.id === x.id
                    ? {
                        ...y,
                        endDate: e.target.value
                          ? new Date(e.target.value).toISOString()
                          : undefined,
                      }
                    : y,
                ),
              )
            }
          />
          <div className="flex gap-2">
            <input
              aria-label={`Cliques ${i + 1}`}
              type="number"
              min="1"
              className={`${appControlClass} min-w-0 flex-1`}
              value={x.maxClicks || ""}
              onChange={(e) =>
                set(
                  rows.map((y) =>
                    y.id === x.id
                      ? {
                          ...y,
                          maxClicks: e.target.value
                            ? +e.target.value
                            : undefined,
                        }
                      : y,
                  ),
                )
              }
            />
            <button
              onClick={() => set(rows.filter((y) => y.id !== x.id))}
              className="p-2 text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
function Simulator({
  value,
  set,
  close,
}: {
  value: { link: SmartLink; at: string };
  set: (x: { link: SmartLink; at: string }) => void;
  close: () => void;
}) {
  const r = resolveSmartLink(value.link, new Date(value.at));
  const record = () =>
    addDoc(collection(db, "smart_link_clicks"), {
      linkId: value.link.id,
      shortCode: r.activeShortCode,
      destinationUrl: r.url,
      phase: r.phase,
      cycleNumber: r.cycleNumber || null,
      timestamp: new Date(value.at).toISOString(),
      device: "simulador",
      referrer: "Máquina do Tempo",
      simulated: true,
    });
  return (
    <Modal close={close}>
      <Head title="Máquina do Tempo" close={close} />
      <p className="text-xs text-gray-500">
        Simule datas passadas ou futuras sem alterar as métricas reais.
      </p>
      <input
        type="datetime-local"
        className={`${appControlClass} mt-4 w-full`}
        value={value.at}
        onChange={(e) => set({ ...value, at: e.target.value })}
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Stat label="Código ativo" value={r.activeShortCode} />
        <Stat label="Ciclo/etapa" value={r.label} />
      </div>
      <div className="mt-3 rounded-xl bg-gray-50 p-4 dark:bg-zinc-800">
        <p className="break-all font-bold">{r.url || "Sem destino ativo"}</p>
        <p className="mt-2 text-xs text-gray-500">{r.reason}</p>
      </div>
      <AppButton
        className="mt-4"
        disabled={!r.url}
        onClick={() => void record()}
      >
        <Play className="h-4 w-4" />
        Registrar clique simulado
      </AppButton>
    </Modal>
  );
}
function Analytics({
  value,
  close,
}: {
  value: { link: SmartLink; logs: ClickLog[] };
  close: () => void;
}) {
  const count = (d: string) => value.logs.filter((x) => x.device === d).length;
  return (
    <Modal close={close}>
      <Head title={`Analytics — ${value.link.title}`} close={close} />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total" value={value.logs.length} />
        {["mobile", "desktop", "tablet"].map((d) => (
          <Stat key={d} label={d} value={count(d)} />
        ))}
      </div>
      <div className="mt-4 max-h-80 overflow-auto rounded-xl border dark:border-zinc-800">
        <table className="w-full min-w-[620px] text-left text-xs">
          <thead>
            <tr>
              <th className="p-3">Data</th>
              <th>Código</th>
              <th>Dispositivo</th>
              <th>Etapa</th>
              <th>Destino</th>
            </tr>
          </thead>
          <tbody>
            {value.logs.map((x) => (
              <tr key={x.id} className="border-t dark:border-zinc-800">
                <td className="p-3 whitespace-nowrap">
                  {new Date(x.timestamp).toLocaleString("pt-BR")}
                </td>
                <td>{x.shortCode}</td>
                <td>{x.device}</td>
                <td>{x.phase}</td>
                <td className="max-w-48 truncate">{x.destinationUrl}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!value.logs.length && (
          <p className="p-8 text-center">Nenhum clique.</p>
        )}
      </div>
    </Modal>
  );
}
function Qr({
  value,
  close,
}: {
  value: { title: string; url: string; image: string };
  close: () => void;
}) {
  const download = () => {
    const a = document.createElement("a");
    a.href = value.image;
    a.download = `qr-${slug(value.title)}.png`;
    a.click();
  };
  return (
    <Modal close={close}>
      <Head title="QR Code" close={close} />
      <img src={value.image} className="mx-auto h-64 w-64 bg-white p-2" />
      <p className="mt-2 break-all text-center text-xs">{value.url}</p>
      <div className="mt-4 flex gap-2">
        <AppButton
          className="flex-1"
          onClick={() => void navigator.clipboard.writeText(value.url)}
        >
          <Copy className="h-4 w-4" />
          Copiar
        </AppButton>
        <AppButton className="flex-1" onClick={download}>
          <Download className="h-4 w-4" />
          PNG
        </AppButton>
      </div>
    </Modal>
  );
}
function Modal({
  children,
  close,
}: {
  children: React.ReactNode;
  close: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3"
      onMouseDown={close}
    >
      <AppCard
        className="max-h-[94dvh] w-full max-w-4xl overflow-y-auto p-5 sm:p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </AppCard>
    </div>
  );
}
function Head({ title, close }: { title: string; close: () => void }) {
  return (
    <div className="flex justify-between">
      <h2 className="text-xl font-black">{title}</h2>
      <button onClick={close}>
        <X />
      </button>
    </div>
  );
}
function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 border-t pt-5 dark:border-zinc-800">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-black">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}
function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block text-xs font-bold ${wide ? "sm:col-span-2" : ""}`}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

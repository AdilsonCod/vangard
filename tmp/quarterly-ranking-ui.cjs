var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/components/QuarterlyRanking.tsx
var QuarterlyRanking_exports = {};
__export(QuarterlyRanking_exports, {
  QuarterlyRanking: () => QuarterlyRanking
});
module.exports = __toCommonJS(QuarterlyRanking_exports);
var import_react = require("react");
var import_lucide_react = require("lucide-react");

// mock:test-store
var useStore = () => globalThis.__rankingTestStore;

// src/utils/quarterlyRanking.ts
function calculateQuarterlyRanking(stats, users, year, month, unit = "ALL") {
  const quarter = Math.ceil(month / 3);
  const start = (quarter - 1) * 3 + 1;
  const months = Array.from({ length: 3 }, (_, index) => `${year}-${String(start + index).padStart(2, "0")}`);
  const totals = /* @__PURE__ */ new Map();
  stats.forEach((stat) => {
    const user = users.find((item) => item.id === stat.barberId);
    if (user?.role !== "BARBER" || !months.includes(stat.month)) return;
    if (unit !== "ALL" && stat.unitId !== unit && user.unit !== unit) return;
    const total = totals.get(stat.barberId) || { revenue: 0, products: 0, clients: 0 };
    total.revenue += stat.faturamentoTotal || 0;
    total.products += stat.vendaProdutosValor || 0;
    total.clients += stat.clientesAtendidos || 0;
    totals.set(stat.barberId, total);
  });
  const rows = [...totals].map(([id, total]) => ({ id, name: users.find((user) => user.id === id).name, ...total, ticket: total.clients > 0 ? total.revenue / total.clients : 0 }));
  const maxRevenue = Math.max(1, ...rows.map((row) => row.revenue));
  const maxProducts = Math.max(1, ...rows.map((row) => row.products));
  const maxTicket = Math.max(1, ...rows.map((row) => row.ticket));
  const ranking = rows.map((row) => ({ ...row, score: row.revenue / maxRevenue * 100 + row.products / maxProducts * 100 + row.ticket / maxTicket * 100 })).filter((row) => row.score > 0).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "pt-BR") || a.id.localeCompare(b.id)).slice(0, 5);
  return { quarter, months, ranking };
}

// src/components/ui/AppPrimitives.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var appControlClass = "h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 shadow-sm outline-none transition hover:border-gray-300 focus:border-[var(--theme-color)] focus:ring-2 focus:ring-[var(--theme-color)]/15 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-700";

// src/components/QuarterlyRanking.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function QuarterlyRanking({ year, month, unit = "ALL", management = false }) {
  const { currentUser, users, monthlyBarberStats, quarterlyRankingVisible, setQuarterlyRankingVisible } = useStore();
  const [saving, setSaving] = (0, import_react.useState)(false);
  const [message, setMessage] = (0, import_react.useState)("");
  const { quarter, months, ranking } = (0, import_react.useMemo)(() => calculateQuarterlyRanking(monthlyBarberStats, users, year, month, unit), [monthlyBarberStats, users, year, month, unit]);
  const canManage = management && currentUser?.role === "ADMIN";
  if (!management && quarterlyRankingVisible !== true) return null;
  const money = (value) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const toggle = async () => {
    setSaving(true);
    setMessage("");
    try {
      await setQuarterlyRankingVisible(!quarterlyRankingVisible);
      setMessage(quarterlyRankingVisible ? "Ranking ocultado para os barbeiros." : "Ranking liberado para os barbeiros.");
    } catch {
      setMessage("N\xE3o foi poss\xEDvel salvar a visibilidade. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: "app-themed-panel min-w-0 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("h3", { className: "flex items-center gap-2 text-lg font-black text-gray-950 dark:text-zinc-100", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react.Trophy, { className: "h-5 w-5 shrink-0 text-amber-500" }),
          "Melhores do ",
          quarter,
          "\xBA trimestre de ",
          year
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "mt-1 text-sm text-gray-600 dark:text-zinc-400", children: [
          months[0].slice(5),
          "/",
          year,
          " a ",
          months[2].slice(5),
          "/",
          year,
          " \xB7 ",
          unit === "ALL" ? "Todas as unidades" : "Unidade selecionada"
        ] })
      ] }),
      canManage && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", onClick: toggle, disabled: saving || quarterlyRankingVisible === null, "aria-pressed": quarterlyRankingVisible === false, className: appControlClass, children: saving ? "Salvando\u2026" : quarterlyRankingVisible === null ? "Aguardando configura\xE7\xE3o\u2026" : quarterlyRankingVisible ? "Ocultar para barbeiros" : "Mostrar para barbeiros" })
    ] }),
    management && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "mt-3 text-sm text-gray-600 dark:text-zinc-400", children: [
      "Visibilidade para profissionais: ",
      quarterlyRankingVisible === null ? "indispon\xEDvel no momento" : quarterlyRankingVisible ? "vis\xEDvel" : "oculto",
      ". Esta op\xE7\xE3o vale para todos os trimestres e unidades."
    ] }),
    message && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { role: "status", className: "mt-2 text-sm text-gray-700 dark:text-zinc-300", children: message }),
    ranking.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "mt-4 rounded-xl border border-dashed border-gray-200 p-5 text-sm text-gray-600 dark:border-zinc-700 dark:text-zinc-400", children: "Sem dados consolidados no trimestre." }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ol", { className: "mt-4 space-y-2", children: ranking.map((row, index) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { className: "flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 p-3 dark:bg-zinc-800", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "min-w-0", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "break-words font-bold text-gray-900 dark:text-zinc-100", children: [
          index + 1,
          "\xBA \xB7 ",
          row.name,
          row.id === currentUser?.id ? " (voc\xEA)" : ""
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "mt-1 text-xs text-gray-600 dark:text-zinc-300", children: [
          "Faturamento ",
          money(row.revenue),
          " \xB7 Produtos ",
          money(row.products),
          " \xB7 Ticket ",
          money(row.ticket)
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("strong", { className: "shrink-0 text-sm text-[var(--theme-color)]", children: [
        row.score.toFixed(1).replace(".", ","),
        " pts"
      ] })
    ] }, row.id)) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("details", { className: "mt-4 text-sm text-gray-600 dark:text-zinc-400", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("summary", { className: "cursor-pointer font-semibold", children: "Crit\xE9rios do ranking" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "mt-2 leading-relaxed", children: "Soma dos consolidados mensais dos tr\xEAs meses. Faturamento, venda de produtos em reais e ticket m\xE9dio t\xEAm o mesmo peso: at\xE9 100 pontos cada, em rela\xE7\xE3o ao maior resultado do grupo. Ticket m\xE9dio = faturamento total \xF7 clientes. S\xE3o exibidos os cinco primeiros; empates s\xE3o ordenados pelo nome." })
    ] })
  ] });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  QuarterlyRanking
});

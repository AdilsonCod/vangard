import React, { useState, useRef, useMemo } from "react";
import { useStore } from "../store";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Save,
  X,
  Calendar,
  RefreshCcw,
  Settings,
} from "lucide-react";
import { Category, MonthlyBarberStats, MonthlyUnitStats } from "../types";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { parseDPotePDF, DPoteReport, parseDPoteSpreadsheet } from "../DPoteParser";
import { parseCashbarberProductsSpreadsheet, parseCashbarberProductsPDF, CashbarberProductReport } from "../CashbarberParser";

export default function DataImporterView() {
  const {
    users,
    systemUnits,
    monthlyBarberStats,
    updateMonthlyBarberStats,
    monthlyUnitStats,
    updateMonthlyUnitStats,
    catalog,
    updateCatalog,
    categories,
    updateCategories,
    addPayment,
  } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    (today.getMonth() + 1).toString().padStart(2, "0"),
  );
  const [selectedYear, setSelectedYear] = useState(
    today.getFullYear().toString(),
  );
  const [importType, setImportType] = useState<
    | "SERVICOS"
    | "PRODUTOS"
    | "UNIDADE"
    | "UNIDADE_ITENS"
    | "CATALOGO"
    | "DPOTE_PDF"
    | "CASHBARBER_PRODUTOS"
  >("SERVICOS");
  const [targetUnitId, setTargetUnitId] = useState<string>("");

  const [isParsing, setIsParsing] = useState(false);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  const [isMappingColumns, setIsMappingColumns] = useState(false);

  const [columnMapping, setColumnMapping] = useState({
    profissional: "",
    servico: "",
    quantidade: "",
    valorTotal: "",
    valorComissao: "",
    unidade: "",
    fatTotal: "",
    fatAssinaturas: "",
    assinantes: "",
    clientesNovos: "",
    clientesAtendidos: "",
    servicosRealizados: "",
    itemNome: "",
    categoriaNome: "",
  });

  const [dpoteReport, setDpoteReport] = useState<DPoteReport | null>(null);
  const [cashbarberReport, setCashbarberReport] = useState<CashbarberProductReport | null>(null);
  const [manualUserMapping, setManualUserMapping] = useState<
    Record<string, string>
  >({});

  const [parsedData, setParsedData] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFile(file);
    setParsedData([]);
    setDpoteReport(null);
    setSuccessMessage("");
    setIsMappingColumns(false);


  };

  const parseCurrency = (val: string | number): number => {
      if (!val) return 0;
      if (typeof val === "number") return val;
      const cleaned = String(val)
        .replace(/R\$/g, "")
        .replace(/\./g, "")
        .replace(/,/g, ".")
        .trim();
      return parseFloat(cleaned) || 0;
    };

    const handleParsedRawData = (data: any[]) => {
      if (!data || data.length === 0) {
        alert("Nenhum dado pôde ser extraído do arquivo.");
        setIsParsing(false);
        return;
      }

      // Normalize keys (remove accents, trim whitespace, and remove quotes if any)
      const normalizedData = data.map((row) => {
        const newRow: any = {};
        Object.keys(row).forEach((key) => {
          let cleanKey = key
            .replace(/^\uFEFF/, "")
            .replace(/[\u200B-\u200D\uFEFF]/g, "");
          cleanKey = cleanKey.trim().replace(/^"|"$/g, "");
          // We keep original cases for UI, but trim quotes
          newRow[cleanKey] = row[key];
        });
        return newRow;
      });

      const headers = Object.keys(normalizedData[0] || {});
      setRawHeaders(headers);
      setRawData(normalizedData);

      // Auto-guess columns
      const guess = (possible: string[]) => {
        const found = headers.find((h) => {
          const cleanH = h
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]/gi, "");
          return possible.some((p) => cleanH.includes(p));
        });
        return found || "";
      };

      setColumnMapping({
        profissional: guess([
          "profissional",
          "barbeiro",
          "funcionario",
          "colaborador",
        ]),
        servico: guess(["servico", "produto", "item", "descricao"]),
        quantidade: guess(["quantidade", "qtd", "qtde"]),
        valorTotal: guess(["valortotal", "total"]),
        valorComissao: guess(["valorcomissao", "comissao"]),
        unidade: guess(["unidade", "filial", "loja"]),
        fatTotal: guess(["faturamentototal", "valortotal", "total"]),
        fatAssinaturas: guess(["assinatura", "club"]),
        assinantes: guess(["assinante", "ativo"]),
        clientesNovos: guess(["novos"]),
        clientesAtendidos: guess(["atendimento", "cliente"]),
        servicosRealizados: guess(["servico", "realizado", "quantidade"]),
        itemNome: guess(["nome", "item", "servico", "produto", "descricao"]),
        categoriaNome: guess(["categoria", "tipo", "grupo"]),
      });

      setIsMappingColumns(true);
      setIsParsing(false);
    };

    const processMappedData = () => {
      if (importType === "UNIDADE") {
        if (!columnMapping.unidade || !columnMapping.fatTotal) {
          alert(
            "Por favor, mapeie pelo menos as colunas de Unidade e Faturamento Total.",
          );
          return;
        }
      } else if (importType === "CATALOGO") {
        if (!columnMapping.itemNome || !columnMapping.valorTotal) {
          alert(
            "Por favor, mapeie pelo menos as colunas de Nome do Item e Preço/Valor.",
          );
          return;
        }
        } else if (importType === "UNIDADE_ITENS") {
        if (
          !columnMapping.itemNome ||
          !columnMapping.quantidade ||
          !columnMapping.valorTotal
        ) {
          alert(
            "Por favor, mapeie pelo menos as colunas de Nome do Item, Quantidade e Valor.",
          );
          return;
        }
      } else {
        if (
          !columnMapping.profissional ||
          !columnMapping.quantidade ||
          !columnMapping.valorTotal
        ) {
          alert(
            "Por favor, mapeie pelo menos as colunas de Profissional, Quantidade e Valor Total.",
          );
          return;
        }
      }

      const mapped = rawData
        .filter((row) => {
          if (importType === "UNIDADE") {
            const uni = String(row[columnMapping.unidade] || "").trim();
            return uni && uni.toLowerCase() !== "total";
  } else if (importType === "CATALOGO") {
            const itemName = String(row[columnMapping.itemNome] || "").trim();
            return itemName && itemName.toLowerCase() !== "total";
          } else if (importType === "UNIDADE_ITENS") {
            const itemName = String(row[columnMapping.itemNome] || "").trim();
            return itemName && itemName.toLowerCase() !== "total";
          } else {
            const prof = String(row[columnMapping.profissional] || "").trim();
            const qty = String(row[columnMapping.quantidade] || "").trim();
            return prof && prof.toLowerCase() !== "total" && qty && qty !== "";
          }
        })
        .map((row) => {
          if (importType === "UNIDADE") {
            return {
              isUnit: true,
              unidade: String(row[columnMapping.unidade] || "").trim(),
              faturamentoTotal: parseCurrency(row[columnMapping.fatTotal]),
              faturamentoAssinatura: parseCurrency(
                row[columnMapping.fatAssinaturas],
              ),
              assinantes: parseInt(String(row[columnMapping.assinantes])) || 0,
              clientesNovos:
                parseInt(String(row[columnMapping.clientesNovos])) || 0,
              clientesAtendidos:
                parseInt(String(row[columnMapping.clientesAtendidos])) || 0,
              servicosRealizados:
                parseInt(String(row[columnMapping.servicosRealizados])) || 0,
            };
          } else if (importType === "CATALOGO") {
            return {
              isUnit: false,
              itemNome: String(row[columnMapping.itemNome] || "").trim(),
              categoriaNome: columnMapping.categoriaNome
                ? String(row[columnMapping.categoriaNome] || "").trim()
                : "",
              valorTotal: parseCurrency(row[columnMapping.valorTotal]),
            };
          } else if (importType === "UNIDADE_ITENS") {
            return {
              isUnit: true,
              itemNome: String(row[columnMapping.itemNome] || "").trim(),
              quantidade: parseInt(String(row[columnMapping.quantidade])) || 0,
              valorTotal: parseCurrency(row[columnMapping.valorTotal]),
            };
          } else {
            return {
              isUnit: false,
              filial: String(
                row["Filial"] || row["Unidade"] || row["Loja"] || "",
              ).trim(),
              profissional: String(
                row[columnMapping.profissional] || "",
              ).trim(),
              servico: columnMapping.servico
                ? String(row[columnMapping.servico] || "").trim()
                : "",
              quantidade: parseInt(String(row[columnMapping.quantidade])) || 0,
              valorTotal: parseCurrency(row[columnMapping.valorTotal]),
              valorComissao: columnMapping.valorComissao
                ? parseCurrency(row[columnMapping.valorComissao])
                : 0,
            };
          }
        });

      if (mapped.length === 0) {
        alert("Nenhuma linha válida encontrada com este mapeamento.");
        return;
      }

      setParsedData(mapped);
      setIsMappingColumns(false);
    };

    const processFile = () => {
      if (!file) return;
      setIsParsing(true);

      const fileName = file.name.toLowerCase();
      
if (importType === "CASHBARBER_PRODUTOS") {
        const handleCashbarberReport = (rep: CashbarberProductReport) => {
          setCashbarberReport(rep);
          const newMap = { ...manualUserMapping };
          rep.barbers.forEach((b) => {
            const matchedUser = users.find(
              (u) =>
                u.name.toLowerCase() === b.name.toLowerCase() ||
                u.name.toLowerCase().includes(b.name.toLowerCase()) ||
                b.name.toLowerCase().includes(u.name.toLowerCase()),
            );
            if (matchedUser) {
              newMap[b.name] = matchedUser.id;
            }
          });
          setManualUserMapping(newMap);
          setIsParsing(false);
        };

        if (fileName.endsWith(".pdf")) {
          parseCashbarberProductsPDF(file)
            .then(handleCashbarberReport)
            .catch((err) => {
              alert(err.message || "Erro ao ler PDF do Cashbarber");
              setIsParsing(false);
            });
        } else {
          parseCashbarberProductsSpreadsheet(file)
            .then(handleCashbarberReport)
            .catch((err) => {
              alert(err.message || "Erro ao ler Planilha do Cashbarber");
              setIsParsing(false);
            });
        }
        return;
      }

      if (importType === "DPOTE_PDF") {
        const handleDPoteReport = (rep: DPoteReport) => {
          setDpoteReport(rep);
          const newMap = { ...manualUserMapping };
          rep.barbers.forEach((b) => {
            const matchedUser = users.find(
              (u) =>
                u.name.toLowerCase() === b.name.toLowerCase() ||
                u.name
                  .toLowerCase()
                  .includes(b.name.toLowerCase().split(" ")[0])
            );
            if (matchedUser) {
              newMap[b.name] = matchedUser.id;
            }
          });
          setManualUserMapping(newMap);
          setIsParsing(false);
        };

        if (fileName.endsWith(".pdf")) {
          parseDPotePDF(file)
            .then(handleDPoteReport)
            .catch((err) => {
              console.error(err);
              setIsParsing(false);
              alert("Erro ao ler PDF");
            });
        } else {
          parseDPoteSpreadsheet(file)
            .then(handleDPoteReport)
            .catch((err) => {
              console.error(err);
              setIsParsing(false);
              alert("Erro ao ler Planilha do D'Pote");
            });
        }
        return;
      }

      if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: "array" });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, {
              defval: "",
            }) as any[];
            handleParsedRawData(json);
          } catch (error) {
            console.error("Erro ao ler Excel:", error);
            setIsParsing(false);
            alert(
              "Erro ao ler o arquivo Excel. Verifique se o arquivo não está corrompido.",
            );
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        // Treat everything else as CSV/text
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            handleParsedRawData(results.data as any[]);
          },
          error: (error) => {
            console.error("Erro ao ler CSV:", error);
            setIsParsing(false);
            alert("Erro ao ler o arquivo CSV. Verifique a formatação.");
          },
        });
      }
    };

    // Grouping by barber or unit
    const groupedData = useMemo(() => {
      if (importType === "CATALOGO") {
        return parsedData; // No grouping needed for catalog items
      }

      if (!parsedData.length) return [];

      if (importType === "UNIDADE_ITENS") {
        let fatTotal = 0;
        let servicos = 0;
        let produtos = 0;

        parsedData.forEach((item) => {
          fatTotal += item.valorTotal;
          const catItem = catalog.find(
            (c) => c.name.toLowerCase() === item.itemNome.toLowerCase(),
          );
          if (catItem && catItem.type === "PRODUTO") {
            produtos += item.quantidade;
          } else {
            servicos += item.quantidade;
          }
        });

        return [
          {
            unitId:
              targetUnitId || (systemUnits.length > 0 ? systemUnits[0].id : ""),
            unidade: "Itens da Unidade (Consolidado)",
            faturamentoTotal: fatTotal,
            servicosRealizados: servicos,
            vendasProdutosQtd: produtos,
            items: parsedData,
          },
        ];
      }

      if (importType === "UNIDADE") {
        return parsedData.map((row) => {
          let unitId = manualUserMapping[row.unidade];
          let unit = unitId ? systemUnits.find((u) => u.id === unitId) : null;

          if (!unit) {
            unit = systemUnits.find(
              (u) => u.name.toLowerCase() === row.unidade.toLowerCase(),
            );
            unitId = unit?.id;
          }

          return {
            ...row,
            unitId,
          };
        });
      }

      const groups: Record<string, any> = {};
      parsedData.forEach((row) => {
        if (!groups[row.profissional]) {
          groups[row.profissional] = {
            profissional: row.profissional,
            filial: row.filial,
            quantidade: 0,
            valorTotal: 0,
            valorComissao: 0,
            items: [],
          };
        }
        groups[row.profissional].quantidade += row.quantidade;
        groups[row.profissional].valorTotal += row.valorTotal;
        groups[row.profissional].valorComissao += row.valorComissao;
        groups[row.profissional].items.push(row);
      });

      return Object.values(groups).map((g) => {
        // Manual mapping overriding auto-guess
        let userId = manualUserMapping[g.profissional];
        let user = userId ? users.find((u) => u.id === userId) : null;

        // Auto-guess if no manual mapping
        if (!user) {
          user = users.find(
            (u) => u.name.toLowerCase() === g.profissional.toLowerCase(),
          );
          userId = user?.id;
        }

        // Get current stats for the month
        const monthStr = `${selectedYear}-${selectedMonth}`;
        const statId = `${monthStr}_${userId}`;
        const existingStat = monthlyBarberStats.find((s) => s.id === statId);

        return {
          ...g,
          userId,
          userRole: user?.role,
          existingStat,
        };
      });
    }, [
      parsedData,
      users,
      monthlyBarberStats,
      selectedMonth,
      selectedYear,
      manualUserMapping,
    ]);

    const handleSave = async () => {
      if ((importType === "DPOTE_PDF" || importType === "UNIDADE_ITENS" || importType === "CASHBARBER_PRODUTOS") && !targetUnitId) {
         alert("Por favor, selecione a Unidade Alvo antes de salvar.");
         return;
      }
      setIsSaving(true);
      const monthStr = `${selectedYear}-${selectedMonth}`;

      try {
        if (importType === "DPOTE_PDF" && dpoteReport) {
          const unitIds = new Set<string>();

          for (const barber of dpoteReport.barbers) {
            const userId = manualUserMapping[barber.name];
            if (!userId) continue;

            const user = users.find((u) => u.id === userId);
            if (user && user.unit) {
              unitIds.add(user.unit);
            }

            const userUnit = user?.unit || "ALL";
            const statId = `${monthStr}_${userId}`;
            const currentStat = monthlyBarberStats.find(
              (s) => s.id === statId,
            ) || {
              id: statId,
              barberId: userId,
              unitId: userUnit,
              month: monthStr,
              faturamentoTotal: 0,
              faturamentoAssinatura: 0,
              comissao: 0,
              clientesAtendidos: 0,
              servicosRealizados: 0,
              vendaProdutosValor: 0,
              vendasProdutosQtd: 0,
              taxaRetorno: 0,
              clientesNovos: 0,
              clientesSemPreferencia: 0,
            };

            const fatAssinatura =
              (barber.potPercentage / 100) * dpoteReport.totalAssinaturas;

            const qtyServices = barber.totalServices || barber.services.reduce((acc, s) => acc + s.quantity, 0);

            await updateMonthlyBarberStats({
              ...currentStat,
              faturamentoAssinatura:
                (currentStat.faturamentoAssinatura || 0) + fatAssinatura,
              comissao: (currentStat.comissao || 0) + barber.commission,
              servicosRealizados: (currentStat.servicosRealizados || 0) + qtyServices,
            });

            const lastDay = new Date(
              parseInt(selectedYear),
              parseInt(selectedMonth),
              0,
            );
            const dateStr = `${selectedYear}-${selectedMonth}-${String(lastDay.getDate()).padStart(2, "0")}`;

            await addPayment({
              id:
                "pay_" +
                Date.now() +
                Math.random().toString(36).substring(2, 9),
              userId: userId,
              date: dateStr,
              commissionAvulso: 0,
              commissionProductGeneral: 0,
              commissionProductAvant: 0,
              commissionSubscriptions: barber.commission,
              discount: 0,
              discountDescription: "",
              amountToBePaid: barber.commission,
              status: "PENDENTE",
              isPaid: false,
              potPercentage: barber.potPercentage,
              potData: barber.services.map((s) => ({
                id:
                  "pot_" +
                  Date.now() +
                  Math.random().toString(36).substring(2, 9),
                name: s.name,
                quantity: s.quantity,
                tokens: s.tokens,
              })),
            });
          }

          for (const uId of unitIds) {
            const statId = `${monthStr}_${uId}`;
            const currentUnitStat = monthlyUnitStats.find(
              (s) => s.id === statId,
            ) || {
              id: statId,
              unitId: uId,
              month: monthStr,
              faturamentoTotal: 0,
              faturamentoAssinatura: 0,
              assinantes: 0,
              clientesNovos: 0,
              clientesSemPreferencia: 0,
              clientesAtendidos: 0,
              servicosRealizados: 0,
              vendaProdutosValor: 0,
              vendasProdutosQtd: 0,
            };

            await updateMonthlyUnitStats({
              ...currentUnitStat,
              faturamentoAssinatura:
                (currentUnitStat.faturamentoAssinatura || 0) +
                dpoteReport.totalAssinaturas,
            });
          }
        } else if (importType === "CASHBARBER_PRODUTOS" && cashbarberReport) {
          const unitIds = new Set<string>();

          for (const barber of cashbarberReport.barbers) {
            const userId = manualUserMapping[barber.name];
            if (!userId) continue;

            const user = users.find((u) => u.id === userId);
            if (user && user.unit) {
              unitIds.add(user.unit);
            }

            const userUnit = user?.unit || targetUnitId || "ALL";
            const statId = `${monthStr}_${userId}`;
            const currentStat = monthlyBarberStats.find(
              (s) => s.id === statId,
            ) || {
              id: statId,
              barberId: userId,
              unitId: userUnit,
              month: monthStr,
              faturamentoTotal: 0,
              faturamentoAssinatura: 0,
              comissao: 0,
              clientesAtendidos: 0,
              servicosRealizados: 0,
              vendaProdutosValor: 0,
              vendasProdutosQtd: 0,
              taxaRetorno: 0,
              clientesNovos: 0,
              clientesSemPreferencia: 0,
            };

            await updateMonthlyBarberStats({
              ...currentStat,
              vendaProdutosValor: (currentStat.vendaProdutosValor || 0) + barber.totalSales,
              vendasProdutosQtd: (currentStat.vendasProdutosQtd || 0) + barber.totalProducts,
              comissao: (currentStat.comissao || 0) + barber.totalCommission,
            });
            
            const lastDay = new Date(
              parseInt(selectedYear),
              parseInt(selectedMonth),
              0,
            );
            const dateStr = `${selectedYear}-${selectedMonth}-${String(lastDay.getDate()).padStart(2, "0")}`;

            await addPayment({
              id:
                "pay_" +
                Date.now() +
                Math.random().toString(36).substring(2, 9),
              userId: userId,
              date: dateStr,
              commissionAvulso: 0,
              commissionProductGeneral: barber.commissionProdGeral || 0,
              commissionProductAvant: barber.commissionProdAvant || 0,
              commissionSubscriptions: 0,
              discount: 0,
              discountDescription: "",
              amountToBePaid: (barber.commissionProdGeral || 0) + (barber.commissionProdAvant || 0),
              status: "PENDENTE",
              isPaid: false,
              potData: [],
            });
          }

          for (const uId of unitIds) {
            const statId = `${monthStr}_${uId}`;
            const currentUnitStat = monthlyUnitStats.find(
              (s) => s.id === statId,
            ) || {
              id: statId,
              unitId: uId,
              month: monthStr,
              faturamentoTotal: 0,
              faturamentoAssinatura: 0,
              assinantes: 0,
              clientesNovos: 0,
              clientesSemPreferencia: 0,
              clientesAtendidos: 0,
              servicosRealizados: 0,
              vendaProdutosValor: 0,
              vendasProdutosQtd: 0,
            };

            let totalVal = 0;
            let totalQtd = 0;
            for (const barber of cashbarberReport.barbers) {
              const u = users.find((uu) => uu.id === manualUserMapping[barber.name]);
              if (u && u.unit === uId) {
                totalVal += barber.totalSales;
                totalQtd += barber.totalProducts;
              }
            }

            await updateMonthlyUnitStats({
              ...currentUnitStat,
              vendaProdutosValor: (currentUnitStat.vendaProdutosValor || 0) + totalVal,
              vendasProdutosQtd: (currentUnitStat.vendasProdutosQtd || 0) + totalQtd,
            });
          }
        } else if (importType === "CATALOGO") {
          let currentCatalog = [...catalog];
          let currentCategories = [...categories];
          let updatedCategories = false;

          for (const item of parsedData) {
            if (!item.itemNome) continue;

            let catId = "";
            if (item.categoriaNome) {
              let cat = currentCategories.find(
                (c) =>
                  c.name.toLowerCase() === item.categoriaNome.toLowerCase(),
              );
              if (!cat) {
                catId =
                  "cat_" +
                  Date.now() +
                  Math.random().toString(36).substring(2, 9);
                const newCat: Category = {
                  id: catId,
                  name: item.categoriaNome,
                  type: "SERVICE",
                };
                currentCategories.push(newCat);
                updatedCategories = true;
              } else {
                catId = cat.id;
              }
            }

            const existingItemIndex = currentCatalog.findIndex(
              (c) => c.name.toLowerCase() === item.itemNome.toLowerCase(),
            );
            if (existingItemIndex >= 0) {
              currentCatalog[existingItemIndex] = {
                ...currentCatalog[existingItemIndex],
                price:
                  item.valorTotal || currentCatalog[existingItemIndex].price,
                type: catId || currentCatalog[existingItemIndex].type,
              };
            } else {
              currentCatalog.push({
                id:
                  "item_" +
                  Date.now() +
                  Math.random().toString(36).substring(2, 9),
                name: item.itemNome,
                type: catId || "",
                price: item.valorTotal || 0,
                unit: "ALL",
                visibleToRoles: ["ADMIN", "BARBER", "MANICURE"],
              });
            }
          }

          if (updatedCategories) {
            await updateCategories(currentCategories);
          }
          await updateCatalog(currentCatalog);
        } else if (importType === "UNIDADE_ITENS") {
          for (const group of groupedData) {
            if (!group.unitId) continue;

            const statId = `${monthStr}_${group.unitId}`;
            const current =
              monthlyUnitStats.find((s) => s.id === statId) ||
              ({
                id: statId,
                unitId: group.unitId,
                month: monthStr,
                faturamentoTotal: 0,
                faturamentoAssinatura: 0,
                assinantes: 0,
                clientesNovos: 0,
                clientesSemPreferencia: 0,
                clientesAtendidos: 0,
                servicosRealizados: 0,
                vendaProdutosValor: 0,
                vendasProdutosQtd: 0,
                extraCounts: {},
                extraValues: {},
              } as MonthlyUnitStats);

            const updated = {
              ...current,
              extraCounts: { ...current.extraCounts },
              extraValues: { ...current.extraValues },
            };

            let totalAddedFaturamento = 0;
            let addedServicos = 0;
            let addedProdutosValor = 0;
            let addedProdutosQtd = 0;

            for (const item of group.items) {
              const catItem = catalog.find(
                (c) => c.name.toLowerCase() === item.itemNome.toLowerCase(),
              );
              const key = catItem ? catItem.id : item.itemNome;

              updated.extraCounts[key] =
                (updated.extraCounts[key] || 0) + item.quantidade;
              updated.extraValues[key] =
                (updated.extraValues[key] || 0) + item.valorTotal;

              totalAddedFaturamento += item.valorTotal;
              if (catItem && catItem.type === "PRODUTO") {
                addedProdutosValor += item.valorTotal;
                addedProdutosQtd += item.quantidade;
              } else {
                addedServicos += item.quantidade;
              }
            }

            updated.faturamentoTotal += totalAddedFaturamento;
            updated.servicosRealizados += addedServicos;
            updated.vendaProdutosValor =
              (updated.vendaProdutosValor || 0) + addedProdutosValor;
            updated.vendasProdutosQtd =
              (updated.vendasProdutosQtd || 0) + addedProdutosQtd;

            await updateMonthlyUnitStats(updated);
          }
        } else if (importType === "UNIDADE") {
          for (const group of groupedData) {
            if (!group.unitId) continue;

            const statId = `${monthStr}_${group.unitId}`;
            const current =
              monthlyUnitStats.find((s) => s.id === statId) ||
              ({
                id: statId,
                unitId: group.unitId,
                month: monthStr,
                faturamentoTotal: 0,
                faturamentoAssinatura: 0,
                assinantes: 0,
                clientesNovos: 0,
                clientesSemPreferencia: 0,
                clientesAtendidos: 0,
                servicosRealizados: 0,
                vendaProdutosValor: 0,
                vendasProdutosQtd: 0,
                extraCounts: {},
                extraValues: {},
              } as MonthlyUnitStats);

            const updated = {
              ...current,
              faturamentoTotal:
                current.faturamentoTotal + group.faturamentoTotal,
              faturamentoAssinatura:
                current.faturamentoAssinatura + group.faturamentoAssinatura,
              assinantes:
                group.assinantes > 0 ? group.assinantes : current.assinantes,
              clientesNovos: current.clientesNovos + group.clientesNovos,
              clientesAtendidos:
                current.clientesAtendidos + group.clientesAtendidos,
              servicosRealizados:
                current.servicosRealizados + group.servicosRealizados,
            };

            await updateMonthlyUnitStats(updated);
          }
        } else {
          for (const group of groupedData) {
            if (!group.userId) continue; // Skip if no user found/mapped

            const statId = `${monthStr}_${group.userId}`;
            const current =
              monthlyBarberStats.find((s) => s.id === statId) ||
              ({
                id: statId,
                barberId: group.userId,
                unitId:
                  targetUnitId || users.find((u) => u.id === group.userId)?.unit || "ALL",
                month: monthStr,
                faturamentoTotal: 0,
                faturamentoAssinatura: 0,
                comissao: 0,
                clientesAtendidos: 0,
                servicosRealizados: 0,
                vendaProdutosValor: 0,
                vendasProdutosQtd: 0,
                taxaRetorno: 0,
                clientesNovos: 0,
                clientesSemPreferencia: 0,
                extraCounts: {},
                extraValues: {},
              } as MonthlyBarberStats);

            const updated = {
              ...current,
              extraCounts: { ...current.extraCounts },
              extraValues: { ...current.extraValues },
            };

            if (importType === "SERVICOS") {
              updated.faturamentoTotal += group.valorTotal;
              updated.servicosRealizados += group.quantidade;
              updated.comissao += group.valorComissao;
            } else {
              updated.vendaProdutosValor += group.valorTotal;
              updated.vendasProdutosQtd += group.quantidade;
              updated.comissao += group.valorComissao;
            }

            // Detailed items mapping
            for (const item of group.items) {
              if (!item.servico) continue;
              // Try to map to catalog
              const catItem = catalog.find(
                (c) => c.name.toLowerCase() === item.servico.toLowerCase(),
              );
              const key = catItem ? catItem.id : item.servico;
              updated.extraCounts[key] =
                (updated.extraCounts[key] || 0) + item.quantidade;
              updated.extraValues[key] =
                (updated.extraValues[key] || 0) + item.valorTotal;
            }

            await updateMonthlyBarberStats(updated);
          }
        }

        setSuccessMessage("Dados importados com sucesso!");
        setParsedData([]);
        setDpoteReport(null);
        setIsMappingColumns(false);
        setManualUserMapping({});
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (e) {
        console.error(e);
      }

      setIsSaving(false);
    };

    const handleUserMapChange = (profissionalName: string, userId: string) => {
      setManualUserMapping((prev) => ({
        ...prev,
        [profissionalName]: userId,
      }));
    };

    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
            <Upload className="w-6 h-6 text-[var(--theme-color)]" />
            Importador de Planilhas (Excel/CSV)
          </h2>
          <p className="text-gray-500 dark:text-zinc-400 mt-1">
            Alimente os dados dos barbeiros (serviços, produtos) ou os totais da
            unidade importando planilhas. Mapeie colunas e vincule manualmente.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                Tipo de Importação
              </label>
              <select
                value={importType}
                onChange={(e) => setImportType(e.target.value as any)}
                className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 rounded-lg p-2.5 text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-[var(--theme-color)] focus:border-transparent outline-none"
              >
                <option value="SERVICOS">Serviços Realizados</option>
                <option value="PRODUTOS">Produtos Vendidos</option>
                <option value="UNIDADE">Dados da Unidade (Consolidado)</option>
                <option value="UNIDADE_ITENS">
                  Relatório de Itens da Unidade (Serviços/Produtos)
                </option>
                <option value="CATALOGO">
                  Cadastro de Catálogo (Produtos/Serviços)
                </option>
                <option value="DPOTE_PDF">Relatório D'Pote (PDF/Planilha)</option>
                <option value="CASHBARBER_PRODUTOS">Comissão de Produtos Cashbarber (Planilha/PDF)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                Mês Base
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 rounded-lg p-2.5 text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-[var(--theme-color)] focus:border-transparent outline-none"
              >
                <option value="01">Janeiro</option>
                <option value="02">Fevereiro</option>
                <option value="03">Março</option>
                <option value="04">Abril</option>
                <option value="05">Maio</option>
                <option value="06">Junho</option>
                <option value="07">Julho</option>
                <option value="08">Agosto</option>
                <option value="09">Setembro</option>
                <option value="10">Outubro</option>
                <option value="11">Novembro</option>
                <option value="12">Dezembro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                Unidade Alvo
              </label>
              <select
                value={targetUnitId}
                onChange={(e) => setTargetUnitId(e.target.value)}
                className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 rounded-lg p-2.5 text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-[var(--theme-color)] focus:border-transparent outline-none"
              >
                <option value="">Selecione a Unidade</option>
                {systemUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.isActive === false ? "(Inativo)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                Ano
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 rounded-lg p-2.5 text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-[var(--theme-color)] focus:border-transparent outline-none"
              >
                {[2023, 2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-end border-t border-gray-200 dark:border-zinc-800 pt-6">
            <div className="flex-1 w-full">
              <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                Arquivo (.xlsx, .xls, .csv, .pdf)
              </label>
              <input
                type="file"
                accept=".csv, .xlsx, .xls, .txt, .pdf"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 rounded-lg p-2 text-gray-900 dark:text-zinc-100"
              />
            </div>
            <button
              onClick={processFile}
              disabled={!file || isParsing}
              className="w-full md:w-auto px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isParsing ? (
                <RefreshCcw className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              Ler Arquivo
            </button>
          </div>
        </div>

        {isMappingColumns && (
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-[var(--theme-color)]" />
              Mapear Colunas
            </h3>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">
              Confirme se as colunas da sua planilha foram identificadas
              corretamente. Se não, selecione qual coluna corresponde a cada
              dado.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {Object.keys(columnMapping)
                .filter((k) => {
                  if (importType === "UNIDADE") {
                    return [
                      "unidade",
                      "fatTotal",
                      "fatAssinaturas",
                      "assinantes",
                      "clientesNovos",
                      "clientesAtendidos",
                      "servicosRealizados",
                    ].includes(k);
                  }
                  if (importType === "UNIDADE_ITENS") {
                    return ["itemNome", "quantidade", "valorTotal"].includes(k);
                  }
                  if (importType === "CATALOGO") {
                    return ["itemNome", "categoriaNome", "valorTotal"].includes(
                      k,
                    );
                  }
                  return [
                    "profissional",
                    "servico",
                    "quantidade",
                    "valorTotal",
                    "valorComissao",
                  ].includes(k);
                })
                .map((key) => (
                  <div key={key}>
                    <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-2">
                      {key === "valorTotal"
                        ? "Valor Total *"
                        : key === "valorComissao"
                          ? "Comissão"
                          : key === "profissional"
                            ? "Profissional *"
                            : key === "quantidade"
                              ? "Quantidade *"
                              : key === "itemNome"
                                ? "Nome do Item *"
                                : key === "unidade"
                                  ? "Unidade *"
                                  : key === "categoriaNome"
                                    ? "Categoria"
                                    : key === "fatTotal"
                                      ? "Fat. Total *"
                                      : key === "fatAssinaturas"
                                        ? "Fat. Assinaturas"
                                        : key === "assinantes"
                                          ? "Qtd Assinantes"
                                          : key === "clientesNovos"
                                            ? "Clientes Novos"
                                            : key === "clientesAtendidos"
                                              ? "Qtd Clientes Atendidos"
                                              : key === "servicosRealizados"
                                                ? "Qtd Serviços Realizados"
                                                : key}
                    </label>
                    <select
                      value={(columnMapping as any)[key]}
                      onChange={(e) =>
                        setColumnMapping((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 rounded-lg p-2 text-sm text-gray-900 dark:text-zinc-100"
                    >
                      <option value="">-- Ignorar --</option>
                      {rawHeaders.map((h, i) => (
                        <option key={i} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={processMappedData}
                className="px-6 py-2 bg-[var(--theme-color)] text-white font-bold rounded-lg hover:bg-[#ff6b42] transition-colors shadow-lg shadow-[var(--theme-color)]/20"
              >
                Aplicar Mapeamento
              </button>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 px-4 py-3 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-5 h-5" />
              {successMessage}
            </div>
            <button onClick={() => setSuccessMessage("")}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {!isMappingColumns && parsedData.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 bg-gray-50 dark:bg-zinc-950 border-b border-gray-200 dark:border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-zinc-100">
                  Pré-visualização da Importação
                </h3>
                <p className="text-sm text-gray-500 dark:text-zinc-400">
                  {importType === "CATALOGO"
                    ? "Revise os itens que serão importados para o seu Catálogo. Itens com o mesmo nome serão atualizados."
                    : importType === "UNIDADE_ITENS"
                      ? "Confirme a unidade destino para os itens extraídos. Os valores de faturamento e quantidade serão acumulados nos totais do mês."
                      : importType === "UNIDADE"
                        ? 'Se a unidade não foi encontrada automaticamente, você pode vinculá-la manualmente na coluna "Unidade do Sistema".'
                        : 'Se o barbeiro não foi encontrado automaticamente, você pode vinculá-lo manualmente na coluna "Barbeiro do Sistema".'}
                </p>
              </div>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full md:w-auto px-6 py-2.5 bg-[var(--theme-color)] text-white font-bold rounded-lg hover:bg-[#ff6b42] transition-colors shadow-lg shadow-[var(--theme-color)]/20 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <RefreshCcw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Confirmar e Salvar
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600 dark:text-zinc-300">
                <thead className="bg-gray-100 dark:bg-zinc-950 text-gray-700 dark:text-zinc-400 text-xs uppercase font-bold border-b border-gray-200 dark:border-zinc-800">
                  <tr>
                    {importType === "CATALOGO" ? (
                      <>
                        <th className="px-4 py-3">Nome do Item (Planilha)</th>
                        <th className="px-4 py-3">Categoria</th>
                        <th className="px-4 py-3 text-right">Preço / Valor</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </>
                    ) : importType === "UNIDADE_ITENS" ? (
                      <>
                        <th className="px-4 py-3">Unidade Destino</th>
                        <th className="px-4 py-3">Total Identificado</th>
                        <th className="px-4 py-3 text-right">
                          Fat. Total Calculado
                        </th>
                        <th className="px-4 py-3 text-right">
                          Serviços Extraídos
                        </th>
                        <th className="px-4 py-3 text-right">
                          Produtos Extraídos
                        </th>
                      </>
                    ) : importType === "UNIDADE" ? (
                      <>
                        <th className="px-4 py-3">Unidade (Planilha)</th>
                        <th className="px-4 py-3">Unidade do Sistema</th>
                        <th className="px-4 py-3 text-right">Fat. Total</th>
                        <th className="px-4 py-3 text-right">Assinantes</th>
                        <th className="px-4 py-3 text-right">Serviços</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-3">Profissional (Planilha)</th>
                        <th className="px-4 py-3">Barbeiro do Sistema</th>
                        <th className="px-4 py-3 text-right">Qtd</th>
                        <th className="px-4 py-3 text-right">Valor Total</th>
                        <th className="px-4 py-3 text-right">Comissão</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                  {groupedData.map((g, i) => {
                    if (importType === "CATALOGO") {
                      const existing = catalog.find(
                        (c) =>
                          c.name.toLowerCase() === g.itemNome.toLowerCase(),
                      );
                      return (
                        <tr
                          key={i}
                          className="hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors"
                        >
                          <td className="px-4 py-4">
                            <div className="font-bold text-gray-900 dark:text-zinc-100">
                              {g.itemNome}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-gray-600 dark:text-zinc-400">
                            {g.categoriaNome || "-"}
                          </td>
                          <td className="px-4 py-4 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                            {g.valorTotal.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </td>
                          <td className="px-4 py-4 text-center">
                            {existing ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                Atualizar
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                Novo
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    }

                    if (importType === "UNIDADE_ITENS") {
                      return (
                        <tr
                          key={i}
                          className={`hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors ${!g.unitId ? "bg-red-50/50 dark:bg-red-900/10" : ""}`}
                        >
                          <td className="px-4 py-4">
                            <select
                              value={g.unitId || targetUnitId}
                              onChange={(e) => {
                                setTargetUnitId(e.target.value);
                                g.unitId = e.target.value;
                              }}
                              className={`w-full bg-white dark:bg-zinc-950 border ${!g.unitId ? "border-red-300 text-red-600 font-semibold" : "border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-zinc-100"} rounded-lg p-2 text-sm outline-none`}
                            >
                              <option value="">
                                -- Selecione a Unidade --
                              </option>
                              {systemUnits.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-4 text-gray-500">
                            {g.items?.length || 0} Itens Analisados
                          </td>
                          <td className="px-4 py-4 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                            {g.faturamentoTotal.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </td>
                          <td className="px-4 py-4 text-right font-mono font-medium">
                            {g.servicosRealizados}
                          </td>
                          <td className="px-4 py-4 text-right font-mono font-medium">
                            {g.vendasProdutosQtd}
                          </td>
                        </tr>
                      );
                    }

                    if (importType === "UNIDADE") {
                      return (
                        <tr
                          key={i}
                          className={`hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors ${!g.unitId ? "bg-red-50/50 dark:bg-red-900/10" : ""}`}
                        >
                          <td className="px-4 py-4">
                            <div className="font-bold text-gray-900 dark:text-zinc-100">
                              {g.unidade}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <select
                              value={g.unitId || ""}
                              onChange={(e) =>
                                handleUserMapChange(g.unidade, e.target.value)
                              }
                              className={`w-full bg-white dark:bg-zinc-950 border ${!g.unitId ? "border-red-300 text-red-600 font-semibold" : "border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-zinc-100"} rounded-lg p-2 text-sm outline-none`}
                            >
                              <option value="">
                                -- Não Localizado, Selecione --
                              </option>
                              {systemUnits.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-4 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                            {g.faturamentoTotal.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </td>
                          <td className="px-4 py-4 text-right font-mono font-medium">
                            {g.assinantes}
                          </td>
                          <td className="px-4 py-4 text-right font-mono font-medium">
                            {g.servicosRealizados}
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr
                        key={i}
                        className={`hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors ${!g.userId ? "bg-red-50/50 dark:bg-red-900/10" : ""}`}
                      >
                        <td className="px-4 py-4">
                          <div className="font-bold text-gray-900 dark:text-zinc-100">
                            {g.profissional}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <select
                            value={g.userId || ""}
                            onChange={(e) =>
                              handleUserMapChange(
                                g.profissional,
                                e.target.value,
                              )
                            }
                            className={`w-full bg-white dark:bg-zinc-950 border ${!g.userId ? "border-red-300 text-red-600 font-semibold" : "border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-zinc-100"} rounded-lg p-2 text-sm outline-none`}
                          >
                            <option value="">
                              -- Não Localizado, Selecione --
                            </option>
                            {users
                              .filter((u) => u.role !== "ADMIN")
                              .map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                          </select>
                        </td>
                        <td className="px-4 py-4 text-right font-mono font-medium">
                          {g.quantidade}
                        </td>
                        <td className="px-4 py-4 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                          {g.valorTotal.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </td>
                        <td className="px-4 py-4 text-right font-mono font-medium text-blue-600 dark:text-blue-400">
                          {g.valorComissao.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {importType === "DPOTE_PDF" && dpoteReport && (
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm mt-6">
            <div className="p-4 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 dark:text-zinc-100">
                Resumo do Relatório D'Pote
              </h3>
              <span className="font-bold text-[var(--theme-color)]">
                Faturamento Total Assinaturas:{" "}
                {dpoteReport.totalAssinaturas.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
              {dpoteReport.barbers.map((b, i) => (
                <div
                  key={i}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-bold text-gray-900 dark:text-zinc-100">
                      {b.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-zinc-400 mb-1">
                      Serviços: <span className="font-semibold text-gray-700 dark:text-gray-300">{b.totalServices}</span> |{" "}
                      Fichas: <span className="font-semibold text-gray-700 dark:text-gray-300">{b.totalTokens}</span>
                    </p>
                    <p className="text-sm text-gray-500 dark:text-zinc-400 mb-2">
                      Pote:{" "}
                      <span className="font-semibold text-purple-600 dark:text-purple-400">
                        {b.potPercentage}%
                      </span>{" "}
                      | Comissão:{" "}
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {b.commission.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>{" "}
                      | Fat. Assinaturas:{" "}
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {((b.potPercentage / 100) * dpoteReport.totalAssinaturas).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>
                    </p>
                    
                    {b.services && b.services.length > 0 && (
                      <div className="mt-3 bg-gray-50 dark:bg-zinc-900 rounded border border-gray-200 dark:border-zinc-800 p-2 overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="text-gray-500 dark:text-zinc-400 border-b border-gray-200 dark:border-zinc-800">
                            <tr>
                              <th className="pb-1 font-semibold">Serviço</th>
                              <th className="pb-1 text-right font-semibold">Qtd</th>
                              <th className="pb-1 text-right font-semibold">Fichas</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                            {b.services.map((svc, sIdx) => (
                              <tr key={sIdx}>
                                <td className="py-1 text-gray-800 dark:text-zinc-200">{svc.name}</td>
                                <td className="py-1 text-right text-gray-600 dark:text-zinc-400">{svc.quantity}</td>
                                <td className="py-1 text-right text-gray-600 dark:text-zinc-400">{svc.tokens}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  <div className="w-full md:w-64">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Vincular a Usuário
                    </label>
                    <select
                      value={manualUserMapping[b.name] || ""}
                      onChange={(e) =>
                        handleUserMapChange(b.name, e.target.value)
                      }
                      className={`w-full bg-white dark:bg-zinc-950 border ${!manualUserMapping[b.name] ? "border-red-300 text-red-600 font-semibold" : "border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-zinc-100"} rounded-lg p-2 text-sm outline-none`}
                    >
                      <option value="">Selecione...</option>
                      {users
                        .filter(
                          (u) => u.role === "BARBER" || u.role === "MANICURE",
                        )
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-4 bg-gray-50 dark:bg-zinc-950 border-t border-gray-200 dark:border-zinc-800 flex justify-end">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full md:w-auto px-6 py-2.5 bg-[var(--theme-color)] text-white font-bold rounded-lg hover:bg-[#ff6b42] transition-colors shadow-lg shadow-[var(--theme-color)]/20 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <RefreshCcw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Confirmar e Salvar
              </button>
            </div>
            
          </div>
        )}
      </div>
    );
}

import React, { useState, useRef, useMemo } from "react";
import { useStore } from "../store";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Save,
  X,
  RefreshCcw,
  Settings,
  TableProperties,
  ShieldCheck,
} from "lucide-react";
import { Category, MonthlyBarberStats, MonthlyUnitStats } from "../types";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { hydrateXlsxSharedStrings } from "../utils/xlsxSharedStrings";
import { parseDPotePDF, DPoteReport, parseDPoteSpreadsheet } from "../DPoteParser";
import { parseCashbarberProductsSpreadsheet, parseCashbarberProductsPDF, CashbarberProductReport } from "../CashbarberParser";
import { AppCard, AppPageHeader, appControlClass } from "./ui/AppPrimitives";

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
    payments,
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
    | "UNIDADE_SERVICOS"
    | "UNIDADE_PRODUTOS"
    | "CATALOGO"
    | "DPOTE_PDF"
    | "CASHBARBER_PRODUTOS"
  >("SERVICOS");
  const isUnitItemsImport = ["UNIDADE_ITENS", "UNIDADE_SERVICOS", "UNIDADE_PRODUTOS"].includes(importType);
  const [targetUnitId, setTargetUnitId] = useState<string>("");

  const [isParsing, setIsParsing] = useState(false);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  const [isMappingColumns, setIsMappingColumns] = useState(false);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [fileFingerprint, setFileFingerprint] = useState("");
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [importSummary, setImportSummary] = useState({ read: 0, valid: 0, ignored: 0 });

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
  const [errorMessage, setErrorMessage] = useState("");

  const sha256 = async (value: ArrayBuffer | string) => {
    const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  };

  const resetImportResult = () => {
    setParsedData([]);
    setRawData([]);
    setRawHeaders([]);
    setDpoteReport(null);
    setCashbarberReport(null);
    setSuccessMessage("");
    setErrorMessage("");
    setParseWarnings([]);
    setImportSummary({ read: 0, valid: 0, ignored: 0 });
    setIsMappingColumns(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > 30 * 1024 * 1024) {
      setFile(null);
      setErrorMessage("O arquivo excede o limite de 30 MB. Divida-o em arquivos menores antes de importar.");
      e.target.value = "";
      return;
    }

    setFile(selectedFile);
    resetImportResult();
    setAvailableSheets([]);
    setSelectedSheet("");

    const normalizedName = selectedFile.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const detectedType = normalizedName.includes("matriz ass")
      ? "DPOTE_PDF"
      : normalizedName.includes("produtos barbeiros")
        ? "CASHBARBER_PRODUTOS"
        : normalizedName.includes("servicos barbeiros")
          ? "SERVICOS"
          : normalizedName.includes("servicos realizados")
            ? "UNIDADE_SERVICOS"
            : normalizedName.includes("relatorio produtos")
              ? "UNIDADE_PRODUTOS"
              : null;
    if (detectedType) {
      setImportType(detectedType);
      setSuccessMessage("Tipo de relatório identificado automaticamente pelo nome do arquivo.");
    }

    try {
      const buffer = await selectedFile.arrayBuffer();
      setFileFingerprint(await sha256(buffer));

      if (/\.xlsx?$/i.test(selectedFile.name)) {
        const bytes = new Uint8Array(buffer);
        const workbook = XLSX.read(bytes, { type: "array" });
        hydrateXlsxSharedStrings(workbook, bytes);
        setAvailableSheets(workbook.SheetNames);
        setSelectedSheet(workbook.SheetNames[0] || "");
      }
    } catch (error) {
      console.error("Erro ao inspecionar arquivo:", error);
      setFileFingerprint("");
      setErrorMessage("Não foi possível inspecionar o arquivo selecionado.");
    }
  };

  const getWorksheetRows = (worksheet: XLSX.WorkSheet) => {
    const matrix = XLSX.utils.sheet_to_json<(string | number)[]>(worksheet, {
      header: 1,
      defval: "",
      raw: false,
    });
    const keywords = [
      "profissional", "barbeiro", "funcionario", "colaborador", "servico",
      "produto", "item", "descricao", "quantidade", "qtd", "valor", "total",
      "comissao", "unidade", "filial", "loja", "categoria", "cliente",
    ];
    let headerIndex = 0;
    let bestScore = -1;

    matrix.slice(0, 30).forEach((row, index) => {
      const values = row.map((cell) => String(cell ?? "").trim()).filter(Boolean);
      if (values.length < 2) return;
      const normalized = values.join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const hits = keywords.filter((keyword) => normalized.includes(keyword)).length;
      const score = hits * 10 + values.length;
      if (score > bestScore) {
        bestScore = score;
        headerIndex = index;
      }
    });

    return {
      rows: XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false, range: headerIndex }) as any[],
      headerIndex,
    };
  };

  const parseCurrency = (val: string | number): number => {
      if (!val) return 0;
      if (typeof val === "number") return val;
      let cleaned = String(val).replace(/R\$/gi, "").replace(/\s/g, "").trim();
      const negative = /^\(.*\)$/.test(cleaned) || cleaned.startsWith("-");
      cleaned = cleaned.replace(/[()\-+]/g, "").replace(/[^\d.,]/g, "");

      const lastComma = cleaned.lastIndexOf(",");
      const lastDot = cleaned.lastIndexOf(".");
      if (lastComma >= 0 && lastDot >= 0) {
        cleaned = lastComma > lastDot
          ? cleaned.replace(/\./g, "").replace(",", ".")
          : cleaned.replace(/,/g, "");
      } else if (lastComma >= 0) {
        cleaned = cleaned.replace(/\./g, "").replace(",", ".");
      } else if ((cleaned.match(/\./g) || []).length > 1) {
        const parts = cleaned.split(".");
        const decimal = parts.at(-1)?.length === 2 ? `.${parts.pop()}` : "";
        cleaned = `${parts.join("")}${decimal}`;
      } else if (lastDot >= 0 && cleaned.length - lastDot - 1 === 3) {
        cleaned = cleaned.replace(".", "");
      }

      const parsed = Number.parseFloat(cleaned) || 0;
      return negative ? -parsed : parsed;
    };

    const parseWholeNumber = (val: unknown): number => {
      if (typeof val === "number") return Math.round(val);
      const normalized = String(val ?? "").replace(/[^\d-]/g, "");
      return Number.parseInt(normalized, 10) || 0;
    };

    const handleParsedRawData = (data: any[], warnings: string[] = []) => {
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

      const nonEmptyData = normalizedData.filter((row) =>
        Object.values(row).some((value) => String(value ?? "").trim() !== ""),
      );
      const headers = Object.keys(nonEmptyData[0] || {});
      if (headers.length === 0) {
        setIsParsing(false);
        setErrorMessage("O arquivo foi aberto, mas não contém cabeçalhos ou linhas preenchidas.");
        return;
      }
      setRawHeaders(headers);
      setRawData(nonEmptyData);
      setParseWarnings(warnings);
      setImportSummary({ read: nonEmptyData.length, valid: 0, ignored: 0 });

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
      } else if (isUnitItemsImport) {
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
          } else if (isUnitItemsImport) {
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
              assinantes: parseWholeNumber(row[columnMapping.assinantes]),
              clientesNovos:
                parseWholeNumber(row[columnMapping.clientesNovos]),
              clientesAtendidos:
                parseWholeNumber(row[columnMapping.clientesAtendidos]),
              servicosRealizados:
                parseWholeNumber(row[columnMapping.servicosRealizados]),
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
          } else if (isUnitItemsImport) {
            return {
              isUnit: true,
              itemNome: String(row[columnMapping.itemNome] || "").trim(),
              quantidade: parseWholeNumber(row[columnMapping.quantidade]),
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
              quantidade: parseWholeNumber(row[columnMapping.quantidade]),
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
      setImportSummary({
        read: rawData.length,
        valid: mapped.length,
        ignored: Math.max(0, rawData.length - mapped.length),
      });
      setIsMappingColumns(false);
    };

    const processFile = async () => {
      if (!file) return;
      setIsParsing(true);
      setErrorMessage("");
      setParseWarnings([]);

      const fileName = file.name.toLowerCase();
      const isSpecializedReport = importType === "DPOTE_PDF" || importType === "CASHBARBER_PRODUTOS";
      if (fileName.endsWith(".pdf") && !isSpecializedReport) {
        setIsParsing(false);
        setErrorMessage("PDF só pode ser usado nos tipos D'Pote ou Comissão de Produtos Cashbarber.");
        return;
      }
      if (!/\.(xlsx?|csv|txt|pdf)$/i.test(fileName)) {
        setIsParsing(false);
        setErrorMessage("Formato não suportado. Utilize XLSX, XLS, CSV, TXT ou PDF.");
        return;
      }
      
if (importType === "CASHBARBER_PRODUTOS") {
        const handleCashbarberReport = (rep: CashbarberProductReport) => {
          if (!rep.barbers.length) {
            setErrorMessage("Nenhum profissional ou produto foi identificado no relatório do Cashbarber.");
            setIsParsing(false);
            return;
          }
          setCashbarberReport(rep);
          setImportSummary({ read: rep.barbers.length, valid: rep.barbers.length, ignored: 0 });
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
              setErrorMessage(err.message || "Erro ao ler o relatório do Cashbarber.");
              setIsParsing(false);
            });
        } else {
          parseCashbarberProductsSpreadsheet(file)
            .then(handleCashbarberReport)
            .catch((err) => {
              setErrorMessage(err.message || "Erro ao ler a planilha do Cashbarber.");
              setIsParsing(false);
            });
        }
        return;
      }

      if (importType === "DPOTE_PDF") {
        const handleDPoteReport = (rep: DPoteReport) => {
          if (!rep.barbers.length) {
            setErrorMessage("Nenhum profissional foi identificado no relatório D'Pote.");
            setIsParsing(false);
            return;
          }
          setDpoteReport(rep);
          setImportSummary({ read: rep.barbers.length, valid: rep.barbers.length, ignored: 0 });
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
              setErrorMessage("Erro ao ler o PDF D'Pote.");
            });
        } else {
          parseDPoteSpreadsheet(file)
            .then(handleDPoteReport)
            .catch((err) => {
              console.error(err);
              setIsParsing(false);
              setErrorMessage("Erro ao ler a planilha D'Pote.");
            });
        }
        return;
      }

      if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        try {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const workbook = XLSX.read(bytes, { type: "array" });
          const hydratedCells = hydrateXlsxSharedStrings(workbook, bytes);
          const sheetName = selectedSheet || workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) throw new Error("A aba selecionada não existe no arquivo.");
          const { rows, headerIndex } = getWorksheetRows(worksheet);
          const warnings: string[] = [];
          if (headerIndex > 0) warnings.push(`Cabeçalho identificado automaticamente na linha ${headerIndex + 1}.`);
          if (hydratedCells > 0) warnings.push(`${hydratedCells} célula(s) de texto do Excel foram recuperadas.`);
          handleParsedRawData(rows, warnings);
        } catch (error) {
          console.error("Erro ao ler Excel:", error);
          setIsParsing(false);
          setErrorMessage(error instanceof Error ? error.message : "Erro ao ler o arquivo Excel.");
        }
      } else {
        // Treat everything else as CSV/text
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const warnings = results.errors.slice(0, 5).map(
              (item) => `Linha ${(item.row ?? 0) + 2}: ${item.message}`,
            );
            handleParsedRawData(results.data as any[], warnings);
          },
          error: (error) => {
            console.error("Erro ao ler CSV:", error);
            setIsParsing(false);
            setErrorMessage("Erro ao ler o arquivo CSV. Verifique a formatação.");
          },
        });
      }
    };

    const upsertImportedPayment = async (
      userId: string,
      values: {
        commissionAvulso?: number;
        commissionProductGeneral?: number;
        commissionProductAvant?: number;
        commissionSubscriptions?: number;
        potPercentage?: number;
        potData?: { id: string; name: string; quantity: number; tokens: number }[];
      },
    ) => {
      const monthStr = `${selectedYear}-${selectedMonth}`;
      const deterministicId = `pay_import_${monthStr}_${userId}`;
      const existing = payments.find((payment) => payment.id === deterministicId)
        || payments.find((payment) =>
          payment.userId === userId && payment.date.startsWith(monthStr) && payment.status !== "PAGO",
        );
      const paymentId = existing?.id || deterministicId;
      const lastDay = new Date(Number(selectedYear), Number(selectedMonth), 0).getDate();
      const date = `${monthStr}-${String(lastDay).padStart(2, "0")}`;
      const commissionAvulso = values.commissionAvulso ?? existing?.commissionAvulso ?? 0;
      const commissionProductGeneral = values.commissionProductGeneral ?? existing?.commissionProductGeneral ?? 0;
      const commissionProductAvant = values.commissionProductAvant ?? existing?.commissionProductAvant ?? 0;
      const commissionSubscriptions = values.commissionSubscriptions ?? existing?.commissionSubscriptions ?? 0;
      const discount = existing?.discount || 0;

      await addPayment({
        id: paymentId,
        userId,
        date,
        commissionAvulso,
        commissionProductGeneral,
        commissionProductAvant,
        commissionSubscriptions,
        discount,
        discountDescription: existing?.discountDescription || "",
        discounts: existing?.discounts || [],
        amountToBePaid: Math.max(
          0,
          commissionAvulso + commissionProductGeneral + commissionProductAvant + commissionSubscriptions - discount,
        ),
        status: existing?.status || "PENDENTE",
        isPaid: existing?.isPaid || false,
        ...((values.potPercentage ?? existing?.potPercentage) !== undefined
          ? { potPercentage: values.potPercentage ?? existing?.potPercentage }
          : {}),
        potData: values.potData ?? existing?.potData ?? [],
      });
    };

    // Grouping by barber or unit
    const groupedData = useMemo(() => {
      if (importType === "CATALOGO") {
        return parsedData; // No grouping needed for catalog items
      }

      if (!parsedData.length) return [];

      if (isUnitItemsImport) {
        let fatTotal = 0;
        let servicos = 0;
        let produtos = 0;

        parsedData.forEach((item) => {
          fatTotal += item.valorTotal;
          const catItem = catalog.find(
            (c) => c.name.toLowerCase() === item.itemNome.toLowerCase(),
          );
          const category = catItem ? categories.find((item) => item.id === catItem.type) : undefined;
          const isProduct = importType === "UNIDADE_PRODUTOS"
            || (importType === "UNIDADE_ITENS" && category?.type === "PRODUCT");
          if (isProduct) {
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
      catalog,
      categories,
      systemUnits,
      targetUnitId,
      importType,
    ]);

    const handleSave = async () => {
      if ((importType === "DPOTE_PDF" || isUnitItemsImport || importType === "CASHBARBER_PRODUTOS") && !targetUnitId) {
         alert("Por favor, selecione a Unidade Alvo antes de salvar.");
         return;
      }

      const unmappedReportNames = importType === "DPOTE_PDF"
        ? (dpoteReport?.barbers || []).filter((item) => !manualUserMapping[item.name]).map((item) => item.name)
        : importType === "CASHBARBER_PRODUTOS"
          ? (cashbarberReport?.barbers || []).filter((item) => !manualUserMapping[item.name]).map((item) => item.name)
          : [];
      const hasUnmappedRows = !["CATALOGO", "UNIDADE_ITENS", "UNIDADE_SERVICOS", "UNIDADE_PRODUTOS", "DPOTE_PDF", "CASHBARBER_PRODUTOS"].includes(importType)
        && groupedData.some((group) => importType === "UNIDADE" ? !group.unitId : !group.userId);

      if (unmappedReportNames.length > 0 || hasUnmappedRows) {
        setErrorMessage(
          unmappedReportNames.length > 0
            ? `Vincule todos os profissionais antes de salvar: ${unmappedReportNames.slice(0, 3).join(", ")}${unmappedReportNames.length > 3 ? "..." : ""}.`
            : "Existem linhas sem vínculo com usuário ou unidade. Corrija os campos destacados antes de salvar.",
        );
        return;
      }

      if (["SERVICOS", "DPOTE_PDF", "CASHBARBER_PRODUTOS"].includes(importType)) {
        const reportUserIds = importType === "SERVICOS"
          ? groupedData.map((group) => group.userId).filter(Boolean)
          : Object.values(manualUserMapping).filter((userId) => userId && userId !== "__IGNORE__");
        const paidRecord = reportUserIds.find((userId) =>
          payments.some((payment) =>
            payment.userId === userId
            && payment.date.startsWith(`${selectedYear}-${selectedMonth}`)
            && payment.status === "PAGO",
          ),
        );
        if (paidRecord) {
          setErrorMessage("A importação foi bloqueada porque uma das comissões deste período já está paga. Reabra o pagamento antes de substituir o relatório.");
          return;
        }
      }

      setIsSaving(true);
      const monthStr = `${selectedYear}-${selectedMonth}`;

      try {
        let importJobRef: ReturnType<typeof doc> | null = null;
        if (file && fileFingerprint) {
          const contextFingerprint = await sha256(
            `${fileFingerprint}|${importType}|${monthStr}|${targetUnitId || "AUTO"}|${selectedSheet || "DEFAULT"}`,
          );
          importJobRef = doc(db, "dataImportJobs", contextFingerprint);
          const previousImport = await getDoc(importJobRef);
          if (previousImport.exists() && previousImport.data().status === "COMPLETED") {
            setErrorMessage(
              "Este mesmo arquivo já foi importado para este período, tipo e unidade. A gravação foi bloqueada para evitar valores duplicados.",
            );
            setIsSaving(false);
            return;
          }
        }

        if (importType === "DPOTE_PDF" && dpoteReport) {
          const unitIds = new Set<string>(targetUnitId ? [targetUnitId] : []);

          for (const barber of dpoteReport.barbers) {
            const userId = manualUserMapping[barber.name];
            if (!userId || userId === "__IGNORE__") continue;

            const user = users.find((u) => u.id === userId);
            if (!targetUnitId && user && user.unit) {
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

            const currentAvulso = currentStat.faturamentoAvulso
              ?? Math.max(0, (currentStat.faturamentoTotal || 0) - (currentStat.faturamentoAssinatura || 0));
            const commissionServices = currentStat.comissaoServicos
              ?? Math.max(0, (currentStat.comissao || 0) - (currentStat.comissaoProdutos || 0) - (currentStat.comissaoAssinatura || 0));
            const commissionProducts = currentStat.comissaoProdutos || 0;

            await updateMonthlyBarberStats({
              ...currentStat,
              faturamentoAvulso: currentAvulso,
              faturamentoAssinatura: fatAssinatura,
              faturamentoTotal: currentAvulso + fatAssinatura,
              comissaoAssinatura: barber.commission,
              comissao: commissionServices + commissionProducts + barber.commission,
              servicosAssinatura: barber.totalServices,
              fichasAssinatura: barber.totalTokens,
              percentualAssinatura: barber.potPercentage,
            });

            await upsertImportedPayment(userId, {
              commissionSubscriptions: barber.commission,
              potPercentage: barber.potPercentage,
              potData: barber.services.map((s) => ({
                id: `pot_${monthStr}_${userId}_${s.name}`,
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
              faturamentoAssinatura: dpoteReport.totalAssinaturas,
              faturamentoTotal:
                (currentUnitStat.faturamentoServicos
                  ?? Math.max(0,
                    (currentUnitStat.faturamentoTotal || 0)
                    - (currentUnitStat.faturamentoAssinatura || 0)
                    - (currentUnitStat.faturamentoProdutos || currentUnitStat.vendaProdutosValor || 0),
                  ))
                + (currentUnitStat.faturamentoProdutos || currentUnitStat.vendaProdutosValor || 0)
                + dpoteReport.totalAssinaturas,
            });
          }
        } else if (importType === "CASHBARBER_PRODUTOS" && cashbarberReport) {
          for (const barber of cashbarberReport.barbers) {
            const userId = manualUserMapping[barber.name];
            if (!userId || userId === "__IGNORE__") continue;

            const user = users.find((u) => u.id === userId);
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

            const commissionServices = currentStat.comissaoServicos
              ?? Math.max(0, (currentStat.comissao || 0) - (currentStat.comissaoProdutos || 0) - (currentStat.comissaoAssinatura || 0));
            const commissionSubscriptions = currentStat.comissaoAssinatura || 0;
            await updateMonthlyBarberStats({
              ...currentStat,
              vendaProdutosValor: barber.totalSales,
              vendasProdutosQtd: barber.totalProducts,
              comissaoProdutos: barber.totalCommission,
              comissao: commissionServices + commissionSubscriptions + barber.totalCommission,
            });
            
            await upsertImportedPayment(userId, {
              commissionProductGeneral: barber.commissionProdGeral || 0,
              commissionProductAvant: barber.commissionProdAvant || 0,
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
        } else if (isUnitItemsImport) {
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

              if (importType === "UNIDADE_SERVICOS" || importType === "UNIDADE_PRODUTOS") {
                updated.extraCounts[key] = item.quantidade;
                updated.extraValues[key] = item.valorTotal;
              } else {
                updated.extraCounts[key] = (updated.extraCounts[key] || 0) + item.quantidade;
                updated.extraValues[key] = (updated.extraValues[key] || 0) + item.valorTotal;
              }

              totalAddedFaturamento += item.valorTotal;
              const category = catItem ? categories.find((entry) => entry.id === catItem.type) : undefined;
              const isProduct = importType === "UNIDADE_PRODUTOS"
                || (importType === "UNIDADE_ITENS" && category?.type === "PRODUCT");
              if (isProduct) {
                addedProdutosValor += item.valorTotal;
                addedProdutosQtd += item.quantidade;
              } else {
                addedServicos += item.quantidade;
              }
            }

            if (importType === "UNIDADE_SERVICOS") {
              const productRevenue = current.faturamentoProdutos || current.vendaProdutosValor || 0;
              updated.faturamentoServicos = totalAddedFaturamento;
              updated.servicosRealizados = addedServicos;
              updated.faturamentoTotal = totalAddedFaturamento + productRevenue + (current.faturamentoAssinatura || 0);
            } else if (importType === "UNIDADE_PRODUTOS") {
              const serviceRevenue = current.faturamentoServicos
                ?? Math.max(0, (current.faturamentoTotal || 0) - (current.faturamentoAssinatura || 0) - (current.vendaProdutosValor || 0));
              updated.faturamentoProdutos = totalAddedFaturamento;
              updated.vendaProdutosValor = addedProdutosValor;
              updated.vendasProdutosQtd = addedProdutosQtd;
              updated.faturamentoTotal = serviceRevenue + totalAddedFaturamento + (current.faturamentoAssinatura || 0);
            } else {
              updated.faturamentoTotal += totalAddedFaturamento;
              updated.servicosRealizados += addedServicos;
              updated.vendaProdutosValor = (updated.vendaProdutosValor || 0) + addedProdutosValor;
              updated.vendasProdutosQtd = (updated.vendasProdutosQtd || 0) + addedProdutosQtd;
            }

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
              updated.faturamentoAvulso = group.valorTotal;
              updated.faturamentoTotal = group.valorTotal + (current.faturamentoAssinatura || 0);
              updated.servicosRealizados = group.quantidade;
              updated.comissaoServicos = group.valorComissao;
              updated.comissao = group.valorComissao + (current.comissaoProdutos || 0) + (current.comissaoAssinatura || 0);
            } else {
              updated.vendaProdutosValor = group.valorTotal;
              updated.vendasProdutosQtd = group.quantidade;
              updated.comissaoProdutos = group.valorComissao;
              updated.comissao = (current.comissaoServicos || 0) + group.valorComissao + (current.comissaoAssinatura || 0);
            }

            // Detailed items mapping
            const importedCounts: Record<string, number> = {};
            const importedValues: Record<string, number> = {};
            for (const item of group.items) {
              if (!item.servico) continue;
              // Try to map to catalog
              const catItem = catalog.find(
                (c) => c.name.toLowerCase() === item.servico.toLowerCase(),
              );
              const key = catItem ? catItem.id : item.servico;
              importedCounts[key] = (importedCounts[key] || 0) + item.quantidade;
              importedValues[key] = (importedValues[key] || 0) + item.valorTotal;
            }
            Object.assign(updated.extraCounts, importedCounts);
            Object.assign(updated.extraValues, importedValues);

            await updateMonthlyBarberStats(updated);
            if (importType === "SERVICOS") {
              await upsertImportedPayment(group.userId, {
                commissionAvulso: group.valorComissao,
              });
            }
          }
        }

        if (importJobRef && file) {
          await setDoc(importJobRef, {
            status: "COMPLETED",
            fileName: file.name,
            fileSize: file.size,
            fileFingerprint,
            importType,
            month: monthStr,
            targetUnitId: targetUnitId || null,
            sheetName: selectedSheet || null,
            rowsRead: importSummary.read,
            rowsImported: importSummary.valid || parsedData.length,
            importedAt: new Date().toISOString(),
          });
        }

        setSuccessMessage("Dados importados com sucesso e registrados no histórico!");
        setErrorMessage("");
        setParsedData([]);
        setDpoteReport(null);
        setCashbarberReport(null);
        setIsMappingColumns(false);
        setManualUserMapping({});
        setFile(null);
        setAvailableSheets([]);
        setSelectedSheet("");
        setFileFingerprint("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (e) {
        console.error(e);
        setErrorMessage(
          e instanceof Error
            ? `Não foi possível concluir a importação: ${e.message}`
            : "Não foi possível concluir a importação.",
        );
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
        <AppPageHeader
          eyebrow="Dados"
          title="Importador de relatórios"
          description="Importe Excel, CSV, TXT ou PDF com identificação automática, validação prévia e proteção contra duplicidade."
          icon={<Upload className="h-5 w-5" />}
        />

        <AppCard className="p-5 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                Tipo de Importação
              </label>
              <select
                value={importType}
                onChange={(e) => {
                  setImportType(e.target.value as any);
                  resetImportResult();
                }}
                className={`${appControlClass} w-full bg-gray-50 dark:bg-zinc-950`}
              >
                <option value="SERVICOS">Barbeiros - Serviços e comissões (CSV)</option>
                <option value="CASHBARBER_PRODUTOS">Barbeiros - Produtos e comissões (PDF/Planilha)</option>
                <option value="DPOTE_PDF">Barbeiros - Assinaturas D'Pote (PDF/Planilha)</option>
                <option value="UNIDADE_SERVICOS">Unidade - Serviços realizados (CSV)</option>
                <option value="UNIDADE_PRODUTOS">Unidade - Produtos vendidos (CSV)</option>
                <option value="PRODUTOS">Barbeiros - Produtos (CSV genérico)</option>
                <option value="UNIDADE">Dados da Unidade (Consolidado)</option>
                <option value="UNIDADE_ITENS">
                  Relatório de Itens da Unidade (Serviços/Produtos)
                </option>
                <option value="CATALOGO">
                  Cadastro de Catálogo (Produtos/Serviços)
                </option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                Mês Base
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className={`${appControlClass} w-full bg-gray-50 dark:bg-zinc-950`}
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
                className={`${appControlClass} w-full bg-gray-50 dark:bg-zinc-950`}
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
                className={`${appControlClass} w-full bg-gray-50 dark:bg-zinc-950`}
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
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 text-sm text-gray-900 outline-none transition file:mr-3 file:rounded-lg file:border-0 file:bg-gray-900 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white focus:border-[var(--theme-color)] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:file:bg-white dark:file:text-zinc-900"
              />
            </div>
            {availableSheets.length > 0 && !["DPOTE_PDF", "CASHBARBER_PRODUTOS"].includes(importType) && (
              <div className="w-full md:w-64">
                <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                  Aba do Excel
                </label>
                <select
                  value={selectedSheet}
                  onChange={(e) => {
                    setSelectedSheet(e.target.value);
                    resetImportResult();
                  }}
                  className={`${appControlClass} w-full bg-gray-50 dark:bg-zinc-950`}
                >
                  {availableSheets.map((sheet) => (
                    <option key={sheet} value={sheet}>{sheet}</option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={processFile}
              disabled={!file || isParsing}
              className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-gray-950 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 md:w-auto"
            >
              {isParsing ? (
                <RefreshCcw className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              Ler Arquivo
            </button>
          </div>
        </AppCard>

        {errorMessage && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 font-medium">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage("")} aria-label="Fechar mensagem">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {parseWarnings.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300 mb-1">
              <AlertCircle className="w-4 h-4" /> Diagnóstico da leitura
            </div>
            {parseWarnings.map((warning, index) => (
              <p key={index} className="text-sm text-amber-700 dark:text-amber-400">{warning}</p>
            ))}
          </div>
        )}

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
                  if (isUnitItemsImport) {
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

            <div className="mt-6 border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 dark:bg-zinc-950 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-zinc-300">
                <TableProperties className="w-4 h-4" /> Amostra das primeiras linhas lidas
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-100 dark:bg-zinc-900 text-gray-600 dark:text-zinc-400">
                    <tr>{rawHeaders.map((header) => <th key={header} className="px-3 py-2 text-left whitespace-nowrap">{header}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                    {rawData.slice(0, 5).map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {rawHeaders.map((header) => <td key={header} className="px-3 py-2 max-w-56 truncate">{String(row[header] ?? "")}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={processMappedData}
                className="px-6 py-2 bg-[var(--theme-color)] text-white font-bold rounded-lg hover:bg-[var(--theme-color-strong)] transition-colors shadow-lg shadow-[var(--theme-color)]/20"
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
                    : isUnitItemsImport
                      ? `Confirme a unidade destino. Este arquivo será tratado como ${importType === "UNIDADE_PRODUTOS" ? "venda de produtos" : importType === "UNIDADE_SERVICOS" ? "serviços realizados" : "itens mistos"}.`
                      : importType === "UNIDADE"
                        ? 'Se a unidade não foi encontrada automaticamente, você pode vinculá-la manualmente na coluna "Unidade do Sistema".'
                        : 'Se o barbeiro não foi encontrado automaticamente, você pode vinculá-lo manualmente na coluna "Barbeiro do Sistema".'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                    {importSummary.read} linhas lidas
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {importSummary.valid} válidas
                  </span>
                  {importSummary.ignored > 0 && (
                    <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                      {importSummary.ignored} ignoradas
                    </span>
                  )}
                  <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300 inline-flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> duplicidade protegida
                  </span>
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full md:w-auto px-6 py-2.5 bg-[var(--theme-color)] text-white font-bold rounded-lg hover:bg-[var(--theme-color-strong)] transition-colors shadow-lg shadow-[var(--theme-color)]/20 flex items-center justify-center gap-2"
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
                    ) : isUnitItemsImport ? (
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

                    if (isUnitItemsImport) {
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
                      <option value="__IGNORE__">Ignorar este profissional</option>
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
                className="w-full md:w-auto px-6 py-2.5 bg-[var(--theme-color)] text-white font-bold rounded-lg hover:bg-[var(--theme-color-strong)] transition-colors shadow-lg shadow-[var(--theme-color)]/20 flex items-center justify-center gap-2"
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
        {importType === "CASHBARBER_PRODUTOS" && cashbarberReport && (
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm mt-6">
            <div className="p-4 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-zinc-100">Resumo de Produtos Cashbarber</h3>
                <p className="text-sm text-gray-500 dark:text-zinc-400">
                  Revise os valores e vincule todos os profissionais antes de salvar.
                </p>
              </div>
              <span className="text-sm font-semibold text-[var(--theme-color)] inline-flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" /> {cashbarberReport.barbers.length} profissionais identificados
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 dark:bg-zinc-950 text-xs uppercase text-gray-600 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3">Profissional</th>
                    <th className="px-4 py-3">Usuário do sistema</th>
                    <th className="px-4 py-3 text-right">Produtos</th>
                    <th className="px-4 py-3 text-right">Vendas</th>
                    <th className="px-4 py-3 text-right">Comissão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                  {cashbarberReport.barbers.map((barber) => (
                    <tr key={barber.name} className={!manualUserMapping[barber.name] ? "bg-red-50/50 dark:bg-red-950/10" : ""}>
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-zinc-100">{barber.name}</td>
                      <td className="px-4 py-3">
                        <select
                          value={manualUserMapping[barber.name] || ""}
                          onChange={(e) => handleUserMapChange(barber.name, e.target.value)}
                          className={`w-full min-w-48 bg-white dark:bg-zinc-950 border ${!manualUserMapping[barber.name] ? "border-red-300 text-red-600" : "border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-zinc-100"} rounded-lg p-2`}
                        >
                          <option value="">Selecione...</option>
                          <option value="__IGNORE__">Ignorar este profissional</option>
                          {users.filter((user) => user.role !== "ADMIN").map((user) => (
                            <option key={user.id} value={user.id}>{user.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{barber.totalProducts}</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                        {barber.totalSales.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-blue-600 dark:text-blue-400">
                        {barber.totalCommission.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-zinc-950 border-t border-gray-200 dark:border-zinc-800 flex justify-end">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full md:w-auto px-6 py-2.5 bg-[var(--theme-color)] text-white font-bold rounded-lg hover:bg-[var(--theme-color-strong)] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Confirmar e Salvar
              </button>
            </div>
          </div>
        )}
      </div>
    );
}

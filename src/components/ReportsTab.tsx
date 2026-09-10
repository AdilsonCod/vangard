import React, { useMemo, useState, useEffect, useRef } from 'react';
import { toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { useStore } from '../store';
import { Category, CatalogItem, DailyEntry } from '../types';
import { 
  FileText, TrendingUp, Users, DollarSign, Calendar, Gift, 
  Plus, ChevronLeft, ChevronRight, Filter, Info, ShoppingBag, 
  Activity, Award, Layers, Sparkles, Check, Edit2, X, Sparkle, HelpCircle,
  Download, Loader2
} from 'lucide-react';
import { db } from '../firebase';
import { doc, setDoc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { AppPageHeader, appControlClass } from './ui/AppPrimitives';
import { scopedCollectionQuery } from '../services/firestoreScope';
import { applyCommercialDiscount, calculateTotalRevenue } from '../services/financialEngine';

export interface WeekInterval {
  id: string;
  startDay: number;
  endDay: number;
  label: string;
}

export function getWeeksForMonth(year: number, monthStr: string): WeekInterval[] {
  try {
    const monthIndex = parseInt(monthStr, 10) - 1;
    if (isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
      return [];
    }
    const numDays = new Date(year, monthIndex + 1, 0).getDate();
    const weeks: WeekInterval[] = [];
    let currentStart = 1;
    let weekNum = 1;
    
    for (let day = 1; day <= numDays; day++) {
      const d = new Date(year, monthIndex, day, 12, 0, 0);
      const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      
      // Week ends if Sunday (0) or last day of month
      if (dayOfWeek === 0 || day === numDays) {
        weeks.push({
          id: `W${weekNum}`,
          startDay: currentStart,
          endDay: day,
          label: `${String(currentStart).padStart(2, '0')} a ${String(day).padStart(2, '0')}`
        });
        currentStart = day + 1;
        weekNum++;
      }
    }
    return weeks;
  } catch (error) {
    console.error("Error calculating weeks for month:", error);
    return [];
  }
}

export function ReportsTab() {
  const { 
    entries, 
    catalog, 
    categories, 
    subcategories, 
    users, 
    systemUnits,
    currentUser,
    updateCategories 
  } = useStore();

  // Selected periods
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>(
    String(new Date().getMonth() + 1).padStart(2, '0')
  );
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [selectedWeek, setSelectedWeek] = useState<string>('ALL');
  const selectedBarber = 'ALL';

  const reportRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Dynamic weeks calculation for the selected month/year
  const currentMonthWeeks = useMemo(() => {
    return getWeeksForMonth(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]);

  // Adjust selectedWeek if it becomes invalid (e.g. changing month to one with fewer weeks)
  useEffect(() => {
    if (selectedWeek !== 'ALL') {
      const exists = currentMonthWeeks.some(w => w.id === selectedWeek);
      if (!exists) {
        setSelectedWeek('ALL');
      }
    }
  }, [currentMonthWeeks, selectedWeek]);

  // New Category form state
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'SERVICE' | 'PRODUCT' | 'SUBSCRIPTION'>('SERVICE');
  const [catRegSuccess, setCatRegSuccess] = useState(false);
  const [catRegError, setCatRegError] = useState<string | null>(null);

  // Weekly Reports Overrides state
  const [docData, setDocData] = useState<any>({ weeks: {} });
  const [allUnitsDocData, setAllUnitsDocData] = useState<Record<string, any>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Record<string, { amount: number, grossRev: number }>>({});
  const [formClientsServed, setFormClientsServed] = useState<number>(0);
  const [formCourtesy, setFormCourtesy] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setIsGeneratingPdf(true);
    let exportStage: HTMLDivElement | null = null;
    try {
      const element = reportRef.current;

      // Render a desktop-sized clone so exports made on phones and computers
      // always have exactly the same A4 landscape composition.
      const exportWidth = 1120;
      const clone = element.cloneNode(true) as HTMLDivElement;
      clone.classList.add('report-pdf-export');
      clone.querySelectorAll<HTMLElement>('[data-html2canvas-ignore="true"]').forEach(node => node.remove());
      exportStage = document.createElement('div');
      exportStage.className = 'report-pdf-export-stage';
      exportStage.style.width = `${exportWidth}px`;
      exportStage.appendChild(clone);
      document.body.appendChild(exportStage);

      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

      const backgroundColor = getComputedStyle(clone).backgroundColor || '#18181b';
      const canvas = await toCanvas(clone, {
        pixelRatio: 2,
        width: exportWidth,
        height: clone.scrollHeight,
        backgroundColor,
        cacheBust: true,
        filter: (node) => {
          if (node instanceof HTMLElement && node.dataset && node.dataset.html2canvasIgnore) {
            return false;
          }
          return true;
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const margin = 4;
      const availableWidth = pdfWidth - margin * 2;
      const availableHeight = pdfHeight - margin * 2;
      const scale = Math.min(availableWidth / canvas.width, availableHeight / canvas.height);
      const contentWidth = canvas.width * scale;
      const contentHeight = canvas.height * scale;
      const xOffset = (pdfWidth - contentWidth) / 2;
      const yOffset = (pdfHeight - contentHeight) / 2;

      // Paint the entire sheet using the report background and fit the complete
      // report once; this deliberately prevents additional PDF pages.
      const backgroundChannels = backgroundColor.match(/[\d.]+/g)?.slice(0, 3).map(Number);
      const [backgroundRed, backgroundGreen, backgroundBlue] = backgroundChannels?.length === 3
        ? backgroundChannels
        : [24, 24, 27];
      pdf.setFillColor(backgroundRed, backgroundGreen, backgroundBlue);
      pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
      pdf.addImage(imgData, 'PNG', xOffset, yOffset, contentWidth, contentHeight, undefined, 'FAST');

      const unitName = systemUnits?.find(u => u.id === selectedUnit)?.name || 'Consolidado';
      const periodLabel = selectedWeek === 'ALL' 
        ? `Mensal-${MONTH_NAMES[parseInt(selectedMonth, 10) - 1]}` 
        : `Semana-${selectedWeek.substring(1)}-(${currentMonthWeeks.find(w => w.id === selectedWeek)?.label || ''})`;

      const filename = `Relatorio-Faturamento-${unitName.replace(/\s+/g, '-')}-${periodLabel.replace(/\s+/g, '-')}-${selectedYear}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      exportStage?.remove();
      setIsGeneratingPdf(false);
    }
  };

  // Construct current unique document ID for weekly report overrides
  const docId = `${selectedYear}-${selectedMonth}_${selectedUnit}`;

  // Read and listen to weekly manual overrides from Firestore in real-time
  useEffect(() => {
    if (selectedUnit === 'ALL') {
      const q = scopedCollectionQuery('reports_manual_weeks', currentUser, { constraints: [
        where('year', '==', selectedYear),
        where('month', '==', selectedMonth),
      ] });
      const unsub = onSnapshot(q, (snapshot) => {
        let aggregatedWeeks: any = {};
        let unitsDocMap: Record<string, any> = {};
        
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.unit === 'ALL') return; // Skip if there's somehow an ALL document

          if (data.unit) {
            unitsDocMap[data.unit] = data;
          }

          const unitWeeks = data.weeks || {};
          Object.keys(unitWeeks).forEach(wk => {
            if (!aggregatedWeeks[wk]) {
              aggregatedWeeks[wk] = { items: {}, clientsServed: 0, courtesyCommissionTotal: 0 };
            }
            aggregatedWeeks[wk].clientsServed += (unitWeeks[wk].clientsServed || 0);
            aggregatedWeeks[wk].courtesyCommissionTotal += (unitWeeks[wk].courtesyCommissionTotal || 0);

            const items = unitWeeks[wk].items || {};
            Object.keys(items).forEach(key => {
              if (!aggregatedWeeks[wk].items[key]) {
                aggregatedWeeks[wk].items[key] = { amount: 0, grossRev: 0 };
              }
              aggregatedWeeks[wk].items[key].amount += (items[key].amount || 0);
              aggregatedWeeks[wk].items[key].grossRev += (items[key].grossRev || 0);
            });
          });
        });
        
        setAllUnitsDocData(unitsDocMap);
        setDocData({ weeks: aggregatedWeeks });
      });
      return () => unsub();
    } else {
      const docRef = doc(db, 'reports_manual_weeks', docId);
      const unsub = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          setDocData(docSnap.data() || { weeks: {} });
        } else {
          setDocData({ weeks: {} });
        }
      });
      return () => unsub();
    }
  }, [docId, selectedYear, selectedMonth, selectedUnit]);

  // Sync state values to form fields when selected week or document changes
  useEffect(() => {
    if (!isEditing) {
      const wk = (selectedWeek === 'ALL') ? 'W1' : selectedWeek;
      const weekOver = docData?.weeks?.[wk] || {};
      setFormData(weekOver.items || {});
      setFormClientsServed(weekOver.clientsServed || 0);
      setFormCourtesy(weekOver.courtesyCommissionTotal || 0);
    }
  }, [docData, selectedWeek, isEditing]);

  // Handle saving manual values
  const handleSaveManualValues = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const wk = (selectedWeek === 'ALL') ? 'W1' : selectedWeek;
      
      const updatedWeeks = {
        ...(docData?.weeks || {}),
        [wk]: {
          items: formData,
          clientsServed: formClientsServed,
          courtesyCommissionTotal: formCourtesy
        }
      };

      const docRef = doc(db, 'reports_manual_weeks', docId);
      await setDoc(docRef, {
        id: docId,
        year: selectedYear,
        month: selectedMonth,
        unitId: selectedUnit,
        unit: selectedUnit,
        weeks: updatedWeeks,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving manual report values:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (key: string, field: 'amount' | 'grossRev', value: number) => {
    setFormData(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || { amount: 0, grossRev: 0 }),
        [field]: value
      }
    }));
  };

  // Filtered system dashboard entries for the chosen Month + Year + Unit
  const filteredEntries = useMemo(() => {
    const monthStr = `${selectedYear}-${selectedMonth}`;
    return entries.filter(entry => {
      // Date matches month-year pattern
      const matchesMonth = entry.date.startsWith(monthStr);
      if (!matchesMonth) return false;

      // Unit filtering
      if (selectedUnit !== 'ALL') {
        const entryUser = users.find(u => u.id === entry.userId);
        if (!entryUser || entryUser.unit !== selectedUnit) return false;
      }

      return true;
    });
  }, [entries, selectedYear, selectedMonth, selectedUnit, users]);

  // Helper to determine the week interval of a day (system entry faturamento metrics)
  const getWeekIdFromDate = (dateStr: string): string => {
    try {
      const parts = dateStr.split('-');
      const y = parseInt(parts[0], 10);
      const mStr = parts[1];
      const day = parseInt(parts[2], 10);
      
      const weeksForMon = getWeeksForMonth(y, mStr);
      const found = weeksForMon.find(w => day >= w.startDay && day <= w.endDay);
      return found ? found.id : 'W1';
    } catch (e) {
      return 'W1';
    }
  };

  // Filter subscriptions from our Catalog
  const subscriptionCatalogItems = useMemo(() => {
    return catalog.filter(c => {
      const parentCat = categories.find(cat => cat.id === c.type);
      return c.name.toLowerCase().includes('assinatura') || 
             c.name.toLowerCase().includes("van's") || 
             parentCat?.type === 'SUBSCRIPTION';
    });
  }, [catalog, categories]);

  // Filter product items from our Catalog
  const productCatalogItems = useMemo(() => {
    return catalog.filter(c => {
      const parentCat = categories.find(cat => cat.id === c.type);
      return c.type === 'PRODUCT' || parentCat?.type === 'PRODUCT';
    });
  }, [catalog, categories]);

  // Comprehensive mathematical faturamento statistics (sums up system daily sheets + weekly overrides)
  const stats = useMemo(() => {
    const computeSingleUnitStats = (unitId: string) => {
      // 1. Filter entries for this unit
      const monthStr = `${selectedYear}-${selectedMonth}`;
      const unitEntries = entries.filter(entry => {
        const matchesMonth = entry.date.startsWith(monthStr);
        if (!matchesMonth) return false;
        const entryUser = users.find(u => u.id === entry.userId);
        return entryUser && entryUser.unit === unitId;
      });

      // 2. Initialize breakdowns
      let rawServiceTotal_u = 0;
      let productTotal_u = 0;
      let subscriptionTotal_u = 0;
      let distinctClients_u = 0;
      let courtesyCount_u = 0;
      let courtesyCommissionTotal_u = 0;
      let courtesyPriceEquivalent_u = 0;

      const categoryRevBreakdown_u: Record<string, { amount: number, grossRev: number }> = {};
      const productItemBreakdown_u: Record<string, { name: string, amount: number, grossRev: number }> = {};
      const subscriptionBreakdown_u: Record<string, { name: string, amount: number, grossRev: number }> = {};

      categories.forEach(cat => {
        categoryRevBreakdown_u[cat.id] = { amount: 0, grossRev: 0 };
      });

      catalog.forEach(item => {
        const isProduct = item.type === 'PRODUCT';
        const isSub = item.name.toLowerCase().includes('assinatura') || 
                    item.name.toLowerCase().includes("van's") || 
                    (item.type && categories.find(c => c.id === item.type)?.type === 'SUBSCRIPTION');
        
        if (isProduct) {
          productItemBreakdown_u[item.id] = { name: item.name, amount: 0, grossRev: 0 };
        }
        if (isSub) {
          subscriptionBreakdown_u[item.id] = { name: item.name, amount: 0, grossRev: 0 };
        }
      });

      const sysDistinctW: Record<string, number> = {};
      const sysCourtesyW: Record<string, number> = {};
      currentMonthWeeks.forEach(w => {
        sysDistinctW[w.id] = 0;
        sysCourtesyW[w.id] = 0;
      });

      // 3. Process system daily sheets
      unitEntries.forEach(entry => {
        if (entry.isDayOff) return;
        const wId = getWeekIdFromDate(entry.date);
        if (selectedWeek !== 'ALL' && selectedWeek !== wId) return;

        if (sysDistinctW[wId] !== undefined) {
          sysDistinctW[wId] += entry.uniqueClientsServed || entry.clientsServed || 0;
        } else {
          sysDistinctW[wId] = entry.uniqueClientsServed || entry.clientsServed || 0;
        }

        if (entry.items) {
          Object.entries(entry.items).forEach(([itemId, val]) => {
            if (!val || val.amount <= 0) return;
            const catItem = catalog.find(c => c.id === itemId);
            if (!catItem) return;

            const itemPrice = catItem.price || 0;
            const revenue = val.amount * itemPrice;

            const itemCat = categories.find(c => c.id === catItem.type);
            const isProduct = catItem.type === 'PRODUCT' || itemCat?.type === 'PRODUCT';
            const isSub = catItem.name.toLowerCase().includes('assinatura') || 
                        catItem.name.toLowerCase().includes("van's") || 
                        itemCat?.type === 'SUBSCRIPTION';

            if (isSub) {
              subscriptionTotal_u += revenue;
              if (!subscriptionBreakdown_u[itemId]) {
                subscriptionBreakdown_u[itemId] = { name: catItem.name, amount: 0, grossRev: 0 };
              }
              subscriptionBreakdown_u[itemId].amount += val.amount;
              subscriptionBreakdown_u[itemId].grossRev += revenue;
            } else if (isProduct) {
              productTotal_u += revenue;
              if (!productItemBreakdown_u[itemId]) {
                productItemBreakdown_u[itemId] = { name: catItem.name, amount: 0, grossRev: 0 };
              }
              productItemBreakdown_u[itemId].amount += val.amount;
              productItemBreakdown_u[itemId].grossRev += revenue;
            } else {
              rawServiceTotal_u += revenue;
              const targetCatId = catItem.type || 'SERVICE';
              if (categoryRevBreakdown_u[targetCatId]) {
                categoryRevBreakdown_u[targetCatId].amount += val.amount;
                categoryRevBreakdown_u[targetCatId].grossRev += revenue;
              }
            }
          });
        }

        if (entry.cortesias) {
          Object.entries(entry.cortesias).forEach(([itemId, val]) => {
            if (!val || val.amount <= 0) return;
            const catItem = catalog.find(c => c.id === itemId);
            const itemPrice = catItem ? (catItem.price || 0) : 0;

            courtesyCount_u += val.amount;
            if (sysCourtesyW[wId] !== undefined) {
               sysCourtesyW[wId] += val.commission || 0;
            } else {
               sysCourtesyW[wId] = val.commission || 0;
            }
            courtesyPriceEquivalent_u += val.amount * itemPrice;
          });
        }
      });

      // 4. Manual overrides data
      const unitDocWeeks = (unitId === selectedUnit) ? (docData?.weeks || {}) : (allUnitsDocData[unitId]?.weeks || {});
      const targetWeeks = selectedWeek === 'ALL' ? currentMonthWeeks.map(wk => wk.id) : [selectedWeek];

      targetWeeks.forEach(w => {
        const wkOverride = unitDocWeeks[w] || {};
        const wkItems = wkOverride.items || {};

        const manualClients = wkOverride.clientsServed;
        const weekClients = (typeof manualClients === 'number' && manualClients >= 0) ? manualClients : (sysDistinctW[w] || 0);
        distinctClients_u += weekClients;

        const manualCourtesy = wkOverride.courtesyCommissionTotal;
        const weekCourtesy = (typeof manualCourtesy === 'number' && manualCourtesy >= 0) ? manualCourtesy : (sysCourtesyW[w] || 0);
        courtesyCommissionTotal_u += weekCourtesy;

        Object.entries(wkItems).forEach(([key, val]: [string, any]) => {
          if (!val) return;
          const amount = Number(val.amount) || 0;
          const grossRev = Number(val.grossRev) || 0;
          if (amount <= 0 && grossRev <= 0) return;

          const isCat = categories.some(c => c.id === key);
          if (isCat) {
            const cat = categories.find(c => c.id === key);
            const cType = cat?.type || 'SERVICE';

            if (cType === 'SUBSCRIPTION') {
              subscriptionTotal_u += grossRev;
              if (!subscriptionBreakdown_u[key]) {
                subscriptionBreakdown_u[key] = { name: cat.name, amount: 0, grossRev: 0 };
              }
              subscriptionBreakdown_u[key].amount += amount;
              subscriptionBreakdown_u[key].grossRev += grossRev;
            } else if (cType === 'PRODUCT') {
              productTotal_u += grossRev;
              if (!productItemBreakdown_u[key]) {
                productItemBreakdown_u[key] = { name: cat.name, amount: 0, grossRev: 0 };
              }
              productItemBreakdown_u[key].amount += amount;
              productItemBreakdown_u[key].grossRev += grossRev;
            } else {
              rawServiceTotal_u += grossRev;
              if (!categoryRevBreakdown_u[key]) {
                categoryRevBreakdown_u[key] = { amount: 0, grossRev: 0 };
              }
              categoryRevBreakdown_u[key].amount += amount;
              categoryRevBreakdown_u[key].grossRev += grossRev;
            }
          } else {
            const catItem = catalog.find(c => c.id === key);
            if (catItem) {
              const itemCat = categories.find(c => c.id === catItem.type);
              const isProduct = catItem.type === 'PRODUCT' || itemCat?.type === 'PRODUCT';
              const isSub = catItem.name.toLowerCase().includes('assinatura') || 
                          catItem.name.toLowerCase().includes("van's") || 
                          itemCat?.type === 'SUBSCRIPTION';

              if (isSub) {
                subscriptionTotal_u += grossRev;
                if (!subscriptionBreakdown_u[key]) {
                  subscriptionBreakdown_u[key] = { name: catItem.name, amount: 0, grossRev: 0 };
                }
                subscriptionBreakdown_u[key].amount += amount;
                subscriptionBreakdown_u[key].grossRev += grossRev;
              } else if (isProduct) {
                productTotal_u += grossRev;
                if (!productItemBreakdown_u[key]) {
                  productItemBreakdown_u[key] = { name: catItem.name, amount: 0, grossRev: 0 };
                }
                productItemBreakdown_u[key].amount += amount;
                productItemBreakdown_u[key].grossRev += grossRev;
              } else {
                rawServiceTotal_u += grossRev;
                const itemType = catItem.type || 'SERVICE';
                if (!categoryRevBreakdown_u[itemType]) {
                  categoryRevBreakdown_u[itemType] = { amount: 0, grossRev: 0 };
                }
                categoryRevBreakdown_u[itemType].amount += amount;
                categoryRevBreakdown_u[itemType].grossRev += grossRev;
              }
            }
          }
        });
      });

      return {
        rawServiceTotal: rawServiceTotal_u,
        productTotal: productTotal_u,
        subscriptionTotal: subscriptionTotal_u,
        distinctClients: distinctClients_u,
        courtesyCount: courtesyCount_u,
        courtesyCommissionTotal: courtesyCommissionTotal_u,
        courtesyPriceEquivalent: courtesyPriceEquivalent_u,
        categoryRevBreakdown: categoryRevBreakdown_u,
        productItemBreakdown: productItemBreakdown_u,
        subscriptionBreakdown: subscriptionBreakdown_u
      };
    };

    if (selectedUnit === 'ALL') {
      let rawServiceTotal = 0;
      let productTotal = 0;
      let subscriptionTotal = 0;
      let distinctClients = 0;
      let courtesyCount = 0;
      let courtesyCommissionTotal = 0;
      let courtesyPriceEquivalent = 0;

      const categoryRevBreakdown: Record<string, { amount: number, grossRev: number }> = {};
      categories.forEach(cat => {
        categoryRevBreakdown[cat.id] = { amount: 0, grossRev: 0 };
      });

      const productItemBreakdown: Record<string, { name: string, amount: number, grossRev: number }> = {};
      const subscriptionBreakdown: Record<string, { name: string, amount: number, grossRev: number }> = {};
      catalog.forEach(item => {
        const isProduct = item.type === 'PRODUCT';
        const isSub = item.name.toLowerCase().includes('assinatura') || 
                    item.name.toLowerCase().includes("van's") || 
                    (item.type && categories.find(c => c.id === item.type)?.type === 'SUBSCRIPTION');
        
        if (isProduct) {
          productItemBreakdown[item.id] = { name: item.name, amount: 0, grossRev: 0 };
        }
        if (isSub) {
          subscriptionBreakdown[item.id] = { name: item.name, amount: 0, grossRev: 0 };
        }
      });

      systemUnits.forEach(unit => {
        const uStats = computeSingleUnitStats(unit.id);
        
        rawServiceTotal += uStats.rawServiceTotal;
        productTotal += uStats.productTotal;
        subscriptionTotal += uStats.subscriptionTotal;
        distinctClients += uStats.distinctClients;
        courtesyCount += uStats.courtesyCount;
        courtesyCommissionTotal += uStats.courtesyCommissionTotal;
        courtesyPriceEquivalent += uStats.courtesyPriceEquivalent;

        Object.entries(uStats.categoryRevBreakdown).forEach(([catId, val]) => {
          if (!categoryRevBreakdown[catId]) {
            categoryRevBreakdown[catId] = { amount: 0, grossRev: 0 };
          }
          categoryRevBreakdown[catId].amount += val.amount;
          categoryRevBreakdown[catId].grossRev += val.grossRev;
        });

        Object.entries(uStats.productItemBreakdown).forEach(([itemId, val]) => {
          if (!productItemBreakdown[itemId]) {
            productItemBreakdown[itemId] = { name: val.name, amount: 0, grossRev: 0 };
          }
          productItemBreakdown[itemId].amount += val.amount;
          productItemBreakdown[itemId].grossRev += val.grossRev;
        });

        Object.entries(uStats.subscriptionBreakdown).forEach(([itemId, val]) => {
          if (!subscriptionBreakdown[itemId]) {
            subscriptionBreakdown[itemId] = { name: val.name, amount: 0, grossRev: 0 };
          }
          subscriptionBreakdown[itemId].amount += val.amount;
          subscriptionBreakdown[itemId].grossRev += val.grossRev;
        });
      });

      const faturamentoBruto = calculateTotalRevenue(rawServiceTotal, subscriptionTotal, productTotal);
      const faturamentoTotal = applyCommercialDiscount(faturamentoBruto, courtesyCommissionTotal);
      const ticketMedio = distinctClients > 0 ? faturamentoTotal / distinctClients : 0;

      return {
        faturamentoBruto,
        faturamentoTotal,
        rawServiceTotal,
        productTotal,
        subscriptionTotal,
        distinctClients,
        courtesyCount,
        courtesyCommissionTotal,
        courtesyPriceEquivalent,
        categoryRevBreakdown,
        productItemBreakdown: Object.values(productItemBreakdown).filter(p => p.amount > 0 || p.grossRev > 0),
        subscriptionBreakdown: Object.values(subscriptionBreakdown).filter(s => s.amount > 0 || s.grossRev > 0),
        ticketMedio
      };
    } else {
      const uStats = computeSingleUnitStats(selectedUnit);
      const faturamentoBruto = calculateTotalRevenue(uStats.rawServiceTotal, uStats.subscriptionTotal, uStats.productTotal);
      const faturamentoTotal = applyCommercialDiscount(faturamentoBruto, uStats.courtesyCommissionTotal);
      const ticketMedio = uStats.distinctClients > 0 ? faturamentoTotal / uStats.distinctClients : 0;

      return {
        faturamentoBruto,
        faturamentoTotal,
        rawServiceTotal: uStats.rawServiceTotal,
        productTotal: uStats.productTotal,
        subscriptionTotal: uStats.subscriptionTotal,
        distinctClients: uStats.distinctClients,
        courtesyCount: uStats.courtesyCount,
        courtesyCommissionTotal: uStats.courtesyCommissionTotal,
        courtesyPriceEquivalent: uStats.courtesyPriceEquivalent,
        categoryRevBreakdown: uStats.categoryRevBreakdown,
        productItemBreakdown: Object.values(uStats.productItemBreakdown).filter(p => p.amount > 0 || p.grossRev > 0),
        subscriptionBreakdown: Object.values(uStats.subscriptionBreakdown).filter(s => s.amount > 0 || s.grossRev > 0),
        ticketMedio
      };
    }
  }, [entries, catalog, categories, docData, allUnitsDocData, selectedWeek, selectedUnit, systemUnits, currentMonthWeeks, selectedYear, selectedMonth, users]);

  // Handle addition of a new Category
  const handleAddNewCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setCatRegError(null);
    setCatRegSuccess(false);

    const trimmedName = newCatName.trim();
    if (!trimmedName) return;

    // Check pre-existing Name
    const exists = categories.some(
      c => c.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (exists) {
      setCatRegError('Esta categoria já está cadastrada.');
      return;
    }

    const newId = 'cat_' + Date.now();
    const updated = [...categories, { id: newId, name: trimmedName, type: newCatType }];

    try {
      updateCategories(updated);
      setCatRegSuccess(true);
      setNewCatName('');
      setTimeout(() => setCatRegSuccess(false), 4e3);
    } catch (err: any) {
      setCatRegError('Houve um erro de conexão ao salvar.');
    }
  };

  const handlePrevMonth = () => {
    let m = parseInt(selectedMonth) - 1;
    let y = selectedYear;
    if (m < 1) {
      m = 12;
      y--;
    }
    setSelectedMonth(String(m).padStart(2, '0'));
    setSelectedYear(y);
  };

  const handleNextMonth = () => {
    let m = parseInt(selectedMonth) + 1;
    let y = selectedYear;
    if (m > 12) {
      m = 1;
      y++;
    }
    setSelectedMonth(String(m).padStart(2, '0'));
    setSelectedYear(y);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* FILTER & PERIOD SELECTOR ACTION BAR */}
      <AppPageHeader
        eyebrow="Dados e análise"
        title="Relatórios financeiros"
        description="Faturamento por serviços, produtos e assinaturas, com visualização consolidada ou semanal."
        icon={<FileText className="h-5 w-5" />}
        actions={<div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:flex xl:w-auto xl:flex-wrap xl:items-center">
          {/* Monthly navigation */}
          <div className="flex h-[42px] w-full min-w-0 items-center justify-between overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800 xl:w-auto xl:min-w-[210px]">
            <button onClick={handlePrevMonth} className="px-3 h-full hover:bg-gray-100 dark:hover:bg-zinc-700 transition">
              <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-zinc-300" />
            </button>
            <div className="px-1 text-xs font-bold text-gray-800 dark:text-zinc-100 min-w-[125px] text-center select-none animate-pulse">
              {MONTH_NAMES[parseInt(selectedMonth) - 1]} / {selectedYear}
            </div>
            <button onClick={handleNextMonth} className="px-3 h-full hover:bg-gray-100 dark:hover:bg-zinc-700 transition">
              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-zinc-300" />
            </button>
          </div>

          {/* Unit selection */}
          <div className="relative w-full min-w-0 xl:w-auto xl:min-w-[150px]">
            <select 
              value={selectedUnit}
              onChange={(e) => {
                setSelectedUnit(e.target.value);
                setIsEditing(false); // turn off to load correctly
              }}
              className={`${appControlClass} w-full text-xs`}
            >
              <option value="ALL">Todas as Unidades</option>
              {systemUnits?.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Dynamic Edit Mode Toggle */}
          {selectedUnit !== 'ALL' && (
            <button
              onClick={() => {
                if (selectedWeek === 'ALL') {
                  alert('Por favor, selecione uma Semana específica abaixo antes de iniciar os lançamentos manuais.');
                  return;
                }
                if (isEditing) {
                  handleSaveManualValues();
                } else {
                  setIsEditing(true);
                }
              }}
              disabled={isSaving}
              className={`flex h-[42px] w-full items-center justify-center gap-2 rounded-xl px-4 text-xs font-extrabold shadow-sm transition cursor-pointer xl:w-auto ${
                isEditing 
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse" 
                  : "bg-orange-500 hover:bg-orange-600 text-white"
              }`}
            >
              {isEditing ? (
                <>
                  <Check className="w-4 h-4" />
                  {isSaving ? "Salvando..." : "Salvar Lançamentos"}
                </>
              ) : (
                <>
                  <Edit2 className="w-3.5 h-3.5" />
                  Preencher Manualmente
                </>
              )}
            </button>
          )}

          {isEditing && (
            <button
              onClick={() => {
                setIsEditing(false);
                const wk = selectedWeek === 'ALL' ? 'W1' : selectedWeek;
                const weekOver = docData?.weeks?.[wk] || {};
                setFormData(weekOver.items || {});
                setFormClientsServed(weekOver.clientsServed || 0);
                setFormCourtesy(weekOver.courtesyCommissionTotal || 0);
              }}
              className="flex h-[42px] w-full items-center justify-center gap-1 rounded-xl bg-gray-100 px-3 text-xs font-extrabold text-gray-700 transition hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 xl:w-auto"
            >
              <X className="w-4 h-4" /> Cancelar
            </button>
          )}

          {/* Export to PDF Button */}
          <button
            onClick={handleDownloadPDF}
            disabled={isGeneratingPdf || isEditing}
            className={`flex h-[42px] w-full items-center justify-center gap-2 rounded-xl border px-4 text-xs font-extrabold shadow-sm transition cursor-pointer xl:w-auto ${
              isGeneratingPdf 
                ? "bg-zinc-100 dark:bg-zinc-800 text-gray-400 border-zinc-200 dark:border-zinc-700" 
                : "bg-gray-800 hover:bg-gray-700 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-gray-900 dark:text-zinc-100 border-zinc-700 dark:border-zinc-600"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title="Exportar Relatório Atual em PDF"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" />
                <span>Gerando PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-orange-500" />
                <span>Exportar PDF</span>
              </>
            )}
          </button>
        </div>}
      />

      {/* Floating Save success Toast notification */}
      {saveSuccess && (
        <div className="bg-emerald-600 text-white p-3.5 rounded-xl shadow-lg font-bold text-xs flex items-center justify-center gap-2 max-w-md mx-auto animate-bounce">
          <Check className="w-4 h-4 text-gray-900 dark:text-zinc-100 shrink-0" />
          Lançamentos da {selectedWeek === 'ALL' ? 'Semana' : `Semana ${selectedWeek.split('W')[1]}`} atualizados com absoluto sucesso!
        </div>
      )}

      {/* COMPREHENSIVE WEEK SELECTOR */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-orange-500" />
          <span className="text-2xs uppercase tracking-wider font-extrabold text-gray-400 dark:text-zinc-500">Filtrar Relatório / Preenchimento Por Semana</span>
        </div>
        
        <div className="flex flex-wrap gap-2 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-1.5 rounded-2xl shadow-inner">
          <button
            onClick={() => {
              setSelectedWeek('ALL');
              setIsEditing(false);
            }}
            className={`flex-1 min-w-[130px] py-3 px-4 text-xs font-extrabold uppercase tracking-wider rounded-xl transition cursor-pointer ${
              selectedWeek === 'ALL'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-gray-900 dark:text-zinc-100 shadow-md'
                : 'text-gray-600 dark:text-zinc-400 hover:bg-gray-200/60 dark:hover:bg-zinc-800/60'
            }`}
          >
            Mês Integral (Consolidado)
          </button>
          {currentMonthWeeks.map(wk => (
            <button
              key={wk.id}
              onClick={() => {
                setSelectedWeek(wk.id);
                setIsEditing(false);
              }}
              className={`flex-1 min-w-[110px] py-3 px-4 text-xs font-extrabold uppercase tracking-wider rounded-xl transition cursor-pointer ${
                selectedWeek === wk.id
                  ? 'bg-gradient-to-r from-slate-850 to-[var(--theme-color)] text-gray-900 dark:text-zinc-100 shadow-md'
                  : 'text-gray-600 dark:text-zinc-400 hover:bg-gray-200/60 dark:hover:bg-zinc-800/60'
              }`}
            >
              Semana {wk.id.substring(1)} ({wk.label})
            </button>
          ))}
        </div>
      </div>

      {/* EDIT MODE COMPREHENSIVE HEADS-UP WARNING BANNER */}
      {isEditing && (
        <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200/40 dark:border-orange-900/40 rounded-2xl flex items-start gap-3 text-orange-900 dark:text-orange-400 animate-in slide-in-from-top duration-300">
          <Info className="w-5 h-5 shrink-0 text-orange-500 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold block text-orange-950 dark:text-orange-300 mb-0.5">Modo de Edição Ativo — {selectedWeek === 'ALL' ? 'Mês Inteiro' : `Semana ${selectedWeek.split('W')[1]}`}</span>
            Você está preenchendo os dados manuais da <span className="font-black underline">Semana {selectedWeek.split('W')[1]}</span>. Insira a quantidade, faturamento bruto das categorias, valor de <span className="font-black">Descontos e Cortesias</span> e quantidade de <span className="font-black">Clientes Distintos</span> nos campos abaixo. Não se esqueça de clicar em <b>"Salvar Lançamentos"</b> no topo para confirmar as alterações.
          </div>
        </div>
      )}

      {/* THE EXECUTIVE CHIC GRAPHIC BILLING REPORT LAYOUT */}
      <div 
        ref={reportRef}
        id="print-report"
        className="w-full max-w-none bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 p-6 md:p-8 rounded-3xl shadow-2xl border border-gray-200 dark:border-zinc-800 font-sans space-y-8 relative overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Floating Download Button inside report */}
        <div className="absolute top-6 right-6 flex gap-2" data-html2canvas-ignore="true">
          <button
            onClick={handleDownloadPDF}
            disabled={isGeneratingPdf || isEditing}
            className="p-2.5 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 active:bg-gray-300 dark:active:bg-zinc-600 text-gray-900/70 dark:text-zinc-100/70 hover:text-gray-900 dark:text-zinc-100 rounded-xl transition border border-gray-200 dark:border-zinc-800/50 flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Exportar como PDF"
          >
            {isGeneratingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
            ) : (
              <Download className="w-4 h-4 text-orange-500" />
            )}
          </button>
        </div>

        <div className="text-center space-y-1.5">
          <h1 className="text-2xl md:text-3xl font-extrabold uppercase tracking-wide text-gray-900 dark:text-zinc-100">
            RELATÓRIO DE FATURAMENTO
          </h1>
          <p className="text-2xs md:text-xs text-orange-600 dark:text-orange-400 font-black uppercase tracking-widest font-mono">
            Unidade {systemUnits.find(u => u.id === selectedUnit)?.name || 'Consolidado (Todas)'}
          </p>
          <div className="inline-block mt-1 px-3 py-1 bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-800/50 rounded-full text-3xs font-extrabold uppercase tracking-widest text-gray-900/80 dark:text-zinc-100/80">
            {selectedWeek === 'ALL' 
              ? `Mensal Inteiro` 
              : `Semana ${selectedWeek.substring(1)} (${
                  currentMonthWeeks.find(w => w.id === selectedWeek)?.label || ''
                } de ${MONTH_NAMES[parseInt(selectedMonth) - 1]})`
            }
          </div>
        </div>

        {/* 3 COLUMNS: SERVIÇOS | PRODUTOS E BEBIDAS | ASSINATURA */}
        <div className="report-pdf-columns grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
          
          {/* SERVIÇOS COLUMN */}
          <div className="space-y-4">
            <h2 className="text-2xs uppercase font-black tracking-widest border-b border-gray-200 dark:border-zinc-800/50 pb-2 text-center text-zinc-400">
              SERVIÇOS
            </h2>
            <div className="space-y-3 min-h-[160px] flex flex-col justify-between">
              <div className="space-y-2.5">
                {categories.filter(cat => {
                  const type = cat.type || (cat.id === 'PRODUCT' ? 'PRODUCT' : 'SERVICE');
                  return type === 'SERVICE' || cat.id === 'EXTRA_SERVICE';
                }).map(cat => {
                  const breakdown = stats.categoryRevBreakdown[cat.id] || { amount: 0, grossRev: 0 };
                  return (
                    <div key={cat.id} className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-gray-900/85 dark:text-zinc-100/85">{cat.name}</span>
                      <span className="font-black font-mono text-gray-900 dark:text-zinc-100">{formatCurrency(breakdown.grossRev)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-gray-200 dark:border-zinc-800/50 pt-3.5 flex justify-between items-center text-sm font-black text-orange-600 dark:text-orange-400 font-mono">
                <span>Subtotal</span>
                <span>{formatCurrency(stats.rawServiceTotal)}</span>
              </div>
            </div>
          </div>

          {/* PRODUTOS E BEBIDAS COLUMN */}
          <div className="space-y-4 md:border-l md:border-gray-200 dark:border-zinc-800/50 md:pl-6">
            <h2 className="text-2xs uppercase font-black tracking-widest border-b border-gray-200 dark:border-zinc-800/50 pb-2 text-center text-zinc-400">
              PRODUTOS E BEBIDAS
            </h2>
            <div className="space-y-3 min-h-[160px] flex flex-col justify-between">
              <div className="space-y-2.5">
                {stats.productItemBreakdown.map((itm, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-gray-900/85 dark:text-zinc-100/85 truncate max-w-[155px]" title={itm.name}>{itm.name}</span>
                    <span className="font-black font-mono text-gray-900 dark:text-zinc-100">{formatCurrency(itm.grossRev)}</span>
                  </div>
                ))}
                
                {/* Custom product categories */}
                {categories.filter(c => c.type === 'PRODUCT' && c.id !== 'PRODUCT').map(cat => {
                  const breakdown = stats.categoryRevBreakdown[cat.id] || { amount: 0, grossRev: 0 };
                  if (breakdown.grossRev <= 0) return null;
                  return (
                    <div key={cat.id} className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-gray-900/85 dark:text-zinc-100/85">{cat.name}</span>
                      <span className="font-black font-mono text-gray-900 dark:text-zinc-100">{formatCurrency(breakdown.grossRev)}</span>
                    </div>
                  );
                })}

                {stats.productItemBreakdown.length === 0 && (
                  <p className="text-[10px] uppercase font-bold text-center text-zinc-500 py-3">Não faturado</p>
                )}
              </div>
              <div className="border-t border-gray-200 dark:border-zinc-800/50 pt-3.5 flex justify-between items-center text-sm font-black text-orange-600 dark:text-orange-400 font-mono">
                <span>Subtotal</span>
                <span>{formatCurrency(stats.productTotal)}</span>
              </div>
            </div>
          </div>

          {/* ASSINATURA COLUMN */}
          <div className="space-y-4 md:border-l md:border-gray-200 dark:border-zinc-800/50 md:pl-6">
            <h2 className="text-2xs uppercase font-black tracking-widest border-b border-gray-200 dark:border-zinc-800/50 pb-2 text-center text-zinc-400">
              ASSINATURA
            </h2>
            <div className="space-y-3 min-h-[160px] flex flex-col justify-between">
              <div className="space-y-2.5">
                {stats.subscriptionBreakdown.map((sub, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-gray-900/85 dark:text-zinc-100/85 truncate max-w-[155px]" title={sub.name}>{sub.name}</span>
                    <span className="font-black font-mono text-gray-900 dark:text-zinc-100">{formatCurrency(sub.grossRev)}</span>
                  </div>
                ))}

                {/* Custom subscription categories */}
                {categories.filter(c => c.type === 'SUBSCRIPTION').map(cat => {
                  const breakdown = stats.categoryRevBreakdown[cat.id] || { amount: 0, grossRev: 0 };
                  if (breakdown.grossRev <= 0) return null;
                  return (
                    <div key={cat.id} className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-gray-900/85 dark:text-zinc-100/85">{cat.name}</span>
                      <span className="font-black font-mono text-gray-900 dark:text-zinc-100">{formatCurrency(breakdown.grossRev)}</span>
                    </div>
                  );
                })}

                {stats.subscriptionBreakdown.length === 0 && (
                  <p className="text-[10px] uppercase font-bold text-center text-zinc-500 py-3">Não faturado</p>
                )}
              </div>
              <div className="border-t border-gray-200 dark:border-zinc-800/50 pt-3.5 flex justify-between items-center text-sm font-black text-orange-600 dark:text-orange-400 font-mono">
                <span>Subtotal</span>
                <span>{formatCurrency(stats.subscriptionTotal)}</span>
              </div>
            </div>
          </div>

        </div>

        {/* BOTTOM METRICS BAR - GIVES LIVE EDIT SENSE */}
        <div className="report-pdf-metrics border-t border-gray-200 dark:border-zinc-800/50 pt-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="space-y-0.5">
            <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">DESCONTOS E CORTESIAS</span>
            {isEditing ? (
              <div className="flex justify-center items-center max-w-[140px] mx-auto mt-0.5">
                <input
                  type="number"
                  step="0.01"
                  value={formCourtesy === 0 ? '' : formCourtesy}
                  onChange={(e) => setFormCourtesy(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="Digitar valor"
                  className="w-full text-sm bg-gray-100 dark:bg-zinc-800 border border-red-400 rounded font-black text-gray-900 dark:text-zinc-100 p-1 text-center font-mono outline-none placeholder-zinc-500"
                />
              </div>
            ) : (
              <p className="text-lg font-black font-mono text-red-400">-{formatCurrency(stats.courtesyCommissionTotal)}</p>
            )}
          </div>
          <div className="space-y-0.5 border-t md:border-t-0 md:border-x border-gray-200 dark:border-zinc-800/50 py-3 md:py-0">
            <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">TICKET MÉDIO</span>
            <p className="text-lg font-black font-mono text-gray-900 dark:text-zinc-100">{formatCurrency(stats.ticketMedio)}</p>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">CLIENTES DISTINTOS</span>
            
            {isEditing ? (
              <div className="flex justify-center items-center max-w-[140px] mx-auto mt-0.5">
                <input
                  type="number"
                  value={formClientsServed === 0 ? '' : formClientsServed}
                  onChange={(e) => setFormClientsServed(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="Digitar valor"
                  className="w-full text-sm bg-gray-100 dark:bg-zinc-800 border border-[var(--theme-color)] rounded font-black text-gray-900 dark:text-zinc-100 p-1 text-center font-mono outline-none placeholder-zinc-500"
                />
              </div>
            ) : (
              <p className="text-lg font-black font-mono text-orange-600 dark:text-orange-400">{stats.distinctClients}</p>
            )}
            
          </div>
        </div>

        {/* FATURAMENTO TOTAL BOTTOM BANNER */}
        <div className="report-pdf-total bg-orange-500 text-white p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-2 text-center sm:text-left shadow-lg">
          <div>
            <span className="text-2xs uppercase font-extrabold tracking-widest text-orange-950/70 dark:text-orange-950/70">FATURAMENTO TOTAL</span>
            <p className="text-4xs text-zinc-100 opacity-90 tracking-wide">Faturamento bruto das 3 colunas deduzido das comissões de cortesias abatidas</p>
          </div>
          <div className="text-2xl md:text-3xl font-black font-mono tracking-tight text-white">
            {formatCurrency(stats.faturamentoTotal)}
          </div>
        </div>
      </div>

      {/* DETAILED CATEGORY/ITEM LAUNCH EDITORS */}
      {isEditing && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-6 rounded-2xl shadow-md space-y-6 animate-in slide-in-from-bottom duration-300">
          <div className="border-b border-gray-100 dark:border-zinc-800 pb-3">
            <h3 className="text-sm font-black uppercase text-gray-900 dark:text-zinc-100 tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-orange-500" />
              Lançamentos Complementares: Semana {selectedWeek.split('W')[1]}
            </h3>
            <p className="text-3xs text-gray-400 mt-0.5">
              Selecione e digite a quantidade correspondente e o faturamento bruto auferido de cada componente no período para furação exata de objetivos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* SERVICES PANEL OVERRIDES */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase text-orange-600 dark:text-orange-400 border-b pb-1">Serviços</h4>
              <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
                {categories.filter(cat => {
                  const type = cat.type || (cat.id === 'PRODUCT' ? 'PRODUCT' : 'SERVICE');
                  return type === 'SERVICE' || cat.id === 'EXTRA_SERVICE';
                }).map(cat => {
                  const val = formData[cat.id] || { amount: 0, grossRev: 0 };
                  return (
                    <div key={cat.id} className="p-2.5 bg-gray-50 dark:bg-zinc-800/60 rounded-xl space-y-2 border border-gray-100 dark:border-zinc-800">
                      <span className="block font-bold text-xs text-gray-800 dark:text-zinc-200">{cat.name}</span>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[9px] uppercase font-semibold text-gray-400 block mb-0.5">Qtd</label>
                          <input 
                            type="number"
                            value={val.amount === 0 ? '' : val.amount}
                            onChange={(e) => handleInputChange(cat.id, 'amount', parseInt(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 p-1.5 rounded font-black text-center text-gray-900 dark:text-zinc-100"
                          />
                        </div>
                        <div className="flex-[2_2_0%]">
                          <label className="text-[9px] uppercase font-semibold text-gray-400 block mb-0.5">Valor Bruto R$</label>
                          <input 
                            type="number"
                            step="0.01"
                            value={val.grossRev === 0 ? '' : val.grossRev}
                            onChange={(e) => handleInputChange(cat.id, 'grossRev', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="w-full text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 p-1.5 rounded font-black text-gray-900 dark:text-zinc-100"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PRODUCTS PANEL OVERRIDES */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase text-orange-600 dark:text-orange-400 border-b pb-1">Produtos e Bebidas</h4>
              <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
                {productCatalogItems.map(pItem => {
                  const val = formData[pItem.id] || { amount: 0, grossRev: 0 };
                  return (
                    <div key={pItem.id} className="p-2.5 bg-gray-50 dark:bg-zinc-800/60 rounded-xl space-y-2 border border-gray-100 dark:border-zinc-800">
                      <span className="block font-bold text-xs text-gray-800 dark:text-zinc-200 truncate" title={pItem.name}>{pItem.name}</span>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[9px] uppercase font-semibold text-gray-400 block mb-0.5">Qtd</label>
                          <input 
                            type="number"
                            value={val.amount === 0 ? '' : val.amount}
                            onChange={(e) => handleInputChange(pItem.id, 'amount', parseInt(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 p-1.5 rounded font-black text-center text-gray-900 dark:text-zinc-100"
                          />
                        </div>
                        <div className="flex-[2_2_0%]">
                          <label className="text-[9px] uppercase font-semibold text-gray-400 block mb-0.5">Valor Bruto R$</label>
                          <input 
                            type="number"
                            step="0.01"
                            value={val.grossRev === 0 ? '' : val.grossRev}
                            onChange={(e) => handleInputChange(pItem.id, 'grossRev', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="w-full text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 p-1.5 rounded font-black text-gray-900 dark:text-zinc-100"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Custom Product categories if they exist */}
                {categories.filter(c => c.type === 'PRODUCT' && c.id !== 'PRODUCT').map(pCat => {
                  const val = formData[pCat.id] || { amount: 0, grossRev: 0 };
                  return (
                    <div key={pCat.id} className="p-2.5 bg-gray-50 dark:bg-zinc-800/60 rounded-xl space-y-2 border border-gray-100 dark:border-zinc-800">
                      <span className="block font-bold text-xs text-gray-800 dark:text-zinc-200 truncate" title={pCat.name}>{pCat.name}</span>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[9px] uppercase font-semibold text-gray-400 block mb-0.5">Qtd</label>
                          <input 
                            type="number"
                            value={val.amount === 0 ? '' : val.amount}
                            onChange={(e) => handleInputChange(pCat.id, 'amount', parseInt(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 p-1.5 rounded font-black text-center text-gray-900 dark:text-zinc-100"
                          />
                        </div>
                        <div className="flex-[2_2_0%]">
                          <label className="text-[9px] uppercase font-semibold text-gray-400 block mb-0.5">Valor Bruto R$</label>
                          <input 
                            type="number"
                            step="0.01"
                            value={val.grossRev === 0 ? '' : val.grossRev}
                            onChange={(e) => handleInputChange(pCat.id, 'grossRev', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="w-full text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 p-1.5 rounded font-black text-gray-900 dark:text-zinc-100"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SUBSCRIPTIONS PANEL OVERRIDES */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase text-orange-600 dark:text-orange-400 border-b pb-1">Assinaturas</h4>
              <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
                {subscriptionCatalogItems.map(sItem => {
                  const val = formData[sItem.id] || { amount: 0, grossRev: 0 };
                  return (
                    <div key={sItem.id} className="p-2.5 bg-gray-50 dark:bg-zinc-800/60 rounded-xl space-y-2 border border-gray-100 dark:border-zinc-800">
                      <span className="block font-bold text-xs text-gray-800 dark:text-zinc-200 truncate" title={sItem.name}>{sItem.name}</span>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[9px] uppercase font-semibold text-gray-400 block mb-0.5">Qtd</label>
                          <input 
                            type="number"
                            value={val.amount === 0 ? '' : val.amount}
                            onChange={(e) => handleInputChange(sItem.id, 'amount', parseInt(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 p-1.5 rounded font-black text-center text-gray-900 dark:text-zinc-100"
                          />
                        </div>
                        <div className="flex-[2_2_0%]">
                          <label className="text-[9px] uppercase font-semibold text-gray-400 block mb-0.5">Valor Bruto R$</label>
                          <input 
                            type="number"
                            step="0.01"
                            value={val.grossRev === 0 ? '' : val.grossRev}
                            onChange={(e) => handleInputChange(sItem.id, 'grossRev', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="w-full text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 p-1.5 rounded font-black text-gray-900 dark:text-zinc-100"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Custom subscription categories */}
                {categories.filter(c => c.type === 'SUBSCRIPTION').map(sCat => {
                  const val = formData[sCat.id] || { amount: 0, grossRev: 0 };
                  return (
                    <div key={sCat.id} className="p-2.5 bg-gray-50 dark:bg-zinc-800/60 rounded-xl space-y-2 border border-gray-100 dark:border-zinc-800">
                      <span className="block font-bold text-xs text-gray-800 dark:text-zinc-200 truncate" title={sCat.name}>{sCat.name}</span>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[9px] uppercase font-semibold text-gray-400 block mb-0.5">Qtd</label>
                          <input 
                            type="number"
                            value={val.amount === 0 ? '' : val.amount}
                            onChange={(e) => handleInputChange(sCat.id, 'amount', parseInt(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 p-1.5 rounded font-black text-center text-gray-900 dark:text-zinc-100"
                          />
                        </div>
                        <div className="flex-[2_2_0%]">
                          <label className="text-[9px] uppercase font-semibold text-gray-400 block mb-0.5">Valor Bruto R$</label>
                          <input 
                            type="number"
                            step="0.01"
                            value={val.grossRev === 0 ? '' : val.grossRev}
                            onChange={(e) => handleInputChange(sCat.id, 'grossRev', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="w-full text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 p-1.5 rounded font-black text-gray-900 dark:text-zinc-100"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-zinc-850">
            <button
              onClick={handleSaveManualValues}
              className="px-5 py-2.5 text-xs font-black uppercase bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow transition tracking-wide cursor-pointer flex items-center gap-1"
            >
              <Check className="w-4 h-4" /> Salvar Lançamentos da Semana
            </button>
          </div>
        </div>
      )}

      {/* REGISTER NEW CATEGORIES FORM CARD PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-[#F9FBFC] dark:bg-zinc-900/10 p-5 rounded-2xl border border-dashed border-gray-200 dark:border-zinc-800 text-xs text-gray-500 dark:text-zinc-400 flex flex-col justify-center space-y-2">
          <h4 className="font-bold text-gray-800 dark:text-zinc-200 uppercase tracking-widest text-[10px] flex items-center gap-2">
            <Info className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            Como o faturamento consolidado é gerado?
          </h4>
          <p className="leading-relaxed">
            O faturamento bruto consolidado é a soma exata dos serviços, produtos e assinaturas cadastrados. O sistema cruza os lançamentos diários digitados por barbeiros e manicures (que são filtrados por semana baseados na data) com os seus lançamentos manuais semanais que você digita por aqui para complementar ou consolidar a receita.
          </p>
          <p className="leading-relaxed">
            Os objetivos e os cálculos mostram as comissões descontadas para cortesias, ticket médio e clientes distintos do período, adaptando-se instantaneamente na tela caso queira ver o faturamento de uma semana única ou do mês completo.
          </p>
        </div>

        {/* REGISTER NEW CATEGORIES CARD */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-5 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-black uppercase text-gray-900 dark:text-zinc-100 tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-orange-500" />
              Registrar Novas Categorias
            </h3>
            <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5">
              Crie novas classificações (ex: Manicure, Estética, Vendas) de serviços, produtos ou assinaturas e veja-as aparecerem imediatamente no faturamento correspondente.
            </p>
          </div>

          <form onSubmit={handleAddNewCategory} className="space-y-4 pt-1 font-sans">
            <div>
              <label className="block text-4xs uppercase tracking-wider font-extrabold text-gray-400 mb-1">Nome da Categoria</label>
              <input 
                type="text" 
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="ex: Manicure, Estética VIP"
                className="w-full text-xs bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 p-2.5 rounded-lg text-gray-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-orange-500/40 font-bold"
              />
            </div>

            <div>
              <label className="block text-4xs uppercase tracking-wider font-extrabold text-gray-400 mb-1">Tipo de Faturamento correspondente</label>
              <select
                value={newCatType}
                onChange={(e) => setNewCatType(e.target.value as any)}
                className="w-full text-xs bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 p-2.5 rounded-lg text-gray-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-orange-500/40 font-bold"
              >
                <option value="SERVICE">Serviço (Coluna 1)</option>
                <option value="PRODUCT">Produto / Bebida (Coluna 2)</option>
                <option value="SUBSCRIPTION">Assinatura / Planos (Coluna 3)</option>
              </select>
            </div>

            {catRegError && (
              <p className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">{catRegError}</p>
            )}

            {catRegSuccess && (
              <p className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 p-2 rounded flex items-center gap-1">
                ✓ Categoria cadastrada com absoluto sucesso!
              </p>
            )}

            <button 
              type="submit"
              disabled={!newCatName.trim()}
              className="w-full h-9 flex items-center justify-center gap-1.5 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-200 dark:disabled:bg-zinc-800 text-white font-extrabold rounded-lg text-xs tracking-wide transition shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Cadastrar Categoria
            </button>
          </form>
        </div>
      </div>

    </div>
  );
}

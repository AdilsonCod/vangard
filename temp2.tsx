const handleSave = async () => {
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
        const currentStat = monthlyBarberStats.find((s) => s.id === statId) || {
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

        await updateMonthlyBarberStats({
          ...currentStat,
          faturamentoAssinatura:
            (currentStat.faturamentoAssinatura || 0) + fatAssinatura,
        });

        const lastDay = new Date(
          parseInt(selectedYear),
          parseInt(selectedMonth),
          0,
        );
        const dateStr = `${selectedYear}-${selectedMonth}-${String(lastDay.getDate()).padStart(2, "0")}`;

        await addPayment({
          id: "pay_" + Date.now() + Math.random().toString(36).substring(2, 9),
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
              "pot_" + Date.now() + Math.random().toString(36).substring(2, 9),
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
    } else if (importType === "CATALOGO") {
      let currentCatalog = [...catalog];
      let currentCategories = [...categories];
      let updatedCategories = false;

      for (const item of parsedData) {
        if (!item.itemNome) continue;

        let catId = "";
        if (item.categoriaNome) {
          let cat = currentCategories.find(
            (c) => c.name.toLowerCase() === item.categoriaNome.toLowerCase(),
          );
          if (!cat) {
            catId =
              "cat_" + Date.now() + Math.random().toString(36).substring(2, 9);
            const newCat = {
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
            price: item.valorTotal || currentCatalog[existingItemIndex].price,
            type: catId || currentCatalog[existingItemIndex].type,
          };
        } else {
          currentCatalog.push({
            id:
              "item_" + Date.now() + Math.random().toString(36).substring(2, 9),
            name: item.itemNome,
            type: catId || "",
            price: item.valorTotal || 0,
            unit: "ALL",
            visibleToRoles: ["ADMIN", "MANAGER", "BARBER"],
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
          faturamentoTotal: current.faturamentoTotal + group.faturamentoTotal,
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
            unitId: users.find((u) => u.id === group.userId)?.unit || "VANGARD",
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

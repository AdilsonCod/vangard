  const [successMessage, setSuccessMessage] = useState('');
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFile(file);
    setParsedData([]);
      setDpoteReport(null);
    setDpoteReport(null);

    if (importType === 'DPOTE_PDF' && file.name.toLowerCase().endsWith('.pdf')) {
       parseDPotePDF(file).then(rep => {
          setDpoteReport(rep);
          // Auto-map barbers to users if names match
          const newMap = { ...manualUserMapping };
          rep.barbers.forEach(b => {
             const matchedUser = users.find(u => u.name.toLowerCase() === b.name.toLowerCase() || u.name.toLowerCase().includes(b.name.toLowerCase().split(' ')[0]));
             if (matchedUser) {
                newMap[b.name] = matchedUser.id;
             }
          });
          setManualUserMapping(newMap);
       }).catch(err => {
          console.error(err);
          alert('Erro ao ler PDF');
       });
       return;
    }
      setSuccessMessage('');
      setIsMappingColumns(false);
    }
  };
  

const fs = require('fs');
let content = fs.readFileSync('src/components/DataImporterView.tsx', 'utf8');

content = content.replace("    }\n      setSuccessMessage('');\n      setIsMappingColumns(false);\n    }\n  };", "      setSuccessMessage('');\n      setIsMappingColumns(false);\n  };");

fs.writeFileSync('src/components/DataImporterView.tsx', content);

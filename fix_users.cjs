const fs = require('fs');
let code = fs.readFileSync('src/components/UsersDashboard.tsx', 'utf8');

// add useEffect import if not there
if (!code.includes('useEffect')) {
  code = code.replace(/import React, { useState } from "react";/, 'import React, { useState, useEffect } from "react";');
}

code = code.replace(
  `  const resetForm = () => {`,
  `  useEffect(() => {\n    resetForm();\n  }, [subTab]);\n\n  const resetForm = () => {`
);

fs.writeFileSync('src/components/UsersDashboard.tsx', code);

const fs = require('fs');
let code = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

if (!code.includes('expandedMenus')) {
  // 1. Add state for expanded menus
  code = code.replace(
    'const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);',
    'const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);\n  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});'
  );

  // 2. Desktop Navigation Update
  code = code.replace(
    `                  onClick={() => {
                    if (item.subItems) {
                      setActiveTab(item.subItems[0].id);
                    } else {
                      setActiveTab(item.id);
                    }
                  }}`,
    `                  onClick={() => {
                    if (item.subItems) {
                      setExpandedMenus(prev => {
                        const isCurrentlyActive = item.subItems!.some((sub: any) => sub.id === activeTab);
                        const currentExpanded = prev[item.id] !== undefined ? prev[item.id] : isCurrentlyActive;
                        const nextExpanded = !currentExpanded;
                        
                        if (nextExpanded && !isCurrentlyActive) {
                          setActiveTab(item.subItems![0].id);
                        }
                        
                        return { ...prev, [item.id]: nextExpanded };
                      });
                    } else {
                      setActiveTab(item.id);
                    }
                  }}`
  );

  // 3. Desktop Render Update
  code = code.replace(
    `{item.subItems && isActive && !isSidebarCollapsed && (`,
    `{item.subItems && (expandedMenus[item.id] !== undefined ? expandedMenus[item.id] : isActive) && !isSidebarCollapsed && (`
  );
  
  code = code.replace(
    `<ChevronDown className={\`w-4 h-4 transition-transform \${isActive ? 'rotate-180 text-[var(--theme-color)]' : 'text-gray-400'}\`} />`,
    `<ChevronDown className={\`w-4 h-4 transition-transform \${(expandedMenus[item.id] !== undefined ? expandedMenus[item.id] : isActive) ? 'rotate-180 text-[var(--theme-color)]' : 'text-gray-400'}\`} />`
  );

  // 4. Mobile Navigation Update
  code = code.replace(
    `                        onClick={() => {
                          if (item.subItems) {
                            setActiveTab(item.subItems[0].id);
                          } else {
                            setActiveTab(item.id);
                            setIsMobileMenuOpen(false);
                          }
                        }}`,
    `                        onClick={() => {
                          if (item.subItems) {
                            setExpandedMenus(prev => {
                              const isCurrentlyActive = item.subItems!.some((sub: any) => sub.id === activeTab);
                              const currentExpanded = prev[item.id] !== undefined ? prev[item.id] : isCurrentlyActive;
                              const nextExpanded = !currentExpanded;
                              
                              if (nextExpanded && !isCurrentlyActive) {
                                setActiveTab(item.subItems![0].id);
                              }
                              
                              return { ...prev, [item.id]: nextExpanded };
                            });
                          } else {
                            setActiveTab(item.id);
                            setIsMobileMenuOpen(false);
                          }
                        }}`
  );

  // 5. Mobile Render Update
  code = code.replace(
    `{item.subItems && isActive && (`,
    `{item.subItems && (expandedMenus[item.id] !== undefined ? expandedMenus[item.id] : isActive) && (`
  );

  code = code.replace(
    `<ChevronDown className={\`w-5 h-5 transition-transform \${isActive ? 'rotate-180 text-[var(--theme-color)]' : 'text-gray-400'}\`} />`,
    `<ChevronDown className={\`w-5 h-5 transition-transform \${(expandedMenus[item.id] !== undefined ? expandedMenus[item.id] : isActive) ? 'rotate-180 text-[var(--theme-color)]' : 'text-gray-400'}\`} />`
  );

  fs.writeFileSync('src/components/AdminDashboard.tsx', code);
}

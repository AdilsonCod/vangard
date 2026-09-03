const fs = require('fs');

function updateDashboard(filename) {
    let content = fs.readFileSync(filename, 'utf8');
    
    // Add themeBg destructured variables if not present
    if (!content.includes('themeLightBg')) {
        content = content.replace(
            /const \{\s*currentUser,\s*logout,/g,
            `const { currentUser, logout, themeLightBg, themeDarkBg, `
        );
    }
    
    // Replace the hardcoded background wrapper
    content = content.replace(
        /className="h-\[100dvh\] overflow-hidden w-full bg-gray-50 dark:bg-zinc-950/g,
        'className={`h-[100dvh] overflow-hidden w-full ${themeLightBg || "bg-gray-50"} ${themeDarkBg || "dark:bg-zinc-950"}'
    );
    // Because we used string interpolation, let's make sure it closes correctly.
    // wait, the original was: className="h-[100dvh] overflow-hidden w-full bg-gray-50 dark:bg-zinc-950 text-gray-600 dark:text-zinc-300 flex transition-colors"
    content = content.replace(
        /className="h-\[100dvh\] overflow-hidden w-full bg-gray-50 dark:bg-zinc-950 text-gray-600 dark:text-zinc-300 flex transition-colors"/g,
        'className={`h-[100dvh] overflow-hidden w-full ${themeLightBg || "bg-gray-50"} ${themeDarkBg || "dark:bg-zinc-950"} text-gray-600 dark:text-zinc-300 flex transition-colors`}'
    );

    fs.writeFileSync(filename, content, 'utf8');
}

updateDashboard('src/components/AdminDashboard.tsx');
updateDashboard('src/components/BarberDashboard.tsx');

const fs = require('fs');
const content = fs.readFileSync('src/components/BarberDashboard.tsx', 'utf8');
const lines = content.split('\n');

const part1 = lines.slice(0, 146).join('\n'); // up to useMemo(() => {
const userNotif = `    return (notifications || []).filter(n => n.userId === currentUser!.id).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  }, [notifications, currentUser]);`;
const part2 = lines.slice(858).join('\n'); // 858 is 0-indexed, which is line 859

fs.writeFileSync('src/components/BarberDashboard.tsx', part1 + '\n' + userNotif + '\n' + part2, 'utf8');

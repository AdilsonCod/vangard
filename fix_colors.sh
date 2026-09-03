#!/bin/bash

# Fix backgrounds
sed -i 's/bg-\[#002222\]/bg-white dark:bg-zinc-900/g' src/components/*.tsx
sed -i 's/dark:bg-\[#002222\]/dark:bg-zinc-900/g' src/components/*.tsx

sed -i 's/bg-\[#1C0F0A\]/bg-white dark:bg-zinc-950/g' src/components/*.tsx
sed -i 's/dark:bg-\[#1C0F0A\]/dark:bg-zinc-950/g' src/components/*.tsx

sed -i 's/bg-\[#180D09\]/bg-white dark:bg-zinc-950/g' src/components/*.tsx
sed -i 's/dark:bg-\[#180D09\]/dark:bg-zinc-950/g' src/components/*.tsx

sed -i 's/bg-\[#1f100a\]/bg-white dark:bg-zinc-950/g' src/components/*.tsx
sed -i 's/dark:bg-\[#1f100a\]/dark:bg-zinc-950/g' src/components/*.tsx

sed -i 's/bg-\[#001414\]/bg-white dark:bg-zinc-950/g' src/components/*.tsx
sed -i 's/dark:bg-\[#001414\]/dark:bg-zinc-950/g' src/components/*.tsx

# Fix borders
sed -i 's/border-\[#311B12\]/border-gray-200 dark:border-zinc-800/g' src/components/*.tsx
sed -i 's/dark:border-\[#311B12\]/dark:border-zinc-800/g' src/components/*.tsx

# Fix random grey b5b5b5
sed -i 's/bg-\[#b5b5b5\]/bg-white/g' src/components/*.tsx
sed -i 's/dark:bg-\[#b5b5b5\]/dark:bg-zinc-900/g' src/components/*.tsx


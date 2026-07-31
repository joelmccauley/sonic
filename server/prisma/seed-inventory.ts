/**
 * Cozumel Inventory Seed
 * Sets trackInventory=true on common ingredients/items and creates InventoryItem records.
 * Run: npx tsx prisma/seed-inventory.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Items to track: [name-substring-to-match, quantity, unit, lowThreshold]
const TRACK_LIST: Array<{ match: string; qty: number; unit: string; low: number }> = [
  // Proteins
  { match: 'Chicken Fajita',     qty: 45,  unit: 'lbs',   low: 10 },
  { match: 'Carne Asada',        qty: 30,  unit: 'lbs',   low: 8  },
  { match: 'Carnitas',           qty: 25,  unit: 'lbs',   low: 8  },
  { match: 'Shrimp',             qty: 20,  unit: 'lbs',   low: 5  },
  { match: 'Ground Beef',        qty: 40,  unit: 'lbs',   low: 10 },
  { match: 'Steak',              qty: 30,  unit: 'lbs',   low: 8  },
  // Drinks
  { match: 'Margarita',          qty: 120, unit: 'units', low: 20 },
  { match: 'Beer',               qty: 200, unit: 'units', low: 24 },
  { match: 'Soda',               qty: 150, unit: 'units', low: 24 },
  // Ingredients / sides
  { match: 'Queso',              qty: 15,  unit: 'lbs',   low: 3  },
  { match: 'Guacamole',          qty: 12,  unit: 'lbs',   low: 3  },
  { match: 'Chips',              qty: 80,  unit: 'bags',  low: 15 },
  { match: 'Tortilla',           qty: 500, unit: 'units', low: 100},
  // Desserts
  { match: 'Sopapilla',          qty: 60,  unit: 'units', low: 12 },
  { match: 'Cheesecake',         qty: 18,  unit: 'slices',low: 4  },
  { match: 'Flan',               qty: 24,  unit: 'units', low: 6  },
];

async function main() {
  console.log('📦  Seeding Cozumel inventory...\n');

  // Clear existing inventory records so we don't duplicate
  await prisma.inventoryItem.deleteMany();
  console.log('🗑️  Cleared existing inventory items');

  const allItems = await prisma.menuItem.findMany({ where: { isActive: true } });
  console.log(`📋  Found ${allItems.length} active menu items`);

  let tracked = 0;
  const used = new Set<number>();

  for (const rule of TRACK_LIST) {
    const match = allItems.find(
      (i) => i.name.toLowerCase().includes(rule.match.toLowerCase()) && !used.has(i.id),
    );
    if (!match) {
      // Try a partial first-word match
      const fallback = allItems.find(
        (i) => i.name.toLowerCase().includes(rule.match.split(' ')[0].toLowerCase()) && !used.has(i.id),
      );
      if (!fallback) {
        console.log(`  ⚠️  No match for "${rule.match}" — skipping`);
        continue;
      }
      // Use fallback
      used.add(fallback.id);
      await prisma.menuItem.update({ where: { id: fallback.id }, data: { trackInventory: true } });
      await prisma.inventoryItem.create({
        data: { menuItemId: fallback.id, quantity: rule.qty, unit: rule.unit, lowThreshold: rule.low },
      });
      console.log(`  ✅  ${fallback.name}  →  ${rule.qty} ${rule.unit}  (low: ${rule.low})`);
      tracked++;
      continue;
    }

    used.add(match.id);
    await prisma.menuItem.update({ where: { id: match.id }, data: { trackInventory: true } });
    await prisma.inventoryItem.create({
      data: { menuItemId: match.id, quantity: rule.qty, unit: rule.unit, lowThreshold: rule.low },
    });
    console.log(`  ✅  ${match.name}  →  ${rule.qty} ${rule.unit}  (low: ${rule.low})`);
    tracked++;
  }

  // Add a few intentionally low/out items so the dashboard is interesting
  const remaining = allItems.filter((i) => !used.has(i.id)).slice(0, 3);
  for (const [idx, item] of remaining.entries()) {
    const qty = idx === 0 ? 0 : idx === 1 ? 2 : 5;
    const low = 5;
    await prisma.menuItem.update({ where: { id: item.id }, data: { trackInventory: true } });
    await prisma.inventoryItem.create({
      data: { menuItemId: item.id, quantity: qty, unit: 'units', lowThreshold: low },
    });
    console.log(`  ⚠️  ${item.name}  →  ${qty} units  (low: ${low})  ← intentionally low/out`);
    tracked++;
  }

  console.log(`\n✅  Done! Tracking ${tracked} inventory items.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

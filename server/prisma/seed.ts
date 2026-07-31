import { PrismaClient, Role, TableShape, OrderType, DiscountType, PrinterType, PlanTier, SubscriptionStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ORG_ID = 1;

async function main() {
  console.log('🌱 Seeding database...');

  // ── Demo Organization ────────────────────────────────────────────────
  await prisma.organization.upsert({
    where: { slug: 'sonicpos-restaurant' },
    update: {},
    create: {
      id: ORG_ID,
      name: 'SonicPOS Restaurant',
      slug: 'sonicpos-restaurant',
      email: 'admin@sonicpos.com',
      planTier: PlanTier.ENTERPRISE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
    },
  });

  // ── Settings ──────────────────────────────────────────────────────────────
  const settings = [
    { key: 'restaurant_name', value: 'SonicPOS Restaurant' },
    { key: 'address', value: '123 Main Street, City, ST 12345' },
    { key: 'phone', value: '(555) 123-4567' },
    { key: 'tax_rate', value: '0.0875' },
    { key: 'tip_suggestions', value: '15,18,20,25' },
    { key: 'receipt_footer', value: 'Thank you for dining with us!' },
    { key: 'currency', value: 'USD' },
    { key: 'timezone', value: 'America/Chicago' },
    { key: 'allow_split_checks', value: 'true' },
    { key: 'require_table_guests', value: 'false' },
    { key: 'auto_print_receipt', value: 'true' },
    { key: 'kitchen_display_timeout', value: '300' },
    { key: 'order_number_prefix', value: 'ORD' },
    { key: 'loyalty_points_per_dollar', value: '10' },
    { key: 'loyalty_points_per_reward', value: '1000' },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({
      where: { organizationId_key: { organizationId: ORG_ID, key: s.key } },
      update: {},
      create: { organizationId: ORG_ID, ...s },
    });
  }

  // ── Users ─────────────────────────────────────────────────────────────────
  const adminPin = await bcrypt.hash('1234', 12);
  const adminPass = await bcrypt.hash('admin123', 12);
  const managerPin = await bcrypt.hash('2580', 12);
  const serverPin = await bcrypt.hash('1111', 12);

  const owner = await prisma.user.upsert({
    where: { organizationId_username: { organizationId: ORG_ID, username: 'admin' } },
    update: {},
    create: {
      organizationId: ORG_ID,
      username: 'admin',
      email: 'admin@sonicpos.com',
      pin: adminPin,
      password: adminPass,
      firstName: 'System',
      lastName: 'Admin',
      role: Role.OWNER,
    },
  });

  const manager = await prisma.user.upsert({
    where: { organizationId_username: { organizationId: ORG_ID, username: 'manager' } },
    update: {},
    create: {
      organizationId: ORG_ID,
      username: 'manager',
      email: 'manager@sonicpos.com',
      pin: managerPin,
      password: await bcrypt.hash('manager123', 12),
      firstName: 'Jane',
      lastName: 'Smith',
      role: Role.MANAGER,
    },
  });

  await prisma.user.upsert({
    where: { organizationId_username: { organizationId: ORG_ID, username: 'server1' } },
    update: {},
    create: {
      organizationId: ORG_ID,
      username: 'server1',
      pin: serverPin,
      password: await bcrypt.hash('server123', 12),
      firstName: 'John',
      lastName: 'Doe',
      role: Role.SERVER,
    },
  });

  await prisma.user.upsert({
    where: { organizationId_username: { organizationId: ORG_ID, username: 'kitchen1' } },
    update: {},
    create: {
      organizationId: ORG_ID,
      username: 'kitchen1',
      pin: await bcrypt.hash('3333', 12),
      password: await bcrypt.hash('kitchen123', 12),
      firstName: 'Maria',
      lastName: 'Garcia',
      role: Role.KITCHEN,
    },
  });

  // ── Tables ────────────────────────────────────────────────────────────────
  const tableData = [
    // Main Dining
    { name: 'T1', capacity: 2, section: 'Main', posX: 50,  posY: 50,  width: 80,  height: 80,  shape: TableShape.SQUARE },
    { name: 'T2', capacity: 4, section: 'Main', posX: 200, posY: 50,  width: 120, height: 80,  shape: TableShape.RECTANGLE },
    { name: 'T3', capacity: 4, section: 'Main', posX: 380, posY: 50,  width: 120, height: 80,  shape: TableShape.RECTANGLE },
    { name: 'T4', capacity: 6, section: 'Main', posX: 50,  posY: 200, width: 160, height: 80,  shape: TableShape.RECTANGLE },
    { name: 'T5', capacity: 4, section: 'Main', posX: 280, posY: 200, width: 120, height: 80,  shape: TableShape.RECTANGLE },
    { name: 'T6', capacity: 2, section: 'Main', posX: 460, posY: 200, width: 80,  height: 80,  shape: TableShape.SQUARE },
    { name: 'T7', capacity: 8, section: 'Main', posX: 50,  posY: 350, width: 200, height: 80,  shape: TableShape.RECTANGLE },
    { name: 'T8', capacity: 4, section: 'Main', posX: 320, posY: 350, width: 120, height: 80,  shape: TableShape.RECTANGLE },
    // Patio
    { name: 'P1', capacity: 4, section: 'Patio', posX: 50,  posY: 50,  width: 100, height: 100, shape: TableShape.CIRCLE },
    { name: 'P2', capacity: 4, section: 'Patio', posX: 220, posY: 50,  width: 100, height: 100, shape: TableShape.CIRCLE },
    { name: 'P3', capacity: 6, section: 'Patio', posX: 390, posY: 50,  width: 120, height: 80,  shape: TableShape.RECTANGLE },
    // Bar
    { name: 'B1', capacity: 2, section: 'Bar', posX: 50,  posY: 50,  width: 80,  height: 60,  shape: TableShape.SQUARE },
    { name: 'B2', capacity: 2, section: 'Bar', posX: 180, posY: 50,  width: 80,  height: 60,  shape: TableShape.SQUARE },
    { name: 'B3', capacity: 2, section: 'Bar', posX: 310, posY: 50,  width: 80,  height: 60,  shape: TableShape.SQUARE },
  ];
  for (const t of tableData) {
    await prisma.table.upsert({
      where: { id: (await prisma.table.findFirst({ where: { name: t.name, section: t.section } }))?.id ?? 0 },
      update: {},
      create: { ...t, organizationId: ORG_ID } as any,
    });
  }

  // ── Menu Categories ───────────────────────────────────────────────────────
  const catDefs = [
    { name: 'Appetizers',    color: '#f44336', icon: '🥗', sortOrder: 1 },
    { name: 'Soups & Salads',color: '#4caf50', icon: '🥣', sortOrder: 2 },
    { name: 'Burgers',       color: '#ff9800', icon: '🍔', sortOrder: 3 },
    { name: 'Entrees',       color: '#9c27b0', icon: '🍽️', sortOrder: 4 },
    { name: 'Sides',         color: '#009688', icon: '🍟', sortOrder: 5 },
    { name: 'Desserts',      color: '#e91e63', icon: '🍰', sortOrder: 6 },
    { name: 'Non-Alcoholic', color: '#00bcd4', icon: '🥤', sortOrder: 7 },
    { name: 'Beer',          color: '#ffc107', icon: '🍺', sortOrder: 8 },
    { name: 'Wine',          color: '#673ab7', icon: '🍷', sortOrder: 9 },
    { name: 'Cocktails',     color: '#ff5722', icon: '🍹', sortOrder: 10 },
  ];
  const cats: { id: number }[] = [];
  for (const def of catDefs) {
    const existing = await prisma.menuCategory.findFirst({ where: { name: def.name } });
    if (existing) {
      cats.push(existing);
    } else {
      cats.push(await prisma.menuCategory.create({ data: { ...def, organizationId: ORG_ID } }));
    }
  }
  // Map by name for easy lookup
  const catMap = Object.fromEntries(catDefs.map((d, i) => [d.name, cats[i].id]));

  // ── Modifier Groups ───────────────────────────────────────────────────────
  const findOrCreateGroup = async (name: string, data: object) => {
    const existing = await prisma.modifierGroup.findFirst({ where: { name } });
    return existing ?? await prisma.modifierGroup.create({ data: { name, organizationId: ORG_ID, ...data } as any });
  };
  const tempGroup    = await findOrCreateGroup('Temperature', { required: true,  multiSelect: false, minSelect: 1, maxSelect: 1 });
  const bunGroup     = await findOrCreateGroup('Bun Type',    { required: false, multiSelect: false, minSelect: 0, maxSelect: 1 });
  const toppingsGroup= await findOrCreateGroup('Toppings',    { required: false, multiSelect: true,  minSelect: 0, maxSelect: 8 });
  const proteinGroup = await findOrCreateGroup('Add Protein', { required: false, multiSelect: true,  minSelect: 0, maxSelect: 3 });
  const drinkSizeGroup=await findOrCreateGroup('Size',        { required: true,  multiSelect: false, minSelect: 1, maxSelect: 1 });
  const sauceGroup   = await findOrCreateGroup('Sauce',       { required: false, multiSelect: true,  minSelect: 0, maxSelect: 3 });

  // Modifiers for Temperature
  const findOrCreateMod = async (name: string, price: number, groupId: number) => {
    const existing = await prisma.modifier.findFirst({ where: { name, groupId } });
    return existing ?? await prisma.modifier.create({ data: { name, price, groupId } });
  };
  await findOrCreateMod('Rare', 0, tempGroup.id);
  await findOrCreateMod('Medium Rare', 0, tempGroup.id);
  await findOrCreateMod('Medium', 0, tempGroup.id);
  await findOrCreateMod('Medium Well', 0, tempGroup.id);
  await findOrCreateMod('Well Done', 0, tempGroup.id);

  // Modifiers for Bun
  await findOrCreateMod('Brioche Bun', 0, bunGroup.id);
  await findOrCreateMod('Wheat Bun', 0, bunGroup.id);
  await findOrCreateMod('Lettuce Wrap (GF)', 0, bunGroup.id);
  await findOrCreateMod('No Bun', 0, bunGroup.id);

  // Modifiers for Toppings
  const toppingDefs = [
    ['Lettuce', 0], ['Tomato', 0], ['Onion', 0], ['Pickles', 0], ['Jalapeños', 0],
    ['Avocado', 1.5], ['Bacon', 2.0], ['Fried Egg', 1.5], ['Mushrooms', 1.0], ['Grilled Onions', 0.75],
  ];
  for (const [name, price] of toppingDefs) await findOrCreateMod(String(name), Number(price), toppingsGroup.id);

  // Modifiers for Protein
  await findOrCreateMod('Add Chicken', 3.5, proteinGroup.id);
  await findOrCreateMod('Add Shrimp', 4.5, proteinGroup.id);
  await findOrCreateMod('Add Steak', 5.5, proteinGroup.id);

  // Modifiers for Drink Size
  await findOrCreateMod('Small', 0, drinkSizeGroup.id);
  await findOrCreateMod('Medium', 0.5, drinkSizeGroup.id);
  await findOrCreateMod('Large', 1.0, drinkSizeGroup.id);

  // Sauces
  await findOrCreateMod('Ranch', 0, sauceGroup.id);
  await findOrCreateMod('BBQ', 0, sauceGroup.id);
  await findOrCreateMod('Honey Mustard', 0, sauceGroup.id);
  await findOrCreateMod('Buffalo', 0, sauceGroup.id);
  await findOrCreateMod('Garlic Aioli', 0.5, sauceGroup.id);

  // ── Menu Items ────────────────────────────────────────────────────────────
  const menuItemsData = [
    // Appetizers
    { name: 'Loaded Nachos', description: 'Tortilla chips, cheese, jalapeños, sour cream, pico', price: 13.99, categoryId: catMap['Appetizers'], isPopular: true },
    { name: 'Chicken Wings', description: '8 wings with choice of sauce', price: 14.99, categoryId: catMap['Appetizers'], isPopular: true },
    { name: 'Mozzarella Sticks', description: '6 golden fried mozzarella sticks, marinara', price: 9.99, categoryId: catMap['Appetizers'] },
    { name: 'Spinach Artichoke Dip', description: 'Creamy dip with toasted bread', price: 11.99, categoryId: catMap['Appetizers'] },
    { name: 'Onion Rings', description: 'Beer-battered onion rings', price: 8.99, categoryId: catMap['Appetizers'] },
    // Soups & Salads
    { name: 'Caesar Salad', description: 'Romaine, parmesan, croutons, caesar dressing', price: 10.99, categoryId: catMap['Soups & Salads'] },
    { name: 'House Salad', description: 'Mixed greens, tomato, cucumber, choice of dressing', price: 8.99, categoryId: catMap['Soups & Salads'] },
    { name: 'French Onion Soup', description: 'Classic with gruyere crouton', price: 7.99, categoryId: catMap['Soups & Salads'] },
    { name: 'Clam Chowder', description: 'New England style, served in bread bowl', price: 9.99, categoryId: catMap['Soups & Salads'] },
    // Burgers
    { name: 'Classic Smash Burger', description: '6oz smash patty, american cheese, lettuce, tomato, special sauce', price: 14.99, categoryId: catMap['Burgers'], isPopular: true, calories: 780 },
    { name: 'Double Smash Burger', description: 'Double 6oz smash patties, double cheese', price: 18.99, categoryId: catMap['Burgers'], isPopular: true, calories: 1120 },
    { name: 'BBQ Bacon Burger', description: 'Smash patty, bacon, cheddar, onion rings, BBQ sauce', price: 16.99, categoryId: catMap['Burgers'] },
    { name: 'Mushroom Swiss Burger', description: 'Smash patty, swiss, sautéed mushrooms, truffle aioli', price: 16.99, categoryId: catMap['Burgers'] },
    { name: 'Veggie Burger', description: 'House-made black bean patty, avocado, lettuce, tomato', price: 14.99, categoryId: catMap['Burgers'] },
    // Entrees
    { name: 'Grilled Salmon', description: '8oz Atlantic salmon, lemon butter, seasonal vegetables', price: 26.99, categoryId: catMap['Entrees'] },
    { name: 'NY Strip Steak', description: '14oz NY Strip, compound butter, mashed potatoes, asparagus', price: 39.99, categoryId: catMap['Entrees'], isPopular: true },
    { name: 'Chicken Parmesan', description: 'Breaded chicken breast, marinara, mozzarella, pasta', price: 22.99, categoryId: catMap['Entrees'] },
    { name: 'Fish & Chips', description: 'Beer-battered cod, fries, coleslaw, tartar sauce', price: 18.99, categoryId: catMap['Entrees'] },
    { name: 'Pasta Carbonara', description: 'Spaghetti, pancetta, egg, parmesan, black pepper', price: 19.99, categoryId: catMap['Entrees'] },
    // Sides
    { name: 'French Fries', description: 'Crispy seasoned fries', price: 4.99, categoryId: catMap['Sides'] },
    { name: 'Sweet Potato Fries', description: 'With chipotle dipping sauce', price: 5.99, categoryId: catMap['Sides'] },
    { name: 'Onion Rings (Side)', description: 'Beer-battered', price: 5.99, categoryId: catMap['Sides'] },
    { name: 'Coleslaw', description: 'House-made creamy coleslaw', price: 3.99, categoryId: catMap['Sides'] },
    { name: 'Mac & Cheese', description: 'House-made creamy mac', price: 5.99, categoryId: catMap['Sides'] },
    // Desserts
    { name: 'Chocolate Lava Cake', description: 'Warm chocolate cake, vanilla ice cream', price: 8.99, categoryId: catMap['Desserts'] },
    { name: 'New York Cheesecake', description: 'Classic NY style with berry compote', price: 7.99, categoryId: catMap['Desserts'] },
    { name: 'Brownie Sundae', description: 'Warm brownie, vanilla ice cream, hot fudge, whipped cream', price: 8.99, categoryId: catMap['Desserts'] },
    // Non-Alcoholic
    { name: 'Fountain Drink', description: 'Coke, Diet Coke, Sprite, Lemonade', price: 3.49, categoryId: catMap['Non-Alcoholic'], isTaxable: false },
    { name: 'Iced Tea', description: 'Sweet or Unsweet', price: 3.49, categoryId: catMap['Non-Alcoholic'], isTaxable: false },
    { name: 'Lemonade', description: 'Fresh-squeezed house lemonade', price: 4.49, categoryId: catMap['Non-Alcoholic'], isTaxable: false },
    { name: 'Coffee', description: 'Drip or cold brew', price: 3.99, categoryId: catMap['Non-Alcoholic'], isTaxable: false },
    { name: 'Bottled Water', description: 'Still or sparkling', price: 2.99, categoryId: catMap['Non-Alcoholic'], isTaxable: false },
    // Beer
    { name: 'Domestic Beer', description: 'Bud Light, Miller Lite, Coors Light', price: 5.50, categoryId: catMap['Beer'] },
    { name: 'Craft Beer', description: 'Ask your server for daily selection', price: 7.50, categoryId: catMap['Beer'] },
    { name: 'Import Beer', description: 'Corona, Modelo, Heineken, Stella', price: 6.50, categoryId: catMap['Beer'] },
    // Wine
    { name: 'House Wine (Glass)', description: 'Red or White', price: 9.00, categoryId: catMap['Wine'] },
    { name: 'Cabernet Sauvignon', description: 'Full-bodied red, 6oz pour', price: 12.00, categoryId: catMap['Wine'] },
    { name: 'Chardonnay', description: 'Oaked, 6oz pour', price: 11.00, categoryId: catMap['Wine'] },
    // Cocktails
    { name: 'Margarita', description: 'Tequila, triple sec, lime juice, salt rim', price: 11.99, categoryId: catMap['Cocktails'], isPopular: true },
    { name: 'Old Fashioned', description: 'Bourbon, bitters, sugar, orange peel', price: 13.99, categoryId: catMap['Cocktails'] },
    { name: 'Moscow Mule', description: 'Vodka, ginger beer, lime, served in copper mug', price: 12.99, categoryId: catMap['Cocktails'] },
    { name: 'Long Island Iced Tea', description: 'Vodka, gin, rum, tequila, triple sec, cola', price: 14.99, categoryId: catMap['Cocktails'] },
  ];

  for (let i = 0; i < menuItemsData.length; i++) {
    const item = menuItemsData[i];
    const existing = await prisma.menuItem.findFirst({ where: { name: item.name } });
    const created = existing ?? await prisma.menuItem.create({
      data: { ...item, sortOrder: i, organizationId: ORG_ID } as any,
    });

    // Connect modifier groups to burgers
    if (item.categoryId === 3) {
      await prisma.modifierGroupOnItem.upsert({
        where: { menuItemId_modifierGroupId: { menuItemId: created.id, modifierGroupId: tempGroup.id } },
        update: {},
        create: { menuItemId: created.id, modifierGroupId: tempGroup.id, sortOrder: 0 },
      });
      await prisma.modifierGroupOnItem.upsert({
        where: { menuItemId_modifierGroupId: { menuItemId: created.id, modifierGroupId: bunGroup.id } },
        update: {},
        create: { menuItemId: created.id, modifierGroupId: bunGroup.id, sortOrder: 1 },
      });
      await prisma.modifierGroupOnItem.upsert({
        where: { menuItemId_modifierGroupId: { menuItemId: created.id, modifierGroupId: toppingsGroup.id } },
        update: {},
        create: { menuItemId: created.id, modifierGroupId: toppingsGroup.id, sortOrder: 2 },
      });
    }
    // Connect sauce to appetizers (wings)
    if (item.name === 'Chicken Wings') {
      await prisma.modifierGroupOnItem.upsert({
        where: { menuItemId_modifierGroupId: { menuItemId: created.id, modifierGroupId: sauceGroup.id } },
        update: {},
        create: { menuItemId: created.id, modifierGroupId: sauceGroup.id, sortOrder: 0 },
      });
    }
    // Drink size for non-alcoholic
    if (item.categoryId === 7) {
      await prisma.modifierGroupOnItem.upsert({
        where: { menuItemId_modifierGroupId: { menuItemId: created.id, modifierGroupId: drinkSizeGroup.id } },
        update: {},
        create: { menuItemId: created.id, modifierGroupId: drinkSizeGroup.id, sortOrder: 0 },
      });
    }
    // Protein add-on for salads
    if (item.categoryId === 2 && item.name.includes('Salad')) {
      await prisma.modifierGroupOnItem.upsert({
        where: { menuItemId_modifierGroupId: { menuItemId: created.id, modifierGroupId: proteinGroup.id } },
        update: {},
        create: { menuItemId: created.id, modifierGroupId: proteinGroup.id, sortOrder: 0 },
      });
    }
  }

  // ── Discounts ─────────────────────────────────────────────────────────────
  const discountDefs = [
    { name: 'Employee Meal',   type: DiscountType.PERCENTAGE, value: 50,  requiresPin: true,  description: '50% off for employees' },
    { name: 'Manager Comp',    type: DiscountType.COMP,       value: 100, requiresPin: true,  description: '100% comp requires manager PIN' },
    { name: 'Happy Hour 20%',  type: DiscountType.PERCENTAGE, value: 20,  description: 'Happy hour discount on drinks' },
    { name: '$5 Off',          type: DiscountType.FLAT,       value: 5,   description: 'Flat $5 discount', minOrder: 25 },
    { name: 'Senior Discount', type: DiscountType.PERCENTAGE, value: 10,  description: '10% senior discount' },
  ];
  for (const d of discountDefs) {
    const existing = await prisma.discount.findFirst({ where: { name: d.name } });
    if (!existing) await prisma.discount.create({ data: { ...d, organizationId: ORG_ID } as any });
  }

  // ── Printers ──────────────────────────────────────────────────────────────
  const printerDefs = [
    { name: 'Front Receipt Printer', type: PrinterType.RECEIPT, ipAddress: '192.168.1.100', port: 9100, isDefault: true },
    { name: 'Kitchen Printer',       type: PrinterType.KITCHEN, ipAddress: '192.168.1.101', port: 9100 },
    { name: 'Bar Printer',           type: PrinterType.BAR,     ipAddress: '192.168.1.102', port: 9100 },
  ];
  for (const p of printerDefs) {
    const existing = await prisma.printer.findFirst({ where: { name: p.name } });
    if (!existing) await prisma.printer.create({ data: { ...p, organizationId: ORG_ID } as any });
  }

  console.log('✅ Seed complete!');
  console.log('👤 Admin login: username=admin, PIN=1234, password=admin123');
  console.log('👤 Manager login: username=manager, PIN=2580');
  console.log('👤 Server login: username=server1, PIN=1111');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

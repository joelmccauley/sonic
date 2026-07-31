/**
 * Cozumel Mexican Restaurant & Cantina — Menu Seed
 * Clears all existing menu categories + items, then loads Cozumel's full menu.
 * Run: npx ts-node prisma/seed-cozumel-menu.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌮 Loading Cozumel menu...');

  // ── Wipe existing menu (cascade via relations) ─────────────────────────────
  await prisma.modifierGroupOnItem.deleteMany();
  await prisma.orderItem.deleteMany();          // clears order-item refs too
  await prisma.menuItem.deleteMany();
  await prisma.menuCategory.deleteMany();
  console.log('🗑️  Cleared existing menu');

  // ── Categories ─────────────────────────────────────────────────────────────
  const catDefs = [
    { name: 'Appetizers',          color: '#f44336', icon: '🌮', sortOrder: 1 },
    { name: 'Enchiladas',          color: '#e91e63', icon: '🫔', sortOrder: 2 },
    { name: 'Fajitas',             color: '#ff5722', icon: '🔥', sortOrder: 3 },
    { name: 'Burritos',            color: '#ff9800', icon: '🌯', sortOrder: 4 },
    { name: 'Chicken',             color: '#ffc107', icon: '🍗', sortOrder: 5 },
    { name: 'Steak & Pork',        color: '#795548', icon: '🥩', sortOrder: 6 },
    { name: 'Seafood',             color: '#03a9f4', icon: '🦐', sortOrder: 7 },
    { name: 'Vegetarian',          color: '#4caf50', icon: '🥗', sortOrder: 8 },
    { name: 'Combination Dinners', color: '#9c27b0', icon: '🍽️', sortOrder: 9 },
    { name: 'A La Carte',          color: '#607d8b', icon: '📋', sortOrder: 10 },
    { name: 'American',            color: '#3f51b5', icon: '🍔', sortOrder: 11 },
    { name: 'Kids Menu',           color: '#00bcd4', icon: '👦', sortOrder: 12 },
    { name: 'Desserts',            color: '#e91e63', icon: '🍰', sortOrder: 13 },
    { name: 'Drinks',              color: '#009688', icon: '🥤', sortOrder: 14 },
  ];

  const cats: Record<string, number> = {};
  for (const def of catDefs) {
    const cat = await prisma.menuCategory.create({ data: def });
    cats[def.name] = cat.id;
  }
  console.log('✅ Categories created');

  // ── Modifier groups (protein choice, salsa type) ───────────────────────────
  const findOrCreateGroup = async (name: string, data: object) => {
    const ex = await prisma.modifierGroup.findFirst({ where: { name } });
    return ex ?? await prisma.modifierGroup.create({ data: { name, ...data } as any });
  };
  const findOrCreateMod = async (name: string, price: number, groupId: number) => {
    const ex = await prisma.modifier.findFirst({ where: { name, groupId } });
    return ex ?? await prisma.modifier.create({ data: { name, price, groupId } });
  };

  const proteinGroup  = await findOrCreateGroup('Protein Choice',   { required: true,  multiSelect: false, minSelect: 1, maxSelect: 1 });
  const salsaGroup    = await findOrCreateGroup('Salsa / Sauce',    { required: false, multiSelect: true,  minSelect: 0, maxSelect: 3 });
  const sidesGroup    = await findOrCreateGroup('Sides',            { required: false, multiSelect: true,  minSelect: 0, maxSelect: 2 });

  // Protein options
  await findOrCreateMod('Chicken',      0,    proteinGroup.id);
  await findOrCreateMod('Ground Beef',  0,    proteinGroup.id);
  await findOrCreateMod('Shredded Beef',0,    proteinGroup.id);
  await findOrCreateMod('Steak',        2.00, proteinGroup.id);
  await findOrCreateMod('Shrimp',       3.00, proteinGroup.id);
  await findOrCreateMod('Pork',         0,    proteinGroup.id);
  await findOrCreateMod('Beans Only',   0,    proteinGroup.id);
  await findOrCreateMod('Cheese Only',  0,    proteinGroup.id);

  // Salsa / sauce options
  await findOrCreateMod('Red Sauce',            0, salsaGroup.id);
  await findOrCreateMod('Green Tomatillo Sauce',0, salsaGroup.id);
  await findOrCreateMod('White Cheese Sauce',   1.50, salsaGroup.id);
  await findOrCreateMod('Ranchero Sauce',       0, salsaGroup.id);
  await findOrCreateMod('Mole Sauce',           0, salsaGroup.id);

  // Sides
  await findOrCreateMod('Rice',         0, sidesGroup.id);
  await findOrCreateMod('Beans',        0, sidesGroup.id);
  await findOrCreateMod('Guacamole',    0, sidesGroup.id);
  await findOrCreateMod('Sour Cream',   0, sidesGroup.id);

  // ── Menu Items ─────────────────────────────────────────────────────────────
  type Item = {
    name: string; description?: string; price: number; catName: string;
    isPopular?: boolean; calories?: number; isTaxable?: boolean;
    addProteinGroup?: boolean; addSalsaGroup?: boolean; addSidesGroup?: boolean;
  };

  const items: Item[] = [
    // ── Appetizers ──
    { name: 'Chips & Salsa',               description: 'One free refill of chips & salsa per table',                                                          price: 3.50,  catName: 'Appetizers', isPopular: true },
    { name: 'Cheese Dip',                  description: 'Creamy white cheese dip, served warm',                                                                price: 3.99,  catName: 'Appetizers' },
    { name: 'Bean Dip',                    description: 'Seasoned refried bean dip',                                                                            price: 4.25,  catName: 'Appetizers' },
    { name: 'Beef & Queso Dip',            description: 'Ground beef and queso dip',                                                                            price: 4.99,  catName: 'Appetizers' },
    { name: 'Guacamole Dip',               description: 'Fresh house-made guacamole',                                                                           price: 3.99,  catName: 'Appetizers' },
    { name: 'Queso Fundido & Chorizo',     description: 'Melted cheese topped with Mexican sausage, served with tortillas',                                     price: 5.99,  catName: 'Appetizers' },
    { name: 'Chori-Nachos',               description: 'Nachos topped with grilled chicken, Mexican chorizo and cheese sauce',                                 price: 8.99,  catName: 'Appetizers' },
    { name: 'Bowl of Chili',               description: 'Hearty chili bowl',                                                                                    price: 4.99,  catName: 'Appetizers' },
    { name: 'Bowl of Tortilla Soup',       description: 'House tortilla soup',                                                                                  price: 5.99,  catName: 'Appetizers' },
    { name: 'Beef or Chicken Nachos',      description: 'Nachos topped with beef or chicken and cheese',                                                        price: 5.99,  catName: 'Appetizers', addProteinGroup: true },
    { name: 'Cheese Nachos',               description: 'Tortilla chips topped with melted cheese',                                                             price: 4.50,  catName: 'Appetizers' },
    { name: 'Quesadilla Especial',         description: 'Flour tortilla stuffed with cheese and choice of shredded chicken or beef, sour cream and tomatoes',   price: 6.99,  catName: 'Appetizers', addProteinGroup: true },
    { name: 'Nachos Cozumel',              description: 'Loaded nachos with ground beef, shredded chicken, beans, cheese, lettuce, sour cream and tomatoes',   price: 7.99,  catName: 'Appetizers', isPopular: true },

    // ── Enchiladas ──
    { name: 'Enchiladas Paisanas',         description: 'Five flour tortillas rolled with grilled chicken or steak. Topped with cheese sauce, lettuce, sour cream and tomatoes',                                                              price: 12.99, catName: 'Enchiladas', isPopular: true },
    { name: 'Enchiladas Nortenas',         description: 'Five flour tortillas rolled with crab meat and shrimp, topped with cheese sauce, lettuce, sour cream and tomatoes',                                                                price: 12.99, catName: 'Enchiladas' },
    { name: 'Enchiladas Morelianas',       description: 'Five flour tortillas: two beef, two shredded chicken, one seafood, topped with cheese sauce, lettuce, sour cream and tomatoes',                                                    price: 11.99, catName: 'Enchiladas' },
    { name: 'Enchiladas Rojas',            description: 'Three corn tortillas rolled with chicken or ground beef, topped with red sauce. Served with lettuce, sour cream and tomatoes',                                                     price: 8.99,  catName: 'Enchiladas', addProteinGroup: true },
    { name: 'Enchiladas Suizas',           description: 'Four corn tortillas: two ground beef and two chicken, topped with green tomatillo sauce, cheese, lettuce, sour cream and tomatoes',                                                price: 9.99,  catName: 'Enchiladas' },
    { name: 'Enchiladas Supremas',         description: 'One ground beef, one chicken, one cheese and one bean enchilada. Topped with red sauce, cheese, lettuce, tomatoes and sour cream',                                                price: 9.99,  catName: 'Enchiladas', isPopular: true },
    { name: 'Enchiladas Jalisco',          description: 'Two flour tortillas rolled with shrimp and crab meat, topped with red sauce, lettuce, sour cream and tomatoes. Served with rice and beans',                                       price: 10.99, catName: 'Enchiladas' },
    { name: 'Enchiladas Trio',             description: 'Three enchiladas: one seafood with cheese sauce, one ground beef with red sauce, one chicken with green tomatillo sauce. Served with beans and rice',                             price: 10.99, catName: 'Enchiladas' },
    { name: 'Enchiladas Rancheras',        description: 'Three corn tortillas stuffed with cheese, covered in red sauce, topped with pork strips, onions, bell peppers and tomatoes. Served with lettuce, sour cream and fresh tomatoes',  price: 10.99, catName: 'Enchiladas' },
    { name: 'Taco Salad',                  description: 'Crisp flour bowl stuffed with ground beef or chicken. Topped with lettuce, sour cream, tomatoes, guacamole and cheese',                                                           price: 7.99,  catName: 'Enchiladas', addProteinGroup: true },
    { name: 'Flautas / Taquitos',          description: 'Four corn or flour tortillas deep fried with shredded chicken or beef. Served with lettuce, sour cream, pico de gallo and guacamole',                                             price: 8.99,  catName: 'Enchiladas', addProteinGroup: true },

    // ── Fajitas ──
    { name: 'Chicken, Steak or Pork Fajita', description: 'Classic fajita skillet grilled with broccoli, mushrooms, onions, tomatoes and bell peppers. Served with beans, rice, lettuce, sour cream, pico de gallo, guacamole and tortillas', price: 12.99, catName: 'Fajitas', isPopular: true, addProteinGroup: true },
    { name: 'Cozumel Fajitas',            description: 'Grilled shrimp, chicken and steak with broccoli, mushrooms, onions, tomatoes and bell peppers. Served with tortillas, beans, rice, lettuce, sour cream, pico de gallo and guacamole', price: 15.99, catName: 'Fajitas', isPopular: true },
    { name: 'Parrillada Mexicana',         description: 'Grilled shrimp, chicken, steak, pork and chorizo with vegetables on a skillet. Served with tortillas, rice, beans, lettuce, sour cream, pico de gallo and guacamole',               price: 16.99, catName: 'Fajitas' },
    { name: 'Molcajete',                   description: 'Steak, chicken and shrimp grilled with onions, bell peppers and ranchero sauce, with melted Queso Chihuahua served in a hot lava stone with a guacamole salad',                    price: 14.99, catName: 'Fajitas', isPopular: true },
    { name: 'Nachos Fajita',               description: 'Chips topped with steak or chicken, cheese, lettuce, sour cream, guacamole, pico de gallo, bell peppers, tomatoes, onions, broccoli and mushrooms',                                price: 10.99, catName: 'Fajitas' },
    { name: 'Shrimp Nachos',               description: 'Chips topped with shrimp, cheese, lettuce, sour cream, guacamole, pico de gallo, bell peppers, tomatoes, onions, broccoli and mushrooms',                                         price: 12.99, catName: 'Fajitas' },
    { name: 'Chimichanga Fajita',          description: 'Fried flour tortilla stuffed with grilled chicken, steak or pork, vegetables, topped with cheese sauce. Served with rice, beans, lettuce, sour cream, pico de gallo and guacamole', price: 11.99, catName: 'Fajitas', addProteinGroup: true },
    { name: 'Cozumel Quesadilla Fajita',   description: 'Large flour tortilla stuffed with shrimp, steak and grilled chicken, onions, broccoli, tomatoes, mushrooms, cheese and bell peppers. Served with lettuce, sour cream, guacamole and pico de gallo', price: 13.99, catName: 'Fajitas' },
    { name: 'Quesadilla Fajita',           description: 'Large flour tortilla stuffed with steak, pork or grilled chicken, vegetables and cheese. Served with lettuce, sour cream, guacamole and pico de gallo',                            price: 11.99, catName: 'Fajitas', addProteinGroup: true },
    { name: 'Taco Salad Fajita',           description: 'Crisp flour bowl stuffed with grilled chicken, pork or steak, cheese, onions, tomatoes, bell peppers, mushrooms, broccoli, topped with lettuce, sour cream, pico de gallo and guacamole', price: 9.99, catName: 'Fajitas', addProteinGroup: true },
    { name: 'Steak & Chicken Fajitas',     description: 'Steak, chicken or mixed. Classic skillet fajitas.',                                                                                                                                 price: 13.99, catName: 'Fajitas' },

    // ── Burritos ──
    { name: 'Burrito Special',             description: 'Flour tortilla rolled with ground beef or shredded chicken topped with burrito sauce, lettuce, sour cream and tomatoes. Served with rice and beans',         price: 8.99,  catName: 'Burritos', addProteinGroup: true },
    { name: 'Burritos Vaqueros',           description: 'Two flour tortillas rolled with steak strips topped with green tomatillo sauce, cheese sauce, lettuce and sour cream',                                        price: 10.99, catName: 'Burritos' },
    { name: 'Burritos Frontera',           description: 'Two flour tortillas rolled with Mexican chorizo, grilled chicken and onions. Topped with cheese sauce, lettuce and pico de gallo. Served with rice and beans', price: 11.99, catName: 'Burritos' },
    { name: 'Cozumel Special',             description: 'One chicken burrito and one chicken enchilada topped with red sauce, lettuce, sour cream and pico de gallo',                                                   price: 7.99,  catName: 'Burritos', isPopular: true },
    { name: 'Wet Burritos',                description: 'Two flour tortillas rolled with ground beef or shredded chicken topped with cheese sauce. Served with rice and beans',                                         price: 10.99, catName: 'Burritos', addProteinGroup: true },
    { name: 'Super Burrito',               description: 'Large flour tortilla rolled with beans, rice and grilled chicken or steak topped with cheese sauce. Served with lettuce, sour cream, pico de gallo and guacamole', price: 10.99, catName: 'Burritos', isPopular: true },
    { name: 'Burrito Mexicano',            description: 'Flour tortilla rolled with steak, grilled chicken or pork, onions, tomatoes, mushrooms, broccoli and bell peppers. Topped with cheese sauce, sour cream, lettuce, guacamole and pico de gallo', price: 10.99, catName: 'Burritos', addProteinGroup: true },
    { name: 'Burrito Tapatio',             description: 'Large flour tortilla rolled with shrimp, onions, tomatoes, bell peppers, broccoli and mushrooms. Topped with cheese sauce, lettuce, sour cream, guacamole and pico de gallo. Served with rice and beans', price: 12.99, catName: 'Burritos' },
    { name: 'Chimichanga',                 description: 'Rolled flour tortilla stuffed with shredded chicken or beef, deep fried and topped with cheese sauce. Served with rice, beans, lettuce, sour cream, pico de gallo and guacamole', price: 10.99, catName: 'Burritos', addProteinGroup: true },
    { name: 'Cozumel Combo',               description: 'One beef or chicken burrito, one chile relleno, one taco, one enchilada topped with cheese sauce. Served with rice, beans, lettuce, sour cream and tomatoes', price: 12.99, catName: 'Burritos', isPopular: true },
    { name: 'Special Dinner',              description: 'One bean chalupa, one taco, one enchilada, one cheese chile relleno, one pork tamale, topped with red sauce. Served with rice and beans',                     price: 12.99, catName: 'Burritos' },

    // ── Chicken ──
    { name: 'Pollo Loco',                  description: 'Grilled chicken breast topped with grilled onions and cheese sauce. Served with tortillas, lettuce, guacamole, pico de gallo, sour cream, rice and beans',  price: 12.99, catName: 'Chicken', isPopular: true },
    { name: 'Pollo Ranchero',              description: 'Grilled chicken breast topped with green sauce. Served with avocados, tortillas, rice and beans',                                                              price: 10.99, catName: 'Chicken' },
    { name: 'Pollo Ala Crema',             description: 'Grilled chicken strips with cheesy sour cream salsa. Served with rice, beans and tortillas',                                                                   price: 10.99, catName: 'Chicken' },
    { name: 'Pollo con Hongos',            description: 'Grilled chicken breast with cheesy sauce and mushrooms. Served with rice, beans and tortillas',                                                                price: 10.99, catName: 'Chicken' },
    { name: 'Mole Poblano',                description: 'Grilled chicken topped with our classic mole sauce. Served with rice, beans and tortillas',                                                                    price: 10.99, catName: 'Chicken' },
    { name: 'Pollo Ala Diabla',            description: 'Grilled chicken strips in spicy sauce. Served with rice, beans and flour tortillas',                                                                           price: 10.99, catName: 'Chicken' },
    { name: 'Grilled Chicken Salad',       description: 'Grilled chicken on a bed of lettuce with fresh tomatoes, onions, bell peppers and shredded cheese. Also available with steak.',                               price: 8.99,  catName: 'Chicken' },
    { name: 'Choripollo',                  description: 'Grilled chicken strips and Mexican sausage topped with cheese sauce. Served with tortillas, rice and beans',                                                   price: 11.99, catName: 'Chicken' },

    // ── Steak & Pork ──
    { name: 'Steak Fundido',               description: 'Ribeye steak topped with Mexican sausage and cheese. Served with tortillas, rice and beans',                                                                   price: 16.49, catName: 'Steak & Pork' },
    { name: 'Steak Jalisco',               description: 'Ribeye steak topped with shrimp. Served with tortillas, rice and beans',                                                                                       price: 16.99, catName: 'Steak & Pork' },
    { name: 'Steak Cozumel',               description: 'Ribeye steak topped with shrimp. Served with rice, lettuce, sour cream, fresh tomatoes and baked potato with cheese and broccoli',                           price: 15.99, catName: 'Steak & Pork', isPopular: true },
    { name: 'Steak Tampiqueno',            description: 'Ribeye steak served with rice, beans, tossed salad and tortillas',                                                                                             price: 15.99, catName: 'Steak & Pork' },
    { name: 'Steak Ranchero',              description: 'Ribeye steak topped with red hot sauce. Served with tortillas, rice and beans',                                                                                price: 15.99, catName: 'Steak & Pork' },
    { name: 'Steak Mexicano',              description: 'Ribeye steak cooked with jalapeños, onions and tomatoes. Served with side of ranch and beans',                                                                price: 15.99, catName: 'Steak & Pork' },
    { name: 'Steak Degollado',             description: 'Ribeye steak topped with melted cheese. Served with tortillas, rice and beans',                                                                                price: 15.99, catName: 'Steak & Pork' },
    { name: 'Tacos de Carne Asada',        description: 'Three soft corn tortillas filled with steak. Served with onions, cilantro, beans, rice and hot sauce',                                                        price: 10.99, catName: 'Steak & Pork', isPopular: true },
    { name: 'Chile Colorado',              description: 'Steak chunks with red chile sauce. Served with tortillas, rice and beans',                                                                                     price: 11.99, catName: 'Steak & Pork' },
    { name: 'Chile Verde',                 description: 'Pork tips in green tomatillo sauce. Served with tortillas, rice and beans',                                                                                    price: 11.99, catName: 'Steak & Pork' },
    { name: 'Milanesa',                    description: 'Chicken breast or steak battered in eggs, covered with bread crumbs and deep fried. Served with rice, beans, lettuce, sour cream, pico de gallo and guacamole', price: 14.99, catName: 'Steak & Pork', addProteinGroup: true },
    { name: 'Carnitas',                    description: 'Grilled pork chunks. Served with rice, beans, lettuce, sour cream, pico de gallo, guacamole and tortillas',                                                  price: 12.99, catName: 'Steak & Pork' },
    { name: 'Carne Asada',                 description: 'Steak with grilled onions. Served with tortillas, lettuce, sour cream, pico de gallo, guacamole, rice and beans',                                            price: 13.99, catName: 'Steak & Pork', isPopular: true },
    { name: 'House Special',               description: 'Nachos with beef and cheese, sour cream, guacamole, one chicken flauta, one chicken quesadilla and one beef taquito',                                        price: 11.99, catName: 'Steak & Pork' },

    // ── Seafood ──
    { name: 'Camarones Ala Mexicana',      description: 'Grilled shrimp mixed with jalapeños, tomatoes, onions. Served with rice, beans, lettuce, pico de gallo, sour cream, guacamole and tortillas',               price: 12.99, catName: 'Seafood' },
    { name: 'Camarones Empanizados',       description: 'Shrimp battered in eggs and bread crumbs. Served with rice, beans, lettuce, sour cream, pico de gallo, guacamole and tortillas',                             price: 12.99, catName: 'Seafood' },
    { name: 'Camarones Ala Diabla',        description: 'Grilled shrimp covered with spicy sauce. Served with rice, beans, tortillas, lettuce, sour cream, pico de gallo, guacamole',                                price: 12.99, catName: 'Seafood', isPopular: true },
    { name: 'Camarones Al Mojo De Ajo',    description: 'Grilled garlic shrimp. Served with rice, beans, lettuce, sour cream, pico de gallo, guacamole and tortillas',                                               price: 12.99, catName: 'Seafood' },
    { name: 'Fajitas Camaron',             description: 'Grilled shrimp with broccoli, onions, mushrooms, bell peppers and tomatoes. Served with rice, beans, tortillas, lettuce, sour cream, pico de gallo and guacamole', price: 15.99, catName: 'Seafood', isPopular: true },
    { name: 'Pescador',                    description: 'Shrimp sautéed with onions, tomatoes, bell peppers, broccoli and mushrooms. Served with lettuce, sour cream and tomato',                                    price: 14.99, catName: 'Seafood' },
    { name: 'Platillo Campestre',          description: 'Large flour tortilla topped with beans, rice, lettuce, sour cream, pico de gallo, guacamole, ribeye steak and shrimp',                                       price: 15.99, catName: 'Seafood' },
    { name: 'Playa Azul',                  description: 'Two flour tortillas rolled with seafood and covered with cheese sauce, a piece of tender steak, one cheese chile relleno and one beef burrito. Served with rice', price: 15.99, catName: 'Seafood' },
    { name: 'Costa Enchilada',             description: 'Two rolled flour tortillas stuffed with shrimp and crab meat, covered with cheese sauce. Served with rice and beans',                                        price: 9.99,  catName: 'Seafood' },
    { name: 'Mar y Tierra',                description: 'Shrimp, grilled chicken and steak. One cheese chile relleno, sour cream, lettuce, tomatoes, guacamole and rice',                                            price: 15.99, catName: 'Seafood' },
    { name: 'Calamar',                     description: 'Shrimp and grilled chicken, two seafood enchiladas, sautéed onions and jalapeño peppers, lettuce, sour cream, tomatoes and rice',                           price: 15.99, catName: 'Seafood' },
    { name: 'El Amigo',                    description: 'Two flour tortillas rolled with steak, covered with cheese sauce and served with shrimp, rice, lettuce, sour cream and tomatoes',                            price: 12.99, catName: 'Seafood' },
    { name: 'Fish Quesadilla',             description: 'Large flour tortilla stuffed with grilled fish, onions, bell peppers, tomatoes, broccoli, cheese and mushrooms. Served with lettuce, sour cream, pico de gallo and guacamole', price: 11.99, catName: 'Seafood' },
    { name: 'Plate of Fish',               description: 'Bed of rice topped with grilled fish, onions, broccoli, tomatoes, mushrooms. Served with lettuce, sour cream, pico de gallo and guacamole',                 price: 11.99, catName: 'Seafood' },
    { name: 'Fish or Shrimp Tacos',        description: 'Three corn tortillas filled with grilled tilapia or shrimp. Served with onions, cilantro, beans, rice and spicy sauce',                                     price: 11.99, catName: 'Seafood', isPopular: true },
    { name: 'Pescado Empanizado',          description: 'Breaded tilapia fillet. Served with rice, beans, lettuce, sour cream, pico de gallo, guacamole and tortillas',                                              price: 11.99, catName: 'Seafood' },
    { name: 'Shrimp Quesadilla',           description: 'Large flour tortilla stuffed with shrimp, broccoli, mushrooms, onions, tomatoes, bell peppers and cheese. Served with lettuce, sour cream, pico de gallo and guacamole', price: 12.99, catName: 'Seafood' },
    { name: 'Shrimp Chimichanga',          description: 'Fried flour tortilla stuffed with shrimp and vegetables, covered with cheese sauce. Served with rice, beans, lettuce, sour cream, pico de gallo and guacamole', price: 13.99, catName: 'Seafood' },
    { name: 'Shrimp Tostadas',             description: 'Two corn crispy tortillas covered with sour cream, shrimp, tomatoes, cilantro, onions, peppers and avocado',                                                price: 9.99,  catName: 'Seafood' },
    { name: 'Shrimp Cocktail',             description: 'Broiled shrimp in special sauce made with ketchup, avocados, tomatoes, peppers and onions. Served with crackers (12 pcs)',                                  price: 13.99, catName: 'Seafood' },

    // ── Vegetarian ──
    { name: 'Bean Chalupa (Vegetarian)',   description: 'One bean chalupa, one cheese enchilada and rice',                                                                                                            price: 8.99,  catName: 'Vegetarian' },
    { name: 'Veggie Burrito',              description: 'Two flour tortillas rolled with onions, bell peppers, tomatoes, mushrooms and broccoli. Covered with cheese sauce, topped with lettuce, sour cream and tomatoes. Served with rice and beans', price: 9.99, catName: 'Vegetarian' },
    { name: 'Two Bean Burrito',            description: 'Two bean burritos covered with cheese sauce and rice',                                                                                                       price: 8.99,  catName: 'Vegetarian' },
    { name: 'Veggie Taco Salad Fajita',    description: 'Sautéed onions, broccoli, bell peppers, tomatoes, mushrooms served inside a large flour tortilla bowl with lettuce, pico de gallo, sour cream and guacamole', price: 9.99, catName: 'Vegetarian' },
    { name: 'Veggie Chimichanga',          description: 'Rolled flour tortilla stuffed with vegetables, deep fried and topped with cheese sauce. Served with rice, beans, lettuce, sour cream and tomatoes',         price: 9.99,  catName: 'Vegetarian' },
    { name: 'Veggie Fajitas',              description: 'Sautéed onions, broccoli, bell peppers, tomatoes and mushrooms. Served with rice, beans, lettuce, sour cream, guacamole, pico de gallo and tortillas',    price: 11.99, catName: 'Vegetarian', isPopular: true },
    { name: 'Veggie Quesadilla',           description: 'Large flour tortilla stuffed with onions, tomatoes, broccoli, bell peppers, mushrooms and cheese. Served with lettuce, sour cream, guacamole and pico de gallo', price: 8.99, catName: 'Vegetarian' },
    { name: 'Huevos Rancheros',            description: 'Three eggs cooked with ranchero sauce. Served with rice, beans and tortillas',                                                                               price: 8.99,  catName: 'Vegetarian' },

    // ── Combination Dinners ──
    { name: 'Combination Dinner (Pick 2)', description: 'Pick any two: taquitos, burrito, cheese chile relleno, tostada, pork tamale, taco, enchilada, chalupa, flauta or quesadilla. Served with rice, beans and your choice of filling.', price: 8.99,  catName: 'Combination Dinners', addProteinGroup: true },
    { name: 'Combination Dinner (Pick 3)', description: 'Pick any three: taquitos, burrito, cheese chile relleno, tostada, pork tamale, taco, enchilada, chalupa, flauta or quesadilla. Served with rice, beans and your choice of filling.', price: 10.99, catName: 'Combination Dinners', addProteinGroup: true },

    // ── A La Carte ──
    { name: 'Beef/Chicken Burrito (ALC)',  description: 'Single burrito with beef or chicken',                                                                                                                         price: 3.75,  catName: 'A La Carte', addProteinGroup: true },
    { name: 'Taquito Mexicano',            description: 'Single taquito',                                                                                                                                              price: 2.00,  catName: 'A La Carte' },
    { name: 'Bean Burrito',                description: 'Single bean burrito',                                                                                                                                         price: 3.50,  catName: 'A La Carte' },
    { name: 'Chalupa',                     description: 'Single chalupa',                                                                                                                                              price: 3.75,  catName: 'A La Carte' },
    { name: 'Beef/Chicken Tostada',        description: 'Single tostada with beef or chicken',                                                                                                                         price: 3.75,  catName: 'A La Carte', addProteinGroup: true },
    { name: 'Chili Relleno',               description: 'Single cheese chile relleno',                                                                                                                                 price: 3.50,  catName: 'A La Carte' },
    { name: 'Beef/Chicken Enchilada',      description: 'Single enchilada with beef or chicken',                                                                                                                       price: 2.25,  catName: 'A La Carte', addProteinGroup: true },
    { name: 'Seafood Enchilada',           description: 'Single seafood enchilada',                                                                                                                                    price: 2.99,  catName: 'A La Carte' },
    { name: 'Crunchy Taco',                description: 'Single crunchy beef or chicken taco',                                                                                                                         price: 1.99,  catName: 'A La Carte', addProteinGroup: true },
    { name: 'Soft Taco',                   description: 'Single soft beef or chicken taco',                                                                                                                            price: 2.25,  catName: 'A La Carte', addProteinGroup: true },
    { name: 'Pork Tamale',                 description: 'Single pork tamale',                                                                                                                                          price: 2.99,  catName: 'A La Carte' },
    { name: 'Refried Beans (Side)',        description: 'Side of refried beans',                                                                                                                                       price: 2.00,  catName: 'A La Carte' },
    { name: 'Mexican Rice (Side)',         description: 'Side of Mexican rice',                                                                                                                                        price: 2.00,  catName: 'A La Carte' },
    { name: 'Pico de Gallo (Side)',        description: 'Fresh pico de gallo',                                                                                                                                         price: 1.50,  catName: 'A La Carte' },
    { name: 'Sour Cream (Side)',           description: 'Side of sour cream',                                                                                                                                          price: 0.99,  catName: 'A La Carte' },
    { name: 'Guacamole (Side)',            description: 'Side of fresh guacamole',                                                                                                                                     price: 2.25,  catName: 'A La Carte' },
    { name: 'Tortillas (Side)',            description: 'Flour or corn tortillas',                                                                                                                                     price: 1.25,  catName: 'A La Carte' },
    { name: 'French Fries (Side)',         description: 'Side of seasoned fries',                                                                                                                                      price: 2.50,  catName: 'A La Carte' },
    { name: 'Beef/Chicken Chimichanga (ALC)', description: 'Single chimichanga with beef or chicken',                                                                                                                  price: 4.50,  catName: 'A La Carte', addProteinGroup: true },
    { name: 'Jalapeños (Side)',            description: 'Side of sliced jalapeños',                                                                                                                                    price: 1.00,  catName: 'A La Carte' },
    { name: 'Chiles Toreados',             description: 'Whole grilled jalapeños',                                                                                                                                     price: 1.50,  catName: 'A La Carte' },

    // ── American ──
    { name: 'Cozumel Burger',              description: 'Cheeseburger with lettuce, tomatoes, onions and pickles. Served with french fries',                                                                           price: 7.99,  catName: 'American' },
    { name: 'Chicken Fingers',             description: 'Chicken tenders served with french fries',                                                                                                                    price: 6.99,  catName: 'American' },
    { name: 'Hot Dog',                     description: 'Two hot dogs with french fries',                                                                                                                              price: 6.99,  catName: 'American' },
    { name: 'Chicken Sandwich',            description: 'Boneless chicken breast topped with cheese sauce, lettuce, tomatoes and onions. Served with french fries',                                                   price: 7.99,  catName: 'American' },
    { name: 'Pizza (American)',            description: '8 inch flour tortilla deep fried and topped with beans, ground beef, cheese and tomato sauce',                                                               price: 5.99,  catName: 'American' },
    { name: 'Grilled Cheese',             description: 'Two grilled cheese sandwiches with french fries',                                                                                                              price: 6.99,  catName: 'American' },

    // ── Kids Menu ──
    { name: 'Kids Taco',                   description: 'One soft or crunchy taco with lettuce and cheese (beef or chicken). Served with rice and beans',                                                             price: 4.50,  catName: 'Kids Menu', addProteinGroup: true },
    { name: 'Kids Quesadilla',             description: 'One flour tortilla grilled with cheese or chicken. Served with beans or rice',                                                                               price: 4.50,  catName: 'Kids Menu' },
    { name: 'Kids Nachos',                 description: 'Chips with beef and cheese or cheese only',                                                                                                                  price: 4.50,  catName: 'Kids Menu' },
    { name: 'Kids Burrito',                description: 'One beef or chicken burrito topped with red sauce and cheese. Served with rice and beans',                                                                   price: 4.50,  catName: 'Kids Menu', addProteinGroup: true },
    { name: 'Kids Enchilada',              description: 'One enchilada filled with chicken, cheese or beef. Served with rice and beans',                                                                              price: 4.50,  catName: 'Kids Menu', addProteinGroup: true },
    { name: 'Kids Mexican Pizza',          description: 'Flour tortilla fried and topped with beans, ground beef, cheese and tomato sauce',                                                                           price: 4.50,  catName: 'Kids Menu' },
    { name: 'Kids Chicken Fingers',        description: 'Served with fries or rice',                                                                                                                                  price: 4.50,  catName: 'Kids Menu' },
    { name: 'Kids Hot Dog',                description: 'Served with french fries',                                                                                                                                   price: 4.50,  catName: 'Kids Menu' },
    { name: 'Kids Grilled Cheese',         description: 'Served with french fries',                                                                                                                                   price: 4.50,  catName: 'Kids Menu' },
    { name: 'Kids Cheeseburger',           description: 'Served with french fries',                                                                                                                                   price: 4.50,  catName: 'Kids Menu' },

    // ── Desserts ──
    { name: 'Fried Ice Cream',             description: 'Classic Mexican fried ice cream',                                                                                                                             price: 4.99,  catName: 'Desserts', isPopular: true },
    { name: 'Flan',                        description: 'Traditional Mexican flan',                                                                                                                                    price: 3.99,  catName: 'Desserts' },
    { name: 'Sopapilla',                   description: 'Fried pastry with honey, also available with ice cream (+$1)',                                                                                                price: 2.99,  catName: 'Desserts' },
    { name: 'Banana Chimi with Ice Cream', description: 'Banana chimichanga served with ice cream',                                                                                                                   price: 4.99,  catName: 'Desserts' },
    { name: 'Raspberry Cheesecake Chimi',  description: 'Raspberry cheesecake chimichanga with ice cream',                                                                                                            price: 4.50,  catName: 'Desserts' },
    { name: 'Vanilla Ice Cream',           description: 'Vanilla ice cream with whipped cream and cherry',                                                                                                             price: 1.99,  catName: 'Desserts' },

    // ── Drinks ──
    { name: 'Pepsi',                       description: 'Fountain soda — two free refills',                                                                                                                           price: 2.50,  catName: 'Drinks', isTaxable: false },
    { name: 'Diet Pepsi',                  description: 'Fountain soda — two free refills',                                                                                                                           price: 2.50,  catName: 'Drinks', isTaxable: false },
    { name: 'Mountain Dew',                description: 'Fountain soda — two free refills',                                                                                                                           price: 2.50,  catName: 'Drinks', isTaxable: false },
    { name: 'Diet Mountain Dew',           description: 'Fountain soda — two free refills',                                                                                                                           price: 2.50,  catName: 'Drinks', isTaxable: false },
    { name: 'Root Beer',                   description: 'Fountain soda — two free refills',                                                                                                                           price: 2.50,  catName: 'Drinks', isTaxable: false },
    { name: 'Dr. Pepper',                  description: 'Fountain soda — two free refills',                                                                                                                           price: 2.50,  catName: 'Drinks', isTaxable: false },
    { name: 'Raspberry Tea',               description: 'Fountain — two free refills',                                                                                                                                price: 2.50,  catName: 'Drinks', isTaxable: false },
    { name: 'Iced Tea (Unsweet)',          description: 'Fountain — two free refills',                                                                                                                                price: 2.50,  catName: 'Drinks', isTaxable: false },
    { name: 'Coffee',                      description: 'Hot or iced coffee',                                                                                                                                         price: 2.50,  catName: 'Drinks', isTaxable: false },
    { name: 'Hot Tea',                     description: 'Assorted teas',                                                                                                                                              price: 2.50,  catName: 'Drinks', isTaxable: false },
    { name: 'Jarritos',                    description: 'Mexican soda — Mandarin, Strawberry, Fruit Punch, Lime, Pineapple, Mango, Guava',                                                                           price: 2.50,  catName: 'Drinks', isTaxable: false },
    { name: 'Mexican Coke (Bottle)',       description: 'Glass bottle Coke sweetened with cane sugar',                                                                                                                price: 3.50,  catName: 'Drinks', isTaxable: false },
  ];

  for (let i = 0; i < items.length; i++) {
    const { catName, addProteinGroup, addSalsaGroup, addSidesGroup, ...itemData } = items[i];
    const created = await prisma.menuItem.create({
      data: {
        ...itemData,
        categoryId: cats[catName],
        sortOrder: i,
        isTaxable: itemData.isTaxable ?? true,
      } as any,
    });

    if (addProteinGroup) {
      await prisma.modifierGroupOnItem.create({
        data: { menuItemId: created.id, modifierGroupId: proteinGroup.id, sortOrder: 0 },
      });
    }
    if (addSalsaGroup) {
      await prisma.modifierGroupOnItem.create({
        data: { menuItemId: created.id, modifierGroupId: salsaGroup.id, sortOrder: 1 },
      });
    }
    if (addSidesGroup) {
      await prisma.modifierGroupOnItem.create({
        data: { menuItemId: created.id, modifierGroupId: sidesGroup.id, sortOrder: 2 },
      });
    }
  }

  console.log(`✅ Created ${items.length} menu items across ${catDefs.length} categories`);
  console.log('🌮 Cozumel menu loaded!');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());

/**
 * Sets up Cozumel Mexican Restaurant & Cantina as Client #1.
 * Run: npx tsx prisma/setup-cozumel-client.ts
 */
import { PrismaClient, PlanTier, SubscriptionStatus, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌮  Setting up Cozumel Mexican Restaurant & Cantina as Client #1...\n');

  // ── 1. Rename / properly configure org 1 ─────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { slug: 'sonicpos-restaurant' },
    update: {
      name: 'Cozumel Mexican Restaurant & Cantina',
      slug: 'cozumel',
      email: 'owner@cozumelrestaurant.com',
      phone: '(555) 867-5309',
      planTier: PlanTier.ENTERPRISE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      isActive: true,
    },
    create: {
      name: 'Cozumel Mexican Restaurant & Cantina',
      slug: 'cozumel',
      email: 'owner@cozumelrestaurant.com',
      phone: '(555) 867-5309',
      planTier: PlanTier.ENTERPRISE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      isActive: true,
    },
  });
  console.log(`✅  Organization: "${org.name}" (slug: ${org.slug}, id: ${org.id})`);

  // ── 2. Update key settings to reflect Cozumel branding ───────────────────
  const settingsToUpdate = [
    { key: 'restaurant_name', value: 'Cozumel Mexican Restaurant & Cantina' },
    { key: 'address',         value: '456 Cantina Blvd, San Antonio, TX 78201' },
    { key: 'phone',           value: '(555) 867-5309' },
    { key: 'tax_rate',        value: '0.0825' },
    { key: 'timezone',        value: 'America/Chicago' },
    { key: 'receipt_footer',  value: '¡Gracias! Thank you for dining at Cozumel.' },
  ];
  for (const s of settingsToUpdate) {
    await prisma.setting.upsert({
      where: { organizationId_key: { organizationId: org.id, key: s.key } },
      update: { value: s.value },
      create: { organizationId: org.id, ...s },
    });
  }
  console.log('✅  Settings updated');

  // ── 3. Ensure the owner account exists with proper credentials ────────────
  const pinHash  = await bcrypt.hash('1234', 12);
  const passHash = await bcrypt.hash('cozumel123', 12);

  const owner = await prisma.user.upsert({
    where: { organizationId_username: { organizationId: org.id, username: 'admin' } },
    update: {
      firstName: 'Cozumel',
      lastName: 'Owner',
      email: 'owner@cozumelrestaurant.com',
      password: passHash,
      pin: pinHash,
      role: Role.OWNER,
      isActive: true,
    },
    create: {
      organizationId: org.id,
      username: 'admin',
      email: 'owner@cozumelrestaurant.com',
      password: passHash,
      pin: pinHash,
      firstName: 'Cozumel',
      lastName: 'Owner',
      role: Role.OWNER,
      isActive: true,
    },
  });
  console.log(`✅  Owner account: "${owner.username}" (${owner.email})`);

  // ── 4. Print a summary ────────────────────────────────────────────────────
  const userCount = await prisma.user.count({ where: { organizationId: org.id } });
  const menuItems = await prisma.menuItem.count({ where: { organizationId: org.id } });
  const tables    = await prisma.table.count({ where: { organizationId: org.id } });

  console.log('\n────────────────────────────────────────────');
  console.log('🌮  COZUMEL — CLIENT #1 SETUP COMPLETE');
  console.log('────────────────────────────────────────────');
  console.log(`   Org ID       : ${org.id}`);
  console.log(`   Slug         : ${org.slug}  (store code for PIN login)`);
  console.log(`   Plan         : ${org.planTier} / ${org.subscriptionStatus}`);
  console.log(`   Staff        : ${userCount} users`);
  console.log(`   Menu items   : ${menuItems}`);
  console.log(`   Tables       : ${tables}`);
  console.log('');
  console.log('   LOGIN CREDENTIALS');
  console.log('   ─────────────────');
  console.log('   Web login    : username=admin  password=cozumel123');
  console.log('   PIN login    : username=admin  PIN=1234');
  console.log('   Store code   : cozumel');
  console.log('────────────────────────────────────────────\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

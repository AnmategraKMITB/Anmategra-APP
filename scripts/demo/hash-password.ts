import { hashDemoPassword } from '~/server/demo-auth';

const password = process.argv[2] ?? process.env.DEMO_PASSWORD;

if (!password) {
  console.error(
    'Pakai: npx tsx scripts/demo/hash-password.ts "password-minimal-12-karakter"',
  );
  process.exit(1);
}

console.log(await hashDemoPassword(password));

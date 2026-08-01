import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const roles = [
  {
    key: "super_admin",
    name: "Super Admin",
    description: "Platform-wide administrator",
  },
  {
    key: "org_admin",
    name: "Organization Admin",
    description: "Administers a single organization",
  },
  {
    key: "employee",
    name: "Employee",
    description: "Organization member with operational access",
  },
  {
    key: "public_user",
    name: "Public User",
    description: "End user with limited access",
  },
] as const;

async function main() {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { key: role.key },
      create: role,
      update: {
        name: role.name,
        description: role.description,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

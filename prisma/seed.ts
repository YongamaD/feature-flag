import { PrismaClient } from "@prisma/client";
import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function generateApiKey(): { raw: string; hash: string } {
  const raw = `ff_${randomBytes(24).toString("hex")}`;
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

async function main() {
  console.log("Seeding database...");

  // Create default admin user
  const adminPassword = "admin123";
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@example.com",
      passwordHash,
      role: "admin",
    },
  });
  console.log(`Admin user created: ${adminUser.email} (password: ${adminPassword})`);

  const org = await prisma.organization.create({
    data: { name: "Acme Corp" },
  });

  const project = await prisma.project.create({
    data: { name: "Main App", organizationId: org.id },
  });

  const envNames = ["development", "staging", "production"] as const;
  const envKeys: Record<string, string> = {};

  for (const envName of envNames) {
    const { raw, hash } = generateApiKey();
    envKeys[envName] = raw;

    const env = await prisma.environment.create({
      data: {
        name: envName,
        projectId: project.id,
        apiKeyHash: hash,
      },
    });

    // Create sample flags for each environment
    const newCheckout = await prisma.flag.create({
      data: {
        key: "new-checkout",
        description: "New checkout flow redesign",
        environmentId: env.id,
        versions: {
          create: {
            version: 1,
            createdBy: "seed",
            stateJson: {
              enabled: true,
              defaultVariant: "control",
              variants: ["control", "treatment"],
              rules: [
                {
                  id: "rule-1",
                  conditions: [
                    { attr: "country", op: "IN", value: ["ZA", "NG"] },
                    { attr: "plan", op: "EQ", value: "pro" },
                  ],
                  result: { enabled: true, variant: "treatment" },
                },
              ],
              rollout: {
                type: "PERCENT",
                percentage: 25,
                stickinessKey: "userId",
              },
            },
          },
        },
      },
    });

    const betaUi = await prisma.flag.create({
      data: {
        key: "beta-ui",
        description: "Beta UI components",
        environmentId: env.id,
        versions: {
          create: {
            version: 1,
            createdBy: "seed",
            stateJson: {
              enabled: envName === "development",
              defaultVariant: "off",
              variants: ["off", "on"],
              rules: [],
              rollout: null,
            },
          },
        },
      },
    });

    const darkMode = await prisma.flag.create({
      data: {
        key: "dark-mode",
        description: "Dark mode toggle",
        environmentId: env.id,
        versions: {
          create: {
            version: 1,
            createdBy: "seed",
            stateJson: {
              enabled: true,
              defaultVariant: "off",
              variants: ["off", "on"],
              rules: [
                {
                  id: "rule-1",
                  conditions: [
                    { attr: "plan", op: "IN", value: ["pro", "enterprise"] },
                  ],
                  result: { enabled: true, variant: "on" },
                },
              ],
              rollout: null,
            },
          },
        },
      },
    });
  }

  console.log("\nSeed complete!\n");
  console.log("Organization:", org.name);
  console.log("Project:", project.name);
  console.log("\nAPI Keys (save these — they cannot be retrieved later):");
  for (const [envName, key] of Object.entries(envKeys)) {
    console.log(`  ${envName}: ${key}`);
  }
  console.log("\nFlags created: new-checkout, beta-ui, dark-mode");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

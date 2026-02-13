import type { PrismaClient } from "@prisma/client";
import type { FlagState } from "@feature-flags/evaluator";

export interface CreateFlagInput {
  key: string;
  description?: string;
  environmentId: string;
  initialState: FlagState;
  createdBy: string;
}

export interface UpdateFlagInput {
  stateJson: FlagState;
}

export async function createFlag(prisma: PrismaClient, input: CreateFlagInput) {
  const [flag, _auditLog] = await prisma.$transaction([
    prisma.flag.create({
      data: {
        key: input.key,
        description: input.description || "",
        environmentId: input.environmentId,
        versions: {
          create: {
            version: 1,
            stateJson: input.initialState as any,
            createdBy: input.createdBy,
          },
        },
      },
      include: { versions: true },
    }),
    prisma.auditLog.create({
      data: {
        environmentId: input.environmentId,
        actor: input.createdBy,
        action: "CREATE",
        entityKey: input.key,
        diffJson: {
          version: 1,
          state: input.initialState,
        },
      },
    }),
  ]);

  return flag;
}

export async function getFlag(
  prisma: PrismaClient,
  environmentId: string,
  key: string
) {
  return prisma.flag.findUnique({
    where: { environmentId_key: { environmentId, key } },
    include: {
      versions: { orderBy: { version: "desc" } },
    },
  });
}

export async function listFlags(prisma: PrismaClient, environmentId: string) {
  return prisma.flag.findMany({
    where: { environmentId, isArchived: false },
    include: {
      versions: { orderBy: { version: "desc" }, take: 1 },
    },
  });
}

export async function updateDraftState(
  prisma: PrismaClient,
  environmentId: string,
  key: string,
  stateJson: FlagState,
  updatedBy: string
) {
  const flag = await prisma.flag.findUnique({
    where: { environmentId_key: { environmentId, key } },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });

  if (!flag) return null;

  const latestVersion = flag.versions[0];
  if (!latestVersion) return null;

  const oldState = latestVersion.stateJson;

  const [updated, _auditLog] = await prisma.$transaction([
    prisma.flagVersion.update({
      where: { id: latestVersion.id },
      data: { stateJson: stateJson as any },
    }),
    prisma.auditLog.create({
      data: {
        environmentId,
        actor: updatedBy,
        action: "UPDATE",
        entityKey: key,
        diffJson: {
          old: oldState,
          new: stateJson,
        },
      },
    }),
  ]);

  return updated;
}

export async function publishFlag(
  prisma: PrismaClient,
  environmentId: string,
  key: string,
  publishedBy: string
) {
  const flag = await prisma.flag.findUnique({
    where: { environmentId_key: { environmentId, key } },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });

  if (!flag || flag.versions.length === 0) return null;

  const currentVersion = flag.versions[0];
  const newVersionNum = currentVersion.version + 1;

  const [newVersion, _auditLog] = await prisma.$transaction([
    prisma.flagVersion.create({
      data: {
        flagId: flag.id,
        version: newVersionNum,
        stateJson: currentVersion.stateJson as any,
        createdBy: publishedBy,
      },
    }),
    prisma.auditLog.create({
      data: {
        environmentId,
        actor: publishedBy,
        action: "PUBLISH",
        entityKey: key,
        diffJson: {
          version: newVersionNum,
          state: currentVersion.stateJson,
        },
      },
    }),
  ]);

  return { flag, version: newVersion };
}

export async function rollbackFlag(
  prisma: PrismaClient,
  environmentId: string,
  key: string,
  targetVersion: number,
  rolledBackBy: string
) {
  const flag = await prisma.flag.findUnique({
    where: { environmentId_key: { environmentId, key } },
    include: { versions: { orderBy: { version: "desc" } } },
  });

  if (!flag) return null;

  const targetVer = flag.versions.find((v) => v.version === targetVersion);
  if (!targetVer) return null;

  const latestVersion = flag.versions[0].version;
  const newVersionNum = latestVersion + 1;

  const [newVersion, _auditLog] = await prisma.$transaction([
    prisma.flagVersion.create({
      data: {
        flagId: flag.id,
        version: newVersionNum,
        stateJson: targetVer.stateJson as any,
        createdBy: rolledBackBy,
      },
    }),
    prisma.auditLog.create({
      data: {
        environmentId,
        actor: rolledBackBy,
        action: "ROLLBACK",
        entityKey: key,
        diffJson: {
          fromVersion: latestVersion,
          toVersion: targetVersion,
          newVersion: newVersionNum,
          state: targetVer.stateJson,
        },
      },
    }),
  ]);

  return { flag, version: newVersion };
}

export async function buildSnapshot(
  prisma: PrismaClient,
  environmentId: string
) {
  const flags = await prisma.flag.findMany({
    where: { environmentId, isArchived: false },
    include: {
      versions: { orderBy: { version: "desc" }, take: 1 },
    },
  });

  const flagsMap: Record<string, unknown> = {};
  let maxVersion = 0;

  for (const flag of flags) {
    if (flag.versions.length > 0) {
      flagsMap[flag.key] = flag.versions[0].stateJson;
      maxVersion = Math.max(maxVersion, flag.versions[0].version);
    }
  }

  return {
    environmentId,
    version: maxVersion,
    flags: flagsMap,
  };
}

export async function archiveFlag(
  prisma: PrismaClient,
  environmentId: string,
  key: string,
  archivedBy: string
) {
  const flag = await prisma.flag.findUnique({
    where: { environmentId_key: { environmentId, key } },
  });

  if (!flag) return null;

  const [updated, _auditLog] = await prisma.$transaction([
    prisma.flag.update({
      where: { environmentId_key: { environmentId, key } },
      data: { isArchived: true },
    }),
    prisma.auditLog.create({
      data: {
        environmentId,
        actor: archivedBy,
        action: "ARCHIVE",
        entityKey: key,
        diffJson: { isArchived: true },
      },
    }),
  ]);

  return updated;
}

export async function unarchiveFlag(
  prisma: PrismaClient,
  environmentId: string,
  key: string,
  unarchivedBy: string
) {
  const flag = await prisma.flag.findUnique({
    where: { environmentId_key: { environmentId, key } },
  });

  if (!flag) return null;

  const [updated, _auditLog] = await prisma.$transaction([
    prisma.flag.update({
      where: { environmentId_key: { environmentId, key } },
      data: { isArchived: false },
    }),
    prisma.auditLog.create({
      data: {
        environmentId,
        actor: unarchivedBy,
        action: "UNARCHIVE",
        entityKey: key,
        diffJson: { isArchived: false },
      },
    }),
  ]);

  return updated;
}

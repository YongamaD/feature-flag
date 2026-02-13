import type Redis from "ioredis";

const SNAPSHOT_TTL = 300; // 5 minutes

function snapshotKey(envId: string): string {
  return `env:${envId}:snapshot`;
}

function versionKey(envId: string): string {
  return `env:${envId}:version`;
}

export interface SnapshotData {
  environmentId: string;
  version: number;
  flags: Record<string, unknown>;
}

export async function getCachedSnapshot(
  redis: Redis,
  envId: string
): Promise<SnapshotData | null> {
  const data = await redis.get(snapshotKey(envId));
  if (!data) return null;
  return JSON.parse(data) as SnapshotData;
}

export async function setCachedSnapshot(
  redis: Redis,
  envId: string,
  snapshot: SnapshotData
): Promise<void> {
  await redis.set(
    snapshotKey(envId),
    JSON.stringify(snapshot),
    "EX",
    SNAPSHOT_TTL
  );
  await redis.set(versionKey(envId), String(snapshot.version));
}

export async function invalidateSnapshot(
  redis: Redis,
  envId: string
): Promise<void> {
  await redis.del(snapshotKey(envId));
  await redis.del(versionKey(envId));
}

export async function getCachedVersion(
  redis: Redis,
  envId: string
): Promise<number | null> {
  const v = await redis.get(versionKey(envId));
  return v ? parseInt(v, 10) : null;
}

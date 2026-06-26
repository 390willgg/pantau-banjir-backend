import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

async function main() {
  await prisma.area.createMany({
    data: [
      {
        id: "jakarta-utara",
        name: "Jakarta Utara",
        northLatitude: -6.09,
        southLatitude: -6.18,
        eastLongitude: 106.935,
        westLongitude: 106.76,
      },
      {
        id: "kelapa-gading",
        name: "Kelapa Gading",
        northLatitude: -6.125,
        southLatitude: -6.175,
        eastLongitude: 106.93,
        westLongitude: 106.875,
      },
      {
        id: "ancol",
        name: "Ancol",
        northLatitude: -6.1,
        southLatitude: -6.145,
        eastLongitude: 106.865,
        westLongitude: 106.8,
      },
      {
        id: "sunter",
        name: "Sunter",
        northLatitude: -6.14,
        southLatitude: -6.19,
        eastLongitude: 106.9,
        westLongitude: 106.84,
      },
      {
        id: "cilincing",
        name: "Cilincing",
        northLatitude: -6.08,
        southLatitude: -6.16,
        eastLongitude: 106.97,
        westLongitude: 106.9,
      },
      {
        id: "penjaringan",
        name: "Penjaringan",
        northLatitude: -6.09,
        southLatitude: -6.15,
        eastLongitude: 106.79,
        westLongitude: 106.72,
      },
      {
        id: "pademangan",
        name: "Pademangan",
        northLatitude: -6.11,
        southLatitude: -6.17,
        eastLongitude: 106.865,
        westLongitude: 106.805,
      },
      {
        id: "koja",
        name: "Koja",
        northLatitude: -6.105,
        southLatitude: -6.165,
        eastLongitude: 106.93,
        westLongitude: 106.86,
      },
    ],
    skipDuplicates: true,
  });

  const demoLocationIds = ["A-1", "B-2", "C-3", "D-4", "E-5", "flow001"];
  const demoDeviceIds = ["esp8266-sim-a1", "esp8266-field-b2"];

  await prisma.$transaction(async (tx) => {
    await tx.device.deleteMany({
      where: {
        OR: [
          { id: { in: demoDeviceIds } },
          { assignedLocationId: { in: demoLocationIds } },
        ],
      },
    });
    await tx.alert.deleteMany({
      where: { locationId: { in: demoLocationIds } },
    });
    await tx.sensorReading.deleteMany({
      where: { locationId: { in: demoLocationIds } },
    });
    await tx.location.deleteMany({ where: { id: { in: demoLocationIds } } });
    await tx.location.updateMany({
      where: { id: { in: ["FW-0001", "FW-001"] } },
      data: {
        maxCapacityMeters: 0.25,
        warningThreshold: 0.1,
        dangerThreshold: 0.15,
      },
    });
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });

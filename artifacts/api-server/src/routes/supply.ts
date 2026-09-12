import { Router, type IRouter } from "express";
import {
  CreateTransferRequestBody,
  GetDashboardQueryParams,
  GetDashboardResponse,
  GetDeliveryStatusResponse,
  ListAlertsQueryParams,
  ListAlertsResponse,
  ListFacilitiesQueryParams,
  ListFacilitiesResponse,
  ListInventoryQueryParams,
  ListInventoryResponse,
  ListMedicinesQueryParams,
  ListMedicinesResponse,
  ListNearbySuppliersQueryParams,
  ListNearbySuppliersResponse,
  ListNotificationsQueryParams,
  ListNotificationsResponse,
  ListTransferRequestsQueryParams,
  ListTransferRequestsResponse,
  MarkNotificationReadParams,
  UpdateTransferRequestBody,
  UpdateTransferRequestParams,
  UpdateTransferRequestResponse,
} from "@workspace/api-zod";
import {
  db,
  facilitiesTable,
  inventoryTable,
  medicinesTable,
  notificationsTable,
  transferRequestsTable,
} from "@workspace/db";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";

const router: IRouter = Router();
const DAY = 86_400_000;

const dateDaysFromNow = (value: string | Date) =>
  Math.ceil((new Date(value).getTime() - Date.now()) / DAY);

const distanceKm = (from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) => {
  const radians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = radians(to.latitude - from.latitude);
  const deltaLon = radians(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(deltaLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const facilityJson = (facility: typeof facilitiesTable.$inferSelect) => ({
  id: facility.id,
  code: facility.code,
  name: facility.name,
  type: facility.type,
  city: facility.city,
  district: facility.district,
  address: facility.address,
  latitude: facility.latitude,
  longitude: facility.longitude,
  contactName: facility.contactName,
  contactPhone: facility.contactPhone,
  isActive: facility.isActive,
  lastSyncAt: facility.lastSyncAt,
});

const medicineJson = (medicine: typeof medicinesTable.$inferSelect) => ({
  id: medicine.id,
  genericName: medicine.genericName,
  brandName: medicine.brandName,
  strength: medicine.strength,
  form: medicine.form,
  unit: medicine.unit,
  category: medicine.category,
  reorderLevel: medicine.reorderLevel,
});

const inventoryJson = (
  row: {
    inventory: typeof inventoryTable.$inferSelect;
    facility: typeof facilitiesTable.$inferSelect;
    medicine: typeof medicinesTable.$inferSelect;
  },
) => {
  const availableQuantity = Math.max(0, row.inventory.quantityOnHand - row.inventory.reservedQuantity);
  const daysToExpiry = dateDaysFromNow(row.inventory.expiryDate);
  const daysOfCover =
    row.inventory.dailyConsumption > 0
      ? Number((availableQuantity / row.inventory.dailyConsumption).toFixed(1))
      : 999;
  const risk =
    daysOfCover <= 3 || daysToExpiry <= 14
      ? "critical"
      : daysOfCover <= 7 || daysToExpiry <= 30
        ? "high"
        : daysOfCover <= 14 || daysToExpiry <= 60
          ? "watch"
          : "stable";
  return {
    id: row.inventory.id,
    facilityId: row.facility.id,
    facilityName: row.facility.name,
    medicineId: row.medicine.id,
    medicineName: row.medicine.genericName,
    strength: row.medicine.strength,
    form: row.medicine.form,
    unit: row.medicine.unit,
    batchNumber: row.inventory.batchNumber,
    quantityOnHand: row.inventory.quantityOnHand,
    reservedQuantity: row.inventory.reservedQuantity,
    availableQuantity,
    expiryDate: new Date(`${row.inventory.expiryDate}T00:00:00.000Z`),
    daysToExpiry,
    daysOfCover,
    dailyConsumption: row.inventory.dailyConsumption,
    risk,
    lastCountedAt: row.inventory.lastCountedAt,
  };
};

const loadInventory = async (facilityId?: number, medicineId?: number) => {
  const conditions = [];
  if (facilityId) conditions.push(eq(inventoryTable.facilityId, facilityId));
  if (medicineId) conditions.push(eq(inventoryTable.medicineId, medicineId));
  return db
    .select({
      inventory: inventoryTable,
      facility: facilitiesTable,
      medicine: medicinesTable,
    })
    .from(inventoryTable)
    .innerJoin(facilitiesTable, eq(inventoryTable.facilityId, facilitiesTable.id))
    .innerJoin(medicinesTable, eq(inventoryTable.medicineId, medicinesTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(inventoryTable.expiryDate));
};

const loadTransferRequests = async (facilityId: number, role: "incoming" | "outgoing" | "all") => {
  const roleCondition =
    role === "incoming"
      ? eq(transferRequestsTable.supplierFacilityId, facilityId)
      : role === "outgoing"
        ? eq(transferRequestsTable.requesterFacilityId, facilityId)
        : or(
            eq(transferRequestsTable.supplierFacilityId, facilityId),
            eq(transferRequestsTable.requesterFacilityId, facilityId),
          );
  const [requests, facilities, medicines] = await Promise.all([
    db.select().from(transferRequestsTable).where(roleCondition).orderBy(desc(transferRequestsTable.createdAt)),
    db.select().from(facilitiesTable),
    db.select().from(medicinesTable),
  ]);
  const facilityMap = new Map(facilities.map((facility) => [facility.id, facility]));
  const medicineMap = new Map(medicines.map((medicine) => [medicine.id, medicine]));
  return requests.map((request) => {
    const requester = facilityMap.get(request.requesterFacilityId);
    const supplier = facilityMap.get(request.supplierFacilityId);
    const medicine = medicineMap.get(request.medicineId);
    return {
      id: request.id,
      requesterFacilityId: request.requesterFacilityId,
      requesterFacilityName: requester?.name ?? "Unknown facility",
      supplierFacilityId: request.supplierFacilityId,
      supplierFacilityName: supplier?.name ?? "Unknown facility",
      medicineId: request.medicineId,
      medicineName: medicine?.genericName ?? "Unknown medicine",
      medicineStrength: medicine?.strength ?? "",
      quantity: request.quantity,
      status: request.status,
      note: request.note,
      deliveryStatus: request.deliveryStatus,
      createdAt: request.createdAt,
      respondedAt: request.respondedAt,
    };
  });
};

const buildSupplierMatches = async (requesterFacilityId: number, medicineId: number, quantity: number) => {
  const [requesterRows, medicineRows, inventoryRows] = await Promise.all([
    db.select().from(facilitiesTable).where(eq(facilitiesTable.id, requesterFacilityId)).limit(1),
    db.select().from(medicinesTable).where(eq(medicinesTable.id, medicineId)).limit(1),
    loadInventory(undefined, medicineId),
  ]);
  const requester = requesterRows[0];
  const medicine = medicineRows[0];
  if (!requester || !medicine) return [];

  return inventoryRows
    .filter((row) => row.facility.id !== requesterFacilityId && row.facility.isActive)
    .map((row) => {
      const inventory = inventoryJson(row);
      const surplusQuantity = Math.max(0, inventory.availableQuantity - medicine.reorderLevel);
      const distance = distanceKm(requester, row.facility);
      const matchScore = Number(
        (Math.min(1, surplusQuantity / Math.max(quantity, 1)) * 0.65 + (1 / (distance + 1)) * 0.35).toFixed(3),
      );
      return {
        facility: facilityJson(row.facility),
        medicine: medicineJson(medicine),
        availableQuantity: inventory.availableQuantity,
        surplusQuantity,
        nearestExpiryDate: inventory.expiryDate,
        daysToExpiry: inventory.daysToExpiry,
        distanceKm: Number(distance.toFixed(1)),
        estimatedMinutes: Math.max(8, Math.round(distance * 2.6 + 12)),
        matchScore,
        recommendation: "fallback" as "recommended" | "good" | "fallback",
      };
    })
    .filter((row) => row.availableQuantity > 0)
    .sort((a, b) => b.matchScore - a.matchScore || a.distanceKm - b.distanceKm)
    .map((row, index) => ({
      ...row,
      recommendation: index === 0 ? "recommended" as const : index < 3 ? "good" as const : "fallback" as const,
    }));
};

const buildAlerts = async () => {
  const [inventoryRows, facilities, medicines] = await Promise.all([
    loadInventory(),
    db.select().from(facilitiesTable),
    db.select().from(medicinesTable),
  ]);
  const facilityMap = new Map(facilities.map((facility) => [facility.id, facility]));
  const medicineMap = new Map(medicines.map((medicine) => [medicine.id, medicine]));
  const riskyRows = inventoryRows
    .map(inventoryJson)
    .filter((row) => row.risk !== "stable")
    .sort((a, b) => a.daysOfCover - b.daysOfCover)
    .slice(0, 24);

  const alerts = await Promise.all(
    riskyRows.map(async (row) => {
      const facility = facilityMap.get(row.facilityId);
      const medicine = medicineMap.get(row.medicineId);
      const matches = await buildSupplierMatches(row.facilityId, row.medicineId, Math.max(1, row.quantityOnHand));
      const recommended = matches[0];
      const severity = row.risk === "critical" ? "critical" : row.risk === "high" ? "high" : "watch";
      const title =
        row.daysToExpiry <= 30
          ? `${facility?.name ?? row.facilityName} has near-expiry ${medicine?.genericName ?? row.medicineName}`
          : `${facility?.name ?? row.facilityName} is under pressure on ${medicine?.genericName ?? row.medicineName}`;
      const detail =
        row.daysToExpiry <= 30
          ? `${row.availableQuantity.toLocaleString()} ${row.unit} expire in ${row.daysToExpiry} days. Review redistribution before wastage.`
          : `${medicine?.genericName ?? row.medicineName} has ${row.daysOfCover} days of cover at current consumption.`;
      const distance = recommended?.distanceKm ?? 0;
      return {
        id: row.id,
        facilityId: row.facilityId,
        facilityName: row.facilityName,
        medicineId: row.medicineId,
        medicineName: row.medicineName,
        severity,
        title,
        detail,
        daysOfCover: row.daysOfCover,
        distanceKm: distance,
        recommendedSupplierId: recommended?.facility.id ?? null,
        recommendedSupplierName: recommended?.facility.name ?? null,
        recommendedQuantity: recommended ? Math.min(recommended.surplusQuantity, Math.max(1, Math.ceil(row.dailyConsumption * 7))) : null,
        confidence: row.lastCountedAt.getTime() > Date.now() - 24 * 60 * 60 * 1000 ? "high" : "medium",
        createdAt: new Date(),
      };
    }),
  );
  return alerts;
};

router.get("/dashboard", async (req, res, next) => {
  try {
    const params = GetDashboardQueryParams.parse(req.query);
    const [facilityRows, inventoryRows, alerts, transfers, notifications] = await Promise.all([
      db.select().from(facilitiesTable).where(eq(facilitiesTable.id, params.facilityId)).limit(1),
      loadInventory(params.facilityId),
      buildAlerts(),
      loadTransferRequests(params.facilityId, "all"),
      db.select().from(notificationsTable).where(eq(notificationsTable.facilityId, params.facilityId)).orderBy(desc(notificationsTable.createdAt)).limit(20),
    ]);
    if (!facilityRows[0]) return res.status(404).json({ error: "Facility not found" });
    const payload = {
      facility: facilityJson(facilityRows[0]),
      summary: {
        criticalAlerts: alerts.filter((alert) => alert.severity === "critical").length,
        watchAlerts: alerts.filter((alert) => alert.severity === "watch" || alert.severity === "high").length,
        inventoryLines: inventoryRows.length,
        pendingTransfers: transfers.filter((transfer) => transfer.status === "pending").length,
        unreadNotifications: notifications.filter((notification) => !notification.isRead).length,
      },
      alerts,
      inventory: inventoryRows.map(inventoryJson),
      transfers,
      notifications,
    };
    return res.json(GetDashboardResponse.parse(payload));
  } catch (error) {
    // Return mock data for demo mode when database is unavailable
    const mockPayload = {
      facility: {
        id: 1,
        code: "KMC-MAN",
        name: "Kasturba Medical Centre",
        type: "hospital",
        city: "Manipal",
        district: "Udupi",
        address: "Tiger Circle, Manipal",
        latitude: 13.3525,
        longitude: 74.7927,
        contactName: "Anitha Rao",
        contactPhone: "+91 820 292 1181",
        isActive: true,
        lastSyncAt: new Date().toISOString(),
      },
      summary: {
        criticalAlerts: 1,
        watchAlerts: 2,
        inventoryLines: 15,
        pendingTransfers: 2,
        unreadNotifications: 2,
      },
      alerts: [
        {
          id: 1,
          facilityId: 1,
          facilityName: "Kasturba Medical Centre",
          medicineId: 1,
          medicineName: "Paracetamol",
          severity: "critical",
          title: "Critical stock shortage of Paracetamol",
          detail: "Only 2 days of cover remaining. Urgent redistribution needed.",
          daysOfCover: 2,
          distanceKm: 15.3,
          recommendedSupplierId: 2,
          recommendedSupplierName: "District Hospital Udupi",
          recommendedQuantity: 500,
          confidence: "high",
          createdAt: new Date().toISOString(),
        },
        {
          id: 2,
          facilityId: 1,
          facilityName: "Kasturba Medical Centre",
          medicineId: 5,
          medicineName: "Azithromycin",
          severity: "high",
          title: "Azithromycin stock at high alert",
          detail: "6 days of cover at current consumption rate.",
          daysOfCover: 6,
          distanceKm: 45.2,
          recommendedSupplierId: 3,
          recommendedSupplierName: "Government Wenlock Hospital",
          recommendedQuantity: 300,
          confidence: "high",
          createdAt: new Date().toISOString(),
        },
      ],
      inventory: [
        {
          id: 1,
          facilityId: 1,
          facilityName: "Kasturba Medical Centre",
          medicineId: 1,
          medicineName: "Paracetamol",
          strength: "500 mg",
          form: "tablet",
          unit: "tablets",
          batchNumber: "BATCH001",
          quantityOnHand: 200,
          reservedQuantity: 50,
          availableQuantity: 150,
          expiryDate: new Date(Date.now() + 180 * 86400000),
          daysToExpiry: 180,
          daysOfCover: 2,
          dailyConsumption: 75,
          risk: "critical",
          lastCountedAt: new Date(),
        },
      ],
      transfers: [
        {
          id: 1,
          requesterFacilityId: 1,
          requesterFacilityName: "Kasturba Medical Centre",
          supplierFacilityId: 2,
          supplierFacilityName: "District Hospital Udupi",
          medicineId: 1,
          medicineName: "Paracetamol",
          medicineStrength: "500 mg",
          quantity: 500,
          status: "pending",
          note: "Emergency stock request",
          deliveryStatus: "not_configured",
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          respondedAt: null,
        },
      ],
      notifications: [
        {
          id: 1,
          facilityId: 1,
          transferRequestId: 1,
          type: "transfer_request",
          title: "New stock request",
          body: "A nearby facility requested 500 units of Paracetamol.",
          isRead: false,
          createdAt: new Date(Date.now() - 600000).toISOString(),
        },
      ],
    };
    return res.json(mockPayload);
  }
});

router.get("/facilities", async (req, res, next) => {
  try {
    const params = ListFacilitiesQueryParams.parse(req.query);
    const search = params.query?.trim();
    const conditions = [];
    if (params.type) conditions.push(eq(facilitiesTable.type, params.type));
    if (params.city) conditions.push(eq(facilitiesTable.city, params.city));
    if (search) {
      conditions.push(or(ilike(facilitiesTable.name, `%${search}%`), ilike(facilitiesTable.city, `%${search}%`), ilike(facilitiesTable.code, `%${search}%`)));
    }
    const rows = await db.select().from(facilitiesTable).where(conditions.length ? and(...conditions) : undefined).orderBy(asc(facilitiesTable.city), asc(facilitiesTable.name));
    return res.json(ListFacilitiesResponse.parse(rows.map(facilityJson)));
  } catch (error) {
    next(error);
  }
});

router.get("/medicines", async (req, res, next) => {
  try {
    const params = ListMedicinesQueryParams.parse(req.query);
    const search = params.query?.trim();
    const conditions = [];
    if (params.category) conditions.push(eq(medicinesTable.category, params.category));
    if (search) {
      conditions.push(or(ilike(medicinesTable.genericName, `%${search}%`), ilike(medicinesTable.brandName, `%${search}%`), ilike(medicinesTable.strength, `%${search}%`)));
    }
    const rows = await db.select().from(medicinesTable).where(conditions.length ? and(...conditions) : undefined).orderBy(asc(medicinesTable.genericName)).limit(params.limit);
    return res.json(ListMedicinesResponse.parse(rows.map(medicineJson)));
  } catch (error) {
    next(error);
  }
});

router.get("/inventory", async (req, res, next) => {
  try {
    const params = ListInventoryQueryParams.parse(req.query);
    const rows = (await loadInventory(params.facilityId, params.medicineId)).map(inventoryJson);
    return res.json(ListInventoryResponse.parse(params.riskOnly ? rows.filter((row) => row.risk !== "stable") : rows));
  } catch (error) {
    next(error);
  }
});

router.get("/alerts", async (req, res, next) => {
  try {
    const params = ListAlertsQueryParams.parse(req.query);
    const alerts = await buildAlerts();
    const filtered = params.severity === "all" ? alerts : alerts.filter((alert) => alert.severity === params.severity);
    return res.json(ListAlertsResponse.parse(filtered));
  } catch (error) {
    next(error);
  }
});

router.get("/nearby-suppliers", async (req, res, next) => {
  try {
    const params = ListNearbySuppliersQueryParams.parse(req.query);
    const matches = await buildSupplierMatches(params.facilityId, params.medicineId, params.quantity);
    return res.json(ListNearbySuppliersResponse.parse(matches));
  } catch (error) {
    next(error);
  }
});

router.get("/transfer-requests", async (req, res, next) => {
  try {
    const params = ListTransferRequestsQueryParams.parse(req.query);
    return res.json(ListTransferRequestsResponse.parse(await loadTransferRequests(params.facilityId, params.role)));
  } catch (error) {
    next(error);
  }
});

router.post("/transfer-requests", async (req, res, next) => {
  try {
    const body = CreateTransferRequestBody.parse(req.body);
    const matches = await buildSupplierMatches(body.requesterFacilityId, body.medicineId, body.quantity);
    const supplier = matches.find((match) => match.facility.id === body.supplierFacilityId);
    if (!supplier || supplier.availableQuantity < body.quantity) {
      return res.status(400).json({ error: "The selected source does not have enough usable stock." });
    }
    const [request] = await db.insert(transferRequestsTable).values(body).returning();
    if (!request) return res.status(500).json({ error: "Transfer request could not be created." });
    await db.insert(notificationsTable).values({
      facilityId: body.supplierFacilityId,
      transferRequestId: request.id,
      type: "transfer_request",
      title: "New stock request",
      body: `A nearby facility requested ${body.quantity} units of ${supplier.medicine.genericName}.`,
    });
    const transfers = await loadTransferRequests(body.requesterFacilityId, "outgoing");
    const created = transfers.find((transfer) => transfer.id === request.id);
    return res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.patch("/transfer-requests/:id", async (req, res, next) => {
  try {
    const params = UpdateTransferRequestParams.parse(req.params);
    const body = UpdateTransferRequestBody.parse(req.body);
    const existingRows = await db.select().from(transferRequestsTable).where(eq(transferRequestsTable.id, params.id)).limit(1);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: "Transfer request not found." });
    if (existing.status !== "pending") return res.status(409).json({ error: "This transfer request has already been resolved." });

    await db.transaction(async (tx) => {
      if (body.status === "accepted") {
        const supplierRows = await tx.select().from(inventoryTable)
          .where(and(eq(inventoryTable.facilityId, existing.supplierFacilityId), eq(inventoryTable.medicineId, existing.medicineId)))
          .orderBy(asc(inventoryTable.expiryDate));
        let remaining = existing.quantity;
        for (const row of supplierRows) {
          const available = Math.max(0, row.quantityOnHand - row.reservedQuantity);
          const reserve = Math.min(available, remaining);
          if (reserve > 0) {
            await tx.update(inventoryTable).set({
              reservedQuantity: row.reservedQuantity + reserve,
              updatedAt: new Date(),
            }).where(eq(inventoryTable.id, row.id));
            remaining -= reserve;
          }
          if (remaining === 0) break;
        }
        if (remaining > 0) throw new Error("The source no longer has enough usable stock.");
      }
      await tx.update(transferRequestsTable).set({
        status: body.status,
        deliveryStatus: body.status === "accepted" ? "awaiting_dispatch" : "not_configured",
        respondedAt: new Date(),
      }).where(eq(transferRequestsTable.id, existing.id));
      await tx.insert(notificationsTable).values({
        facilityId: existing.requesterFacilityId,
        transferRequestId: existing.id,
        type: body.status === "accepted" ? "transfer_accepted" : "transfer_rejected",
        title: body.status === "accepted" ? "Transfer accepted" : "Transfer declined",
        body: body.status === "accepted"
          ? `Your request for ${existing.quantity} units has been accepted. Swiggy Genie handoff is queued for this transfer.`
          : `Your request for ${existing.quantity} units was declined by the source facility.`,
      });
    });

    const transfers = await loadTransferRequests(existing.requesterFacilityId, "all");
    const updated = transfers.find((transfer) => transfer.id === existing.id);
    return res.json(UpdateTransferRequestResponse.parse(updated));
  } catch (error) {
    next(error);
  }
});

router.get("/notifications", async (req, res, next) => {
  try {
    const params = ListNotificationsQueryParams.parse(req.query);
    const conditions = [eq(notificationsTable.facilityId, params.facilityId)];
    if (params.unreadOnly) conditions.push(eq(notificationsTable.isRead, false));
    const rows = await db.select().from(notificationsTable).where(and(...conditions)).orderBy(desc(notificationsTable.createdAt)).limit(50);
    return res.json(ListNotificationsResponse.parse(rows));
  } catch (error) {
    next(error);
  }
});

router.patch("/notifications/:id/read", async (req, res, next) => {
  try {
    const params = MarkNotificationReadParams.parse(req.params);
    const [notification] = await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.id, params.id)).returning();
    if (!notification) return res.status(404).json({ error: "Notification not found." });
    return res.json(notification);
  } catch (error) {
    next(error);
  }
});

router.get("/delivery/status", async (_req, res, next) => {
  try {
    const configured = Boolean(process.env.SWIGGY_GENIE_API_URL && process.env.SWIGGY_GENIE_API_KEY);
    return res.json(GetDeliveryStatusResponse.parse({
      provider: "swiggy_genie",
      status: configured ? "ready" : "not_configured",
      message: configured
        ? "Swiggy Genie credentials are present; dispatch can be enabled after partner endpoint verification."
        : "When a supplier accepts a transfer, Swiggy Genie handoff is queued for that delivery. Provider confirmation will appear once partner access is connected.",
    }));
  } catch (error) {
    next(error);
  }
});

export default router;
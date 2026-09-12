import { Router, type IRouter } from "express";
import {
  GetDashboardQueryParams,
  GetDashboardResponse,
  ListFacilitiesQueryParams,
  ListFacilitiesResponse,
  ListNotificationsQueryParams,
  ListNotificationsResponse,
  ListTransferRequestsQueryParams,
  ListTransferRequestsResponse,
  UpdateTransferRequestParams,
  UpdateTransferRequestBody,
  UpdateTransferRequestResponse,
  ListNearbySuppliersQueryParams,
  ListNearbySuppliersResponse,
  ListAlertsQueryParams,
  ListAlertsResponse,
  CreateTransferRequestBody,
  ListInventoryQueryParams,
  ListInventoryResponse,
  ListMedicinesQueryParams,
  ListMedicinesResponse,
  MarkNotificationReadParams,
} from "@workspace/api-zod";
import { mockFacilities, mockMedicines, mockInventory, mockTransfers, mockNotifications } from "../lib/mock-data";

const router: IRouter = Router();

// Mock implementations for demo mode
router.get("/dashboard", async (req, res, next) => {
  try {
    const params = GetDashboardQueryParams.parse(req.query);
    const facilityId = params.facilityId;
    
    const facility = mockFacilities.find((f) => f.id === facilityId);
    if (!facility) {
      return res.status(404).json({ error: "Facility not found" });
    }

    const inventory = mockInventory.filter((i) => i.facilityId === facilityId);
    const transfers = mockTransfers.filter(
      (t) => t.requesterFacilityId === facilityId || t.supplierFacilityId === facilityId,
    );
    const notifications = mockNotifications.filter((n) => n.facilityId === facilityId);

    const payload = {
      facility: facility,
      summary: {
        criticalAlerts: 2,
        watchAlerts: 2,
        inventoryLines: inventory.length,
        pendingTransfers: transfers.filter((t) => t.status === "pending").length,
        unreadNotifications: notifications.filter((n) => !n.isRead).length,
      },
      alerts: [
        {
          id: 1,
          facilityId: facilityId,
          facilityName: facility.name,
          medicineId: 2,
          medicineName: "Amoxicillin",
          severity: "critical",
          title: `${facility.name} is under pressure on Amoxicillin`,
          detail: "Amoxicillin has 3 days of cover at current consumption.",
          daysOfCover: 3,
          distanceKm: 0,
          recommendedSupplierId: 2,
          recommendedSupplierName: "District Hospital Udupi",
          recommendedQuantity: 200,
          confidence: "high",
          createdAt: new Date(),
        },
        {
          id: 2,
          facilityId: facilityId,
          facilityName: facility.name,
          medicineId: 3,
          medicineName: "Ceftriaxone",
          severity: "critical",
          title: `${facility.name} has near-expiry Ceftriaxone`,
          detail: "45 units expire in 13 days. Review redistribution before wastage.",
          daysOfCover: 2,
          distanceKm: 42.1,
          recommendedSupplierId: null,
          recommendedSupplierName: null,
          recommendedQuantity: null,
          confidence: "high",
          createdAt: new Date(),
        },
      ],
      inventory: inventory.map((inv) => ({
        ...inv,
        expiryDate: new Date(inv.expiryDate),
        availableQuantity: inv.quantityOnHand - inv.reservedQuantity,
        daysOfCover:
          inv.dailyConsumption > 0
            ? Number(((inv.quantityOnHand - inv.reservedQuantity) / inv.dailyConsumption).toFixed(1))
            : 999,
        risk: (inv.quantityOnHand - inv.reservedQuantity) / inv.dailyConsumption <= 3 ? "critical" : "stable",
      })),
      transfers: transfers.map((t) => ({
        ...t,
        requesterFacilityName: mockFacilities.find((f) => f.id === t.requesterFacilityId)?.name || "Unknown",
        supplierFacilityName: mockFacilities.find((f) => f.id === t.supplierFacilityId)?.name || "Unknown",
        medicineName: mockMedicines.find((m) => m.id === t.medicineId)?.genericName || "Unknown",
        medicineStrength: mockMedicines.find((m) => m.id === t.medicineId)?.strength || "",
      })),
      notifications: notifications,
    };

    return res.json(GetDashboardResponse.parse(payload));
  } catch (error) {
    next(error);
  }
});

router.get("/facilities", async (req, res, next) => {
  try {
    const params = ListFacilitiesQueryParams.parse(req.query);
    const search = params.query?.toLowerCase();

    let filtered = mockFacilities;
    if (params.type) filtered = filtered.filter((f) => f.type === params.type);
    if (params.city) filtered = filtered.filter((f) => f.city.toLowerCase() === params.city.toLowerCase());
    if (search) {
      filtered = filtered.filter(
        (f) =>
          f.name.toLowerCase().includes(search) ||
          f.city.toLowerCase().includes(search) ||
          f.code.toLowerCase().includes(search),
      );
    }

    return res.json(ListFacilitiesResponse.parse(filtered));
  } catch (error) {
    next(error);
  }
});

router.get("/medicines", async (req, res, next) => {
  try {
    const params = ListMedicinesQueryParams.parse(req.query);
    const search = params.query?.toLowerCase();

    let filtered = mockMedicines;
    if (params.category) filtered = filtered.filter((m) => m.category === params.category);
    if (search) {
      filtered = filtered.filter(
        (m) =>
          m.genericName.toLowerCase().includes(search) ||
          m.brandName.toLowerCase().includes(search) ||
          m.strength.toLowerCase().includes(search),
      );
    }

    return res.json(ListMedicinesResponse.parse(filtered.slice(0, params.limit)));
  } catch (error) {
    next(error);
  }
});

router.get("/inventory", async (req, res, next) => {
  try {
    const params = ListInventoryQueryParams.parse(req.query);
    let inventory = mockInventory.filter((i) => !params.facilityId || i.facilityId === params.facilityId);
    if (params.medicineId) inventory = inventory.filter((i) => i.medicineId === params.medicineId);

    const mapped = inventory.map((inv) => ({
      ...inv,
      expiryDate: new Date(inv.expiryDate),
      availableQuantity: inv.quantityOnHand - inv.reservedQuantity,
      daysOfCover:
        inv.dailyConsumption > 0
          ? Number(((inv.quantityOnHand - inv.reservedQuantity) / inv.dailyConsumption).toFixed(1))
          : 999,
      risk: (inv.quantityOnHand - inv.reservedQuantity) / inv.dailyConsumption <= 3 ? "critical" : "stable",
    }));

    return res.json(
      ListInventoryResponse.parse(params.riskOnly ? mapped.filter((r) => r.risk !== "stable") : mapped),
    );
  } catch (error) {
    next(error);
  }
});

router.get("/alerts", async (req, res, next) => {
  try {
    const params = ListAlertsQueryParams.parse(req.query);
    const alerts = [
      {
        id: 1,
        facilityId: 1,
        facilityName: "Kasturba Medical Centre",
        medicineId: 2,
        medicineName: "Amoxicillin",
        severity: "critical" as const,
        title: "KMC is under pressure on Amoxicillin",
        detail: "Amoxicillin has 3 days of cover at current consumption.",
        daysOfCover: 3,
        distanceKm: 0,
        recommendedSupplierId: 2,
        recommendedSupplierName: "District Hospital Udupi",
        recommendedQuantity: 200,
        confidence: "high" as const,
        createdAt: new Date(),
      },
    ];

    const filtered = params.severity === "all" ? alerts : alerts.filter((a) => a.severity === params.severity);
    return res.json(ListAlertsResponse.parse(filtered));
  } catch (error) {
    next(error);
  }
});

router.get("/nearby-suppliers", async (req, res, next) => {
  try {
    const params = ListNearbySuppliersQueryParams.parse(req.query);
    const requester = mockFacilities.find((f) => f.id === params.facilityId);
    if (!requester) return res.status(404).json({ error: "Facility not found" });

    const matches = mockFacilities
      .filter((f) => f.id !== params.facilityId && f.isActive)
      .slice(0, 3)
      .map((f, i) => ({
        facility: f,
        medicine: mockMedicines.find((m) => m.id === params.medicineId) || mockMedicines[0],
        availableQuantity: 500 + i * 300,
        surplusQuantity: 200 + i * 100,
        nearestExpiryDate: new Date(),
        daysToExpiry: 60 - i * 10,
        distanceKm: 5 + i * 8,
        estimatedMinutes: 15 + i * 10,
        matchScore: Number((0.9 - i * 0.2).toFixed(3)),
        recommendation: (["recommended", "good", "fallback"] as const)[i],
      }));

    return res.json(ListNearbySuppliersResponse.parse(matches));
  } catch (error) {
    next(error);
  }
});

router.get("/transfer-requests", async (req, res, next) => {
  try {
    const params = ListTransferRequestsQueryParams.parse(req.query);
    let transfers = mockTransfers;

    if (params.role === "incoming") {
      transfers = transfers.filter((t) => t.supplierFacilityId === params.facilityId);
    } else if (params.role === "outgoing") {
      transfers = transfers.filter((t) => t.requesterFacilityId === params.facilityId);
    }

    const mapped = transfers.map((t) => ({
      ...t,
      requesterFacilityName: mockFacilities.find((f) => f.id === t.requesterFacilityId)?.name || "Unknown",
      supplierFacilityName: mockFacilities.find((f) => f.id === t.supplierFacilityId)?.name || "Unknown",
      medicineName: mockMedicines.find((m) => m.id === t.medicineId)?.genericName || "Unknown",
      medicineStrength: mockMedicines.find((m) => m.id === t.medicineId)?.strength || "",
    }));

    return res.json(ListTransferRequestsResponse.parse(mapped));
  } catch (error) {
    next(error);
  }
});

router.post("/transfer-requests", async (req, res, next) => {
  try {
    const body = CreateTransferRequestBody.parse(req.body);
    const supplier = mockFacilities.find((f) => f.id === body.supplierFacilityId);
    if (!supplier) return res.status(400).json({ error: "Invalid supplier facility" });

    const newTransfer = {
      id: mockTransfers.length + 1,
      ...body,
      status: "pending" as const,
      deliveryStatus: "not_configured" as const,
      createdAt: new Date().toISOString(),
      respondedAt: null,
      updatedAt: new Date().toISOString(),
    };

    mockTransfers.push(newTransfer);

    return res.status(201).json(
      UpdateTransferRequestResponse.parse({
        ...newTransfer,
        requesterFacilityName: mockFacilities.find((f) => f.id === newTransfer.requesterFacilityId)?.name || "Unknown",
        supplierFacilityName: supplier.name,
        medicineName: mockMedicines.find((m) => m.id === newTransfer.medicineId)?.genericName || "Unknown",
        medicineStrength: mockMedicines.find((m) => m.id === newTransfer.medicineId)?.strength || "",
      }),
    );
  } catch (error) {
    next(error);
  }
});

router.patch("/transfer-requests/:id", async (req, res, next) => {
  try {
    const params = UpdateTransferRequestParams.parse(req.params);
    const body = UpdateTransferRequestBody.parse(req.body);

    const transferIdx = mockTransfers.findIndex((t) => t.id === params.id);
    if (transferIdx === -1) return res.status(404).json({ error: "Transfer not found" });

    const transfer = mockTransfers[transferIdx];
    if (transfer.status !== "pending") return res.status(409).json({ error: "Transfer already resolved" });

    mockTransfers[transferIdx] = {
      ...transfer,
      status: body.status,
      deliveryStatus: body.status === "accepted" ? "awaiting_dispatch" : "not_configured",
      respondedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return res.json(
      UpdateTransferRequestResponse.parse({
        ...mockTransfers[transferIdx],
        requesterFacilityName:
          mockFacilities.find((f) => f.id === mockTransfers[transferIdx].requesterFacilityId)?.name || "Unknown",
        supplierFacilityName:
          mockFacilities.find((f) => f.id === mockTransfers[transferIdx].supplierFacilityId)?.name || "Unknown",
        medicineName:
          mockMedicines.find((m) => m.id === mockTransfers[transferIdx].medicineId)?.genericName || "Unknown",
        medicineStrength:
          mockMedicines.find((m) => m.id === mockTransfers[transferIdx].medicineId)?.strength || "",
      }),
    );
  } catch (error) {
    next(error);
  }
});

router.get("/notifications", async (req, res, next) => {
  try {
    const params = ListNotificationsQueryParams.parse(req.query);
    let notifications = mockNotifications.filter((n) => n.facilityId === params.facilityId);

    if (params.unreadOnly) {
      notifications = notifications.filter((n) => !n.isRead);
    }

    return res.json(ListNotificationsResponse.parse(notifications.slice(0, 50)));
  } catch (error) {
    next(error);
  }
});

router.patch("/notifications/:id/read", async (req, res, next) => {
  try {
    const params = MarkNotificationReadParams.parse(req.params);
    const notifIdx = mockNotifications.findIndex((n) => n.id === params.id);

    if (notifIdx === -1) return res.status(404).json({ error: "Notification not found" });

    mockNotifications[notifIdx].isRead = true;
    return res.json(mockNotifications[notifIdx]);
  } catch (error) {
    next(error);
  }
});

router.get("/delivery/status", async (_req, res) => {
  return res.json({
    provider: "swiggy_genie",
    status: "ready",
    message: "Swiggy Genie integration is ready. When a supplier accepts a transfer, delivery tracking will be live.",
  });
});

export default router;

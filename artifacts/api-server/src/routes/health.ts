import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// Mock data for demo mode
const MOCK_DATA = {
  facilities: [
    { id: 1, code: "KMC-MAN", name: "Kasturba Medical Centre", type: "hospital", city: "Manipal", district: "Udupi", address: "Tiger Circle, Manipal", latitude: 13.3525, longitude: 74.7927, contactName: "Anitha Rao", contactPhone: "+91 820 292 1181", isActive: true, lastSyncAt: new Date().toISOString() },
    { id: 2, code: "DH-UDP", name: "District Hospital Udupi", type: "hospital", city: "Udupi", district: "Udupi", address: "Ajjarkad, Udupi", latitude: 13.3419, longitude: 74.7517, contactName: "Ramesh Bhat", contactPhone: "+91 820 252 0555", isActive: true, lastSyncAt: new Date().toISOString() },
    { id: 3, code: "WEN-MNG", name: "Government Wenlock Hospital", type: "hospital", city: "Mangalore", district: "Dakshina Kannada", address: "Hampankatta, Mangalore", latitude: 12.8698, longitude: 74.8426, contactName: "Shalini Shetty", contactPhone: "+91 824 242 1404", isActive: true, lastSyncAt: new Date().toISOString() },
  ],
  alerts: [
    { id: 1, facilityId: 1, facilityName: "Kasturba Medical Centre", medicineId: 1, medicineName: "Paracetamol", severity: "critical", title: "Critical stock shortage of Paracetamol", detail: "Only 2 days of cover remaining. Urgent redistribution needed.", daysOfCover: 2, distanceKm: 15.3, recommendedSupplierId: 2, recommendedSupplierName: "District Hospital Udupi", recommendedQuantity: 500, confidence: "high", createdAt: new Date().toISOString() },
    { id: 2, facilityId: 1, facilityName: "Kasturba Medical Centre", medicineId: 5, medicineName: "Azithromycin", severity: "high", title: "Azithromycin stock at high alert", detail: "6 days of cover at current consumption rate.", daysOfCover: 6, distanceKm: 45.2, recommendedSupplierId: 3, recommendedSupplierName: "Government Wenlock Hospital", recommendedQuantity: 300, confidence: "high", createdAt: new Date().toISOString() },
    { id: 3, facilityId: 2, facilityName: "District Hospital Udupi", medicineId: 12, medicineName: "Budesonide", severity: "watch", title: "Budesonide requires monitoring", detail: "12 days of cover. Monitor usage patterns.", daysOfCover: 12, distanceKm: 28.5, recommendedSupplierId: 1, recommendedSupplierName: "Kasturba Medical Centre", recommendedQuantity: 200, confidence: "medium", createdAt: new Date().toISOString() },
  ],
  transfers: [
    { id: 1, requesterFacilityId: 1, requesterFacilityName: "Kasturba Medical Centre", supplierFacilityId: 2, supplierFacilityName: "District Hospital Udupi", medicineId: 1, medicineName: "Paracetamol", medicineStrength: "500 mg", quantity: 500, status: "pending", note: "Emergency stock request", deliveryStatus: "not_configured", createdAt: new Date(Date.now() - 3600000).toISOString(), respondedAt: null },
    { id: 2, requesterFacilityId: 2, requesterFacilityName: "District Hospital Udupi", supplierFacilityId: 3, supplierFacilityName: "Government Wenlock Hospital", medicineId: 5, medicineName: "Azithromycin", medicineStrength: "500 mg", quantity: 300, status: "accepted", note: "Regular replenishment", deliveryStatus: "awaiting_dispatch", createdAt: new Date(Date.now() - 7200000).toISOString(), respondedAt: new Date(Date.now() - 1800000).toISOString() },
  ],
  notifications: [
    { id: 1, facilityId: 1, transferRequestId: 1, type: "transfer_request", title: "New stock request", body: "A nearby facility requested 500 units of Paracetamol.", isRead: false, createdAt: new Date(Date.now() - 600000).toISOString() },
    { id: 2, facilityId: 2, transferRequestId: 2, type: "transfer_accepted", title: "Transfer accepted", body: "Your request for 300 units has been accepted. Swiggy Genie handoff is queued.", isRead: false, createdAt: new Date(Date.now() - 1800000).toISOString() },
  ],
};

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Provide mock data for demo
router.get("/mock-data", (_req, res) => {
  res.json(MOCK_DATA);
});

export default router;

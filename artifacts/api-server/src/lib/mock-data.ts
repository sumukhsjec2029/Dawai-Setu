// Mock data for demo/testing without database

export const mockFacilities = [
  { id: 1, code: "KMC-MAN", name: "Kasturba Medical Centre", type: "hospital", city: "Manipal", district: "Udupi", address: "Tiger Circle, Manipal", latitude: 13.3525, longitude: 74.7927, contactName: "Anitha Rao", contactPhone: "+91 820 292 1181", isActive: true, lastSyncAt: new Date().toISOString() },
  { id: 2, code: "DH-UDP", name: "District Hospital Udupi", type: "hospital", city: "Udupi", district: "Udupi", address: "Ajjarkad, Udupi", latitude: 13.3419, longitude: 74.7517, contactName: "Ramesh Bhat", contactPhone: "+91 820 252 0555", isActive: true, lastSyncAt: new Date().toISOString() },
  { id: 3, code: "WEN-MNG", name: "Government Wenlock Hospital", type: "hospital", city: "Mangalore", district: "Dakshina Kannada", address: "Hampankatta, Mangalore", latitude: 12.8698, longitude: 74.8426, contactName: "Shalini Shetty", contactPhone: "+91 824 242 1404", isActive: true, lastSyncAt: new Date().toISOString() },
];

export const mockMedicines = [
  { id: 1, genericName: "Paracetamol", brandName: "Calpol", strength: "500 mg", form: "tablet", unit: "tablets", category: "Analgesic", reorderLevel: 500 },
  { id: 2, genericName: "Amoxicillin", brandName: "Moxikind", strength: "500 mg", form: "tablet", unit: "tablets", category: "Antibiotic", reorderLevel: 240 },
  { id: 3, genericName: "Ceftriaxone", brandName: "Monocef", strength: "1 g", form: "injection", unit: "vials", category: "Antibiotic", reorderLevel: 120 },
  { id: 4, genericName: "Azithromycin", brandName: "Azithral", strength: "500 mg", form: "tablet", unit: "tablets", category: "Antibiotic", reorderLevel: 120 },
  { id: 5, genericName: "Insulin glargine", brandName: "Lantus", strength: "100 units/ml", form: "injection", unit: "pens", category: "Endocrine", reorderLevel: 80 },
];

export const mockInventory = [
  // Facility 1 - Critical alerts
  { id: 1, facilityId: 1, medicineId: 1, quantityOnHand: 150, reservedQuantity: 50, dailyConsumption: 45, expiryDate: "2026-12-15", batchNumber: "BTH001", lastCountedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 2, facilityId: 1, medicineId: 2, quantityOnHand: 80, reservedQuantity: 0, dailyConsumption: 12, expiryDate: "2026-10-01", batchNumber: "BTH002", lastCountedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 3, facilityId: 1, medicineId: 3, quantityOnHand: 45, reservedQuantity: 20, dailyConsumption: 18, expiryDate: "2026-09-25", batchNumber: "BTH003", lastCountedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  
  // Facility 2 - Surplus stock
  { id: 4, facilityId: 2, medicineId: 1, quantityOnHand: 2000, reservedQuantity: 100, dailyConsumption: 30, expiryDate: "2026-11-30", batchNumber: "BTH004", lastCountedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 5, facilityId: 2, medicineId: 2, quantityOnHand: 1500, reservedQuantity: 200, dailyConsumption: 25, expiryDate: "2026-12-10", batchNumber: "BTH005", lastCountedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  
  // Facility 3 - Mixed stock
  { id: 6, facilityId: 3, medicineId: 4, quantityOnHand: 600, reservedQuantity: 50, dailyConsumption: 40, expiryDate: "2026-10-20", batchNumber: "BTH006", lastCountedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

export const mockTransfers = [
  { id: 1, requesterFacilityId: 1, supplierFacilityId: 2, medicineId: 1, quantity: 500, status: "pending" as const, note: "Critical shortage", deliveryStatus: "not_configured" as const, createdAt: new Date(Date.now() - 3600000).toISOString(), respondedAt: null, updatedAt: new Date().toISOString() },
  { id: 2, requesterFacilityId: 1, supplierFacilityId: 3, medicineId: 2, quantity: 200, status: "pending" as const, note: "Low stock alert", deliveryStatus: "not_configured" as const, createdAt: new Date(Date.now() - 7200000).toISOString(), respondedAt: null, updatedAt: new Date().toISOString() },
  { id: 3, requesterFacilityId: 3, supplierFacilityId: 2, medicineId: 1, quantity: 300, status: "accepted" as const, note: "Emergency request", deliveryStatus: "awaiting_dispatch" as const, createdAt: new Date(Date.now() - 14400000).toISOString(), respondedAt: new Date(Date.now() - 10800000).toISOString(), updatedAt: new Date().toISOString() },
];

export const mockNotifications = [
  { id: 1, facilityId: 1, transferRequestId: 1, type: "transfer_request" as const, title: "New stock request", body: "District Hospital Udupi requested 500 units of Paracetamol", isRead: false, createdAt: new Date(Date.now() - 1800000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 2, facilityId: 1, transferRequestId: 2, type: "transfer_request" as const, title: "Stock request received", body: "Government Wenlock Hospital requested 200 units of Amoxicillin", isRead: false, createdAt: new Date(Date.now() - 3600000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 3, facilityId: 2, transferRequestId: 3, type: "transfer_accepted" as const, title: "Transfer accepted", body: "Your request for 300 units has been accepted. Swiggy Genie handoff is queued.", isRead: true, createdAt: new Date(Date.now() - 10800000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 4, facilityId: 1, transferRequestId: null, type: "inventory_alert" as const, title: "Critical alert: Ceftriaxone", body: "Stock level critically low - only 3 days of cover at current consumption", isRead: false, createdAt: new Date(Date.now() - 600000).toISOString(), updatedAt: new Date().toISOString() },
];

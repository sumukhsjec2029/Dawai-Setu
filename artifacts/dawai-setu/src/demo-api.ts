type DemoRecord = Record<string, unknown>;

const facilities = [
  { id: 1, code: 'KMC-MAN', name: 'Kasturba Medical Centre', type: 'hospital', city: 'Manipal', district: 'Udupi', address: 'Tiger Circle, Manipal', latitude: 13.3525, longitude: 74.7927, contactName: 'Anitha Rao', contactPhone: '+91 820 292 1181', isActive: true, lastSyncAt: new Date().toISOString() },
  { id: 2, code: 'DH-UDP', name: 'District Hospital Udupi', type: 'hospital', city: 'Udupi', district: 'Udupi', address: 'Ajjarkad, Udupi', latitude: 13.3419, longitude: 74.7517, contactName: 'Ramesh Bhat', contactPhone: '+91 820 252 0555', isActive: true, lastSyncAt: new Date().toISOString() },
  { id: 3, code: 'WEN-MNG', name: 'Government Wenlock Hospital', type: 'hospital', city: 'Mangalore', district: 'Dakshina Kannada', address: 'Hampankatta, Mangalore', latitude: 12.8698, longitude: 74.8426, contactName: 'Shalini Shetty', contactPhone: '+91 824 242 1404', isActive: true, lastSyncAt: new Date().toISOString() },
];

const medicines = [
  { id: 1, genericName: 'Paracetamol', brandName: 'Calpol', strength: '500 mg', form: 'tablet', unit: 'tablets', category: 'Analgesic', reorderLevel: 500 },
  { id: 2, genericName: 'Amoxicillin', brandName: 'Moxikind', strength: '500 mg', form: 'tablet', unit: 'tablets', category: 'Antibiotic', reorderLevel: 240 },
  { id: 3, genericName: 'Ceftriaxone', brandName: 'Monocef', strength: '1 g', form: 'injection', unit: 'vials', category: 'Antibiotic', reorderLevel: 120 },
  { id: 4, genericName: 'Azithromycin', brandName: 'Azithral', strength: '500 mg', form: 'tablet', unit: 'tablets', category: 'Antibiotic', reorderLevel: 120 },
];

const inventory = [
  { id: 1, facilityId: 1, facilityName: facilities[0].name, medicineId: 1, medicineName: 'Paracetamol', strength: '500 mg', form: 'tablet', unit: 'tablets', batchNumber: 'BTH001', quantityOnHand: 150, reservedQuantity: 50, availableQuantity: 100, expiryDate: '2026-12-15T00:00:00.000Z', daysToExpiry: 94, daysOfCover: 2.2, dailyConsumption: 45, risk: 'critical', lastCountedAt: new Date().toISOString() },
  { id: 2, facilityId: 1, facilityName: facilities[0].name, medicineId: 2, medicineName: 'Amoxicillin', strength: '500 mg', form: 'tablet', unit: 'tablets', batchNumber: 'BTH002', quantityOnHand: 80, reservedQuantity: 0, availableQuantity: 80, expiryDate: '2026-10-01T00:00:00.000Z', daysToExpiry: 19, daysOfCover: 6.7, dailyConsumption: 12, risk: 'high', lastCountedAt: new Date().toISOString() },
  { id: 3, facilityId: 1, facilityName: facilities[0].name, medicineId: 3, medicineName: 'Ceftriaxone', strength: '1 g', form: 'injection', unit: 'vials', batchNumber: 'BTH003', quantityOnHand: 45, reservedQuantity: 20, availableQuantity: 25, expiryDate: '2026-09-25T00:00:00.000Z', daysToExpiry: 13, daysOfCover: 1.4, dailyConsumption: 18, risk: 'critical', lastCountedAt: new Date().toISOString() },
  { id: 4, facilityId: 2, facilityName: facilities[1].name, medicineId: 1, medicineName: 'Paracetamol', strength: '500 mg', form: 'tablet', unit: 'tablets', batchNumber: 'BTH004', quantityOnHand: 2000, reservedQuantity: 100, availableQuantity: 1900, expiryDate: '2026-11-30T00:00:00.000Z', daysToExpiry: 79, daysOfCover: 63.3, dailyConsumption: 30, risk: 'stable', lastCountedAt: new Date().toISOString() },
  { id: 5, facilityId: 2, facilityName: facilities[1].name, medicineId: 2, medicineName: 'Amoxicillin', strength: '500 mg', form: 'tablet', unit: 'tablets', batchNumber: 'BTH005', quantityOnHand: 1500, reservedQuantity: 200, availableQuantity: 1300, expiryDate: '2026-12-10T00:00:00.000Z', daysToExpiry: 89, daysOfCover: 52, dailyConsumption: 25, risk: 'stable', lastCountedAt: new Date().toISOString() },
  { id: 6, facilityId: 3, facilityName: facilities[2].name, medicineId: 4, medicineName: 'Azithromycin', strength: '500 mg', form: 'tablet', unit: 'tablets', batchNumber: 'BTH006', quantityOnHand: 600, reservedQuantity: 50, availableQuantity: 550, expiryDate: '2026-10-20T00:00:00.000Z', daysToExpiry: 38, daysOfCover: 13.8, dailyConsumption: 40, risk: 'watch', lastCountedAt: new Date().toISOString() },
];

let transfers: DemoRecord[] = [
  { id: 1, requesterFacilityId: 1, requesterFacilityName: facilities[0].name, supplierFacilityId: 2, supplierFacilityName: facilities[1].name, medicineId: 1, medicineName: 'Paracetamol', medicineStrength: '500 mg', quantity: 500, status: 'pending', note: 'Critical shortage', deliveryStatus: 'not_configured', createdAt: new Date(Date.now() - 3600000).toISOString(), respondedAt: null },
  { id: 2, requesterFacilityId: 1, requesterFacilityName: facilities[0].name, supplierFacilityId: 3, supplierFacilityName: facilities[2].name, medicineId: 2, medicineName: 'Amoxicillin', medicineStrength: '500 mg', quantity: 200, status: 'pending', note: 'Low stock alert', deliveryStatus: 'not_configured', createdAt: new Date(Date.now() - 7200000).toISOString(), respondedAt: null },
  { id: 3, requesterFacilityId: 3, requesterFacilityName: facilities[2].name, supplierFacilityId: 2, supplierFacilityName: facilities[1].name, medicineId: 1, medicineName: 'Paracetamol', medicineStrength: '500 mg', quantity: 300, status: 'accepted', deliveryStatus: 'awaiting_dispatch', createdAt: new Date(Date.now() - 14400000).toISOString(), respondedAt: new Date(Date.now() - 10800000).toISOString() },
];

let notifications: DemoRecord[] = [
  { id: 1, facilityId: 1, transferRequestId: 1, type: 'transfer_request', title: 'New stock request', body: 'District Hospital Udupi requested 500 units of Paracetamol', isRead: false, createdAt: new Date(Date.now() - 1800000).toISOString() },
  { id: 2, facilityId: 1, transferRequestId: 2, type: 'transfer_request', title: 'Stock request received', body: 'Government Wenlock Hospital requested 200 units of Amoxicillin', isRead: false, createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 3, facilityId: 1, transferRequestId: null, type: 'inventory_alert', title: 'Critical alert: Ceftriaxone', body: 'Stock level critically low - only 3 days of cover at current consumption', isRead: false, createdAt: new Date(Date.now() - 600000).toISOString() },
];

const alerts = inventory.filter((row) => row.risk !== 'stable').map((row) => ({
  id: row.id, facilityId: row.facilityId, facilityName: row.facilityName, medicineId: row.medicineId, medicineName: row.medicineName, severity: row.risk === 'critical' ? 'critical' : row.risk === 'high' ? 'high' : 'watch', title: row.daysToExpiry <= 30 ? `${row.facilityName} has near-expiry ${row.medicineName}` : `${row.facilityName} is under pressure on ${row.medicineName}`, detail: `${row.availableQuantity} ${row.unit} available with ${row.daysOfCover} days of cover.`, daysOfCover: row.daysOfCover, distanceKm: 0, recommendedSupplierId: row.facilityId === 1 ? 2 : null, recommendedSupplierName: row.facilityId === 1 ? facilities[1].name : null, recommendedQuantity: 200, confidence: 'high', createdAt: new Date().toISOString(),
}));

function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }); }
function query(url: URL, key: string) { return url.searchParams.get(key); }
function transferJson(transfer: DemoRecord) { return transfer; }

export function installDemoApi() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(rawUrl, window.location.origin);
    if (!url.pathname.startsWith('/api/')) return originalFetch(input, init);
    const method = (init?.method || (typeof input !== 'string' && !(input instanceof URL) ? input.method : 'GET')).toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (url.pathname === '/api/healthz') return json({ status: 'ok' });
    if (url.pathname === '/api/dashboard') return json({ facility: facilities[0], summary: { criticalAlerts: 2, watchAlerts: 2, inventoryLines: 3, pendingTransfers: 2, unreadNotifications: notifications.filter((item) => !item.isRead).length }, alerts, inventory: inventory.filter((item) => item.facilityId === 1), transfers: transfers.filter((item) => item.requesterFacilityId === 1 || item.supplierFacilityId === 1), notifications: notifications.filter((item) => item.facilityId === 1) });
    if (url.pathname === '/api/facilities') return json(facilities);
    if (url.pathname === '/api/medicines') return json(medicines);
    if (url.pathname === '/api/inventory') return json(query(url, 'facilityId') ? inventory.filter((item) => item.facilityId === Number(query(url, 'facilityId'))) : inventory);
    if (url.pathname === '/api/alerts') return json(alerts);
    if (url.pathname === '/api/transfer-requests' && method === 'GET') return json(transfers);
    if (url.pathname === '/api/transfer-requests' && method === 'POST') { const created = { id: transfers.length + 1, ...body, status: 'pending', deliveryStatus: 'not_configured', createdAt: new Date().toISOString(), respondedAt: null }; transfers = [created, ...transfers]; return json(created, 201); }
    if (url.pathname.startsWith('/api/transfer-requests/') && method === 'PATCH') { const id = Number(url.pathname.split('/').pop()); transfers = transfers.map((item) => item.id === id ? { ...item, status: body.status, deliveryStatus: body.status === 'accepted' ? 'awaiting_dispatch' : 'not_configured', respondedAt: new Date().toISOString() } : item); return json(transfers.find((item) => item.id === id)); }
    if (url.pathname === '/api/notifications' && method === 'GET') return json(notifications.filter((item) => item.facilityId === 1 && (query(url, 'unreadOnly') !== 'true' || !item.isRead)));
    if (url.pathname.startsWith('/api/notifications/') && method === 'PATCH') { const id = Number(url.pathname.split('/')[3]); notifications = notifications.map((item) => item.id === id ? { ...item, isRead: true } : item); return json(notifications.find((item) => item.id === id)); }
    if (url.pathname === '/api/nearby-suppliers') return json(inventory.filter((item) => item.facilityId !== 1 && item.availableQuantity > 0).map((item) => ({ facility: facilities.find((facility) => facility.id === item.facilityId), medicine: medicines.find((medicine) => medicine.id === item.medicineId), availableQuantity: item.availableQuantity, surplusQuantity: Math.max(0, item.availableQuantity - 500), nearestExpiryDate: item.expiryDate, daysToExpiry: item.daysToExpiry, distanceKm: item.facilityId === 2 ? 7.2 : 43.8, estimatedMinutes: item.facilityId === 2 ? 28 : 126, matchScore: item.facilityId === 2 ? 0.92 : 0.61, recommendation: item.facilityId === 2 ? 'recommended' : 'good' })));
    if (url.pathname === '/api/blood-bank') return json([]);
    if (url.pathname === '/api/delivery/status') return json({ provider: 'swiggy_genie', status: 'not_configured', message: 'Demo mode: delivery handoff is queued after transfer acceptance.' });
    return json({ error: 'Demo endpoint not found' }, 404);
  };
}

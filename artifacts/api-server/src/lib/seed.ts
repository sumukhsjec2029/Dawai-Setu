import { db, facilitiesTable, inventoryTable, medicinesTable, notificationsTable, transferRequestsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

const facilities = [
  ["KMC-MAN", "Kasturba Medical Centre", "hospital", "Manipal", "Udupi", "Tiger Circle, Manipal", 13.3525, 74.7927, "Anitha Rao", "+91 820 292 1181"],
  ["DH-UDP", "District Hospital Udupi", "hospital", "Udupi", "Udupi", "Ajjarkad, Udupi", 13.3419, 74.7517, "Ramesh Bhat", "+91 820 252 0555"],
  ["WEN-MNG", "Government Wenlock Hospital", "hospital", "Mangalore", "Dakshina Kannada", "Hampankatta, Mangalore", 12.8698, 74.8426, "Shalini Shetty", "+91 824 242 1404"],
  ["COAST-UDP", "Coastal Care Hospital", "hospital", "Udupi", "Udupi", "Kinnimulki, Udupi", 13.3293, 74.7466, "Joseph D'Souza", "+91 820 252 7788"],
  ["CITY-MAN", "CityCare Multispecialty", "hospital", "Manipal", "Udupi", "Madhav Nagar, Manipal", 13.3473, 74.7864, "Meera Pai", "+91 820 292 4010"],
  ["STMARY-MNG", "St. Mary's Community Hospital", "hospital", "Mangalore", "Dakshina Kannada", "Bejai, Mangalore", 12.8994, 74.8421, "Vivek Kumar", "+91 824 221 9088"],
  ["MEDPLUS-MAN", "MedPlus Pharmacy Manipal", "pharmacy", "Manipal", "Udupi", "Eshwar Nagar, Manipal", 13.3501, 74.7851, "Kiran Nayak", "+91 820 292 6077"],
  ["COAST-DIST", "Coastal Med Distributors", "distributor", "Mangalore", "Dakshina Kannada", "Baikampady Industrial Area", 12.9298, 74.8452, "Faizal Ahmed", "+91 824 240 7722"],
  ["ARO-GROC", "Arogya Pharmacy Udupi", "pharmacy", "Udupi", "Udupi", "Brahmagiri, Udupi", 13.3375, 74.7473, "Nandini Hegde", "+91 820 252 3388"],
] as const;

const medicines = [
  ["Paracetamol", "Calpol", "500 mg", "tablet", "tablets", "Analgesic", 500],
  ["Amoxicillin", "Moxikind-CV", "500 mg + 125 mg", "tablet", "tablets", "Antibiotic", 240],
  ["Amoxicillin", "Moxikind", "250 mg / 5 ml", "suspension", "bottles", "Antibiotic", 120],
  ["Ceftriaxone", "Monocef", "1 g", "injection", "vials", "Antibiotic", 120],
  ["Azithromycin", "Azithral", "500 mg", "tablet", "tablets", "Antibiotic", 120],
  ["Metronidazole", "Metrogyl", "500 mg / 100 ml", "infusion", "bags", "Antibiotic", 80],
  ["Doxycycline", "Doxy-1", "100 mg", "capsule", "capsules", "Antibiotic", 100],
  ["Ciprofloxacin", "Cifran", "500 mg", "tablet", "tablets", "Antibiotic", 100],
  ["Insulin glargine", "Lantus", "100 units / ml", "injection", "pens", "Endocrine", 80],
  ["Human insulin", "Actrapid", "40 IU / ml", "injection", "vials", "Endocrine", 80],
  ["Salbutamol", "Asthalin", "100 mcg", "inhaler", "inhalers", "Respiratory", 60],
  ["Budesonide", "Budecort", "0.5 mg / 2 ml", "respules", "respules", "Respiratory", 60],
  ["Ipratropium", "Ipravent", "0.5 mg / 2 ml", "respules", "respules", "Respiratory", 60],
  ["ORS", "Electral", "WHO formula", "sachet", "sachets", "Rehydration", 400],
  ["Ringer's lactate", "RL", "500 ml", "infusion", "bags", "Fluids", 120],
  ["Normal saline", "NS", "500 ml", "infusion", "bags", "Fluids", 120],
  ["Dextrose", "DNS", "5% / 500 ml", "infusion", "bags", "Fluids", 80],
  ["Oxytocin", "Syntocinon", "10 IU / ml", "injection", "ampoules", "Maternal health", 100],
  ["Magnesium sulfate", "MgSO4", "50%", "injection", "ampoules", "Maternal health", 80],
  ["Misoprostol", "Cytolog", "200 mcg", "tablet", "tablets", "Maternal health", 100],
  ["Amlodipine", "Amlong", "5 mg", "tablet", "tablets", "Cardiovascular", 200],
  ["Losartan", "Losar", "50 mg", "tablet", "tablets", "Cardiovascular", 160],
  ["Atorvastatin", "Atorva", "20 mg", "tablet", "tablets", "Cardiovascular", 160],
  ["Aspirin", "Ecosprin", "75 mg", "tablet", "tablets", "Cardiovascular", 200],
  ["Furosemide", "Lasix", "40 mg", "tablet", "tablets", "Cardiovascular", 120],
  ["Omeprazole", "Omez", "20 mg", "capsule", "capsules", "Gastrointestinal", 180],
  ["Ondansetron", "Ondem", "4 mg", "tablet", "tablets", "Gastrointestinal", 100],
  ["Pantoprazole", "Pantocid", "40 mg", "injection", "vials", "Gastrointestinal", 100],
  ["Diclofenac", "Voveran", "50 mg", "tablet", "tablets", "Analgesic", 120],
  ["Ibuprofen", "Brufen", "400 mg", "tablet", "tablets", "Analgesic", 140],
  ["Tramadol", "Contramal", "50 mg / ml", "injection", "ampoules", "Analgesic", 60],
  ["Heparin", "Heparin", "5,000 IU / ml", "injection", "vials", "Critical care", 50],
  ["Enoxaparin", "Clexane", "40 mg", "injection", "syringes", "Critical care", 60],
  ["Adrenaline", "Adrenaline", "1 mg / ml", "injection", "ampoules", "Critical care", 60],
  ["Dexamethasone", "Dexona", "4 mg / ml", "injection", "ampoules", "Critical care", 60],
  ["Povidone iodine", "Betadine", "10%", "solution", "bottles", "Wound care", 80],
  ["Chlorhexidine", "Cetrimide", "5%", "solution", "bottles", "Wound care", 60],
] as const;

const dateAfter = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

export async function ensureSeedData() {
  const existingFacilities = await db.select({ id: facilitiesTable.id }).from(facilitiesTable).limit(1);
  if (existingFacilities.length > 0) return;

  await db.insert(facilitiesTable).values(
    facilities.map((facility, index) => ({
      code: facility[0],
      name: facility[1],
      type: facility[2],
      city: facility[3],
      district: facility[4],
      address: facility[5],
      latitude: facility[6],
      longitude: facility[7],
      contactName: facility[8],
      contactPhone: facility[9],
      lastSyncAt: new Date(Date.now() - index * 3 * 60_000),
    })),
  ).onConflictDoNothing();

  await db.insert(medicinesTable).values(
    medicines.map((medicine) => ({
      genericName: medicine[0],
      brandName: medicine[1],
      strength: medicine[2],
      form: medicine[3],
      unit: medicine[4],
      category: medicine[5],
      reorderLevel: medicine[6],
    })),
  ).onConflictDoNothing();

  const facilityRows = await db.select().from(facilitiesTable);
  const medicineRows = await db.select().from(medicinesTable);
  const inventoryValues = facilityRows.flatMap((facility, facilityIndex) =>
    medicineRows.map((medicine, medicineIndex) => {
      const isManager = facility.id === 1;
      const isCriticalMedicine = medicineIndex < 8;
      const base = 260 + ((facilityIndex * 97 + medicineIndex * 53) % 760);
      const quantity = isManager && isCriticalMedicine
        ? 34 + medicineIndex * 9
        : base;
      const dailyConsumption = isManager && isCriticalMedicine
        ? 14 + medicineIndex * 1.6
        : 8 + ((facilityIndex * 3 + medicineIndex) % 22);
      const expiryDays = isManager && medicineIndex === 17 ? 32 : 65 + ((medicineIndex * 11 + facilityIndex * 7) % 260);
      return {
        facilityId: facility.id,
        medicineId: medicine.id,
        batchNumber: `${facility.code}-${medicine.id}-A`,
        quantityOnHand: quantity,
        reservedQuantity: 0,
        expiryDate: dateAfter(expiryDays),
        dailyConsumption,
        lastCountedAt: new Date(Date.now() - facilityIndex * 3 * 60_000),
      };
    }),
  );
  await db.insert(inventoryTable).values(inventoryValues).onConflictDoNothing();

  const [manager, udupi, amoxicillin, insulin] = await Promise.all([
    db.select().from(facilitiesTable).where(eq(facilitiesTable.id, 1)).limit(1),
    db.select().from(facilitiesTable).where(eq(facilitiesTable.code, "DH-UDP")).limit(1),
    db.select().from(medicinesTable).where(and(eq(medicinesTable.genericName, "Amoxicillin"), eq(medicinesTable.form, "tablet"))).limit(1),
    db.select().from(medicinesTable).where(eq(medicinesTable.genericName, "Insulin glargine")).limit(1),
  ]);

  if (manager[0] && udupi[0] && amoxicillin[0] && insulin[0]) {
    const [request] = await db.insert(transferRequestsTable).values({
      requesterFacilityId: udupi[0].id,
      supplierFacilityId: manager[0].id,
      medicineId: insulin[0].id,
      quantity: 40,
      note: "Priority request from the Udupi district store.",
    }).returning();
    if (request) {
      await db.insert(notificationsTable).values({
        facilityId: manager[0].id,
        transferRequestId: request.id,
        type: "transfer_request",
        title: "Incoming transfer request",
        body: `District Hospital Udupi requested ${request.quantity} units of Insulin glargine.`,
      });
    }
    await db.insert(notificationsTable).values({
      facilityId: manager[0].id,
      type: "stock_alert",
      title: "Regional stock signal",
      body: `Amoxicillin pressure is rising across Udupi and Manipal. Review nearby surplus before the next count.`,
    });
  }
}
import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  date,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const facilitiesTable = pgTable(
  "facilities",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    city: text("city").notNull(),
    district: text("district").notNull(),
    address: text("address").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    contactName: text("contact_name").notNull(),
    contactPhone: text("contact_phone").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    cityIndex: uniqueIndex("facilities_code_idx").on(table.code),
  }),
);

export const medicinesTable = pgTable(
  "medicines",
  {
    id: serial("id").primaryKey(),
    genericName: text("generic_name").notNull(),
    brandName: text("brand_name").notNull(),
    strength: text("strength").notNull(),
    form: text("form").notNull(),
    unit: text("unit").notNull(),
    category: text("category").notNull(),
    reorderLevel: integer("reorder_level").notNull().default(100),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    catalogIndex: uniqueIndex("medicines_catalog_idx").on(
      table.genericName,
      table.strength,
      table.form,
    ),
  }),
);

export const inventoryTable = pgTable(
  "inventory",
  {
    id: serial("id").primaryKey(),
    facilityId: integer("facility_id").notNull().references(() => facilitiesTable.id),
    medicineId: integer("medicine_id").notNull().references(() => medicinesTable.id),
    batchNumber: text("batch_number").notNull(),
    quantityOnHand: integer("quantity_on_hand").notNull().default(0),
    reservedQuantity: integer("reserved_quantity").notNull().default(0),
    expiryDate: date("expiry_date").notNull(),
    dailyConsumption: doublePrecision("daily_consumption").notNull().default(0),
    lastCountedAt: timestamp("last_counted_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    batchIndex: uniqueIndex("inventory_facility_medicine_batch_idx").on(
      table.facilityId,
      table.medicineId,
      table.batchNumber,
    ),
  }),
);

export const transferRequestsTable = pgTable("transfer_requests", {
  id: serial("id").primaryKey(),
  requesterFacilityId: integer("requester_facility_id").notNull().references(() => facilitiesTable.id),
  supplierFacilityId: integer("supplier_facility_id").notNull().references(() => facilitiesTable.id),
  medicineId: integer("medicine_id").notNull().references(() => medicinesTable.id),
  quantity: integer("quantity").notNull(),
  status: text("status").notNull().default("pending"),
  note: text("note"),
  deliveryStatus: text("delivery_status").notNull().default("not_configured"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
});

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  facilityId: integer("facility_id").notNull().references(() => facilitiesTable.id),
  transferRequestId: integer("transfer_request_id").references(() => transferRequestsTable.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFacilitySchema = createInsertSchema(facilitiesTable).omit({
  id: true,
  createdAt: true,
  lastSyncAt: true,
});
export const insertMedicineSchema = createInsertSchema(medicinesTable).omit({
  id: true,
  createdAt: true,
});
export const insertInventorySchema = createInsertSchema(inventoryTable).omit({
  id: true,
  updatedAt: true,
  lastCountedAt: true,
});
export const insertTransferRequestSchema = createInsertSchema(transferRequestsTable).omit({
  id: true,
  createdAt: true,
  respondedAt: true,
});
export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({
  id: true,
  createdAt: true,
});

export type Facility = typeof facilitiesTable.$inferSelect;
export type Medicine = typeof medicinesTable.$inferSelect;
export type Inventory = typeof inventoryTable.$inferSelect;
export type TransferRequest = typeof transferRequestsTable.$inferSelect;
export type Notification = typeof notificationsTable.$inferSelect;
export type InsertFacility = z.infer<typeof insertFacilitySchema>;
export type InsertMedicine = z.infer<typeof insertMedicineSchema>;
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type InsertTransferRequest = z.infer<typeof insertTransferRequestSchema>;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  parentId: text("parent_id"),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("custom"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const memories = sqliteTable("memories", {
  id: text("id").primaryKey(),
  categoryId: text("category_id").notNull(),
  title: text("title").notNull(),
  date: text("date"),
  description: text("description"),
  location: text("location"),
  seed: integer("seed").notNull().default(0),
});

export const media = sqliteTable("media", {
  id: text("id").primaryKey(),
  memoryId: text("memory_id").notNull(),
  type: text("type").notNull(),
  path: text("path").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  caption: text("caption"),
});

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;
export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;

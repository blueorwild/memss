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

// 对话会话
export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  title: text("title").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// 会话内的消息（仅存 user/assistant 最终文本）
export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at").notNull(),
});

// 键值设置表（如 Agent provider 配置，密钥字段以密文存储）
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;
export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Setting = typeof settings.$inferSelect;

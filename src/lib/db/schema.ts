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
  /** 上传时间（毫秒）：没有 date 时作为排序依据 */
  createdAt: integer("created_at").notNull().default(0),
  /** 设为缩略图的图片 media.id；为空或失效时回退到第一张图片 */
  coverMediaId: text("cover_media_id"),
});

export const media = sqliteTable("media", {
  id: text("id").primaryKey(),
  memoryId: text("memory_id").notNull(),
  type: text("type").notNull(),
  path: text("path").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  caption: text("caption"),
  /** 裁剪焦点（百分比 0-100）：object-cover 时决定展示构图，默认居中 */
  focalX: integer("focal_x").notNull().default(50),
  focalY: integer("focal_y").notNull().default(50),
  /** 裁剪缩放（百分比 100-600）：以焦点为中心放大，默认 100（不放大） */
  cropScale: integer("crop_scale").notNull().default(100),
});

// 对话会话
export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  title: text("title").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// 会话内的消息（存完整 AI SDK 消息，含工具调用；content 为可读文本供历史展示）
export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  role: text("role").notNull(),
  /** 可读文本：user 输入 / assistant 最终文本；tool 消息为空 */
  content: text("content").notNull().default(""),
  /** 完整 AI SDK 消息（JSON），回灌模型时使用 */
  data: text("data"),
  /** 该助手消息的检索卡片（JSON），供历史重开时重现 */
  cards: text("cards"),
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

export interface ProductReview {
  id: string;
  rating: number;
  author: string;
  date: string;
  title: string;
  content: string;
}

export interface ProductGalleryItem {
  id: number;
  label: string;
  src: string;
}

export interface ProductVariant {
  id?: string;
  option?: string;
  value?: string;
  title?: string;
  sku?: string;
  price?: number;
  stock?: string | number;
  capacity?: number;
  capacityUnit?: string;
  status?: string;
  attributes?: Array<{ name: string; value: string }>;
  images?: string[];
  videos?: any[];
  image?: string;
}

export interface Product {
  id: string;
  name: string;
  shortName?: string;
  sku: string;
  categoryId?: string;
  category: string;
  categoryCode?: string;
  price: number;
  originalPrice?: number;
  stockStatus: 'In Stock' | 'Low Stock' | 'Out of Stock' | string;
  stock: number;
  image: string;
  gallery?: ProductGalleryItem[];
  videos?: any[];
  description?: string;
  salesLast30Days?: number;
  conversionRate?: number;
  pageViews?: number;
  refundRate?: number;
  status?: string;
  brand?: string;
  costPrice?: number;
  committed?: number;
  reorderPoint?: number;
  margin?: string;
  discount?: string;
  variants?: ProductVariant[];
  images?: string[];
  tags?: string[];
  reviews?: ProductReview[];
  createdAt?: string;
  updatedAt?: string;
}

export * from './category.types';
export * from './auth.types';
export * from './team.types';
export * from './knowledge.types';

export interface KnowledgeDocument {
  id: string;
  title: string;
  category: string;
  format: string;
  size: string;
  updatedAt: string;
  summary: string;
  tags: string[];
  icon: string;
  fileSize?: number;
  isCustom?: boolean;
  content?: string;
}

export interface ScheduleEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: string;
  type: string;
  platform: string;
  status: string;
  attendees: Array<{ name: string; avatar: string; email?: string }>;
  description: string;
  recordingAvailable: boolean;
  transcriptAvailable: boolean;
  isOmniFlowScheduled: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: string;
  avatar: string;
  assignedTasks: number;
  lastActive: string;
}

export interface ConversationMessage {
  id: string;
  sender: 'user' | 'assistant' | 'agent' | string;
  text: string;
  timestamp: string;
  avatar?: string;
  meta?: any;
}

export interface Conversation {
  id: string;
  title: string;
  channel: string;
  date: string;
  status: string;
  customer: {
    name: string;
    email: string;
    avatar: string;
    phone?: string;
    location?: string;
  };
  messages: ConversationMessage[];
  summary?: string;
  resolution?: string;
}

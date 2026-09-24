export interface ProductReview {
  id: string;
  rating: number;
  author: string;
  date: string;
  title: string;
  content: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  /** Foreign key to Category.id — what the API stores and filters on. */
  categoryId: string;
  /** Display name, derived by the API from categoryId. Read-only for the client. */
  category: string;
  /** Optional: an offering can be created before it is priced. */
  price?: number;
  /** `Unspecified` when no stock figure has been entered — unknown, not zero. */
  stockStatus?: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Unspecified' | string;
  stock?: number;
  image: string;
  description?: string;
  salesLast30Days?: number;
  conversionRate?: number;
  pageViews?: number;
  refundRate?: number;
  status?: string;
  brand?: string;
  costPrice?: number;
  variants?: any[];
  images?: string[];
  tags?: string[];
  reviews?: ProductReview[];
}

export interface Category {
  /** Referenced by Product.categoryId; assigned once and never changed. */
  id: string;
  name: string;
  description: string;
  icon: string;
  color?: string;
  /** Derived by the API from the products pointing at this category. */
  productsCount: number;
  updated?: string;
}

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

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
  category: string;
  price: number;
  stockStatus: 'In Stock' | 'Low Stock' | 'Out of Stock' | string;
  stock: number;
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
  id: string;
  name: string;
  description: string;
  icon: string;
  productCount: number;
  subcategories: string[];
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

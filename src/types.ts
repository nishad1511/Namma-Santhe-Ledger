export interface Customer {
  id: string;
  name: string;
  phone?: string;
  totalDue: number;
  ownerId: string;
  updatedAt: any; // Firestore Timestamp
}

export interface Transaction {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  type: 'credit' | 'payment';
  ownerId: string;
  timestamp: any; // Firestore Timestamp
  notes?: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

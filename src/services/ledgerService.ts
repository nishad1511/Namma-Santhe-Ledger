import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  increment,
  runTransaction
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Customer, Transaction, OperationType, FirestoreErrorInfo } from '../types';

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const ledgerService = {
  async addCustomer(name: string, phone?: string) {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("User not authenticated");

    const path = 'customers';
    try {
      const customerRef = doc(collection(db, path));
      const customerData = {
        name,
        phone: phone || null,
        totalDue: 0,
        ownerId: userId,
        updatedAt: serverTimestamp()
      };
      await setDoc(customerRef, customerData);
      return { id: customerRef.id, ...customerData };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async getCustomers() {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("User not authenticated");

    const path = 'customers';
    try {
      const q = query(
        collection(db, path), 
        where("ownerId", "==", userId),
        orderBy("name")
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  async addTransaction(customerId: string, customerName: string, amount: number, type: 'credit' | 'payment', notes?: string) {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("User not authenticated");

    const transPath = 'transactions';
    const custPath = `customers/${customerId}`;

    try {
      await runTransaction(db, async (transaction) => {
        const customerRef = doc(db, 'customers', customerId);
        const transRef = doc(collection(db, transPath));

        const amountChange = type === 'credit' ? amount : -amount;

        transaction.set(transRef, {
          customerId,
          customerName,
          amount,
          type,
          ownerId: userId,
          timestamp: serverTimestamp(),
          notes: notes || null
        });

        transaction.update(customerRef, {
          totalDue: increment(amountChange),
          updatedAt: serverTimestamp()
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${transPath} + ${custPath}`);
    }
  },

  async getRecentTransactions(limitCount = 20) {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("User not authenticated");

    const path = 'transactions';
    try {
      const q = query(
        collection(db, path),
        where("ownerId", "==", userId),
        orderBy("timestamp", "desc")
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }
};

import { authenticateUser } from '../auth/authService';

export interface Order {
  id: string;
  userId: string;
  items: string[];
  total: number;
}

const orders: Order[] = [];

/** Handles POST /api/orders — creates an order for the authenticated user. */
export async function handleCreateOrder(request: {
  email: string;
  password: string;
  items: string[];
}): Promise<Order> {
  const user = authenticateUser(request.email, request.password);
  if (!user) {
    throw new Error('Unauthorized');
  }

  const order: Order = {
    id: crypto.randomUUID(),
    userId: user.id,
    items: request.items,
    total: request.items.length * 9.99,
  };
  orders.push(order);
  return order;
}

export function listOrdersForUser(userId: string): Order[] {
  return orders.filter((order) => order.userId === userId);
}

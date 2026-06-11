import { Router } from "express";
import { healthRouter } from "./health.routes";
import { authRouter } from "../modules/auth/auth.routes";
import { dashboardRouter } from "../modules/dashboard/dashboard.routes";
import { depositsRouter } from "../modules/deposits/deposits.routes";
import { financeRouter } from "../modules/finance/finance.routes";
import { inventoryRouter } from "../modules/inventory/inventory.routes";
import { notificationsRouter } from "../modules/notifications/notifications.routes";
import { productsRouter } from "../modules/products/products.routes";
import { purchaseRequestsRouter } from "../modules/purchase-requests/purchase-requests.routes";
import { salesRouter } from "../modules/sales/sales.routes";
import { usersRouter } from "../modules/users/users.routes";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/products", productsRouter);
apiRouter.use("/inventory", inventoryRouter);
apiRouter.use("/sales", salesRouter);
apiRouter.use("/purchase-requests", purchaseRequestsRouter);
apiRouter.use("/deposits", depositsRouter);
apiRouter.use("/finance", financeRouter);
apiRouter.use("/notifications", notificationsRouter);

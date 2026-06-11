import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate-request";
import { createOperationalExpenseSchema } from "./finance.schemas";
import * as financeController from "./finance.controller";

export const financeRouter = Router();

financeRouter.use(authenticate);
financeRouter.use(authorize(UserRole.OWNER, UserRole.SUPERVISOR));

financeRouter.get("/summary", financeController.getFinanceSummary);
financeRouter.get("/expenses", financeController.listOperationalExpenses);
financeRouter.post("/expenses", validateBody(createOperationalExpenseSchema), financeController.createOperationalExpense);

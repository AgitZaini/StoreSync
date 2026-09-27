import { lazy } from "react";

// Halaman khusus Super Admin dimuat terpisah supaya HP SPG/kasir tidak ikut mengunduhnya.
export const UsersPage = lazy(() => import("../features/users/users-page").then((module) => ({ default: module.UsersPage })));
export const UserDetailPage = lazy(() =>
  import("../features/users/user-detail-page").then((module) => ({ default: module.UserDetailPage })),
);
export const PharmaciesPage = lazy(() =>
  import("../features/pharmacies/pharmacies-page").then((module) => ({ default: module.PharmaciesPage })),
);
export const PharmacyFormPage = lazy(() =>
  import("../features/pharmacies/pharmacy-form-page").then((module) => ({ default: module.PharmacyFormPage })),
);
export const ProductsPage = lazy(() => import("../features/products/products-page").then((module) => ({ default: module.ProductsPage })));
export const SettingsPage = lazy(() => import("../features/settings/settings-page").then((module) => ({ default: module.SettingsPage })));
export const AuditLogPage = lazy(() => import("../features/audit-log/audit-log-page").then((module) => ({ default: module.AuditLogPage })));

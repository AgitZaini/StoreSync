import { Compass } from "lucide-react";
import { Link } from "react-router-dom";
import { buttonStyles } from "../components/styles";
import { Card, EmptyState } from "../components/ui";

export function NotFoundPage() {
  return (
    <Card>
      <EmptyState icon={Compass}>
        Halaman tidak ditemukan atau belum tersedia untuk peran Anda.
        <Link to="/" className={`${buttonStyles.secondary} mt-4 flex`}>
          Kembali ke beranda
        </Link>
      </EmptyState>
    </Card>
  );
}

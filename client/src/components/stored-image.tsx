import { ImageOff } from "lucide-react";
import { useFileUrl } from "../hooks/use-file-url";
import { cn } from "../lib/utils";
import { Spinner } from "./ui";

/** Gambar dari penyimpanan berkas (foto absen, foto kasir, dsb.) lewat URL sementara. */
export function StoredImage({ fileId, alt, className }: { fileId: string; alt: string; className?: string }) {
  const url = useFileUrl(fileId);

  if (url.isPending) {
    return (
      <div className={cn("grid place-items-center bg-canvas", className)}>
        <Spinner className="size-4" />
      </div>
    );
  }

  if (!url.data) {
    return (
      <div className={cn("grid place-items-center bg-canvas text-subtle", className)} title="Foto tidak bisa dimuat">
        <ImageOff className="size-5" />
      </div>
    );
  }

  return <img src={url.data} alt={alt} loading="lazy" className={cn("bg-canvas object-cover", className)} />;
}

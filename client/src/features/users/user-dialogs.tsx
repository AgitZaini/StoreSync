import { zodResolver } from "@hookform/resolvers/zod";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { CredentialSummary } from "../../components/copy-button";
import { Dialog, DialogActions } from "../../components/dialog";
import { SelectInput, TextInput } from "../../components/form-controls";
import { buttonStyles } from "../../components/styles";
import { useToast } from "../../components/toast-context";
import { Field, Notice } from "../../components/ui";
import { getErrorMessage } from "../../lib/api";
import { formatPhone } from "../../lib/format";
import { generateTemporaryPassword } from "../../lib/password";
import { roleLabels } from "../../lib/roles";
import { cn } from "../../lib/utils";
import { newPasswordField, phoneField } from "../../lib/validation";
import type { UserRole } from "../../types/auth";
import type { Pharmacy, Team, UserDetail } from "../../types/master-data";
import {
  useCreatePlacement,
  useCreateUser,
  useResetPassword,
  useSaveTeam,
  useUpdateUser,
  useUsers,
} from "./users-api";

// Akun kasir dibuat dari menu Apotek (AKN-03).
const ASSIGNABLE_ROLES = ["SUPER_ADMIN", "ADMIN", "TEAM_LEADER", "SPG"] as const satisfies readonly UserRole[];

function TemporaryPasswordField({
  onGenerate,
  error,
  children,
}: {
  onGenerate: () => void;
  error?: string;
  children: ReactNode;
}) {
  return (
    <Field label="Kata sandi sementara" error={error} hint="Wajib diganti pengguna saat login pertama.">
      <span className="flex gap-2">
        <span className="flex-1">{children}</span>
        <button type="button" onClick={onGenerate} className={buttonStyles.secondary} title="Buat sandi baru">
          <RefreshCw />
          <span className="hidden sm:inline">Buat</span>
        </button>
      </span>
    </Field>
  );
}

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter"),
  phone: phoneField,
  role: z.enum(ASSIGNABLE_ROLES),
  teamId: z.string(),
  password: newPasswordField,
});

type CreateUserValues = z.infer<typeof createUserSchema>;

export function CreateUserDialog({ open, onClose, teams }: { open: boolean; onClose: () => void; teams: Team[] }) {
  const createUser = useCreateUser();
  const [created, setCreated] = useState<{ phone: string; password: string } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: "", phone: "", role: "SPG", teamId: "", password: generateTemporaryPassword() },
  });
  const role = useWatch({ control, name: "role" });

  const close = () => {
    reset({ name: "", phone: "", role: "SPG", teamId: "", password: generateTemporaryPassword() });
    setCreated(null);
    createUser.reset();
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    const user = await createUser.mutateAsync({
      ...values,
      teamId: values.role === "SPG" && values.teamId ? values.teamId : null,
    });
    setCreated({ phone: formatPhone(user.phone), password: values.password });
  });

  return (
    <Dialog open={open} onClose={close} title={created ? "Akun berhasil dibuat" : "Tambah pengguna"}>
      {created ? (
        <>
          <CredentialSummary phone={created.phone} password={created.password} />
          <DialogActions>
            <button type="button" onClick={close} className={buttonStyles.primary}>
              Selesai
            </button>
          </DialogActions>
        </>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Field label="Nama lengkap" error={errors.name?.message}>
            <TextInput {...register("name")} invalid={Boolean(errors.name)} autoComplete="off" />
          </Field>
          <Field label="Nomor HP (untuk login)" error={errors.phone?.message}>
            <TextInput {...register("phone")} type="tel" inputMode="tel" placeholder="0812-3456-7890" invalid={Boolean(errors.phone)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Peran">
              <SelectInput {...register("role")}>
                {ASSIGNABLE_ROLES.map((option) => (
                  <option key={option} value={option}>
                    {roleLabels[option]}
                  </option>
                ))}
              </SelectInput>
            </Field>
            {role === "SPG" ? (
              <Field label="Tim">
                <SelectInput {...register("teamId")}>
                  <option value="">Belum ada tim</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            ) : null}
          </div>
          <TemporaryPasswordField
            error={errors.password?.message}
            onGenerate={() => setValue("password", generateTemporaryPassword(), { shouldValidate: true })}
          >
            <TextInput {...register("password")} className="font-mono" invalid={Boolean(errors.password)} autoComplete="off" />
          </TemporaryPasswordField>
          {role === "SPG" ? (
            <Notice>Penempatan apotek diatur dari halaman detail SPG setelah akun dibuat.</Notice>
          ) : null}
          {createUser.error ? <Notice tone="red">{getErrorMessage(createUser.error)}</Notice> : null}
          <DialogActions>
            <button type="button" onClick={close} className={buttonStyles.secondary}>
              Batal
            </button>
            <button type="submit" disabled={isSubmitting} className={buttonStyles.primary}>
              {isSubmitting ? "Menyimpan..." : "Buat akun"}
            </button>
          </DialogActions>
        </form>
      )}
    </Dialog>
  );
}

const editUserSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter"),
  phone: phoneField,
  role: z.enum(ASSIGNABLE_ROLES),
});

export function EditUserDialog({ open, onClose, user }: { open: boolean; onClose: () => void; user: UserDetail }) {
  const updateUser = useUpdateUser(user.id);
  const showToast = useToast();
  const defaults = {
    name: user.name,
    phone: formatPhone(user.phone),
    role: user.role as (typeof ASSIGNABLE_ROLES)[number],
  };
  // Dialog di-mount saat dibuka (lihat UserDetailPage), jadi nilai awal cukup dibaca sekali.
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof editUserSchema>>({ resolver: zodResolver(editUserSchema), defaultValues: defaults });

  const close = () => {
    updateUser.reset();
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    await updateUser.mutateAsync(values);
    showToast("Data akun disimpan");
    close();
  });

  return (
    <Dialog open={open} onClose={close} title="Ubah akun">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Nama lengkap" error={errors.name?.message}>
          <TextInput {...register("name")} invalid={Boolean(errors.name)} />
        </Field>
        <Field label="Nomor HP (untuk login)" error={errors.phone?.message}>
          <TextInput {...register("phone")} type="tel" inputMode="tel" invalid={Boolean(errors.phone)} />
        </Field>
        <Field label="Peran" hint="Mengganti peran membuat pengguna harus login ulang.">
          <SelectInput {...register("role")}>
            {ASSIGNABLE_ROLES.map((option) => (
              <option key={option} value={option}>
                {roleLabels[option]}
              </option>
            ))}
          </SelectInput>
        </Field>
        {updateUser.error ? <Notice tone="red">{getErrorMessage(updateUser.error)}</Notice> : null}
        <DialogActions>
          <button type="button" onClick={close} className={buttonStyles.secondary}>
            Batal
          </button>
          <button type="submit" disabled={isSubmitting} className={buttonStyles.primary}>
            {isSubmitting ? "Menyimpan..." : "Simpan"}
          </button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export function ResetPasswordDialog({
  open,
  onClose,
  userId,
  userName,
  phone,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  phone: string;
}) {
  const resetPassword = useResetPassword(userId);
  const [password, setPassword] = useState(generateTemporaryPassword);
  const [done, setDone] = useState(false);
  const invalid = !newPasswordField.safeParse(password).success;

  const close = () => {
    setPassword(generateTemporaryPassword());
    setDone(false);
    resetPassword.reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} title={done ? "Kata sandi direset" : "Reset kata sandi"}>
      {done ? (
        <>
          <CredentialSummary phone={formatPhone(phone)} password={password} />
          <DialogActions>
            <button type="button" onClick={close} className={buttonStyles.primary}>
              Selesai
            </button>
          </DialogActions>
        </>
      ) : (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-muted">
            {userName} akan keluar dari semua perangkat dan wajib membuat kata sandi baru saat login berikutnya.
          </p>
          <TemporaryPasswordField onGenerate={() => setPassword(generateTemporaryPassword())}>
            <TextInput value={password} onChange={(event) => setPassword(event.target.value)} className="font-mono" invalid={invalid} />
          </TemporaryPasswordField>
          {resetPassword.error ? <Notice tone="red">{getErrorMessage(resetPassword.error)}</Notice> : null}
          <DialogActions>
            <button type="button" onClick={close} className={buttonStyles.secondary}>
              Batal
            </button>
            <button
              type="button"
              disabled={invalid || resetPassword.isPending}
              onClick={() => resetPassword.mutate(password, { onSuccess: () => setDone(true) })}
              className={buttonStyles.primary}
            >
              {resetPassword.isPending ? "Memproses..." : "Reset kata sandi"}
            </button>
          </DialogActions>
        </div>
      )}
    </Dialog>
  );
}

export function TeamDialog({ open, onClose, team }: { open: boolean; onClose: () => void; team?: Team }) {
  const saveTeam = useSaveTeam();
  const showToast = useToast();
  const leaders = useUsers({ role: "TEAM_LEADER", status: "ACTIVE" });
  const [name, setName] = useState(team?.name ?? "");
  const [leaderId, setLeaderId] = useState(team?.leader.id ?? "");
  // Satu Team Leader hanya memimpin satu tim.
  const availableLeaders = (leaders.data ?? []).filter((leader) => !leader.ledTeam || leader.id === team?.leader.id);

  const close = () => {
    setName(team?.name ?? "");
    setLeaderId(team?.leader.id ?? "");
    saveTeam.reset();
    onClose();
  };

  const submit = () =>
    saveTeam.mutate(
      { teamId: team?.id, name: name.trim(), leaderId },
      {
        onSuccess: () => {
          showToast(team ? "Tim disimpan" : "Tim dibuat");
          close();
        },
      },
    );

  return (
    <Dialog open={open} onClose={close} title={team ? "Ubah tim" : "Buat tim"}>
      <div className="space-y-4">
        <Field label="Nama tim" hint="Misalnya berdasarkan wilayah: Tim Jakarta Timur.">
          <TextInput value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Team Leader">
          <SelectInput value={leaderId} onChange={(event) => setLeaderId(event.target.value)}>
            <option value="">Pilih Team Leader</option>
            {availableLeaders.map((leader) => (
              <option key={leader.id} value={leader.id}>
                {leader.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        {leaders.isSuccess && availableLeaders.length === 0 ? (
          <Notice>Semua Team Leader aktif sudah memimpin tim. Buat akun Team Leader baru dulu.</Notice>
        ) : null}
        {saveTeam.error ? <Notice tone="red">{getErrorMessage(saveTeam.error)}</Notice> : null}
      </div>
      <DialogActions>
        <button type="button" onClick={close} className={buttonStyles.secondary}>
          Batal
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saveTeam.isPending || name.trim().length < 2 || !leaderId}
          className={buttonStyles.primary}
        >
          {saveTeam.isPending ? "Menyimpan..." : "Simpan"}
        </button>
      </DialogActions>
    </Dialog>
  );
}

export function AddPlacementDialog({
  open,
  onClose,
  spg,
  pharmacies,
}: {
  open: boolean;
  onClose: () => void;
  spg: UserDetail;
  pharmacies: Pharmacy[];
}) {
  const createPlacement = useCreatePlacement();
  const showToast = useToast();
  const [pharmacyId, setPharmacyId] = useState("");
  const placedIds = new Set(spg.placements.filter((placement) => !placement.endedAt).map((placement) => placement.pharmacy.id));
  const options = pharmacies.filter((pharmacy) => pharmacy.status === "ACTIVE" && !placedIds.has(pharmacy.id));
  const selected = options.find((pharmacy) => pharmacy.id === pharmacyId);

  const close = () => {
    setPharmacyId("");
    createPlacement.reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} title="Tambah penempatan" description={`${spg.name} · maksimal 3 apotek aktif`}>
      <div className="space-y-4">
        <Field label="Apotek">
          <SelectInput value={pharmacyId} onChange={(event) => setPharmacyId(event.target.value)}>
            <option value="">Pilih apotek aktif</option>
            {options.map((pharmacy) => (
              <option key={pharmacy.id} value={pharmacy.id}>
                {pharmacy.name}
                {pharmacy.placements.length > 0 ? ` · ${pharmacy.placements.length} SPG` : ""}
              </option>
            ))}
          </SelectInput>
        </Field>
        {selected ? (
          <div className="rounded-2xl bg-canvas p-4 text-sm">
            <p className="font-medium text-ink">{selected.name}</p>
            <p className="mt-0.5 text-muted">{selected.address}</p>
            <p className={cn("mt-2 text-xs", selected.placements.length > 0 ? "text-orange-600" : "text-muted")}>
              {selected.placements.length > 0
                ? `Sudah ada SPG: ${selected.placements.map((placement) => placement.spg.name).join(", ")}`
                : "Belum ada SPG di apotek ini."}
            </p>
          </div>
        ) : null}
        {createPlacement.error ? <Notice tone="red">{getErrorMessage(createPlacement.error)}</Notice> : null}
      </div>
      <DialogActions>
        <button type="button" onClick={close} className={buttonStyles.secondary}>
          Batal
        </button>
        <button
          type="button"
          disabled={!pharmacyId || createPlacement.isPending}
          onClick={() =>
            createPlacement.mutate(
              { spgId: spg.id, pharmacyId },
              {
                onSuccess: () => {
                  showToast(`${spg.name} ditempatkan di ${selected?.name}`);
                  close();
                },
              },
            )
          }
          className={buttonStyles.primary}
        >
          {createPlacement.isPending ? "Menyimpan..." : "Tempatkan"}
        </button>
      </DialogActions>
    </Dialog>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { saveFiscalConfigAction } from '@/features/facturas/actions-fiscal-config';

const formSchema = z.object({
	taxId: z.string().trim().max(64).optional().or(z.literal('')),
	razonSocial: z.string().trim().max(200).optional().or(z.literal('')),
	regimenFiscal: z.string().trim().max(64).optional().or(z.literal('')),
	codigoPostalFiscal: z.string().trim().max(16).optional().or(z.literal('')),
	fiscalActivado: z.boolean(),
});

type FiscalFormValues = z.infer<typeof formSchema>;

interface FiscalConfigFormProps {
	initial: {
		taxId: string | null;
		razonSocial: string | null;
		regimenFiscal: string | null;
		codigoPostalFiscal: string | null;
		fiscalActivado: boolean;
	} | null;
}

/**
 * @description Formulario de datos fiscales del emisor (Gap 4).
 * @param {FiscalConfigFormProps} props - Valores iniciales del tenant.
 * @returns {JSX.Element} Formulario de configuración fiscal.
 */
export function FiscalConfigForm({ initial }: FiscalConfigFormProps) {
	const router = useRouter();
	const [isSaving, setIsSaving] = useState(false);

	const {
		register,
		handleSubmit,
		setValue,
		watch,
		formState: { errors },
	} = useForm<FiscalFormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			taxId: initial?.taxId ?? '',
			razonSocial: initial?.razonSocial ?? '',
			regimenFiscal: initial?.regimenFiscal ?? '',
			codigoPostalFiscal: initial?.codigoPostalFiscal ?? '',
			fiscalActivado: initial?.fiscalActivado ?? false,
		},
	});

	const fiscalActivado = watch('fiscalActivado');

	const onSubmit = async (data: FiscalFormValues) => {
		setIsSaving(true);
		try {
			const r = await saveFiscalConfigAction(data);
			if (r.success) {
				toast.success('Configuración fiscal guardada');
				router.refresh();
			} else {
				toast.error(r.error?.message || 'No se pudo guardar');
			}
		} catch {
			toast.error('Error de red al guardar la configuración');
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Card>
			<CardContent className="pt-6">
				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<div className="grid gap-2">
						<Label htmlFor="taxId">ID fiscal del emisor (RFC/TaxId)</Label>
						<Input id="taxId" {...register('taxId')} aria-invalid={!!errors.taxId} />
					</div>
					<div className="grid gap-2">
						<Label htmlFor="razonSocial">Razón social</Label>
						<Input id="razonSocial" {...register('razonSocial')} />
					</div>
					<div className="grid gap-2">
						<Label htmlFor="regimenFiscal">Régimen fiscal</Label>
						<Input id="regimenFiscal" {...register('regimenFiscal')} />
					</div>
					<div className="grid gap-2">
						<Label htmlFor="codigoPostalFiscal">Código postal fiscal</Label>
						<Input id="codigoPostalFiscal" {...register('codigoPostalFiscal')} />
					</div>
					<div className="flex items-center gap-2">
						<Checkbox
							id="fiscalActivado"
							checked={fiscalActivado}
							onCheckedChange={(v) => setValue('fiscalActivado', v === true)}
							aria-label="Habilitar la capa fiscal"
						/>
						<Label htmlFor="fiscalActivado" className="font-normal">
							Habilitar documentos fiscales en este tenant
						</Label>
					</div>
					<Button type="submit" disabled={isSaving}>
						{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
						Guardar
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}

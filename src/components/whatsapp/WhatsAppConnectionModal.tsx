import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useWhatsAppLinkCode } from "@/hooks/useWhatsApp";
import { validateBrazilianPhone } from "@/lib/phone";
import { ExternalLink, MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const SIMPLIFIQA_WHATSAPP = "5561993116103";

function buildWaMeLink(code: string) {
	return `https://wa.me/${SIMPLIFIQA_WHATSAPP}?text=${encodeURIComponent(`VINCULAR ${code}`)}`;
}

interface WhatsAppConnectionModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onLinked: (phone: string) => void;
	companyId?: string;
}

export const WhatsAppConnectionModal = ({
	open,
	onOpenChange,
	onLinked,
	companyId,
}: WhatsAppConnectionModalProps) => {
	const { user } = useAuth();
	const whatsAppLink = useWhatsAppLinkCode();

	const [phone, setPhone] = useState("");
	const [phoneError, setPhoneError] = useState<string | null>(null);
	const [code, setCode] = useState<string | null>(null);
	const [expiresAt, setExpiresAt] = useState<string | null>(null);
	const [status, setStatus] = useState<"idle" | "pending" | "verified">("idle");
	const [isChecking, setIsChecking] = useState(false);

	const handlePhoneChange = (value: string) => {
		setPhone(value);
		if (phoneError) setPhoneError(null);
	};

	const handleGenerateCode = async () => {
		if (!user?.id) {
			toast.error("É necessário estar autenticado.");
			return;
		}

		const validation = validateBrazilianPhone(phone);
		if (!validation.valid) {
			setPhoneError(validation.error);
			return;
		}
		setPhoneError(null);

		try {
			const result = await whatsAppLink.mutateAsync({
				companyId: companyId ?? null,
			});

			setCode(result.code);
			setExpiresAt(result.expiresAt);
			setStatus("pending");
			toast.success("Código gerado. Envie no WhatsApp para confirmar.");
		} catch {
			toast.error("Não foi possível gerar o código agora.");
		}
	};

	const handleCheckStatus = async () => {
		if (!user?.id) return;

		try {
			setIsChecking(true);
			const { supabase } = await import("@/lib/supabase");

			let query = supabase
				.from("whatsapp_links")
				.select("status, phone")
				.eq("profile_id", user.id)
				.order("created_at", { ascending: false })
				.limit(1)
				.maybeSingle();

			if (companyId) {
				query = query.eq("company_id", companyId);
			}

			const { data, error } = await query;
			if (error) throw error;

			if (data?.status === "linked") {
				setStatus("verified");
				toast.success("WhatsApp vinculado com sucesso!");
				onLinked(data.phone ?? phone);
			} else {
				toast.message(
					"Ainda não confirmado. Envie o código no WhatsApp e tente novamente."
				);
			}
		} catch {
			toast.error("Não foi possível verificar o status agora.");
		} finally {
			setIsChecking(false);
		}
	};

	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) {
			setPhone("");
			setPhoneError(null);
			setCode(null);
			setExpiresAt(null);
			setStatus("idle");
		}
		onOpenChange(nextOpen);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Conectar WhatsApp</DialogTitle>
					<DialogDescription>
						Vincule seu WhatsApp para registrar gastos por texto, áudio ou foto.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-2">
					<div className="rounded-lg border bg-muted/30 p-4 space-y-3">
						<div className="flex items-center gap-2 text-sm font-medium mb-2">
							<MessageSquare className="h-4 w-4 text-primary" />
							Como funciona
						</div>
						<div className="space-y-2">
							{[
								"Informe seu número e gere o código",
								"Clique no link que aparece para abrir o WhatsApp",
								"Envie a mensagem pronta para confirmar",
							].map((text, i) => (
								<div key={i} className="flex items-start gap-3 text-sm">
									<span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
										{i + 1}
									</span>
									<span className="text-muted-foreground pt-0.5">{text}</span>
								</div>
							))}
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="connection-phone">Número de WhatsApp</Label>
						<Input
							id="connection-phone"
							placeholder="Ex.: 5511999999999"
							inputMode="tel"
							value={phone}
							onChange={(e) => handlePhoneChange(e.target.value)}
							className={phoneError ? "border-destructive" : ""}
						/>
						{phoneError ? (
							<p className="text-sm text-destructive">{phoneError}</p>
						) : (
							<p className="text-xs text-muted-foreground">
								Inclua DDD e o 9 inicial (ex: 5511999999999)
							</p>
						)}
					</div>

					<Button
						variant="secondary"
						onClick={handleGenerateCode}
						disabled={whatsAppLink.isPending}
						className="w-full gap-2"
					>
						<MessageSquare className="h-4 w-4" />
						{whatsAppLink.isPending ? "Gerando..." : "Gerar código"}
					</Button>

					{code && (
						<div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center space-y-3">
							<p className="text-xs text-muted-foreground uppercase tracking-wide">
								Envie no WhatsApp
							</p>
							<p className="text-xl font-mono font-bold text-primary">
								VINCULAR {code}
							</p>
							<a
								href={buildWaMeLink(code)}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-2 rounded-md bg-[#25D366] px-4 py-2 text-sm font-medium text-white hover:bg-[#1da851] transition-colors"
							>
								<ExternalLink className="h-4 w-4" />
								Abrir no WhatsApp
							</a>
							{expiresAt && (
								<p className="text-xs text-muted-foreground">
									Expira às{" "}
									{new Date(expiresAt).toLocaleTimeString("pt-BR", {
										hour: "2-digit",
										minute: "2-digit",
									})}
								</p>
							)}
						</div>
					)}

					{status === "pending" && (
						<div className="flex items-center justify-between">
							<Badge variant="secondary">Aguardando confirmação</Badge>
							<Button
								variant="outline"
								size="sm"
								onClick={handleCheckStatus}
								disabled={isChecking}
							>
								{isChecking ? "Verificando..." : "Verificar status"}
							</Button>
						</div>
					)}

					{status === "verified" && (
						<div className="flex items-center justify-center">
							<Badge className="bg-success text-success-foreground">
								Vinculado
							</Badge>
						</div>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => handleOpenChange(false)}>
						Fechar
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

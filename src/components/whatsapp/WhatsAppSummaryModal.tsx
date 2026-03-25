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
import { useAuth } from "@/hooks/useAuth";
import { useSendWhatsAppMessage } from "@/hooks/useWhatsApp";
import { useState } from "react";
import { toast } from "sonner";

interface WhatsAppSummaryModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	linkedPhone: string;
	summaryMessage: string;
	monthName: string;
}

export const WhatsAppSummaryModal = ({
	open,
	onOpenChange,
	linkedPhone,
	summaryMessage,
	monthName,
}: WhatsAppSummaryModalProps) => {
	const { user } = useAuth();
	const { mutateAsync: sendWhatsApp } = useSendWhatsAppMessage();
	const [isSending, setIsSending] = useState(false);

	const handleSend = async () => {
		if (!user?.id) {
			toast.error("É necessário estar autenticado para enviar mensagens.");
			return;
		}

		if (!summaryMessage) {
			toast.error("Não foi possível montar o resumo para envio.");
			return;
		}

		try {
			setIsSending(true);
			await sendWhatsApp({
				userId: user.id,
				to: linkedPhone,
				message: summaryMessage,
			});
			toast.success("Resumo enviado via WhatsApp!");
			onOpenChange(false);
		} catch {
			toast.error("Não foi possível enviar a mensagem no momento.");
		} finally {
			setIsSending(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Enviar resumo</DialogTitle>
					<DialogDescription>
						Envie o resumo financeiro de {monthName} para seu WhatsApp.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-2">
					<div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
						<span className="text-sm font-mono">{linkedPhone}</span>
						<Badge className="bg-success text-success-foreground">
							Vinculado
						</Badge>
					</div>

					<div className="space-y-2">
						<p className="text-sm font-medium">Prévia do resumo</p>
						<pre className="rounded-lg border bg-muted/30 p-3 text-xs whitespace-pre-wrap font-mono max-h-[200px] overflow-y-auto">{summaryMessage}</pre>
					</div>
				</div>

				<DialogFooter className="gap-2 sm:gap-0">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancelar
					</Button>
					<Button onClick={handleSend} disabled={isSending}>
						{isSending ? "Enviando..." : "Enviar"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
